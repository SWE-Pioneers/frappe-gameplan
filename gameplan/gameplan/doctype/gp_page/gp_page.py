# Copyright (c) 2023, Frappe Technologies Pvt Ltd and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from gameplan.mixins.attachments import HasAttachments
from gameplan.permissions import content_has_permission, page_query_conditions
from gameplan.utils import url_safe_slug


class GPPage(HasAttachments, Document):
	attachments_field = "content"

	def before_save(self):
		self.slug = url_safe_slug(self.title)

	def on_update(self):
		self.attach_files_in_content()


def has_permission(doc, ptype="read", user=None):
	return content_has_permission(doc, ptype, user)


def get_permission_query_conditions(user):
	return page_query_conditions(user)
