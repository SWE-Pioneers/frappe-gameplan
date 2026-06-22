# Copyright (c) 2022, Frappe Technologies Pvt Ltd and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from gameplan.gameplan.doctype.gp_team.gp_team import update_joined_teams
from gameplan.gameplan.doctype.gp_user_profile.gp_user_profile import get_session_user_profile
from gameplan.tests.utils import create_member


class TestGPTeam(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.db.rollback()

	def test_after_insert_creates_general_space(self):
		team = frappe.get_doc(doctype="GP Team", title="General Space Team").insert(ignore_permissions=True)

		spaces = frappe.db.get_all("GP Project", filters={"team": team.name}, fields=["title", "is_private"])
		self.assertEqual(len(spaces), 1)
		self.assertEqual(spaces[0].title, "General")
		# General must be public so all community members can see it by default.
		self.assertEqual(spaces[0].is_private, 0)

	def test_after_insert_skips_general_when_space_already_exists(self):
		team = frappe.get_doc(doctype="GP Team", title="Existing Space Team").insert(ignore_permissions=True)
		# Hook already created exactly one General space.
		self.assertEqual(frappe.db.count("GP Project", {"team": team.name}), 1)

		# Re-running the hook must not duplicate it (idempotency rule).
		team.create_general_space()
		self.assertEqual(frappe.db.count("GP Project", {"team": team.name}), 1)

	def test_skip_general_space_flag_suppresses_hook(self):
		team = frappe.new_doc("GP Team")
		team.title = "Suppressed Space Team"
		team.flags.skip_general_space = True
		team.insert(ignore_permissions=True)

		self.assertEqual(frappe.db.count("GP Project", {"team": team.name}), 0)

	def test_update_joined_teams_saves_profile_community_order(self):
		user = create_member("community-order@example.com", "Community Order")
		first_team = frappe.get_doc(doctype="GP Team", title="Order First Team").insert(
			ignore_permissions=True
		)
		second_team = frappe.get_doc(doctype="GP Team", title="Order Second Team").insert(
			ignore_permissions=True
		)

		frappe.set_user(user.name)
		ordered_teams = [second_team.name, first_team.name]

		self.assertEqual(update_joined_teams(ordered_teams), ordered_teams)
		self.assertEqual(frappe.parse_json(get_session_user_profile().community_order), ordered_teams)

	def test_update_joined_teams_saves_profile_sidebar_badge_style(self):
		user = create_member("sidebar-badge-style@example.com", "Sidebar Badge Style")
		team = frappe.get_doc(doctype="GP Team", title="Badge Style Team").insert(ignore_permissions=True)

		frappe.set_user(user.name)

		self.assertEqual(update_joined_teams([team.name], "Dot"), [team.name])
		self.assertEqual(get_session_user_profile().sidebar_badge_style, "Dot")

	def test_update_joined_teams_rejects_invalid_sidebar_badge_style(self):
		user = create_member("invalid-sidebar-badge-style@example.com", "Invalid Badge Style")
		team = frappe.get_doc(doctype="GP Team", title="Invalid Badge Style Team").insert(
			ignore_permissions=True
		)

		frappe.set_user(user.name)

		self.assertRaises(frappe.ValidationError, update_joined_teams, [team.name], "Banner")
