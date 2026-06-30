<template>
  <div :class="rowClass">
    <div class="flex min-w-0 items-center gap-2">
      <CommunityImageUploader :community="community" class="shrink-0" />

      <div class="min-w-0">
        <div class="truncate text-base-medium text-ink-gray-7">
          {{ community.title }}
        </div>
        <div class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-base text-ink-gray-5 md:hidden">
          <Button
            size="xs"
            variant="ghost"
            :label="spacesLabel"
            icon-right="lucide-arrow-up-right text-ink-gray-5"
            @click="emit('view-spaces', community.name)"
          />
          <Button
            size="xs"
            variant="ghost"
            :label="membersLabel"
            icon-right="lucide-arrow-up-right text-ink-gray-5"
            @click="emit('view-members', community.name)"
          />
          <span class="inline-flex items-center gap-1">
            <span :class="[visibilityIcon(community.is_private), 'size-3.5']" />
            {{ visibilityLabel(community.is_private) }}
          </span>
        </div>
      </div>
    </div>

    <div class="hidden md:block">
      <Button
        size="xs"
        variant="ghost"
        :label="spacesLabel"
        icon-right="lucide-arrow-up-right text-ink-gray-5"
        @click="emit('view-spaces', community.name)"
      />
    </div>
    <div class="hidden md:block">
      <Button
        size="xs"
        variant="ghost"
        :label="membersLabel"
        icon-right="lucide-arrow-up-right text-ink-gray-5"
        @click="emit('view-members', community.name)"
      />
    </div>
    <div class="hidden justify-end md:flex">
      <CommunityOptions
        :community="community"
        @view-spaces="emit('view-spaces', community.name)"
        @view-members="emit('view-members', community.name)"
        @merged="emit('merged', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import type { Community } from '@/data/communities'
import { visibilityIcon, visibilityLabel } from '@/utils/visibility'
import CommunityImageUploader from './CommunityImageUploader.vue'
import CommunityOptions from './CommunityOptions.vue'

const props = defineProps<{
  community: Community
  spacesCount: number
}>()

const emit = defineEmits<{
  (event: 'view-spaces', communityId: string): void
  (event: 'view-members', communityId: string): void
  (event: 'merged', communityId: string): void
}>()

const rowClass = [
  'grid grid-cols-[minmax(0,1fr)] items-center h-10',
  'md:grid-cols-[minmax(12rem,6fr)_minmax(6rem,1.2fr)_minmax(6rem,1.2fr)_1.5rem] md:gap-12',
]

const spacesLabel = computed(() => formatCount(props.spacesCount, 'space'))
const membersLabel = computed(() => formatCount(props.community.members?.length || 0, 'user'))

function formatCount(count: number, label: string) {
  return `${count} ${count === 1 ? label : `${label}s`}`
}
</script>
