<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import { Button } from 'frappe-ui'
import { EditorFixedMenu } from 'frappe-ui/editor'
import GPEditor from './GPEditor.vue'
import QuoteReplyButton from '@/components/RichQuoteExtension/QuoteReplyButton.vue'
import { injectQuoteBacklinks } from '@/components/RichQuoteExtension/useQuoteBacklinks'
import { quoteBacklinksPluginKey } from '@/components/RichQuoteExtension/quote-backlink-decoration'
import { gameplanToolbar } from './toolbars'
import { commentExtensions } from './commentExtensions'

// gameplan's comment box: the lighter CommentKit (no table / toc / slash / iframe)
// + @-mentions + #-tags + RichQuote. The shared `gameplanToolbar` self-prunes to
// the comment-available buttons (spec §5), so it needs no separate curation.
const props = withDefaults(
  defineProps<{
    value?: string
    placeholder?: string | null
    editable?: boolean
    submitButtonProps?: Record<string, any>
    discardButtonProps?: Record<string, any>
    // 'comment:<id>' | 'discussion:<id>' — enables "quoted by" badges on this
    // document when it's rendered inside a discussion
    quoteSourceId?: string
  }>(),
  { value: '', placeholder: null, editable: true },
)

const emit = defineEmits<{
  change: [value: string]
  'rich-quote': [payload: { html: string; occurrence: number }]
  'rich-quote-click': [
    payload: { quoteId: string; author: string; content: string; occurrence: number },
  ]
}>()

const backlinksStore = injectQuoteBacklinks()
const sourceId = props.quoteSourceId

const extensions = commentExtensions({
  onQuoteClick: (payload) => emit('rich-quote-click', payload),
  backlinks:
    backlinksStore && sourceId
      ? {
          getBacklinks: () => backlinksStore.getFor(sourceId),
          onBacklinkClick: ({ anchorEl, items }) => backlinksStore.openPopover(anchorEl, items),
        }
      : undefined,
})

const gp = useTemplateRef<InstanceType<typeof GPEditor>>('gp')
const editor = computed(() => gp.value?.editor ?? null)

if (backlinksStore && sourceId) {
  // extension options aren't reactive — nudge the decoration plugin whenever
  // the backlinks for this document or the editable state change
  watch(
    [() => backlinksStore.getFor(sourceId), () => props.editable, editor],
    () => {
      const e = editor.value
      if (!e) return
      e.view.dispatch(e.state.tr.setMeta(quoteBacklinksPluginKey, 'refresh'))
    },
    { flush: 'post' },
  )
}

defineExpose({ editor })
</script>

<template>
  <GPEditor
    ref="gp"
    :extensions="extensions"
    :content="value"
    :placeholder="placeholder ?? undefined"
    :editable="editable"
    :editor-class="['prose-v3 max-w-none', editable && 'min-h-[4rem]']"
    :max-height="editable ? '50vh' : undefined"
    @change="editable ? emit('change', $event) : null"
  >
    <template v-if="!editable" #top="{ editor: e }">
      <QuoteReplyButton v-if="e" :editor="e" @quote="emit('rich-quote', $event)" />
    </template>
    <template v-if="editable" #bottom="{ editor: e }">
      <div class="mt-2 flex flex-col justify-between sm:flex-row sm:items-center">
        <EditorFixedMenu :editor="e" :items="gameplanToolbar" class="-ml-1 overflow-x-auto" />
        <div class="mt-2 flex items-center justify-end space-x-2 sm:mt-0">
          <Button v-bind="discardButtonProps || {}"> Discard </Button>
          <Button variant="solid" v-bind="submitButtonProps || {}"> Submit </Button>
        </div>
      </div>
    </template>
  </GPEditor>
</template>
