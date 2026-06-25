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

	def test_mark_all_as_read_for_team_with_before_marks_only_older_discussions(self):
		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-before-member-{suffix}@example.com", "Team Before Member")
		team = create_team(f"Team Before Source {suffix}")
		project = create_project(f"Team Before Source Space {suffix}", team.name)

		old_discussion = create_discussion(f"Team Before Old Discussion {suffix}", project.name)
		new_discussion = create_discussion(f"Team Before New Discussion {suffix}", project.name)
		set_last_post_at(old_discussion.name, "2026-01-10 09:00:00")
		set_last_post_at(new_discussion.name, "2026-01-20 09:00:00")

		old_unread_record = create_unread_record(user.name, old_discussion.name, project.name)
		new_unread_record = create_unread_record(user.name, new_discussion.name, project.name)

		frappe.set_user(user.name)
		projects = GPUnreadRecord.mark_all_as_read_for_team(team.name, user.name, before="2026-01-15")

		self.assertIn(str(project.name), projects)
		self.assertEqual(frappe.db.get_value("GP Unread Record", old_unread_record, "is_unread"), 0)
		self.assertEqual(frappe.db.get_value("GP Unread Record", new_unread_record, "is_unread"), 1)

	def test_mark_all_as_read_for_team_before_is_inclusive_of_that_whole_day(self):
		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-boundary-member-{suffix}@example.com", "Team Boundary Member")
		team = create_team(f"Team Boundary Source {suffix}")
		project = create_project(f"Team Boundary Source Space {suffix}", team.name)

		# `before` is 2026-01-15: a discussion late on that day is included (inclusive),
		# one early on the next day is excluded.
		on_day_discussion = create_discussion(f"Team Boundary On Day {suffix}", project.name)
		next_day_discussion = create_discussion(f"Team Boundary Next Day {suffix}", project.name)
		set_last_post_at(on_day_discussion.name, "2026-01-15 23:59:59")
		set_last_post_at(next_day_discussion.name, "2026-01-16 00:00:01")

		on_day_unread_record = create_unread_record(user.name, on_day_discussion.name, project.name)
		next_day_unread_record = create_unread_record(user.name, next_day_discussion.name, project.name)

		frappe.set_user(user.name)
		GPUnreadRecord.mark_all_as_read_for_team(team.name, user.name, before="2026-01-15")

		self.assertEqual(frappe.db.get_value("GP Unread Record", on_day_unread_record, "is_unread"), 0)
		self.assertEqual(frappe.db.get_value("GP Unread Record", next_day_unread_record, "is_unread"), 1)

	def test_mark_all_as_read_for_team_with_before_sets_watermark_to_cutoff(self):
		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-watermark-member-{suffix}@example.com", "Team Watermark Member")
		team = create_team(f"Team Watermark Source {suffix}")
		project = create_project(f"Team Watermark Source Space {suffix}", team.name)
		discussion = create_discussion(f"Team Watermark Discussion {suffix}", project.name)
		set_last_post_at(discussion.name, "2026-01-10 09:00:00")
		create_unread_record(user.name, discussion.name, project.name)

		before = "2026-01-15"
		cutoff = frappe.utils.add_days(before, 1)
		before_action = frappe.utils.get_datetime(frappe.utils.now())

		frappe.set_user(user.name)
		GPUnreadRecord.mark_all_as_read_for_team(team.name, user.name, before=before)

		visit = frappe.db.get_value(
			"GP Project Visit",
			{"user": user.name, "project": project.name},
			["last_visit", "mark_all_read_at"],
			as_dict=True,
		)
		self.assertIsNotNone(visit)
		# Watermark is the inclusive end of the `before` day: within that day and strictly
		# below the exclusive cutoff, so the `> watermark` read check matches the `< cutoff`
		# unread query exactly (no midnight-boundary skew).
		watermark = frappe.utils.get_datetime(visit.mark_all_read_at)
		self.assertGreaterEqual(watermark, frappe.utils.get_datetime(before))
		self.assertLess(watermark, frappe.utils.get_datetime(cutoff))
		# `last_visit` reflects the action time (~now), not the cutoff date in the past.
		self.assertGreaterEqual(frappe.utils.get_datetime(visit.last_visit), before_action)

	def test_mark_all_as_read_for_team_without_before_sets_watermark_to_now(self):
		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-now-member-{suffix}@example.com", "Team Now Member")
		team = create_team(f"Team Now Source {suffix}")
		project = create_project(f"Team Now Source Space {suffix}", team.name)
		discussion = create_discussion(f"Team Now Discussion {suffix}", project.name)
		create_unread_record(user.name, discussion.name, project.name)

		before_action = frappe.utils.get_datetime(frappe.utils.now())

		frappe.set_user(user.name)
		GPUnreadRecord.mark_all_as_read_for_team(team.name, user.name)

		visit = frappe.db.get_value(
			"GP Project Visit",
			{"user": user.name, "project": project.name},
			["last_visit", "mark_all_read_at"],
			as_dict=True,
		)
		self.assertIsNotNone(visit)
		# Without a `before` date everything is marked read up to now.
		self.assertGreaterEqual(frappe.utils.get_datetime(visit.mark_all_read_at), before_action)
		self.assertGreaterEqual(frappe.utils.get_datetime(visit.last_visit), before_action)

	def test_mark_all_as_read_for_team_with_before_never_rewinds_a_newer_watermark(self):
		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-rewind-member-{suffix}@example.com", "Team Rewind Member")
		team = create_team(f"Team Rewind Source {suffix}")
		project = create_project(f"Team Rewind Source Space {suffix}", team.name)
		discussion = create_discussion(f"Team Rewind Discussion {suffix}", project.name)
		set_last_post_at(discussion.name, "2026-01-10 09:00:00")
		create_unread_record(user.name, discussion.name, project.name)

		frappe.set_user(user.name)
		# First mark everything read up to now: the watermark advances to "today".
		GPUnreadRecord.mark_all_as_read_for_team(team.name, user.name)
		newer_watermark = frappe.db.get_value(
			"GP Project Visit", {"user": user.name, "project": project.name}, "mark_all_read_at"
		)

		# Then mark "before" an OLDER date. The earlier cutoff must not rewind the watermark,
		# which would resurface discussions read between that date and now.
		GPUnreadRecord.mark_all_as_read_for_team(team.name, user.name, before="2026-01-15")

		watermark = frappe.db.get_value(
			"GP Project Visit", {"user": user.name, "project": project.name}, "mark_all_read_at"
		)
		self.assertEqual(frappe.utils.get_datetime(watermark), frappe.utils.get_datetime(newer_watermark))

	def test_mark_all_as_read_for_team_clamps_future_before_to_today(self):
		# The whitelisted endpoint clamps `before` so a client can't push the watermark into
		# the future (which would mark not-yet-posted discussions read).
		from gameplan.gameplan.doctype.gp_unread_record.api import mark_all_as_read_for_team

		suffix = frappe.generate_hash(length=8)
		user = create_member(f"team-clamp-member-{suffix}@example.com", "Team Clamp Member")
		team = create_team(f"Team Clamp Source {suffix}")
		project = create_project(f"Team Clamp Source Space {suffix}", team.name)
		discussion = create_discussion(f"Team Clamp Discussion {suffix}", project.name)
		record = create_unread_record(user.name, discussion.name, project.name)

		frappe.set_user(user.name)
		mark_all_as_read_for_team(team=team.name, before="2099-01-01")

		# Clamped to today, so today's discussion is read...
		self.assertEqual(frappe.db.get_value("GP Unread Record", record, "is_unread"), 0)
		# ...and the watermark stays near today rather than jumping to the far-future cutoff.
		watermark = frappe.db.get_value(
			"GP Project Visit", {"user": user.name, "project": project.name}, "mark_all_read_at"
		)
		self.assertLess(
			frappe.utils.get_datetime(watermark),
			frappe.utils.get_datetime(frappe.utils.add_days(frappe.utils.nowdate(), 2)),
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()


def set_last_post_at(discussion: str, last_post_at: str):
	# `last_post_at` is auto-set to now() in GP Discussion.before_insert, so override it
	# directly to pin a specific activity time without bumping `modified`.
	frappe.db.set_value("GP Discussion", discussion, "last_post_at", last_post_at, update_modified=False)


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
