import type { Component } from 'vue'
import type { AnyExtension } from '@tiptap/core'
import { useFileUpload } from 'frappe-ui'
import type { MediaUploadRequestOptions, UploadedFile } from 'frappe-ui/editor'
import RichQuoteNodeExtension from '@/components/RichQuoteExtension/rich-quote-node-extension'
import QuoteBacklinkDecoration, {
  type QuoteBacklinkDecorationOptions,
} from '@/components/RichQuoteExtension/quote-backlink-decoration'
import TextEditorMentionComponent from '@/components/TextEditorMentionComponent.vue'
import { activeUsers } from '@/data/users'
import { tags as tagList } from '@/data/tags'

// @-mention items: gameplan users plus an "Everyone" entry. The mention node stores
// `id`/`label`; the suggestion command maps value→id, so we provide all three.
function mentionItems() {
  return [{ id: '_everyone_', label: 'Everyone', value: '_everyone_' }].concat(
    activeUsers.value.map((user) => ({
      id: user.name,
      label: user.full_name.trimEnd(),
      value: user.name,
    })),
  )
}

function tagItems() {
  return (tagList.data ?? []).map((tag) => ({ id: tag.name, label: tag.label }))
}

/**
 * gameplan drops H1 everywhere — kits are configured with these heading levels.
 * Kept here (kit-free) so both extension stacks share one source of truth.
 */
export const gameplanHeadingLevels = [2, 3, 4, 5, 6] as const

/**
 * Kit-member config for @-mentions + #-tags, applied via `kit.configure(...)`
 * (spec §3 — data-driven members configured, never proxied through props). Passing
 * getters keeps the live user/tag lists reactive. `suggestions: false` keeps the
 * nodes (so existing mentions/tags still render) but disables the live popups —
 * used by Pages, which never had them.
 */
export function suggestionConfig(suggestions = true) {
  return {
    mention: {
      items: suggestions ? mentionItems : null,
      component: TextEditorMentionComponent as Component,
    },
    tag: { items: suggestions ? tagItems : null },
  }
}

export interface RichQuoteClickPayload {
  quoteId: string
  author: string
  content: string
  occurrence: number
}

export interface RichQuoteHandlers {
  onQuoteClick?: (payload: RichQuoteClickPayload) => void
  backlinks?: QuoteBacklinkDecorationOptions
}

const noop = () => {}

/**
 * gameplan-local RichQuote extensions, appended after the kit (spec §6). The
 * handler re-emits so the host component can surface `@rich-quote-click`,
 * exactly as the old wrapper did. The floating Reply button is no longer an
 * extension — CommentEditor renders QuoteReplyButton.vue (a BubbleMenu) for
 * read-only editors. `backlinks` (passed only inside discussions) adds the
 * "quoted by" badge decorations to source posts/comments.
 */
export function richQuoteExtensions(handlers: RichQuoteHandlers = {}) {
  const extensions: AnyExtension[] = [
    RichQuoteNodeExtension.configure({ onClick: handlers.onQuoteClick ?? noop }),
  ]
  if (handlers.backlinks) {
    extensions.push(QuoteBacklinkDecoration.configure(handlers.backlinks))
  }
  return extensions
}

/**
 * The frappe file upload the v0 monolith invoked silently as its default. v1's
 * editor requires an explicit `uploadFunction`, so gameplan passes this one.
 *
 * Uploads default to `private: true` so editor images/attachments are not served
 * from the unauthenticated `/files/` path (frappe/security#206). The backend
 * attaches each file to its parent doc on save (see gameplan/mixins/attachments.py),
 * which is what lets other space members read the now-private file. The runtime
 * `{ signal, onProgress }` the editor engine passes is preserved.
 */
export function uploadFile(file: File, options?: MediaUploadRequestOptions): Promise<UploadedFile> {
  return useFileUpload().upload(file, { private: true, ...(options ?? {}) })
}
