import type { Community } from '@/data/communities'

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

export function isCommunityAdmin(community: Community, user: string) {
  return Boolean(community.members?.some((member) => member.user === user && member.is_admin))
}

export function isGlobalAdmin(user: PermissionUser) {
  return user.name === 'Administrator' || user.role === 'Gameplan Admin'
}
