from pyramid.response import Response
from pyramid.view import view_config

from sqlalchemy.exc import DBAPIError

import json
from dateutil.parser import parse as date_parse
from operator import itemgetter, attrgetter
import tempfile
import sqlite3
import gps_history
from datetime import date, timedelta

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
    startdate = date_parse(request.params['start'])
    enddate = date_parse(request.params['end'])
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
    if('start' in request.params):
        startdate = date_parse(request.params['start'])
    else:
        startdate = date.today() - timedelta(days=7)

    if('end' in request.params):
        enddate = date_parse(request.params['end'])
    else:
        enddate = date.today()

    params = {
        'start': startdate.strftime('%Y-%m-%d'),
        'end': enddate.strftime('%Y-%m-%d'),
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

    locations = hist.get_locations(50,3) # Fill in location data

    return {'json_data': json.dumps({
        'tracks': tracks, 
        'segments': segments, 
        'points': pointlist,
        'timepoints': timepoints,
        'trips': hist.get_trips(),
        'locations': locations.get_serializable(),
    })}

@view_config(route_name='upload_data', renderer='templates/json.pt')
def upload_data(request):
    myfile = request.params['data']
    dest = tempfile.NamedTemporaryFile(delete=False)
    myfile.file.seek(0)
    while True:
        data = myfile.file.read(2<<16)
        if not data:
            break
        dest.write(data)
    dest.close()

    conn = sqlite3.connect(dest.name)
    c = conn.cursor()
    tables = {
        'segments': {
            '_tablename_': 'segments',
            'id': '_id',
            'track_id': 'track',
        },
        'tracks': {
            '_tablename_': 'tracks',
            'id': '_id',
            'name': 'name',
            'created': 'creationtime',
        },
        'points': {
            '_tablename_': 'waypoints',
            'id': '_id',
            'latitude': 'latitude',
            'longitude': 'longitude',
            'time': 'time',
            'speed': 'speed',
            'segment_id': 'tracksegment',
            'accuracy': 'accuracy',
            'altitude': 'altitude',
            'bearing': 'bearing',
        },
    }
    querylist = []
    col_list = []
    for t, tmap in tables.iteritems():
        curmap = tmap.copy()
        curtable = curmap.pop('_tablename_',t)
        for new, orig in curmap.iteritems():
            col_list.append('`%s`.`%s` as %s_%s' % (curtable, orig, curtable, orig))
        
    fromquery = 'SELECT %(fields)s FROM %(point)s ' + \
    'LEFT JOIN %(seg)s ON %(seg)s.%(sid)s = %(point)s.%(sid_field)s ' + \
    'LEFT JOIN %(track)s ON %(track)s.%(tid)s = %(seg)s.%(tid_field)s'
    fromquery = fromquery % {
        'fields': ','.join(col_list), 
        'point': tables['points']['_tablename_'],
        'seg': tables['segments']['_tablename_'], 
        'track': tables['tracks']['_tablename_'],
        'sid': tables['segments']['id'],
        'tid': tables['tracks']['id'],
        'sid_field': tables['points']['segment_id'],
        'tid_field': tables['segments']['track_id'],
    }
    querylist.append(fromquery)
    c.row_factory = sqlite3.Row
    idmap = {k:{} for k in tables.keys()}
    #new shit starts at 138 btw in case everything goes to hell
    for row in c.execute(fromquery):
        #Find or create the track
        if(row['tracks__id'] in idmap['tracks']):
            t = idmap['tracks'][row['tracks__id']]
        else:
            t = Track()
            add_row_data(row, tables, 'tracks', t)
            DBSession.add(t)
            idmap['tracks'][row['tracks__id']] = t
        #And the segment
        if(row['segments__id'] in idmap['segments']):
            s = idmap['segments'][row['segments__id']]
        else:
            s = Segment()
            add_row_data(row, tables, 'segments', s)
            t.segments.append(s)
            idmap['segments'][row['segments__id']] = s
        #Now point!
        p = Point()
        add_row_data(row, tables, 'points', p)
        s.points.append(p)

#   upload_directory = os.path.join(os.getcwd(), '/myapp/static/uploads/')
#   tempfile = os.path.join(upload_directory, myfile)
#   startdate = date_parse(request.params['start'])
#   enddate = date_parse(request.params['end'])
#   params = {
#       'start': request.params['start'],
#       'end': request.params['end'],
#   }
    return { 'json_data': json.dumps(querylist) }

def add_row_data(row, tableinfo, table, obj):
    oldtable = tableinfo[table]['_tablename_']
    for new, old in tableinfo[table].iteritems():
        if(not new in ['_tablename_','id','track_id','segment_id']):
            setattr(obj, new, row[oldtable + '_' + old])


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

