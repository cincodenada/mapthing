import sys
from mapthing import uploader

from mapthing.models import get_session_factory, get_engine
from pyramid.paster import bootstrap

with bootstrap('development.ini') as env:
    engine = get_engine(env['registry'].settings)
    db = get_session_factory(engine)()
    for filename in sys.argv[1:]:
        uploader.import_file(db, filename)