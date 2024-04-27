window['moment-range'].extendMoment(moment);

const { Temporal } = temporal;
const { Instant, PlainDate, PlainTime } = Temporal;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

var mapApp = angular.module('mapApp',[
    'mapApp.controllers',
    'mapApp.directives',
    'mapApp.services',
    'mapApp.filters',
    'daterangepicker',
]);
