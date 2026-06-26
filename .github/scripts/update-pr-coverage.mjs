// Writes a single coverage line into the PR description, scoped to one source
// (Backend or Frontend) via its own marker block. Each test workflow invokes this
// independently, so the two blocks update without clobbering each other.
//
// Env:
//   PR_NUMBER          - target PR
//   GITHUB_REPOSITORY  - owner/repo
//   SOURCE_KEY         - marker key, e.g. "backend" | "frontend"
//   SOURCE_LABEL       - human label, e.g. "Backend" | "Frontend"
//   HEAD_SUMMARY       - path to this run's coverage-summary.json
//   BASE_SUMMARY       - path to the base-branch baseline summary (may be absent)
//   BASE_BRANCH        - base branch name, for the "vs `<branch>`" suffix
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const {
  PR_NUMBER,
  GITHUB_REPOSITORY: REPO,
  SOURCE_KEY = "backend",
  SOURCE_LABEL = "Backend",
  HEAD_SUMMARY,
  BASE_SUMMARY,
  BASE_BRANCH = "main",
} = process.env;

const MARKER_START = `<!-- coverage:${SOURCE_KEY}:start -->`;
const MARKER_END = `<!-- coverage:${SOURCE_KEY}:end -->`;

if (!PR_NUMBER) {
  console.log("No PR_NUMBER — skipping PR description update.");
  process.exit(0);
}
if (!HEAD_SUMMARY || !existsSync(HEAD_SUMMARY)) {
  // No summary for this source (e.g. coverage collection produced nothing).
  // Skip rather than fail — coverage reporting must never block a PR.
  console.log(`No HEAD summary at ${HEAD_SUMMARY} — skipping ${SOURCE_LABEL}.`);
  process.exit(0);
}

const pctOf = (path) => JSON.parse(readFileSync(path, "utf8")).total.lines.pct;
const head = pctOf(HEAD_SUMMARY);
const base =
  BASE_SUMMARY && existsSync(BASE_SUMMARY) ? pctOf(BASE_SUMMARY) : null;

const fmtPct = (n) => `${n.toFixed(2)}%`;
const fmtDelta = (h, b) => {
  if (b === null) return "";
  const d = h - b;
  if (Math.abs(d) < 0.005) return ` (±0.00% vs \`${BASE_BRANCH}\`)`;
  return ` (${d > 0 ? "+" : ""}${d.toFixed(2)}% vs \`${BASE_BRANCH}\`)`;
};

const block = [
  MARKER_START,
  `${SOURCE_LABEL} coverage: ${fmtPct(head)}${fmtDelta(head, base)}`,
  MARKER_END,
].join("\n");

const currentBody = execSync(
  `gh pr view ${PR_NUMBER} --repo ${REPO} --json body --jq .body`,
  { encoding: "utf8" },
);

let newBody;
if (currentBody.includes(MARKER_START) && currentBody.includes(MARKER_END)) {
  newBody = currentBody.replace(
    new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`),
    block,
  );
} else {
  newBody = `${currentBody.trimEnd()}\n\n${block}\n`;
}

writeFileSync("pr-body.md", newBody);
execSync(`gh pr edit ${PR_NUMBER} --repo ${REPO} --body-file pr-body.md`, {
  stdio: "inherit",
});
console.log(`PR body updated with ${SOURCE_LABEL} coverage block.`);
