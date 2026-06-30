import frappe


def execute():
	profile = frappe.qb.DocType("GP User Profile")
	(
		frappe.qb.update(profile)
		.set(profile.email_digest_frequency, "Off")
		.where((profile.email_digest_frequency.isnull()) | (profile.email_digest_frequency != "Off"))
	).run()
