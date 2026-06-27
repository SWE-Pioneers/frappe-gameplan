# Copyright (c) 2022, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt
"""SQLite compatibility shim for ``autoname: autoincrement`` doctypes.

Frappe names ``autoname: autoincrement`` doctypes by pre-fetching a value from a
database sequence (``SELECT nextval(<seq>)``). SQLite has no sequences and frappe
does not emulate them, so naming such a doctype on a SQLite site raises
``OperationalError: no such column: <seq>``. Gameplan has 16 autoincrement
doctypes (GP Discussion, GP Comment, GP Member, ...), which makes the backend
test suite unrunnable on a SQLite-backed site.

This module emulates sequences with a tiny bookkeeping table and patches
``frappe.database.sequence.get_next_val`` (the name resolved by
``Database.get_next_sequence_val``) to use it. It is a no-op on every other
backend and is only switched on for test runs via the ``before_tests`` hook, so
production naming on MariaDB is never touched. Remove this once frappe supports
sequence emulation for SQLite natively.
"""

import frappe
from frappe.database import sequence as _sequence

_SEQUENCE_TABLE = "__gameplan_sqlite_sequence"
_original_get_next_val = _sequence.get_next_val


def _sqlite_get_next_val(doctype_name: str, slug: str = "_id_seq") -> int:
	seq = frappe.scrub(f"{doctype_name}{slug}")
	row = frappe.db.sql(f"SELECT `current` FROM `{_SEQUENCE_TABLE}` WHERE `name` = %s", (seq,))
	if row:
		next_val = row[0][0] + 1
		frappe.db.sql(
			f"UPDATE `{_SEQUENCE_TABLE}` SET `current` = %s WHERE `name` = %s", (next_val, seq)
		)
	else:
		# Seed past any rows that already exist for this doctype so emulated
		# names never collide with pre-existing ones (mirrors how frappe seeds
		# real sequences in create_missing_sequences).
		max_name = frappe.db.sql(f"SELECT MAX(CAST(`name` AS INTEGER)) FROM `tab{doctype_name}`")[0][0]
		next_val = (max_name or 0) + 1
		frappe.db.sql(
			f"INSERT INTO `{_SEQUENCE_TABLE}` (`name`, `current`) VALUES (%s, %s)", (seq, next_val)
		)
	return next_val


def _patched_get_next_val(doctype_name: str, slug: str = "_id_seq") -> int:
	if frappe.db.db_type == "sqlite":
		return _sqlite_get_next_val(doctype_name, slug)
	return _original_get_next_val(doctype_name, slug)


def enable():
	"""Install the SQLite sequence emulation. No-op on non-SQLite backends."""
	if frappe.db.db_type != "sqlite":
		return

	frappe.db.sql_ddl(
		f"CREATE TABLE IF NOT EXISTS `{_SEQUENCE_TABLE}` "
		"(`name` TEXT PRIMARY KEY, `current` INTEGER NOT NULL)"
	)
	_sequence.get_next_val = _patched_get_next_val
