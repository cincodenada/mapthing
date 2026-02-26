from .base_model import BaseModel, DBSession, SerializableMixin, getDb
from .point import Point, Segment, Track
from .location import Location, LocationType
from .stop import Stop, Subtrack
from .analysis import Analysis
from .source import Source

from sqlalchemy import engine_from_config
from sqlalchemy.orm import scoped_session, sessionmaker, declarative_mixin, declared_attr

DBSession = scoped_session(sessionmaker())

def get_engine(settings, prefix='sqlalchemy.'):
    return engine_from_config(settings, prefix)

def get_session_factory(engine):
    factory = sessionmaker()
    factory.configure(bind=engine)
    return factory

def getDb():
    return scoped_session(sessionmaker())

