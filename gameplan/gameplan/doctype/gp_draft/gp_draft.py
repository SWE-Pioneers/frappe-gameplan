# Copyright (c) 2025, Frappe Technologies Pvt Ltd and contributors
# For license information, please see license.txt

import re

import frappe
from frappe.model.document import Document


class GPDraft(Document):
	def before_save(self):
		from gameplan.utils.sanitizer import sanitize_content

		self.content = sanitize_content(self.content)

	@staticmethod
	def get_list(query):
		GPDraft = frappe.qb.DocType("GP Draft")
		query = query.where(GPDraft.owner == frappe.session.user)
		return query

	@frappe.whitelist()
	def publish(self):
		if self.owner != frappe.session.user:
			frappe.throw("You are not allowed to publish this draft")

		if self.type == "Discussion":
			content = remove_query_params_from_images(self.content)
			# New editor uploads are unattached and get picked up by HasAttachments on
			# insert. Older drafts can still have files attached to the draft itself;
			# move those before deleting the draft so Frappe doesn't cascade-delete them.
			discussion = frappe.new_doc(
				"GP Discussion", title=self.title, content=content, project=self.project
			).insert()
			self.move_attachments_to(discussion)

			self.delete()
			return discussion.name

	def move_attachments_to(self, doc):
		attachments = frappe.qb.get_query(
			"File",
			filters={"attached_to_doctype": self.doctype, "attached_to_name": self.name},
		).run(pluck="name")
		for attachment in attachments:
			frappe.db.set_value(
				"File",
				attachment,
				{"attached_to_doctype": doc.doctype, "attached_to_name": doc.name},
				update_modified=False,
			)


def remove_query_params_from_images(content):
	# replace strings like src="/path/to/image.jpg?fid=param" with src="/path/to/image.jpg"
	# because when we publish draft, images linked to the draft are deleted
	# presence of fid=<name> in the image url prevents the image from being displayed
	pattern = r'(src="[^"]+)\?[^"]*(")'
	return re.sub(pattern, r"\1\2", content)
