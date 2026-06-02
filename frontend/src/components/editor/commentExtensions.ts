import { CommentKit } from 'frappe-ui/editor'
import {
  gameplanHeadingLevels,
  suggestionConfig,
  richQuoteExtensions,
  type RichQuoteHandlers,
} from './config'

/**
 * The lighter comment stack: CommentKit (no toc / slash / iframe) + tables +
 * @-mentions + #-tags + RichQuote. Used by CommentEditor — which also renders
 * the discussion post body — so tables created in a discussion render and edit
 * here too.
 *
 * Kept in its own module (not config.ts) so CommentKit only loads in the comment
 * box chunk, never in the rich-editor or shared GPEditor chunks.
 */
export function commentExtensions(opts: RichQuoteHandlers = {}) {
  return [
    CommentKit.configure({
      heading: { levels: [...gameplanHeadingLevels] },
      table: {},
      ...suggestionConfig(true),
    }),
    ...richQuoteExtensions(opts),
  ]
}
