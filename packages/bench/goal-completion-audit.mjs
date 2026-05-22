import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;

const files = {
  releaseState: `${reviewDir}/release-state.json`,
  summary: `${reviewDir}/summary.md`,
  completionAudit: `${reviewDir}/completion-audit.md`,
  productionReadiness: `${reviewDir}/production-readiness.md`,
  releaseReadiness: `${reviewDir}/release-readiness-evidence.md`,
  releaseHandoff: "docs/RELEASE_HANDOFF.md",
  prBodyDraft: `${reviewDir}/pr-body-update-draft.md`,
  githubBlocked: `${reviewDir}/github-issue-create-blocked.md`,
  claudeBlocked: `${reviewDir}/claude-pr5-review-blocked.md`,
  handoffPacketEvidence: `${reviewDir}/github-handoff-packet-evidence.md`,
  handoffPacketReview: `${reviewDir}/gemini-github-handoff-packet-review.md`,
  hostedBaselinePreflightEvidence: `${reviewDir}/hosted-baseline-preflight-evidence.md`,
  hostedBaselinePreflightReview: `${reviewDir}/gemini-hosted-baseline-preflight-review.md`,
  issueDraft: `${reviewDir}/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`,
  browserEvidence: `${reviewDir}/ui-evidence/brain-ui-current-head-live-evidence.json`,
  releaseReadinessEvidence: `${reviewDir}/ui-evidence/brain-ui-release-readiness-evidence.json`,
};

for (const [name, file] of Object.entries(files)) {
  const path = join(root, file);
  assert.ok(existsSync(path), `${name} missing at ${file}`);
  assert.ok(statSync(path).size > 0, `${name} empty at ${file}`);
}

const releaseState = JSON.parse(readFileSync(join(root, files.releaseState), "utf8"));
const releaseReadinessEvidence = JSON.parse(readFileSync(join(root, files.releaseReadinessEvidence), "utf8"));
const currentHeadLiveEvidence = JSON.parse(readFileSync(join(root, files.browserEvidence), "utf8"));
const texts = Object.fromEntries(
  Object.entries(files)
    .filter(([, file]) => file.endsWith(".md"))
    .map(([key, file]) => [key, readFileSync(join(root, file), "utf8")]),
);

assert.equal(releaseState.schemaVersion, 1);
assert.equal(releaseState.goalStatus, "active");
assert.equal(releaseState.publicLaunchVerdict, "FAIL");
assert.equal(releaseState.productionReady, false);
assert.equal(releaseState.safetyBoundary?.usesFixtureUiEvidence, true);
assert.equal(releaseState.safetyBoundary?.commitsRawMemories, false);
assert.equal(releaseState.safetyBoundary?.commitsRawTranscripts, false);
assert.equal(releaseState.safetyBoundary?.commitsCredentials, false);
assert.equal(releaseState.safetyBoundary?.enablesHostedWriteBack, false);
assert.equal(releaseReadinessEvidence.evidence?.productionReady, false);
assert.equal(releaseReadinessEvidence.evidence?.fixtureOnly, true);
assert.equal(currentHeadLiveEvidence.fixtureOnly, true);
assert.equal(currentHeadLiveEvidence.privateLeakCount, 0);
assert.match(texts.completionAudit, /Verdict: not complete/i);
assert.match(texts.productionReadiness, /verdict.*FAIL|not production ready/i);
assert.match(texts.claudeBlocked, /Not logged in/);
assert.match(texts.githubBlocked, /Resource not accessible by integration/);
assert.match(texts.handoffPacketReview, /Verdict: `CLEAN`|^CLEAN/m);

const currentHead = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const branch = run("git", ["branch", "--show-current"]).stdout.trim();

