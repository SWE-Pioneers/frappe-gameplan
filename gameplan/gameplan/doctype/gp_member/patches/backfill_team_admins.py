import frappe
from frappe.utils import cint


def execute():
	for team_name in frappe.get_all("GP Team", pluck="name"):
		team = frappe.get_doc("GP Team", team_name)
		if any(cint(member.get("is_admin")) for member in team.members):
			continue

		make_owner_admin(team)

		team.save(ignore_permissions=True)


def make_owner_admin(team):
	owner = team.owner or "Administrator"
	for member in team.members:
		if member.user == owner:
			member.is_admin = 1
			return

	team.append("members", {"user": owner, "is_admin": 1})
