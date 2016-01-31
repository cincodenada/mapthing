import shapefile
from StringIO import StringIO

class Track:
    pass

#TODO: All of this
class Location:
    stdev_fence = 2
    stdev_include = 1

    def __init__(self, p):
        self.lats = []
        self.lons = []

        self.num_points = 0

    def add_point(self, p):
        if(self.num_points == 0):
            self.lats.append(p.latitude)
            self.lons.append(p.longitude)

            self.center = (p.latitude, p.longitude)
            self.stdev = (0,0)
        else:
            if(
                (self.center[0] - p.latitude) < stdev_lat*stdev_fence and
                (self.center[1] - p.longitude) < stdev_lon*stdev_fence
            ):
                self.lats.append(p.latitude)
                self.lons.append(p.longitude)

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
