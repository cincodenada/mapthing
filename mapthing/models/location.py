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

class LocationType(str, enum.Enum):
    place='place'
    auto='auto'
    region='region'
    waypoint='waypoint'
    ignore='ignore'

class Location(BaseModel, SerializableMixin):
    __tablename__ = 'locations'
    id = Column(Integer, primary_key=True)
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

    @classmethod
    def fromHistLocation(cls, l):
        return Location(
            latitude=float(l.center().lat),
            longitude=float(l.center().lon),
            radius=l.radius,
            type=l.type,
            #num_points=l.num_points,
        ) 

    @classmethod
    def fromHistLocations(cls, llist):
        return [cls.fromHistLocation(l) for l in llist]
