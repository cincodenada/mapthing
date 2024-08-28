#import shapefile
from operator import truediv as old_div, itemgetter
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
from mapthing.models import LocationType

class TimePoint():
    def __init__(self, point_source):
        self.points = enumerate(point_source)
        self.next_point = next(self.points)
        self.gap = 1
        self.idx = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.gap <= 1:
            out_point = self.next_point
            self.next_point = next(self.points)
            self.gap = (self.next_point[1].time - out_point[1].time).total_seconds()
            return out_point
        else:
            self.gap -= 1
            return (None, None)

def splitLatsAndLons(points):
    return list(zip(*[(p.latitude, p.longitude) for p in points]))

def is_moving(points, thresholds_m):
    latlons = splitLatsAndLons([p for (i, p) in points if p is not None])
    if len(latlons) < 2 or len(latlons[0]) < 2:
        return None

    dev = [stdev(l) for l in latlons]
    #print('/'.join([f"{d*1e5:4.0f}" for d in dev]))
    (low_m, high_m) = thresholds_m
    comb = math.sqrt(dev[0]**2 + dev[1]**2)*1e5
    if comb < low_m:
        return False
    elif comb > high_m:
        return True

    return None
    #return dev[0]*1e5 >= min_move_m or dev[1]*1e5 >= min_move_m

class LocationSplitter:
    def __init__(self, locations):
        self.locations = locations

    def locate(self, stop, min_secs=120):
        stay_duration = stop.end.time - stop.start.time
        is_short = stay_duration < timedelta(seconds=min_secs)

        lats, lons = splitLatsAndLons(stop.points)
        avg_point = LatLon(mean(lats), mean(lons))
        #print('\n'.join([str(p.time) for p in stop.points]))
        return self.locations.add_point(avg_point, 50, LocationType.waypoint if is_short else LocationType.auto)

    def find_stops(self, track, window_size_sec=60, thresholds_m=(20, 50), max_gap_sec=60*10):
        # Can't do our calculations if we don't have at least two points
        if len(track.points) < 2:
            return StopSet([], track)

        time_points = TimePoint(track.points)

        # TODO: Other stuff treats start/end of logs as significant...do we want to??
        stops = []
        rolling_loc = deque(islice(time_points, 0, window_size_sec), maxlen=window_size_sec)


        cur_stop = None
        if is_moving(rolling_loc, thresholds_m) == False:
            cur_stop = Stop(track)
            cur_stop.start_idx = 0

        gap_len = next(idx for (idx, p) in reversed(rolling_loc) if p)
        last_idx = 0

        for idx, p in islice(time_points, window_size_sec, None):
            # TODO: We could do this much more efficiently by using the mechanics in Location already
            rolling_loc.append((idx, p))

            if p:
                gap_len = 0
                last_idx = idx
            else:
                gap_len += 1

            if gap_len > max_gap_sec:
                if cur_stop:
                    cur_stop.end_idx = last_idx
                    cur_stop.loc = self.locate(cur_stop)
                    if cur_stop.loc:
                        stops.append(cur_stop)
                    cur_stop = None
            else:
                if is_moving(rolling_loc, thresholds_m) == True:
                    if cur_stop:
                        cur_stop.end_idx = last_idx
                        cur_stop.loc = self.locate(cur_stop)
                        if cur_stop.loc:
                            stops.append(cur_stop)
                        cur_stop = None
                elif is_moving(rolling_loc, thresholds_m) == False:
                    if not cur_stop:
                        cur_stop = Stop(track)
                        cur_stop.start_idx = last_idx

            is_first = False

        if cur_stop:
            cur_stop.end_idx = len(track.points)-1
            cur_stop.loc = self.locate(cur_stop)
            stops.append(cur_stop)

        return StopSet(stops, track)

