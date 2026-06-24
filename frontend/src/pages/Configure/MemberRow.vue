<template>
  <div :class="rowClass">
    <RouterLink :to="profileRoute" class="contents">
      <UserAvatar :user="member.user" size="sm" class="shrink-0" />

      <div class="min-w-0">
        <div class="truncate text-base-medium text-ink-gray-7">
          {{ user.full_name }}
        </div>
        <div class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-base text-ink-gray-5 md:hidden">
          <span>{{ user.email }}</span>
          <span>{{ roleLabel }}</span>
        </div>
      </div>

      <div class="hidden truncate text-base text-ink-gray-5 md:block">
        {{ user.email }}
      </div>
      <div class="hidden text-base text-ink-gray-5 md:block">
        {{ roleLabel }}
      </div>
    </RouterLink>

    <div class="hidden justify-end md:flex">
      <MemberOptions
        v-if="canManage"
        :community="community"
        :member="member"
        :can-manage="canManage"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useUser } from '@/data/users'
import type { Community, CommunityMember } from '@/data/communities'
import MemberOptions from './MemberOptions.vue'

const props = defineProps<{
  community: Community
  member: CommunityMember
  canManage: boolean
}>()

const rowClass = [
  'grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 h-10 transition-colors',
  'md:grid-cols-[1.25rem_minmax(12rem,1fr)_minmax(12rem,1fr)_8rem_3rem]',
]

const user = computed(() => useUser(props.member.user))
const roleLabel = computed(() => (props.member.is_admin ? 'Community Admin' : 'Member'))
const profileRoute = computed(() => {
  return user.value.user_profile
    ? { name: 'PersonProfileProfile', params: { personId: user.value.user_profile } }
    : { name: 'People' }
})
</script>
