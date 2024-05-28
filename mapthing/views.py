from builtins import zip
from builtins import range
from operator import truediv as old_div
from pyramid.httpexceptions import HTTPNotFound
from pyramid.response import Response
from pyramid.view import view_config, notfound_view_config

from sqlalchemy import update
from sqlalchemy.exc import DBAPIError

import json
from datetime import datetime, timedelta
import pytz
from dateutil.parser import parse as date_parse
from operator import itemgetter, attrgetter
import tempfile
from . import gps_history
from datetime import date, timedelta
from itertools import groupby
from collections import defaultdict

from . import uploader

from .models import (
    DBSession,
    Track,
    Segment,
    Point,
    Location,
    Stop,
    Subtrack,
    getDb
    )

class DatetimeEncoder(json.JSONEncoder):
    epoch = datetime.utcfromtimestamp(0)
    def default(self, obj):
        if isinstance(obj, datetime):
            return (obj - self.epoch).total_seconds()*1000
        return json.JSONEncoder.default(self, obj)

@notfound_view_config(append_slash=True)
def notfound(request):
        return HTTPNotFound()

@view_config(route_name='view_track', renderer='templates/view_track.pt')
def view_track(request):
    db = getDb()
    trackid = request.matchdict['id']
    track = db.query(Track).filter_by(id=trackid).first()
    points = track.getPoints(trackid)
    pointlist = []
    for t, p in points:
        pointlist.append((p.latitude,p.longitude))

    db.commit()
    
    return { 'tracks': json.dumps({trackid:track}), 'points': points, 'json_points': json.dumps({trackid: pointlist})}

@view_config(route_name='get_tracks', renderer='templates/json.pt')
def get_tracks(request):
    db = getDb()
    startdate = date_parse(request.params['start'])
    enddate = date_parse(request.params['end'])
    trackdata = []
    query = Track.getByDate(db, startdate, enddate)
    data = DBSession.execute(query)
    while(True):
        curtrack = data.fetchone()
        if(curtrack is None):
            break;
        trackdata.append(dict(list(zip(('id','name','start','end','minlat','maxlat','minlon','maxlon'),curtrack))))
    return { 'json_data': json.dumps(trackdata, cls=DatetimeEncoder) }

@view_config(route_name='ajax_sources', renderer='templates/json.pt')
def sources(request):
    db = getDb()
    startdate = date_parse(request.params['start'])
    enddate = date_parse(request.params['end'])
    #TODO: This ain't great
    trackdata = {}
    subtracks = defaultdict(list)
    for track in Track.getByDate(db, startdate, enddate):
        trackdata[track.id] = dict(track)
        trackdata[track.id]['subtracks'] = []
    print(trackdata)
    for subtrack in Subtrack.getByDate(db, startdate, enddate):
        print(subtrack)
        dv = subtrack.to_dict()
        print(dv)
        dv['stops'] = [s.to_dict() for s in subtrack.stops]
        trackdata[subtrack.track_id]['subtracks'].append(dv)
        
    return { 'json_data': json.dumps(list(trackdata.values()), cls=DatetimeEncoder) }

@view_config(route_name='sources', renderer='templates/sources.pt')
def view_sources(request):
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
        stops = Stop.getByLatLon(ne, sw)

    categorizer = gps_history.Categorizer()
    jsonifier = gps_history.Jsonifier()

    locs = Location.getAll()
    location_pool = gps_history.LocationPool(locs)

    track_ids = set()
    for p, s, t in points:
        #categorizer.add_point(p)
        jsonifier.add_point(p, s, t)
        track_ids.add(t.id)

    print(track_ids)
    subtracks = Subtrack.getByTrack(track_ids)
    subtracks_by_track = {}
    for [st] in subtracks:
        tid = st.track_id
        if tid not in subtracks_by_track:
            subtracks_by_track[tid] = []
        subtracks_by_track[tid].append(st)

    print([(key, len(subtracks_by_track[key])) for key in subtracks_by_track.keys()])

    points_by_track = defaultdict(list)
    for p, s, t in points:
        points_by_track[t.id].append(p)

    existing_trips = []
    new_stopsets = []
    for tid, points in points_by_track.items():
        if tid in subtracks_by_track:
            print("Using existing trips for track", tid)
            existing_trips += subtracks_by_track[tid]
        else:
            print("Generating trips for track", tid)
            hist = gps_history.History(location_pool)
            for p in points:
                hist.add_point(p)
            new_stopsets.append((tid, hist.finish()))
                
    db = getDb()

    new_locs = [l for l in location_pool.locations if not l.id]
    orm_locs = Location.fromHistLocations(new_locs)
    db.add_all(orm_locs)

    db.commit()

    # Backpopulate our new ids to the locations
    for idx, l in enumerate(orm_locs):
        print(l.id, new_locs[idx])
        new_locs[idx].id = l.id
        print(l.id, new_locs[idx])
            
    new_trips = []
    for tid, sslist in new_stopsets:
        for ss in sslist:
            t = ss.track
            st = Subtrack(
                track_id=tid,
                start_id=t.start.id,
                start_time=t.start.time,
                end_id=t.end.id,
                end_time=t.end.time
            )
            for s in ss.stops:
                st.stops.append(Stop(
                    location_id=s.loc.id,
                    start_id=s.start.id,
                    start_time=s.start.time,
                    end_id=s.end.id,
                    end_time=s.end.time,
                ))
            new_trips.append(st)

    db = getDb()
    db.add_all(new_trips)
    db.commit()

    all_trips = [*existing_trips, *new_trips]
    out_trips = [{
        "start": st.start_time,
        "end": st.end_time,
        "stops": [{
            "start": s.start_time,
            "end": s.end_time,
            "loc": s.location_id or None,
        } for s in sorted(st.stops, key=attrgetter("start_time"))]
    } for st in sorted(all_trips, key=attrgetter("start_time"))]
                    

    return {'json_data': json.dumps({
        **jsonifier.get_serializable(),
        'trips': out_trips,
        'locations': location_pool.get_serializable(),
    }, cls=DatetimeEncoder)}

@view_config(route_name='locations', renderer='templates/json.pt')
def edit_place(request):
    vals = json.loads(request.body)
    id = vals["id"]
    del vals["id"]
    DBSession.execute(update(Location).where(Location.id==id).values(**vals))
    DBSession.commit()
    return { 'json_data': "yay" }

@view_config(route_name='upload_data', renderer='templates/json.pt')
def upload_data(request):
    myfile = request.params['data']
    (basename, ext) = myfile.filename.rsplit('.', 1)

    if(ext == 'gpx'):
        imp = uploader.ImportGpx.from_upload(myfile)
        querylist = imp.load()
    else:
        imp = uploader.ImportSqlite.from_upload(myfile)
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

