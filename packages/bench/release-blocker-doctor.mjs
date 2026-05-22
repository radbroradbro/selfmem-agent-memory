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
  "claude-reviewer-route-blocked",
  "human-public-launch-approval-required",
  "hosted-supermemory-baseline-not-current",
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
  hostedBaselinePreflight: "hosted-baseline-preflight-evidence.md",
  hostedBaselinePreflightReview: "gemini-hosted-baseline-preflight-review.md",
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
const prBodyDraftText = readFileSync(join(root, reviewDir, "pr-body-update-draft.md"), "utf8");
const issueDraftText = readFileSync(join(root, reviewDir, "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md"), "utf8");

assert.match(githubWriteText, /PR #5 body updated/);
assert.match(githubWriteText, /issues\/6/);
assert.match(githubLiveSyncText, /PR\s*#5[\s\S]*issue #6[\s\S]*match/i);
assert.match(claudeBlockedText, /Not logged in/);
assert.match(prBodyDraftText, /clean consumer smoke/i);
assert.match(issueDraftText, /Acceptance Criteria/);

const gitHead = run("git", ["rev-parse", "HEAD"]).stdout.trim();
const branch = run("git", ["branch", "--show-current"]).stdout.trim();
const remote = run("git", ["remote", "get-url", "origin"]).stdout.trim();
assert.doesNotMatch(remote, /:\/\/[^/\s]+@/);
assert.doesNotMatch(remote, /(ghp_|github_pat_|[?&]token=)/);

const live = process.argv.includes("--live");
const claude = inspectCommand("claude", ["--version"]);
const gh = inspectCommand("gh", ["auth", "status"]);
const hostedBaselinePreflight = JSON.parse(run("node", ["packages/bench/hosted-baseline-preflight.mjs"]).stdout);
assert.equal(hostedBaselinePreflight.callsHostedProvider, false);
assert.equal(hostedBaselinePreflight.publicBenchmarkClaimsAllowed, false);
const githubLiveSync = JSON.parse(run("node", ["packages/bench/github-live-sync-check.mjs"]).stdout);
assert.equal(githubLiveSync.ok, true);
assert.equal(githubLiveSync.prBodyMatches, true);
assert.equal(githubLiveSync.issueTitleMatches, true);
assert.equal(githubLiveSync.issueBodyMatches, true);

const blockerReport = [
  {
    id: "claude-reviewer-route-blocked",
    status: "blocked",
    evidence: "claude-pr5-review-blocked.md",
    nextAction: "Run `claude /login`, then rerun the cold PR review, or explicitly accept the blocked route.",
  },
  {
    id: "human-public-launch-approval-required",
    status: "blocked",
    evidence: "release-state.json",
    nextAction: "Owner must approve merge, visibility, and any public live update with the blocker list visible.",
  },
  {
    id: "hosted-supermemory-baseline-not-current",
    status: "blocked",
    evidence: "hosted-baseline-preflight-evidence.md",
    nextAction: "Run `baseline:preflight` with a sanitized live result after a fresh metrics-only hosted Supermemory baseline.",
  },
];

if (live) {
  const claudeReview = inspectCommand("claude", [
    "--bare",
    "--print",
    "--model",
    "opus",
    "--permission-mode",
    "plan",
    "--max-budget-usd",
    "1",
    "Health check only: reply OK.",
  ]);
  if (claudeReview.ok) {
    blockerReport[0] = {
      ...blockerReport[0],
      status: "needs-review-rerun",
      nextAction: "Claude CLI health check succeeded. Rerun the full cold PR review before changing release verdict.",
    };
  }
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
        githubLiveSync: {
          ok: githubLiveSync.ok,
          prBodyMatches: githubLiveSync.prBodyMatches,
          issueTitleMatches: githubLiveSync.issueTitleMatches,
          issueBodyMatches: githubLiveSync.issueBodyMatches,
        },
        claudeCommand: claude,
        githubCli: gh,
      },
      manualCommands: [
        "claude /login",
        "npm exec --yes pnpm@10.23.0 -- release:check",
        "npm exec --yes pnpm@10.23.0 -- release:github-sync",
        "npm exec --yes pnpm@10.23.0 -- smoke",
        "npm exec --yes pnpm@10.23.0 -- baseline:preflight",
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
