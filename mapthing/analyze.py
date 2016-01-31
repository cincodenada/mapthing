import gps_history as gps
import models
from datetime import datetime
from sqlalchemy import engine_from_config
from ConfigParser import ConfigParser
import shapefile
import xml.etree.ElementTree as ET

import mapnik

startdate = datetime.strptime('2015-12-01','%Y-%m-%d')
enddate = datetime.strptime('2015-12-31','%Y-%m-%d')

engine = engine_from_config({
    'sqlalchemy.url': 'sqlite:///../MapThing.sqlite'
})
models.DBSession.configure(bind=engine)
models.Base.metadata.bind = engine

hist = gps.History()
for p, s, t in models.Point.getByDate(startdate, enddate):
    print ".",
    hist.add_point(p)

for t in hist.trips:
    shp = t.get_shapefile('/tmp/mapthing')
    if shp:
        break

m = mapnik.Map(10*256,10*256)
mapnik.load_map(m, 'mapstyle.xml')

custom_layer = mapnik.Layer('trip')
custom_layer.styles.append('trip')
custom_layer.datasource = mapnik.Datasource(type='shape', file='/tmp/mapthing')
m.layers.append(custom_layer)

m.zoom_all()
mapnik.render_to_file(m, 'test.png')
