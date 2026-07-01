<template>
  <MobileHeader class="sm:hidden" title="Notifications" />
  <PageHeader class="hidden sm:flex">
    <Breadcrumbs :items="[{ label: 'Notifications', route: { name: 'Notifications' } }]" />
  </PageHeader>

  <div class="body-container pl-0 pt-4 pr-4 sm:pl-5 sm:pt-5">
    <div class="mb-3 flex items-center justify-between pl-4 sm:pl-3 gap-3">
      <TabButtons :buttons="tabButtons" v-model="activeTab" />
      <Button
        @click="confirmMarkAllAsRead"
        :loading="markAllAsRead.loading"
        v-if="canMarkAllAsRead"
      >
        Mark all as read
      </Button>
    </div>

    <div v-if="notifications?.length">
      <div
        v-for="(notification, index) in notifications"
        :key="notification.name"
        class="group relative h-[68px] sm:h-15"
      >
        <component
          :is="notificationRoute(notification) ? RouterLink : 'div'"
          class="relative block h-full select-none px-4 py-2 transition-colors duration-150 active:bg-surface-gray-2 sm:rounded-[10px] sm:px-3 sm:hover:bg-surface-gray-1"
          :class="notification.read ? 'w-full' : 'w-[calc(100%-2.5rem)]'"
          v-bind="notificationRoute(notification) ? { to: notificationRoute(notification) } : {}"
          @click="openNotification(notification)"
        >
          <div class="flex h-full items-center overflow-hidden">
            <div class="flex items-center space-x-3">
              <div class="relative flex">
                <UserAvatarWithHover
                  size="2xl"
                  :user="notification.from_user"
                  v-if="showAvatar(notification)"
                />
                <div
                  class="grid size-10 place-items-center rounded-[8px] bg-surface-gray-2 group-hover:bg-surface-base"
                  v-else
                >
                  <ReactionFaceIcon
                    class="size-5 text-ink-gray-6"
                    v-if="notification.type === 'Reaction'"
                  />
                  <span
                    :class="[notificationIcon(notification), 'size-5 text-ink-gray-6']"
                    aria-hidden="true"
                    v-else
                  />
                </div>
              </div>
            </div>

            <div class="mx-3 min-w-0 flex-1 sm:ml-4 sm:mr-4">
              <div class="flex min-w-0 items-center">
                <div
                  class="overflow-hidden text-ellipsis whitespace-nowrap leading-none text-ink-gray-8"
                >
                  <span
                    class="overflow-hidden text-ellipsis whitespace-nowrap"
                    :class="
                      notification.read
                        ? 'text-lg sm:text-base'
                        : 'text-lg-medium sm:text-base-medium'
                    "
                  >
                    {{ notification.message }}
                  </span>
                </div>
              </div>

              <div class="mt-1.5 flex min-w-0 items-center justify-between">
                <div
                  class="inline-flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-md text-ink-gray-5 sm:text-base"
                >
                  <div
                    class="flex min-w-0 items-center"
                    v-if="notificationTargetTitle(notification)"
                  >
                    <div class="truncate">
                      {{ notificationTargetTitle(notification) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="ml-auto flex shrink-0 items-center space-x-3">
              <div>
                <time
                  class="block shrink-0 whitespace-nowrap text-right text-sm text-ink-gray-5"
                  :datetime="notification.creation"
                >
                  <span class="sm:hidden">{{ shortTimestamp(notification.creation) }}</span>
                  <span class="hidden sm:inline">
                    {{ dayjsLocal(notification.creation).fromNow() }}
                  </span>
                </time>
                <div
                  class="mt-1.5 hidden whitespace-nowrap text-right text-sm text-ink-gray-5 sm:block"
                  v-if="notificationLocation(notification)"
                >
                  {{ notificationLocation(notification) }}
                </div>
              </div>
            </div>
          </div>
          <div
            class="pointer-events-none absolute bottom-0 left-1 right-4 transition-opacity group-hover:opacity-0 sm:right-3"
            v-if="index < notifications.length - 1"
          >
            <div class="ml-16 h-px border-t" />
          </div>
        </component>
        <div class="absolute right-0 top-1/2 z-10 -translate-y-1/2" v-if="!notification.read">
          <Tooltip text="Mark as read">
            <Button
              variant="subtle"
              icon="lucide-check"
              @click.stop="markAsRead(notification.name)"
            />
          </Tooltip>
        </div>
      </div>
    </div>

    <div v-else class="rounded border border-dashed border-outline-gray-2 px-6 py-12 text-center">
      <div class="mx-auto grid size-10 place-items-center rounded bg-surface-gray-2">
        <span class="lucide-bell-check size-5 text-ink-gray-5" aria-hidden="true" />
      </div>
      <div class="mt-3 text-base-medium text-ink-gray-8">{{ emptyStateTitle }}</div>
      <div class="mt-1 text-base text-ink-gray-5">{{ emptyStateDescription }}</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import {
  TabButtons,
  Tooltip,
  Breadcrumbs,
  dayjsLocal,
  dialog,
  useCall,
  useList,
  usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/PageHeader.vue'
import MobileHeader from '@/components/MobileHeader.vue'
import ReactionFaceIcon from '@/components/ReactionFaceIcon.vue'
import UserAvatarWithHover from '@/components/UserAvatarWithHover.vue'
import { unreadNotifications } from '@/data/notifications'
import { useSessionUser } from '@/data/users'
import type { GPNotification } from '@/types/doctypes'

type ActiveTab = 'Unread' | 'Read'

interface NotificationRow extends GPNotification {
  discussion_title?: string
  task_title?: string
  project_title?: string
  team_title?: string
}

const activeTab = ref<ActiveTab>('Unread')
const sessionUser = useSessionUser()

const notificationFields = [
  'name',
  'from_user',
  'message',
  'read',
  'type',
  'creation',
  'comment',
  'discussion',
  'task',
  'project',
  'team',
  'discussion.title as discussion_title',
  'task.title as task_title',
  'project.title as project_title',
  'team.title as team_title',
]

const unreadNotificationList = useNotificationList(0, 'Unread Notifications')
const readNotificationList = useNotificationList(1, 'Read Notifications')

const markAllAsRead = useCall({
  url: 'gameplan.api.mark_all_notifications_as_read',
  method: 'POST',
  immediate: false,
  onSuccess() {
    unreadNotifications.reload()
    unreadNotificationList.reload()
    readNotificationList.reload()
  },
})

const canMarkAllAsRead = computed(
  () => activeTab.value === 'Unread' && Boolean(unreadNotificationList.data?.length),
)

const tabButtons: { label: ActiveTab }[] = [{ label: 'Unread' }, { label: 'Read' }]

const notifications = computed(() =>
  activeTab.value === 'Unread' ? unreadNotificationList.data : readNotificationList.data,
)

const emptyStateTitle = computed(() =>
  activeTab.value === 'Unread' ? "You're caught up" : 'No read notifications',
)

const emptyStateDescription = computed(() =>
  activeTab.value === 'Unread'
    ? 'New notifications will show up here.'
    : 'Notifications you have handled will collect here.',
)

function openNotification(notification: NotificationRow) {
  if (!notification.read && notificationRoute(notification)) {
    markAsRead(notification.name)
  }
}

function markAsRead(name: string) {
  unreadNotificationList.setValue.submit({ name, read: 1 }).then(() => {
    unreadNotifications.reload()
    unreadNotificationList.reload()
    readNotificationList.reload()
  })
}

function notificationRoute(notification: NotificationRow): RouteLocationRaw | null {
  if (notification.discussion) {
    return {
      name: 'Discussion',
      params: {
        communityId: notification.team,
        spaceId: notification.project,
        postId: notification.discussion,
      },
      query: notification.comment ? { comment: notification.comment } : undefined,
    }
  }
  if (notification.task) {
    return {
      name: 'SpaceTask',
      params: {
        communityId: notification.team,
        spaceId: notification.project,
        taskId: notification.task,
      },
      query: notification.comment ? { comment: notification.comment } : undefined,
    }
  }
  return null
}

function notificationIcon(notification: NotificationRow) {
  if (notification.type === 'Rich Quote') return 'lucide-text-quote'
  return 'lucide-at-sign'
}

function notificationTargetTitle(notification: NotificationRow) {
  return notification.discussion_title || notification.task_title || null
}

function notificationLocation(notification: NotificationRow) {
  return [notification.team_title, notification.project_title].filter(Boolean).join(' / ')
}

function shortTimestamp(timestamp: string) {
  let time = dayjsLocal(timestamp)
  let minutes = dayjsLocal().diff(time, 'minute')
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`

  let hours = dayjsLocal().diff(time, 'hour')
  if (hours < 24) return `${hours}h`

  let days = dayjsLocal().diff(time, 'day')
  if (days < 7) return `${days}d`
  if (days < 365) return time.format('D MMM')
  return time.format('D MMM YY')
}

function showAvatar(notification: NotificationRow) {
  return Boolean(notification.from_user && notification.type !== 'Reaction')
}

function confirmMarkAllAsRead() {
  dialog.confirm({
    title: 'Mark all as read',
    message: 'Are you sure you want to mark all unread notifications as read?',
    confirmLabel: 'Mark all as read',
    onConfirm: () => markAllAsRead.submit(),
  })
}

function useNotificationList(read: 0 | 1, cacheKey: string) {
  return useList<NotificationRow>({
    doctype: 'GP Notification',
    filters: () => ({ to_user: sessionUser.name, read }),
    fields: notificationFields,
    orderBy: 'creation desc',
    cacheKey,
  })
}

unreadNotifications.reload()
usePageMeta(() => ({ title: 'Notifications' }))
</script>
