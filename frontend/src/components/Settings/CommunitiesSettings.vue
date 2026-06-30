<template>
  <SettingsPanel>
    <SettingsHeader>
      <div class="w-full max-w-[800px]">
        <!-- Selected community: back button, title, and the Spaces/Users switcher. -->
        <template v-if="selectedCommunityId">
          <div class="flex items-center gap-2">
            <Button
              variant="subtle"
              size="xs"
              icon="lucide-chevron-left"
              aria-label="Back to communities"
              @click="showCommunities"
            />
            <h2 class="min-w-0 truncate text-lg-semibold text-ink-gray-8">
              {{ selectedCommunity?.title || 'Community' }}
            </h2>
            <Select
              variant="ghost"
              v-if="selectedCommunity"
              :options="viewButtons"
              v-model="view"
            />
          </div>

          <CommunitySpacesListControls
            v-if="selectedCommunity && view === 'spaces'"
            class="mt-4"
            :community-id="selectedCommunityId"
            v-model:search="spaceSearch"
            v-model:visibility-filter="spaceFilter"
          >
            <template #action>
              <Button
                icon-left="lucide-plus"
                :disabled="!canCreateSpace"
                @click="openNewSpaceDialog"
              >
                New space
              </Button>
            </template>
          </CommunitySpacesListControls>

          <CommunityMembersListControls
            v-if="selectedCommunity && view === 'members'"
            class="mt-4"
            :has-members="selectedCommunity.members.length > 0"
            v-model:search="memberSearch"
          >
            <template #action>
              <Button
                v-if="canManageSelectedCommunity"
                icon-left="lucide-plus"
                :disabled="Boolean(selectedCommunity.archived_at)"
                @click="showAddMembers = true"
              >
                Add users
              </Button>
            </template>
          </CommunityMembersListControls>
        </template>

        <!-- Communities list -->
        <template v-else>
          <h2 class="text-lg-semibold text-ink-gray-8">Communities</h2>

          <div class="mt-4 flex items-center justify-between gap-3">
            <CommunitiesListFilters
              v-model:search="search"
              v-model:visibility-filter="visibilityFilter"
            />
            <Button
              v-if="showNewCommunityButton"
              icon-left="lucide-plus"
              @click="newCommunityDialog = true"
            >
              New community
            </Button>
          </div>

          <!-- Fixed column header, aligned with CommunityRow's grid. -->
          <div
            v-if="manageableCommunities.length"
            class="mt-3 hidden grid-cols-[minmax(12rem,6fr)_minmax(6rem,1.2fr)_minmax(6rem,1.2fr)_1.5rem] items-center gap-12 border-b h-8 text-sm text-ink-gray-5 md:grid"
          >
            <div>Community</div>
            <div class="px-1.5">Spaces</div>
            <div class="px-1.5">Users</div>
            <div />
          </div>
        </template>
      </div>
    </SettingsHeader>

    <NewCommunityDialog v-model="newCommunityDialog" @created="openCommunitySpaces" />
    <NewSpaceDialog v-model="newSpaceDialog" :locked-community-id="selectedCommunityId || ''" />

    <SettingsBody>
      <div class="w-full max-w-[800px] pt-0">
        <template v-if="selectedCommunityId">
          <ConfigureEmptyState
            v-if="!selectedCommunity"
            icon="lucide-circle-alert"
            title="Community not found"
            description="This community may have been archived, deleted, or moved."
          >
            <template #actions>
              <Button @click="showCommunities">View communities</Button>
            </template>
          </ConfigureEmptyState>

          <template v-else>
            <CommunityMembersList
              v-if="view === 'members'"
              :community="selectedCommunity"
              :can-manage="canManageSelectedCommunity"
              :show-controls="false"
              v-model:search="memberSearch"
              v-model:show-add-dialog="showAddMembers"
            />
            <CommunitySpacesList
              v-else
              :community-id="selectedCommunityId"
              :can-create-space="canCreateSpace"
              :show-controls="false"
              v-model:search="spaceSearch"
              v-model:visibility-filter="spaceFilter"
              @create-space="openNewSpaceDialog"
            />
          </template>
        </template>

        <CommunitiesList
          v-else
          :show-controls="false"
          v-model:search="search"
          v-model:visibility-filter="visibilityFilter"
          @create-community="newCommunityDialog = true"
          @view-spaces="openCommunitySpaces"
          @view-members="openCommunityMembers"
          @community-merged="openCommunitySpaces"
        />
      </div>
    </SettingsBody>
  </SettingsPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, SettingsBody, SettingsHeader, SettingsPanel, Select } from 'frappe-ui'
