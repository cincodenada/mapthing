// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.controllers', [])
    .controller('mapController', function($scope) {
      $scope.params = $scope.params || {};
      $scope.params.start = params.start;
      $scope.params.end = params.end;

      // Process the points when we get them in
      $scope.$watch('data.view_points', function(point_data, prev, scope) {
        if(point_data) {
          var points = Array();
          var curseg;

          var uni_tick = $('#uni_interval').val();
          var uni_thresh = $('#uni_interp').val();

          var mintime = false, maxtime = false;
          if(timerange) {
              mintime = timerange[0];
              maxtime = timerange[1];
          }
          seglist = {};
          newpolys = [];
          uni_list = [];
          uni_avg = [];
          uni_missing = [];
          uni_interp = [];

          var lastpoint = null;
          var lasttick = null;
          curbounds = new mxn.BoundingBox();
          for(idx = 0; idx < point_data.timepoints.length; idx++) {
              curpoint = point_data.timepoints[idx];
              curtime = curpoint.time/1000;
              if((mintime && (curtime < mintime))
                  || (maxtime && (curtime > maxtime))
              ) { continue; }

              //Curpoint has lat/lon properties, so we're great
              curbounds.extend(curpoint);

              if(!is_anim) {
                  curtick = Math.round(curtime/uni_tick);
                  if(lasttick && (lasttick != curtick)) {
                      //We're in a new point, check on our points
                      var lat, lon;
                      if(uni_avg.length > 1) {
                          lat = lon = 0;
                          for(i=0;i<uni_avg.length;i++) {
                              lat += uni_avg[i].lat;
                              lon += uni_avg[i].lon;
                          }
                          lat = lat/uni_avg.length;
                          lon = lon/uni_avg.length;
                      } else if(uni_avg.length == 1) {
                          lat = uni_avg[0].lat;
                          lon = uni_avg[0].lon;
                      }
                      
                      uni_avg = [];
                      uni_list[lasttick] = [lat, lon];

                      var diff = curtick - lasttick;
                      if(diff == 1) {
                          //No interpolation necessary
                          //Carry on
                      } else if(diff <= uni_thresh) {
                          //Just do some linear interpolation
                          for(var t = 1; t < diff; t++) {
                              uni_list[lasttick + t] = [
                                  (curpoint.lat - uni_list[lasttick][0])*(t/diff),
                                  (curpoint.lon - uni_list[lasttick][1])*(t/diff)
                              ];
                          }
                          uni_interp.push([lasttick + 1, curtick - 1]);
                      } else {
                          //Too much missing, add it to the missing list
                          uni_missing.push([lasttick + 1, curtick - 1]);
                      }
                  }
                  //In any case, throw the point on the average list
                  uni_avg.push(curpoint);
                  lasttick = curtick;
              }

              if(!seglist[curpoint.segid]) {
                  seglist[curpoint.segid] = {
                      lines: [],
                      lastcolor: false,
                      points: [],
                  };
              }
              curseg = seglist[curpoint.segid];

              if(curseg.last_color && curpoint.color != curseg.last_color) {
                  //Add the current point so they're connected
                  curseg.points.push(new mxn.LatLonPoint(curpoint.lat, curpoint.lon))
                  newline = new mxn.Polyline(curseg.points);
                  newline.setColor(curseg.last_color);
                  newline.setWidth('4');
                  curseg.lines.push(newline);
                  curseg.points = [];
              }
              curseg.last_color = curpoint.color;
              curseg.points.push(new mxn.LatLonPoint(curpoint.lat, curpoint.lon))
          }
          map.removeAllPolylines();
          for(segnum in seglist) {
              curseg = seglist[segnum];
              if(curseg.points.length) {
                  newline = new mxn.Polyline(curseg.points);
                  newline.setColor(curseg.last_color);
                  newline.setWidth('4');
                  curseg.lines.push(newline);
                  curseg.points = [];
              }
              for(subseg in curseg.lines) {
                  map.addPolyline(curseg.lines[subseg]);
              }
          }
        }
      });
    })
