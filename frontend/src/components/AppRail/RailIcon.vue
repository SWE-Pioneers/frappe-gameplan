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
        :class="isActive ? '!bg-surface-base shadow-sm' : ''"
        @click="emit('click')"
      >
        <template #suffix>
          <UnreadBadge :count="unreadCount ?? 0" />
        </template>
      </Button>
    </TooltipTrigger>
    <TooltipBubble side="right">
      <template #content>
        <div class="leading-relaxed">{{ label }}</div>
      </template>
    </TooltipBubble>
  </TooltipRoot>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TooltipRoot, TooltipTrigger } from 'reka-ui'
import { Button, TooltipBubble } from 'frappe-ui'
import { unreadAriaLabel } from '@/utils/formatters'
import UnreadBadge from './UnreadBadge.vue'

const props = defineProps<{
  label: string
  icon: string
  isActive: boolean
  unreadCount?: number
}>()

const emit = defineEmits<{ click: [] }>()

const ariaLabel = computed(() => unreadAriaLabel(props.label, props.unreadCount ?? 0))
</script>
