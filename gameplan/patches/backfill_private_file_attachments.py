# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

import frappe

BATCH_SIZE = 500


def execute():
	for doctype in ("GP Discussion", "GP Comment"):
		for name in iter_docs_with_private_files(doctype):
			doc = frappe.get_doc(doctype, name)
			doc.attach_files_in_content(allow_session_owner=False)


def iter_docs_with_private_files(doctype):
	last_name = None
	while names := get_docs_with_private_files(doctype, last_name):
		yield from names
		last_name = names[-1]


def get_docs_with_private_files(doctype, last_name=None):
	filters = {"content": ("like", "%/private/files/%")}
	if last_name:
		filters["name"] = (">", last_name)

	return frappe.qb.get_query(
		doctype,
		filters=filters,
		fields=["name"],
		order_by="name asc",
		limit=BATCH_SIZE,
	).run(pluck="name")
