import { Editor, Extension } from '@tiptap/core'
import { EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { DOMSerializer } from '@tiptap/pm/model'
import tippy, { Instance } from 'tippy.js'

class FloatingQuoteButtonView {
  public button: HTMLButtonElement
  private editorView: EditorView
  private tippyInstance: Instance | null = null
  private editor: Editor

  constructor(editorView: EditorView, editor: Editor) {
    this.editorView = editorView
    this.editor = editor
    this.button = document.createElement('button')
    this.button.textContent = 'Reply'
    let classes = [
      'h-7 text-ink-base bg-surface-gray-10 hover:bg-surface-gray-9 active:bg-surface-gray-8',
      'text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4',
      'focus-visible:ring focus-visible:ring-outline-gray-3',
      'h-7 text-base px-2 rounded inline-flex items-center justify-center gap-2 transition-colors focus:outline-none',
    ]
      .map((c) => c.split(' '))
      .flat()
    this.button.classList.add(...classes)

    this.button.addEventListener('mousedown', (event) => {
      event.preventDefault()

      const { from, to } = this.editorView.state.selection
      const slice = this.editorView.state.doc.slice(from, to)

      const serializer = DOMSerializer.fromSchema(this.editorView.state.schema)
      const domFragment = serializer.serializeFragment(slice.content)
      const tempDiv = document.createElement('div')
      tempDiv.appendChild(domFragment)
      const selectedHTML = tempDiv.innerHTML

      const extensionOptions = this.editor.options.extensions.find(
        (e) => e.name === 'floatingQuoteButton',
      )?.options
      if (extensionOptions && typeof extensionOptions.onClick === 'function') {
        extensionOptions.onClick(selectedHTML)
      }

      this.tippyInstance?.hide()
    })

    this.update(editorView, null)
  }

  private handleScroll = () => {
    if (this.tippyInstance?.state.isVisible) {
      this.tippyInstance.hide()
    }
  }

  update(view: EditorView, prevState: EditorState | null) {
    const { state } = view
    const { selection } = state

    if (view.editable) {
      this.tippyInstance?.hide()
      return
    }

    // Only offer "Reply" for a ranged TEXT selection. A NodeSelection (clicking
    // an atom node like an image, video, iframe, or an existing richQuote) is
    // also non-empty with `from !== to`, which used to surface the Reply button
    // on top of the image viewer when a reader clicked a picture. `selection.node`
    // is set only for a NodeSelection, so its absence narrows this to text
    // selections — a text range spanning media is still a TextSelection, so
    // quoting around media keeps working.
    if (
      !selection.empty &&
      selection.from !== selection.to &&
      !selection.node
    ) {
      const rect = getRectForSelection(view)

      if (rect && (rect.width > 0 || rect.height > 0)) {
        if (!this.tippyInstance) {
          this.tippyInstance = tippy(this.editorView.dom, {
            content: this.button,
            trigger: 'manual',
            interactive: true,
            placement: 'top',
            arrow: false,
            appendTo: () => document.body,
            hideOnClick: true,
            duration: 150,
            onShow: (instance) => {
              window.addEventListener('scroll', this.handleScroll, true)
            },
            onHide: (instance) => {
              window.removeEventListener('scroll', this.handleScroll, true)
            },
          })
        }
        this.tippyInstance?.setProps({
          getReferenceClientRect: () => rect,
        })
        this.tippyInstance?.show()
      } else {
        this.tippyInstance?.hide()
      }
    } else {
      this.tippyInstance?.hide()
    }
  }

  destroy() {
    window.removeEventListener('scroll', this.handleScroll, true)
    this.tippyInstance?.destroy()
  }
}

export const FloatingQuoteButton = Extension.create({
  name: 'floatingQuoteButton',

  addOptions() {
    return {
      onClick: (html: string) => {
        console.warn('FloatingQuoteButton: onClick not implemented.', html)
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('floatingQuoteButton'),
        view: (editorView) => new FloatingQuoteButtonView(editorView, this.editor),
      }),
    ]
  },
})

function getRectForSelection(view: EditorView): DOMRect | null {
  const { state } = view
  const { selection } = state
  if (selection.empty || selection.from === selection.to) return null

  const { from, to } = selection

  const pmRange = document.createRange()
  try {
    const startNode = view.domAtPos(from).node
    const startOffset = view.domAtPos(from).offset
    const endNode = view.domAtPos(to).node
    const endOffset = view.domAtPos(to).offset

    pmRange.setStart(startNode, startOffset)
    pmRange.setEnd(endNode, endOffset)
    const rect = pmRange.getBoundingClientRect()
    // Ensure the rect has non-zero dimensions, otherwise tippy might not show
    if (rect.width === 0 && rect.height === 0 && from !== to) {
      // Fallback for collapsed or problematic ranges that are not truly empty selections
      const startCoords = view.coordsAtPos(from)
      const endCoords = view.coordsAtPos(to)
      return new DOMRect(
        startCoords.left,
        startCoords.top,
        // Ensure width/height is not negative
        Math.max(0, endCoords.right - startCoords.left),
        Math.max(0, endCoords.bottom - startCoords.top),
      )
    }
    return rect
  } catch (e) {
    console.warn('Error creating DOM range for selection:', e)
    // Fallback to coordsAtPos if DOM range creation fails
    const startCoords = view.coordsAtPos(from)
    const endCoords = view.coordsAtPos(to)
    return new DOMRect(
      startCoords.left,
      startCoords.top,
      endCoords.right - startCoords.left,
      endCoords.bottom - startCoords.top,
    )
  }
}

export default FloatingQuoteButton
