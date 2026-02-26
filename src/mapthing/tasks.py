from pyramid.paster import bootstrap

from mapthing import uploader
from mapthing.models import (
    Track,
    Segment,
    Point,
    Source,
    get_session_factory,
    get_engine
    )

def import_file(filename):
    with bootstrap('development.ini') as env:
        engine = get_engine(env['registry'].settings)
        db = get_session_factory(engine)()
        uploader.import_file(db, filename)
