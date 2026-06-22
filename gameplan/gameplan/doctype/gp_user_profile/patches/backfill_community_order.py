import frappe


def execute():
	profiles = get_profiles_without_community_order()
	if not profiles:
		return

	community_orders = get_community_orders_by_user({profile.user for profile in profiles})
	for profile in profiles:
		community_order = community_orders.get(profile.user)
		if community_order:
			frappe.db.set_value(
				"GP User Profile",
				profile.name,
				"community_order",
				frappe.as_json(community_order),
				update_modified=False,
			)


def get_profiles_without_community_order():
	return frappe.db.get_all(
		"GP User Profile",
		filters={"community_order": ["in", ["", None]]},
		fields=["name", "user"],
	)


def get_community_orders_by_user(users: set[str]):
	if not users:
		return {}

	Team = frappe.qb.DocType("GP Team")
	Member = frappe.qb.DocType("GP Member")
	rows = (
		frappe.qb.from_(Member)
		.inner_join(Team)
		.on(Team.name == Member.parent)
		.select(Member.user, Team.name)
		.where(Member.parenttype == "GP Team")
		.where(Member.user.isin(users))
		.where(Team.archived_at.isnull())
		.orderby(Member.user)
		.orderby(Team.title)
	).run(as_dict=True)

	community_orders = {}
	for row in rows:
		community_orders.setdefault(row.user, []).append(row.name)
	return community_orders
