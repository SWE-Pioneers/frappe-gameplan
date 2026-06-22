# Copyright (c) 2025, Frappe Technologies Pvt Ltd and Contributors
# See license.txt

"""Tests for the Phase 08 community-scope migration patches."""

import frappe
from frappe.tests.utils import FrappeTestCase

from gameplan.gameplan.doctype.gp_discussion.api import get_discussions
from gameplan.gameplan.doctype.gp_project.patches.assign_default_team_to_uncategorized_spaces import (
	execute as assign_default_team,
)
from gameplan.gameplan.doctype.gp_team.patches.join_active_users_to_communities import (
	execute as join_active_users,
)
from gameplan.tests.utils import create_guest, create_member, create_project, create_team


def _make_orphan_project(title):
	"""Insert a GP Project with no team, bypassing fetch_from / hooks."""
	project = frappe.new_doc("GP Project")
	project.title = title
	project.insert(ignore_permissions=True)
	# Force team empty at the db level in case anything backfilled it.
	frappe.db.set_value("GP Project", project.name, "team", None, update_modified=False)
	return project.name


class TestAssignDefaultTeamMigration(FrappeTestCase):
	def setUp(self):
		create_member("test_migration_member@example.com")
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_orphaned_spaces_assigned_to_default(self):
		orphan = _make_orphan_project("Orphan Space")
		self.assertFalse(frappe.db.get_value("GP Project", orphan, "team"))

		assign_default_team()

		default_team = frappe.db.exists("GP Team", {"title": "Default"})
		self.assertTrue(default_team)
		self.assertEqual(frappe.db.get_value("GP Project", orphan, "team"), default_team)

	def test_no_default_created_on_fully_categorized_site(self):
		# Ensure a clean fully-categorized state inside this rolled-back transaction:
		# remove any leftover Default and assign every space to a real community.
		_categorize_everything()
		self.assertFalse(_uncategorized_exists())

		assign_default_team()

		# A fully-categorized site must not get a Default community.
		self.assertFalse(frappe.db.exists("GP Team", {"title": "Default"}))

	def test_default_does_not_get_duplicate_general(self):
		_make_orphan_project("Orphan For General Check")

		assign_default_team()

		default_team = frappe.db.exists("GP Team", {"title": "Default"})
		self.assertTrue(default_team)
		# Default holds only the reassigned orphan(s) — no auto-created General.
		general = frappe.db.get_all(
			"GP Project", filters={"team": default_team, "title": "General"}, pluck="name"
		)
		self.assertEqual(general, [])

	def test_idempotent_on_rerun(self):
		_make_orphan_project("Orphan Idempotent")

		assign_default_team()
		default_team = frappe.db.exists("GP Team", {"title": "Default"})
		first_count = frappe.db.count("GP Project", {"team": default_team})

		# Second run must not create another Default or reshuffle anything.
		assign_default_team()
		self.assertEqual(frappe.db.count("GP Team", {"title": "Default"}), 1)
		self.assertEqual(frappe.db.count("GP Project", {"team": default_team}), first_count)

	def test_null_team_discussion_visible_after_backfill(self):
		team = create_team("Backfill Team")
		project = create_project("Backfill Space", team.name)

		discussion = frappe.get_doc(
			doctype="GP Discussion",
			title="Null team discussion",
			project=project.name,
			content="hi",
		).insert(ignore_permissions=True)
		# Simulate a legacy row created before fetch_from existed.
		frappe.db.set_value("GP Discussion", discussion.name, "team", None, update_modified=False)

		before = get_discussions(filters={"team": team.name, "project": project.name}, limit=50)
		self.assertNotIn(discussion.name, [d.name for d in before])

		assign_default_team()

		self.assertEqual(frappe.db.get_value("GP Discussion", discussion.name, "team"), team.name)
		after = get_discussions(filters={"team": team.name, "project": project.name}, limit=50)
		self.assertIn(discussion.name, [d.name for d in after])


