<script setup lang="ts">
import { computed } from 'vue'
import type Source from '@/models/Source'

const props = defineProps<{
  source: Source,
  row: number,
  offset: number,
  minPerPx: number,
}>()

const style = computed(() => {
  const { row, source, offset, minPerPx } = props;
  console.log(row, source, offset)
  console.log(props)
  return {
    top: row + 'em',
    left: (source.start - offset)/1000/60/minPerPx + 'px',
    width: (source.end - source.start)/1000/60/minPerPx + 'px',
  }
})
</script>

<template>
  <div class="source_bar" :style :title="source.name">
    
  </div>
</template>
