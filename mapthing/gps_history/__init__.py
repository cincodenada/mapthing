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

def splitLatsAndLons(points):
    return list(zip(*[(p.latitude, p.longitude) for p in points]))


class Track(object):
    pass

class LocationPool(object):
    def __init__(self, locations = []):
        self.locations = {l.id: Location(**l.to_dict()) for l in locations}
        self.auto_id = 0
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
                newloc = Location(radius=auto_radius, latitude=p.lat, longitude=p.lon)
                newloc.pending = True
                self.locations[newloc.id] = newloc
                matches[i] = newloc

        self.num_points += len(points)

        return matches

    def get_serializable(self, full=True):
        outmap = {}
        for l in self.locations.values():
            outmap[l.id] = l.get_serializable(full)

        return outmap


class Location(object):
    stdev_fence = 2
    stdev_include = 1
    auto_id = 0

    def __init__(self, id = None, name = None, radius = 50, **kwargs):
        if id:
            self.id = id
        else:
            self.id = 'auto_' + str(Location.auto_id)
            Location.auto_id += 1

        self.name = name
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

class Trip(object):
    def __init__(self, start = None, end = None, start_loc = None, end_loc = None):
        self.start = start
        self.end = end
        self.start_loc = start_loc
        self.end_loc = end_loc
        self.points = []

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
            "start_loc": self.start_loc,
            "end_loc": self.end_loc
        }

class Stop:
    def __init__(self):
        self.points = []

    def add_point(self, p):
        self.points.append(p)

    def finish(self, location_pool, outing, prev_trip, min_secs=120):
        trip_duration = self.points[-1].time - self.points[0].time
        if(trip_duration < timedelta(seconds=min_secs)):
            return None

        lats, lons = splitLatsAndLons(self.points)
        avg_point = LatLon(mean(lats), mean(lons))
        loc = location_pool.add_point(avg_point, 50)
        #print('\n'.join([str(p.time) for p in self.points]))
        new_trip = Trip(end=self.points[-1], end_loc=loc.id)
        if prev_trip:
            new_trip.start = prev_trip.end
            new_trip.start_loc = prev_trip.end_loc
        else:
            new_trip.start = outing.start
            new_trip.start_loc = outing.start_loc

        return new_trip

class History(object):
    def __init__(self, locations = [], outing_gap=3*60):
        self.outings = []
        self.points = []
        self.last_time = None
        self.cur_outing = Trip()
        self.outing_gap = timedelta(seconds=outing_gap) # Convert to ms
        self.locations = LocationPool(locations)

    def add_point(self, p):
        if self.last_time and p.time < self.last_time:
            print("Warning! Point out of order!")

        self.points.append(p)

        if(self.last_time is not None and (p.time - self.last_time) > self.outing_gap):
            self.outings.append(self.cur_outing)
            self.cur_outing = Trip()

        self.cur_outing.add_point(p)
        self.last_time = p.time

    def get_trips(self, min_length = 3):
        if(self.cur_outing.num_points() > 0):
            self.outings.append(self.cur_outing)

        pool = self.get_locations(50, 3)

        last_time = None

        trips = []
        prev_trip = None
        for o in self.outings:
            if prev_trip and o.start_loc is not None and o.start_loc == o.end_loc and o.start_loc == prev_trip.end_loc:
                outside = pool.locations[o.start_loc].count_outside(o.points)
                if outside < 5:
                    trips[-1]['end'] = o.end.time
                    continue
                else:
                    print(f"Leaving weird trip: {outside}")

            rolling_loc = deque(maxlen=10)
            cur_stop = None
            for p in o.points:
                # TODO: We could do this much more efficiently by using the mechanics in Location already
                rolling_loc.append(p)
                if len(rolling_loc) < 2:
                    continue
                dev = [stdev(l) for l in splitLatsAndLons(rolling_loc)]
                stopped = dev[0]*1e5 < 50 and dev[1]*1e5 < 50
                if stopped:
                    if not cur_stop:
                        cur_stop = Stop()
                    cur_stop.add_point(p)
                else:
                    if cur_stop:
                        new_trip = cur_stop.finish(self.locations, o, prev_trip)
                        if(new_trip):
                            trips.append(new_trip)
                            prev_trip = new_trip
                        cur_stop = None

            final_trip = None
            if cur_stop:
                final_trip = cur_stop.finish(self.locations, o, prev_trip)

            if final_trip:
                trips.append(final_trip)
            else:
                if prev_trip:
                    trips.append(Trip(
                        start=prev_trip.end,
                        start_loc=prev_trip.end_loc,
                        end=o.end,
                        end_loc=o.end_loc
                    ))
                else:
                    trips.append(o)

        return trips
