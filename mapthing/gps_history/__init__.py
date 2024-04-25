#import shapefile
from operator import truediv as old_div
from builtins import object
import math
import json
from io import StringIO
from LatLon23 import LatLon
import datetime

class Track(object):
    pass

class LocationPool(object):
    def __init__(self, locations = []):
        self.locations = [Location(**l.to_dict()) for l in locations]
        self.num_points = 0

    def add_point(self, point, auto_radius):
        return add_points([point], auto_radius)[0]

    def add_points(self, points, auto_radius):
        matches = {}
        for l in self.locations:
            for i, p in enumerate(points):
                if i not in matches:
                    if l.add_point(p):
                        matches[i] = l

        for i, p in enumerate(points):
            if i not in matches:
                newloc = Location(id=len(self.locations)+1, radius=auto_radius, latitude=p.latitude, longitude=p.longitude)
                newloc.pending = True
                self.locations.append(newloc)
                matches[i] = newloc

        self.num_points += len(points)

        return matches

    def get_serializable(self, full=True):
        outarr = []
        for l in self.locations:
            outarr.append(l.get_serializable(full))

        return outarr


class Location(object):
    stdev_fence = 2
    stdev_include = 1

    def __init__(self, id = None, name = None, radius = 50, **kwargs):
        self.id = id
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

class Outing(object):
    def __init__(self):
        self.points = []
        self.start = self.end = None
        self.startloc = self.endloc = None
        pass

    def add_point(self, p):
        self.points.append(p)
        if(self.start is None or p.time < self.start.time):
            self.start = p
        if(self.end is None or p.time > self.end.time):
            self.end = p

    def num_points(self):
        return len(self.points)

    def get_type(self, force):
        pass

    def get_shapefile(self, path):
        if(len(self.points) <= 10):
            return None

        shp = StringIO()
        poly = [[p.longitude, p.latitude] for p in self.points]
        w = shapefile.Writer(3)
        w.poly(shapeType=3, parts=[poly])
        w.save(path)
        return w

class History(object):
    def __init__(self, locations = [], outing_gap=3*60):
        self.outings = []
        self.points = []
        self.last_time = None
        self.cur_outing = Outing()
        self.outing_gap = datetime.timedelta(seconds=outing_gap) # Convert to ms
        self.locations = LocationPool(locations)

    def add_point(self, p):
        self.points.append(p)

        if(self.last_time is not None and (p.time - self.last_time) > self.outing_gap):
            self.outings.append(self.cur_outing)
            self.cur_outing = Outing()

        self.cur_outing.add_point(p)
        self.last_time = p.time

    def get_trips(self, min_length = 3):
        if(self.cur_outing.num_points() > 0):
            self.outings.append(self.cur_outing)

        pool = self.get_locations(50, 3)

        trips = []
        last_trip = None
        for t in self.outings:
            if last_trip and t.startloc is not None and t.startloc == t.endloc and t.startloc == last_trip.endloc:
                outside = pool.locations[t.startloc].count_outside(t.points)
                if outside < 5:
                    trips[-1]['end'] = t.end.time
                    continue
                else:
                    print(f"Leaving weird trip: {outside}")

            if(t.num_points() >= min_length):
                last_trip = t
                trips.append({
                    'start': t.start.time,
                    'end': t.end.time,
                    'start_loc': t.startloc,
                    'end_loc': t.endloc,
                })


        return trips

    def get_locations(self, radius, min_outing_len = 5):
        for t in self.outings:
            if t.num_points() >= min_outing_len:
                outingloc = self.locations.add_points([t.start, t.end], radius)

                t.startloc = outingloc[0].id
                t.endloc = outingloc[1].id

        return self.locations
