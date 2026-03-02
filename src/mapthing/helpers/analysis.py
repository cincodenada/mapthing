from mapthing.models import Analysis, Trip, Stop

class AnalysisHelper():
    def __init__(self, session):
        self.db = session
        
    def fromHistory(self, tid, sslist):
        analysis = Analysis(track_id=tid)
        for ss in sslist:
            t = ss.track
            tr = Trip(
                start_id=t.start.id,
                start_time=t.start.time,
                end_id=t.end.id,
                end_time=t.end.time
            )
            for s in ss.stops:
                tr.stops.append(Stop(
                    location_id=s.loc.id,
                    start_id=s.start.id,
                    start_time=s.start.time,
                    end_id=s.end.id,
                    end_time=s.end.time,
                ))
            analysis.trips.append(tr)
        return analysis
