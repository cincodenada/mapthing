var seglist = {};
var uni_list, uni_missing, uni_interp;
var map;
var selview, dc;
var curbounds;

var point_data;
var anim_state = {
    trailpoint: 0,
    curpoint: 0,
    stopped: true,
}
var anim_opts = {};
var play_scrubber;
$(function() {
    /*
    tm = TimeMap.init({
        mapId: "map",               // Id of map div element (required)
        timelineId: "timeline",     // Id of timeline div element (required)
        options: {},
        datasets: [],
    });
    */
    map = new mxn.Mapstraction('map', 'googlev3')

    play_scrubber = $('#play_pos').slider({
        slide: function(evt, ui) {
            update_anim(ui.value);
        }
    });

    selview = document.getElementById('sel_view').firstElementChild;
    selview.width = $(selview).innerWidth();
    selview.height = $(selview).innerHeight();
    dc = selview.getContext('2d');

    map.enableScrollWheelZoom();
    map.addControls({
        scale:true,
        map_type:true,
    });
    //show_points();
    $.get('/tracks.json/', {'start': params.start, 'end': params.end}, function(data) {
        bounds = make_tracklist(data);
        map.setBounds(bounds);

        $('#seg_list').timerange({
            change: function(evt, ui) {
                $('#sel_view').timerange({
                    min: ui.values[0],
                    max: ui.values[1],
                    change: function(evt, ui) {
                        init_anim();
                        update_mapview(ui.values);
                    }
                });
                update_selview(ui.values);
            },
        });
    }, 'json')
    //map.polylineCenterAndZoom();

    $('#seg_list').on('mouseover','li a',function() {
        segid = $(this).data('segid');
        if(seglist[segid]) {
            $.each(seglist[segid], function(idx, seg) {
                seg.oldcolor = seg.color;
                seg.setColor('#0000FF');
                seg.setWidth('6');
                seg.update();
            })
        }
    });
    $('#seg_list').on('mouseout','li a',function() {
        segid = $(this).data('segid');
        if(seglist[segid]) {
            $.each(seglist[segid], function(idx, seg) {
                seg.setColor(seg.oldcolor);
                seg.setWidth('4');
                seg.update();
            })
        }
    });
    $('#anim_controls').on('click','button',function(evt, ui) {
        doAction($(this).data('action'),$(this).data('value'));
    });
    $('#anim_options').on('keyup','input',function(evt, ui) {
        $ao = $(evt.delegateTarget);
        if(to = $ao.data('to')) { clearTimeout(to); }
        $ao.data('to', setTimeout(update_anim_opts, 500))
    });

    $('#getarea').on('click',function() {
        bounds = map.getBounds();
        $.get('/points.json/', {
            'ne': [bounds.ne.lat,bounds.ne.lon].join(','),
            'sw': [bounds.sw.lat,bounds.sw.lon].join(','),
        }, function(data) {
            point_data = data;
            draw_mapview();
        }, 'json');

    });

    $('#triplist').on('mouseover', 'li', function(evt) {
        elm = $(this);
        update_mapview([elm.data('start'), elm.data('end')]);
        evt.stopPropagation();
        evt.preventDefault();
    });
});

function doAction(action, value) {
    if(action == "pausestop") {
        action = anim_state.timeout ? 'pause' : 'stop';
    }
    switch(action) {
        case "rewind":
        case "play":
            anim_state.direction = (action == 'rewind' ? -1 : 1)
            if(anim_state.stopped) {
                start_anim();
            } else {
                //If we're not actively playing, kick it off again
                if(!anim_state.timeout) { update_anim(); }
            }
            break;
        case "stop":
            anim_state.stopped = true;
        case "pause":
            while(to = anim_state.timeout) {
                clearTimeout(to);
                anim_state.timeout = null;
            }
            break;
        case "step":
            break;
    }
}
function init_anim() {
    selrange = $('#sel_view').timerange('values');
    anim_state.start = selrange[0];
    anim_state.end = selrange[1];
    anim_state.curtime = anim_state.start;
    anim_state.bounds = map.getBounds();

    play_scrubber.slider('option','min',anim_state.start);
    play_scrubber.slider('option','max',anim_state.end);

    update_anim_opts();
    anim_state.direction = 1;
}
function start_anim() {
    init_anim();

    anim_state.stopped = false;
    update_anim();
}
function update_anim_opts() {
    $('#anim_options').find('input').each(function() {
        anim_opts[$(this).data('param')] = $(this).val();
    });
    anim_opts.spf = 1/anim_opts.fps;
    anim_opts.real_spf = anim_opts.spf * anim_opts.speedup;
}
function update_anim(scrubtime) {
    if(scrubtime) {
        anim_state.curtime = scrubtime;
    } else {
        anim_state.curtime += anim_opts.real_spf*anim_state.direction;
    }

    if(anim_state.curtime > anim_state.end) {
        anim_state.curtime = anim_state.start;
    } else if(anim_state.curtime < anim_state.start) {
        anim_state.curtime = anim_state.end;
    }
    trailpoint = anim_state.curtime - anim_opts.traillen*anim_state.direction;


    timeframe = (anim_state.direction < 0)
    ? [anim_state.curtime, trailpoint] 
    : [trailpoint, anim_state.curtime]
    update_mapview(timeframe, true);
    if(curbounds && !curbounds.isEmpty()) {
        min_area = 3e-6;
        max_unused = 5;
        cur_area = curbounds.getArea();
        if(anim_state.bounds.contains(curbounds)) {
            //If we're > 50% unused space, shrink things down
            if(anim_state.bounds.getArea() > cur_area*max_unused) {
                if(cur_area < min_area) {
                    curbounds.zoom(Math.sqrt(min_area/cur_area));
                }
                anim_state.bounds = curbounds;
                map.setBounds(curbounds);
            }
        } else {
            anim_state.bounds.extend(curbounds.ne);
            anim_state.bounds.extend(curbounds.sw);
            map.setBounds(anim_state.bounds);
        }
    }

    if(!scrubtime) {
        play_scrubber.slider('option','value',anim_state.curtime);
        anim_state.timeout = setTimeout(update_anim, anim_opts.spf*1000);
    }
}

