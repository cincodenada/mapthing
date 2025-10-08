// vim: set ts=2 sts=2 sw=2 :
'use strict';

const makeTime = (ms) => Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(tz)

function averageLatLon(latLonList) {
  return Object.fromEntries(Object.entries(
    latLonList.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon })
    )
  ).map(([k, v]) => [k, v/latLonList.length]))
}

function latLonFromGeometryPoint({x, y}) {
  const pt = new mxn.LatLonPoint();
  pt.fromProprietary('openlayers', {lat: y, lon: x})
  return pt
}

function makeResizer(mxnMap, Location) {
  const rawMap = mxnMap.getMap();
  const layer = new OpenLayers.Layer.Vector('resizer')
  mxnMap.layers.resizer = layer
  rawMap.addLayer(layer)
  
  const ctx = {
    layer
  };

  mxnMap.dragControl = new OpenLayers.Control.DragFeature(layer, {
    title: "Drag",
    displayClass: "olControlDragAnnotation",
    onDrag: function(feature) {
      const prevLoc = mxnMap.outlineCache.center();
      const handleLoc = feature.geometry.getCentroid(true)
      const mxnLoc = latLonFromGeometryPoint(handleLoc)
      if(feature === ctx.resizeHandle) {
        ctx.loc.radius = mxnLoc.distance(prevLoc)*1000;
        mxnMap.outlineCache.resize(ctx.loc.radius)
      } else if (feature === ctx.moveHandle) {
        mxnMap.outlineCache.move(mxnLoc)
        
        ctx.loc.lat = mxnLoc.lat;
        ctx.loc.lon = mxnLoc.lon;
        
        const outlineLoc = prevLoc.toProprietary('openlayers')
        ctx.resizeHandle.geometry.move(
          handleLoc.x - outlineLoc.lon,
          handleLoc.y - outlineLoc.lat
        )
        ctx.layer.drawFeature(ctx.resizeHandle)
      }
    },
    onComplete: function(e) {
    }
  });
  
  rawMap.addControl(mxnMap.dragControl); 

  const handle = {
    activate: (loc) => {
      if(ctx.loc) {
        if(ctx.loc === loc) { return }
        handle.deactivate()
      }
      console.log("Activating", loc)
      
      ctx.loc = loc;

      const outlineRadius = mxnMap.outlineCache.radiusCalc;
      const center = outlineRadius.center;
      const handleLoc = new mxn.LatLonPoint(
        center.lat,
        center.lon + loc.radius/1000/center.lonConv()
      )
      
      const resizeRad = new mxn.Radius(handleLoc, 4);
      const resizePoly = resizeRad.getPolyline(loc.radius/10000, 'black')
      resizePoly.setClosed(true);
      resizePoly.setFillColor("black");
      resizePoly.api = "openlayers";
      
      const movePoly = outlineRadius.getPolyline(loc.radius/10000, 'black')
      movePoly.setClosed(true);
      movePoly.setFillColor("black");
      movePoly.api = "openlayers";
      
      ctx.resizeHandle = resizePoly.toProprietary()
      ctx.moveHandle = movePoly.toProprietary()
      ctx.layer.addFeatures([ctx.resizeHandle, ctx.moveHandle])

      mxnMap.dragControl.activate()
    },

    deactivate: () => {
      if(ctx.resizeHandle) {
        console.log("Deactivating")
        ctx.layer.removeFeatures([ctx.resizeHandle, ctx.moveHandle])
        ctx.resizeHandle = null
        ctx.moveHandle = null
        ctx.loc = null
        
        mxnMap.dragControl.deactivate()
      }
    }
  }
  return handle;
}

class OutlineCache {
  constructor(mxnMap) {
    this.map = mxnMap;
  }

  clear() {
    this.radius = null;
    this.radiusCalc = null;
    if(this.outline) {
      this.map.removePolyline(this.outline)
      this.outline = null;
    }
  }

  makeOutline(center, radius_m) {
    this.radius = radius_m;
    this.move(center);
  }

  move(center) {
    this.radiusCalc = new mxn.Radius(center, 20);
    this.resize(this.radius);
  }
  
