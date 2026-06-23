# Permission UI/UX Audit

Date: 2026-06-24

This note maps the current Gameplan UI places that express, hide, or imply permissions after
the permission rewrite. It is meant as a handoff reference for future Codex sessions, not as a
full implementation plan. See `docs/permissions-plan.md` for the broader permission model and
tracer-bullet plan.

## Backend Permission Model

The backend now distinguishes these capabilities:

- Global admin: `Gameplan Admin` / `System Manager`.
- Community admin: `GP Member.is_admin` on a `GP Team` membership row.
- Community member: member row on `GP Team`.
- Private-space member: member row on `GP Project`.
- Guest access: `GP Guest Access` grants a guest access to specific spaces.
- Content owner: can edit their own discussions, tasks, pages, and comments.
- Community admin moderation: can delete content in their community, but should not edit
  another user's content.

Key backend references:

- `gameplan/__init__.py` - `is_admin`, `is_guest`.
- `gameplan/permissions.py` - `can_manage_community`, `can_view_space`,
  `can_manage_space_members`, `can_invite_guest`, `can_edit_content`,
  `can_delete_content`.
- `gameplan/gameplan/doctype/gp_team/gp_team.py` - community member management.
- `gameplan/gameplan/doctype/gp_project/gp_project.py` - space access and guest invites.
- `gameplan/tests/test_permissions_backend.py` - expected backend behavior.
- `gameplan/tests/test_api_security.py` - global role/invite endpoint security.

## Root UI Gap

The frontend has no durable capability model. It guesses from:

- `isGameplanAdmin()`
- `user.role`
- `isGuest` / `isNotGuest`
- current user ownership
- `readOnlyMode`
- `archived_at`
- local membership arrays

This does not match the rewritten backend. In particular, `frontend/src/data/communities.ts`
and `frontend/src/data/spaces.ts` fetch `members.user`, but not `members.is_admin`, and no API
or boot payload provides booleans like `can_manage_community`, `can_manage_space_members`,
`can_invite_guests`, `can_create_content`, `can_edit_content`, or `can_delete_content`.

Recommended foundation:

- Add a small frontend permissions/capabilities layer instead of repeating local guesses.
- Start by fetching `members.is_admin` where community membership is loaded.
- Add helpers such as `isCommunityAdmin(community, user)` and
  `canManageCommunity(community, user)`.
- Prefer backend-provided capability booleans for document-specific permissions where local
  derivation is incomplete or risky.

## Screen Map And Gaps

### 1. Configure / Community Members

Files:

- `frontend/src/router.ts`
- `frontend/src/pages/Configure/Configure.vue`
- `frontend/src/pages/Configure/CommunityMembersList.vue`
- `frontend/src/pages/Configure/MemberRow.vue`
- `frontend/src/pages/Configure/MemberOptions.vue`
- `frontend/src/pages/Configure/CommunityGuestsList.vue`

Current state:

- `/configure`, `/configure/:communityId`, and `/configure/:communityId/members` are gated by
  global `isGameplanAdmin()`.
- Backend allows community admins to manage their own community members.
- The UI does not fetch or display community-admin status.
- Add/remove controls are only disabled by `community.archived_at`.
- Community guests are visible in this screen, but the screen is only reachable by global admins.

Gaps:

- Community admins cannot reach their own management page.
- Members cannot tell who can manage a community.
- There is no UI to promote/demote community admins.
- Add/remove controls do not express the actual `can_manage_community` capability.

Recommended first slice:

- Allow global admins to access all configure pages.
- Allow community admins to access only their own community configure/members page.
- Fetch and display `members.is_admin`.
- Gate add/remove/promote/demote controls by `canManageCommunity`.
- Keep global role management out of this slice.

### 2. Space Access Dialog

Files:

- `frontend/src/components/SpaceOptions.vue`
- `frontend/src/components/SpaceAccessDialog.vue`
- `frontend/src/pages/Configure/SpaceRow.vue`

Current state:

- "Manage access" shows when the space is not archived/read-only.
- Private-space member management is shown only for private spaces.
- Guest invite/remove controls are available inside the dialog.
- Backend allows `can_manage_space_members` and `can_invite_guest`, which are not the same as
  global admin.