class LocationPool(object):
    def __init__(self, locations = []):
        self.locations = [Location(**l.to_dict()) for l in locations]
        self.num_points = 0

    def add_point(self, point, auto_radius, auto_type = LocationType.auto):
        self.num_points += 1

        for l in self.locations:
            if l.add_point(point):
                return l

        newloc = Location(
            radius=auto_radius,
            latitude=point.lat,
            longitude=point.lon,
            type=auto_type,
        )
        self.locations.append(newloc)
        return newloc

    def add_points(self, points, auto_radius):
        return [self.add_point(p) for p in points]

    def get_serializable(self, full=True):
        outmap = {}
        for l in self.locations:
            outmap[l.id] = l.get_serializable(full)

        return outmap

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
            'id': self.id,
            'name': self.name,
            'lat': float(c.lat),
            'lon': float(c.lon),
            'radius': self.radius,
            'num_points': self.num_points,
            'type': self.type,
        }
        if(full):
            out['points'] = []
            for p in self.points:
                out['points'].append([float(p.lat), float(p.lon)])

        return out

class Track(object):
    def __init__(self, start = None, end = None):
        self.start = start
        self.end = end
        self.points = []
        self.stops = []

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
    loc: Location | None = None
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
    def __init__(self, locations = None, outing_gap=3*60):
        self.outings = []
        self.points = []
        self.last_time = None
        self.stop_idx = 0
        self.cur_outing = Track()
        self.outing_gap = timedelta(seconds=outing_gap) # Convert to ms
        self.locations = locations
        self.stops = []

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
        return LocationSplitter(self.locations).find_stops(track)

    def finish(self, min_length = 3):
        if(self.cur_outing.num_points() > 0):
            self.outings.append(self.cur_outing)

        return [
            self.find_stops(o).squished()
            for o in self.outings
        ]

class Jsonifier:
    def __init__(self):
        self.pointlist = {}
        self.segments = {}
        self.timepoints = []
        self.tracks = {}

    def add_point(self, p, s, t):
        if not s.id in self.pointlist:
            self.pointlist[s.id] = []

        pointnum = len(self.timepoints)
        self.timepoints.append({
            'lat': p.latitude,
            'lon': p.longitude,
            #'color': color,
            'time': p.time,
            'segid': s.id,
        })
        self.pointlist[s.id].append(pointnum)
        if not s.id in self.segments:
            self.segments[s.id] = {
                'id': s.id,
                'track_id': s.track_id,
                'start_time': None,
                'end_time': None,
            }

        if(self.segments[s.id]['start_time'] is None or p.time < self.segments[s.id]['start_time']):
            self.segments[s.id]['start_time'] = p.time
        if(self.segments[s.id]['end_time'] is None or p.time > self.segments[s.id]['end_time']):
            self.segments[s.id]['end_time'] = p.time

        if not t.id in self.tracks:
            self.tracks[t.id] = {
                'id': t.id,
                'name': t.name,
                'segments': [],
            }
        if not s.id in self.tracks[t.id]['segments']:
            self.tracks[t.id]['segments'].append(s.id)

    def get_serializable(self):
        return {
            'tracks': self.tracks, 
            'segments': self.segments, 
            'points': self.pointlist,
            'timepoints': self.timepoints,
        }


class Categorizer:
    def __init__(self):
        self.speedpoints = {
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
        self.avg_len = 10 
        self.mode_len = 20
        self.rollingavg = [0]*self.avg_len
        self.rollingcat = ['walking']*self.mode_len
        self.colors = []

    def add_point(self, p):
        if(p.speed):
            self.rollingavg.insert(0,p.speed)
            self.rollingavg.pop()
        avg = old_div(sum(self.rollingavg),self.avg_len)
        diff = [(
            mode,
            abs(1-(old_div(avg,self.speedpoints[mode]['midpoint'])))
        ) for mode in self.speedpoints]
        diff.sort(key=itemgetter(1))
        self.rollingcat.insert(0,diff[0][0])
        self.rollingcat.pop()
        counts = {} 
        for val in self.rollingcat:
            if(val in counts):
                counts[val]+=1
            else:
                counts[val]=1

        winner = False
        for mode in counts:
            if not winner or counts[mode] > counts[winner]:
                winner = mode

        if(winner):
            color = self.speedpoints[winner]['color']
        else:
            color = '#000000'
