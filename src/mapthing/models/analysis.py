from sqlalchemy import (
    Column,
    Integer,
    DateTime,
    ForeignKey,
    func
)
from sqlalchemy.orm import relationship

from mapthing.models import BaseModel, SerializableMixin

class Analysis(BaseModel, SerializableMixin):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey('tracks.id', ondelete="CASCADE"))
    created = Column(DateTime(timezone=True), server_default=func.now())

    track = relationship("Track", back_populates="analysis")
    trip = relationship("Trip", back_populates="analysis")
