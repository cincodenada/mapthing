// vim: set ts=2 sts=2 sw=2 :
'use strict';

const zeroTime = PlainTime.from('00:00')
const lastTime = zeroTime.subtract({'nanosecond': 1})

function secsToPct(secs) {
  return secs/86400*100;
}

function timeToPct(plainTime) {
  return secsToPct(plainTime.since(zeroTime).total('seconds'))
}

angular.module('mapApp.filters', [])
  .filter('humanize', function() {
    return function(range) {
      var starttime = moment(range[0]/1000,'X');
      var endtime = moment(range[1]/1000,'X');
      var length = moment.duration(starttime.diff(endtime));

      //TODO: Angular templatize this
      return length.humanize()
          + ' starting on ' +
          starttime.format('ddd MMM D, YYYY')
          + ' at ' +
          starttime.format('H:mm')
    }
  })
  .filter('orthis', function() {
    return function(val, rep, strict) {
        if(typeof rep == 'undefined') { rep = ''; }
        if(strict) {
            return (val == null || typeof val == 'undefined' || isNaN(val)) ? rep : val;
        } else {
            return val ? val : rep;
        }
    };
  })
  .filter('dayPct', function() {
    return function(evt) {
      return evt.$startTime.until(evt.$endTime).total('seconds')/86400*100
    }
  })
  .filter('dayStyle', function() {
    return function(evt) {
      return `left: ${timeToPct(evt.$startTime)}%; width: ${secsToPct(evt.$startTime.until(evt.$endTime).total('seconds'))}%`
    }
  })
;
