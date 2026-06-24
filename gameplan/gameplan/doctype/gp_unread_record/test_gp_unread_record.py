# Copyright (c) 2025, Frappe Technologies Pvt Ltd and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase

from gameplan.gameplan.doctype.gp_unread_record.gp_unread_record import GPUnreadRecord
from gameplan.tests.utils import create_discussion, create_member, create_project, create_team

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class IntegrationTestGPUnreadRecord(IntegrationTestCase):
	"""
	Integration tests for GPUnreadRecord.
	Use this class for testing interactions between multiple components.
	"""

	def test_mark_all_as_read_for_team_marks_accessible_community_projects(self):
		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-unread-member-{suffix}@example.com", "Team Unread Member")
		source_team = create_team(f"Team Unread Source {suffix}")
		other_team = create_team(f"Team Unread Other {suffix}")
		source_project = create_project(f"Team Unread Source Space {suffix}", source_team.name)
		other_project = create_project(f"Team Unread Other Space {suffix}", other_team.name)
		source_discussion = create_discussion(f"Team Unread Source Discussion {suffix}", source_project.name)
		other_discussion = create_discussion(f"Team Unread Other Discussion {suffix}", other_project.name)
		source_unread_record = create_unread_record(user.name, source_discussion.name, source_project.name)
		other_unread_record = create_unread_record(user.name, other_discussion.name, other_project.name)

		frappe.set_user(user.name)
		projects = GPUnreadRecord.mark_all_as_read_for_team(source_team.name, user.name)

		self.assertIn(str(source_project.name), projects)
		self.assertNotIn(str(other_project.name), projects)
		self.assertEqual(frappe.db.get_value("GP Unread Record", source_unread_record, "is_unread"), 0)
		self.assertEqual(frappe.db.get_value("GP Unread Record", other_unread_record, "is_unread"), 1)
		self.assertTrue(
			frappe.db.exists("GP Project Visit", {"user": user.name, "project": source_project.name})
		)

	def test_mark_all_as_read_for_team_updates_existing_project_visit(self):
		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-visit-member-{suffix}@example.com", "Team Visit Member")
		team = create_team(f"Team Visit Source {suffix}")
		project = create_project(f"Team Visit Source Space {suffix}", team.name)
		discussion = create_discussion(f"Team Visit Source Discussion {suffix}", project.name)
		unread_record = create_unread_record(user.name, discussion.name, project.name)
		old_timestamp = frappe.utils.get_datetime("2026-01-01 00:00:00")
		visit = frappe.get_doc(
			{
				"doctype": "GP Project Visit",
				"user": user.name,
				"project": project.name,
				"last_visit": old_timestamp,
				"mark_all_read_at": old_timestamp,
			}
		).insert(ignore_permissions=True)

		frappe.set_user(user.name)
		GPUnreadRecord.mark_all_as_read_for_team(team.name, user.name)

		self.assertEqual(frappe.db.get_value("GP Unread Record", unread_record, "is_unread"), 0)
		self.assertEqual(frappe.db.count("GP Project Visit", {"user": user.name, "project": project.name}), 1)
		self.assertGreater(
			frappe.db.get_value("GP Project Visit", visit.name, "mark_all_read_at"),
			old_timestamp,
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()


def create_unread_record(user: str, discussion: str, project: str):
	return (
		frappe.get_doc(
			{
				"doctype": "GP Unread Record",
				"user": user,
				"discussion": discussion,
				"project": project,
				"is_unread": 1,
			}
		)
		.insert(ignore_permissions=True)
		.name
	)
