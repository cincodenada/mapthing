// vim: set ts=2 sts=2 sw=2 :
'use strict';

angular.module('mapApp.directives', [])
  // {{{ animControl
  .directive('animControl', function() {
    return {
      scope: {
         outrange: '=',
         range: '=',
      },
      templateUrl: 'anim_controls.html',
      link: function(scope, elm, attrs) {
        // Set up slider UI
        scope.scrubber = elm.find('.anim_playpos').slider({
          slide: function(evt, ui) {
            scope.$apply(function(scope) {
              scope.state.curtime = ui.value;
            });
          }
        });

        // Set up derived anim opts
        scope.$watch('params.fps', function(cur, prev, scope) {
          scope.params.spf = 1/cur;
          scope.params.real_spf = scope.params.spf * scope.params.speedup;
        });
      },
      controller: function($scope) {
        $scope.params = $scope.params || {
          fps: 2,
          speedup: 60,
          traillen: 300,
        };

        $scope.state = $scope.state || {
          direction: 1,
          stopped: true,
          curtime: null,
          timeout: null,
        };

        $scope.$watch('state.curtime', function(cur, prev, scope) {
          if(scope.state.curtime > scope.range[1]) {
            scope.state.curtime = scope.range[0];
          } else if(scope.state.curtime < scope.range[0]) {
            scope.state.curtime = scope.range[1];
          }
          var trailpoint = scope.state.curtime - scope.params.traillen*scope.state.direction;

          scope.outrange = (scope.state.direction < 0)
            ? [scope.state.curtime, trailpoint]
            : [trailpoint, scope.state.curtime]

          scope.scrubber.slider('option','value',cur);
        });

        $scope.$watch('range', function() {
          $scope.reset();
        });

        $scope.$watch('state.stopped', function(cur, prev, scope) {
          if(cur !== prev) {
            // If we're newly stopped, kill things
            if(cur) {
              var to;
              while(to = $scope.state.timeout) {
                clearTimeout(to);
                scope.state.timeout = null;
              }
            // Otherwise, we're just starting, kick it off!
            } else {
              scope.tick();
            }
          }
        });

        $scope.setAnim = function(action, value) {
          if(action == "pausestop") {
              action = $scope.state.timeout ? 'pause' : 'stop';
          }
          switch(action) {
              case "rewind":
              case "play":
                  $scope.state.direction = (action == 'rewind' ? -1 : 1);
                  $scope.state.stopped = false;
                  break;
              case "stop":
                  $scope.reset();
              case "pause":
                  $scope.state.stopped = true;
                  break;
              case "step":
                  $scope.state.direction = value;
                  $scope.state.stopped = true;
                  $scope.tick();
                  break;
          }
        }

        $scope.tick = function() {
          $scope.state.curtime += $scope.params.real_spf*$scope.state.direction;
          if(!$scope.state.stopped) {
            $scope.state.timeout = setTimeout($scope.tick, $scope.params.spf*1000);
          }
        }

        $scope.reset = function() {
          // Reset the view to the original bit
          $scope.outrange = angular.copy($scope.range);
        }

        $scope.reset();
      }
    }
  })
  // }}}
  // {{{ trackSel
  .directive('trackSel', function(Track) {
    return {
      scope: {
        start: '=',
        end: '=',
        bounds: '=',
        selRange: '=',
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

      },
    }
  })
  // }}}
  // {{{ pointSel
  .directive('pointSel', function(Track, PointList) {
    return {
      template: 
        '<div class="sel_view"><canvas></canvas></div>' +
        '<div class="uni_view"><canvas></canvas></div>',
      scope: {
        start: '=',
        end: '=',
        selRange: '=',
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

        // Set up UI callback for selected timerange
        scope.timerange.elm.timerange({
          change: function(evt, ui) {
            scope.$apply(function(scope) {
              scope.selRange = ui.values;
            });
          }
        });

        // This kicks off the track queries
        scope.$watchGroup(['start','end'], function(cur, prev, scope) {
          if(cur) {
            // Go fetch our points
            var starttime = moment(cur[0],'X');
            var endtime = moment(cur[1],'X');
            scope.timerange.elm.timerange('option','min',cur[0]);
            scope.timerange.elm.timerange('option','max',cur[1]);

            PointList.get({start: starttime.format('YYYY-MM-DD HH:mm:ss'), end: endtime.format('YYYY-MM-DD HH:mm:ss')}, function(p) {
              scope.pointData = p;
              scope.draw();
            });

            // And our tracks
            scope.tracks = Track.query({start: starttime.format('YYYY-MM-DD'), end: endtime.format('YYYY-MM-DD')}, function() {
              scope.bounds = new mxn.BoundingBox();

              // Get canvas for drawing
              var c = scope.view.dc;
              c.clearRect(0, 0, c.canvas.width, c.canvas.height);
              var pxpersec = c.canvas.width/(endtime - starttime);

              for(var idx in scope.tracks) {
                  var trackdata = scope.tracks[idx];

                  // Extend bounds
                  scope.bounds.extend({lat: trackdata.minlat, lon: trackdata.minlon});
                  scope.bounds.extend({lat: trackdata.maxlat, lon: trackdata.maxlon});

                  var relstart = trackdata.start - starttime;
                  var len = trackdata.end - trackdata.start;
                  // Draw tracks
                  c.fillRect(
                    pxpersec*relstart,0,
                    pxpersec*len,1
                  );
              }
            })
          }
        });

        scope.$watch('range', function(cur, prev, scope) {
          if(cur) {
          }
        });

        scope.$watch('selRange', function(cur, prev, scope) {
          if(cur) {
            console.log("TODO: Update uniview");
            //scope.draw_uni();
          }
        });
      },
      controller: function($scope) {
        $scope.draw = function() {
          var mintime = $scope.start.unix();
          var maxtime = $scope.end.unix();
          if(!mintime || !maxtime) { return false; }

          $scope.timerange.dc.clearRect(0,0,$scope.timerange.canvas.attr('width'),$scope.timerange.canvas.attr('height'));

          var bounds = new mxn.BoundingBox();
          
          var bar_width = 5;
          var bar_pad = 1;
          var bar_total = bar_width + bar_pad*2;
          var canvas_width = $scope.timerange.canvas.attr('width');
          var point_count = {};
          var max_count = 0;

          for(var idx in $scope.pointData.timepoints) {
              var curpoint = $scope.pointData.timepoints[idx];
              var curtime = curpoint.time/1000;
              if((mintime && (curtime < mintime))
                  || (maxtime && (curtime > maxtime))
              ) { continue; }

              //Curpoint has lat/lon properties, so we're great
              bounds.extend(curpoint);

              var barpos = Math.floor((curtime-mintime)/(maxtime-mintime)*canvas_width/bar_total);
              if(!point_count[barpos]) { point_count[barpos] = 0 }
              point_count[barpos] += 1;
              if(point_count[barpos] > max_count) {
                max_count = point_count[barpos];
              }
          }
          var height = $scope.timerange.canvas.attr('height');
          console.log(point_count)
          for(var bp=0; bp<canvas_width/bar_total; bp++) {
            if(point_count[bp]) {
              var bar_height = height*point_count[bp]/max_count
              $scope.timerange.dc.fillRect(
                bp*bar_total+bar_pad, height-bar_height,
                bar_total-bar_pad*2,bar_height
              );
            }
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
  // }}}
  // {{{ pathMap
  .directive('pathMap', function(PointList) {
    return {
      scope: {
        data: '=',
        range: '=',
        selRange: '=',
        selLoc: '=',
      },
      link: function(scope, elm, attrs) {
        scope.map = new mxn.Mapstraction(attrs.id, 'openlayers')

        scope.map.enableScrollWheelZoom();
        scope.map.addControls({
            scale:true,
            map_type:true,
        });

        const parent = scope.$parent;

        parent.getInMap = function() {
          const bounds = scope.map.getBounds();
          PointList.get({
            ne: [bounds.ne.lat,bounds.ne.lon].join(','),
            sw: [bounds.sw.lat,bounds.sw.lon].join(','),
          }, function(p) {
            parent.data.view_points = p;
            scope.draw();
          });
        }
  
        scope.$watch('data.bounds', function(cur, prev, scope) {
          if(scope.map && cur) { scope.map.setBounds(cur); }
        });

        scope.$watchGroup(['range','data.spans'], function(cur, prev, scope) {
          scope.update();
        });

        scope.$watch('selRange', function(cur, prev, scope) {
          console.log('new range', cur, scope.data.segs)
          if(cur) {
            for(var idx in scope.data.segs) {
              var cur_seg = scope.data.segs[idx];
              console.log(cur_seg)

              // Check limits and either skip or drop out
              if(cur_seg.end < cur[0]) continue;
              if(cur_seg.start > cur[1]) break;

              scope.data.segs[idx].highlighted = true;
            }
          } else {
            var found_hl = false;
            for(var idx in scope.data.segs) {
              var cur_seg = scope.data.segs[idx];

              if(cur_seg.highlighted) {
                found_hl = true;
                scope.data.segs[idx].highlighted = false;
              } else {
                // If we're at the end of the highlighted section,
                // no need to keep going
                if(found_hl) { break; }
              }
            }
          }

          scope.update();
        });

        scope.$watch('selLoc', function(cur, prev, scope) {
          if(cur !== null) {
            var loc = scope.data.locations[cur]
            scope.data.point = loc
            scope.drawPoints(true);
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

        $scope.buildLines = function(seg, range, is_highlighted) {
            var points = [];
            var lines = [];
            var start = Math.max(seg.start, range[0]);
            var end = Math.min(seg.end, range[1]);

            var addline = function(points, seg) {
              var newline = new mxn.Polyline(points);
              newline.setColor(is_highlighted ? '#0000FF' : seg.color);
              newline.setWidth(is_highlighted ? '6' : '4');
              $scope.map.addPolyline(newline);

              lines.push({
                  line: newline,
                  start: start,
                  end: end,
              });
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

            return lines;
        }

        $scope.draw = function() {
          $scope.drawLines();
          $scope.drawPoints();
        }
        $scope.drawLines = function() {
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

            cur_seg.lines = $scope.buildLines(cur_seg, $scope.range);

            if(cur_seg.highlighted) {
              $scope.buildLines(cur_seg, $scope.selRange, true);
            }
          }
        }
        $scope.drawPoints = function(zoom=false) {
          console.log($scope.data.point);
          $scope.map.removeAllMarkers();
          if($scope.data.point) {
            const p = $scope.data.point;
            var center = new mxn.LatLonPoint(
              p.lat,
              p.lon
            );
            const zoomPoints = [center]
            var marker = new mxn.Marker(center);
            marker.setIcon('/static/point.png')
            $scope.map.addMarker(marker);
            if(p.points) {
              p.points.forEach(function(cp) {
                const llp = new mxn.LatLonPoint(cp[0], cp[1])
                var curm = new mxn.Marker(llp);
                zoomPoints.push(llp);
                curm.setIcon('/static/point.png')
                $scope.map.addMarker(curm);
              })
            }
            if(zoom) {
              $scope.map.centerAndZoomOnPoints(zoomPoints);
            }
            var radius = new mxn.Radius(center, 20);
            $scope.map.addPolyline(radius.getPolyline(p.radius/1000, 'red'));
          }
        }
      },
    }
  })
  // }}}
  .directive('tripList', function(Location) {
    return {
      scope: {
        locations: '<',
        trips: '<',
        viewRange: '=',
        selRange: '=',
        selLoc: '=',
        uniParams: '<',
      },
      templateUrl: 'trip_list.html',
      link: function(scope, elm, attrs) {
        scope.$watch('locations', function(cur, prev, scope) {
          console.log('Locations', cur)
        });
        scope.$watch('trips', function(cur, prev, scope) {
          console.log('Trips', cur)
        });
        scope.elm = elm.find('ul');
        scope.elm.on('click','li a.trip_segment',function() {
          const trip = $(this).scope().trip
          const interval = scope.uniParams.interval
          scope.$apply(function(scope) {
            scope.viewRange = [
              trip.start/1000/interval,
              trip.end/1000/interval
            ]
          })
        });
        scope.elm.on('mouseover','li a.trip_segment',function() {
          const trip = $(this).scope().trip
          console.log('Highlighting trip', trip)
          const interval = scope.uniParams.interval
          scope.$apply(function(scope) {
            scope.selRange = [
              trip.start/1000/interval,
              trip.end/1000/interval
            ]
          })
        });
        scope.elm.on('mouseout','li a.trip_segment',function() {
          console.log('Clearing selRange');
          scope.$apply(function(scope) {
            scope.selRange = null
          })
        });
        scope.elm.on('click','li a.trip_stop',function() {
          const trip = $(this).scope().trip
          const which = $(this).data('type')
          scope.$apply(function(scope) {
            scope.editName(trip[`${which}_loc`])
          })
        });
        scope.elm.on('mouseover','li a.trip_stop',function() {
          const trip = $(this).scope().trip
          const which = $(this).data('type')
          console.log('Highlighting stop', trip, which)
          scope.$apply(function(scope) {
            scope.selLoc = trip[`${which}_loc`]
          })
        });
        scope.elm.on('mouseout','li a.trip_stop',function() {
          scope.$apply(function(scope) {
            scope.selLoc = null
          })
        });
      },
      controller: function($scope) {
        $scope.editName = function(locid) {
          const newname = prompt('New location name?');
          if(newname) {
            const curLoc = $scope.locations[locid]
            $scope.locations[locid].name = newname;
            Location.save({
              name: newname,
              latitude: curLoc.lat,
              longitude: curLoc.lon,
              radius: curLoc.radius,
            })
          }
        }
      }
    }
  })
  .directive('dayView', function() {
    return {
      scope: {
        start: '<',
        end: '<',
        locations: '<',
        trips: '<',
      },
      templateUrl: 'day_view.html',
      link: function(scope, elm, attrs) {
      },
      controller: function($scope) {
        $scope.$watchGroup(['start', 'end'], function(cur, prev, scope) {
          if(cur) {
            console.log(cur)
            const [start, end] = cur.map(d => Instant.from(d.toISOString()).toZonedDateTimeISO('UTC').toPlainDate())
            console.log(scope.days)
            let curday = start;
            const days = []
            while(PlainDate.compare(curday, end) < 1) {
              days.push(curday)
              curday = curday.add('P1D')
            }
            scope.days = days.map(d => d.toString())
          }
        });
        $scope.$watch('trips', function(cur, prev, scope) {
          if(cur) {
            const dayStops = Object.fromEntries(scope.days.map(d => [d, []]))
            for(const trip of cur) {
              for(const stop of trip.stops) {
                const start = Instant.fromEpochMilliseconds(stop.start).toZonedDateTimeISO(tz)
                const end = Instant.fromEpochMilliseconds(stop.end).toZonedDateTimeISO(tz)
                const startDate = start.toPlainDate().toString();
                const endDate = end.toPlainDate.toString();
                const annotated = {
                  ...stop,
                  $startTime: start.toPlainTime(),
                  $endTime: end.toPlainTime(),
                }
                if(startDate !== endDate) {
                  dayStops[startDate].push({
                    ...annotated,
                    $endTime: PlainTime.from("23:59"),
                  })
                  if(dayStops[endDate]) {
                    dayStops[endDate].push({
                      ...annotated,
                      $startTime: PlainTime.from("00:00"),
                    })
                  }
                } else {
                  dayStops[startDate].push(annotated)
                }
              }
            }
            scope.dayStops = dayStops
            console.log('day trips', dayStops)
          }
        })
      },
    }
  })
  // {{{ notifyLast
  .directive('notifyLast', function() {
    return function(scope, elm, attr) {
      if(scope.$last) setTimeout(function() {
        scope.$emit('lastItemDone', elm, attr);
      }, 0)
    }
  })
