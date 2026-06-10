import { nextTick, Ref } from 'vue'
import { Editor } from '@tiptap/core'
import { findDomRange, htmlToQuotedText } from './quoteTextSearch'

interface CommentsAreaInstance {
  editorObject?: Editor
  openCommentBox?: () => void
  getCommentContentElement?: (id: string) => HTMLElement | null | undefined
  highlightComment?: (id: string) => void
  scrollToCommentById?: (id: string) => void
}

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th'

export function useRichQuoteHandler(
  commentsArea: Ref<CommentsAreaInstance | null>,
  mainPostContentEl: Ref<HTMLElement | null>,
) {
  const handleRichQuote = async (
    quote: { html: string; occurrence: number },
    { id, author }: { id: string; author: string },
  ) => {
    const html = quote?.html
    if (!html || typeof html !== 'string' || html.trim() === '') {
      console.warn('HTML content for rich quote is empty or invalid.')
      return
    }

    const openCommentBox = commentsArea.value?.openCommentBox
    if (openCommentBox) {
      openCommentBox()
    }

    await nextTick()

    const editor = commentsArea.value?.editorObject
    if (!editor) {
      console.error('Editor instance (commentsArea.value.editorObject) not found.')
      return
    }

    const occurrenceAttr = quote.occurrence ? ` data-rich-quote-occurrence="${quote.occurrence}"` : ''
    let html_ = `<blockquote data-rich-quote-id="${id}" data-author="${author}"${occurrenceAttr}>${html}</blockquote><p></p>`
    editor.chain().focus().insertContent(html_).run()
  }

  const handleRichQuoteClick = (payload: {
    quoteId: string
    content: string
    author: string
    occurrence?: number
  }) => {
    if (!payload?.quoteId || !payload.content) {
      console.warn('Rich quote click payload, id, or content is missing.')
      return
    }

    const [type, idValue] = payload.quoteId.split(':')
    if (type !== 'comment' && type !== 'discussion') {
      console.warn('Unknown rich quote type:', type)
      return
    }

    // Anchor by normalized plain text, not HTML — server-side sanitization and
    // mark re-serialization change the markup between insertion and render, so
    // HTML matching is unreliable.
    const quotedText = htmlToQuotedText(payload.content)

    const container =
      type === 'comment'
        ? (commentsArea.value?.getCommentContentElement?.(idValue) ?? null)
        : mainPostContentEl.value

    if (!container) {
      if (type === 'comment') {
        commentsArea.value?.scrollToCommentById?.(idValue)
      } else {
        console.warn('mainPostContentEl ref is not available. Cannot scroll to discussion post.')
      }
      return
    }

    const searchRoot = container.querySelector<HTMLElement>('.ProseMirror') ?? container
    const range = quotedText ? findDomRange(searchRoot, quotedText, payload.occurrence ?? 0) : null

    if (range) {
      scrollAndHighlight(nearestBlockElement(range) ?? searchRoot)
    } else if (type === 'comment') {
      // quoted passage no longer exists (source edited) — highlight the whole comment
      commentsArea.value?.scrollToCommentById?.(idValue)
      commentsArea.value?.highlightComment?.(idValue)
    } else {
      scrollAndHighlight(container)
    }
  }

  return {
    handleRichQuote,
    handleRichQuoteClick,
  }
}

function nearestBlockElement(range: Range): HTMLElement | null {
  const node = range.commonAncestorContainer
  const el = node instanceof HTMLElement ? node : node.parentElement
  return el?.closest<HTMLElement>(BLOCK_SELECTOR) ?? el
}

function scrollAndHighlight(element: HTMLElement) {
  element.scrollIntoView({ block: 'center' })
  element.classList.add('highlighted-quote-target')
  setTimeout(() => {
    element.classList.remove('highlighted-quote-target')
  }, 2500)
}
