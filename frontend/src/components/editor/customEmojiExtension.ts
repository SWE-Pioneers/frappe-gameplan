import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customEmoji: {
      /** Insert a custom (uploaded image) emoji inline at the cursor. */
      insertCustomEmoji: (attributes: { src: string; alt?: string }) => ReturnType
    }
  }
}

/**
 * Inline node for uploaded custom emoji. The shared `image` node renders as a
 * block with resize/viewer chrome (its node view forces `block mx-auto my-2`),
 * which is wrong for an emoji that should sit inline with text at ~20px. This
 * keeps custom emoji as a plain inline `<img>`.
 *
 * Round-trips via the `data-emoji` marker: a higher `priority` than the image
 * node ensures this rule wins for `<img data-emoji>` when parsing saved HTML,
 * while the image node still claims every other `<img src>`.
 */
export const CustomEmojiExtension = Node.create({
  name: 'customEmoji',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,
  priority: 1100,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'img[data-emoji]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-emoji': '',
        class: 'inline-block size-5 align-text-bottom',
        // Inline style guards against prose `img { display:block; margin }`
        // rules winning over the utility classes.
        style: 'display:inline-block;width:1.25rem;height:1.25rem;margin:0;vertical-align:text-bottom',
      }),
    ]
  },

  addCommands() {
    return {
      insertCustomEmoji:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    }
  },
})
