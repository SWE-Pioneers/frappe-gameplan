<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import GPEditor from './GPEditor.vue'
import { gameplanToolbar, gameplanFloatingToolbar } from './toolbars'
import { richTextExtensions } from './richTextExtensions'

// gameplan's task description editor (GP Task): a rich body with bubble-menu
// formatting plus the floating block menu ("+") on empty lines, and @-mentions /
// #-tags enabled. TaskDetail saves on blur via the exposed `editor`.
withDefaults(
  defineProps<{
    content?: string | null
    placeholder?: string
    editable?: boolean
    autofocus?: boolean
    editorClass?: unknown
  }>(),
  { editable: true, autofocus: false },
)

const emit = defineEmits<{
  change: [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const extensions = richTextExtensions()

const gp = useTemplateRef<InstanceType<typeof GPEditor>>('gp')
const editor = computed(() => gp.value?.editor ?? null)
defineExpose({ editor })
</script>

<template>
  <GPEditor
    ref="gp"
    :extensions="extensions"
    :content="content"
    :placeholder="placeholder"
    :editable="editable"
    :autofocus="autofocus"
    :editor-class="editorClass"
    :bubble-menu="gameplanToolbar"
    :floating-menu="gameplanFloatingToolbar"
    @change="emit('change', $event)"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  />
</template>
