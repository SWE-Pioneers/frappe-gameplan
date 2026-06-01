<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import GPEditor from './GPEditor.vue'
import { richTextExtensions } from './richTextExtensions'

// gameplan's discussion-compose editor (GP Discussion bodies): the rich stack with
// @-mentions / #-tags enabled. The composing page (NewDiscussion) supplies its own
// title, header, metadata and sticky toolbar through the forwarded #editor slot, so
// this wrapper bakes only the extension config and re-exposes the editor instance.
withDefaults(
  defineProps<{
    content?: string | null
    placeholder?: string
    editable?: boolean
    editorClass?: unknown
  }>(),
  { editable: true },
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
    :editor-class="editorClass"
    @change="emit('change', $event)"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  >
    <template v-if="$slots.top" #top="slotProps">
      <slot name="top" v-bind="slotProps" />
    </template>
    <template v-if="$slots.editor" #editor="slotProps">
      <slot name="editor" v-bind="slotProps" />
    </template>
    <template v-if="$slots.bottom" #bottom="slotProps">
      <slot name="bottom" v-bind="slotProps" />
    </template>
  </GPEditor>
</template>
