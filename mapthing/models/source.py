import os
import hashlib

# BUF_SIZE is totally arbitrary
BUF_SIZE = 65536  # lets read stuff in 64kb chunks!


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
    hash = Column(String)

    tracks = relationship("Track",
        back_populates="source",
        passive_deletes="all"
    )

    def from_file(file):
        sha1 = hashlib.sha1()

        # Open a separate time, so we don't have to rewind
        # and also to ensure rb and cause I don't wanna deal
        with open(file.name, 'rb') as f:
            while True:
                data = f.read(BUF_SIZE)
                if not data:
                    break
                sha1.update(data)

        return Source(
            name=os.path.basename(file.name),
            hash=sha1.hexdigest()
        )

