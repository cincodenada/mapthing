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

class Segment(Base):
    __tablename__ = 'segments'
    id = Column(Integer, primary_key=True)
    track_id = Column(Integer, ForeignKey('tracks.id'))
    
    children = relationship(Point)

class Track(Base):
    __tablename__ = 'tracks'
    id = Column(Integer, primary_key=True)
    name = Column(String)
    created = Column(Integer)
    
    children = relationship(Segment)

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
                .join(Track.children)\
                .join(Segment.children)\
                .filter(Point.time >= int(start.strftime('%s'))*1000)\
                .filter(Point.time <= int(end.strftime('%s'))*1000)\
                .group_by(Track.id)\
                .order_by(Point.time)

    @staticmethod
    def getPoints(id, bb = None):
        return DBSession.query(Track,Point).join(Track.children).join(Segment.children)\
        .filter(Track.id==id).all()

#Index('my_index', MyModel.name, unique=True, mysql_length=255)
