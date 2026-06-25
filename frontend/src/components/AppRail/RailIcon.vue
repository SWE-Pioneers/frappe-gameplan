<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :icon="icon"
        :label="ariaLabel"
        :aria-current="isActive ? 'page' : undefined"
        class="relative"
        :class="isActive ? '!bg-surface-elevation-3 shadow-sm' : ''"
        @click="emit('click')"
      >
        <template #suffix>
          <UnreadBadge :count="unreadCount ?? 0" :style="badgeStyle" />
        </template>
      </Button>
    </TooltipTrigger>
    <TooltipBubble side="right">
      <template #content>
        <div class="leading-relaxed">
          <div>{{ label }}</div>
          <div v-if="showTooltipUnreadCount" class="text-p-sm text-ink-gray-5">
            {{ tooltipUnreadCount }}
          </div>
        </div>
      </template>
    </TooltipBubble>
  </TooltipRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TooltipRoot, TooltipTrigger } from 'reka-ui'
import { Button, TooltipBubble } from 'frappe-ui'
import type { SidebarBadgeStyle } from '@/data/sidebarPreferences'
import { unreadAriaLabel } from '@/utils/formatters'
import UnreadBadge from './UnreadBadge.vue'

const props = defineProps<{
  label: string
  icon: string
  isActive: boolean
  unreadCount?: number
  badgeStyle: SidebarBadgeStyle
}>()

const emit = defineEmits<{ click: [] }>()

const ariaLabel = computed(() => unreadAriaLabel(props.label, props.unreadCount ?? 0))
const showTooltipUnreadCount = computed(() => {
  return props.badgeStyle === 'Dot' && (props.unreadCount ?? 0) > 0
})
const tooltipUnreadCount = computed(() => `${props.unreadCount ?? 0} unread`)
</script>
