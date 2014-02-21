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

@view_config(route_name='date_track', renderer='templates/view_track.pt')
def date_track(request):
    startdate = date_parse(request.matchdict['start'])
    enddate = date_parse(request.matchdict['end'])
    points = Point.getByDate(startdate, enddate).all()
    pointlist = {}
    segments = {}
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

        if not p.segment_id in pointlist:
            pointlist[p.segment_id] = []
        pointlist[p.segment_id].append((p.latitude,p.longitude,color))
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
        tracks[t.id]['segments'].append(s.id)
     
    return {'json_tracks': json.dumps(tracks), 'json_segments': json.dumps(segments), 'points': points, 'json_points': json.dumps(pointlist)}

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

