<template>
  <div class="leading-5">
    <span class="text-base text-ink-gray-8">
      <UserProfileLink class="hover:text-ink-blue-3" :user="discussion.owner">
        {{ $user(discussion.owner).full_name }}
      </UserProfileLink>
      {{ __('in') }}
      <DiscussionBreadcrumbs :discussion="discussion" />
    </span>
    <span> &middot; </span>
    <span class="text-base text-ink-gray-5">
      {{
        discussion.participants_count == 1
          ? __('1 participant')
          : __('{0} participants', [discussion.participants_count])
      }}
    </span>
  </div>
</template>
<script>
import DiscussionBreadcrumbs from './DiscussionBreadcrumbs.vue'
import UserProfileLink from './UserProfileLink.vue'

export default {
  name: 'DiscussionMeta',
  props: ['discussion'],
  components: { UserProfileLink, DiscussionBreadcrumbs },
}
</script>
