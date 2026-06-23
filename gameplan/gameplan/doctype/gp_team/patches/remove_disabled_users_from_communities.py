import frappe


def execute():
	"""Prune disabled users from every community (GP Team).

	When a user is disabled in Frappe they lose access to Gameplan, but their
	community memberships linger: they still appear in member lists, count toward
	admin totals, and retain access to private spaces. This removes those stale
	memberships, mirroring what `GPTeam.remove_member` does at runtime (including
	cleanup of private-space memberships under the community).
	"""
	disabled_users = get_disabled_users()
	if not disabled_users:
		return

	for team_name in get_teams_with_disabled_members(disabled_users):
		team = frappe.get_doc("GP Team", team_name)
		stale_members = [member for member in team.members if member.user in disabled_users]
		if not stale_members:
			continue

		for member in stale_members:
			team.remove(member)
			team.remove_private_space_memberships(member.user)

		team.save(ignore_permissions=True)


def get_disabled_users():
	"""Users whose account is disabled, read from the Gameplan-scoped profile flag.

	`GP User Profile.enabled` is fetched from `User.enabled`, so a disabled account
	surfaces here as `enabled = 0`.
	"""
	Profile = frappe.qb.DocType("GP User Profile")
	rows = (
		frappe.qb.from_(Profile)
		.select(Profile.user)
		.where(Profile.enabled == 0)
		.where(Profile.user.isnotnull())
	).run(pluck=True)

	return set(rows)


def get_teams_with_disabled_members(disabled_users):
	Member = frappe.qb.DocType("GP Member")
	return (
		frappe.qb.from_(Member)
		.select(Member.parent)
		.distinct()
		.where(Member.parenttype == "GP Team")
		.where(Member.user.isin(list(disabled_users)))
	).run(pluck=True)
