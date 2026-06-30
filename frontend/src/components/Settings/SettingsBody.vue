<template>
  <ScrollAreaRoot class="relative min-h-0 flex-1">
    <ScrollAreaViewport class="h-full w-full overflow-auto px-[4.4rem] pb-16">
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
  </ScrollAreaRoot>
</template>

<script setup lang="ts">
import { ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui'
import ScrollBar from '@/components/ScrollBar.vue'
</script>
