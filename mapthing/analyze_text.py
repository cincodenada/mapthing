#!/usr/bin/python2
import gps_history as gps
import models
from datetime import datetime
from sqlalchemy import engine_from_config
from ConfigParser import ConfigParser

import argparse

# Guard to keep Pylons from trying to run the damn thing
if(__name__ == '__main__'):
    parser = argparse.ArgumentParser(description="Test generating locations")
    parser.add_argument('--radius', default=50, help='Radius of zones (m)')
    parser.add_argument('--trip_split', default=3*60, help='Time gap between trips (s)')
    parser.add_argument('--trip_len', default=10, help='Minimum length of trip to consider (points)')
    args = parser.parse_args()

    startdate = datetime.strptime('2015-12-01','%Y-%m-%d')
    enddate = datetime.strptime('2016-01-30','%Y-%m-%d')

    engine = engine_from_config({
        'sqlalchemy.url': 'sqlite:///../MapThing.sqlite'
    })
    models.DBSession.configure(bind=engine)
    models.Base.metadata.bind = engine

    hist = gps.History(trip_gap=args.trip_split)
    for p, s, t in models.Point.getByDate(startdate, enddate):
        print ".",
        hist.add_point(p)

    num_long_trips = 0
    locations = hist.get_locations(args.radius, args.trip_len)

    print "Found {} long trips and {} locations:".format(locations.num_points/2, len(locations.locations))

    for l in locations.locations:
        if l.num_points > 1:
            print l.center()
