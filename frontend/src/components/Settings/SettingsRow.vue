<template>
  <div class="flex min-h-[41px] items-center gap-8">
    <div class="min-w-0 flex-1">
      <div class="text-base-medium text-ink-gray-8">{{ title }}</div>
      <div v-if="description" class="mt-1 text-base leading-5 text-ink-gray-6">
        {{ description }}
      </div>
    </div>
    <div class="flex shrink-0 items-start justify-end">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>
