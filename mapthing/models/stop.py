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
from sqlalchemy.orm import relationship

from mapthing.models import BaseModel, SerializableMixin
from .location import Location

class Stop(BaseModel, SerializableMixin):
    __tablename__ = 'stops'
    id = Column(Integer, primary_key=True)
    segment_id = Column(Integer, ForeignKey('segments.id'))
    location_id = Column(Integer, ForeignKey('locations.id'))
    start_time = Column(DateTime(timezone=True))
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
            end_time=s.end.time,
        )

    @classmethod
    def fromHistStops(cls, slist):
        return [cls.fromHistStop(s) for s in slist]
