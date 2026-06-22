<template>
  <Dialog v-model:open="show" title="Customize sidebar" size="md" @close="saveOnClose">
    <div class="space-y-5">
      <p class="text-p-base text-ink-gray-6">
        Drag communities between sections. Changes are saved automatically when you close this
        dialog.
      </p>

      <div v-if="manageableCommunities.length > 0" class="space-y-5">
        <section class="space-y-2">
          <h3 class="text-base font-medium text-ink-gray-8">Shown in sidebar</h3>
          <div
            ref="shownSection"
            :class="getCommunityListClasses('shown')"
            @dragenter.prevent="hoveredDropSection = 'shown'"
            @dragover.prevent
            @drop.prevent="dropCommunityInSection('shown')"
          >
            <div class="space-y-0.5">
              <Motion
                v-for="community in selectedManageableCommunities"
                :key="community.name"
                as="div"
                layout="position"
                :transition="communityRowTransition"
                draggable="true"
                class="relative flex min-h-9 w-full cursor-grab select-none items-center gap-2.5 rounded-md px-2 py-1 text-left text-ink-gray-8 transition hover:bg-surface-base active:cursor-grabbing"
                :class="draggedCommunityName === community.name ? 'opacity-40' : ''"
                @dragstart="startCommunityDrag($event, community.name)"
                @dragover.prevent="reorderDraggedCommunity($event, community.name)"
                @dragend="finishCommunityDrag"
              >
                <span
                  class="lucide-grip-vertical size-4 shrink-0 text-ink-gray-4"
                  aria-hidden="true"
                />
                <CommunityImage :community="community" class="size-5 shrink-0 bg-surface-gray-1" />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5 text-base">
                    <span class="truncate">{{ community.title }}</span>
                    <span
                      v-if="community.is_private"
                      class="lucide-lock size-3.5 shrink-0 text-ink-gray-5"
                    />
                  </span>
                </span>
              </Motion>
            </div>

            <div
              v-if="selectedManageableCommunities.length === 0"
              class="px-3 py-6 text-center text-p-sm text-ink-gray-5"
            >
              No communities shown
            </div>
          </div>
        </section>

        <section class="space-y-2">
          <h3 class="text-base font-medium text-ink-gray-8">Hidden from sidebar</h3>
          <div
            ref="hiddenSection"
            :class="getCommunityListClasses('hidden')"
            @dragenter.prevent="hoveredDropSection = 'hidden'"
            @dragover.prevent
            @drop.prevent="dropCommunityInSection('hidden')"
          >
            <Motion
              v-for="community in hiddenManageableCommunities"
              :key="community.name"
              as="div"
              layout="position"
              :transition="communityRowTransition"
              draggable="true"
              class="relative flex min-h-9 w-full cursor-grab select-none items-center gap-2.5 rounded-md px-2 py-1 text-left text-ink-gray-6 transition hover:bg-surface-base active:cursor-grabbing"
              :class="draggedCommunityName === community.name ? 'opacity-40' : ''"
              @dragstart="startCommunityDrag($event, community.name)"
              @dragend="finishCommunityDrag"
            >
              <span
                class="lucide-grip-vertical size-4 shrink-0 text-ink-gray-4"
                aria-hidden="true"
              />
              <CommunityImage
                :community="community"
                class="size-5 shrink-0 bg-surface-gray-1 opacity-70"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5 text-base">
                  <span class="truncate">{{ community.title }}</span>
                  <span
                    v-if="community.is_private"
                    class="lucide-lock size-3.5 shrink-0 text-ink-gray-5"
                  />
                </span>
              </span>
            </Motion>

            <div
              v-if="hiddenManageableCommunities.length === 0"
              class="px-3 py-6 text-center text-p-sm text-ink-gray-5"
            >
              No hidden communities
            </div>
          </div>
        </section>
      </div>

      <div v-else class="px-3 py-6 text-center text-p-sm text-ink-gray-5">No communities found</div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Dialog, toast, useCall } from 'frappe-ui'
import { Motion } from 'motion-v'
import { communityState } from '@/data/communityState'
import { activeCommunities, availableCommunities, communities } from '@/data/communities'
import type { Community } from '@/data/communities'
import { setCommunityOrder } from '@/data/communityOrder'
import { isGameplanAdmin, users } from '@/data/users'
import CommunityImage from '../CommunityImage.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const route = useRoute()
const router = useRouter()
const selectedCommunityNames = ref<string[]>([])
const initialCommunityNames = ref<string[]>([])
const draggedCommunityName = ref<string | null>(null)
const hoveredDropSection = ref<CommunitySection | null>(null)
const communityRowTransition = {
  layout: { duration: 0.14, ease: [0.16, 1, 0.3, 1] },
}

type CommunitySection = 'shown' | 'hidden'

