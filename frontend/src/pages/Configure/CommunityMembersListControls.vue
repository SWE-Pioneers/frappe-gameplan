<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <TextInput v-model="search" placeholder="Search members">
        <template #prefix>
          <span class="lucide-search h-4 w-4 text-ink-gray-4" />
        </template>
      </TextInput>
      <slot name="action" />
    </div>

    <!-- Column header, aligned with MemberRow's grid. -->
    <div
      v-if="hasMembers"
      class="mt-3 hidden grid-cols-[1.25rem_minmax(12rem,1fr)_minmax(12rem,1fr)_8rem_1.5rem] items-center gap-2 border-b h-8 text-sm text-ink-gray-5 md:grid"
    >
      <div class="col-span-2">Member</div>
      <div>Email</div>
      <div>Role</div>
      <div />
    </div>
  </div>
</template>

<script setup lang="ts">
import { TextInput } from 'frappe-ui'

defineProps<{ hasMembers: boolean }>()
const search = defineModel<string>('search', { default: '' })
</script>
