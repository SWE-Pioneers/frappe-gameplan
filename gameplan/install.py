# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt


def before_install():
	check_frappe_version()


def after_install():
	download_rembg_model()


def before_tests():
	# Frappe assigns autoincrement names via DB sequences, which SQLite lacks.
	# Enable the emulation shim so the suite can run on a SQLite-backed site.
	from gameplan.sqlite_sequence_compat import enable

	enable()


def check_frappe_version():
	from frappe import __version__
	from semantic_version import Version

	frappe_version = Version(__version__)
	if (frappe_version.major or 0) < 15:
		raise SystemExit("Gameplan requires Frappe Framework version 15 or above")


def download_rembg_model():
	try:
		from rembg import new_session

		new_session()
	except ImportError:
		# rembg is optional dependency, skip if not installed
		pass
