<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <SettingsHeader>
      <div class="flex flex-col gap-4">
        <h2 class="text-lg-semibold text-ink-gray-8">Users</h2>
        <div class="flex items-center justify-between gap-3">
          <TextInput
            class="w-72"
            placeholder="Search by name or email"
            @input="search = $event.target.value"
            :debounce="300"
          >
            <template #prefix>
              <span class="lucide-search h-4 w-4 text-ink-gray-4" />
            </template>
          </TextInput>
          <Button icon-left="lucide-plus" @click="showInviteDialog = true">Invite</Button>
        </div>
      </div>

      <button
        v-if="pendingInvites.data?.length"
        class="mt-2 flex w-full items-center justify-between gap-3 rounded bg-surface-gray-2 px-3 py-2 text-left transition-colors hover:bg-surface-gray-3"
        @click="showInviteDialog = true"
      >
        <span class="flex items-center gap-2 text-base text-ink-gray-7">
          <span class="lucide-mail h-4 w-4 text-ink-gray-5" />
          {{ pendingInvitesLabel }}
        </span>
        <span class="text-base text-ink-gray-6">View</span>
      </button>

      <div
        class="mt-3 grid grid-cols-[minmax(0,1fr)_12.5rem_7.5rem_2rem] items-center gap-2 border-b h-8 text-sm text-ink-gray-5"
      >
        <SortHeader field="name" label="User" />
        <SortHeader field="role" label="Role" />
        <SortHeader field="creation" label="User since" />
        <div />
      </div>
    </SettingsHeader>

    <SettingsBody>
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
    </SettingsBody>

    <Dialog v-model:open="showInviteDialog">
      <InvitePeople />
    </Dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import { Button, Dialog, Select, Tooltip, dialog, dayjsLocal, useCall, useList } from 'frappe-ui'
import InvitePeople from './InvitePeople.vue'
import SettingsBody from './SettingsBody.vue'
import SettingsHeader from './SettingsHeader.vue'
import { users, activeUsers } from '@/data/users'
import { GPInvitation } from '@/types/doctypes'

type SortField = 'name' | 'role' | 'creation'
type SortDirection = 'asc' | 'desc'
type UserRow = (typeof activeUsers.value)[number]

const roleOptions = [
  { label: 'Admin', value: 'Gameplan Admin', icon: 'lucide-shield-check' },
  { label: 'User', value: 'Gameplan Member', icon: 'lucide-user' },
  { label: 'Guest', value: 'Gameplan Guest', icon: 'lucide-user-lock' },
]

// Index used to rank roles (Admin first) when sorting by role.
const roleRank: Record<string, number> = Object.fromEntries(
  roleOptions.map((option, index) => [option.value, index]),
)

const search = ref('')
const sortField = ref<SortField>('name')
const sortDirection = ref<SortDirection>('asc')
const showInviteDialog = ref(false)

const SortHeader = (props: { field: SortField; label: string }) =>
  h(
    Tooltip,
    { text: `Order by ${props.label.toLowerCase()}` },
    {
      default: () =>
        h(
          'button',
          {
            type: 'button',
            class: [
              'group inline-flex h-7 w-fit items-center gap-1 rounded text-left text-ink-gray-5 text-sm-medium transition-colors',
            ],
            onClick: () => toggleSort(props.field),
          },
          [
            props.label,
            h('span', {
              class: [
                sortIcon(props.field),
                'size-3.5 text-ink-gray-5',
                sortField.value === props.field
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100',
              ],
              'aria-hidden': 'true',
            }),
          ],
        ),
    },
  )

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

function toggleSort(field: SortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortField.value = field
  sortDirection.value = defaultSortDirection(field)
}

function compareUsers(a: UserRow, b: UserRow) {
  let result = 0
  if (sortField.value === 'role') {
    const rankA = roleRank[a.role] ?? Number.MAX_SAFE_INTEGER
    const rankB = roleRank[b.role] ?? Number.MAX_SAFE_INTEGER
    result = rankA - rankB
  } else if (sortField.value === 'creation') {
    result = (a.creation || '').localeCompare(b.creation || '')
  } else {
    result = (a.full_name || '').localeCompare(b.full_name || '')
  }

  return sortDirection.value === 'asc' ? result : -result
}

function defaultSortDirection(field: SortField): SortDirection {
  return field === 'creation' ? 'desc' : 'asc'
}

function sortIcon(field: SortField) {
  if (sortField.value !== field) return 'lucide-arrow-up-down'
  return sortDirection.value === 'asc' ? 'lucide-arrow-up' : 'lucide-arrow-down'
}

function getMemberSince(user: UserRow) {
  return dayjsLocal(user.creation).format('MMM YYYY')
}

function changeUserRole(user: UserRow, role: string) {
  dialog.confirm({
    title: 'Change Role',
    message: `Are you sure you want to change ${user.full_name}'s role to ${role}?`,
    confirmLabel: 'Change Role',
    onConfirm: () => changeUserRoleCall.submit({ user: user.name, role }),
  })
}

function onRoleChange(user: UserRow, role: string) {
  const isValidRole = roleOptions.some((option) => option.value === role)
  if (!isValidRole || role === user.role) return
  changeUserRole(user, role)
}

function disableUser(user: UserRow) {
  dialog.danger({
    title: 'Disable user',
    message: `${user.full_name} (${user.email}) will be disabled and can no longer sign in to Gameplan. You can re-enable them later from the Frappe admin.`,
    confirmLabel: 'Disable',
    onConfirm: () => disableUserCall.submit({ user: user.name }),
  })
}
</script>
