from pyramid.config import Configurator
from sqlalchemy import engine_from_config, event
from sqlalchemy.engine import Engine

from .models import (
    DBSession,
    BaseModel,
    )


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__module__ == "sqlite3":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.
    """
    engine = engine_from_config(settings, 'sqlalchemy.')
    DBSession.configure(bind=engine)
    BaseModel.metadata.bind = engine
    config = Configurator(settings=settings)
    config.include('pyramid_chameleon')
    config.add_static_view('static', 'static', cache_max_age=3600)
    config.add_route('home', '/')
    config.add_route('sources', '/sources/')
    config.add_route('ajax_sources', '/sources.json')
    config.add_route('view_track', '/track/{id}')
    config.add_route('ajax_points', '/points.json')
    config.add_route('ajax_track', '/tracks/')
    config.add_route('get_tracks', '/tracks.json')
    config.add_route('places_json', '/places.json')
    config.add_route('places', '/places')
    config.add_route('upload_data', '/upload')
    config.add_route('ajax_times', '/times.json')
    config.scan()
    return config.make_wsgi_app()
