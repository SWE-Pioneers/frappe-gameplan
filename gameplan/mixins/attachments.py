# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt


import frappe

from gameplan.utils import extract_file_urls


class HasAttachments:
	"""Attach files referenced in a doc's HTML content to the doc itself.

	Editor uploads are created private and unattached (frappe/security#206), which
	means only the uploader can read them. Attaching each referenced File to its
	parent doc makes Frappe's File.has_permission delegate access to the parent's
	read permission, so other members who can read the doc can read its images.

	Doctypes opt in by setting `attachments_field` (defaults to "content") and
	calling `attach_files_in_content()` from `on_update`, mirroring HasMentions.
	"""

	def attach_files_in_content(self):
		field = getattr(self, "attachments_field", "content")
		urls = extract_file_urls(self.get(field))
		if not urls:
			return

		files = frappe.get_all(
			"File",
			filters={"file_url": ("in", urls)},
			fields=["name", "owner", "attached_to_doctype"],
		)
		for file in files:
			self._maybe_attach_file(file)

	def _maybe_attach_file(self, file):
		# Already attached somewhere: never steal a file from another doc, and a
		# file attached to this doc is already done (idempotent across edits).
		if file.attached_to_doctype:
			return
		# Only attach files the saver uploaded — attaching someone else's private
		# file would expose it to everyone who can read this doc.
		if file.owner not in (self.owner, frappe.session.user):
			return
		# Bare db.set_value avoids File.validate (disk moves / private-access checks
		# that can throw in another user's session) and the modified-timestamp bump.
		frappe.db.set_value(
			"File",
			file.name,
			{"attached_to_doctype": self.doctype, "attached_to_name": self.name},
			update_modified=False,
		)
