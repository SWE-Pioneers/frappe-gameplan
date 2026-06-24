<template>
  <div class="flex min-h-0 flex-col">
    <div class="flex items-center justify-between">
      <h2 class="text-3xl-semibold leading-none text-ink-gray-9">Members</h2>
      <div class="flex items-center gap-2">
        <Button icon-left="lucide-user-plus" @click="showInviteDialog = true">Invite</Button>
        <!-- Search (12.5rem) and the select (w-40) stay flush-right so their left
             edges align with the Role and Member-since columns below. The Invite
             button sits to their left so it doesn't shift them off-axis. -->
        <FormControl
          class="w-[12.5rem]"
          placeholder="Search"
          @input="search = $event.target.value"
          :debounce="300"
        >
          <template #prefix>
            <span class="lucide-search h-4 w-4 text-ink-gray-4" />
          </template>
        </FormControl>
        <Select class="w-40" :options="sortOptions" v-model="orderBy">
          <template #prefix>
            <span class="lucide-arrow-down-up h-4 w-4 text-ink-gray-5" />
          </template>
        </Select>
      </div>
    </div>
    <button
      v-if="pendingInvites.data?.length"
      class="mt-4 flex items-center justify-between gap-3 rounded bg-surface-gray-2 px-3 py-2 text-left transition-colors hover:bg-surface-gray-3"
      @click="showInviteDialog = true"
    >
      <span class="flex items-center gap-2 text-base text-ink-gray-7">
        <span class="lucide-mail h-4 w-4 text-ink-gray-5" />
        {{ pendingInvitesLabel }}
      </span>
      <span class="text-base text-ink-gray-6">View</span>
    </button>

    <!-- Fixed column header lives outside the scroll viewport so it stays put.
         It shares the rows' fixed grid tracks, so the 1fr column aligns. -->
    <div
      class="mt-6 grid grid-cols-[minmax(0,1fr)_12.5rem_7.5rem_2rem] items-center gap-2 border-b h-8 text-sm text-ink-gray-5"
    >
      <div>Member</div>
      <div>Role</div>
      <div>Member since</div>
      <div />
    </div>
    <!-- ScrollAreaRoot bleeds to the dialog edge (-mr-16) so the custom
         ScrollBar sits there; the viewport re-insets content with pr-16. -->
    <ScrollAreaRoot class="relative -mr-16 min-h-0 flex-1">
      <ScrollAreaViewport class="h-full w-full overflow-auto pb-16 pr-16">
        <div class="divide-y">
          <div
            class="grid grid-cols-[minmax(0,1fr)_12.5rem_7.5rem_2rem] items-center gap-2 py-2"
            v-for="user in filteredUsers"
            :key="user.name"
          >
            <div class="flex min-w-0 items-center">
              <UserAvatar :user="user.name" size="xl" />
              <div class="ml-3 min-w-0">
                <div class="truncate text-base text-ink-gray-8">
                  {{ user.full_name }}
                </div>
                <div class="mt-1 truncate text-base text-ink-gray-6">
                  {{ user.email }}
                </div>
              </div>
            </div>
            <div class="flex justify-start">
              <Select
                placeholder="Role"
                :options="roleOptions"
                :model-value="user.role"
                @update:model-value="(role) => onRoleChange(user, role)"
              />
            </div>
            <div class="text-base text-ink-gray-6">
              <span v-if="user.creation">{{ getMemberSince(user) }}</span>
            </div>
            <div class="flex justify-end">
              <Button
                variant="ghost"
                icon="lucide-trash-2"
                :label="`Disable ${user.full_name}`"
                @click="disableUser(user)"
              />
            </div>
          </div>
        </div>
      </ScrollAreaViewport>
      <ScrollBar />
    </ScrollAreaRoot>

    <Dialog v-model:open="showInviteDialog">
      <InvitePeople />
    </Dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Button,
  Dialog,
  FormControl,
  Select,
  dialog,
  dayjsLocal,
  useCall,
  useList,
} from 'frappe-ui'
import { ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui'
import ScrollBar from '@/components/ScrollBar.vue'
import InvitePeople from './InvitePeople.vue'
import { users, activeUsers } from '@/data/users'
import { GPInvitation } from '@/types/doctypes'

type Member = (typeof activeUsers.value)[number]

const roleOptions = [
  { label: 'Admin', value: 'Gameplan Admin', icon: 'lucide-shield-check' },
  { label: 'Member', value: 'Gameplan Member', icon: 'lucide-user' },
  { label: 'Guest', value: 'Gameplan Guest', icon: 'lucide-user-round' },
]

// Index used to rank roles (Admin first) when sorting by role.
const roleRank: Record<string, number> = Object.fromEntries(
  roleOptions.map((option, index) => [option.value, index]),
)

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Role', value: 'role' },
  { label: 'Newest', value: 'newest' },
]

