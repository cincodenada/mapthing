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
    or_
)
from sqlalchemy.orm import relationship

from mapthing.models import BaseModel
from LatLon23 import LatLon

class Source(BaseModel):
    __tablename__ = 'sources'
    id = Column(Integer, primary_key=True)
    type = Column(String)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    name = Column(String)

    tracks = relationship("Track", back_populates="source")
