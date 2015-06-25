$.widget('cincodenada.timerange',$.ui.slider,{
    options: {
        evtheight: 1.2,
        range: true,
        min: null,
        max: null,
        clickdist: 0.25,
    },

    _create: function() {
        this.element
            .addClass('ui-timerange');

        return this._super();
    },
    refresh: function() { this._refresh(); },
    _refresh: function() {
        this._super();
        this._prepareEvents();
        console.log('Refreshing');
        this._super();
    },
    _slide: function(event, index, newVal) {
        var newValues,
            allowed = true;

        if(this._draggingRange === true) {
            if(newVal !== this._rangeAnchor) {
                diff = newVal - this._rangeAnchor;
                newValues = this.values();
                for(i=0;i<2;i++) {
                    newValues[i] += diff;
                }
                allowed = true;
                for(i=0;i<2;i++) {
                    thisAllowed = this._trigger( "slide", event, {
                        handle: this.handles[ i ],
                        value: newValues[i],
                        values: newValues
                    } );
                    allowed = allowed && thisAllowed;
                }
                if ( allowed !== false ) {
                    this.values(newValues);
                }
                this._rangeAnchor = newVal;
            }
            return;
        } else if(this._newSel === true) {
            diff = newVal - this.values(0);
            if(Math.abs(diff) > this._clickDistNorm()) {
                if(diff < 0) {
                    index = this._handleIndex = 0;
                } else {
                    index = this._handleIndex = 1;
                }
                this._trigger( "start", event, {
                    handle: this.handles[ index ],
                    value: this.value(index),
                    values: this.values(),
                })
                //We're done starting the selection
                this._newSel = false;
            }
        }
        return this._super(event, index, newVal);
    },
    _normValueFromPx: function(pixels) {
        valueTotal = this._valueMax() - this._valueMin();
		if ( this.orientation === "horizontal" ) {
			pixelTotal = this.element.outerWidth();
		} else {
			pixelTotal = this.element.outerHeight();
		}
        
        return pixels*(valueTotal/pixelTotal);
    },
    _pxFromNormValue: function(val) {
        valueTotal = this._valueMax() - this._valueMin();
		if ( this.orientation === "horizontal" ) {
			pixelTotal = this.element.outerWidth();
		} else {
			pixelTotal = this.element.outerHeight();
		}
        
        return val*(pixelTotal/valueTotal);
    },
    _pctFromNormValue: function(val, absolute) {
        if(absolute) {
            return val/(this._valueMax() - this._valueMin())*100;
        } else {
            return (val-this._valueMin())/(this._valueMax() - this._valueMin())*100;
        }
    },
    _start: function(event, index) {
		position = { x: event.pageX, y: event.pageY };
		normValue = this._normValueFromMouse( position );
        if(this.handles.length == 2 && this.options.range === true && 
            //Move the range by clicking on it
            this.values(0) < normValue && normValue < this.values(1) &&
            !this.handles.hasClass( "ui-state-hover" )) {

            this._rangeAnchor = normValue;
            this._draggingRange = true;

            return this._trigger( "start", event, {value: this.value()});
        } else {
            this._draggingRange = false;
            //Check for new selection creation
            distance = Math.abs(this.values(index) - normValue);
            if(distance > this._clickDistNorm()) {
                //Start a new selection
                this.options.values = [ normValue, normValue ];
                this._newSel = true;
                return;
            }
        }

        return this._super(event, index);

    },
    _clickDistNorm: function() {
        return (this.options.clickdist < 1)
            ? Math.abs(this.values(1) - this.values(0)) * this.options.clickdist
            : this.options.clickdist;
    },
    _prepareEvents: function() {
        var slider = this;
        var min = this.options.min, max = this.options.max;

        this.events = this.element.find('li');
        this.events.addClass('ui-timerange-event ui-widget-header');

        this.events.each(function(idx) {
            var start, end, length;
            $evt = $(this);

            start = moment($evt.data('start'));
            if($evt.data('end')) {
                end = moment($evt.data('end'));
                if(end < start) {
                    temp = start;
                    start = end;
                    end = temp;
                }
                length = moment.duration(end - start);
            } else if(lenstr = $evt.data('length')) {
                if(lenstr.indexOf(' ') > -1) {
                    parts = lenstr.split(' ',2);
                    length = moment.duration(parseInt(parts[0]), parts[1]);
                } else {
                    length = moment.duration($evt.data('length'));
                }
                end = moment(start).add(length);
            }
            if(start < min || min === null) { min = start; }
            if(end > max || max === null) { max = end; }

            $evt.data('_start',start);
            $evt.data('_end',end);
            $evt.data('_length',length);

            $evt.find('a').attr('title',$evt.text()).text('&nbsp;');

            console.log("New event: " + start + " to " + end + " (" + length.humanize() + ")");
        });

        this.events.sortElements(function(a,b) {
            return $(a).data('_start') - $(b).data('_start');
        });

        //Separate into rows
        var evtrows = [];
        var $lastevt;
        this.events.each(function(idx) {
            $evt = $(this);
            currow = 0;
            placed = false;
            while(!placed) {
                if(!evtrows[currow]) { evtrows[currow] = []; }
                $lastevt = $(evtrows[currow].slice(-1)[0]);
                if($lastevt.length && $evt.data('_start') < $lastevt.data('_end')) {
                    currow++;
                } else {
                    evtrows[currow].push(this);
                    $evt.data('_row', currow);
                    placed = true;
                }
            }
        });

        /*
        this.events.sortElements(function(a,b) {
            if($(a).data('_row') == $(b).data('_row')) {
                return $(a).data('_start') - $(b).data('_start');
            } else {
                return $(a).data('_row') - $(b).data('_row');
            }
        });
        */

        if(min) { this.options.min = min/1000 }
        if(max) { this.options.max = max/1000 }

        this.element.css('height',evtrows.length*this.options.evtheight + 'em')
        
        var $lastevt = $();
        this.events.each(function(idx) {
            $evt = $(this);
            pctNorm = $.proxy(slider._pctFromNormValue, slider);
            console.log(pctNorm($evt.data('_length')/1000)+0);
            $evt.css('width',pctNorm($evt.data('_length')/1000, true) + '%');
            $evt.css('left',pctNorm($evt.data('_start')/1000) + '%');
            $evt.css('top',$evt.data('_row')*slider.options.evtheight + 'em');
            $lastevt = $evt;
        });

    }
});

