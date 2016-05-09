// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.directives', [])
    .directive('animControl', function() {
      return {
        templateUrl: 'anim_controls.html',
        link: function(scope, elm, attrs) {
          // Set up slider UI
          scope.scrubber = elm.find('.anim_playpos').slider({
            slide: function(evt, ui) {
              scope.state.curtime = ui.value;
              scope.tick();
            }
          });

          // Set up derived anim opts
          scope.$watch('params.fps', function(cur, prev, scope) {
            scope.params.spf = 1/cur;
            scope.params.real_spf = scope.params.spf * scope.params.speedup;
          });
        },
        controller: function($scope) {
          $scope.setAnim = function(action, value) {
            if(action == "pausestop") {
                action = $scope.state.timeout ? 'pause' : 'stop';
            }
            switch(action) {
                case "rewind":
                case "play":
                    $scope.state.direction = (action == 'rewind' ? -1 : 1)
                    if($scope.state.stopped) {
                        start_anim();
                    } else {
                        //If we're not actively playing, kick it off again
                        if(!$scope.state.timeout) { $scope.tick(); }
                    }
                    break;
                case "stop":
                    $scope.state.stopped = true;
                case "pause":
                    while(to = $scope.state.timeout) {
                        clearTimeout(to);
                        $scope.state.timeout = null;
                    }
                    break;
                case "step":
                    break;
            }
          }

          $scope.tick = function() {
            $scope.state.curtime += $scope.params.real_spf*$scope.state.direction;
          }

          $scope.update = function() {
            if($scope.state.curtime > $scope.state.end) {
              $scope.state.curtime = $scope.state.start;
            } else if($scope.state.curtime < $scope.state.start) {
              $scope.state.curtime = $scope.state.end;
            }
            trailpoint = $scope.state.curtime - $scope.params.traillen*$scope.state.direction;

            timeframe = ($scope.state.direction < 0)
              ? [$scope.state.curtime, trailpoint] 
              : [trailpoint, $scope.state.curtime]

            update_mapview(timeframe, true);
          }

          /*
          if(!scrubtime) {
            play_scrubber.slider('option','value',$scope.state.curtime);
            $scope.state.timeout = setTimeout(update_anim, $scope.params.spf*1000);
          }
          */
        }
      }
    })
    .directive('trackSel', function(Track) {
      return {
        scope: {
          start: '=',
          end: '=',
          bounds: '=',
          selrange: '=',
        },
        templateUrl: 'track_sel.html',
        link: function(scope, elm, attrs) {
          scope.elm = elm.find('ul');
          scope.elm.on('mouseover','li a',function() {
              scope.sel_id = $(this).data('trackid');
              /*
              if(seglist[trackid]) {
                  $.each(seglist[trackid], function(idx, seg) {
                      seg.oldcolor = seg.color;
                      seg.setColor('#0000FF');
                      seg.setWidth('6');
                      seg.update();
                  })
              }
              */
          });
          scope.elm.on('mouseout','li a',function() {
              scope.sel_id = $(this).data('trackid');
              /*
              if(seglist[trackid]) {
                  $.each(seglist[trackid], function(idx, seg) {
                      seg.setColor(seg.oldcolor);
                      seg.setWidth('4');
                      seg.update();
                  })
              }
              */
          });

          scope.timerange = scope.elm.timerange({
            change: function(evt, ui) {
              scope.$apply(function(scope) {
                scope.selrange = ui.values;
              })
            }
          });

          scope.$watchGroup(['start','end'], function(cur, prev, scope) {
            if(cur) {
              scope.tracks = Track.query({start: cur[0].format('YYYY-MM-DD'), end: cur[1].format('YYYY-MM-DD')}, function() {
                scope.bounds = new mxn.BoundingBox();

                for(var idx in scope.tracks) {
                    var trackdata = scope.tracks[idx];

                    //Extend bounds
                    scope.bounds.extend({lat: trackdata.minlat, lon: trackdata.minlon});
                    scope.bounds.extend({lat: trackdata.maxlat, lon: trackdata.maxlon});
                }
              })
            }
          });

          scope.$on('lastItemDone', function() {
            scope.timerange.timerange("refresh");
          });
        },
      }
    })
    .directive('pointSel', function(PointList) {
      return {
        template: 
          '<div class="sel_view"><canvas></canvas></div>' +
          '<div class="uni_view"><canvas></canvas></div>',
        scope: {
          range: '=',
          selrange: '=',
          pointData: '=',
          pointBounds: '=',
          uniParams: '=',
          uniData: '=',
        },
        link: function(scope, elm, attrs) {
          scope.view = {}
          scope.view.elm = elm.find('.uni_view');
          scope.view.canvas = scope.view.elm.find('canvas');
          scope.view.canvas.attr('width', scope.view.canvas.innerWidth());
          scope.view.canvas.attr('height', 1);
          scope.view.dc = scope.view.canvas[0].getContext('2d');

          scope.timerange = {}
          scope.timerange.elm = elm.find('.sel_view');
          scope.timerange.canvas = scope.timerange.elm.find('canvas');
          scope.timerange.canvas.attr('width', scope.timerange.canvas.innerWidth());
          scope.timerange.canvas.attr('height', scope.timerange.canvas.innerHeight());
          scope.timerange.dc = scope.timerange.canvas[0].getContext('2d');
          
          scope.timerange.elm.timerange({
            change: function(evt, ui) {
              scope.$apply(function(scope) {
                scope.selrange = ui.values;
              });
            }
          });

          scope.$watch('range', function(cur, prev, scope) {
            if(cur) {
              var starttime = moment(cur[0],'X');
              var endtime = moment(cur[1],'X');
              scope.timerange.elm.timerange('option','min',cur[0]);
              scope.timerange.elm.timerange('option','max',cur[1]);

              PointList.get({start: starttime.format('YYYY-MM-DD HH:mm:ss'), end: endtime.format('YYYY-MM-DD HH:mm:ss')}, function(p) {
                scope.pointData = p;
                scope.draw();
              });
            }
          });

          scope.$watch('selrange', function(cur, prev, scope) {
            if(cur) {
              console.log("TODO: Update uniview");
              //scope.draw_uni();
            }
          });
        },
        controller: function($scope) {
          $scope.draw = function() {
            var mintime, maxtime;
            if($scope.range) {
                mintime = $scope.range[0];
                maxtime = $scope.range[1];
            } else {
                return false;
            }

            $scope.timerange.dc.fillStyle = "rgba(0,0,0,0.2)";
            $scope.timerange.dc.clearRect(0,0,$scope.timerange.canvas.attr('width'),$scope.timerange.canvas.attr('height'));

            var bounds = new mxn.BoundingBox();

            for(var idx in $scope.pointData.timepoints) {
                var curpoint = $scope.pointData.timepoints[idx];
                var curtime = curpoint.time/1000;
                if((mintime && (curtime < mintime))
                    || (maxtime && (curtime > maxtime))
                ) { continue; }

                //Curpoint has lat/lon properties, so we're great
                bounds.extend(curpoint);

                var xpos = (curtime-mintime)/(maxtime-mintime)*$scope.timerange.canvas.attr('width');
                $scope.timerange.dc.fillRect(xpos,0,1,$scope.timerange.canvas.attr('height'));
            }

            $scope.pointBounds = bounds;
          }

          $scope.draw_uni = function() {
            var start = Math.round(scope.range[0]/scope.uniParams.interval)
            var end = Math.round(scope.range[1]/scope.uniParams.interval)

            var scalefact = $scope.view.canvas.attr('width')/(end-start);
            $scope.view.dc.fillStyle = "rgb(255,0,0)";
            for(var r in scope.uniData.missing) {
                var range = scope.uniData.missing[r];
                $scope.view.dc.fillRect(
                    (range[0]-start)*scalefact,0,
                    (range[1]-start+1)*scalefact,1
                );
            }
            $scope.view.dc.fillStyle = "rgb(255,255,0)";
            for(var r in scope.uniData.interp) {
                var range = scope.uniData.interp[r];
                $scope.view.dc.fillRect(
                    (range[0]-start+1)*scalefact,0,
                    (range[1]-start-1)*scalefact,1
                );
            }
          }
        }
      }
    })
    .directive('pathMap', function() {
      return {
        scope: {
          data: '=',
          range: '=',
          selrange: '=',
          selpoint: '=',
        },
        link: function(scope, elm, attrs) {
          scope.map = new mxn.Mapstraction(attrs.id, 'leaflet')

          scope.map.enableScrollWheelZoom();
          scope.map.addControls({
              scale:true,
              map_type:true,
          });

          scope.$watch('data.bounds', function(cur, prev, scope) {
            if(scope.map && cur) { scope.map.setBounds(cur); }
          });

          scope.$watchGroup(['range','data.spans'], function(cur, prev, scope) {
            scope.update();
          });

          scope.$watch('selrange', function(cur, prev, scope) {
            if(cur) {
              for(var idx in scope.data.segs) {
                var cur_seg = scope.data.segs[idx];

                // Check limits and either skip or drop out
                if(cur_seg.end < scope.selrange[0]) continue;
                if(cur_seg.start > scope.selrange[1]) break;

                // Highlight the lines
                if(cur_seg.lines.length == 0) {
                  scope.buildLines(cur_seg, scope.selrange);
                }

                angular.forEach(cur_seg.lines, function(linedata) {
                  if( linedata.start <= scope.selrange[1] &&
                      linedata.end >= scope.selrange[0]) {
                    linedata.line.setColor('#0000FF');
                    linedata.line.setWidth('6');
                    linedata.line.update();
                  }
                });
                cur_seg.highlighted = true;
              }
            } else {
              var found_hl = false;
              for(var idx in scope.data.segs) {
                var cur_seg = scope.data.segs[idx];

                if(cur_seg.highlighted) {
                  if(scope.selrange && (cur_seg.start > scope.selrange[1] || cur_seg.end < scope.selrange[0])) {
                    // Remove the lines if they're
                    // outside the selected range
                    cur_seg.lines = [];
                  }
                  cur_seg.highlighted = false;
                } else {
                  // If we're at the end of the highlighted section,
                  // no need to keep going
                  if(found_hl) { break; }
                }
              }

              scope.update();
            }
          });

          scope.$watch('selpoint', function(cur, prev, scope) {
            if(cur !== null) {
              var loc = scope.data.locations[cur]
              scope.data.point = loc
              scope.update();
            }
          });
        },
        controller: function($scope) {
          $scope.update = function(smoothzoom) {
            $scope.draw();
            // Don't rezoom the map if we have no lines
            if($scope.map.polylines.length == 0) { return; }

            if(smoothzoom) {
              //Do fancy shit
              if($scope.data.bounds && !$scope.data.bounds.isEmpty()) {
                var min_area = 3e-6;
                var max_unused = 5;
                var cur_area = $scope.data.bounds.getArea();
                if($scope.bounds.contains($scope.data.bounds)) {
                  //If we're over the threshhold of unused space, shrink things down
                  if($scope.bounds.getArea() > cur_area*max_unused) {
                    if(cur_area < min_area) {
                      $scope.data.bounds.zoom(Math.sqrt(min_area/cur_area));
                    }
                    $scope.bounds = $scope.data.bounds;
                    $scope.map.setBounds($scope.data.bounds);
                  }
                } else {
                  $scope.bounds.extend($scope.data.bounds.ne);
                  $scope.bounds.extend($scope.data.bounds.sw);
                  $scope.map.setBounds($scope.bounds);
                }
              }
            } else {
              $scope.map.polylineCenterAndZoom();
            }
        }

        $scope.buildLines = function(seg, range) {
            var points = [];
            var start = Math.max(seg.start, range[0]);
            var end = Math.min(seg.end, range[1]);
            
            var addline = function(points, seg) {
              var is_highlighted = $scope.selrange && (
                start <= $scope.selrange[1] &&
                end >= $scope.selrange[0]
              );
              
              var start_slice = null;
              var end_slice = null;
              var mid_slice = points;
              var mid_range = [start, end];
              if(is_highlighted) {
                console.log("Checking highlighted range...");
                // Split up range if we have a partial selection
                if(start < $scope.selrange[0]) {
                  start_slice = points.slice(0, $scope.selrange[0] - seg.start);
                  mid_slice = points.slice($scope.selrange[0] - seg.start);
                  mid_range[0] = $scope.selrange[0];
                }
                if(end > $scope.selrange[1]) {
                  var tail_len = seg.end - $scope.selrange[1];
                  mid_slice = mid_slice.slice(0, mid_slice.len - tail_len);
                  end_slice = points.slice(-tail_len);
                  mid_range[1] = $scope.selrange[1];
                }
              }

              if(start_slice) {
                var newline = new mxn.Polyline(start_slice);
                newline.setColor(seg.color);
                newline.setWidth('4');
                $scope.map.addPolyline(newline);
                seg.lines.push({
                    line: newline,
                    start: start,
                    end: $scope.selrange[0],
                });
              }

              var newline = new mxn.Polyline(mid_slice);
              newline.setColor(is_highlighted ? '#0000FF' : seg.color);
              newline.setWidth(is_highlighted ? '6' : '4');
              $scope.map.addPolyline(newline);
              seg.lines.push({
                  line: newline,
                  start: mid_range[0],
                  end: mid_range[1],
              });

              if(end_slice) {
                var newline = new mxn.Polyline(end_slice);
                newline.setColor(seg.color);
                newline.setWidth('4');
                $scope.map.addPolyline(newline);
                seg.lines.push({
                    line: newline,
                    start: $scope.selrange[1],
                    end: end,
                });
              }
            };
            
            var linestart = null;
            for(var cur_tick = start; cur_tick <= end; cur_tick++) {
              // Create new lines at every discontinuity
              if(!$scope.data.points[cur_tick]) {
                if(points.length) { addline(points, seg, linestart, cur_tick); }
                linestart = null;
                points = [];
              } else {
                if(linestart === null) { linestart = cur_tick }
                points.push(new mxn.LatLonPoint(
                    $scope.data.points[cur_tick][0],
                    $scope.data.points[cur_tick][1]
                ));
              }
            }
            if(points.length) { addline(points, seg, linestart, cur_tick - 1); }
        }

        $scope.draw = function() {
          $scope.map.removeAllPolylines();
          for(var idx in $scope.data.segs) {
            var cur_seg = $scope.data.segs[idx];
            cur_seg.lines = [];
            cur_seg.line_times = [];

            // Check limits and either skip or drop out
            if(!cur_seg.highlighted) {
              if(cur_seg.end < $scope.range[0]) continue;
              if(cur_seg.start > $scope.range[1]) break;
            }

            $scope.buildLines(cur_seg, $scope.range);
          }

          $scope.map.removeAllMarkers();
          if($scope.data.point) {
            var center = new mxn.LatLonPoint(
              $scope.data.point.lat,
              $scope.data.point.lon
            );
            var marker = new mxn.Marker(center);
            $scope.map.addMarker(marker);
            if($scope.data.point.points) {
              $scope.data.point.points.forEach(function(cp) {
                var curm = new mxn.Marker(new mxn.LatLonPoint(cp[0], cp[1]));
                curm.setIcon('/static/point.png')
                $scope.map.addMarker(curm);
              })
            }
            var radius = new mxn.Radius(center, 20);
            $scope.map.addPolyline(radius.getPolyline($scope.data.point.radius, 'red'));
          }
        }
      },
    }
  })
  .directive('notifyLast', function() {
    return function(scope, elm, attr) {
      if(scope.$last) setTimeout(function() {
        scope.$emit('lastItemDone', elm, attr);
      }, 0)
    }
  })
