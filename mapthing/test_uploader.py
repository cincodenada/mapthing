import pytest
from pyramid import testing, registry

from mapthing import uploader
from mapthing.models import getDb, BaseModel, get_session_factory

def test_import(dbengine):
    db = get_session_factory(dbengine)()
    uploader.import_file(db, './fixtures/tiny.gpx')


