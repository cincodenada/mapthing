import ops

class Track:
    points = []
    curidx = 0

    def __init__(self, points):
        self.points = points

    def __len__(self):
        return len(self.points)

    def __getitem__(self, key):
        return self.points[key]

    def __iter__(self):
        return self

    def next(self):
        self.curidx+=1
        try:
            return self.points[self.curidx]
        except IndexError:
            raise StopIteration

    def d(A, B, i, j):
        try:
            return ops.dist(
                B[j].lon, B[j].lat,
                B[j+1].lon, B[j+1].lat,
                A[i].lon, A[i].lat
            )
        except IndexError:
            return None

    def h(A, B):
        total = len(A) * len(B)
        cur = 0
        dmaxmin = 0
        for i, a in enumerate(A):
            dmin = None
            for j, b in enumerate(B):
                dist = A.d(B, i, j)
                if(dmin is None or dist < dmin):
                    dmin = dist
                cur+=1
                print "Checked {} of {} possibilities...".format(cur, total)
            if dmin > dmaxmin:
                dmaxmin = dmin

        return dmaxmin


    def H(A, B):
        return max(A.h(B), B.h(A))

