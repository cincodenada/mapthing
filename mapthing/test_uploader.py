import pytest
from pyramid import testing, registry

from mapthing import uploader
from mapthing.models import getDb, BaseModel, get_session_factory, Point
from mapthing.models import Point, Segment, Track, Source

def test_import(dbengine):
    db = get_session_factory(dbengine)()
    uploader.import_file(db, './fixtures/tiny.gpx')

    assert(db.query(Point).count() == 15)
    assert(db.query(Segment).count() == 2)
    assert(db.query(Track).count() == 1)
    assert(db.query(Source).count() == 1)


