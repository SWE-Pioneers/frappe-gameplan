<template>
  <div class="grid place-items-center">
    <div
      class="h-3 w-3 rounded-full"
      :class="{
        'bg-surface-red-7': priority === 'High',
        'bg-surface-amber-3': priority === 'Medium',
        'bg-surface-gray-8': priority === 'Low',
      }"
    ></div>
  </div>
</template>
<script>
export default {
  name: 'TaskPriorityIcon',
  props: {
    priority: {
      type: String,
      required: true,
    },
  },
}
</script>
