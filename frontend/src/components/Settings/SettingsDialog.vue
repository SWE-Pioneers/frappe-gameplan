<template>
  <SettingsDialog v-model="show" size="5xl" :shortcut="false">
    <SettingsSidebar>
      <SettingsNavGroup v-for="group in tabGroups" :key="group.label" :label="group.label">
        <SettingsNavItem
          v-for="tab in group.tabs"
          :key="tab.label"
          :active="activeTab?.label == tab.label"
          @click="selectTab(tab)"
        >
          <template #prefix>
            <UserAvatar
              v-if="tab.prefix === 'session-avatar'"
              :user="sessionUser.name"
              size="xs"
              class="shrink-0"
            />
            <span v-else :class="[tab.icon, 'size-4 shrink-0 text-ink-gray-6']" />
          </template>
          {{ tab.label }}
        </SettingsNavItem>
      </SettingsNavGroup>
    </SettingsSidebar>
    <SettingsContent>
      <component v-if="activeTab" :is="activeTab.component" @close-dialog="show = false" />
    </SettingsContent>
  </SettingsDialog>
</template>

<script setup lang="ts">
import { computed, markRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import {
  SettingsDialog,
  SettingsSidebar,
  SettingsNavGroup,
  SettingsNavItem,
  SettingsContent,
} from 'frappe-ui'
import { show, activeTab, registerTabs, settingsBackgroundPath, type Tab } from './index'
import { getHomeRoute } from '@/router'
import UserAvatar from '@/components/UserAvatar.vue'
import { isGameplanAdmin, useSessionUser } from '@/data/users'
import { useCanManageCommunities } from '@/composables/useCanManageCommunities'
import Members from './Members.vue'
import CommunitiesSettings from './CommunitiesSettings.vue'
import NotificationsSettings from './NotificationsSettings.vue'
import ProfileSettings from './ProfileSettings.vue'
import EmojiSettings from './EmojiSettings.vue'
import PreferencesSettings from './PreferencesSettings.vue'

interface SettingsTab extends Tab {
  // Tabs that drive global role management / invites; these only make sense for
  // global admins, whose actions the server (require_admin) actually accepts.
  adminOnly?: boolean
  condition?: () => boolean
  prefix?: 'session-avatar'
}

const route = useRoute()
const router = useRouter()

interface TabGroup {
  label: string
  tabs: SettingsTab[]
}

const canManageCommunities = useCanManageCommunities()
const sessionUser = useSessionUser()

const allTabs: SettingsTab[] = [
  {
    label: 'Profile',
    slug: 'profile',
    group: 'User settings',
    icon: 'lucide-user',
    prefix: 'session-avatar',
    component: markRaw(ProfileSettings),
  },
  {
    label: 'Preferences',
    slug: 'preferences',
    group: 'User settings',
    icon: 'lucide-sliders-horizontal',
    component: markRaw(PreferencesSettings),
  },
  {
    label: 'Notifications',
    slug: 'notifications',
    group: 'User settings',
    icon: 'lucide-bell',
    component: markRaw(NotificationsSettings),
  },
  {
    label: 'Communities',
    slug: 'communities',
    group: 'App settings',
    icon: 'lucide-building-2',
    component: markRaw(CommunitiesSettings),
    condition: () => canManageCommunities.value,
  },
  {
    label: 'Emojis',
    slug: 'emojis',
    group: 'App settings',
    icon: 'lucide-smile-plus',
    component: markRaw(EmojiSettings),
    adminOnly: true,
  },
  {
    label: 'Users',
    slug: 'users',
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

// Keep the label→slug registry in sync for the imperative showSettingsDialog().
watch(tabs, (list) => registerTabs(list), { immediate: true })

const onSettingsRoute = computed(() => route.matched.some((r) => r.meta?.settingsOverlay))
const routeTab = computed(() =>
  Array.isArray(route.params.tab) ? route.params.tab[0] : route.params.tab,
)

// Route → store: the URL drives which tab is shown and whether the dialog is open.
// Re-runs when admin-only tabs resolve async, so a deep link to an admin tab works
// once permissions load.
watch(
  [routeTab, onSettingsRoute, tabs],
  () => {
    if (!onSettingsRoute.value) {
      show.value = false
      return
    }
    const match = tabs.value.find((tab) => tab.slug === routeTab.value)
    if (!match) {
      // Bare /settings, an unknown slug, or a tab the user can't access: fall back
      // to the first available tab once the tab list is known.
      if (tabs.value.length) {
        router.replace({ name: 'SettingsTab', params: { tab: tabs.value[0].slug } })
      }
      return
    }
    activeTab.value = match
    show.value = true
  },
  { immediate: true },
)

// Closing the dialog (Esc, backdrop click, or the X) returns to the underlying page.
watch(show, (open) => {
  if (!open && onSettingsRoute.value) {
    router.push(settingsBackgroundPath.value || getHomeRoute())
  }
})

function selectTab(tab: SettingsTab) {
  router.push({ name: 'SettingsTab', params: { tab: tab.slug } })
}

// Route-aware Cmd/Ctrl+Shift+. toggle. The kit's built-in shortcut is disabled
// (:shortcut="false") because the dialog's open state is driven by the URL here.
// Use e.code since Shift rewrites e.key for "." to ">" on most layouts.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.code !== 'Comma' || !e.shiftKey || !(e.metaKey || e.ctrlKey)) return
  e.preventDefault()
  if (onSettingsRoute.value) {
    router.push(settingsBackgroundPath.value || getHomeRoute())
    return
  }
  const slug = activeTab.value?.slug || tabs.value[0]?.slug
  if (slug) router.push({ name: 'SettingsTab', params: { tab: slug } })
})
</script>