const show = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const manageableCommunities = computed(() => {
  return availableCommunities.value.filter((community) => !community.archived_at)
})

const selectedManageableCommunities = computed(() => {
  let communitiesByName = new Map(
    manageableCommunities.value.map((community) => [community.name, community]),
  )

  return selectedCommunityNames.value
    .map((name) => communitiesByName.get(name))
    .filter((community): community is Community => community !== undefined)
})

const hiddenManageableCommunities = computed(() => {
  let selectedCommunitySet = new Set(selectedCommunityNames.value)
  return manageableCommunities.value.filter(
    (community) => !selectedCommunitySet.has(community.name),
  )
})

const updateJoinedTeams = useCall<string[], { teams: string[] }>({
  url: '/api/v2/method/GP Team/update_joined_teams',
  method: 'POST',
  immediate: false,
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedCommunityNames.value = activeCommunities.value.map((community) => community.name)
      initialCommunityNames.value = [...selectedCommunityNames.value]
    }
  },
)

function startCommunityDrag(event: DragEvent, communityName: string) {
  draggedCommunityName.value = communityName
  event.dataTransfer?.setData('text/plain', communityName)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function reorderDraggedCommunity(event: DragEvent, targetCommunityName: string) {
  let communityName = draggedCommunityName.value
  if (!communityName || communityName === targetCommunityName) return
  if (!selectedCommunityNames.value.includes(communityName)) return

  let targetElement = event.currentTarget as HTMLElement
  let targetRect = targetElement.getBoundingClientRect()
  let placement = event.clientY < targetRect.top + targetRect.height / 2 ? 'before' : 'after'

  moveCommunityAroundTarget(communityName, targetCommunityName, placement)
}

function dropCommunityInSection(section: CommunitySection) {
  let communityName = draggedCommunityName.value
  if (!communityName) return
  moveCommunityToSection(communityName, section)
  finishCommunityDrag()
}

function finishCommunityDrag() {
  draggedCommunityName.value = null
  hoveredDropSection.value = null
}

function moveCommunityToSection(communityName: string, section: CommunitySection) {
  if (section === 'shown') {
    if (!selectedCommunityNames.value.includes(communityName)) {
      selectedCommunityNames.value = [...selectedCommunityNames.value, communityName]
    }
    return
  }

  if (!selectedCommunityNames.value.includes(communityName)) return
  if (selectedCommunityNames.value.length === 1) {
    toast.error('Select at least one community')
    return
  }

  selectedCommunityNames.value = selectedCommunityNames.value.filter(
    (name) => name !== communityName,
  )
}

function moveCommunityAroundTarget(
  communityName: string,
  targetCommunityName: string,
  placement: 'before' | 'after',
) {
  let communityNames = [...selectedCommunityNames.value]
  let sourceIndex = communityNames.indexOf(communityName)
  let targetIndex = communityNames.indexOf(targetCommunityName)
  if (sourceIndex === -1 || targetIndex === -1) return

  communityNames.splice(sourceIndex, 1)
  targetIndex = communityNames.indexOf(targetCommunityName)
  communityNames.splice(placement === 'before' ? targetIndex : targetIndex + 1, 0, communityName)
  selectedCommunityNames.value = communityNames
}

function getCommunityListClasses(section: CommunitySection) {
  return [
    'min-h-16 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-1 transition-colors',
    hoveredDropSection.value === section && draggedCommunityName.value
      ? 'border-outline-gray-4 bg-surface-gray-2'
      : '',
  ]
}

async function saveOnClose() {
  if (haveSameOrderedCommunityNames(selectedCommunityNames.value, initialCommunityNames.value))
    return

  if (selectedCommunityNames.value.length === 0) {
    toast.error('Select at least one community')
    return
  }

  let previousCommunityId = communityState.id

  try {
    await updateJoinedTeams.submit({ teams: selectedCommunityNames.value })
    setCommunityOrder(selectedCommunityNames.value)
    await users.reload()
    await communities.reload()

    if (previousCommunityId && !selectedCommunityNames.value.includes(previousCommunityId)) {
      let nextCommunity = activeCommunities.value[0]
      communityState.change(nextCommunity?.name ?? null)

      if (route.matched.some((record) => record.meta?.communityScope)) {
        let fallback = isGameplanAdmin() ? { name: 'Spaces' } : { name: 'NoCommunities' }
        router.push(
          nextCommunity
            ? { name: 'Discussions', params: { communityId: nextCommunity.name } }
            : fallback,
        )
      }
    }

    initialCommunityNames.value = [...selectedCommunityNames.value]
    toast.success('Communities updated')
  } catch {
    toast.error('Failed to update communities')
  }
}

function haveSameOrderedCommunityNames(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((name, index) => name === right[index])
}
</script>
