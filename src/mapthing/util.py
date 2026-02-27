class Span:
	def __init__(self):
		self.min = None
		self.max = None

	@property
	def start(self):
		return self.min

	@property
	def end(self):
		return self.max

	def merge(self, span):
		self.extend(span.min, span.max)

	def extend(self, *vals):
		for v in vals:
			if self.min is None or v < self.min:
				self.min = v
			if self.max is None or v > self.max:
				self.max = v


