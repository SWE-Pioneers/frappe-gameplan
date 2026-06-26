# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
from collections import defaultdict

import frappe


def execute():
	"""Realign `GP Unread Record.project` with the discussion's current project.

	Moving a discussion between spaces changed `GP Discussion.project` but left its unread
	records pointing at the old space. The unread count groups by the record's project and
	`mark_all_as_read_for_team` clears by it, so a stale project misattributes the count and
	can leave it uncleared. Going forward this is kept in sync on move; this patch fixes the
	rows that already drifted.
	"""
	UnreadRecord = frappe.qb.DocType("GP Unread Record")
	Discussion = frappe.qb.DocType("GP Discussion")

	# Stale (discussion -> correct project) pairs. A correlated UPDATE...JOIN can't be
	# expressed unambiguously via the query builder, so resolve the targets first, then
	# update grouped by the correct project (one write per distinct target space).
	stale = (
		frappe.qb.from_(UnreadRecord)
		.join(Discussion)
		.on(Discussion.name == UnreadRecord.discussion)
		.where(UnreadRecord.project != Discussion.project)
		.select(UnreadRecord.discussion, Discussion.project)
		.distinct()
		.run(as_dict=True)
	)

	discussions_by_project = defaultdict(list)
	for row in stale:
		discussions_by_project[row.project].append(row.discussion)

	for project, discussions in discussions_by_project.items():
		(
			frappe.qb.update(UnreadRecord)
			.set(UnreadRecord.project, project)
			.where(UnreadRecord.discussion.isin(discussions))
		).run()
