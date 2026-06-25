# Copyright (c) 2025, Frappe Technologies Pvt Ltd and Contributors
# See license.txt

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase

from gameplan.tests.utils import create_member

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]


class UnitTestGPDraft(UnitTestCase):
	"""
	Unit tests for GPDraft.
	Use this class for testing individual functions and methods.
	"""

	pass


class IntegrationTestGPDraft(IntegrationTestCase):
	"""
	Integration tests for GPDraft.
	Use this class for testing interactions between multiple components.
	"""

	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")

	def test_draft_is_writable_only_by_its_owner(self):
		"""A draft is readable by any member (a shared draft URL resolves), but writes are
		owner-scoped (if_owner): one member must not edit another's draft through the generic
		client API even with its name."""
		alice = create_member("draft_alice@example.com", "Alice")
		bob = create_member("draft_bob@example.com", "Bob")

		frappe.set_user(alice.name)
		draft = frappe.get_doc(
			doctype="GP Draft", type="Discussion", mode="New", content="Alice's private draft"
		).insert()

		# The owner can read and write their own draft.
		self.assertTrue(draft.has_permission("read"))
		self.assertTrue(draft.has_permission("write"))

		# Another member can read it (e.g. a shared URL) but cannot write to it.
		frappe.set_user(bob.name)
		self.assertTrue(frappe.has_permission("GP Draft", "read", doc=draft.name, user=bob.name))
		self.assertFalse(frappe.has_permission("GP Draft", "write", doc=draft.name, user=bob.name))
		with self.assertRaises(frappe.PermissionError):
			frappe.client.set_value("GP Draft", draft.name, "content", "Bob's edit")
