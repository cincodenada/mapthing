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
});

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

    for(segid in point_data.points) {
        segdata = point_data.segments[segid];
        for(idx in point_data.points[segid]) {
            curtime = point_data.points[segid][idx].time/1000;
            if((mintime && (curtime < mintime))
                || (maxtime && (curtime > maxtime))
            ) { continue; }

            xpos = (curtime-mintime)/(maxtime-mintime)*canvas.width;
            dc.fillRect(xpos,0,1,canvas.height);
        }
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

    for(segid in point_data.points) {
        segdata = point_data.segments[segid];
        last_color = false;
        curseg = Array();

        for(idx in point_data.points[segid]) {
            //console.log([mintime, maxtime, point_data.points[segid][idx].time]);
            curtime = point_data.points[segid][idx].time/1000;
            //console.log(curtime);
            //console.log((curtime > maxtime));
            if((mintime && (curtime < mintime))
                || (maxtime && (curtime > maxtime))
            ) { continue; }

            curpoint = point_data.points[segid][idx];
            if(last_color && curpoint.color != last_color) {
                //Add the current point so they're connected
                points.push(new mxn.LatLonPoint(point_data.points[segid][idx].lat, point_data.points[segid][idx].lon)) 
                newline = new mxn.Polyline(points);
                newline.setColor(last_color);
                newline.setWidth('4');
                curseg.push(newline);
                points = [];
            }
            last_color = curpoint.color;
            points.push(new mxn.LatLonPoint(point_data.points[segid][idx].lat, point_data.points[segid][idx].lon)) 
        }
        if(points.length) {
            points.push(new mxn.LatLonPoint(point_data.points[segid][idx].lat, point_data.points[segid][idx].lon)) 
            newline = new mxn.Polyline(points);
            newline.setColor(last_color);
            newline.setWidth('4');
            curseg.push(newline);
            points = [];
        }
        if(curseg.length) { seglist[segid] = curseg; }
    }
    map.removeAllPolylines();
    for(segid in seglist) {
        for(subseg in seglist[segid]) {
            map.addPolyline(seglist[segid][subseg]);
        }
    }
}
