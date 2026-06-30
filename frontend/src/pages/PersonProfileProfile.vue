<template>
  <div class="pb-16">
    <div v-if="!bentoCardsLoaded" class="grid grid-cols-4 gap-3">
      <Skeleton class="col-span-4 aspect-[4/1] rounded-xl" />
      <Skeleton class="col-span-1 aspect-square rounded-xl" />
      <Skeleton class="col-span-1 aspect-square rounded-xl" />
      <Skeleton class="col-span-2 aspect-[2/1] rounded-xl" />
    </div>
    <ProfileBentoGrid v-else-if="hasProfilePage" :cards="bentoCards" />
    <EmptyStateBox v-else class="min-h-[360px] justify-center !border-dotted px-4 text-center">
      <div class="max-w-[460px] space-y-4">
        <div class="space-y-2">
          <h2 class="text-2xl font-semibold text-ink-gray-9">
            {{ isOwnProfile ? 'Build your profile page' : 'No profile page yet' }}
          </h2>
          <p class="text-base leading-7 text-ink-gray-6">
            {{
              isOwnProfile
                ? 'Your profile page is a public space for introducing yourself to the community with cards for your bio, photos, links, and interests.'
                : 'Profile pages are public introductions for the community. This person has not published one yet.'
            }}
          </p>
        </div>
        <Button
          v-if="isOwnProfile"
          variant="solid"
          icon-left="lucide-layout-dashboard"
          :route="{ name: 'ProfileCustomize' }"
        >
          Build Profile Page
        </Button>
      </div>
    </EmptyStateBox>
  </div>
</template>

<script setup lang="ts">
import { Button, Skeleton } from 'frappe-ui'
import EmptyStateBox from '@/components/EmptyStateBox.vue'
import ProfileBentoGrid from '@/components/ProfileBento/ProfileBentoGrid.vue'
import type { ProfileBentoCard } from '@/components/ProfileBento/types'

defineOptions({
  name: 'PersonProfileProfile',
})

defineProps<{
  bentoCards: ProfileBentoCard[]
  bentoCardsLoaded: boolean
  hasProfilePage: boolean
  isOwnProfile: boolean
}>()
</script>
