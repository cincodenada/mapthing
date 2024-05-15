<script setup lang="ts">
import { ref } from 'vue'
import type Source from '@/models/Source'
import SourceBar from '@/components/SourceBar.vue'

defineProps<{
  sources: Source[]
}>()

const minPerPx = ref(0.5)
</script>

<template>
  <div class="source_view">
    <SourceBar
      v-for="source in sources"
      :key="source.id"
      :source
      :minPerPx
      />
  </div>
</template>

<style>
  .source_bar {
    background: #666;
    height: 1em;
  }
</style>
