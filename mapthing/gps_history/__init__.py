import shapefile
from StringIO import StringIO
from LatLon import LatLon

class Track:
    pass

#TODO: All of this
class Location:
    stdev_fence = 2
    stdev_include = 1

    def __init__(self, p = None):
        self.points = []
        self.lat_sum = 0
        self.lon_sum = 0

        self.num_points = 0

        self.radius = 1 # Convert m to km

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


class Trip:
    def __init__(self):
        self.points = []
        self.start = self.end = None
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
        print poly
        w.save(path)
        return w

class History:
    trip_gap = 3*60*1000

    def __init__(self):
        self.trips = []
        self.points = []
        self.last_time = None
        self.cur_trip = Trip()

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
                    'start_loc': (t.start.latitude, t.start.longitude),
                    'end_loc': (t.end.latitude, t.end.longitude),
                })

        return trips
