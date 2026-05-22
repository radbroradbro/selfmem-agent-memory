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
  "github-pr-body-update-blocked",
  "github-issue-create-blocked",
  "human-public-launch-approval-required",
  "hosted-supermemory-baseline-not-current",
];

const requiredFiles = {
  releaseState: "release-state.json",
  productionReadiness: "production-readiness.md",
  prBodyDraft: "pr-body-update-draft.md",
  issueDraft: "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md",
  githubBlocked: "github-issue-create-blocked.md",
  claudeBlocked: "claude-pr5-review-blocked.md",
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

const githubBlockedText = readFileSync(join(root, reviewDir, "github-issue-create-blocked.md"), "utf8");
const claudeBlockedText = readFileSync(join(root, reviewDir, "claude-pr5-review-blocked.md"), "utf8");
const prBodyDraftText = readFileSync(join(root, reviewDir, "pr-body-update-draft.md"), "utf8");
const issueDraftText = readFileSync(join(root, reviewDir, "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md"), "utf8");

assert.match(githubBlockedText, /FORBIDDEN: Resource not accessible by integration|Resource not accessible by integration/);
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

const blockerReport = [
  {
    id: "claude-reviewer-route-blocked",
    status: "blocked",
    evidence: "claude-pr5-review-blocked.md",
    nextAction: "Run `claude /login`, then rerun the cold PR review, or explicitly accept the blocked route.",
  },
  {
    id: "github-pr-body-update-blocked",
    status: "blocked",
    evidence: "pr-body-update-draft.md and github-issue-create-blocked.md",
    nextAction: "Paste `pr-body-update-draft.md` into PR #5 or grant a GitHub integration route that can update PR bodies.",
  },
  {
    id: "github-issue-create-blocked",
    status: "blocked",
    evidence: "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md",
    nextAction: "Create the blocker issue manually or explicitly accept the missing issue as part of the release decision.",
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
    evidence: "production-readiness.md",
    nextAction: "Run a fresh metrics-only hosted Supermemory baseline before making head-to-head benchmark claims.",
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
        claudeCommand: claude,
        githubCli: gh,
      },
      manualCommands: [
        "claude /login",
        "npm exec --yes pnpm@10.23.0 -- release:check",
        "npm exec --yes pnpm@10.23.0 -- smoke",
        "Copy reviews/overnight-20260522/pr-body-update-draft.md into PR #5",
        "Create an issue from reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md",
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
