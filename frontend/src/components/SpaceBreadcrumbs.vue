<template>
  <Breadcrumbs class="space-breadcrumbs" :items="breadcrumbItems">
    <template #prefix="{ item }">
      <component :is="item.prefix" v-if="item.prefix" class="mr-1.5 size-5 text-ink-gray-6" />
    </template>
    <template #suffix="{ item }">
      <span v-if="item.suffix" :class="[item.suffix, 'ml-1.5 size-3.5 text-ink-gray-6']" />
    </template>
  </Breadcrumbs>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { Breadcrumbs } from 'frappe-ui'
import { useSpace } from '@/data/spaces'
import type { RouteLocationRaw } from 'vue-router'
import SpaceIcon from './SpaceIcon.vue'

const props = defineProps<{
  spaceId: string
  items?: {
    label: string
    route?: RouteLocationRaw
    suffix?: any
    prefix?: any
    onClick?: () => void
  }[]
}>()

const space = useSpace(() => props.spaceId)

const breadcrumbItems = computed(() => {
  const crumbs = []
  if (space.value?.team) {
    crumbs.push({
      label: space.value.team_title,
      route: { name: 'Discussions', params: { communityId: space.value.team } },
    })
  }
  crumbs.push({
    label: space.value?.title,
    prefix: h(SpaceIcon, { icon: space.value?.icon }),
    suffix: space.value?.is_private ? 'lucide-lock' : null,
    route: space.value
      ? { name: 'Space', params: { communityId: space.value.team, spaceId: space.value.name } }
      : undefined,
  })
  crumbs.push(...(props.items || []))
  return crumbs
})
</script>

<style>
button:has(span.font-\[emoji\]) {
  align-items: baseline;
}
</style>