/**
 * jQuery.fn.sortElements
 * --------------
 * @param Function comparator:
 *   Exactly the same behaviour as [1,2,3].sort(comparator)
 *   
 * @param Function getSortable
 *   A function that should return the element that is
 *   to be sorted. The comparator will run on the
 *   current collection, but you may want the actual
 *   resulting sort to occur on a parent or another
 *   associated element.
 *   
 *   E.g. $('td').sortElements(comparator, function(){
 *      return this.parentNode; 
 *   })
 *   
 *   The <td>'s parent (<tr>) will be sorted instead
 *   of the <td> itself.
 */
jQuery.fn.sortElements = (function(){
 
    var sort = [].sort;
 
    return function(comparator, getSortable) {
 
        getSortable = getSortable || function(){return this;};
 
        var placements = this.map(function(){
 
            var sortElement = getSortable.call(this),
                parentNode = sortElement.parentNode,
 
                // Since the element itself will change position, we have
                // to have some way of storing its original position in
                // the DOM. The easiest way is to have a 'flag' node:
                nextSibling = parentNode.insertBefore(
                    document.createTextNode(''),
                    sortElement.nextSibling
                );
 
            return function() {
 
                if (parentNode === this) {
                    throw new Error(
                        "You can't sort elements if any one is a descendant of another."
                    );
                }
 
                // Insert before flag:
                parentNode.insertBefore(this, nextSibling);
                // Remove flag:
                parentNode.removeChild(nextSibling);
 
            };
 
        });
 
        return sort.call(this, comparator).each(function(i){
            placements[i].call(getSortable.call(this));
        });
 
    };
 
})();
