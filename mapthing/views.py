from pyramid.response import Response
from pyramid.view import view_config

from sqlalchemy.exc import DBAPIError

import json
from dateutil.parser import parse as date_parse
from operator import itemgetter, attrgetter

from .models import (
    DBSession,
    Track,
    Segment,
    Point,
    )

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
    startdate = date_parse(request.matchdict['start'])
    enddate = date_parse(request.matchdict['end'])
    trackdata = []
    query = Track.getByDate(startdate, enddate)
    data = DBSession.execute(query)
    while(True):
        curtrack = data.fetchone()
        if(curtrack is None):
            break;
        trackdata.append(dict(zip(('id','start','end','minlat','maxlat','minlon','maxlon'),curtrack)))
    return { 'json_data': json.dumps(trackdata) }

@view_config(route_name='ajax_track', renderer='templates/view_track.pt')
def ajax_track(request):
    startdate = date_parse(request.matchdict['start'])
    enddate = date_parse(request.matchdict['end'])
    params = {
        'start': request.matchdict['start'],
        'end': request.matchdict['end'],
    }
    return { 'json_params': json.dumps(params) }

@view_config(route_name='ajax_points', renderer='templates/json.pt')
def date_track(request):
    startdate = date_parse(request.matchdict['start'])
    enddate = date_parse(request.matchdict['end'])
    points = Point.getByDate(startdate, enddate).all()
    pointlist = {}
    segments = {}
    timepoints = []
    tracks = {}
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
    for p, s, t in points:
        rollingavg.insert(0,p.speed)
        rollingavg.pop()
        avg = sum(rollingavg)/avg_len
        diff = [(mode, abs(1-(avg/speedpoints[mode]['midpoint']))) for mode in speedpoints]
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
     
    return {'json_data': json.dumps({
        'tracks': tracks, 
        'segments': segments, 
        'points': pointlist,
        'timepoints': timepoints,
    })}

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

