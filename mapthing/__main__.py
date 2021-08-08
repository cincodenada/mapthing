import argparse

from . import uploader

parser = argparse.ArgumentParser(description='Import GPS data')
parser.add_argument('file', type=str, help="File to import")
args = parser.parse_args()

uploader.import_file(args.file)
