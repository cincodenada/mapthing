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
    trackid = request.matchdict['id']
    track = DBSession.query(Track).filter_by(id=trackid).first()
    points = track.getPoints(trackid)
    pointlist = []
    for t, p in points:
        pointlist.append((p.latitude,p.longitude))

    DBSession.commit()
    
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
        subtracks = Subtrack.getByDate(startdate, enddate)
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

    for p, s, t in points:
        categorizer.add_point(p)
        jsonifier.add_point(p, s, t)

    subtracks_by_track = defaultdict(list)
    for [st] in subtracks:
        tid = st.track_id
        subtracks_by_track[tid].append(st)

    existing_trips = []
    new_stopsets = []
    for tid, points in groupby(points, lambda pst: pst[2].id):
        if tid in subtracks_by_track:
            existing_trips += subtracks_by_track[tid]
        else:
            hist = gps_history.History(location_pool)
            for p, s, t in points:
                hist.add_point(p)
            new_stopsets += hist.finish()
                
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
    for ss in new_stopsets:
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
        } for s in st.stops]
    } for st in all_trips]
                    

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

