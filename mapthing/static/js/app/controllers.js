// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.controllers', [])
    .controller('mapController', function($scope) {
      $scope.params = $scope.params || {};
      $scope.data = $scope.data || {};
      $scope.uni = $scope.uni || {
        preinterval: 5,
        interp: 10,
      };
      $scope.params.start = params.start;
      $scope.params.end = params.end;

      $scope.params.track_range = [];
      $scope.params.view_range = [];
      $scope.data.map = {};

      $scope.$watch('params.track_range', function(cur, prev, scope) {
        if(cur) {
          // Reset view range
          scope.params.view_range = [];
        }
      });

      // Ensure we don't have 0 for interval
      $scope.$watch('uni.preinterval', function(cur, prev, scope) {
        scope.uni.interval = scope.uni.preinterval || 1;
      });

      // Process the points when we get them in
      $scope.$watchGroup(['data.view_points','uni.interp','uni.interval'], function(cur, prev, scope) {
        point_data = cur[0];
        if(point_data) {
          // Reset map data
          scope.data.map.segs = [];
          scope.data.map.points = [];
          scope.data.map.spans = {
            missing: [],
            interp: [],
          };
          scope.data.map.bounds = new mxn.BoundingBox();

          var min_time = false, max_time = false;
          if(scope.params.track_range) {
              min_time = scope.params.track_range[0];
              max_time = scope.params.track_range[1];
          }
          var prev_tick_points = [];

          var prev_point = null;
          var prev_tick = null;
          var prev_color = null;
          var prev_seg_start = Math.round(min_time/scope.uni.interval);

          for(var idx = 0; idx < point_data.timepoints.length; idx++) {
              var cur_point = point_data.timepoints[idx];
              var cur_time = cur_point.time/1000;
              if((min_time && (cur_time < min_time))
                  || (max_time && (cur_time > max_time))
              ) { continue; }

              //Curpoint has lat/lon properties, so we're great
              scope.data.map.bounds.extend(cur_point);

              var cur_tick = Math.round(cur_time/scope.uni.interval);
              if(prev_tick && (prev_tick != cur_tick)) {
                  //We're in a new point, average the previous point
                  var lat, lon;
                  if(prev_tick_points.length > 1) {
                      lat = lon = 0;
                      for(var i=0;i<prev_tick_points.length;i++) {
                          lat += prev_tick_points[i].lat;
                          lon += prev_tick_points[i].lon;
                      }
                      lat = lat/prev_tick_points.length;
                      lon = lon/prev_tick_points.length;
                  } else if(prev_tick_points.length == 1) {
                      lat = prev_tick_points[0].lat;
                      lon = prev_tick_points[0].lon;
                  } else {
                      console.log("Error! Invalid prev_tick_points state!");
                      break;
                  }
                  
                  prev_tick_points = [];
                  scope.data.map.points[prev_tick] = [lat, lon];

                  var diff = cur_tick - prev_tick;
                  if(diff <= 1) {
                      //No interpolation necessary
                      //Carry on
                  } else if(diff <= scope.uni.interp) {
                      //Just do some linear interpolation
                      for(var t = 1; t < diff; t++) {
                          var prev = scope.data.map.points[prev_tick];
                          scope.data.map.points[prev_tick + t] = [
                              prev[0] + (lat - prev[0])*(t/diff),
                              prev[1] + (lon - prev[1])*(t/diff)
                          ];
                      }
                      scope.data.map.spans.interp.push([prev_tick + 1, cur_tick - 1]);
                  } else {
                      //Too much missing, add it to the missing list
                      scope.data.map.spans.missing.push([prev_tick + 1, cur_tick - 1]);
                  }
              }

              //In any case, throw the point on the average list
              prev_tick_points.push(cur_point);

              if(prev_color && cur_point.color != prev_color) {
                //If we're changing colors, close the last seg out
                scope.data.map.segs.push({
                  start: prev_seg_start,
                  end: cur_tick,
                  color: prev_color,
                });
                prev_seg_start = cur_tick;
              }

              prev_tick = cur_tick;
              prev_color = cur_point.color;
          }

          // Catch the straggler points
          scope.data.map.segs.push({
            start: prev_seg_start,
            end: cur_tick,
            color: prev_color,
          });
        }
      });

      $scope.$watchGroup(['params.view_range', 'uni.interval'], function(cur, prev, scope) {
        scope.params.tick_range = [
          Math.round(scope.params.view_range[0]/scope.uni.interval),
          Math.round(scope.params.view_range[1]/scope.uni.interval)
        ];
      });
    })
