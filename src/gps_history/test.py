import unittest
import csv
from dataclasses import dataclass

from datetime import datetime

from mapthing.models import Point
from mapthing.gps_history import History

@dataclass
class MockPoint:
    def __init__(self, latitude, longitude, time, **kwargs):
        self.latitude = float(latitude)
        self.longitude = float(longitude)
        self.time = datetime.fromisoformat(time)

class LocationPoolTestCase(unittest.TestCase):
    def test_find_stops(self):
        hist = History()
        with open('fixtures/missedstop.csv') as csvfile:
            pointreader = csv.DictReader(csvfile)
            for point in pointreader:
                hist.add_point(MockPoint(**point))

        print(hist.finish()[0].get_serializable())
