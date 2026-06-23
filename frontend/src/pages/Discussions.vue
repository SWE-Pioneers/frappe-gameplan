<template>
  <MobileHeader v-if="communityState.doc" class="sm:hidden" :title="feedTitle">
    <template #left>
      <MobileBackButton :to="{ name: 'Home' }" label="Communities" />
    </template>
    <button
      type="button"
      class="inline-flex max-w-full items-center gap-1 transition active:opacity-60"
      @click="menuOpen = true"
    >
      <MobileHeaderTitle :title="feedTitle" />
      <span class="size-4 shrink-0 text-ink-gray-5 lucide-chevron-down" aria-hidden="true" />
    </button>
  </MobileHeader>

  <BottomSheet v-model="menuOpen" :title="community?.title || 'Community'">
    <CommunityMenu
      class="pb-6"
      :communityId="communityId"
      :activeFeedType="feedType"
      @navigate="menuOpen = false"
    />
  </BottomSheet>
  <PageHeader class="hidden sm:flex">
    <Breadcrumbs class="h-7" :items="breadcrumbs" />
    <div class="flex items-center gap-2">
      <Select class="shrink-0 !w-fit" :options="orderOptions" v-model="orderBy" />
      <Button
        variant="solid"
        icon-left="lucide-plus"
        :route="{ name: 'NewDiscussion', params: { communityId } }"
      >
        Add new
      </Button>
    </div>
  </PageHeader>
  <div class="body-container pt-5 pb-40">
    <LastPostReminder class="mb-3" />

    <KeepAlive>
      <DiscussionList
        class="-mx-3"
        ref="discussionListRef"
        :filters="filters"
        :orderBy="() => orderBy"
        :cacheKey="`Discussions-${communityId}-${feedType}`"
        :key="JSON.stringify(filters)"
      />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { Breadcrumbs, Button, Select, usePageMeta } from 'frappe-ui'
import type { OrderBy } from 'frappe-ui'
import BottomSheet from '@/components/BottomSheet.vue'
import CommunityMenu from '@/components/CommunityMenu.vue'
import DiscussionList from '@/components/DiscussionList.vue'
import PageHeader from '@/components/PageHeader.vue'
import LastPostReminder from '@/components/LastPostReminder.vue'
import MobileBackButton from '@/components/MobileBackButton.vue'
import MobileHeader from '@/components/MobileHeader.vue'
import MobileHeaderTitle from '@/components/MobileHeaderTitle.vue'
import { communityState } from '@/data/communityState'
import { useCommunity } from '@/data/communities'

type FeedType = 'recent' | 'unread' | 'participating'

interface Props {
  communityId: string
  feedType?: FeedType
}

const props = withDefaults(defineProps<Props>(), {
  feedType: 'recent',
})

const orderBy = ref<OrderBy>('last_post_at desc')
const menuOpen = ref(false)
const discussionListRef = useTemplateRef('discussionListRef')

const filters = computed(() => ({
  team: props.communityId,
  feed_type: props.feedType,
}))

const feedTitles: Record<FeedType, string> = {
  recent: 'All Discussions',
  unread: 'Unread',
  participating: 'Participating',
}

const feedTitle = computed(() => feedTitles[props.feedType])

const community = useCommunity(() => props.communityId)

const breadcrumbs = computed(() => {
  const items = []
  if (community.value) {
    items.push({
      label: community.value.title,
      route: { name: 'Discussions', params: { communityId: props.communityId } },
    })
  }
  items.push({
    label: feedTitle.value,
    route: {
      name: 'DiscussionsTab',
      params: { communityId: props.communityId, feedType: props.feedType },
    },
  })
  return items
})

const orderOptions = [
  {
    label: 'Sort by',
    value: '' as const,
    disabled: true,
  },
  {
    label: 'Newest first',
    value: 'last_post_at desc' as OrderBy,
  },
  {
    label: 'Oldest first',
    value: 'last_post_at asc' as OrderBy,
  },
  {
    label: 'Creation date',
    value: 'creation desc' as OrderBy,
  },
]

usePageMeta(() => ({ title: feedTitle.value }))
</script>
