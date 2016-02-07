#!/usr/bin/python2
import gps_history as gps
import models
from datetime import datetime
from sqlalchemy import engine_from_config
from ConfigParser import ConfigParser
import shapefile
import xml.etree.ElementTree as ET

import mapnik
import Tkinter
from PIL import Image, ImageTk
from StringIO import StringIO
from subprocess import call

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

locations = []
num_long_trips = 0
for t in hist.trips:
    if len(t.points) > 10:
        matched_start = False
        matched_end = False
        for l in locations:
            if not matched_start and l.add_point(t.start):
                matched_start = True
            if not matched_end and l.add_point(t.end):
                matched_end = True

        if not matched_start:
            locations.append(gps.Location(t.start))
        if not matched_end:
            locations.append(gps.Location(t.end))
        shp = t.get_shapefile('/tmp/mapthing')

print num_long_trips
print len(locations)

for l in locations:
    if l.num_points > 1:
        print l.center()

m = mapnik.Map(256,256)
mapnik.load_map(m, 'mapstyle.xml')

custom_layer = mapnik.Layer('trip')
custom_layer.styles.append('trip')
custom_layer.datasource = mapnik.Datasource(type='shape', file='/tmp/mapthing')
m.layers.append(custom_layer)

ims = []

def button_click_exit_mainloop (event):
    event.widget.quit() # this will cause mainloop to unblock.

root = Tkinter.Tk()
root.bind("<Button>", button_click_exit_mainloop)
root.geometry('+%d+%d' % (100,100))
lnum = 0
for l in locations:
    if len(l.points) < 3:
        continue

    l.get_shapefile('/tmp/mapthing')

    mapnik.load_map(m, 'mapstyle.xml')
    m.zoom_to_box(mapnik.Box2d(l.minlon, l.minlat, l.maxlon, l.maxlat))
    m.zoom(-2)

    im = mapnik.Image(m.width, m.height)
    mapnik.render(m, im)
    imdata = StringIO(im.tostring('png'))
    img = Image.open(imdata)

    root.geometry('%dx%d' % (img.size[0],img.size[1]))
    tkpi = ImageTk.PhotoImage(img)
    label_image = Tkinter.Label(root, image=tkpi)
    label_image.place(x=0,y=0,width=img.size[0],height=img.size[1])
    root.title("Location %d" % (lnum))
    lnum+=1
    root.mainloop() # wait until user clicks the window
