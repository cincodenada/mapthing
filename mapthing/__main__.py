import argparse

from . import uploader

parser = argparse.ArgumentParser(description='Import GPS data')
parser.add_argument('files', type=str, nargs="+", help="Files to import")
args = parser.parse_args()

for f in args.files:
    uploader.import_file(f)
