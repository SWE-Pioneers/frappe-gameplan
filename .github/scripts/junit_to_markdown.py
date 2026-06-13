#!/usr/bin/env python3
"""Render Cypress (mocha-junit-reporter) JUnit XML as a simple markdown table.

Usage: junit_to_markdown.py <results_dir> [commit_sha]

Reads every *.xml in <results_dir> (one file per spec), aggregates per spec and a
total row, and prints a markdown report to stdout. Used by the UI test workflows to
post a results comment on the PR.
"""

import glob
import os
import sys
import xml.etree.ElementTree as ET


def fmt_time(seconds: float) -> str:
	s = round(seconds)
	if s < 60:
		return f"{s}s"
	m, s = divmod(s, 60)
	return f"{m}m {s}s"


def parse_file(path: str):
	"""Return (spec_name, total, passed, failed, skipped, seconds) for one XML file."""
	root = ET.parse(path).getroot()
	suites = root.findall(".//testsuite")

	spec = next((s.get("file") for s in suites if s.get("file")), None)
	spec = os.path.basename(spec) if spec else os.path.basename(path)

	cases = root.findall(".//testcase")
	total = len(cases)
	failed = sum(1 for c in cases if c.find("failure") is not None or c.find("error") is not None)
	skipped = sum(1 for c in cases if c.find("skipped") is not None)
	passed = total - failed - skipped

	seconds = root.get("time")
	seconds = float(seconds) if seconds else sum(float(c.get("time") or 0) for c in cases)

	return spec, total, passed, failed, skipped, seconds


def main() -> int:
	results_dir = sys.argv[1] if len(sys.argv) > 1 else "."
	commit = sys.argv[2] if len(sys.argv) > 2 else ""

	files = sorted(glob.glob(os.path.join(results_dir, "**", "*.xml"), recursive=True))
	rows = [parse_file(f) for f in files]

	print("## UI Test Results\n")
	if not rows:
		print("⚠️ No test results were found.")
		return 0

	t_total = sum(r[1] for r in rows)
	t_pass = sum(r[2] for r in rows)
	t_fail = sum(r[3] for r in rows)
	t_skip = sum(r[4] for r in rows)
	t_time = sum(r[5] for r in rows)

	status = "✅ All passed" if t_fail == 0 else f"❌ {t_fail} failed"
	print(f"{status} — {t_pass}/{t_total} tests passed in {fmt_time(t_time)}.\n")

	print("| Spec | Tests | ✅ | ❌ | ⏭ | ⏱ |")
	print("| --- | --: | --: | --: | --: | --: |")
	for spec, total, passed, failed, skipped, seconds in sorted(rows):
		print(f"| {spec} | {total} | {passed} | {failed} | {skipped} | {fmt_time(seconds)} |")
	print(f"| **Total** | **{t_total}** | **{t_pass}** | **{t_fail}** | **{t_skip}** | **{fmt_time(t_time)}** |")

	if commit:
		print(f"\n<sub>Results for commit {commit[:7]}.</sub>")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
