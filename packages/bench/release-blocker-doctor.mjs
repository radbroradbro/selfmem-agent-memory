import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());

const releaseStatePath = join(root, reviewDir, "release-state.json");
const releaseState = JSON.parse(readFileSync(releaseStatePath, "utf8"));
const requiredBlockers = [
  "human-public-launch-approval-required",
  "hosted-supermemory-baseline-not-current",
  "fresh-real-container-canary-not-current",
];

const requiredFiles = {
  releaseState: "release-state.json",
  productionReadiness: "production-readiness.md",
  prBodyDraft: "pr-body-update-draft.md",
  issueDraft: "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md",
  githubBlocked: "github-issue-create-blocked.md",
  githubWriteEvidence: "github-write-route-evidence.md",
  githubLiveSyncEvidence: "github-live-sync-evidence.md",
  claudeBlocked: "claude-pr5-review-blocked.md",
  claudeReview: "claude-pr5-review.md",
  hostedBaselinePreflight: "hosted-baseline-preflight-evidence.md",
  hostedBaselinePreflightReview: "gemini-hosted-baseline-preflight-review.md",
  hostedBaselineCollector: "hosted-baseline-collector-evidence.md",
  hostedBaselineCollectorReview: "gemini-hosted-baseline-collector-review.md",
  realCanaryDiagnostic: "real-canary-diagnostic-evidence.md",
  canaryDiagnosticBatchAudit: "canary-diagnostic-batch-audit-evidence.md",
  canaryNextAgentPlan: "canary-next-agent-plan-evidence.md",
  releaseHandoff: "../../docs/RELEASE_HANDOFF.md",
};

const evidence = Object.fromEntries(
  Object.entries(requiredFiles).map(([key, relativePath]) => {
    const path = join(root, reviewDir, relativePath);
    return [key, inspectFile(path)];
  }),
);

assert.equal(releaseState.goalStatus, "active");
assert.equal(releaseState.publicLaunchVerdict, "FAIL");
assert.equal(releaseState.productionReady, false);
assert.equal(releaseState.safetyBoundary?.commitsRawMemories, false);
assert.equal(releaseState.safetyBoundary?.commitsRawTranscripts, false);
assert.equal(releaseState.safetyBoundary?.commitsCredentials, false);
assert.equal(releaseState.safetyBoundary?.enablesHostedWriteBack, false);
for (const blocker of requiredBlockers) {
  assert.ok(releaseState.remainingBlockers?.includes(blocker), `missing blocker ${blocker}`);
}
for (const item of Object.values(evidence)) {
  assert.equal(item.exists, true, `${item.path} missing`);
  assert.ok(item.bytes > 0, `${item.path} empty`);
}

const githubWriteText = readFileSync(join(root, reviewDir, "github-write-route-evidence.md"), "utf8");
const githubLiveSyncText = readFileSync(join(root, reviewDir, "github-live-sync-evidence.md"), "utf8");
const claudeBlockedText = readFileSync(join(root, reviewDir, "claude-pr5-review-blocked.md"), "utf8");
const claudeReviewText = readFileSync(join(root, reviewDir, "claude-pr5-review.md"), "utf8");
const prBodyDraftText = readFileSync(join(root, reviewDir, "pr-body-update-draft.md"), "utf8");
const issueDraftText = readFileSync(join(root, reviewDir, "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md"), "utf8");
const realCanaryDiagnosticText = readFileSync(join(root, reviewDir, "real-canary-diagnostic-evidence.md"), "utf8");
const canaryBatchAuditText = readFileSync(join(root, reviewDir, "canary-diagnostic-batch-audit-evidence.md"), "utf8");
const canaryNextAgentText = readFileSync(join(root, reviewDir, "canary-next-agent-plan-evidence.md"), "utf8");

