import {
  computed,
  inject,
  provide,
  shallowReactive,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue'
import type { GPComment } from '@/types/doctypes'
import { extractQuotedText } from './quoteTextSearch'

/**
 * Reverse index of rich quotes within a discussion: which comments quoted a
 * given source post/comment. Provided by DiscussionView, fed with the loaded
 * comment list by CommentsArea, and consumed by each CommentEditor to render
 * "quoted by" badge decorations on the source passage.
 */

export interface QuoteBacklink {
  quotingCommentId: string
  quotedText: string
  occurrence: number
  author: string
  creation: string
}

interface ParsedQuote {
  sourceId: string
  quotedText: string
  occurrence: number
}

export interface QuoteBacklinksStore {
  commentsData: ShallowRef<GPComment[] | null>
  getFor: (sourceId: string) => QuoteBacklink[]
  popover: { open: boolean; anchorEl: HTMLElement | null; items: QuoteBacklink[] }
  openPopover: (anchorEl: HTMLElement, items: QuoteBacklink[]) => void
  closePopover: () => void
}

const storeKey: InjectionKey<QuoteBacklinksStore> = Symbol('quote-backlinks')

const EMPTY: QuoteBacklink[] = []

export function provideQuoteBacklinks(): QuoteBacklinksStore {
  const commentsData = shallowRef<GPComment[] | null>(null)

  const parseCache = new Map<string, { stamp: string; quotes: ParsedQuote[] }>()

  const registry = computed(() => {
    const map = new Map<string, QuoteBacklink[]>()
    for (const comment of commentsData.value ?? []) {
      if (comment.deleted_at || !comment.content) continue

      const stamp = String(comment.modified)
      let cached = parseCache.get(comment.name)
      if (!cached || cached.stamp !== stamp) {
        cached = { stamp, quotes: parseRichQuotes(comment.content) }
        parseCache.set(comment.name, cached)
      }

      for (const quote of cached.quotes) {
        const list = map.get(quote.sourceId) ?? []
        list.push({
          quotingCommentId: comment.name,
          quotedText: quote.quotedText,
          occurrence: quote.occurrence,
          author: comment.owner,
          creation: comment.creation,
        })
        map.set(quote.sourceId, list)
      }
    }
    return map
  })

  const popover = shallowReactive({
    open: false,
    anchorEl: null as HTMLElement | null,
    items: [] as QuoteBacklink[],
  })

  const store: QuoteBacklinksStore = {
    commentsData,
    getFor: (sourceId) => registry.value.get(sourceId) ?? EMPTY,
    popover,
    openPopover(anchorEl, items) {
      popover.anchorEl = anchorEl
      popover.items = items
      popover.open = true
    },
    closePopover() {
      popover.open = false
    },
  }

  provide(storeKey, store)
  return store
}

export function injectQuoteBacklinks(): QuoteBacklinksStore | null {
  return inject(storeKey, null)
}

function parseRichQuotes(html: string): ParsedQuote[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const quotes: ParsedQuote[] = []
  for (const el of doc.querySelectorAll<HTMLElement>('blockquote[data-rich-quote-id]')) {
    // a quote-of-a-quote shouldn't count as quoting the inner quote's source
    if (el.parentElement?.closest('blockquote[data-rich-quote-id]')) continue

    const sourceId = el.getAttribute('data-rich-quote-id')
    const quotedText = extractQuotedText(el)
    if (!sourceId || !quotedText) continue

    const occurrence = Number(el.getAttribute('data-rich-quote-occurrence')) || 0
    quotes.push({ sourceId, quotedText, occurrence })
  }
  return quotes
}