Gaps:

- The action is visible based on `!readOnlyMode && !archived_at`, not actual manage/invite
  capability.
- Public-space access is described, but there is no explicit capability state for who can change
  access or invite guests.
- Private-space members can manage private-space membership, but the UI does not make that
  permission boundary visible.

Recommended slice:

- Add `canManageSpaceMembers(space)` and `canInviteGuests(space)` helpers or backend booleans.
- Show/hide "Manage access" by those capabilities.
- Inside the dialog, disable or hide individual member/guest controls separately.

### 3. Global Settings / Members / Invites

Files:

- `frontend/src/components/AppDropdown.vue`
- `frontend/src/components/Settings/SettingsDialog.vue`
- `frontend/src/components/Settings/Members.vue`
- `frontend/src/components/Settings/InvitePeople.vue`
- `frontend/src/pages/People.vue`

Current state:

- Settings is reachable from the app dropdown for everyone.
- People page shows "Invite" unconditionally.
- `Members.vue` exposes role change and remove-user controls.
- `InvitePeople.vue` exposes global Admin/Member invites.
- Backend rejects non-admin calls through `require_admin()`.
- Cypress currently documents that non-admin controls are reachable but rejected.

Gaps:

- Non-admins can open UI that is guaranteed to fail.
- Global role management and community-scoped member management are visually mixed.
- Global admin capabilities are not clearly separated from community admin capabilities.

Recommended slice:

- Gate global Members/Invites tabs to global admins only.
- Hide People page "Invite" unless global admin, or redirect it to community-scoped invite only
  when a community context exists.
- Keep server-side `require_admin()` unchanged.
- Update Cypress expectation that non-admin controls are absent rather than reachable/rejected.

### 4. Discussion Detail Actions

Files:

- `frontend/src/components/DiscussionView.vue`
- `frontend/src/pages/SpaceDiscussion.vue`

Current state:

- The discussion options dropdown appears for all non-read-only viewers.
- Edit, Pin, Close/Re-open, Move, and Delete actions are built from local conditions.
- Delete only shows for the discussion owner.
- Backend allows owner edit, global admin edit/delete, and community admin delete/moderation.

Gaps:

- Edit is visible to non-owner viewers and will fail server-side.
- Community admins do not see delete/moderation affordances for others' content.
- Pin/close/move are not gated by explicit capabilities.
- The UI does not distinguish "edit own content" from "moderate community content".

Recommended slice:

- Split action capabilities into `canEditDiscussion`, `canDeleteDiscussion`, `canModerateDiscussion`,
  and `canMoveDiscussion`.
- Hide edit for non-owners unless global admin.
- Show delete/moderation for community admins where backend permits it.

### 5. Comments

Files:

- `frontend/src/components/Comment.vue`
- `frontend/src/components/CommentsArea.vue`
- `frontend/src/components/CommentsList.vue`

Current state:

- Comment composer is shown when the parent is not read-only/closed.
- Guests may comment if they can view the parent discussion.
- Comment edit is visible to any non-read-only viewer.
- Comment delete only shows for the owner.

Gaps:

- Edit is over-visible to non-owners.
- Community admins cannot see moderation delete for other users' comments.
- Guest edit/delete affordances depend only on read-only state, not guest role/capability.

Recommended slice:

- Gate Edit by owner/global admin.
- Gate Delete by owner/global admin/community admin moderation.
- Keep comment creation available for guests only where backend permits it.

### 6. Pages

Files:

- `frontend/src/pages/Page.vue`
- `frontend/src/pages/SpacePages.vue`
- `frontend/src/pages/PageGrid.vue`

Current state:

- Page editing is allowed when the space is not archived/read-only.
- Page delete options are hidden only through the page/grid `readOnly` prop.
- Backend content permission is owner-edit and admin/moderation delete.

Gaps:

- Non-owner viewers can see an editable page UI and autosave attempts may fail.
- Community admins do not get a clear delete/moderation affordance if they are allowed to delete.
- Personal pages and space pages need separate capability derivation.

Recommended slice:

- Add `canEditPage` and `canDeletePage`.
- For personal pages, owner/global admin only.
- For space pages, inherit space/community capabilities plus ownership.

