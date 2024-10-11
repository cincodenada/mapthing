<script setup lang="ts">
import type Stop from '@/models/Stop'
defineProps<{
  stop: Stop,
}>()
</script>
<template>
  <div class="stop_time">{{stop.start_time}}</div>
  <div class="stop_container place">
      <a href="#" class="trip_stop">
        <span>{{stop.name}}</span>
      </a>
    <span class="stop_latlon">{{stop.location.latitude}}, {{stop.location.longitude}}</span>
  </div>
  <div class="stop_time">{{stop.end_time}}</div>
</template>
<style scoped>
</style>

