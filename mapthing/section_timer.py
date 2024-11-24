from statistics import stdev, median, fmean
from collections import defaultdict
import time

class SectionTimer:
    def __init__(self, enabled=True):
        self.runs = []
        self.cur_section = None
        self.total_start = None
        self.enabled = enabled

    def start(self, sec_name = "__start__"):
        if not self.enabled:
            return
        if self.cur_section:
            self.end()
        self.sec_start = time.time()
        if not self.total_start:
            self.total_start = self.sec_start
        self.cur_run = []
        self.cur_section = sec_name

    def section(self, name):
        if not self.enabled:
            return
        now = time.time()
        if self.cur_section:
            self.cur_run.append((self.cur_section, now - self.sec_start))
        else:
            self.start()

        self.cur_section = name
        self.sec_start = now

    def end(self):
        if not self.enabled:
            return
        self.section('__end__')
        self.runs.append(self.cur_run)
        self.cur_section = None
        self.total_end = time.time()

    def summary(self):
        if not self.enabled:
            return
        start = time.time()
        times = defaultdict(list)
        for run in self.runs:
            for section, t in run:
                times[section].append(t)

        total_time = self.total_end - self.total_start
        calc_time = time.time() - start
        for name, times in times.items():
            if total_time > 0:
                pct = sum(times)/total_time*100
            else:
                pct = 0
            stats = [s*1e6 for s in (median(times), fmean(times), stdev(times))]
            print(f"{pct:0.2f}% {name}: median {stats[0]:0.3f}us/mean {stats[1]:0.3f}us, stdev {stats[2]:0.3f}us")
        print(f"Stats calculated in {calc_time*1e3:0.3}ms")