### 7. Tasks

Files:

- `frontend/src/pages/SpaceTasks.vue`
- `frontend/src/pages/Task.vue`
- `frontend/src/components/TaskDetail.vue`
- `frontend/src/components/TaskList.vue`
- `frontend/src/components/NewTaskDialog/NewTaskDialog.vue`

Current state:

- Task list status controls are always interactive.
- Task detail fields, assignee, due date, status, priority, space, and delete are always interactive
  once visible.
- Add Task is gated only by `!readOnlyMode && !space.archived_at`.

Gaps:

- Non-owner viewers can attempt to edit tasks.
- Guests can reach task creation/editing affordances in granted spaces if the space is not archived.
- Community admin delete/moderation is not distinguished from owner edit.

Recommended slice:

- Add `canCreateTask`, `canEditTask`, and `canDeleteTask`.
- Make task detail render as read-only when the user can read but not edit.
- Gate list quick status updates by `canEditTask`.

### 8. Creation Entry Points And Command Palette

Files:

- `frontend/src/components/CommandPalette/CommandPalette.vue`
- `frontend/src/pages/SpaceDiscussions.vue`
- `frontend/src/pages/SpacePages.vue`
- `frontend/src/pages/SpaceTasks.vue`
- `frontend/src/pages/NewDiscussion/useNewDiscussion.ts`
- `frontend/src/components/NewTaskDialog/NewTaskDialog.vue`
- `frontend/src/components/NewSpaceDialog.vue`
- `frontend/src/components/AppSidebar.vue`

Current state:

- Add Discussion/Page/Task are generally gated by `canCreateFromPalette` or `canEditSpace`,
  which only check read-only/archived state.
- Sidebar "New space" is global-admin only.
- New Space dialog can create a new community from the community picker.

Gaps:

- Guests can reach creation actions that backend rejects.
- Members may be allowed by backend to create spaces, but the sidebar affordance is global-admin only.
- Community-admin and member creation rights are not explained or consistently exposed.

Recommended slice:

- Gate creation by explicit per-entity capabilities.
- Decide product behavior for space creation:
  - if members can create spaces, expose it outside global-admin-only Configure;
  - if only admins/community admins should create spaces, tighten backend and UI together.
- Prevent command palette from offering actions the current user cannot complete.

### 9. Navigation / Empty States

Files:

- `frontend/src/router.ts`
- `frontend/src/pages/MobileHome.vue`
- `frontend/src/pages/NoCommunities.vue`
- `frontend/src/components/AppRail/AppRail.vue`
- `frontend/src/components/MobileMoreMenu.vue`
- `frontend/src/components/AppSidebar.vue`

Current state:

- Users with no active communities are routed based on global admin.
- Configure shortcuts are global-admin only.
- Mobile home lets users join/hide accessible communities through `update_joined_teams`.

Gaps:

- Community admins who are not global admins do not get management navigation.
- Empty states say "Ask an admin" but the relevant admin might be a community admin, not a
  global Gameplan Admin.
- Route guards do not distinguish "can manage this community" from "can manage everything".

Recommended slice:

- Route `/configure/:communityId` by scoped capability.
- Keep `/configure` index global-admin only unless product wants a "my managed communities" view.
- Update empty-state copy to match scoped admin language.

## Recommended Execution Order

1. Configure / Community Members
2. Space Access Dialog
3. Global Settings / Members / Invites
4. Discussion and Comment actions
5. Pages
6. Tasks
7. Command Palette and creation entry points
8. Navigation and empty states

Reasoning:

- Community Members establishes `members.is_admin` and the first scoped capability helper.
- Space Access builds on community/space membership and guest access.
- Global Settings separation prevents confusing global role management with scoped community
  management.
- Content/page/task/action work is safer once reusable capability helpers exist.

## Verification Notes

- Backend permission changes should use focused tests in `gameplan/tests/test_permissions_backend.py`
  and `gameplan/tests/test_api_security.py`.
- Frontend-only capability/UI changes should run `yarn build`.
- Cypress must run against `gameplan-demo.test`, never `gameplan.frappe.test`.
- For each screen, add or update one Cypress spec that proves controls are absent for users who
  cannot complete the action and present for users who can.
