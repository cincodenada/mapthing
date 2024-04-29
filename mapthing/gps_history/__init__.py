#import shapefile
from operator import truediv as old_div
from builtins import object
import math
import json
from io import StringIO
from LatLon23 import LatLon
from datetime import timedelta
from collections import deque
from functools import reduce
from statistics import mean, stdev
from itertools import islice, pairwise
from dataclasses import dataclass
from typing import Any

from mapthing import models as Orm
from mapthing.models import getDb

def splitLatsAndLons(points):
    return list(zip(*[(p.latitude, p.longitude) for p in points]))

def is_moving(points, min_move_m=50):
    dev = [stdev(l) for l in splitLatsAndLons(points)]
    #print('/'.join([f"{d*1e5:4.0f}" for d in dev]))
    return dev[0]*1e5 >= min_move_m or dev[1]*1e5 >= min_move_m

class LocationPool(object):
    def __init__(self, locations = []):
        self.locations = {l.id: Location(**l.to_dict()) for l in locations}
        self.num_points = 0

    def add_point(self, point, auto_radius):
        return self.add_points([point], auto_radius)[0]

    def add_points(self, points, auto_radius):
        matches = {}
        for l in self.locations.values():
            for i, p in enumerate(points):
                if i not in matches:
                    if l.add_point(p):
                        matches[i] = l

        for i, p in enumerate(points):
            if i not in matches:
                newloc = Location(radius=auto_radius, latitude=p.lat, longitude=p.lon, type=Orm.LocationType.auto)
                self.locations[newloc.id] = newloc
                matches[i] = newloc

        self.num_points += len(points)

        return matches

    def get_serializable(self, full=True):
        outmap = {}
        for l in self.locations.values():
            outmap[l.id] = l.get_serializable(full)

        return outmap

    def locate(self, stop, min_secs=120, force=True):
        stay_duration = stop.end.time - stop.start.time
        if(stay_duration < timedelta(seconds=min_secs) and not force):
            return None

        lats, lons = splitLatsAndLons(stop.points)
        avg_point = LatLon(mean(lats), mean(lons))
        #print('\n'.join([str(p.time) for p in stop.points]))
        return self.add_point(avg_point, 50)

    def find_stops(self, track, window_size=100, min_move_m=50):
        # Can't do our calculations if we don't have at least two points
        if len(track.points) < 2:
            return StopSet([], track)

        # TODO: Other stuff treats start/end of logs as significant...do we want to??
        stops = []
        rolling_loc = deque(islice(track.points, 0, window_size), maxlen=window_size)
        halfwin = window_size//2

        cur_stop = None
        if not is_moving(rolling_loc):
            cur_stop = Stop(track)
            cur_stop.start_idx = 0

        for idx, p in islice(enumerate(track.points), window_size, None):
            # TODO: We could do this much more efficiently by using the mechanics in Location already
            rolling_loc.append(p)

            if is_moving(rolling_loc):
                if cur_stop:
                    cur_stop.end_idx = idx - halfwin
                    cur_stop.loc = self.locate(cur_stop)
                    if cur_stop.loc:
                        stops.append(cur_stop)
                    cur_stop = None
            else:
                if not cur_stop:
                    cur_stop = Stop(track)
                    cur_stop.start_idx = idx - halfwin

            is_first = False

        if cur_stop:
            cur_stop.end_idx = len(track.points)-1
            cur_stop.loc = self.locate(cur_stop)
            stops.append(cur_stop)

        return StopSet(stops, track)

@dataclass
class Location(object):
    stdev_fence = 2
    stdev_include = 1

    def __init__(self, id = None, name = None, radius = 50, type = None, **kwargs):
        self.id = id
        self.name = name
        self.type = type
        self.points = []
        self.lat_sum = 0
        self.lon_sum = 0

        self.num_points = 0

        self.radius = radius
        self.radius_km = old_div(float(radius),1000.0) # Convert m to km

        if 'latitude' in kwargs:
            self.add_point(LatLon(kwargs['latitude'], kwargs['longitude']))
        if 'lat' in kwargs:
            self.add_point(LatLon(kwargs['lat'], kwargs['lon']))

    def center(self):
        return LatLon(old_div(self.lat_sum,self.num_points), old_div(self.lon_sum,self.num_points))

    def count_outside(self, points):
        center = self.center()
        return len([p for p in points if center.distance(LatLon(p.latitude, p.longitude)) > self.radius_km])

    def bb(self):
        return [LatLon(self.minlat, self.minlon), LatLon(self.maxlat, self.maxlon)]

    def add_points(self, ps):
        for p in ps:
            self.add_point(p)

    def add_point(self, p):
        if not isinstance(p, LatLon):
            if hasattr(p, 'latitude'):
                p = LatLon(p.latitude, p.longitude)
            elif hasattr(p, 'lat'):
                p = LatLon(p.lat, p.lon)

        if(self.num_points == 0):
            self.minlat = self.maxlat = float(p.lat)
            self.minlon = self.maxlon = float(p.lon)
            self.stdev = (0,0)
        else:
            center = self.center()
