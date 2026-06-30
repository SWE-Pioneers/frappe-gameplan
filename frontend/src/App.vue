<template>
  <FrappeUIProvider>
    <ScrollAreaRoot class="h-full overflow-hidden">
      <router-view v-if="['Onboarding', 'Login'].includes($route.name)" />
      <Layout v-else-if="$session.isLoggedIn">
        <!-- While on a /settings/* URL, keep rendering the page the dialog was
             opened over (displayedRoute) so it stays visible behind the overlay. -->
        <router-view :route="displayedRoute" />
      </Layout>
    </ScrollAreaRoot>
    <NewTaskDialog />
    <SettingsDialog v-if="$session.isLoggedIn && users.isFinished" />
  </FrappeUIProvider>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FrappeUIProvider } from 'frappe-ui'
import { ScrollAreaRoot } from 'reka-ui'
import { users } from '@/data/users'
import { session } from '@/data/session'
import { useScreenSize } from '@/composables/useScreenSize'
import { useTheme } from '@/utils/useTheme'
import NewTaskDialog from './components/NewTaskDialog/NewTaskDialog.vue'
import SettingsDialog from './components/Settings/SettingsDialog.vue'
import { settingsBackgroundPath } from './components/Settings'
import { getHomeRoute } from '@/router'

const screenSize = useScreenSize()
const route = useRoute()
const router = useRouter()
useTheme()
const MobileLayout = defineAsyncComponent(() => import('./components/MobileLayout.vue'))
const DesktopLayout = defineAsyncComponent(() => import('./components/DesktopLayout.vue'))
const Layout = computed(() => {
  if (screenSize.width < 640) {
    return MobileLayout
  } else {
    return DesktopLayout
  }
})

users.fetch()

// On a /settings/* URL, render the page the dialog was opened over (or Home on a
// cold load) behind the overlay; otherwise render the current route normally.
const displayedRoute = computed(() => {
  if (!route.matched.some((r) => r.meta?.settingsOverlay)) return route
  return router.resolve(settingsBackgroundPath.value || getHomeRoute())
})

// Back-compat: ?settings=notifications deep links now redirect to the canonical
// settings URL.
watch(
  () => [route.query.settings, session.isLoggedIn, users.isFinished],
  async ([settings]) => {
    if (settings !== 'notifications' || !session.isLoggedIn || !users.isFinished) return

    await nextTick()
    router.replace({ name: 'SettingsTab', params: { tab: 'notifications' } })
  },
  { immediate: true },
)
</script>
