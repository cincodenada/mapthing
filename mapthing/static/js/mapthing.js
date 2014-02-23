var seglist = {};
var map = new mxn.Mapstraction('map', 'googlev3'); 
var canvas, dc;
$(function() {
    /*
    tm = TimeMap.init({
        mapId: "map",               // Id of map div element (required)
        timelineId: "timeline",     // Id of timeline div element (required)
        options: {},
        datasets: [],
    });
    */
    canvas = document.getElementById('sel_view').firstElementChild;
    canvas.width = $(canvas).innerWidth();
    canvas.height = $(canvas).innerHeight();
    dc = canvas.getContext('2d');

    map.enableScrollWheelZoom();
    map.addControls({
        scale:true,
        map_type:true,
    });
    //show_points();
    $.get('/tracks.json/' + params.start + '/' + params.end, function(data) {
        bounds = make_tracklist(data);
        map.setBounds(bounds);

        $('#seg_list').timerange({
            change: function(evt, ui) {
                $('#sel_view').timerange({
                    min: ui.values[0],
                    max: ui.values[1],
                    change: function(evt, ui) {
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
        $.each(seglist[segid], function(idx, seg) {
            seg.oldcolor = seg.color;
            seg.setColor('#0000FF');
            seg.setWidth('6');
            seg.update();
        })
    });
    $('#seg_list').on('mouseout','li a',function() {
        segid = $(this).data('segid');
        $.each(seglist[segid], function(idx, seg) {
            seg.setColor(seg.oldcolor);
            seg.setWidth('4');
            seg.update();
        })
    });
    $('#controls').on('click','button',function(evt, ui) {
        doAction($(this).data('action'),$(this).data('value'));
    });
});

function doAction(action, value) {
    switch(action) {
        case "step":

    }
}
function start_anim() {
    anim_state = {
        start: $('#sel_view').timerange('option','min'),
        end: $('#sel_view').timerange('option','max'),
        curpoint: 0,
    }
    anim_state.curpoint = 0;
    update_anim();
}
function update_anim() {

}

function update_selview(timerange) {
    starttime = moment(timerange[0],'X');
    endtime = moment(timerange[1],'X');
    $('#full_timerange').text(
        starttime.format('MMM D, YYYY H:mm') 
        + ' - ' +
        endtime.format('MMM D, YYYY H:mm') 
    );
    $.get('/points.json/' + starttime.format('YYYY-MM-DD HH:mm:ss') + '/' + endtime.format('YYYY-MM-DD HH:mm:ss'), function(data) {
        point_data = data;
        draw_selview(timerange);
    }, 'json');
}

function update_mapview(timerange) {
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
    draw_mapview(timerange);
    map.polylineCenterAndZoom();
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
    dc.clearRect(0,0,canvas.width,canvas.height);

    for(idx in point_data.timepoints) {
        curtime = point_data.points[segid][idx].time/1000;
        if((mintime && (curtime < mintime))
            || (maxtime && (curtime > maxtime))
        ) { continue; }

        xpos = (curtime-mintime)/(maxtime-mintime)*canvas.width;
        dc.fillRect(xpos,0,1,canvas.height);
    }
}

function draw_mapview(timerange) {
    var points = Array();
    var curseg;
    var mintime = false, maxtime = false;
    if(timerange) {
        mintime = timerange[0];
        maxtime = timerange[1];
    }
    seglist = {};
    newpolys = [];

    for(idx in point_data.timepoints) {
        curpoint = point_data.points[idx];
        curtime = curpoint.time/1000;
        if((mintime && (curtime < mintime))
            || (maxtime && (curtime > maxtime))
        ) { continue; }

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
