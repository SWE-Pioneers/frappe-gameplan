import { CommentKit } from 'frappe-ui/editor'
import {
  gameplanHeadingLevels,
  suggestionConfig,
  richQuoteExtensions,
  type RichQuoteHandlers,
} from './config'

/**
 * The lighter comment stack: CommentKit (no table / toc / slash / iframe) +
 * @-mentions + #-tags + RichQuote. Used by CommentEditor.
 *
 * Kept in its own module (not config.ts) so CommentKit only loads in the comment
 * box chunk, never in the rich-editor or shared GPEditor chunks.
 */
export function commentExtensions(opts: RichQuoteHandlers = {}) {
  return [
    CommentKit.configure({
      heading: { levels: [...gameplanHeadingLevels] },
      ...suggestionConfig(true),
    }),
    ...richQuoteExtensions(opts),
  ]
}
