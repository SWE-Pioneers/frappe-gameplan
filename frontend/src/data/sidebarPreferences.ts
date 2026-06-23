import { computed, ref } from 'vue'

export type SidebarBadgeStyle = 'Unread count' | 'Dot'

const defaultSidebarBadgeStyle: SidebarBadgeStyle = 'Dot'
const sidebarBadgeStyle = ref<SidebarBadgeStyle>(defaultSidebarBadgeStyle)

export const currentSidebarBadgeStyle = computed(() => sidebarBadgeStyle.value)

export function setSidebarBadgeStyle(style: unknown) {
  sidebarBadgeStyle.value = normalizeSidebarBadgeStyle(style)
}

function normalizeSidebarBadgeStyle(style: unknown): SidebarBadgeStyle {
  if (style === 'Dot') return 'Dot'
  if (style === 'Unread count') return 'Unread count'
  return defaultSidebarBadgeStyle
}
