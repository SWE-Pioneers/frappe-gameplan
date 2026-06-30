import { computed, type ComputedRef } from 'vue'
import { communities } from '@/data/communities'
import { isGameplanAdmin, useSessionUser } from '@/data/users'
import { getManageableCommunities } from '@/utils/permissions'

/**
 * Whether the current user can manage any community, gating the Communities
 * settings entry points. Global admins always can.
 */
export function useCanManageCommunities(): ComputedRef<boolean> {
  const sessionUser = useSessionUser()
  return computed(() => {
    if (isGameplanAdmin(sessionUser)) return true
    return getManageableCommunities(communities.data || [], sessionUser).length > 0
  })
}
