<script setup lang="ts">
import type Stop from '@/models/Stop'
import { Temporal } from 'temporal-polyfill'

defineProps<{
  stop: Stop,
}>()

const formatter = new Intl.DateTimeFormat("en-us", {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});

function humanize(date) {
  const ts = Temporal.PlainDateTime.from(date).toZonedDateTime(Temporal.Now.timeZoneId()).epochMilliseconds;
  const parts = formatter.formatToParts(ts);
  return [parts[4], parts[1], ...parts.slice(0,3), {value: ' '}, ...parts.slice(6)].map(p => p.value).join('')
}


</script>
<template>
<div :data-start="stop.start_time" :data-end="stop.end_time">
  <div class="stop_time">{{humanize(stop.start_time)}}</div>
  <div class="stop_container place">
      <a href="#" class="trip_stop">
        <span>{{stop.name}}</span>
      </a>
    <span class="stop_latlon">{{stop.location.latitude}}, {{stop.location.longitude}}</span>
  </div>
  <div class="stop_time">{{humanize(stop.end_time)}}</div>
</div>
</template>
<style>
.stop_time, .stop_latlon {
    font-size: 80%;
    color: darkgray;
    line-height: 2;
}

.stop_latlon {
    padding-left: 2px;
}
</style>

