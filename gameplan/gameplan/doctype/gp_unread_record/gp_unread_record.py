# Copyright (c) 2025, Frappe Technologies Pvt Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document, bulk_insert


class GPUnreadRecord(Document):
	@staticmethod
	def create_unread_records_for_discussion(discussion_doc):
		"""Create unread records for all project members when discussion is created"""
		if frappe.flags.in_migrate or frappe.flags.in_patch:
			return

		project_members = GPUnreadRecord._get_project_members(discussion_doc.project)

		records = []
		for user in project_members:
			if user == discussion_doc.owner:
				continue

			records.append(
				frappe.get_doc(
					{
						"doctype": "GP Unread Record",
						"user": user,
						"discussion": discussion_doc.name,
						"project": discussion_doc.project,
						"comment": None,
						"is_unread": 1,
					}
				)
			)

		GPUnreadRecord._bulk_create_unread_records(records)

	@staticmethod
	def create_unread_records_for_comment(comment_doc):
		"""Create unread records for all project members when comment is created"""
		if frappe.flags.in_migrate or frappe.flags.in_patch:
			return

		if comment_doc.reference_doctype != "GP Discussion":
			return

		discussion_doc = frappe.db.get_value(
			"GP Discussion", comment_doc.reference_name, ["name", "project", "owner"], as_dict=True
		)
		project_members = GPUnreadRecord._get_project_members(discussion_doc.project)

		records = []
		for user in project_members:
			if user == comment_doc.owner:
				continue

			records.append(
				frappe.get_doc(
					{
						"doctype": "GP Unread Record",
						"user": user,
						"discussion": comment_doc.reference_name,
						"project": discussion_doc.project,
						"comment": comment_doc.name,
						"is_unread": 1,
					}
				)
			)

		GPUnreadRecord._bulk_create_unread_records(records)

	@staticmethod
	def delete_unread_records_for_discussion(discussion: str):
		"""Delete unread records for the discussion"""
		if frappe.flags.in_migrate or frappe.flags.in_patch:
			return

		UnreadRecord = frappe.qb.DocType("GP Unread Record")
		frappe.qb.from_("GP Unread Record").where(UnreadRecord.discussion == str(discussion)).delete().run()

	@staticmethod
	def delete_unread_records_for_comment(comment: str):
		"""Delete unread records for a specific comment"""
		if frappe.flags.in_migrate or frappe.flags.in_patch:
			return

		UnreadRecord = frappe.qb.DocType("GP Unread Record")
		frappe.qb.from_("GP Unread Record").where(UnreadRecord.comment == str(comment)).delete().run()

	@staticmethod
	def delete_unread_records_for_project(project: str):
		"""Delete unread records for a specific project"""
		if frappe.flags.in_migrate or frappe.flags.in_patch:
			return

		UnreadRecord = frappe.qb.DocType("GP Unread Record")
		frappe.qb.from_(UnreadRecord).where(UnreadRecord.project == str(project)).delete().run()

	@staticmethod
	def mark_discussion_as_read_for_user(discussion, user):
		"""Mark all unread records for this discussion and user as read"""
		UnreadRecord = frappe.qb.DocType("GP Unread Record")
		query = (
			frappe.qb.update(UnreadRecord)
			.set(UnreadRecord.is_unread, 0)
			.where(
				(UnreadRecord.user == user)
				& (UnreadRecord.discussion == discussion)
				& (UnreadRecord.is_unread == 1)
			)
		)
		return query.run(as_dict=1)

	@staticmethod
	def mark_discussion_as_unread_for_user(discussion, user):
		"""Mark a discussion unread for a user by restoring the discussion-level unread record."""
		discussion_level_record = frappe.db.get_value(
			"GP Unread Record",
			{
				"user": user,
				"discussion": discussion,
				"comment": ["is", "not set"],
			},
			"name",
		)

		if discussion_level_record:
			frappe.db.set_value(
				"GP Unread Record", discussion_level_record, "is_unread", 1, update_modified=False
			)
			return discussion_level_record

		project = frappe.db.get_value("GP Discussion", discussion, "project")
		if not project:
			return

		return (
			frappe.get_doc(
				{
					"doctype": "GP Unread Record",
					"user": user,
					"discussion": discussion,
					"project": project,
					"comment": None,
					"is_unread": 1,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	@staticmethod
	def mark_all_as_read_for_project(project, user):
		"""Mark all discussions in project as read for user"""

		UnreadRecord = frappe.qb.DocType("GP Unread Record")
		query = (
			frappe.qb.update(UnreadRecord)
			.set(UnreadRecord.is_unread, 0)
			.where(
				(UnreadRecord.user == user)
				& (UnreadRecord.project == project)
				& (UnreadRecord.is_unread == 1)
			)
		)
		return query.run(as_dict=1)

	@staticmethod
	def mark_all_as_read_for_team(team, user):
		projects = GPUnreadRecord.get_accessible_project_names_for_team(team, user)
		if not projects:
			return []

		UnreadRecord = frappe.qb.DocType("GP Unread Record")
		(
			frappe.qb.update(UnreadRecord)
			.set(UnreadRecord.is_unread, 0)
			.where(
				(UnreadRecord.user == user)
				& (UnreadRecord.project.isin(projects))
				& (UnreadRecord.is_unread == 1)
			)
		).run()

		GPUnreadRecord.update_project_visits_for_mark_all_read(projects, user)
		return projects

	@staticmethod
	def get_accessible_project_names_for_team(team, user):
		from gameplan.permissions import apply_project_query_filter

		Project = frappe.qb.DocType("GP Project")
		query = (
			frappe.qb.from_(Project)
			.select(Project.name)
			.where((Project.team == team) & Project.archived_at.isnull())
		)
		query = apply_project_query_filter(query, user)
		return [str(row.name) for row in query.run(as_dict=True)]

	@staticmethod
	def update_project_visits_for_mark_all_read(projects: list[str], user):
		now = frappe.utils.now()

		for project in projects:
			project_visit_name = frappe.db.get_value("GP Project Visit", {"user": user, "project": project})
			if project_visit_name:
				frappe.db.set_value(
					"GP Project Visit",
					project_visit_name,
					{"mark_all_read_at": now, "last_visit": now},
					update_modified=False,
				)
				continue

			frappe.get_doc(
				{
					"doctype": "GP Project Visit",
					"user": user,
					"project": project,
					"last_visit": now,
					"mark_all_read_at": now,
				}
			).insert(ignore_permissions=True)

	@staticmethod
	def get_unread_count_for_projects(user, projects: list[str] = None):
		"""Get unread count for a single project for user"""
		from frappe.query_builder import functions

		UnreadRecord = frappe.qb.DocType("GP Unread Record")

		if projects:
			condition = (
				(UnreadRecord.user == user)
				& (UnreadRecord.project.isin(projects))
				& (UnreadRecord.is_unread == 1)
			)
		else:
			condition = (UnreadRecord.user == user) & (UnreadRecord.is_unread == 1)

		result = (
			frappe.qb.from_(UnreadRecord)
			.select(
				UnreadRecord.project,
				functions.Count(UnreadRecord.discussion).distinct().as_("unread_discussions_count"),
			)
			.where(condition)
			.groupby(UnreadRecord.project)
			.run(as_dict=True)
		)

		out = {}
		if projects:
			for project in projects:
				out[project] = 0

		for row in result:
			out[row.project] = row.unread_discussions_count

		return out

	@staticmethod
	def get_participating_unread_count(user, team=None):
		"""Count distinct unread discussions the user participates in.

		Mirrors the `participating` feed filter (owned or commented) intersected with
		the user's unread records so the menu badge always matches the feed contents.
		"""
		from frappe.query_builder.functions import Count
		from frappe.utils import cint
		from pypika.terms import ExistsCriterion

		from gameplan.gameplan.doctype.gp_discussion.api import clause_discussions_commented_by_user
		from gameplan.permissions import apply_accessible_project_filter

		Discussion = frappe.qb.DocType("GP Discussion")
		Project = frappe.qb.DocType("GP Project")
		UnreadRecord = frappe.qb.DocType("GP Unread Record")

		unread_record_exists = (
			frappe.qb.from_(UnreadRecord)
			.select(UnreadRecord.name)
			.where(
				(UnreadRecord.user == user)
				& (UnreadRecord.discussion == Discussion.name)
				& (UnreadRecord.is_unread == 1)
			)
		)

		query = (
			frappe.qb.from_(Discussion)
			.left_join(Project)
			.on(Discussion.project == Project.name)
			.where(Project.archived_at.isnull())
			.where(ExistsCriterion(unread_record_exists))
			.where((Discussion.owner == user) | clause_discussions_commented_by_user(user))
			.select(Count(Discussion.name).distinct())
		)
		query = apply_accessible_project_filter(query, Discussion.project)

		if team:
			query = query.where(Project.team == team)

		return cint(query.run()[0][0])

	@staticmethod
	def _get_project_members(project_name):
		"""Get all users who have access to the project"""
		import gameplan

		project = frappe.db.get_value("GP Project", project_name, ["name", "is_private"], as_dict=True)

		all_users = set()

		if project.is_private:
			members = frappe.qb.get_query(
				"GP Member",
				fields=["user"],
				filters={"parent": project.name, "parenttype": "GP Project"},
			).run(pluck=True)
			all_users.update(members)
		else:
			enabled_users = frappe.qb.get_query(
				"GP User Profile", filters={"enabled": 1}, fields=["user"]
			).run(pluck=True)

			for user in enabled_users:
				if not gameplan.is_guest(user):
					all_users.add(user)

		# Include guest users with explicit project access
		guest_users = frappe.qb.get_query(
			"GP Guest Access",
			fields=["user"],
			filters={"project": project.name},
		).run(pluck=True)
		all_users.update(guest_users)

		return list(all_users)

	@staticmethod
	def _bulk_create_unread_records(records):
		"""Bulk insert unread records with error handling"""
		if not records:
			return

		for doc in records:
			if not doc.name:
				doc.name = frappe.db.get_next_sequence_val("GP Unread Record")

		try:
			bulk_insert("GP Unread Record", records, ignore_duplicates=True)
		except Exception:
			frappe.log_error(title="Unread Record Creation Error")


def on_doctype_update():
	add_indexes()


def add_indexes():
	frappe.db.add_index("GP Unread Record", ["user", "discussion", "is_unread"], "user_discussion_unread")
	frappe.db.add_index("GP Unread Record", ["user", "project", "is_unread"], "user_project_unread")


# Re-exported so the thin whitelisted unread-count endpoints resolve under the
# `GP Unread Record/<method>` endpoint while their implementation lives in api.py.
from gameplan.gameplan.doctype.gp_unread_record.api import (  # noqa: E402, F401
	get_participating_unread_count,
	get_unread_count,
	mark_all_as_read_for_team,
)