class TestFetchFromTeam(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_fetch_from_populates_team_on_new_discussion(self):
		team = create_team("Fetch From Team")
		project = create_project("Fetch From Space", team.name)

		discussion = frappe.get_doc(
			doctype="GP Discussion",
			title="Auto team discussion",
			project=project.name,
			content="hi",
		).insert(ignore_permissions=True)

		# fetch_from: project.team auto-populates team on insert.
		self.assertEqual(discussion.team, team.name)


class TestJoinActiveUsersMigration(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_discussion_author_is_joined_to_community(self):
		member = create_member("test_discussion_author_join@example.com")
		team, project = _create_team_and_project("Discussion Author Join")

		frappe.set_user(member.name)
		frappe.get_doc(
			doctype="GP Discussion",
			title="Discussion by future community member",
			project=project.name,
			content="hello",
		).insert(ignore_permissions=True)

		join_active_users()

		self.assertTrue(_is_team_member(team.name, member.name))

	def test_discussion_comment_author_is_joined_to_community(self):
		member = create_member("test_discussion_comment_join@example.com")
		team, project = _create_team_and_project("Discussion Comment Join")
		discussion = _create_discussion(project.name)

		_create_comment(member.name, "GP Discussion", discussion.name)

		join_active_users()

		self.assertTrue(_is_team_member(team.name, member.name))

	def test_task_comment_author_is_joined_to_community(self):
		member = create_member("test_task_comment_join@example.com")
		team, project = _create_team_and_project("Task Comment Join")
		task = _create_task(project.name)

		_create_comment(member.name, "GP Task", task.name)

		join_active_users()

		self.assertTrue(_is_team_member(team.name, member.name))

	def test_guest_activity_does_not_join_community(self):
		guest = create_guest("test_guest_activity_not_joined@example.com")
		team, project = _create_team_and_project("Guest Activity Not Joined")

		frappe.set_user(guest.name)
		frappe.get_doc(
			doctype="GP Discussion",
			title="Guest discussion",
			project=project.name,
			content="hello",
		).insert(ignore_permissions=True)

		join_active_users()

		self.assertFalse(_is_team_member(team.name, guest.name))

	def test_patch_is_idempotent(self):
		member = create_member("test_active_join_idempotent@example.com")
		team, project = _create_team_and_project("Active Join Idempotent")
		discussion = _create_discussion(project.name)
		_create_comment(member.name, "GP Discussion", discussion.name)

		join_active_users()
		join_active_users()

		self.assertEqual(_team_member_count(team.name, member.name), 1)


def _uncategorized_exists():
	return bool(frappe.db.get_all("GP Project", filters={"team": ["in", ["", None]]}, limit=1))


def _categorize_everything():
	"""Force a fully-categorized state for the no-Default test (rolled back afterwards)."""
	frappe.db.delete("GP Team", {"title": "Default"})
	team = create_team("Catch All Team")
	frappe.db.sql(
		"UPDATE `tabGP Project` SET team = %s WHERE team IS NULL OR team = ''",
		team.name,
	)


def _create_team_and_project(title):
	frappe.set_user("Administrator")
	team = create_team(f"{title} Team")
	project = create_project(f"{title} Space", team.name)
	return team, project


def _create_discussion(project):
	frappe.set_user("Administrator")
	return frappe.get_doc(
		doctype="GP Discussion",
		title="Community activity discussion",
		project=project,
		content="hello",
	).insert(ignore_permissions=True)


def _create_task(project):
	frappe.set_user("Administrator")
	return frappe.get_doc(doctype="GP Task", title="Community activity task", project=project).insert(
		ignore_permissions=True
	)


def _create_comment(user, reference_doctype, reference_name):
	frappe.set_user(user)
	return frappe.get_doc(
		doctype="GP Comment",
		reference_doctype=reference_doctype,
		reference_name=reference_name,
		content="A comment",
	).insert(ignore_permissions=True)


def _is_team_member(team, user):
	return bool(_team_member_count(team, user))


def _team_member_count(team, user):
	return frappe.db.count("GP Member", {"parenttype": "GP Team", "parent": team, "user": user})
