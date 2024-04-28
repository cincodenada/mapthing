from sqlalchemy import (
    Column,
    Index,
    Integer,
    Text,
    Float,
    DateTime,
    String,
    ForeignKey,
    func,
    literal_column,
)
from sqlalchemy.orm import relationship

from mapthing.models import BaseModel
#from .stop import Stop
from LatLon23 import LatLon

class Point(BaseModel):
    __tablename__ = 'points'
    id = Column(Integer, primary_key=True)
    latitude = Column(Float)
    longitude = Column(Float)
    time = Column(DateTime(timezone=True))
    speed = Column(Float)
    accuracy = Column(Float)
    altitude = Column(Float)
    bearing = Column(Float)
    segment_id = Column(Integer, ForeignKey('segments.id'))

    @classmethod
    def getByDate(cls, start, end):
        # Shouldn't have to do isoformat() here but...
        return cls.query(Point,Segment,Track)\
                .join(Track.segments)\
                .join(Segment.points)\
                .filter(Point.time >= start.isoformat())\
                .filter(Point.time <= end.isoformat())\
                .order_by(Point.time)

    @classmethod
    def getByLatLon(cls, ne, sw):
        return cls.query(Point,Segment,Track)\
                .join(Track.segments)\
                .join(Segment.points)\
                .filter(Point.latitude >= sw[0])\
                .filter(Point.latitude <= ne[0])\
                .filter(Point.longitude >= sw[1])\
                .filter(Point.longitude <= ne[1])\
                .order_by(Point.time)

    @classmethod
    def getTimes(cls, ne, sw):
        #timestr = r"strftime('%w %H:%M',points.time/1000,'unixepoch','localtime')"
        timestr = r"to_date('D HH:MI',points.time)"
        return cls.query(func.count(),Point.time)\
                .filter(Point.latitude >= sw[0])\
                .filter(Point.latitude <= ne[0])\
                .filter(Point.longitude >= sw[1])\
                .filter(Point.longitude <= ne[1])\
                .group_by(timestr)\
                .order_by(Point.time)

    def getLatLon(self):
        return LatLon(self.latitude, self.longitude)

class Segment(BaseModel):
    __tablename__ = 'segments'
    id = Column(Integer, primary_key=True)
    track_id = Column(Integer, ForeignKey('tracks.id'))
    
    points = relationship(Point)
    #stops = relationship(Stop)

class Track(BaseModel):
    __tablename__ = 'tracks'
    id = Column(Integer, primary_key=True)
    name = Column(String)
    created = Column(DateTime(timezone=True))
    
    segments = relationship(Segment)

    @classmethod
    def getByDate(cls, start, end):
        return cls.query(
                Track.id,
                func.min(Point.time),
                func.max(Point.time),
                func.min(Point.latitude),
                func.max(Point.latitude),
                func.min(Point.longitude),
                func.max(Point.longitude),
                )\
                .join(Track.segments)\
                .join(Segment.points)\
                .filter(Point.time >= start)\
                .filter(Point.time <= end)\
                .group_by(Track.id)\
                .order_by(func.min(Point.time))

    @classmethod
    def getPoints(cls, id, bb = None):
        return cls.query(Track,Point) \
                .join(Track.segments) \
                .join(Segment.points) \
                .filter(Track.id==id).all()

#Index('my_index', MyModel.name, unique=True, mysql_length=255)