const search = ref('')
const orderBy = ref('name')
const showInviteDialog = ref(false)

const pendingInvites = useList<GPInvitation>({
  doctype: 'GP Invitation',
  fields: ['name'],
  filters: { status: 'Pending' },
  cacheKey: 'pending-invitations',
})
const pendingInvitesLabel = computed(() => {
  const count = pendingInvites.data?.length ?? 0
  return `${count} pending invite${count === 1 ? '' : 's'}`
})

// Invites are sent/revoked inside the dialog, so refresh the count on close.
watch(showInviteDialog, (open, wasOpen) => {
  if (wasOpen && !open) pendingInvites.reload()
})

// `users` is a useCall resource (no setData); refetch after mutations so the
// list — role labels and membership — reflects the server-side change.
const changeUserRoleCall = useCall({
  url: 'gameplan.api.change_user_role',
  immediate: false,
  onSuccess: () => users.reload(),
})
// Backend endpoint is named remove_user, but it disables the account
// (sets enabled = 0) rather than deleting it.
const disableUserCall = useCall({
  url: 'gameplan.api.remove_user',
  immediate: false,
  onSuccess: () => users.reload(),
})

const filteredUsers = computed(() => {
  let list = activeUsers.value
  if (search.value) {
    const term = search.value.toLowerCase()
    list = list.filter(
      (user) =>
        user.name.toLowerCase().includes(term) || user.full_name.toLowerCase().includes(term),
    )
  }
  return [...list].sort(compareUsers)
})

function compareUsers(a: Member, b: Member) {
  if (orderBy.value === 'role') {
    const rankA = roleRank[a.role] ?? Number.MAX_SAFE_INTEGER
    const rankB = roleRank[b.role] ?? Number.MAX_SAFE_INTEGER
    if (rankA !== rankB) return rankA - rankB
  } else if (orderBy.value === 'newest') {
    // Newest first; users without a creation date sort last.
    return (b.creation || '').localeCompare(a.creation || '')
  }
  return (a.full_name || '').localeCompare(b.full_name || '')
}

function getMemberSince(user: Member) {
  return dayjsLocal(user.creation).format('MMM YYYY')
}

function changeUserRole(user: Member, role: string) {
  dialog.confirm({
    title: 'Change Role',
    message: `Are you sure you want to change ${user.full_name}'s role to ${role}?`,
    confirmLabel: 'Change Role',
    onConfirm: () => changeUserRoleCall.submit({ user: user.name, role }),
  })
}

function onRoleChange(user: Member, role: string) {
  const isValidRole = roleOptions.some((option) => option.value === role)
  if (!isValidRole || role === user.role) return
  changeUserRole(user, role)
}

function disableUser(user: Member) {
  dialog.danger({
    title: 'Disable user',
    message: `${user.full_name} (${user.email}) will be disabled and can no longer sign in to Gameplan. You can re-enable them later from the Frappe admin.`,
    confirmLabel: 'Disable',
    onConfirm: () => disableUserCall.submit({ user: user.name }),
  })
}
</script>
