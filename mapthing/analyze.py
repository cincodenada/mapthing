import gps_history as gps
import models
from datetime import datetime
from sqlalchemy import engine_from_config
from ConfigParser import ConfigParser

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

print hist.get_trips()
