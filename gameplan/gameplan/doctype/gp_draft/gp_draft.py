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
			# The new discussion's on_update attaches the (private, unattached) editor
			# files referenced in its content to itself — see HasAttachments. Editor
			# uploads are never attached to the draft, so deleting the draft below does
			# not cascade-delete the published discussion's files.
			discussion = frappe.new_doc(
				"GP Discussion", title=self.title, content=content, project=self.project
			).insert()

			self.delete()
			return discussion.name


def remove_query_params_from_images(content):
	# replace strings like src="/path/to/image.jpg?fid=param" with src="/path/to/image.jpg"
	# because when we publish draft, images linked to the draft are deleted
	# presence of fid=<name> in the image url prevents the image from being displayed
	pattern = r'(src="[^"]+)\?[^"]*(")'
	return re.sub(pattern, r"\1\2", content)
