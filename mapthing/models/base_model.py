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
    )

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import scoped_session, sessionmaker

DBSession = scoped_session(sessionmaker())

BaseModel = declarative_base()
BaseModel.query = DBSession.query

def getDb():
    return scoped_session(sessionmaker())

class SerializableMixin:
#   def __init__(self, data):
#       for field in self.__table__.columns:
#           if getattr(field, 'name'):
#               setattr(self, field.name, data[field.name])

    def to_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}

