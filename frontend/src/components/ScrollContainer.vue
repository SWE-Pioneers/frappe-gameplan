<template>
  <ScrollAreaRoot class="relative block min-h-0 flex-1">
    <ScrollAreaViewport
      class="h-full w-full isolate overflow-auto bg-surface-base"
      id="scrollContainer"
    >
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
  </ScrollAreaRoot>
</template>
<script setup lang="ts">
// Keeps the reka Root/Viewport primitives because the app-wide scroll global
// (window.scrollContainer, utils/scrollContainer.ts) finds this element by its
// id="scrollContainer" — frappe-ui's ScrollArea can't put an id on the viewport.
// Slated for useScrollContainer() in Phase 4; the styled bar is frappe-ui's.
import { ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui'
import { ScrollBar } from 'frappe-ui'
</script>
