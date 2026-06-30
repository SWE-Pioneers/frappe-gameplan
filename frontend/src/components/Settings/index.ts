import { ref, type Component } from 'vue'

type LucideIconString = `lucide-${string}`

export interface Tab {
  label: string
  icon: Component | LucideIconString
  component: Component
  group?: string
}

// Global state for the settings dialog
export const show = ref(false)
export const activeTab = ref<Tab | null>(null)
const requestedTab = ref<string | null>(null)

// Lets callers deep-link into the Communities tab with a community + view
// pre-selected (e.g. a discussion's "Manage spaces" action). Read once by
// CommunitiesSettings when the dialog opens.
export type CommunitiesView = 'spaces' | 'members'
export const communitiesTarget = ref<{ communityId: string | null; view: CommunitiesView }>({
  communityId: null,
  view: 'spaces',
})

export function showCommunitiesSettings(
  communityId: string | null = null,
  view: CommunitiesView = 'spaces',
) {
  communitiesTarget.value = { communityId, view }
  showSettingsDialog('Communities')
}

// Available tabs - these will be imported by SettingsDialog.vue
export const tabs: Tab[] = []

export function showSettingsDialog(defaultTab: string | null = null) {
  show.value = true
  requestedTab.value = defaultTab
  activateTab()
}

// Function to register tabs (called by SettingsDialog.vue)
export function registerTabs(tabsArray: Tab[]) {
  tabs.splice(0, tabs.length, ...tabsArray)
  activateTab()
}

function activateTab() {
  if (!tabs.length) return

  if (requestedTab.value) {
    const matchingTab = tabs.find((tab) => tab.label === requestedTab.value)
    if (matchingTab) {
      activeTab.value = matchingTab
      requestedTab.value = null
      return
    }

    if (!isRegisteredTab(activeTab.value)) {
      activeTab.value = tabs[0]
    }
    return
  }

  if (!isRegisteredTab(activeTab.value)) {
    activeTab.value = tabs[0]
  }
}

function isRegisteredTab(tab: Tab | null) {
  return Boolean(tab && tabs.some((registeredTab) => registeredTab.label === tab.label))
}
