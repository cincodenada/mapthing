from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from trackedit import History, Track
from gpsdb.point import Point

engine = create_engine('sqlite:///MapThing.sqlite', echo=True)
Session = sessionmaker(bind=engine)
session = Session()

print "Initializing query..."
points = session.query(Point).\
    filter(Point.lat < 45.538479).\
    filter(Point.lon < -122.681716).\
    filter(Point.lat > 45.525732).\
    filter(Point.lon > -122.711929)

print "Adding points..."
hist = History()
for p in points:
    hist.add_point(p)

hist.get_trips()
print "Found %d trips" % (len(hist.trips))

A = Track(hist.trips[0].points)
B = Track(hist.trips[1].points)
print A.H(B)