#           if not (
#               (center[0] - p.latitude) < stdev_lat*stdev_fence and
#               (center[1] - p.longitude) < stdev_lon*stdev_fence
#           ):
            if center.distance(p) > self.radius_km:
                return False

        self.points.append(p)

        self.lat_sum += float(p.lat)
        self.lon_sum += float(p.lon)

        self.minlat = min(float(p.lat), self.minlat)
        self.maxlat = max(float(p.lat), self.maxlat)

        self.minlon = min(float(p.lon), self.minlon)
        self.maxlon = max(float(p.lon), self.maxlon)

        self.num_points += 1

        return True

    #def get_shapefile(self, path):
    #    center = self.center()
    #    w = shapefile.Writer(shapefile.POINT)
    #    for p in self.points:
    #        w.point(float(p.lon), float(p.lat))
    #    for a in range(0,360,5):
    #        pt = center.offset(a, self.radius)
    #        w.point(float(pt.lon), float(pt.lat))
    #    w.save(path)
    #    return w
    def get_serializable(self, full=True):
        c = self.center()
        out = {
            'name': self.name,
            'lat': float(c.lat),
            'lon': float(c.lon),
            'radius': self.radius,
            'num_points': self.num_points,
        }
        if(full):
            out['points'] = []
            for p in self.points:
                out['points'].append([float(p.lat), float(p.lon)])

        return out

class Track(object):
    def __init__(self, start = None, end = None, start_loc = None, end_loc = None):
        self.start = start
        self.end = end
        self.start_loc = start_loc
        self.end_loc = end_loc
        self.points = []
        self.stops = []
        self.stop_offset = None
        self.stop_count = None

    def point_finder(self):
        def find_point(search_time):
            while self.points[find_point.cur_point].time < search_time:
                find_point.cur_point+=1
            return (find_point.cur_point, self.points[find_point.cur_point])
        find_point.cur_point = 0

        return find_point

    def add_point(self, p):
        self.points.append(p)
        if(self.start is None or p.time < self.start.time):
            self.start = p
        if(self.end is None or p.time > self.end.time):
            self.end = p

    def num_points(self):
        return len(self.points)

    def get_shapefile(self, path):
        if(len(self.points) <= 10):
            return None

        shp = StringIO()
        poly = [[p.longitude, p.latitude] for p in self.points]
        w = shapefile.Writer(3)
        w.poly(shapeType=3, parts=[poly])
        w.save(path)
        return w

    def get_type(self, force):
        pass

    def get_serializable(self):
        return {
            "start": self.start.time,
            "end": self.end.time,
        }

@dataclass
class Stop:
    track: Track
    loc: int | None = None
    start_idx: int | None = None
    end_idx: int | None = None

    @property
    def start(self):
        return self.track.points[self.start_idx]

    @property
    def end(self):
        return self.track.points[self.end_idx]

    @property
    def points(self):
        if self.start_idx is None or self.end_idx is None:
            raise RuntimeError("Attempted to get points for unfinished stop!")
        return self.track.points[self.start_idx:self.end_idx]

    def get_serializable(self, full=True):
        return {
            "start": self.start.time,
            "end": self.end.time,
            "range": [self.start_idx, self.end_idx],
            "loc": self.loc.id or None,
        }

@dataclass
class StopSet:
    stops: list[Stop]
    track: Track

    # TODO: This modifies the stop list I think, which is messy
    def squish(self):
        if(len(self.stops) == 1):
            yield self.stops[0]
            return

        has_yielded = True
        for stop, next_stop in pairwise(self.stops):
            if stop.loc == next_stop.loc and (next_stop.start_idx - stop.end_idx) < 5:
                next_stop.start_idx = stop.start_idx
                continue

            yield stop
            has_yielded = True

        # Handle the case where it's all one big stop
        # There may be a more elegant way to do this
        if not has_yielded:
            yield self.stops[-1]

    def squished(self):
        return StopSet(list(self.squish()), self.track)

    def get_serializable(self):
        return {
            **self.track.get_serializable(),
            "stops": [s.get_serializable() for s in self.stops]
        }

class History(object):
    def __init__(self, locations = [], stops = [], outing_gap=3*60):
        self.outings = []
        self.points = []
        self.last_time = None
        self.stop_idx = 0
        self.cur_outing = Track()
        self.outing_gap = timedelta(seconds=outing_gap) # Convert to ms
        self.locations = LocationPool(locations)
        self.stops = stops

    def get_stops(self, start, end):
        try:
            while self.stops[self.stop_idx].end_time <= start:
                self.stop_idx+=1

            start_idx = self.stop_idx
        except IndexError:
            return (None, 0)

        try:
            while self.stops[self.stop_idx].start_time <= end:
                self.stop_idx+=1
        except IndexError:
            pass

        num_stops = self.stop_idx - start_idx

        return (start_idx, num_stops)

    def add_point(self, p):
        if self.last_time and p.time < self.last_time:
            print("Warning! Point out of order!")

        self.points.append(p)

        if(self.last_time is not None and (p.time - self.last_time) > self.outing_gap):
            (idx, count) = self.get_stops(
                self.cur_outing.start.time,
                self.cur_outing.end.time
            )
            self.cur_outing.stop_offset = idx
            self.cur_outing.stop_count = count
            self.outings.append(self.cur_outing)
            self.cur_outing = Track()

        self.cur_outing.add_point(p)
        self.last_time = p.time

    def find_stops(self, track):
        if track.stop_count:
            find_point = track.point_finder()
            stops = [
                Stop(
                    track=track,
                    loc=self.locations.locations[s.location_id],
                    start_idx=find_point(s.start_time)[0],
                    end_idx=find_point(s.end_time)[0],
                )
            # TODO: This if is bad
            for s in self.stops[track.stop_offset:track.stop_offset+track.stop_count] if type(s.location_id) == int]
            return StopSet(stops, track)
        
        return self.locations.find_stops(track)


    def finish(self, min_length = 3):
        if(self.cur_outing.num_points() > 0):
            self.outings.append(self.cur_outing)

        return [
            self.find_stops(o).squished()
            for o in self.outings
        ]
