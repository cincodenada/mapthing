import sys
from mapthing import uploader

for filename in sys.argv[1:]:
    uploader.import_file(filename)
