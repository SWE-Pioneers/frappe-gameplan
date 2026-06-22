<template>
  <span
    v-if="count > 0"
    ref="referenceEl"
    aria-hidden="true"
    class="pointer-events-none absolute -top-3 right-2 size-0"
  />

  <Teleport to="body">
    <span
      v-if="count > 0"
      ref="floatingEl"
      class="pointer-events-none"
      :class="{ invisible: !isPositioned || isReferenceHidden }"
      :style="floatingStyles"
    >
      <Badge
        variant="solid"
        theme="amber"
        size="sm"
        aria-hidden="true"
        class="min-w-4 justify-center shadow-sm"
      >
        {{ formattedCount }}
      </Badge>
    </span>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { autoUpdate, hide, useFloating } from '@floating-ui/vue'
import { Badge } from 'frappe-ui'
import { formatUnreadCount } from '@/utils/formatters'

const props = defineProps<{
  count: number
}>()

const referenceEl = useTemplateRef<HTMLElement>('referenceEl')
const floatingEl = useTemplateRef<HTMLElement>('floatingEl')

const isOpen = computed(() => props.count > 0)
const formattedCount = computed(() => formatUnreadCount(props.count))

const { floatingStyles, isPositioned, middlewareData } = useFloating(referenceEl, floatingEl, {
  open: isOpen,
  placement: 'bottom-start',
  strategy: 'fixed',
  transform: false,
  middleware: [hide()],
  whileElementsMounted: autoUpdate,
})

const isReferenceHidden = computed(() => Boolean(middlewareData.value.hide?.referenceHidden))
</script>
