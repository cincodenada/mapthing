// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.services', ['ngResource'])
    .factory('Track', function($resource) {
      return $resource('/tracks.json')
    })
    .factory('PointList', function($resource) {
      return $resource('/points.json')
    })
    .factory('Location', function($resource) {
      return $resource('/places.json')
    })
    .service('pointSource', function(Track, Point) {
      var points;
      var seglist = {};
      var newpolys = [];
      var uni_list = [];
      var uni_avg = [];
      var uni_missing = [];
      var uni_interp = [];

      var lastpoint = null;
      var lasttick = null;
      
      this.getPoints = function(timerange) {
        this.points = Point.get({
            start: starttime.format('YYYY-MM-DD HH:mm:ss'), end: endtime.format('YYYY-MM-DD HH:mm:ss')
        }, function() {

        });
        $scope.pointbounds = new mxn.BoundingBox();
      }
    })
    .factory('OsmPlace', function() {
      return $resource("https://overpass-api.de/api/interpreter", {
        "query": {
          method: "POST",
          isArray: true,
        }
      })
    })
