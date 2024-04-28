import enum
from sqlalchemy import (
    Column,
    Index,
    Integer,
    Text,
    Float,
    DateTime,
    String,
    Enum,
    ForeignKey,
    func,
    literal_column,
    asc
)
from sqlalchemy.orm import relationship

from mapthing.models import BaseModel, SerializableMixin

class LocationType(enum.Enum):
    place=1
    auto=2
    zone=3
    waypoint=4

class Location(BaseModel, SerializableMixin):
    __tablename__ = 'locations'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    radius = Column(Float)
    type = Column(Enum(LocationType))

    @classmethod
    def getAll(cls):
        return cls.query(Location)

    @classmethod
    def getByLatLon(cls, lat, lon):
        return cls.query(Location)\
                .filter(lat < Location.latitude + Location.radius/111333)\
                .filter(lat > Location.latitude - Location.radius/111333)\
                .filter(lon < Location.longitude + Location.radius/111333)\
                .filter(lon > Location.longitude - Location.radius/111333)\
                .order_by(asc((Location.latitude - lat) + (Location.longitude - lon)))