const requirements = [
  proven("native-codex-goal-supervised", "Native goal exists and remains active", [
    files.releaseState,
    files.summary,
  ]),
  proven("safe-pr-implementation", "Safe PR-based implementation has an open mergeable PR and CI evidence", [
    files.prBodyDraft,
    files.completionAudit,
  ]),
  proven("nucleus-index", "Nucleus Index contract, redaction tests, and docs exist", [
    "docs/NUCLEUS_INDEX.md",
    "packages/core/src/nucleus/index.ts",
    "tests/nucleus/nucleus-snapshot.test.ts",
  ]),
  proven("wiki-vault-sync", "LLM-wiki compile and vault sync have smoke coverage and sync evidence", [
    "packages/bench/wiki-vault-smoke.mjs",
    "packages/bench/wiki-vault-sync-smoke.mjs",
    `${reviewDir}/wiki-vault-sync-evidence.md`,
  ]),
  proven("self-hosted-brain-ui-fixture", "Self-hosted Brain UI is proven in fixture mode with browser evidence", [
    "packages/brain-ui/server.mjs",
    files.browserEvidence,
    `${reviewDir}/brain-ui-current-head-live-evidence.md`,
  ]),
  proven("brain-ui-local-write-gates", "Local edit, materialize, sync apply, policy apply, and review apply are gated", [
    `${reviewDir}/brain-ui-local-memory-materialize-evidence.md`,
    `${reviewDir}/brain-ui-selected-sync-dry-run-evidence.md`,
    `${reviewDir}/brain-ui-lifecycle-policy-apply-evidence.md`,
    `${reviewDir}/brain-ui-review-queue-apply-evidence.md`,
  ]),
  proven("selfmem-update-flow", "Dry-run-first selfmem_update flow is covered", [
    "bin/selfmem_update",
    "packages/bench/update-flow-smoke.py",
    `${reviewDir}/update-flow-evidence.md`,
  ]),
  proven("local-only-compaction-benchmark", "Local-only compaction benchmark and metrics-only local audit are covered", [
    "packages/bench/session-compaction-benchmark.mjs",
    "packages/bench/session-compaction-local-audit.mjs",
    `${reviewDir}/session-compaction-local-audit-evidence.md`,
  ]),
  proven("browser-ui-evidence", "Browser/UI evidence exists with zero private or key-shaped visible text", [
    files.browserEvidence,
    `${reviewDir}/brain-ui-current-head-live-evidence.md`,
  ]),
  proven("release-handoff-packet", "Manual GitHub handoff packet is generated, reviewed, and gate-covered", [
    "packages/bench/github-handoff-packet.mjs",
    files.handoffPacketEvidence,
    files.handoffPacketReview,
  ]),
  proven("hosted-baseline-preflight", "Hosted baseline comparison has a metrics-only preflight that keeps public claims blocked by default", [
    "packages/bench/hosted-baseline-preflight.mjs",
    files.hostedBaselinePreflightEvidence,
    files.hostedBaselinePreflightReview,
  ]),
  blocked("claude-council-review", "Claude/Opus reviewer route remains blocked by missing login", [
    files.claudeBlocked,
  ]),
  blocked("github-pr-body-current", "PR body is stale because GitHub write route remains forbidden", [
    files.prBodyDraft,
    files.githubBlocked,
  ]),
  blocked("github-blocker-issue-created", "External blocker issue is drafted but not created through the connector", [
    files.issueDraft,
    files.githubBlocked,
  ]),
  blocked("human-public-launch-approval", "Human approval is required before merge, visibility change, or public live update", [
    files.releaseState,
    "docs/PUBLIC_RELEASE_CHECKLIST.md",
  ]),
  blocked("hosted-supermemory-baseline", "Hosted Supermemory benchmark claims require a fresh metrics-only baseline", [
    files.hostedBaselinePreflightEvidence,
    "docs/AUTORESEARCH_BENCHMARK_PLAN.md",
  ]),
  incomplete("real-container-production-rollout", "One-agent real runtime rollout remains a canary step, not a completed production rollout", [
    `${reviewDir}/brain-ui-canary-rollout-evidence.md`,
    "docs/RELEASE_HANDOFF.md",
  ]),
];

for (const requirement of requirements) {
  for (const evidence of requirement.evidence) {
    const path = join(root, evidence);
    assert.ok(existsSync(path), `${requirement.id} evidence missing: ${evidence}`);
  }
}

const blockedRequirements = requirements.filter((item) => item.status === "blocked");
const incompleteRequirements = requirements.filter((item) => item.status === "incomplete");
assert.ok(blockedRequirements.length >= 4, "goal completion audit must preserve remaining blockers");
assert.ok(incompleteRequirements.length >= 1, "goal completion audit must preserve incomplete rollout scope");

const report = {
  ok: true,
  mode: "goal-completion-audit",
  writesRealFiles: false,
  reviewDir,
  branch,
  head: currentHead,
  latestVerifiedCodeBaseline: releaseState.latestVerifiedCodeBaseline,
  goalComplete: false,
  mayCallUpdateGoalComplete: false,
  reason: "The core preview work is strongly evidenced, but reviewer, GitHub write-route, human approval, hosted-baseline, and real rollout requirements remain unresolved.",
  counts: {
    total: requirements.length,
    proven: requirements.filter((item) => item.status === "proven").length,
    blocked: blockedRequirements.length,
    incomplete: incompleteRequirements.length,
  },
  requirements,
  safety: {
    privateLeakCount: 0,
    hasSecretPattern: false,
    fixtureUiEvidence: true,
    commitsRawMemories: false,
    commitsRawTranscripts: false,
    commitsCredentials: false,
  },
};

const serialized = JSON.stringify(report, null, 2);
assert.doesNotMatch(serialized, secretPattern);
console.log(serialized);

function proven(id, requirement, evidence) {
  return { id, requirement, status: "proven", evidence };
}

function blocked(id, requirement, evidence) {
  return { id, requirement, status: "blocked", evidence };
}

function incomplete(id, requirement, evidence) {
  return { id, requirement, status: "incomplete", evidence };
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
