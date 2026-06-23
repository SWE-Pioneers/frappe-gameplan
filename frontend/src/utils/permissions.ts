import type { Community } from '@/data/communities'
import { getCommunity } from '@/data/communities'
import type { Space } from '@/data/spaces'

type PermissionUser = {
  name?: string | null
  role?: string
}

export function canManageCommunity(community: Community | null | undefined, user: PermissionUser) {
  if (!community || !user.name) return false
  return isGlobalAdmin(user) || isCommunityAdmin(community, user.name)
}

export function getManageableCommunities(communities: Community[], user: PermissionUser) {
  if (isGlobalAdmin(user)) return communities
  return communities.filter((community) => canManageCommunity(community, user))
}

export function isCommunityAdmin(community: Community | null | undefined, user: string) {
  return Boolean(community?.members?.some((member) => member.user === user && member.is_admin))
}

export function isGlobalAdmin(user: PermissionUser) {
  return user.name === 'Administrator' || user.role === 'Gameplan Admin'
}

export function isGuest(user: PermissionUser) {
  return user.role === 'Gameplan Guest'
}

/**
 * Mirror of backend `can_manage_space`: global admins can manage any space,
 * private-space members can manage their own space, and public spaces are
 * managed by community admins. Derived from already-fetched space/community
 * membership, so it adds no network round-trip.
 */
export function canManageSpace(space: Space | null | undefined, user: PermissionUser) {
  if (!space || !user.name) return false
  if (isGlobalAdmin(user)) return true
  if (space.is_private) {
    return Boolean(space.members?.some((member) => member.user === user.name))
  }
  return isCommunityAdmin(getCommunity(space.team), user.name)
}

/** Guests can never invite; otherwise invite rights follow space management. */
export function canInviteGuests(space: Space | null | undefined, user: PermissionUser) {
  if (isGuest(user)) return false
  return canManageSpace(space, user)
}
