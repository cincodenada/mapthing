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
              scope.tracks = Track.query({start: cur[0], end: cur[1]}, function() {
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
                angular.forEach(cur_seg.lines, function(linedata) {
                  if( linedata.start < scope.selrange[1] &&
                      linedata.end > scope.selrange[0]) {
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
                  // Un-highlight the lines
                  angular.forEach(cur_seg.lines, function(linedata) {
                    linedata.line.setColor(cur_seg.color);
                    linedata.line.setWidth('4');
                    linedata.line.update();
                  });
                  cur_seg.highlighted = false;
                } else {
                  // If we're at the end of the highlighted section,
                  // no need to keep going
                  if(found_hl) { break; }
                }
              }

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

        $scope.draw = function() {
          $scope.map.removeAllPolylines();
          for(var idx in $scope.data.segs) {
            var cur_seg = $scope.data.segs[idx];
            cur_seg.lines = [];
            cur_seg.line_times = [];

            // Check limits and either skip or drop out
            if(cur_seg.end < $scope.range[0]) continue;
            if(cur_seg.start > $scope.range[1]) break;

            var points = [];
            var start = Math.max(cur_seg.start, $scope.range[0]);
            var end = Math.min(cur_seg.end, $scope.range[1]);
            
            var addline = function(points, color) {
              var newline = new mxn.Polyline(points);
              newline.setColor(color);
              newline.setWidth('4');
              $scope.map.addPolyline(newline);
              return newline;
            };
            
            var linestart = null;
            for(var i = start; i <= end; i++) {
              // Create new lines at every discontinuity
              if(!$scope.data.points[i]) {
                if(points.length) {
                  var newline = addline(points, cur_seg.color);
                  cur_seg.lines.push({
                      line: newline,
                      start: linestart,
                      end: i,
                  });
                }
                linestart = null;
                points = [];
              } else {
                if(linestart === null) { linestart = i }
                points.push(new mxn.LatLonPoint(
                    $scope.data.points[i][0],
                    $scope.data.points[i][1]
                ));
              }
            }
            if(points.length) { addline(points, cur_seg); }
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
