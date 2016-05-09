#import shapefile
import math
import json
from StringIO import StringIO
from LatLon import LatLon

class Track:
    pass

class LocationPool:
    def __init__(self, radius):
        self.locations = []
        self.radius = radius
        self.num_points = 0

    def add_point(self, point):
        return add_points([point])[0]

    def add_points(self, points):
        matches = {}
        for l in self.locations:
            for i, p in enumerate(points):
                if i not in matches:
                    if l.add_point(p):
                        matches[i] = l

        for i, p in enumerate(points):
            if i not in matches:
                newloc = Location(p, self.radius)
                newloc.id = len(self.locations)
                self.locations.append(newloc)
                matches[i] = newloc

        self.num_points += len(points)

        return matches

    def get_serializable(self, full=True):
        outarr = []
        for l in self.locations:
            outarr.append(l.get_serializable(full))

        return outarr


class Location:
    stdev_fence = 2
    stdev_include = 1

    def __init__(self, p = None, radius = 50):
        self.points = []
        self.lat_sum = 0
        self.lon_sum = 0

        self.num_points = 0

        self.radius = float(radius)/1000.0 # Convert m to km

        if p:
            self.add_point(p)

    def center(self):
        return LatLon(self.lat_sum/self.num_points, self.lon_sum/self.num_points)

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
            if center.distance(p) > self.radius:
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

class Trip:
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

class History:
    def __init__(self, trip_gap=3*60):
        self.trips = []
        self.points = []
        self.last_time = None
        self.cur_trip = Trip()
        self.trip_gap = trip_gap*1000 # Convert to ms

    def add_point(self, p):
        self.points.append(p)

        if(self.last_time is not None and (p.time - self.last_time) > self.trip_gap):
            self.trips.append(self.cur_trip)
            self.cur_trip = Trip()

        self.cur_trip.add_point(p)
        self.last_time = p.time

    def get_trips(self, min_length = 3):
        if(self.cur_trip.num_points() > 0):
            self.trips.append(self.cur_trip)

        trips = []
        for t in self.trips:
            if(t.num_points() >= min_length):
                trips.append({
                    'start': t.start.time,
                    'end': t.end.time,
                    'start_loc': t.startloc,
                    'end_loc': t.endloc,
                })

        return trips

    def get_locations(self, radius, min_trip_len = 0):
        locations = LocationPool(radius)

        for t in self.trips:
            if len(t.points) > min_trip_len:
                triploc = locations.add_points([t.start, t.end])

                t.startloc = triploc[0].id
                t.endloc = triploc[1].id

        return locations
