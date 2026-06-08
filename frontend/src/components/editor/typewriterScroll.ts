import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

/**
 * Keeps breathing room below the caret while typing near the bottom of the
 * scroll container (typewriter-style). ProseMirror reads `scrollThreshold` /
 * `scrollMargin` through `someProp`, so a plain plugin can provide them — no
 * `editorProps` passthrough needed on the frappe-ui <Editor>.
 *
 * Meant for full-page, long-form editors (discussion compose). Don't add it to
 * editors inside dialogs or small panels — a large bottom margin there would
 * over-scroll their containers.
 */
export function typewriterScroll(bottom = 160) {
  return Extension.create({
    name: 'typewriterScroll',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            scrollThreshold: { top: 0, bottom, left: 0, right: 0 },
            scrollMargin: { top: 0, bottom, left: 0, right: 0 },
          },
        }),
      ]
    },
  })
}