function update_selview(timerange) {
    starttime = moment(timerange[0],'X');
    endtime = moment(timerange[1],'X');
    $('#full_timerange').text(
        starttime.format('MMM D, YYYY H:mm')
        + ' - ' +
        endtime.format('MMM D, YYYY H:mm')
    );
    $.get('/points.json/', {start: starttime.format('YYYY-MM-DD HH:mm:ss'), end: endtime.format('YYYY-MM-DD HH:mm:ss')}, function(data) {
        point_data = data;
        draw_selview(timerange);
        update_trips();
    }, 'json');
}

function update_trips() {
    triplist = $('#triplist');
    triplist.empty();
    for(i in point_data.trips) {
        curtrip = point_data.trips[i];
        nummin = (curtrip.end - curtrip.start)/1000/60;
        nummin = Math.round(nummin*10)/10;
        newli = $('<li><a href="#">Trip ' + i + ' (' + nummin + ' min)</a></li>');
        newli.data('start', curtrip.start/1000);
        newli.data('end', curtrip.end/1000);
        triplist.append(newli);
    }
}

function update_mapview(timerange, is_anim) {
    starttime = moment(timerange[0],'X');
    endtime = moment(timerange[1],'X');
    length = moment.duration(starttime.diff(endtime));
    $('#sel_timerange').text(
        length.humanize()
        + ' starting on ' +
        starttime.format('ddd MMM D, YYYY')
        + ' at ' +
        starttime.format('H:mm')
    );
    draw_mapview(timerange, is_anim);
    if(!is_anim) { map.polylineCenterAndZoom(); }
}

function make_seglist() {
    $('#seg_list').empty();
    for(segid in json_points) {
        starttime = moment(segments[segid].start_time/1000,'X');
        endtime = moment(segments[segid].end_time/1000,'X');
        newli = $('<li></li>');
        newli.append('<a href="#" data-segid="' + segid + '">' + tracks[segments[segid].track_id].name + ' (' + segid + ') (' + starttime.format('YYYY/MM/DD h:mm') + '-' + endtime.format('YYYY/MM/DD h:mm') + ')</a>');
        newli.attr('data-start',starttime.format());
        newli.attr('data-end',endtime.format());
        $('#seg_list').append(newli);
    }
}

function make_tracklist(tracklist) {
    bounds = new mxn.BoundingBox();
    $('#seg_list').empty();
    for(idx in tracklist) {
        trackdata = tracklist[idx];
        //Parse our dates
        starttime = moment(trackdata.start/1000,'X');
        endtime = moment(trackdata.end/1000,'X');

        //Extend bounds
        bounds.extend({lat: trackdata.minlat, lon: trackdata.minlon});
        bounds.extend({lat: trackdata.maxlat, lon: trackdata.maxlon});

        //Add the list item
        newli = $('<li></li>');
        newli.append('<a href="#" data-trackid="' + trackdata.id + '"> (' + trackdata.id + ') (' + starttime.format('YYYY/MM/DD h:mm') + '-' + endtime.format('YYYY/MM/DD h:mm') + ')</a>');
        newli.attr('data-start',starttime.format());
        newli.attr('data-end',endtime.format());
        $('#seg_list').append(newli);
    }

    return bounds;
}

function draw_selview(timerange) {
    if(timerange) {
        mintime = timerange[0];
        maxtime = timerange[1];
    } else {
        return false;
    }

    dc.fillStyle = "rgba(0,0,0,0.2)";
    dc.clearRect(0,0,selview.width,selview.height);

    for(idx in point_data.timepoints) {
        curtime = point_data.timepoints[idx].time/1000;
        if((mintime && (curtime < mintime))
            || (maxtime && (curtime > maxtime))
        ) { continue; }

        xpos = (curtime-mintime)/(maxtime-mintime)*selview.width;
        dc.fillRect(xpos,0,1,selview.height);
    }
}

function draw_uniview() {
    var start, end;
    for(var i in uni_list) { start = i; break; }
    end = uni_list.length;

    var uniview = document.getElementById('uni_view').firstElementChild;
    uniview.width = $(uniview).innerWidth();
    uniview.height = 1;
    var uvdc = uniview.getContext('2d');


    var scalefact = uniview.width/(end-start);
    uvdc.fillStyle = "rgb(255,0,0)";
    for(var r in uni_missing) {
        var range = uni_missing[r];
        uvdc.fillRect(
            (range[0]-start)*scalefact,0,
            (range[1]-start+1)*scalefact,1
        );
    }
    uvdc.fillStyle = "rgb(255,255,0)";
    for(var r in uni_interp) {
        var range = uni_interp[r];
        uvdc.fillRect(
            (range[0]-start+1)*scalefact,0,
            (range[1]-start-1)*scalefact,1
        );
    }
}

function draw_mapview(timerange, is_anim) {
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

    if(is_anim) { draw_uniview(); }
}
