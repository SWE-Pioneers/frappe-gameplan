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

// All unread-count APIs live on the GP Unread Record controller, called via runMethod so we
// avoid hardcoded dotted module paths. Each `useDoctype` exposes ONE shared `runMethod`
// (a single useCall instance), and concurrent calls on it race on shared request state and
// cross-resolve. We therefore give each endpoint its own instance so they can safely overlap.
const unreadCountApi = useDoctype('GP Unread Record')
const participatingCountApi = useDoctype('GP Unread Record')
const markReadApi = useDoctype('GP Unread Record')

function loadProjectUnreadCounts(projects?: string[]) {
  return unreadCountApi.runMethod
    .submit({ method: 'get_unread_count', params: { projects } })
    .then((data: ProjectUnreadCount) => {
      for (const [spaceId, count] of Object.entries(data)) {
        // Counts cross the runMethod/JSON boundary as strings (MariaDB COUNT). Coerce to
        // Number here so summing them (e.g. per community) adds instead of concatenating.
        unreadCounts[spaceId] = Number(count) || 0
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
  return participatingCountApi.runMethod
    .submit({ method: 'get_participating_unread_count', params: { team } })
    .then((count: number) => {
      participatingUnreadCounts[team] = Number(count) || 0
      return participatingUnreadCounts[team]
    })
}

export function getParticipatingUnreadCount(team: string) {
  return participatingUnreadCounts[team] ?? 0
}

/**
 * Mark discussions in a community as read.
 * @param before Optional `YYYY-MM-DD`; limits the action to discussions last active on or
 *   before that day. Omit to mark every unread discussion read.
 */
export function markCommunityAsRead(team: string, before?: string) {
  return markReadApi.runMethod
    .submit({ method: 'mark_all_as_read_for_team', params: { team, before } })
    .then(() => {
      // Reload the full map rather than only the marked projects: the AppRail sums unread
      // across every space it shows for a community, and that set can differ from the
      // backend's accessible-project list. A targeted refresh would leave the unmarked
      // spaces stale-high. A "before date" run may also leave newer discussions unread,
      // so recompute rather than assuming zero. These two run on separate API instances,
      // so concurrent refresh is safe.
      return Promise.all([loadProjectUnreadCounts(), fetchParticipatingUnreadCount(team)])
    })
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
