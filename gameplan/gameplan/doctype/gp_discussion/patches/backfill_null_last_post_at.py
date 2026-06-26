# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and Contributors
import frappe


def execute():
	"""Backfill `last_post_at` for discussions that never had it set.

	The earlier `set_last_post` patch INNER JOINs to comments/polls, so it only touched
	discussions with at least one reply. Discussions with no posts (e.g. seeded "About the
	X category" / welcome posts) were left with a NULL `last_post_at`. That NULL breaks the
	dated "mark all as read" path, whose `last_post_at < cutoff` filter drops NULL rows and
	strands those discussions as permanently unread. Mirror `before_insert`, which sets
	`last_post_at` to the discussion's creation time when there are no posts.
	"""
	Discussion = frappe.qb.DocType("GP Discussion")
	(
		frappe.qb.update(Discussion)
		.set(Discussion.last_post_at, Discussion.creation)
		.where(Discussion.last_post_at.isnull())
	).run()
