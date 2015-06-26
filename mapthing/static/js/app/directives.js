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

            for(var idx in $scope.pointData.timepoints) {
                var curtime = $scope.pointData.timepoints[idx].time/1000;
                if((mintime && (curtime < mintime))
                    || (maxtime && (curtime > maxtime))
                ) { continue; }

                var xpos = (curtime-mintime)/(maxtime-mintime)*$scope.timerange.canvas.attr('width');
                $scope.timerange.dc.fillRect(xpos,0,1,$scope.timerange.canvas.attr('height'));
            }
          }

          $scope.draw_uni = function() {
            var start, end;
            for(var i in uni_list) { start = i; break; }
            end = uni_list.length;

            var scalefact = $scope.view.canvas.attr('width')/(end-start);
            $scope.view.dc.fillStyle = "rgb(255,0,0)";
            for(var r in uni_missing) {
                var range = uni_missing[r];
                $scope.view.dc.fillRect(
                    (range[0]-start)*scalefact,0,
                    (range[1]-start+1)*scalefact,1
                );
            }
            $scope.view.dc.fillStyle = "rgb(255,255,0)";
            for(var r in uni_interp) {
                var range = uni_interp[r];
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
          bounds: '=',
          pointRange: '=',
          pointData: '=',
        },
        link: function(scope, elm, attrs) {
          scope.map = new mxn.Mapstraction(attrs.id, 'leaflet')

          scope.map.enableScrollWheelZoom();
          scope.map.addControls({
              scale:true,
              map_type:true,
          });

          scope.$watch('bounds', function(cur, prev, scope) {
            if(scope.map && cur) { scope.map.setBounds(cur); }
          });

          scope.$watch('pointData', function(cur, prev, scope) {
            scope.update();
          });
        },
        controller: function($scope) {
          $scope.update = function(smoothzoom) {
            var starttime = moment($scope.pointRange[0],'X');
            var endtime = moment($scope.pointRange[1],'X');
            var length = moment.duration(starttime.diff(endtime));

            //TODO: Angular templatize this
            $('#sel_timerange').text(
                length.humanize()
                + ' starting on ' +
                starttime.format('ddd MMM D, YYYY')
                + ' at ' +
                starttime.format('H:mm')
            );

            $scope.draw(smoothzoom);

            if(smoothzoom) {
              //Do fancy shit
              if($scope.pointbounds && !$scope.pointbounds.isEmpty()) {
                var min_area = 3e-6;
                var max_unused = 5;
                var cur_area = $scope.pointbounds.getArea();
                if($scope.bounds.contains($scope.pointbounds)) {
                  //If we're over the threshhold of unused space, shrink things down
                  if($scope.bounds.getArea() > cur_area*max_unused) {
                    if(cur_area < min_area) {
                      $scope.pointbounds.zoom(Math.sqrt(min_area/cur_area));
                    }
                    $scope.bounds = $scope.pointbounds;
                    $scope.map.setBounds($scope.pointbounds);
                  }
                } else {
                  $scope.bounds.extend($scope.pointbounds.ne);
                  $scope.bounds.extend($scope.pointbounds.sw);
                  $scope.map.setBounds($scope.bounds);
                }
              }
            } else {
              $scope.map.polylineCenterAndZoom();
            }
        }

        $scope.draw = function() {
          var points = Array();
          var curseg;

          var mintime = false, maxtime = false;
          if($scope.pointRange) {
              mintime = $scope.pointRange[0];
              maxtime = $scope.pointRange[1];
          }
          $scope.map.removeAllPolylines();
          for(segnum in seglist) {
              curseg = seglist[segnum];
              if(curseg.points.length) {
                  var newline = new mxn.Polyline(curseg.points);
                  newline.setColor(curseg.last_color);
                  newline.setWidth('4');
                  curseg.lines.push(newline);
                  curseg.points = [];
              }
              for(var subseg in curseg.lines) {
                  $scope.map.addPolyline(curseg.lines[subseg]);
              }
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
