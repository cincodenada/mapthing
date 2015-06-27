// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.controllers', [])
    .controller('mapController', function($scope) {
      $scope.params = $scope.params || {};
      $scope.data = $scope.data || {};
      $scope.uni = $scope.uni || {};
      $scope.params.start = params.start;
      $scope.params.end = params.end;

      $scope.params.track_range = [];
      $scope.params.view_range = [];
      $scope.data.map = {};

      // Process the points when we get them in
      $scope.$watch('data.view_points', function(point_data, prev, scope) {
        if(point_data) {
          scope.data.map.segs = {};
          scope.data.map.points = [];
          scope.data.map.spans = {
            missing: [],
            interp: [],
          };
          scope.data.map.bounds = new mxn.BoundingBox();

          var mintime = false, maxtime = false;
          if(scope.view_range) {
              mintime = scope.view_range[0];
              maxtime = scope.view_range[1];
          }
          var cur_tick_points = [];
          var cur_seg;

          var lastpoint = null;
          var lasttick = null;
          for(var idx = 0; idx < point_data.timepoints.length; idx++) {
              var curpoint = point_data.timepoints[idx];
              var curtime = curpoint.time/1000;
              if((mintime && (curtime < mintime))
                  || (maxtime && (curtime > maxtime))
              ) { continue; }

              //Curpoint has lat/lon properties, so we're great
              scope.data.map.bounds.extend(curpoint);

              var curtick = Math.round(curtime/scope.uni.interval);
              if(lasttick && (lasttick != curtick)) {
                  //We're in a new point, average the previous point
                  var lat, lon;
                  if(cur_tick_points.length > 1) {
                      lat = lon = 0;
                      for(i=0;i<cur_tick_points.length;i++) {
                          lat += cur_tick_points[i].lat;
                          lon += cur_tick_points[i].lon;
                      }
                      lat = lat/cur_tick_points.length;
                      lon = lon/cur_tick_points.length;
                  } else if(cur_tick_points.length == 1) {
                      lat = cur_tick_points[0].lat;
                      lon = cur_tick_points[0].lon;
                  }
                  
                  cur_tick_points = [];
                  scope.data.map.points[lasttick] = [lat, lon];

                  var diff = curtick - lasttick;
                  if(diff == 1) {
                      //No interpolation necessary
                      //Carry on
                  } else if(diff <= scope.uni.interp) {
                      //Just do some linear interpolation
                      for(var t = 1; t < diff; t++) {
                          scope.data.map.points[lasttick + t] = [
                              (curpoint.lat - scope.data.map.points[lasttick][0])*(t/diff),
                              (curpoint.lon - scope.data.map.points[lasttick][1])*(t/diff)
                          ];
                      }
                      scope.data.map.spans.interp.push([lasttick + 1, curtick - 1]);
                  } else {
                      //Too much missing, add it to the missing list
                      scope.data.map.spans.missing.push([lasttick + 1, curtick - 1]);
                  }
              }
              //In any case, throw the point on the average list
              cur_tick_points.push(curpoint);
              lasttick = curtick;

              if(!scope.data.map.segs[curpoint.segid]) {
                  scope.data.map.segs[curpoint.segid] = {
                      lines: [],
                      lastcolor: false,
                      points: [],
                  };
              }
              cur_seg = scope.data.map.segs[curpoint.segid];

              if(cur_seg.last_color && curpoint.color != cur_seg.last_color) {
                //If we're changing colors, close the last seg out
                //Add the current point so they're connected
                cur_seg.points.push(new mxn.LatLonPoint(curpoint.lat, curpoint.lon))
                var newline = new mxn.Polyline(cur_seg.points);
                newline.setColor(cur_seg.last_color);
                newline.setWidth('4');
                cur_seg.lines.push(newline);
                cur_seg.points = [];
              }
              cur_seg.last_color = curpoint.color;
              cur_seg.points.push(new mxn.LatLonPoint(curpoint.lat, curpoint.lon))
          }

          // Catch any straggler points
          if(cur_seg.points.length) {
              var newline = new mxn.Polyline(cur_seg.points);
              newline.setColor(cur_seg.last_color);
              newline.setWidth('4');
              cur_seg.lines.push(newline);
              cur_seg.points = [];
          }
        }
      });
    })
