import { useDoctype } from 'frappe-ui'
import { GPProject } from '@/types/doctypes'
import { reactive } from 'vue'

interface ProjectUnreadCount {
  [spaceId: string]: number
}

interface ParticipatingUnreadCount {
  [team: string]: number
}

const unreadCounts = reactive<ProjectUnreadCount>({})
const participatingUnreadCounts = reactive<ParticipatingUnreadCount>({})

// All unread-count APIs live on the GP Unread Record controller, called via
// runMethod so we avoid hardcoded dotted module paths.
const UnreadCount = useDoctype('GP Unread Record')

function loadProjectUnreadCounts(projects?: string[]) {
  return UnreadCount.runMethod
    .submit({ method: 'get_unread_count', params: { projects } })
    .then((data: ProjectUnreadCount) => {
      for (const [spaceId, count] of Object.entries(data)) {
        unreadCounts[spaceId] = count
      }
      return data
    })
}

// load unread count for all projects once
loadProjectUnreadCounts()

export function getProjectUnreadCount(spaceId: string) {
  return unreadCounts[spaceId] ?? 0
}

/** Fetch (and cache) the participating unread count for a community. */
export function fetchParticipatingUnreadCount(team: string) {
  return UnreadCount.runMethod
    .submit({ method: 'get_participating_unread_count', params: { team } })
    .then((count: number) => {
      participatingUnreadCounts[team] = count ?? 0
      return participatingUnreadCounts[team]
    })
}

export function getParticipatingUnreadCount(team: string) {
  return participatingUnreadCounts[team] ?? 0
}

const Project = useDoctype<GPProject>('GP Project')

export function markSpaceAsRead(spaceId: string) {
  return Project.runDocMethod
    .submit({
      name: spaceId,
      method: 'mark_all_as_read',
    })
    .then(() => {
      return refreshUnreadCountForProjects([spaceId])
    })
}

export function markSpacesAsRead(spaceIds: string[]) {
  return Project.runMethod
    .submit({
      method: 'mark_all_as_read',
      params: {
        spaces: spaceIds,
      },
    })
    .then(() => {
      return refreshUnreadCountForProjects(spaceIds)
    })
}

export function refreshUnreadCountForProjects(projects: string[]) {
  return loadProjectUnreadCounts(projects)
}
