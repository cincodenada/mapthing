from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import Column, Integer, String, Float

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

    @hybrid_property
    def ts(self):
        return self.time/1000

    @hybrid_property
    def lat(self):
        return self.latitude

    @hybrid_property
    def lon(self):
        return self.longitude