  resize(radius_m) {
    this.radius = radius_m;
    if(this.outline) { this.map.removePolyline(this.outline) }
    this.outline = this.radiusCalc.getPolyline(radius_m/1000, 'red');
    this.outline.setWidth(2)
    this.map.addPolyline(this.outline)
  }

  center() {
    return this.radiusCalc?.center
  }
}

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
        curPoint: '=',
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

        scope.timerange.elm.on('mousemove', function(evt) {
          console.log(evt)
          scope.$apply(function(scope) {
            if(!scope.pointData) { return }
            /*
            const starttime = moment(scope.start,'X');
            const endtime = moment(scope.end,'X');
            const msperpx = (endtime - starttime)/scope.timerange.dc.canvas.width;
            const curts = scope.start + Math.floor(msperpx*(evt.clientX - scope.timerange.elm.prop('offsetLeft')))
            scope.curPoint = scope.pointData.timepoints[curts]
            */
            scope.selRange = [
              Math.floor(scope.start/1000/scope.uniParams.interval),
              Math.ceil(scope.end/1000/scope.uniParams.interval)
            ]
          })
            
        })

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
            scope.tracks = Track.query({start: starttime.format('YYYY-MM-DD HH:mm:ss'), end: endtime.format('YYYY-MM-DD HH:mm:ss')}, function() {
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
  .directive('pathMap', function(PointList, Location) {
    return {
      scope: {
        data: '=',
        range: '=',
        selRange: '=',
        curPoint: '=',
        selLocId: '=selLoc',
        pendingLoc: '=',
        editingLoc: '=',
      },
      link: function(scope, elm, attrs) {
        scope.map = new mxn.Mapstraction(attrs.id, 'openlayers')

        scope.map.enableScrollWheelZoom();

        scope.map.addControls({
            scale:true,
            map_type:true,
        });
        
        scope.map.resizer = makeResizer(scope.map, Location)
        scope.map.outlineCache = new OutlineCache(scope.map)

        /*
        scope.pointMarker = new mxn.Marker()
        scope.pointMarker.setIcon('/static/point.png')
        scope.map.addMarker(scope.pointMarker);
        */

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

        scope.$watch('curPoint', function(cur, prev, scope) {
          const curpoint = $scope.pointData.timepoints[idx];

          var center = new mxn.LatLonPoint(
            loc.lat,
            loc.lon
          );
        })
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

        scope.$watch('selLocId', function(cur, prev, scope) {
          if(cur !== null) {
            if(cur !== prev) { scope.map.outlineCache.clear(); }
            scope.data.selLoc = scope.data.locations[cur]
            scope.drawPoints(true);
          }
        });
        scope.$watch('pendingLoc', function(cur, prev, scope) {
          scope.drawPoints(true);
        });
      },
      controller: function($scope) {
        $scope.update = function(smoothzoom) {
          $scope.draw();
          // Don't rezoom the map if we have no lines
          if($scope.map.polylines.length == 0) { return; }
          // Also don't zoom if we're editing a location
          if($scope.pendingLoc) { return; }

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
              newline.setColor(is_highlighted ? '#0000FF' : seg.color || '#006600');
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
          $scope.map.removeAllMarkers();
          const loc = $scope.pendingLoc || $scope.data.selLoc;
          if(loc) {
            if(!$scope.map.outlineCache.outline) {
              var center = new mxn.LatLonPoint(
                loc.lat,
                loc.lon
              );
              const zoomPoints = [center]
              var marker = new mxn.Marker(center);
              marker.setIcon('/static/point.png')
              $scope.map.addMarker(marker);
              if(loc.points) {
                loc.points.forEach(function(cp) {
                  const llp = new mxn.LatLonPoint(cp[0], cp[1])
                  var curm = new mxn.Marker(llp);
                  zoomPoints.push(llp);
                  curm.setIcon('/static/point.png')
                  $scope.map.addMarker(curm);
                })
              }
              
              $scope.map.outlineCache.makeOutline(center, loc.radius)
              if(zoom && !$scope.pendingLoc) {
                $scope.map.centerAndZoomOnPoints(zoomPoints);
              }
            } else {
              // Re-add in case we've removed all polylines in draw()
              $scope.map.addPolyline($scope.map.outlineCache.outline, true)
            }
          }
          
          if($scope.pendingLoc) {
            $scope.map.resizer.activate($scope.pendingLoc)
          } else {
            $scope.map.resizer.deactivate()
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
        selLocId: '=selLoc',
        pendingLoc: '=',
        uniParams: '<',
      },
      templateUrl: 'trip_list.html',
      link: function(scope, elm, attrs) {
        scope.elm = elm.find('#triplist');
        scope.elm.on('click','li a.trip_segment',function() {
          const trip = $(this).scope().trip
          const interval = scope.uniParams.interval
          scope.$apply(function(scope) {
            scope.viewRange = [
              Math.floor(trip.start/1000/interval),
              Math.ceil(trip.end/1000/interval)
            ]
          })
        });
        scope.elm.on('mouseover','li a.trip_segment',function() {
          const elm = $(this)
          console.log('Highlighting trip from', elm)
          const interval = scope.uniParams.interval
          scope.$apply(function(scope) {
            scope.selRange = [
              Math.floor(elm.data('start')/1000/interval),
              Math.ceil(elm.data('end')/1000/interval)
            ]
          })
        });
        /*
        scope.elm.on('mouseout','li a.trip_segment',function() {
          console.log('Clearing selRange');
          scope.$apply(function(scope) {
            scope.selRange = null
          })
        });
        */
        scope.elm.on('click','li a.trip_stop',function() {
          const stop = $(this).scope().event
          scope.$apply(function(scope) {
            scope.startEditPlace(stop)
          })
        });
        scope.elm.on('submit','li form',function() {
          const stop = $(this).scope().event
          scope.$apply(function(scope) {
            scope.finishEditPlace(stop)
          })
        });
        scope.elm.on('reset','li form',function() {
          const stop = $(this).scope().event
          scope.$apply(function(scope) {
            scope.cancelEditPlace(stop)
          })
        });
        scope.elm.on('mouseover','li a.trip_stop',function() {
          const stop = $(this).scope().event
          console.log('Highlighting stop', stop)
          scope.$apply(function(scope) {
            scope.selLocId = stop.loc
          })
        });
        scope.elm.on('mouseout','li a.trip_stop',function() {
          scope.$apply(function(scope) {
            scope.selLocId = null
          })
        });
      },
      controller: function($scope) {
        $scope.startEditPlace = function(stop) {
          $scope.selLocId = stop.loc
          $scope.pendingLoc = {...$scope.locations[stop.loc]}
          if($scope.pendingLoc.type === "auto") {
            $scope.pendingLoc.type = "place"
          }
          stop.isEditing = true
        }
        $scope.cancelEditPlace = function(stop) {
          $scope.pendingLoc = null;
          stop.isEditing = false
        }
        $scope.finishEditPlace = function(stop) {
          const { id, name, lat, lon, radius, type } = $scope.pendingLoc;
          Location.save({
            id,
            name,
            radius,
            latitude: lat,
            longitude: lon,
            type,
          })
          // TODO: Confirm save first
          $scope.locations[stop.loc] = $scope.pendingLoc;
          $scope.cancelEditPlace(stop)
        }
        $scope.$watch('trips', function(cur, prev, scope) {
          const smallGap = 60*60*1000;
          const minStop = 2*60*1000;
          if(cur) {
            const mergedTrips = []

            console.log(scope)

            function finishTrip(trip) {
              const firstStop = trip.stops[0]
              const events = []
              if(firstStop && firstStop.start !== trip.start && (firstStop.start - trip.start) > smallGap) {
                events.push({
                  type: 'segment',
                  start: trip.start,
                  end: firstStop.start
                })
              }
              for(const [idx, stop] of Object.entries(trip.stops)) {
                if((stop.end - stop.start) < minStop) {
                  console.log("Skipping", idx, stop, trip);
                  continue;
                }
                events.push({
                  ...stop,
                  type: 'stop'
                });
                const nextStop = trip.stops[Number(idx)+1];
                if(nextStop) {
                  events.push({
                    type: 'segment',
                    start: stop.end,
                    end: nextStop.start
                  })
                } else if(stop.end !== trip.end) {
                  events.push({
                    type: 'segment',
                    start: stop.end,
                    end: trip.end,
                  })
                }
              }
              return { ...trip, events }
            }

            let pendingTrip = null;
            for(const trip of cur) {
              if(pendingTrip) {
                const lastStop = pendingTrip.stops.slice(-1)[0]
                const firstStop = trip.stops[0]
                //console.log("merge?", lastStop, firstStop)
                if(lastStop && firstStop && lastStop.loc == firstStop.loc && firstStop.start - lastStop.end < smallGap) {
                  //console.log("merging!")
                  pendingTrip = {
                    ...pendingTrip,
                    end: trip.end,
                    len: trip.end - pendingTrip.start,
                    stops: [
                      ...pendingTrip.stops.slice(0, -1),
                      {
                        ...lastStop,
                        end: firstStop.end
                      },
                      ...trip.stops.slice(1)
                    ]
                  }
                } else {
                  mergedTrips.push(finishTrip(pendingTrip))
                  pendingTrip = trip
                }
              } else {
                pendingTrip = trip
              }
            }
            if(pendingTrip) { mergedTrips.push(finishTrip(pendingTrip)) }
            
            console.log('trips', cur)
            console.log('merged', mergedTrips)
            for(const idx in mergedTrips) {
              const trip = mergedTrips[idx];
              const nextTrip = mergedTrips[Number(idx)+1];
              if(nextTrip) {
                trip.gapAfter = nextTrip.start - trip.end
              }
            }
            scope.mergedTrips = mergedTrips
            //console.log('merged trips', mergedTrips)
          }
        })
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
        selRange: '=',
        selLocId: '=selLoc',
        uniParams: '<',
      },
      templateUrl: 'day_view.html',
      link: function(scope, elm, attrs) {
        // Tried to do this better, failed
        elm.on('mouseover','.bar',function() {
          const stop = $(this).scope().event
          console.log('Highlighting stop', stop)
          scope.$apply(function(scope) {
            scope.selLocId = stop.loc
          })
        });
        elm.on('mouseout','.bar',function() {
          scope.$apply(function(scope) {
            scope.selLocId = null
          })
        });
        elm.on('mouseover','.line',function() {
          const interval = scope.uniParams.interval
          const range = $(this).data('range')
          scope.$apply(function(scope) {
            scope.selRange = [
              Math.floor(Temporal.ZonedDateTime.from(range.$startTime).epochSeconds/interval),
              Math.ceil(Temporal.ZonedDateTime.from(range.$endTime).epochSeconds/interval)
            ]
          })
        });
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
            console.log('trips', cur)
            const dayStops = Object.fromEntries(scope.days.map(d => [d, []]))
            for(const trip of cur) {
              for(const idxs in trip.stops) {
                const idx = Number(idxs)
                const stop = trip.stops[idx]
                const start = makeTime(stop.start);
                const end = makeTime(stop.end);
                const startDate = start.toPlainDate().toString();
                const endDate = end.toPlainDate().toString();
                const annotated = {
                  ...stop,
                  $startTime: start,
                  $endTime: end,
                }
                if(idx === 0) {
                  annotated.before = {
                    $startTime: makeTime(trip.start),
                    $endTime: start
                  }
                }
                if(idx === trip.stops.length-1) {
                  annotated.after = {
                    $startTime: end,
                    $endTime: makeTime(trip.end)
                  }
                } else {
                  annotated.after = {
                    $startTime: end,
                    $endTime: makeTime(trip.stops[idx+1].start)
                  }
                }
                if(startDate !== endDate) {
                  if(dayStops[startDate]) {
                    dayStops[startDate].push({
                      ...annotated,
                      $endTime: start.withPlainTime(lastTime),
                    })
                  }
                  if(dayStops[endDate]) {
                    dayStops[endDate].push({
                      ...annotated,
                      $startTime: end.withPlainTime(zeroTime),
                    })
                  }
                } else {
                  if(dayStops[startDate]) {
                    dayStops[startDate].push(annotated)
                  } else {
                    console.warn("Unexpected missing date", startDate)
                  }
                }
              }
            }
            scope.dayStops = dayStops
            console.log('day stops', dayStops)
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
