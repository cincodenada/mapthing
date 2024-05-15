<script setup lang="ts">
import { ref } from 'vue'
import type Source from '@/models/Source'

const { source, minPerPx } = defineProps<{
  source: Source,
  minPerPx: number,
}>()

const style = ref({
  width: (source.end - source.start)/60/minPerPx + 'px',
})
</script>

<template>
  <div class="source_bar" :style>
    
  </div>
</template>
