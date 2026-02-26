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
    //map = new mxn.Mapstraction('map', 'openlayers')

    //show_points();
    /*
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
    */
	/*

    $('#getarea').on('click',function() {
        bounds = map.getBounds();
        $.get('/points.json', {
            'ne': [bounds.ne.lat,bounds.ne.lon].join(','),
            'sw': [bounds.sw.lat,bounds.sw.lon].join(','),
        }, function(data) {
            point_data = data;
            draw_mapview();
        }, 'json');

    });
    */

    $('#triplist').on('mouseover', 'li', function(evt) {
        elm = $(this);
        update_mapview([elm.data('start'), elm.data('end')]);
        evt.stopPropagation();
        evt.preventDefault();
    });
});

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

function update_selview(timerange) {
    starttime = moment(timerange[0],'X');
    endtime = moment(timerange[1],'X');
    $('#full_timerange').text(
        starttime.format('MMM D, YYYY H:mm')
        + ' - ' +
        endtime.format('MMM D, YYYY H:mm')
    );
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
}
