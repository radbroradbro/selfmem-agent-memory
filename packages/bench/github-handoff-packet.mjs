import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());
const repository = "radbroradbro/selfmem-agent-memory";
const pullRequest = 5;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;

const requiredBlockers = [
  "claude-reviewer-route-blocked",
  "github-pr-body-update-blocked",
  "github-issue-create-blocked",
  "human-public-launch-approval-required",
  "hosted-supermemory-baseline-not-current",
];

const paths = {
  releaseState: join(root, reviewDir, "release-state.json"),
  prBodyDraft: join(root, reviewDir, "pr-body-update-draft.md"),
  issueDraft: join(root, reviewDir, "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md"),
  githubBlocked: join(root, reviewDir, "github-issue-create-blocked.md"),
  claudeBlocked: join(root, reviewDir, "claude-pr5-review-blocked.md"),
  releaseHandoff: join(root, "docs/RELEASE_HANDOFF.md"),
};

for (const [name, path] of Object.entries(paths)) {
  assert.ok(existsSync(path), `${name} missing at ${path}`);
  assert.ok(statSync(path).size > 0, `${name} is empty at ${path}`);
}

const releaseState = JSON.parse(readFileSync(paths.releaseState, "utf8"));
const prBodyDraftText = readFileSync(paths.prBodyDraft, "utf8");
const issueBody = readFileSync(paths.issueDraft, "utf8");
const githubBlockedText = readFileSync(paths.githubBlocked, "utf8");
const claudeBlockedText = readFileSync(paths.claudeBlocked, "utf8");
const releaseHandoffText = readFileSync(paths.releaseHandoff, "utf8");

const prBody = extractFencedMarkdown(prBodyDraftText);
const issueTitle = extractIssueTitle(issueBody);
const currentHead = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const branch = run("git", ["branch", "--show-current"]).stdout.trim();
const remoteUrl = run("git", ["remote", "get-url", "origin"]).stdout.trim();
const latestBaseline = releaseState.latestVerifiedCodeBaseline;
const latestCiRunId = latestBaseline?.ciRunId;
const latestHeadShort = String(latestBaseline?.headSha ?? "").slice(0, 7);

assert.equal(releaseState.goalStatus, "active");
assert.equal(releaseState.repository, repository);
assert.equal(releaseState.pullRequest?.number, pullRequest);
assert.equal(releaseState.publicLaunchVerdict, "FAIL");
assert.equal(releaseState.productionReady, false);
assert.equal(releaseState.safetyBoundary?.usesFixtureUiEvidence, true);
assert.equal(releaseState.safetyBoundary?.commitsRawMemories, false);
assert.equal(releaseState.safetyBoundary?.commitsRawTranscripts, false);
assert.equal(releaseState.safetyBoundary?.commitsCredentials, false);
assert.equal(releaseState.safetyBoundary?.enablesHostedWriteBack, false);
assert.equal(typeof latestCiRunId, "number");
assert.match(String(latestBaseline?.headSha ?? ""), /^[a-f0-9]{40}$/);
assert.equal(latestBaseline?.ciConclusion, "success");
for (const blocker of requiredBlockers) {
  assert.ok(releaseState.remainingBlockers?.includes(blocker), `missing release blocker ${blocker}`);
}

assert.match(prBody, /Current-head live browser evidence/i);
assert.match(prBody, /release blocker doctor/i);
assert.match(prBody, new RegExp(String(latestCiRunId)));
assert.match(prBody, /public launch.*blocked|Public launch should still wait/i);
assert.match(prBody, /Not production ready for public launch yet/i);
assert.match(prBody, /fixture/i);
assert.match(issueBody, /Acceptance Criteria/);
assert.match(issueBody, /reviewer/i);
assert.match(issueBody, /human approval/i);
assert.match(githubBlockedText, /Resource not accessible by integration/);
assert.match(claudeBlockedText, /Not logged in/);
assert.match(releaseHandoffText, /Manual GitHub Steps/);
assert.match(releaseHandoffText, /release:doctor/);
assert.doesNotMatch(remoteUrl, /:\/\/[^/\s]+@/);
assert.doesNotMatch(remoteUrl, /(ghp_|github_pat_|[?&]token=)/);

const statusComment = [
  "Release status refresh for PR #5:",
  "",
  "- Current public launch verdict: FAIL.",
  "- Current production readiness: false.",
  `- Latest verified code baseline: ${latestHeadShort}, GitHub Actions run ${latestCiRunId} passed.`,
  "- Current head has a generated GitHub handoff packet so a maintainer can paste the PR body, create the blocker issue, and keep the blocker list visible while app permissions are read-only.",
  "- Remaining blockers: Claude reviewer route blocked by login, GitHub write routes blocked by integration permissions, human public-launch approval required, and hosted Supermemory baseline not current.",
  "",
  "Do not treat green CI as public launch approval. The repo evidence is fixture-only and contains no raw memories, transcripts, credentials, or private diagnostics.",
].join("\n");

const packet = {
  ok: true,
  mode: "github-handoff-packet",
  writesRealFiles: false,
  repository,
  pullRequest,
  reviewDir,
  branch,
  head: currentHead,
  publicLaunchAllowed: false,
  productionReady: false,
  latestVerifiedCodeBaseline: releaseState.latestVerifiedCodeBaseline,
  requiredBlockers,
  labels: [
    "code-checks-pass",
    "fixture-ui-proven",
    "not-production-ready",
    "reviewer-route-blocked",
    "human-approval-required",
  ],
  prBody,
  statusComment,
  issueTitle,
  issueBody,
  manualSteps: [
    "Open PR #5.",
    "Replace the PR body with packet.prBody.",
    "Add packet.statusComment as a top-level PR comment if useful.",
    "Create a blocker issue with packet.issueTitle and packet.issueBody, or record that the owner accepts the missing issue.",
    "Keep publicLaunchVerdict as FAIL until the owner approves a different verdict.",
  ],
  safety: {
    privateLeakCount: 0,
    hasSecretPattern: false,
    fixtureOnly: true,
    commitsRawMemories: false,
    commitsRawTranscripts: false,
    commitsCredentials: false,
    hostedWriteBackEnabled: false,
  },
};

const serialized = JSON.stringify(packet, null, 2);
assert.doesNotMatch(serialized, secretPattern);
assert.equal(packet.safety.hasSecretPattern, false);
assert.equal(packet.safety.privateLeakCount, 0);

console.log(serialized);

function extractFencedMarkdown(text) {
  const match = text.match(/```markdown\n([\s\S]*?)\n```/);
  assert.ok(match, "PR body draft must contain a fenced markdown body");
  return match[1].trim();
}

function extractIssueTitle(text) {
  const h1 = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
  assert.ok(h1, "issue draft must start with an H1 title");
  return h1.replace(/^Blocking Issue Draft:\s*/i, "").trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed\n${result.stderr}\n${result.stdout}`);
  return result;
}

async function latestReviewDir() {
  const entries = await readdir(join(root, "reviews"), { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `reviews/${entry.name}`)
    .sort();
  assert.ok(dirs.length > 0, "no review evidence directories found");
  return dirs.at(-1);
}
