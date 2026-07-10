<template>
  <div class="flex flex-col">
    <router-view v-slot="{ Component, route }">
      <header
        class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-5 py-2.5"
        v-if="!route.meta?.hideHeader"
      >
        <Breadcrumbs class="h-7" :items="breadcrumbs">
          <template #prefix="{ item }">
            <span class="mr-2 flex rounded-sm text-2xl leading-none" v-if="item.icon">
              {{ item.icon }}
            </span>
          </template>
        </Breadcrumbs>
        <div v-if="$route.name === 'ProjectOverview'" class="flex items-center space-x-2">
          <Tooltip
            v-if="project.doc.is_private"
            :text="__('This project is only visible to team members')"
          >
            <Badge size="lg">
              <template #prefix><LucideLock class="w-3" /></template>
              {{ __('Private') }}
            </Badge>
          </Tooltip>
          <Badge size="lg" v-if="project.doc.archived_at">
            <template #prefix><LucideArchive class="w-3" /></template>
            {{ __('Archived') }}
          </Badge>
          <template v-if="!isMobile">
            <Button
              v-if="project.doc.is_followed"
              @click="project.unfollow.submit()"
              :loading="project.unfollow.loading"
            >
              <template #prefix><LucideBell class="w-4" /></template>
              {{ __('Following') }}
            </Button>
            <Button v-else @click="project.follow.submit()" :loading="project.follow.loading">
              <template #prefix><LucideBellPlus class="w-4" /></template>
              {{ __('Follow') }}
            </Button>
          </template>
          <Dropdown
            v-if="$user().isNotGuest"
            placement="left"
            :button="{
              icon: 'more-horizontal',
              variant: 'ghost',
              label: __('Options'),
            }"
            :options="[
              {
                label: __('Edit'),
                icon: 'edit',
                onClick: () => (projectEditDialog.show = true),
                condition: () => !project.doc.archived_at,
              },
              {
                label: __('Follow'),
                icon: 'plus',
                onClick: () => project.follow.submit(),
                condition: () => isMobile && !project.doc.is_followed,
              },
              {
                label: __('Following'),
                icon: 'check',
                onClick: () => project.unfollow.submit(),
                condition: () => isMobile && project.doc.is_followed,
              },
              {
                label: __('Manage Guests'),
                icon: 'user-plus',
                onClick: () => (inviteGuestDialog.show = true),
                condition: () => !project.doc.archived_at,
              },
              {
                label: __('Move to another team'),
                icon: 'log-out',
                onClick: () => (projectMoveDialog.show = true),
                condition: () => !project.doc.archived_at,
              },
              {
                label: __('Merge with another project'),
                icon: LucideMerge,
                onClick: () => (projectMergeDialog.show = true),
              },
              {
                label: __('Archive this project'),
                icon: 'trash-2',
                onClick: archiveProject,
                condition: () => !project.doc.archived_at,
              },
              {
                label: __('Unarchive this project'),
                icon: 'trash-2',
                onClick: unarchiveProject,
                condition: () => project.doc.archived_at,
              },
            ]"
          />
        </div>
        <Dialog
          :options="{
            title: __('Edit Project'),
            actions: [
              {
                label: __('Save'),
                variant: 'solid',
                onClick({ close }) {
                  return project.setValue
                    .submit({
                      title: project.doc.title,
                      is_private: project.doc.is_private,
                    })
                    .then(close)
                },
              },
            ],
          }"
          v-model="projectEditDialog.show"
        >
          <template #body-content>
            <FormControl
              class="mb-2"
              :label="__('Title')"
              v-model="project.doc.title"
              :placeholder="__('Project title')"
            />
            <FormControl
              v-if="!team.doc.is_private"
              :label="__('Visibility')"
              type="select"
              :options="[
                { label: __('Visible to everyone'), value: 0 },
                { label: __('Visible to team members (Private)'), value: 1 },
              ]"
              v-model="project.doc.is_private"
            />
            <ErrorMessage class="mt-2" :message="project.setValue.error" />
          </template>
        </Dialog>
        <Dialog
          :options="{
            title: __('Move project to another team'),
          }"
          @close="
            () => {
              projectMoveDialog.team = null
              project.moveToTeam.reset()
            }
          "
          v-model="projectMoveDialog.show"
        >
          <template #body-content>
            <Autocomplete
              :options="moveToTeamsList"
              v-model="projectMoveDialog.team"
              :placeholder="__('Select a team')"
            >
              <template #item-prefix="{ option }">
                <span class="mr-2">{{ option.icon }}</span>
              </template>
            </Autocomplete>
            <ErrorMessage class="mt-2" :message="project.moveToTeam.error" />
          </template>
          <template #actions>
            <Button
              class="w-full"
              variant="solid"
              :loading="project.moveToTeam.loading"
              @click="
                () => {
                  project.moveToTeam.submit(
                    { team: projectMoveDialog.team?.value },
                    {
                      validate() {
                        if (!projectMoveDialog.team?.value) {
                          return __('Team is required to move this project')
                        }
                      },
                      onSuccess() {
                        onProjectMove()
                      },
                    },
                  )
                }
              "
            >
              {{
                projectMoveDialog.team
                  ? __('Move to {0}', [projectMoveDialog.team.label])
                  : __('Move')
              }}
            </Button>
          </template>
        </Dialog>
        <Dialog
          :options="{
            title: __('Merge with another project'),
          }"
          @close="
            () => {
              projectMergeDialog.project = null
              project.mergeWithProject.reset()
            }
          "
          v-model="projectMergeDialog.show"
        >
          <template #body-content>
            <p class="text-p-base text-ink-gray-8 mb-4">
              {{ __('This will move all discussions, tasks, and pages from the') }}
              <span class="whitespace-nowrap font-semibold">{{ project.doc.title }}</span>
              {{ __('project to the selected project. This change is irreversible!') }}
            </p>
            {{ projectMergeDialog.project }}
            <Autocomplete
              :options="mergeProjectsList"
              v-model="projectMergeDialog.project"
              :placeholder="__('Select a project')"
            >
              <template #item-prefix="{ option }">
                <span class="mr-2">{{ option.icon }}</span>
              </template>
            </Autocomplete>
            <ErrorMessage class="mt-2" :message="project.mergeWithProject.error" />
          </template>
          <template #actions>
            <Button
              class="w-full"
              variant="solid"
              :loading="project.mergeWithProject.loading"
              @click="
                () => {
                  project.mergeWithProject.submit(
                    { project: projectMergeDialog.project?.value },
                    {
                      validate() {
                        if (!projectMergeDialog.project?.value) {
                          return __('Please select a project to merge')
                        }
                      },
                      onSuccess() {
                        if (projectMergeDialog.project.value) {
                          projectMergeDialog.show = false
                          return $router.replace({
                            name: 'Project',
                            params: { projectId: projectMergeDialog.project.value },
                          })
                        }
                      },
                    },
                  )
                }
              "
            >
              {{
                projectMergeDialog.project
                  ? __('Merge with {0}', [projectMergeDialog.project.label])
                  : __('Merge')
              }}
            </Button>
          </template>
        </Dialog>
        <InviteGuestDialog
          v-if="$user().isNotGuest"
          v-model="inviteGuestDialog.show"
          :project="project"
        />
      </header>

      <component
        v-if="project"
        :is="Component"
        :class="{ 'mx-auto w-full max-w-4xl px-5': !route.meta?.fullWidth }"
        :project="project"
        :team="team"
      />
    </router-view>
  </div>
