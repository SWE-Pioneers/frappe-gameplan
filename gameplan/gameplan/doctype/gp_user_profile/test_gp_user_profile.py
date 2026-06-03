# Copyright (c) 2022, Frappe Technologies Pvt Ltd and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from gameplan.gameplan.doctype.gp_user_profile.gp_user_profile import has_permission
from gameplan.tests.utils import create_member


def get_profile(user):
	return frappe.get_doc("GP User Profile", {"user": user})


class TestGPUserProfile(FrappeTestCase):
	def setUp(self):
		self.alice = create_member("test_alice@example.com", "Alice")
		self.bob = create_member("test_bob@example.com", "Bob")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_owner_can_edit_own_bio(self):
		profile = get_profile(self.alice.name)
		self.assertTrue(has_permission(profile, ptype="write", user=self.alice.name))

	def test_member_cannot_edit_others_bio(self):
		"""A Gameplan Member must not be able to edit someone else's profile bio."""
		alice_profile = get_profile(self.alice.name)
		self.assertFalse(has_permission(alice_profile, ptype="write", user=self.bob.name))

	def test_admin_can_edit_any_bio(self):
		alice_profile = get_profile(self.alice.name)
		self.assertTrue(has_permission(alice_profile, ptype="write", user="Administrator"))

	def test_anyone_can_read_bio(self):
		alice_profile = get_profile(self.alice.name)
		self.assertTrue(has_permission(alice_profile, ptype="read", user=self.bob.name))

	def test_member_cannot_save_others_bio(self):
		"""End-to-end: saving another user's profile is blocked by permissions."""
		alice_profile = get_profile(self.alice.name)
		frappe.set_user(self.bob.name)
		alice_profile.bio = "hacked by bob"
		with self.assertRaises(frappe.PermissionError):
			alice_profile.save()

	def test_owner_can_save_own_bio(self):
		frappe.set_user(self.alice.name)
		profile = get_profile(self.alice.name)
		profile.bio = "hello, I am Alice"
		profile.save()
		self.assertEqual(get_profile(self.alice.name).bio, "hello, I am Alice")
