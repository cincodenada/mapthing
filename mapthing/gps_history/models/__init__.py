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

from sqlalchemy.ext.declarative import declarative_base

from sqlalchemy.orm import (
    scoped_session,
    sessionmaker,
    relationship,
    backref,
    )

from zope.sqlalchemy import ZopeTransactionExtension

DBSession = scoped_session(sessionmaker(extension=ZopeTransactionExtension()))
Base = declarative_base()


class Point(Base):
    __tablename__ = 'points'
    id = Column(Integer, primary_key=True)
    latitude = Column(Float)
    longitude = Column(Float)
    time = Column(Integer)
    speed = Column(Float)
    accuracy = Column(Float)
    altitude = Column(Float)
    bearing = Column(Float)
    segment_id = Column(Integer, ForeignKey('segments.id'))

    @staticmethod
    def getByDate(start, end):
        query = DBSession.query(Point,Segment,Track)\
                .join(Segment)\
                .join(Track)\
                .filter(Point.time >= int(start.strftime('%s'))*1000)\
                .filter(Point.time <= int(end.strftime('%s'))*1000)\
                .order_by(Point.time)
        return query

    @staticmethod
    def getByLatLon(ne, sw):
        query = DBSession.query(Point,Segment,Track)\
                .join(Segment)\
                .join(Track)\
                .filter(Point.latitude >= sw[0])\
                .filter(Point.latitude <= ne[0])\
                .filter(Point.longitude >= sw[1])\
                .filter(Point.longitude <= ne[1])\
                .order_by(Point.time)
        return query

    @staticmethod
    def getTimes(ne, sw):
        timestr = r"strftime('%w %H:%M',points.time/1000,'unixepoch','localtime')"
        query = DBSession.query(func.count(),Point.time)\
                .filter(Point.latitude >= sw[0])\
                .filter(Point.latitude <= ne[0])\
                .filter(Point.longitude >= sw[1])\
                .filter(Point.longitude <= ne[1])\
                .group_by(timestr)\
                .order_by(Point.time)
        return query

class Segment(Base):
    __tablename__ = 'segments'
    id = Column(Integer, primary_key=True)
    track_id = Column(Integer, ForeignKey('tracks.id'))

    points = relationship(Point)

class Track(Base):
    __tablename__ = 'tracks'
    id = Column(Integer, primary_key=True)
    name = Column(String)
    created = Column(Integer)

    segments = relationship(Segment)

    @staticmethod
    def getByDate(start, end):
        return DBSession.query(
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
                .filter(Point.time >= int(start.strftime('%s'))*1000)\
                .filter(Point.time <= int(end.strftime('%s'))*1000)\
                .group_by(Track.id)\
                .order_by(Point.time)

    @staticmethod
    def getPoints(id, bb = None):
        return DBSession.query(Track,Point).join(Track.segments).join(Segment.points)\
        .filter(Track.id==id).all()

#Index('my_index', MyModel.name, unique=True, mysql_length=255)
