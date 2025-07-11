import pytest
from unittest.mock import call

from cli import run, uploader

def test_noargs(db, capfd, mocker):
    mocker.patch('mapthing.uploader.import_file')
    run([], db)
    out, err = capfd.readouterr()
    uploader.import_file.assert_not_called()
    assert(err == "")
    assert(out == "")

def test_noargs(db, capfd, mocker):
    mocker.patch('mapthing.uploader.import_file')
    run(['a.zip', 'b.zip'], db)
    out, err = capfd.readouterr()

    assert(uploader.import_file.call_count == 2)
    uploader.import_file.assert_has_calls([
        call(db, 'a.zip'),
        call(db, 'b.zip')
    ])

    assert(err == "")
    assert(out == "")
