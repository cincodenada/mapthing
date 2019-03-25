import site

from pyramid.paster import get_app, setup_logging
ini_path="/home/joel/www/mapthing/development.ini"
setup_logging(ini_path)
application = get_app(ini_path, 'main')
