<template>
  <Teleport defer :to="targetSelector">
    <div class="flex items-center gap-2">
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    placement?: 'title' | 'actions'
  }>(),
  {
    placement: 'actions',
  },
)

const targetSelector = computed(() => {
  return props.placement === 'title'
    ? '[data-space-header-title-actions]'
    : '[data-space-header-actions]'
})
</script>
