window['moment-range'].extendMoment(moment);
var mapApp = angular.module('mapApp',[
    'mapApp.controllers',
    'mapApp.directives',
    'mapApp.services',
    'mapApp.filters',
    'daterangepicker',
]);
