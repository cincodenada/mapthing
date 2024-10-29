import pytest
from pyramid import testing, registry
from datetime import datetime

from mapthing import uploader
from mapthing.models import getDb, BaseModel, get_session_factory, Point
from mapthing.models import Point, Segment, Track, Source

def test_import(dbengine):
    db = get_session_factory(dbengine)()
    stats = uploader.import_file(db, './fixtures/tiny.gpx')

    assert(stats["counts"]["points"] == 15)
    assert(stats["counts"]["segments"] == 2)
    assert(stats["counts"]["tracks"] == 1)
    assert(stats["start"].isoformat() == "2023-12-25T08:00:06+00:00")
    assert(stats["end"].isoformat() == "2023-12-25T08:10:15.010000+00:00")

    assert(db.query(Point).count() == 15)
    assert(db.query(Segment).count() == 2)
    assert(db.query(Track).count() == 1)

    sources = db.query(Source).all()
    assert(len(sources) == 1)
    source = sources[0]
    assert(source.name == "tiny.gpx")
    assert(source.start_time == datetime(2023, 12, 25, 8, 0, 6))
    assert(source.end_time == datetime(2023, 12, 25, 8, 10, 15, 10000))

    # Re-import
    stats = uploader.import_file(db, './fixtures/tiny.gpx')