</template>
<script>
import { computed } from 'vue'
import {
  Autocomplete,
  Dropdown,
  FormControl,
  Breadcrumbs,
  frappeRequest,
  Input,
  Tooltip,
  Select,
  Textarea,
} from 'frappe-ui'
import Pie from '@/components/Pie.vue'
import IconPicker from '@/components/IconPicker.vue'
import Links from '@/components/Links.vue'
import Tabs from '@/components/Tabs.vue'
import InviteGuestDialog from '@/components/InviteGuestDialog.vue'
import { projects } from '@/data/projects'
import { activeTeams, teams } from '@/data/teams'
import PinIcon from '~icons/lucide/pin'
import LucideMerge from '~icons/lucide/merge'
import { useScreenSize } from '@/utils/composables'

export default {
  name: 'Project',
  props: ['team', 'project'],
  components: {
    Input,
    Dropdown,
    Pie,
    IconPicker,
    Links,
    Tabs,
    Autocomplete,
    Tooltip,
    InviteGuestDialog,
    FormControl,
    Select,
    Textarea,
    Breadcrumbs,
  },
  setup() {
    const size = useScreenSize()
    const isMobile = computed(() => size.width < 640)
    return {
      PinIcon,
      LucideMerge,
      isMobile,
    }
  },
  data() {
    return {
      projectMoveDialog: { show: false, team: null },
      projectEditDialog: { show: false },
      inviteGuestDialog: { show: false },
      projectMergeDialog: { show: false, project: null },
    }
  },
  computed: {
    moveToTeamsList() {
      return activeTeams.value
        .filter((d) => d.name != this.team.name)
        .map((d) => ({
          label: d.title,
          value: d.name,
          icon: d.icon,
        }))
    },
    mergeProjectsList() {
      return projects.data
        .filter((d) => d.name != this.project.name)
        .map((d) => ({
          label: d.title,
          value: d.name.toString(),
          icon: d.icon,
        }))
    },
    task() {
      let task = null
      if (this.$route.name === 'ProjectTaskDetail') {
        task = this.$getDocumentResource('GP Task', this.$route.params.taskId)
      }
      return task
    },
    breadcrumbs() {
      let items = [
        {
          label: this.team.doc.title,
          icon: this.team.doc.icon,
          route: { name: 'Team', params: { teamId: this.team.doc.name } },
        },
        {
          label: this.project.doc.title,
          route: {
            name: 'Project',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
            },
          },
        },
      ]
      if (
        ['ProjectDiscussions', 'ProjectDiscussion', 'ProjectDiscussionNew'].includes(
          this.$route.name,
        )
      ) {
        items.push({
          label: __('Discussions'),
          route: {
            name: 'ProjectDiscussions',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
            },
          },
        })
      }
      if (this.$route.name === 'ProjectDiscussion') {
        let discussion = this.$getDocumentResource('GP Discussion', this.$route.params.postId)
        items.push({
          label: discussion?.doc?.title || this.$route.params.postId,
          route: {
            name: 'ProjectDiscussion',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
              postId: this.$route.params.postId,
            },
          },
        })
      }
      if (this.$route.name === 'ProjectDiscussionNew') {
        items.push({
          label: __('New Discussion'),
          route: {
            name: 'ProjectDiscussionNew',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
            },
          },
        })
      }

      if (['ProjectTasks', 'ProjectTaskDetail'].includes(this.$route.name)) {
        items.push({
          label: __('Tasks'),
          route: {
            name: 'ProjectTasks',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
            },
          },
        })
      }

      if (this.$route.name === 'ProjectTaskDetail') {
        let task = this.$getDocumentResource('GP Task', this.$route.params.taskId)
        items.push({
          label: task?.doc?.title || this.$route.params.taskId,
          route: {
            name: 'ProjectTaskDetail',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
              taskId: this.$route.params.taskId,
            },
          },
        })
      }

      if (['ProjectPages', 'ProjectPage'].includes(this.$route.name)) {
        items.push({
          label: __('Pages'),
          route: {
            name: 'ProjectPages',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
            },
          },
        })
      }

      if (this.$route.name === 'ProjectPage') {
        let page = this.$getDocumentResource('GP Page', this.$route.params.pageId)
        items.push({
          label: page?.doc?.title || this.$route.params.pageId,
          route: {
            name: 'ProjectPage',
            params: {
              teamId: this.team.doc.name,
              projectId: this.project.doc.name,
              pageId: this.$route.params.pageId,
            },
          },
        })
      }

      return items
    },
  },
  methods: {
    archiveProject() {
      this.$dialog({
        title: __('Archive project'),
        message: __('Are you sure you want to archive this project?'),
        actions: [
          {
            label: __('Archive'),
            variant: 'solid',
            onClick: (close) => {
              return this.project.archive.submit(null, {
                onSuccess: close,
              })
            },
          },
        ],
      })
    },
    unarchiveProject() {
      this.$dialog({
        title: __('Unarchive Project'),
        message: __('Are you sure you want to unarchive this project?'),
        actions: [
          {
            label: __('Unarchive'),
            variant: 'solid',
            onClick: (close) => {
              return this.project.unarchive.submit(null, {
                onSuccess: close,
              })
            },
          },
          {
            label: __('Cancel'),
          },
        ],
      })
    },
    onProjectMove() {
      this.projectMoveDialog.show = false
      projects.reload()
      for (let team of teams.data || []) {
        if ([this.team.doc.name, this.projectMoveDialog.team.value].includes(team.name)) {
          if (this.projectMoveDialog.team.value === team.name) {
            team.open = true
          }
        }
      }
      this.$router.push({
        name: 'ProjectOverview',
        params: {
          teamId: this.projectMoveDialog.team.value,
          projectId: this.project.name,
        },
      })
      this.projectMoveDialog.team = null
      this.project.moveToTeam.reset()
    },
  },
}
</script>
