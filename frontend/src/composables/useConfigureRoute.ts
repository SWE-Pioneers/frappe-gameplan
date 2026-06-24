import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { communities } from '@/data/communities'
import { isGameplanAdmin, useSessionUser } from '@/data/users'
import { getManageableCommunities } from '@/utils/permissions'

/**
 * Route to the Configure area, or `null` when the user can't manage any community
 * (so nav entries can hide themselves). Global admins always get access.
 */
export function useConfigureRoute() {
  const sessionUser = useSessionUser()
  return computed<RouteLocationRaw | null>(() => {
    if (isGameplanAdmin(sessionUser)) return { name: 'Spaces' }
    if (!getManageableCommunities(communities.data || [], sessionUser).length) return null
    return { name: 'Spaces' }
  })
}
