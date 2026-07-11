<template>
  <FormControl
    :label="__('Project Name')"
    :placeholder="__('Product Launch')"
    @update:modelValue="(project) => $emit('update:modelValue', { ...modelValue, project })"
    v-model="modelValue.project"
  />
</template>
<script>
export default {
  name: 'OnboardingStepProject',
  props: ['modelValue'],
  emits: ['update:modelValue'],
}
</script>
