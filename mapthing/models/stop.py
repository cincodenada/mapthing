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
    asc
)
from sqlalchemy.orm import relationship, selectinload
from sqlalchemy import select

from mapthing.models import BaseModel, SerializableMixin, DBSession
from .location import Location
from .point import Point, Track

class Stop(BaseModel, SerializableMixin):
    __tablename__ = 'stops'
    id = Column(Integer, primary_key=True, autoincrement=True)
    subtrack_id = Column(Integer, ForeignKey('subtracks.id'))
    location_id = Column(Integer, ForeignKey('locations.id'))
    start_id = Column(Integer, ForeignKey('points.id'))
    start_time = Column(DateTime(timezone=True))
    end_id = Column(Integer, ForeignKey('points.id'))
    end_time = Column(DateTime(timezone=True))

    location = relationship(Location)

    @classmethod
    def getAll(cls):
        return cls.query(Stop)

    @classmethod
    def getByLatLon(cls, ne, sw):
        return cls.query(Stop,Location)\
                .filter(Location.latitude >= sw[0])\
                .filter(Location.latitude <= ne[0])\
                .filter(Location.longitude >= sw[1])\
                .filter(Location.longitude <= ne[1])\
                .order_by(Stop.start)

    @classmethod
    def getByDate(cls, start, end):
        # Shouldn't have to do isoformat() here but...
        return cls.query(Stop)\
                .filter(Stop.end_time >= start.isoformat())\
                .filter(Stop.start_time <= end.isoformat())\
                .order_by(Stop.start_time)

    @classmethod
    def fromHistStop(cls, s):
        return Stop(
            location_id=s.loc.id,
            start_time=s.start.time,
            start_id=s.start.id,
            end_time=s.end.time,
            end_id=s.end.id,
        )

    @classmethod
    def fromHistStops(cls, slist):
        return [cls.fromHistStop(s) for s in slist]

class Subtrack(BaseModel):
    __tablename__ = 'subtracks'
    id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey('tracks.id'))
    start_id = Column(Integer, ForeignKey('points.id'))
    start_time = Column(DateTime(timezone=True))
    end_id = Column(Integer, ForeignKey('points.id'))
    end_time = Column(DateTime(timezone=True))

    stops = relationship(Stop)
    track = relationship(Track)
    start = relationship(Point, foreign_keys=[start_id])
    end = relationship(Point, foreign_keys=[end_id])

    @classmethod
    def getByDate(cls, start, end):
        # Shouldn't have to do isoformat() here but...
        return DBSession.execute(select(Subtrack)\
                .options(selectinload(Subtrack.stops))\
                .options(selectinload(Subtrack.track))\
                .where(Subtrack.end_time >= start.isoformat())\
                .where(Subtrack.start_time <= end.isoformat())\
                .order_by(Subtrack.id))

    @classmethod
    def getByTrack(cls, tids):
        return DBSession.execute(select(Subtrack)\
                .options(selectinload(Subtrack.stops))\
                .options(selectinload(Subtrack.track))\
                .where(Subtrack.track_id.in_(tids))\
                .order_by(Subtrack.id))
