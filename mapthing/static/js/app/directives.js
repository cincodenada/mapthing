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
        },
        controller: function($scope) {
          // Set up derived anim opts
          $scope.watch('params.fps', function(prev, cur, scope) {
            scope.params.spf = 1/cur;
            scope.params.real_spf = scope.params.spf * scope.params.speedup;
          });

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

          scope.slider = scope.elm.timerange({
            change: function(evt, ui) {
              $scope.apply(function(scope) {
                scope.selrange = ui.values;
              })
            }
          });

          scope.$watchGroup(['start','end'], function(prev, cur, scope) {
            if(cur) {
              scope.tracks = Track.query({start: cur[0], end: cur[1]})
              scope.bounds = new mxn.BoundingBox();

              for(idx in scope.tracks) {
                  trackdata = scope.tracks[idx];

                  //Extend bounds
                  scope.bounds.extend({lat: trackdata.minlat, lon: trackdata.minlon});
                  scope.bounds.extend({lat: trackdata.maxlat, lon: trackdata.maxlon});
              }
            }
          });
        },
      }
    })
    .directive('pointSel', function() {
      return {
        template: 
          '<div class="sel_view"><canvas></canvas></div>' +
          '<div class="uni_view"><canvas></canvas></div>',
        link: function(scope, elm, attrs) {
          scope.view = {}
          scope.view.elm = elm.find('.sel_view');
          scope.view.canvas = scope.view.elm.find('canvas');
          scope.view.canvas.attr('width', scope.view.canvas.innerWidth());
          scope.view.canvas.attr('height', 1);
          scope.view.dc = scope.view.canvas[0].getContext('2d');

          scope.slider = {}
          scope.slider.elm = elm.find('.uni_view');
          scope.slider.canvas = scope.slider.elm.find('canvas');
          scope.slider.canvas.attr('width', scope.slider.canvas.innerWidth());
          scope.slider.canvas.attr('height', scope.slider.canvas.innerHeight());
          scope.slider.dc = scope.slider.canvas[0].getContext('2d');
        }
      }
    })
    .directive('pathMap', function() {
      return {
        link: function(scope, elm, attrs) {
          scope.map = new mxn.Mapstraction(attrs.id, 'leaflet')

          scope.map.enableScrollWheelZoom();
          scope.map.addControls({
              scale:true,
              map_type:true,
          });
        },
        controller: function($scope) {
          $scope.watch('bounds', function(prev, cur, scope) {
            scope.map.setBounds(bounds);
          })

          $scope.update = function(timerange, smoothzoom) {
            var starttime = moment(timerange[0],'X');
            var endtime = moment(timerange[1],'X');
            var length = moment.duration(starttime.diff(endtime));

            $('#sel_timerange').text(
                length.humanize()
                + ' starting on ' +
                starttime.format('ddd MMM D, YYYY')
                + ' at ' +
                starttime.format('H:mm')
            );

            $scope.draw(timerange, autocenter);

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

        $scope.draw = function(timerange, autocenter) {
          var points = Array();
          var curseg;

          var uni_tick = $('#uni_interval').val();
          var uni_thresh = $('#uni_interp').val();

          var mintime = false, maxtime = false;
          if(timerange) {
              mintime = timerange[0];
              maxtime = timerange[1];
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

          if(is_anim) { draw_uniview(); }
        }
      },
    }
  })
