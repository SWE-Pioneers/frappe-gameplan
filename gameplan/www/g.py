# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt


import frappe
from frappe.utils.jinja_globals import is_rtl
from frappe.utils.telemetry import capture

no_cache = 1


def get_context():
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()
	context = frappe._dict()
	context.boot = get_boot()
	context.boot.csrf_token = csrf_token
	if frappe.session.user != "Guest":
		capture("active_site", "gameplan")
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw("This method is only meant for developer mode")
	return get_boot()


def get_boot():
	lang = frappe.local.lang or frappe.db.get_single_value("System Settings", "language") or "en"
	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"default_route": get_default_route(),
			"site_name": frappe.local.site,
			"read_only_mode": frappe.flags.read_only,
			"gameplan_frontend_sentry_dsn": frappe.conf.gameplan_frontend_sentry_dsn,
			"lang": lang,
			"text_direction": "rtl" if is_rtl(lang) else "ltr",
		}
	)


def on_login(login_manager):
	frappe.response["default_route"] = get_default_route()


def get_default_route():
	if not frappe.db.get_all("GP Team", limit=1):
		return "/onboarding"
	else:
		return "/home"
