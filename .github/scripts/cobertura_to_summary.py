#!/usr/bin/env python3
"""Reduce a Cobertura coverage.xml to the summary shape the PR-comment step reads.

Frappe's `run-tests --coverage` emits a Cobertura report whose root <coverage>
element carries a `line-rate` attribute (a 0..1 fraction). We only need the line
percentage, normalized into the same `{ "total": { "lines": { "pct": N } } }`
shape the frontend (nyc json-summary) produces, so a single PR-comment script can
handle both sources.

Usage: cobertura_to_summary.py <coverage.xml> <out-summary.json>
"""

import json
import sys
import xml.etree.ElementTree as ET


def main() -> int:
	if len(sys.argv) != 3:
		print("usage: cobertura_to_summary.py <coverage.xml> <out.json>", file=sys.stderr)
		return 2

	src, out = sys.argv[1], sys.argv[2]
	root = ET.parse(src).getroot()

	# Cobertura stores the line fraction on the root element. Fall back to deriving
	# it from lines-covered/lines-valid if a tool ever omits line-rate.
	line_rate = root.get("line-rate")
	if line_rate is not None:
		pct = float(line_rate) * 100
	else:
		covered = float(root.get("lines-covered", 0))
		valid = float(root.get("lines-valid", 0))
		pct = (covered / valid * 100) if valid else 0.0

	summary = {"total": {"lines": {"pct": round(pct, 2)}}}
	with open(out, "w") as f:
		json.dump(summary, f)
	print(f"Backend line coverage: {summary['total']['lines']['pct']}%")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
