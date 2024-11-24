from collections import deque
class HashDeque(deque):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.vals = set()

    def append(self, item):
        if len(self) == self.maxlen:
            self.vals.remove(self[0])
        self.vals.add(item)
        super().append(item)

    def __contains__(self, item):
        return item in self.vals