import NewSpaceDialog from '@/components/NewSpaceDialog.vue'
import { communities } from '@/data/communities'
import { useSessionUser } from '@/data/users'
import { canManageCommunity, getManageableCommunities, isGlobalAdmin } from '@/utils/permissions'
import CommunitiesList from '@/pages/Configure/CommunitiesList.vue'
import CommunitiesListFilters from '@/pages/Configure/CommunitiesListFilters.vue'
import ConfigureEmptyState from '@/pages/Configure/ConfigureEmptyState.vue'
import CommunityMembersList from '@/pages/Configure/CommunityMembersList.vue'
import CommunityMembersListControls from '@/pages/Configure/CommunityMembersListControls.vue'
import CommunitySpacesList from '@/pages/Configure/CommunitySpacesList.vue'
import CommunitySpacesListControls from '@/pages/Configure/CommunitySpacesListControls.vue'
import NewCommunityDialog from '@/pages/Configure/NewCommunityDialog.vue'
import { communitiesTarget } from './index'

type CommunityView = 'spaces' | 'members'

const sessionUser = useSessionUser()
const selectedCommunityId = ref<string | null>(null)
const view = ref<CommunityView>('spaces')
// Filter state; controls live in the fixed header for each view.
const search = ref('')
const visibilityFilter = ref<'All' | 'Public' | 'Private' | 'Archived'>('All')
const spaceSearch = ref('')
const spaceFilter = ref<'All' | 'Public' | 'Private' | 'Archived'>('All')
const memberSearch = ref('')
const showAddMembers = ref(false)
const newSpaceDialog = ref(false)
const newCommunityDialog = ref(false)

const viewButtons = [
  { label: 'Spaces', value: 'spaces' },
  { label: 'Users', value: 'members' },
]

const selectedCommunity = computed(() => {
  if (!selectedCommunityId.value) return null
  return (communities.data || []).find((community) => community.name === selectedCommunityId.value)
})
const manageableCommunities = computed(() =>
  getManageableCommunities(communities.data || [], sessionUser),
)
const canManageSelectedCommunity = computed(() =>
  canManageCommunity(selectedCommunity.value, sessionUser),
)
const showNewCommunityButton = computed(
  () => !selectedCommunityId.value && isGlobalAdmin(sessionUser),
)
const canCreateSpace = computed(() =>
  Boolean(
    selectedCommunity.value &&
      canManageSelectedCommunity.value &&
      !selectedCommunity.value.archived_at,
  ),
)
watch(selectedCommunity, (community) => {
  if (selectedCommunityId.value && !community && communities.isFinished) {
    selectedCommunityId.value = null
  }
})

function openCommunitySpaces(communityId: string) {
  selectedCommunityId.value = communityId
  view.value = 'spaces'
  resetCommunityFilters()
}

function openCommunityMembers(communityId: string) {
  selectedCommunityId.value = communityId
  view.value = 'members'
  resetCommunityFilters()
}

function showCommunities() {
  selectedCommunityId.value = null
  view.value = 'spaces'
  resetCommunityFilters()
}

// Clear a community's search/filter state when entering or leaving it.
function resetCommunityFilters() {
  spaceSearch.value = ''
  spaceFilter.value = 'All'
  memberSearch.value = ''
}

// Apply a deep-link target (community + view) when a caller opens this tab via
// showCommunitiesSettings(). Runs on mount and whenever the target changes.
watch(
  communitiesTarget,
  () => {
    selectedCommunityId.value = communitiesTarget.value.communityId
    view.value = communitiesTarget.value.view
    resetCommunityFilters()
  },
  { immediate: true },
)

function openNewSpaceDialog() {
  if (!canCreateSpace.value) return
  newSpaceDialog.value = true
}
</script>
