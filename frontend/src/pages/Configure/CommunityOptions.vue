<template>
  <Dropdown
    :button="{ icon: 'lucide-more-horizontal', size: 'xs', variant: 'ghost' }"
    align="end"
    :label="`${community.title} Community Options`"
    :options="options"
  />

  <MergeCommunityDialog
    v-model="showMergeDialog"
    :community="community"
    @merged="redirectAfterMerge"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dialog, Dropdown, useDoctype } from 'frappe-ui'
import { communities } from '@/data/communities'
import type { Community } from '@/data/communities'
import type { GPTeam } from '@/types/doctypes'
import MergeCommunityDialog from './MergeCommunityDialog.vue'

const props = defineProps<{
  community: Community
}>()

const teams = useDoctype<GPTeam>('GP Team')
const route = useRoute()
const router = useRouter()
const showMergeDialog = ref(false)

const options = computed(() => [
  {
    label: 'View spaces',
    icon: 'lucide-layout-grid',
    route: { name: 'CommunitySpaces', params: { communityId: props.community.name } },
  },
  {
    label: 'View members',
    icon: 'lucide-users-2',
    route: { name: 'CommunityMembers', params: { communityId: props.community.name } },
  },
  {
    label: 'Merge into...',
    icon: 'lucide-merge',
    onClick: () => (showMergeDialog.value = true),
    condition: () => !props.community.archived_at,
  },
  {
    label: 'Unarchive',
    icon: 'lucide-archive-restore',
    onClick: () => updateArchiveState('unarchive'),
    condition: () => Boolean(props.community.archived_at),
  },
  {
    label: 'Archive',
    icon: 'lucide-archive',
    onClick: archiveCommunity,
    condition: () => !props.community.archived_at,
  },
])

function archiveCommunity() {
  dialog.confirm({
    title: 'Archive community',
    message:
      'Archived communities are hidden from active lists and new work should happen elsewhere. You can unarchive this community later.',
    confirmLabel: 'Archive',
    onConfirm: () => updateArchiveState('archive'),
  })
}

async function updateArchiveState(method: 'archive' | 'unarchive') {
  await teams.runDocMethod.submit({
    name: props.community.name,
    method,
  })
  await communities.reload()
}

function redirectAfterMerge(communityId: string) {
  if (route.params.communityId !== props.community.name) return

  router.replace({
    name: route.name ?? 'CommunitySpaces',
    params: {
      ...route.params,
      communityId,
    },
    query: route.query,
  })
}
</script>
