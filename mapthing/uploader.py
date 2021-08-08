from builtins import object
import sqlite3
import tempfile
import datetime
import os

from .models import (
    DBSession,
    Track,
    Segment,
    Point,
    )

import gpxpy
from collections import Counter

def import_file(filename):
    extmap = {
        '.gpx': ImportGpx,
        '.sqlite': ImportSqlite,
        '.sqlite3': ImportSqlite,
        '.db': ImportSqlite
    }

    (root, ext) = os.path.splitext(filename)
    if ext not in extmap:
        raise RuntimeError(f"No importer found for {filename}")

    importer = extmap[ext]
    with open(filename, 'r') as infile:
        print(importer(infile).load())

class FileImporter(object):
    def __init__(self, infile):
        self.infile = infile

    @classmethod
    def from_upload(cls, uploaded_file):
        infile = tempfile.NamedTemporaryFile(delete=False)
        uploaded_file.file.seek(0)
        while True:
            data = uploaded_file.file.read(2<<16)
            if not data:
                break
            infile.write(data)
        infile.close()

        return cls(infile)

class ImportGpx(FileImporter):
    def load(self):
        counts = Counter()
        gpx = gpxpy.parse(open(self.infile.name, 'r'))
        epoch = datetime.datetime.utcfromtimestamp(0)
        for track in gpx.tracks:
            counts['tracks']+=1
            t = Track()
            t.name = track.name
            t.created = gpx.time
            DBSession.add(t)
            for seg in track.segments:
                counts['segments']+=1
                s = Segment()
                t.segments.append(s)
                for point in seg.points:
                    counts['points']+=1
                    p = Point()
                    p.latitude = point.latitude
                    p.longitude = point.longitude
                    p.time = point.time
                    p.speed = point.speed
                    p.altitude = point.elevation
                    p.bearing = point.course
                    if(point.extensions and 'ogt10:accuracy' in point.extensions):
                        p.accuracy = point.extensions['ogt10:accuracy']
                    s.points.append(p)

        return counts

class ImportSqlite(FileImporter):
    tables = {
        'segments': {
            '_tablename_': 'segments',
            'id': '_id',
            'track_id': 'track',
        },
        'tracks': {
            '_tablename_': 'tracks',
            'id': '_id',
            'name': 'name',
            'created': 'creationtime',
        },
        'points': {
            '_tablename_': 'waypoints',
            'id': '_id',
            'latitude': 'latitude',
            'longitude': 'longitude',
            'time': 'time',
            'speed': 'speed',
            'segment_id': 'tracksegment',
            'accuracy': 'accuracy',
            'altitude': 'altitude',
            'bearing': 'bearing',
        },
    }

    def load(self):
        conn = sqlite3.connect(self.infile.name)
        c = conn.cursor()
        querylist = []
        col_list = []
        for t, tmap in list(self.tables.items()):
            curmap = tmap.copy()
            curtable = curmap.pop('_tablename_',t)
            for new, orig in list(curmap.items()):
                col_list.append('`%s`.`%s` as %s_%s' % (curtable, orig, curtable, orig))
            
        fromquery = 'SELECT %(fields)s FROM %(point)s ' + \
        'LEFT JOIN %(seg)s ON %(seg)s.%(sid)s = %(point)s.%(sid_field)s ' + \
        'LEFT JOIN %(track)s ON %(track)s.%(tid)s = %(seg)s.%(tid_field)s'
        fromquery = fromquery % {
            'fields': ','.join(col_list), 
            'point': self.tables['points']['_tablename_'],
            'seg': self.tables['segments']['_tablename_'], 
            'track': self.tables['tracks']['_tablename_'],
            'sid': self.tables['segments']['id'],
            'tid': self.tables['tracks']['id'],
            'sid_field': self.tables['points']['segment_id'],
            'tid_field': self.tables['segments']['track_id'],
        }
        querylist.append(fromquery)
        c.row_factory = sqlite3.Row
        idmap = {k:{} for k in list(self.tables.keys())}
        #new shit starts at 138 btw in case everything goes to hell
        for row in c.execute(fromquery):
            #Find or create the track
            if(row['tracks__id'] in idmap['tracks']):
                t = idmap['tracks'][row['tracks__id']]
            else:
                t = Track()
                self.add_row_data(row, 'tracks', t)
                DBSession.add(t)
                idmap['tracks'][row['tracks__id']] = t
            #And the segment
            if(row['segments__id'] in idmap['segments']):
                s = idmap['segments'][row['segments__id']]
            else:
                s = Segment()
                self.add_row_data(row, 'segments', s)
                t.segments.append(s)
                idmap['segments'][row['segments__id']] = s
            #Now point!
            p = Point()
            self.add_row_data(row, 'points', p)
            s.points.append(p)

        return querylist

    def add_row_data(row, table, obj):
        oldtable = self.tables[table]['_tablename_']
        for new, old in list(self.tables[table].items()):
            if(not new in ['_tablename_','id','track_id','segment_id']):
                setattr(obj, new, row[oldtable + '_' + old])
