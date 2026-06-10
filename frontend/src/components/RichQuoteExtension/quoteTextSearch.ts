import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Shared text-anchoring utilities for the rich quote feature.
 *
 * Quotes are matched against their source by normalized plain text instead of
 * HTML, because server-side sanitization and mark re-serialization change the
 * HTML between insertion and render. Both the DOM index (scroll-back) and the
 * ProseMirror index (backlink decorations) build the same normalized string:
 * whitespace runs collapse to a single space and a virtual space separates
 * block boundaries (element.textContent would join `<p>a</p><p>b</p>` as "ab").
 */

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th, div'

export function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Start index of the `occurrence`-th (0-based) non-overlapping match of
 * `needle` in `haystack`. When the requested occurrence no longer exists (the
 * source was edited and an earlier identical passage removed), clamp to the
 * last surviving match rather than failing. Returns -1 only when there is no
 * match at all.
 */
function nthIndexOf(haystack: string, needle: string, occurrence: number): number {
  let i = haystack.indexOf(needle)
  if (i === -1) return -1
  let last = i
  for (let n = 0; n < occurrence; n++) {
    const next = haystack.indexOf(needle, last + needle.length)
    if (next === -1) break
    last = next
  }
  return last
}

export interface DomTextIndex {
  text: string
  map: Array<{ node: Text; offset: number }>
}

export function buildDomTextIndex(container: HTMLElement): DomTextIndex {
  const chars: string[] = []
  const map: DomTextIndex['map'] = []
  let lastWasSpace = true
  let prevBlock: Element | null = null

  const doc = container.ownerDocument
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // our own widget badges must not pollute the searchable text
      if (node.parentElement?.closest('[data-quote-backlink-widget]')) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let current: Node | null
  while ((current = walker.nextNode())) {
    const textNode = current as Text
    const block = textNode.parentElement?.closest(BLOCK_SELECTOR) ?? container
    if (prevBlock && block !== prevBlock && !lastWasSpace) {
      chars.push(' ')
      map.push({ node: textNode, offset: 0 })
      lastWasSpace = true
    }
    prevBlock = block

    const value = textNode.nodeValue ?? ''
    for (let i = 0; i < value.length; i++) {
      const ch = value[i]
      if (/\s/.test(ch)) {
        if (!lastWasSpace) {
          chars.push(' ')
          map.push({ node: textNode, offset: i })
          lastWasSpace = true
        }
      } else {
        chars.push(ch)
        map.push({ node: textNode, offset: i })
        lastWasSpace = false
      }
    }
  }

  return { text: chars.join(''), map }
}

/**
 * The canonical plain-text form of quoted content. Always use this (never raw
 * textContent) so block boundaries normalize identically on both sides of a
 * match.
 */
export function extractQuotedText(el: HTMLElement): string {
  return buildDomTextIndex(el).text.trimEnd()
}

export function htmlToQuotedText(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return extractQuotedText(parsed.body)
}

/**
 * Find `target` within `container` as a DOM Range, tolerant of the text
 * spanning multiple inline elements (bold, links, mentions) and block
 * boundaries. Returns null when not found. `occurrence` disambiguates when the
 * same text appears more than once (defaults to the first match).
 */
export function findDomRange(
  container: HTMLElement,
  target: string,
  occurrence = 0,
): Range | null {
  const t = normalizeText(target)
  if (!t) return null

  const { text, map } = buildDomTextIndex(container)
  const idx = nthIndexOf(text, t, occurrence)
  if (idx === -1) return null

  // target is trimmed, so first/last chars are non-space and always map to
  // real text positions (never a virtual block separator)
  const start = map[idx]
  const end = map[idx + t.length - 1]
  const range = container.ownerDocument.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset + 1)
  return range
}

export interface DocTextIndex {
  text: string
  posMap: number[]
}

export function buildDocTextIndex(doc: PMNode): DocTextIndex {
  const chars: string[] = []
  const posMap: number[] = []
  let lastWasSpace = true

  doc.descendants((node, pos) => {
    if (node.isText) {
      const value = node.text ?? ''
      for (let i = 0; i < value.length; i++) {
        const ch = value[i]
        if (/\s/.test(ch)) {
          if (!lastWasSpace) {
            chars.push(' ')
            posMap.push(pos + i)
            lastWasSpace = true
          }
        } else {
          chars.push(ch)
          posMap.push(pos + i)
          lastWasSpace = false
        }
      }
    } else if (node.isBlock) {
      if (!lastWasSpace) {
        chars.push(' ')
        posMap.push(pos)
        lastWasSpace = true
      }
    }
    return true
  })

  return { text: chars.join(''), posMap }
}

export function findDocRange(
  index: DocTextIndex,
  target: string,
  occurrence = 0,
): { from: number; to: number } | null {
  const t = normalizeText(target)
  if (!t) return null

  const idx = nthIndexOf(index.text, t, occurrence)
  if (idx === -1) return null

  return {
    from: index.posMap[idx],
    to: index.posMap[idx + t.length - 1] + 1,
  }
}

/**
 * Which occurrence (0-based) of `target` the ProseMirror position `from` falls
 * on — i.e. how many identical matches start before it. Recorded at quote
 * creation so the same passage can later be re-located unambiguously.
 */
export function occurrenceAt(index: DocTextIndex, target: string, from: number): number {
  const t = normalizeText(target)
  if (!t) return 0

  let occ = 0
  let i = index.text.indexOf(t)
  while (i !== -1 && index.posMap[i] < from) {
    occ++
    i = index.text.indexOf(t, i + t.length)
  }
  return occ
}
