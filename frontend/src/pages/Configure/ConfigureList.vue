<template>
  <div class="divide-y">
    <div v-if="$slots.header" :class="headerClass">
      <slot name="header" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  headerClass?: string
}>()
</script>
