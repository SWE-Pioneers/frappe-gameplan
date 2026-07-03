<template>
  <ListRow class="h-10">
    <ListCell class="gap-2">
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
    </ListCell>

    <ListCell class="max-md:hidden">
      <Button
        size="xs"
        variant="ghost"
        :label="spacesLabel"
        icon-right="lucide-arrow-up-right text-ink-gray-5"
        @click="emit('view-spaces', community.name)"
      />
    </ListCell>
    <ListCell class="max-md:hidden">
      <Button
        size="xs"
        variant="ghost"
        :label="membersLabel"
        icon-right="lucide-arrow-up-right text-ink-gray-5"
        @click="emit('view-members', community.name)"
      />
    </ListCell>
    <ListCell class="justify-end max-md:hidden">
      <CommunityOptions
        :community="community"
        @view-spaces="emit('view-spaces', community.name)"
        @view-members="emit('view-members', community.name)"
        @merged="emit('merged', $event)"
      />
    </ListCell>
  </ListRow>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import { ListCell, ListRow } from 'frappe-ui/list'
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

const spacesLabel = computed(() => formatCount(props.spacesCount, 'space'))
const membersLabel = computed(() => formatCount(props.community.members?.length || 0, 'member'))

function formatCount(count: number, label: string) {
  return `${count} ${count === 1 ? label : `${label}s`}`
}
</script>
