<template>
  <Dialog :options="{ title: __('Manage Guests') }" v-model="inviteGuestDialog">
    <template #body-content>
      <div class="my-4 space-y-2">
        <div class="flex items-center gap-4" v-for="user in users" :key="user.name">
          <UserAvatar :user="user.pending ? user.email : user.user" />
          <div class="text-base">
            <span class="text-ink-gray-9">
              {{ user.pending ? user.email : $user(user.user).full_name }}
            </span>
            <span class="text-ink-gray-5" v-if="user.pending"> ({{ __('Pending') }})</span>
          </div>
          <div class="ml-auto">
            <Tooltip :text="user.pending ? __('Remove invite') : __('Remove user')">
              <Button :label="__('Remove')" @click="remove(user)">
                <template #icon><LucideX class="w-4" /></template>
              </Button>
            </Tooltip>
          </div>
        </div>
        <Dialog :options="removeDialog.options" v-model="removeDialog.open" />
      </div>
      <FormControl
        :label="__('Email')"
        v-model="email"
        placeholder="jane@example.com"
        @keydown.enter="invite"
      />
      <ErrorMessage class="mt-2" :message="project.inviteGuest.error" />
    </template>
    <template #actions>
      <Button class="w-full" variant="solid" @click="invite" :loading="project.inviteGuest.loading">
        {{ __('Invite') }}
      </Button>
    </template>
  </Dialog>
</template>
<script setup>
import { createListResource, Tooltip } from 'frappe-ui'
import { ref, computed, reactive } from 'vue'

const props = defineProps(['modelValue', 'project'])
const emit = defineEmits(['update:modelValue'])

let guests = createListResource({
  type: 'list',
  doctype: 'GP Guest Access',
  filters: { project: props.project.name },
  fields: ['user', 'project', 'name'],
})
guests.reload()

let pending = createListResource({
  type: 'list',
  doctype: 'GP Invitation',
  filters: {
    projects: ['like', `%${props.project.name}%`],
    role: 'Gameplan Guest',
    status: 'Pending',
  },
  fields: ['email', 'projects', 'name'],
  transform(data) {
    return data.map((d) => ({ ...d, pending: true }))
  },
})
pending.reload()

let users = computed(() => {
  return [...guests.data, ...pending.data]
})

let inviteGuestDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
let email = ref('')

function invite() {
  props.project.inviteGuest.submit(
    { email: email.value },
    {
      onSuccess() {
        email.value = ''
        pending.reload()
      },
    },
  )
}

let removeDialog = reactive({
  open: false,
  options: null,
})

function remove(user) {
  if (user.pending) {
    removeDialog.options = {
      title: __('Delete Invitation'),
      message: __('Are you sure you want to delete this invitation?'),
      actions: [
        {
          label: __('Delete'),
          variant: 'solid',
          theme: 'red',
          onClick: (close) => {
            return pending.delete.submit(user.name).then(close)
          },
        },
      ],
    }
  } else {
    removeDialog.options = {
      title: __('Remove Guest User'),
      message: __('Are you sure you want to remove this guest user?'),
      actions: [
        {
          label: __('Delete'),
          variant: 'solid',
          theme: 'red',
          onClick: (close) => {
            return props.project.removeGuest.submit(
              { email: user.user },
              {
                onSuccess() {
                  guests.reload()
                  close()
                },
              },
            )
          },
        },
        {
          label: __('Cancel'),
        },
      ],
    }
  }
  removeDialog.open = true
}
</script>
