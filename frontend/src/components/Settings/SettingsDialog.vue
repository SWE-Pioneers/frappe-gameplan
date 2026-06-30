<template>
  <Dialog v-model:open="show" size="5xl" bare>
    <div
      class="flex h-[100dvh] min-h-0 w-[100vw] flex-col overflow-hidden sm:h-[min(860px,calc(100vh-8rem))] sm:min-h-[560px] sm:w-auto sm:flex-row"
    >
      <div
        class="flex max-h-[38vh] w-full shrink-0 flex-col overflow-y-auto border-b border-outline-gray-1 bg-surface-sidebar p-2 sm:max-h-none sm:w-[220px] sm:border-b-0 sm:border-r"
      >
        <Dialog.Title as-child>
          <h1 class="sr-only">Settings</h1>
        </Dialog.Title>
        <div class="space-y-4">
          <div v-for="group in tabGroups" :key="group.label">
            <div class="flex h-[30px] items-center px-2 text-base text-ink-gray-5">
              {{ group.label }}
            </div>
            <div class="flex flex-col gap-0.5">
              <button
                v-for="tab in group.tabs"
                :key="tab.label"
                class="flex h-[30px] w-full items-center gap-2 rounded px-2 text-left"
                :class="[
                  activeTab?.label == tab.label
                    ? 'bg-surface-elevation-3 shadow-sm'
                    : 'hover:bg-surface-gray-2',
                ]"
                @click="selectTab(tab)"
              >
                <UserAvatar
                  v-if="tab.prefix === 'session-avatar'"
                  :user="sessionUser.name"
                  size="xs"
                  class="shrink-0"
                />
                <span v-else :class="[tab.icon, 'size-4 shrink-0 text-ink-gray-6']" />
                <span class="min-w-0 truncate text-base text-ink-gray-7">
                  {{ tab.label }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex min-h-0 flex-1">
        <div class="flex min-h-0 flex-1 justify-stretch">
          <component v-if="activeTab" :is="activeTab.component" @close-dialog="show = false" />
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, markRaw, watchEffect } from 'vue'
import { useEventListener } from '@vueuse/core'
import { Dialog } from 'frappe-ui'
import { show, activeTab, registerTabs, showSettingsDialog, type Tab } from './index'
import UserAvatar from '@/components/UserAvatar.vue'
import { isGameplanAdmin, useSessionUser } from '@/data/users'
import { useCanManageCommunities } from '@/composables/useCanManageCommunities'
import Members from './Members.vue'
import CommunitiesSettings from './CommunitiesSettings.vue'
import ProfileSettings from './ProfileSettings.vue'
import EmojiSettings from './EmojiSettings.vue'
import SettingsTabDialog from './SettingsTab.vue'

interface SettingsTab extends Tab {
  // Tabs that drive global role management / invites; these only make sense for
  // global admins, whose actions the server (require_admin) actually accepts.
  adminOnly?: boolean
  condition?: () => boolean
  prefix?: 'session-avatar'
}

interface TabGroup {
  label: string
  tabs: SettingsTab[]
}

const canManageCommunities = useCanManageCommunities()
const sessionUser = useSessionUser()

const allTabs: SettingsTab[] = [
  {
    label: 'Profile',
    group: 'User settings',
    icon: 'lucide-user',
    prefix: 'session-avatar',
    component: markRaw(ProfileSettings),
  },
  {
    label: 'Preferences',
    group: 'User settings',
    icon: 'lucide-sliders-horizontal',
    component: markRaw(SettingsTabDialog),
  },
  {
    label: 'Communities',
    group: 'App settings',
    icon: 'lucide-building-2',
    component: markRaw(CommunitiesSettings),
    condition: () => canManageCommunities.value,
  },
  {
    label: 'Emojis',
    group: 'App settings',
    icon: 'lucide-smile-plus',
    component: markRaw(EmojiSettings),
    adminOnly: true,
  },
  {
    label: 'Users',
    group: 'Administration',
    icon: 'lucide-users',
    component: markRaw(Members),
    adminOnly: true,
  },
]

// Admin status loads asynchronously (the users resource is immediate: false), so
// keep this reactive and re-register once the session user's role resolves.
const tabs = computed(() =>
  allTabs.filter(
    (tab) => (!tab.adminOnly || isGameplanAdmin()) && (!tab.condition || tab.condition()),
  ),
)
const tabGroups = computed<TabGroup[]>(() => {
  let groups: TabGroup[] = []

  for (let tab of tabs.value) {
    let label = tab.group || 'Settings'
    let group = groups.find((group) => group.label === label)
    if (!group) {
      group = { label, tabs: [] }
      groups.push(group)
    }
    group.tabs.push(tab)
  }

  return groups
})

watchEffect(() => registerTabs(tabs.value))

function selectTab(tab: SettingsTab) {
  showSettingsDialog(tab.label)
}

// Cmd/Ctrl+Shift+. toggles Settings. Use e.code (physical key) since Shift
// rewrites e.key for "." to ">" on most layouts. useEventListener auto-cleans up.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.code === 'Comma' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    show.value ? (show.value = false) : showSettingsDialog()
  }
})
</script>
