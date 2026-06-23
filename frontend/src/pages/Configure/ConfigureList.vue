<template>
  <div class="mt-3 divide-y">
    <div :class="headerClass">
      <slot name="header" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  headerClass: string
}>()
</script>
