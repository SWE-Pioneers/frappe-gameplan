<template>
  <div class="relative flex h-full flex-col" v-if="users.isFinished">
    <DesktopShell class="h-full flex-1 standalone:border-t" :card-class="cardClass">
      <template #rail>
        <AppRail :show-border="onCommunityRoute" :show-community-active-state="onCommunityRoute" />
      </template>
      <template #sidebar>
        <AppSidebar v-if="onCommunityRoute" />
      </template>

      <ReadOnlyBanner v-if="readOnlyMode" class="mb-3" />
      <slot />
    </DesktopShell>
    <CommandPalette />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DesktopShell } from 'frappe-ui'
import AppRail from './AppRail'
import AppSidebar from './AppSidebar.vue'
import CommandPalette from './CommandPalette/CommandPalette.vue'
import ReadOnlyBanner from './ReadOnlyBanner.vue'
import { readOnlyMode } from '@/data/readOnlyMode'
import { users } from '@/data/users'
import { settingsBackgroundPath } from '@/components/Settings'
import { getHomeRoute } from '@/router'

const route = useRoute()
const router = useRouter()

// The Gameplan "card" look layered over DesktopShell's structural content column:
// a floating panel with a gutter (margin) on top/bottom/right, flush-left against the
// sidebar. Dark mode drops the float for a full-bleed panel with a left divider.
const cardClass =
  'my-1 mr-1 rounded-lg bg-surface-base shadow-sm dark:m-0 dark:rounded-none dark:border-l dark:shadow-none'

// While the settings dialog is open the URL is /settings/*, but the page it was
// opened over stays rendered behind the overlay (see App.vue's displayedRoute).
// Drive the layout off that background page so the sidebar and rail state don't
// change when settings opens over a community.
const effectiveRoute = computed(() => {
  if (!route.matched.some((record) => record.meta?.settingsOverlay)) return route
  return router.resolve(settingsBackgroundPath.value || getHomeRoute())
})

const onCommunityRoute = computed(() => {
  return effectiveRoute.value.matched.some((record) => record.meta?.communityScope)
})
</script>
