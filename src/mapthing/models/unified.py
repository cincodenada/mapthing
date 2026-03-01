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

from mapthing.models import BaseModel

class Span(BaseModel):
    __tablename__ = 'spans'
    id = Column(Integer, primary_key=True)
    # Segment covers [start, end)
    start = Column(DateTime(timezone=True))
    end = Column(DateTime(timezone=True))
    # How overlapping segments are combined
    method = Column(Text)

class SpanRefs(BaseModel):
    __tablename__ = 'span_refs'
    id = Column(Integer, primary_key=True)
    span_id = Column(Integer, ForeignKey('Span.id'))
    source_id = Column(Integer, ForeignKey('Segment.id'))
    order = Column(Integer)
    # Again, [start, end), if NULL assume Span.start/end
    start = Column(DateTime(timezone=True))
    end = Column(DateTime(timezone=True))

class SpanPoint(BaseModel):
    __tablename__ = 'span_points'
    id = Column(Integer, primary_key=True)
    ref_id = Column(Integer, ForeignKey('SpanRef.id'))
    point_id = Column(Integer, ForeignKey('Point.id'))
