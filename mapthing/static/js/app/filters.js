// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.filters', [])
  .filter('humanize', function() {
    return function(range) {
      var starttime = moment(range[0],'X');
      var endtime = moment(range[1],'X');
      var length = moment.duration(starttime.diff(endtime));

      //TODO: Angular templatize this
      return length.humanize()
          + ' starting on ' +
          starttime.format('ddd MMM D, YYYY')
          + ' at ' +
          starttime.format('H:mm')
    }
  });
