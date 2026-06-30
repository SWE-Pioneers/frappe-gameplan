<template>
  <div class="body-container py-8">
    <EmptyStateBox class="mx-auto max-w-2xl px-6">
      <LucideFolderX class="mb-3 size-7 text-ink-gray-4" />
      <div class="text-base text-ink-gray-7">No communities available</div>
      <p class="mt-2 max-w-md text-center text-p-sm text-ink-gray-5">
        {{
          canManageCommunities
            ? 'Create or unarchive a community so your team can start collaborating.'
            : 'Ask a Gameplan Admin to create or unarchive a community so you can start collaborating.'
        }}
      </p>
      <Button
        v-if="canManageCommunities"
        class="mt-4"
        variant="solid"
        icon-left="lucide-building-2"
        @click="showCommunitiesSettings()"
      >
        Manage communities
      </Button>
    </EmptyStateBox>
  </div>
</template>

<script setup lang="ts">
import { Button, usePageMeta } from 'frappe-ui'
import EmptyStateBox from '@/components/EmptyStateBox.vue'
import { useCanManageCommunities } from '@/composables/useCanManageCommunities'
import { showCommunitiesSettings } from '@/components/Settings'

const canManageCommunities = useCanManageCommunities()

usePageMeta(() => {
  return {
    title: 'No communities available',
  }
})
</script>
