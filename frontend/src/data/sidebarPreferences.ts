import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export type SidebarBadgeStyle = 'Unread count' | 'Dot'
export type SpaceSidebarSort = 'Recent activity' | 'Alphabetical'

const defaultSidebarBadgeStyle: SidebarBadgeStyle = 'Dot'
const sidebarBadgeStyle = ref<SidebarBadgeStyle>(defaultSidebarBadgeStyle)
const defaultSpaceSidebarSort: SpaceSidebarSort = 'Alphabetical'
const spaceSidebarSort = useLocalStorage<SpaceSidebarSort>(
  'gameplan:spaceSidebarSort',
  defaultSpaceSidebarSort,
)
const hideInactiveSpaces = useLocalStorage('gameplan:hideInactiveSpaces', false)

export const currentSidebarBadgeStyle = computed(() => sidebarBadgeStyle.value)
export const currentSpaceSidebarSort = computed(() => {
  return normalizeSpaceSidebarSort(spaceSidebarSort.value)
})
export const currentHideInactiveSpaces = computed(() => hideInactiveSpaces.value)

export function setSidebarBadgeStyle(style: unknown) {
  sidebarBadgeStyle.value = normalizeSidebarBadgeStyle(style)
}

export function setSpaceSidebarSort(sort: unknown) {
  spaceSidebarSort.value = normalizeSpaceSidebarSort(sort)
}

export function setHideInactiveSpaces(value: boolean) {
  hideInactiveSpaces.value = value
}

function normalizeSidebarBadgeStyle(style: unknown): SidebarBadgeStyle {
  if (style === 'Dot') return 'Dot'
  if (style === 'Unread count') return 'Unread count'
  return defaultSidebarBadgeStyle
}

function normalizeSpaceSidebarSort(sort: unknown): SpaceSidebarSort {
  if (sort === 'Recent activity') return 'Recent activity'
  if (sort === 'Alphabetical') return 'Alphabetical'
  return defaultSpaceSidebarSort
}
