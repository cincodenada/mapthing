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
    event,
    )

from sqlalchemy.engine import Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import scoped_session, sessionmaker, declarative_mixin, declared_attr

DBSession = scoped_session(sessionmaker())

BaseModel = declarative_base()
BaseModel.query = DBSession.query

# From https://docs.sqlalchemy.org/en/14/dialects/sqlite.html#sqlite-foreign-keys
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

def getDb():
    return scoped_session(sessionmaker())

@declarative_mixin
class SerializableMixin:
#   def __init__(self, data):
#       for field in self.__table__.columns:
#           if getattr(field, 'name'):
#               setattr(self, field.name, data[field.name])

    def column_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}

    def serialize_relation(self, name):
        relation = getattr(self, name)
        try:
            return [v.to_dict() for v in relation]
        except TypeError as e:
            try:
                return relation.to_dict()
            except AttributeError:
                return None
        
        
    def relation_dict(self):
        return {
            name: self.serialize_relation(name) for name, val in self.__mapper__.relationships.items()
        }
        
        
    def to_dict(self):
        return {**self.column_dict(), **self.relation_dict()}

