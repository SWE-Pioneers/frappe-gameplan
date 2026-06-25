import { computed, ComputedRef } from 'vue'
import { spaces } from '@/data/spaces'

let projectFormatters: Record<string, ComputedRef<string>> = {}

export function spaceTitle(
  project: string | number | null | undefined,
): ComputedRef<string> | string {
  if (project == null) {
    return ''
  }

  let projectId = project.toString()
  if (!projectFormatters[projectId]) {
    projectFormatters[projectId] = computed(() => {
      if (spaces.data && spaces.data.length > 0) {
        const foundSpace = spaces.data.find((space) => space.name.toString() === projectId)
        if (foundSpace) {
          return foundSpace.title
        }
      }
      return projectId
    })
  }
  return projectFormatters[projectId]
}

/** Caps an unread count for display, e.g. 142 -> "99+". */
export function formatUnreadCount(count: number): string {
  return count > 99 ? '99+' : count.toString()
}

/**
 * Builds an accessible label that folds an unread count into a control's name,
 * e.g. ("Notifications", 3) -> "Notifications, 3 unread". Uses the exact count (never the
 * capped "99+") so screen readers announce the real number. Returns the bare label when
 * there's nothing unread so screen readers aren't told about an empty badge.
 */
export function unreadAriaLabel(label: string, count: number): string {
  if (!count) return label
  return `${label}, ${count} unread`
}