assert.match(githubWriteText, /PR #5 body updated/);
assert.match(githubWriteText, /issues\/6/);
assert.match(githubLiveSyncText, /PR\s*#5[\s\S]*issue #6[\s\S]*match/i);
assert.match(claudeBlockedText, /Not logged in/);
assert.match(claudeReviewText, /Verdict:\s*CONCERNS/i);
assert.match(claudeReviewText, /Can mark native goal complete:\s*no/i);
assert.match(prBodyDraftText, /clean consumer smoke/i);
assert.match(issueDraftText, /Acceptance Criteria/);
assert.match(realCanaryDiagnosticText, /does not complete the real-container rollout requirement/i);
assert.match(canaryBatchAuditText, /Strict-real pass count:\s*0/i);
assert.match(canaryNextAgentText, /Selected host:\s*OpenClaw/i);

const gitHead = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const branch = run("git", ["branch", "--show-current"]).stdout.trim();
const remote = run("git", ["remote", "get-url", "origin"]).stdout.trim();
assert.doesNotMatch(remote, /:\/\/[^/\s]+@/);
assert.doesNotMatch(remote, /(ghp_|github_pat_|[?&]token=)/);

const live = process.argv.includes("--live");
const claude = inspectCommand("claude", ["--version"]);
const gh = inspectCommand("gh", ["auth", "status"]);
let claudeLiveHealth = null;
const hostedBaselinePreflight = JSON.parse(run("node", ["packages/bench/hosted-baseline-preflight.mjs"]).stdout);
assert.equal(hostedBaselinePreflight.callsHostedProvider, false);
assert.equal(hostedBaselinePreflight.publicBenchmarkClaimsAllowed, false);
const hostedBaselineCollector = JSON.parse(run("node", ["packages/bench/hosted-baseline-collector.mjs", "--fixture"]).stdout);
assert.equal(hostedBaselineCollector.metricsOnly, true);
assert.equal(hostedBaselineCollector.rawMemoryIncluded, false);
assert.equal(hostedBaselineCollector.fixtureOnly, true);
const recallWeaveResponseExport = JSON.parse(run("node", ["packages/bench/recallweave-response-export.mjs", "--fixture"]).stdout);
assert.equal(recallWeaveResponseExport.metricsOnly, true);
assert.equal(recallWeaveResponseExport.rawMemoryIncluded, false);
assert.equal(recallWeaveResponseExport.fixtureOnly, true);
assert.equal(recallWeaveResponseExport.privacyLeakCount, 0);
const recallWeaveBaselineCollector = JSON.parse(run("node", ["packages/bench/recallweave-baseline-collector.mjs", "--fixture"]).stdout);
assert.equal(recallWeaveBaselineCollector.metricsOnly, true);
assert.equal(recallWeaveBaselineCollector.rawMemoryIncluded, false);
assert.equal(recallWeaveBaselineCollector.fixtureOnly, true);
assert.equal(recallWeaveBaselineCollector.querySetHash, hostedBaselineCollector.querySetHash);
assert.equal(recallWeaveBaselineCollector.scoringCodeHash, hostedBaselineCollector.scoringCodeHash);
const canaryDiagnosticBatchAudit = JSON.parse(run("node", ["packages/bench/canary-diagnostic-batch-audit.mjs"]).stdout);
assert.equal(canaryDiagnosticBatchAudit.metricsOnly, true);
assert.equal(canaryDiagnosticBatchAudit.publicLaunchAllowed, false);
assert.equal(canaryDiagnosticBatchAudit.fleetRolloutAllowed, false);
assert.equal(canaryDiagnosticBatchAudit.countsAsRealRolloutEvidence, false);
const canaryNextAgentPlan = JSON.parse(run("node", ["packages/bench/canary-next-agent-plan.mjs"]).stdout);
assert.equal(canaryNextAgentPlan.metricsOnly, true);
assert.equal(canaryNextAgentPlan.publicLaunchAllowed, false);
assert.equal(canaryNextAgentPlan.fleetRolloutAllowed, false);
assert.equal(canaryNextAgentPlan.oneAgentCanaryAllowed, false);
const githubLiveSync = JSON.parse(run("node", ["packages/bench/github-live-sync-check.mjs"]).stdout);
assert.equal(githubLiveSync.ok, true);
assert.equal(githubLiveSync.prBodyMatches, true);
assert.equal(githubLiveSync.issueTitleMatches, true);
assert.equal(githubLiveSync.issueBodyMatches, true);

const reviewerReport = [
  {
    id: "claude-opus-pr5-review",
    status: "completed_with_concerns",
    evidence: "claude-pr5-review.md",
    nextAction: "Treat the Claude review as alpha-PR support only. It does not authorize public launch or goal completion.",
  },
];

const blockerReport = [
  {
    id: "human-public-launch-approval-required",
    status: "blocked",
    evidence: "release-state.json",
    nextAction: "Owner must approve merge, visibility, and any public live update with the blocker list visible.",
  },
  {
    id: "hosted-supermemory-baseline-not-current",
    status: "blocked",
    evidence: "hosted-baseline-collector-evidence.md",
    nextAction: "Run `baseline:collect -- --live --output <hosted-result>` for hosted, run `baseline:export:recallweave -- --live --output <metrics-only-export>` for local response export, run `baseline:collect:recallweave -- --live --responses <metrics-only-export> --output <recallweave-result>`, then validate with `baseline:preflight -- --result <hosted-result> --output <preflight>` and `baseline:compare -- --hosted <hosted-result> --recallweave <recallweave-result> --output <comparison>`.",
  },
  {
    id: "fresh-real-container-canary-not-current",
    status: "incomplete",
    evidence: "real-canary-diagnostic-evidence.md",
    nextAction: "Run `canary:batch-audit` on redacted returned diagnostics, use `canary:next-agent` to pick one privacy-clean Hermes/OpenClaw target, apply the current adapter, then collect a fresh strict-real canary window and package metrics-only evidence.",
  },
];

if (live) {
  claudeLiveHealth = inspectCommand("claude", [
    "--print",
    "--model",
    "opus",
    "--permission-mode",
    "plan",
    "--max-budget-usd",
    "0.5",
    "--no-session-persistence",
    "--disable-slash-commands",
    "--setting-sources",
    "local",
    "Health check only: reply OK.",
  ]);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "release-blocker-doctor",
      writesRealFiles: false,
      publicLaunchAllowed: false,
      productionReady: false,
      reviewDir,
      branch,
      head: gitHead,
      latestVerifiedCodeBaseline: releaseState.latestVerifiedCodeBaseline,
      reviewers: reviewerReport,
      blockers: blockerReport,
      checks: {
        releaseStateConservative: true,
        requiredEvidenceFilesPresent: true,
        remoteHasNoToken: true,
        hostedBaselinePreflight: {
          ok: hostedBaselinePreflight.ok,
          callsHostedProvider: hostedBaselinePreflight.callsHostedProvider,
          benchmarkClaimsAllowed: hostedBaselinePreflight.benchmarkClaimsAllowed,
        },
        hostedBaselineCollector: {
          provider: hostedBaselineCollector.provider,
          metricsOnly: hostedBaselineCollector.metricsOnly,
          fixtureOnly: hostedBaselineCollector.fixtureOnly,
          rawMemoryIncluded: hostedBaselineCollector.rawMemoryIncluded,
        },
        canaryDiagnosticBatchAudit: {
          ok: canaryDiagnosticBatchAudit.ok,
          metricsOnly: canaryDiagnosticBatchAudit.metricsOnly,
          fixtureOnly: Boolean(canaryDiagnosticBatchAudit.bestCandidate?.fixtureOnly),
          countsAsRealRolloutEvidence: canaryDiagnosticBatchAudit.countsAsRealRolloutEvidence,
          publicLaunchAllowed: canaryDiagnosticBatchAudit.publicLaunchAllowed,
          fleetRolloutAllowed: canaryDiagnosticBatchAudit.fleetRolloutAllowed,
        },
        canaryNextAgentPlan: {
          ok: canaryNextAgentPlan.ok,
          metricsOnly: canaryNextAgentPlan.metricsOnly,
          oneAgentCanaryAllowed: canaryNextAgentPlan.oneAgentCanaryAllowed,
          publicLaunchAllowed: canaryNextAgentPlan.publicLaunchAllowed,
          fleetRolloutAllowed: canaryNextAgentPlan.fleetRolloutAllowed,
          status: canaryNextAgentPlan.decision?.status,
        },
        githubLiveSync: {
          ok: githubLiveSync.ok,
          prBodyMatches: githubLiveSync.prBodyMatches,
          issueTitleMatches: githubLiveSync.issueTitleMatches,
          issueBodyMatches: githubLiveSync.issueBodyMatches,
        },
        claudeCommand: claude,
        claudeLiveHealth,
        githubCli: gh,
      },
      manualCommands: [
        "npm exec --yes pnpm@10.23.0 -- release:check",
        "npm exec --yes pnpm@10.23.0 -- release:github-sync",
        "npm exec --yes pnpm@10.23.0 -- smoke",
        "npm exec --yes pnpm@10.23.0 -- baseline:preflight",
        "npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture",
        "npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template --output /tmp/recallweave-hosted-baseline-template.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture",
        "npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture",
        "npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture",
        "npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --output /tmp/recallweave-canary-batch-audit.json",
        "npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch /tmp/recallweave-canary-batch-audit.json --output /tmp/recallweave-canary-next-agent-plan.json",
        "npm exec --yes pnpm@10.23.0 -- canary:operator-packet -- --host openclaw",
        "npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input-root <redacted-diagnostics-folder> --allow-failed-inputs --output /tmp/recallweave-canary-batch-audit.json",
        "npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch /tmp/recallweave-canary-batch-audit.json --output /tmp/recallweave-canary-next-agent-plan.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output /tmp/recallweave-hosted-baseline-result.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --live --container-dir <local-recallweave-container-dir> --output /tmp/recallweave-search-responses.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --live --responses /tmp/recallweave-search-responses.json --output /tmp/recallweave-result.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result /tmp/recallweave-hosted-baseline-result.json --output /tmp/recallweave-hosted-baseline-preflight.json",
        "RECALLWEAVE_REVIEWER_APPROVAL_COUNT=<0-until-reviewed> npm exec --yes pnpm@10.23.0 -- baseline:compare -- --hosted /tmp/recallweave-hosted-baseline-result.json --recallweave /tmp/recallweave-result.json --output /tmp/recallweave-baseline-comparison.json",
        "Verify the live sync check still reports PR #5 and issue #6 matching checked-in drafts.",
      ],
    },
    null,
    2,
  ),
);

function inspectFile(path) {
  return {
    path: path.replace(root, "."),
    exists: existsSync(path),
    bytes: existsSync(path) ? statSync(path).size : 0,
  };
}

function inspectCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: truncate(result.stdout),
    stderr: truncate(result.stderr),
  };
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

function truncate(text) {
  return String(text ?? "").trim().slice(0, 240);
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
