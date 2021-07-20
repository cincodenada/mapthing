from __future__ import division
from __future__ import absolute_import
from builtins import zip
from builtins import range
from past.utils import old_div
from pyramid.httpexceptions import HTTPNotFound
from pyramid.response import Response
from pyramid.view import view_config, notfound_view_config

from sqlalchemy.exc import DBAPIError

import json
from datetime import datetime, timedelta
import pytz
from dateutil.parser import parse as date_parse
from operator import itemgetter, attrgetter
import tempfile
from . import gps_history
from datetime import date, timedelta

from . import uploader

from .models import (
    DBSession,
    Track,
    Segment,
    Point,
    )

class DatetimeEncoder(json.JSONEncoder):
    epoch = datetime.fromtimestamp(0, pytz.utc)
    def default(self, obj):
        if isinstance(obj, datetime):
            return (obj - self.epoch).total_seconds()*1000
        return json.JSONEncoder.default(self, obj)

@notfound_view_config(append_slash=True)
def notfound(request):
        return HTTPNotFound()

@view_config(route_name='view_track', renderer='templates/view_track.pt')
def view_track(request):
    trackid = request.matchdict['id']
    track = DBSession.query(Track).filter_by(id=trackid).first()
    points = track.getPoints(trackid)
    pointlist = []
    for t, p in points:
        pointlist.append((p.latitude,p.longitude))
    
    return { 'tracks': json.dumps({trackid:track}), 'points': points, 'json_points': json.dumps({trackid: pointlist})}

@view_config(route_name='get_tracks', renderer='templates/json.pt')
def get_tracks(request):
    startdate = date_parse(request.params['start'])
    enddate = date_parse(request.params['end'])
    trackdata = []
    query = Track.getByDate(startdate, enddate)
    data = DBSession.execute(query)
    while(True):
        curtrack = data.fetchone()
        if(curtrack is None):
            break;
        trackdata.append(dict(list(zip(('id','start','end','minlat','maxlat','minlon','maxlon'),curtrack))))
    return { 'json_data': json.dumps(trackdata, cls=DatetimeEncoder) }

@view_config(route_name='ajax_track', renderer='templates/view_track.pt')
def ajax_track(request):
    if 'end' in request.params:
        enddate = date_parse(request.params['end'])
    else:
        enddate = datetime.now().replace(microsecond=0)

    if 'start' in request.params:
        startdate = date_parse(request.params['start'])
    else:
        startdate = enddate - timedelta(days=7)

    params = {
        'start': startdate.isoformat(' '),
        'end': enddate.isoformat(' '),
    }
    return { 'json_params': json.dumps(params) }

@view_config(route_name='ajax_times', renderer='templates/json.pt')
def ajax_times(request):
    ne = request.params['ne'].split(',')
    sw = request.params['sw'].split(',')
    for i in range(1):
        if(ne[i] < sw[i]):
            ne[i], sw[i] = sw[i], ne[i]

    points = Point.getTimes(ne, sw)
    pointdata = []
    for c, t in points:
        pointdata.append((t,c))

    return {'json_data': json.dumps(pointdata)}


@view_config(route_name='ajax_points', renderer='templates/json.pt')
def date_track(request):
    if('start' in request.params):
        startdate = date_parse(request.params['start'])
        enddate = date_parse(request.params['end'])
        points = Point.getByDate(startdate, enddate).all()
    elif('ne' in request.params):
        ne = request.params['ne'].split(',')
        sw = request.params['sw'].split(',')
        for i in range(1):
            if(ne[i] < sw[i]):
                ne[i], sw[i] = sw[i], ne[i]

        points = Point.getByLatLon(ne, sw)

    pointlist = {}
    segments = {}
    timepoints = []
    tracks = {}
    trips = []
    speedpoints = {
        'walking': {
            'color': '#00FF00',
            'midpoint': 1.25,
        },
        'jogging': {
            'color': '#FF6600',
            'midpoint': 2,
        },
        'biking': {
            'color': '#FFFF00',
            'midpoint': 7.5,
        },
        'driving': {
            'color': '#FF0000',
            'midpoint': 30.5,
        },
    }
    avg_len = 10 
    mode_len = 20
    rollingavg = [0]*avg_len
    rollingcat = ['walking']*mode_len

    hist = gps_history.History()

    for p, s, t in points:
        hist.add_point(p)

        if(p.speed):
            rollingavg.insert(0,p.speed)
            rollingavg.pop()
        avg = old_div(sum(rollingavg),avg_len)
        diff = [(mode, abs(1-(old_div(avg,speedpoints[mode]['midpoint'])))) for mode in speedpoints]
        diff.sort(key=itemgetter(1))
        rollingcat.insert(0,diff[0][0])
        rollingcat.pop()
        counts = {} 
        for val in rollingcat:
            if(val in counts):
                counts[val]+=1
            else:
                counts[val]=1

        winner = False
        for mode in counts:
            if not winner or counts[mode] > counts[winner]:
                winner = mode

        if(winner):
            color = speedpoints[winner]['color']
        else:
            color = '#000000'

        if not s.id in pointlist:
            pointlist[s.id] = []
        pointnum = len(timepoints)
        timepoints.append({
            'lat': p.latitude,
            'lon': p.longitude,
            'color': color,
            'time': p.time,
            'segid': s.id,
        })
        pointlist[s.id].append(pointnum)
        if not s.id in segments:
            segments[s.id] = {
                'id': s.id,
                'track_id': s.track_id,
                'start_time': None,
                'end_time': None,
            }

        if(segments[s.id]['start_time'] is None or p.time < segments[s.id]['start_time']):
            segments[s.id]['start_time'] = p.time
        if(segments[s.id]['end_time'] is None or p.time > segments[s.id]['end_time']):
            segments[s.id]['end_time'] = p.time

        if not t.id in tracks:
            tracks[t.id] = {
                'id': t.id,
                'name': t.name,
                'segments': [],
            }
        if not s.id in tracks[t.id]['segments']:
            tracks[t.id]['segments'].append(s.id)

    locations = hist.get_locations(50,3) # Fill in location data

    return {'json_data': json.dumps({
        'tracks': tracks, 
        'segments': segments, 
        'points': pointlist,
        'timepoints': timepoints,
        'trips': hist.get_trips(),
        'locations': locations.get_serializable(),
    }, cls=DatetimeEncoder)}

@view_config(route_name='upload_data', renderer='templates/json.pt')
def upload_data(request):
    myfile = request.params['data']
    (basename, ext) = myfile.filename.rsplit('.', 1)

    if(ext == 'gpx'):
        imp = uploader.ImportGpx(myfile)
        querylist = imp.load()
    else:
        imp = uploader.ImportSqlite(myfile)
        querylist = imp.load()

#   upload_directory = os.path.join(os.getcwd(), '/myapp/static/uploads/')
#   tempfile = os.path.join(upload_directory, myfile)
#   startdate = date_parse(request.params['start'])
#   enddate = date_parse(request.params['end'])
#   params = {
#       'start': request.params['start'],
#       'end': request.params['end'],
#   }
    return { 'json_data': json.dumps(querylist) }



conn_err_msg = """\
Pyramid is having a problem using your SQL database.  The problem
might be caused by one of the following things:

1.  You may need to run the "initialize_MapThing_db" script
    to initialize your database tables.  Check your virtual 
    environment's "bin" directory for this script and try to run it.

2.  Your database server may not be running.  Check that the
    database server referred to by the "sqlalchemy.url" setting in
    your "development.ini" file is running.

After you fix the problem, please restart the Pyramid application to
try it again.
"""

