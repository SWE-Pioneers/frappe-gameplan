import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { buildDocTextIndex, findDocRange } from './quoteTextSearch'
import type { QuoteBacklink } from './useQuoteBacklinks'

export const quoteBacklinksPluginKey = new PluginKey<DecorationSet>('quoteBacklinks')

export interface QuoteBacklinkDecorationOptions {
  getBacklinks: () => QuoteBacklink[]
  onBacklinkClick: (props: { anchorEl: HTMLElement; items: QuoteBacklink[] }) => void
}

/**
 * Renders a small "quoted by" badge (❝ + count) after each passage of this
 * document that has been quoted in a comment. Backlinks arrive through a
 * getter because extension options aren't reactive — the host component
 * dispatches `tr.setMeta(quoteBacklinksPluginKey, 'refresh')` whenever the
 * backlink list or the editable state changes.
 */
export const QuoteBacklinkDecoration = Extension.create<QuoteBacklinkDecorationOptions>({
  name: 'quoteBacklinkDecoration',

  addOptions() {
    return {
      getBacklinks: () => [],
      onBacklinkClick: () => {},
    }
  },

  addProseMirrorPlugins() {
    const ext = this

    const compute = (doc: PMNode): DecorationSet => {
      // badges are a read-mode affordance; they'd also interfere with editing
      if (ext.editor.isEditable) return DecorationSet.empty

      const backlinks = ext.options.getBacklinks()
      if (!backlinks.length) return DecorationSet.empty

      // group by passage *and* occurrence: two comments quoting different
      // occurrences of the same text get badges on their respective passages
      const groups = new Map<string, { quotedText: string; occurrence: number; items: QuoteBacklink[] }>()
      for (const backlink of backlinks) {
        const key = `${backlink.occurrence} ${backlink.quotedText}`
        let group = groups.get(key)
        if (!group) {
          group = { quotedText: backlink.quotedText, occurrence: backlink.occurrence, items: [] }
          groups.set(key, group)
        }
        group.items.push(backlink)
      }

      const index = buildDocTextIndex(doc)
      const decorations: Decoration[] = []
      for (const { quotedText, occurrence, items } of groups.values()) {
        const range = findDocRange(index, quotedText, occurrence)
        // passage may have been edited away since it was quoted — skip silently
        if (!range) continue

        decorations.push(
          Decoration.widget(range.to, () => createBadge(items, ext.options.onBacklinkClick), {
            side: 1,
            key: `quote-backlink:${range.to}:${items.length}:${quotedText.length}`,
          }),
        )
      }
      return DecorationSet.create(doc, decorations)
    }

    return [
      new Plugin({
        key: quoteBacklinksPluginKey,
        state: {
          init: (_, state) => compute(state.doc),
          apply: (tr, old) => {
            if (tr.docChanged || tr.getMeta(quoteBacklinksPluginKey) === 'refresh') {
              return compute(tr.doc)
            }
            return old.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

function createBadge(
  items: QuoteBacklink[],
  onClick: QuoteBacklinkDecorationOptions['onBacklinkClick'],
): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('data-quote-backlink-widget', '')
  button.contentEditable = 'false'
  button.className = [
    'mx-1 align-baseline select-none rounded px-0.5 text-sm font-medium',
    'text-ink-gray-5 hover:text-ink-gray-8 hover:bg-surface-gray-2',
    'focus:outline-none focus-visible:ring focus-visible:ring-outline-gray-3',
  ].join(' ')
  button.textContent = items.length > 1 ? `❝ ${items.length}` : '❝'
  button.title =
    items.length > 1 ? `Quoted by ${items.length} comments` : 'Quoted by 1 comment'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick({ anchorEl: button, items })
  })
  return button
}

export default QuoteBacklinkDecoration
