import sys
import traceback

from mapthing import uploader
from mapthing.models import get_session_factory, get_engine

from pyramid.paster import bootstrap

def run(args, db):
    for filename in args:
        try:
            uploader.import_file(db, filename)
        except Exception as e:
            print(f"Failed to import {filename}")
            print(traceback.format_exc())
            db.rollback()

if __name__ == "__main__":
    with bootstrap('development.ini') as env:
        engine = get_engine(env['registry'].settings)
        db = get_session_factory(engine)()
    
        run(sys.argv[1:], env)
