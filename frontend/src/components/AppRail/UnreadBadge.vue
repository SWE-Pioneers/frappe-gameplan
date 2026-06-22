<template>
  <span
    v-if="showCountBadge"
    ref="referenceEl"
    aria-hidden="true"
    class="pointer-events-none absolute -top-3 right-2 size-0"
  />

  <span
    v-if="showDot && count > 0"
    aria-hidden="true"
    class="pointer-events-none absolute -right-0.5 -top-0.5 block size-2 rounded-full bg-surface-amber-6"
  />

  <Teleport to="body">
    <span
      v-if="showCountBadge"
      ref="floatingEl"
      class="pointer-events-none"
      :class="{ invisible: !isPositioned }"
      :style="floatingStyles"
    >
      <Badge
        v-if="style === 'Unread count'"
        variant="solid"
        theme="amber"
        size="sm"
        aria-hidden="true"
      >
        {{ formattedCount }}
      </Badge>
    </span>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { autoUpdate, useFloating } from '@floating-ui/vue'
import { Badge } from 'frappe-ui'
import type { SidebarBadgeStyle } from '@/data/sidebarPreferences'
import { formatUnreadCount } from '@/utils/formatters'

const props = defineProps<{
  count: number
  style: SidebarBadgeStyle
}>()

const referenceEl = useTemplateRef<HTMLElement>('referenceEl')
const floatingEl = useTemplateRef<HTMLElement>('floatingEl')

const showCountBadge = computed(() => props.count > 0 && props.style === 'Unread count')
const showDot = computed(() => props.count > 0 && props.style === 'Dot')
const formattedCount = computed(() => formatUnreadCount(props.count))

const { floatingStyles, isPositioned } = useFloating(referenceEl, floatingEl, {
  open: showCountBadge,
  placement: 'bottom-start',
  strategy: 'fixed',
  transform: false,
  whileElementsMounted: autoUpdate,
})
</script>
