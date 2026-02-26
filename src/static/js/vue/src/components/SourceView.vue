<script setup lang="ts">
import { ref, computed } from 'vue'
import type Source from '@/models/Source'
import SourceBar from '@/components/SourceBar.vue'

const props = defineProps<{
  sources: Source[]
}>()

const minPerPx = ref(10)

const sourcePositions = computed(() => {
  const rowEnds = [];
  const rowAssignments = [];
  for(const source of props.sources) {
    const rowWithRoom = rowEnds.findIndex((end, idx) => source.start >= end)
    if(rowWithRoom > -1) {
      rowAssignments.push(rowWithRoom)
      rowEnds[rowWithRoom] = source.end
    } else {
      rowAssignments.push(rowEnds.length)
      rowEnds.push(source.end)
    }
  }
  return rowAssignments
})

const offset = computed(() => Math.min(...props.sources.map(s => s.start)))
</script>

<template>
  <div class="source_view">
    <SourceBar
      v-for="(source, idx) in sources"
      :key="source.id"
      :source
      :row="sourcePositions[idx]"
      :offset
      :minPerPx
      />
  </div>
</template>

<style>
  .source_bar {
    background: #666;
    height: 1em;
    position: absolute;
    border: 1px dotted white;
  }
</style>
