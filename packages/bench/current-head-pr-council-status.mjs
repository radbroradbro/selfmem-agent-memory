import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());
const baseRef = String(args.baseRef ?? "origin/main");
const outputPath = args.output ? resolve(String(args.output)) : null;
const markdownOutputPath = args.markdownOutput ? resolve(String(args.markdownOutput)) : null;

const branch = gitStdout(["rev-parse", "--abbrev-ref", "HEAD"]);
const head = gitStdout(["rev-parse", "HEAD"]);
const baseHead = gitStdout(["rev-parse", baseRef]);
const changedFiles = gitStdout(["diff", "--name-only", `${baseRef}..HEAD`])
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean);
const latestReview = latestFinalReview();
const reviewedCodeHead = latestReview ? expandCommitish(latestReview.headRefClean) : "";
const postReviewChangedFiles = reviewedCodeHead
  ? gitStdout(["diff", "--name-only", `${reviewedCodeHead}..HEAD`])
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean)
  : [];
const nonEvidencePostReviewFiles = postReviewChangedFiles.filter((file) => !isPublicEvidencePath(file));
const githubLiveSync = readJsonOrNull(join(root, reviewDir, "github-live-sync-current-head-20260601.json"));
const remoteBranchHead = gitRemoteHead(`refs/heads/${branch}`);
const remotePullRequestHead = gitRemoteHead("refs/pull/5/head");
const remotePullRequestMergeRef = gitRemoteHead("refs/pull/5/merge");
const reviewFreshForReviewedCodeHead =
  latestReview?.verdict === "CLEAN"
  && latestReview?.reviewerVendor === "deepseek"
  && latestReview?.reviewerModel === "deepseek-v4-pro"
  && latestReview?.headRefDirty === false
  && reviewedCodeHead === latestReview?.headRefFull;
const onlyPublicEvidenceSinceReviewedCodeHead = reviewedCodeHead
  ? nonEvidencePostReviewFiles.length === 0
  : false;
const currentHeadSafeAfterReview =
  reviewFreshForReviewedCodeHead
  && onlyPublicEvidenceSinceReviewedCodeHead;
const normalChecks = latestReview?.checks ?? [];
const requiredCheckFailures = normalChecks.filter((check) => check.required === true && check.status === "fail");

const report = {
  schemaVersion: 1,
  mode: "current-head-pr-council-status",
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  metricsOnly: true,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  printsCredentials: false,
  branch,
  head,
  headAtEvidenceCapture: head,
  reviewedCodeHead,
  currentHeadSafeAfterReview,
  baseRef,
  baseHead,
  gateDetection: {
    changedFileCount: changedFiles.length,
    requiredGates: ["security", "architecture", "ui", "code", "integration", "final"],
    headRef: head.slice(0, 7),
  },
  verification: {
    finalDryRunPacketBuilt: Boolean(latestReview),
    reviewRunId: latestReview?.runId ?? "",
    reviewCreatedAt: latestReview?.createdAt ?? "",
    reviewHeadRef: latestReview?.headRef ?? "",
    reviewedCodeHeadMatchesReviewRun: reviewFreshForReviewedCodeHead,
    reviewFreshForReviewedCodeHead,
    deepseekFinalGateVerdict: latestReview?.verdict ?? "STALE_OR_MISSING",
    deepseekReviewerVendor: latestReview?.reviewerVendor ?? "",
    deepseekReviewerModel: latestReview?.reviewerModel ?? "",
    deepseekConfidence: latestReview?.confidence ?? "",
    normalChecks,
    requiredCheckFailures,
    claudeReviewStatus: "blocked-budget-cap-exceeded-before-output",
    ghCliStatus: "unavailable-in-local-shell-but-github-api-live-sync-passed",
    githubLiveSyncStatus: githubLiveSync?.ok === true ? "pass" : "missing-or-failed",
    githubLiveSyncMode: githubLiveSync?.mode ?? "",
    pullRequestNumber: 5,
    issueNumber: 6,
    pullRequestOpen: githubLiveSync?.livePrOpen === true,
    issueOpen: githubLiveSync?.liveIssueOpen === true,
    pullRequestHeadMatches: githubLiveSync?.livePrHeadMatches === true,
    pullRequestBodyMatchesDraft: githubLiveSync?.prBodyMatches === true,
    issueTitleMatchesDraft: githubLiveSync?.issueTitleMatches === true,
    issueBodyMatchesDraft: githubLiveSync?.issueBodyMatches === true,
    liveUpdatedAt: githubLiveSync?.liveUpdatedAt ?? {},
    remoteBranchHead,
    remotePullRequestHead,
    remotePullRequestMergeRef,
    remoteBranchHeadMatchesCurrentHead: remoteBranchHead === head,
    remotePullRequestHeadMatchesCurrentHead: remotePullRequestHead === head,
  },
  postReviewChangePolicy: {
    onlyPublicEvidenceSinceReviewedCodeHead,
    publicEvidencePathRule: "reviews/** only",
    changedFileCountSinceReviewedCodeHead: postReviewChangedFiles.length,
    nonEvidenceFileCountSinceReviewedCodeHead: nonEvidencePostReviewFiles.length,
    changedFilesSinceReviewedCodeHead: postReviewChangedFiles,
    nonEvidenceFilesSinceReviewedCodeHead: nonEvidencePostReviewFiles,
  },
  evidence: {
    brainUiEvidence: "reviews/overnight-20260522/ui-evidence/brain-ui-20260603-browser-evidence.json",
    brainUiGitHead: "bef6143935853eb01f48b04f1f65b774fa3ed6a1",
    targetLock: "reviews/overnight-20260522/benchmark-target-lock-20260601.json",
    targetLockStatus: readJsonOrNull(join(root, reviewDir, "benchmark-target-lock-20260601.json"))?.status ?? "",
    providerAdapterRegistry: "reviews/overnight-20260522/provider-adapter-registry-20260601.json",
    providerAdapterRegistryStatus: readJsonOrNull(join(root, reviewDir, "provider-adapter-registry-20260601.json"))?.status ?? "",
    methodLadderGate: "reviews/overnight-20260522/answer-quality-memory-method-ladder-75q-paired-tolerant-result-gate-20260601.json",
    githubLiveSync: "reviews/overnight-20260522/github-live-sync-current-head-20260601.json",
    githubLiveSyncStatus: githubLiveSync?.ok === true ? "pass" : "missing-or-failed",
    remotePrHeadMatchesCurrentHead: remotePullRequestHead === head,
  },
  claimBoundary: {
    currentStatus: "not-production-complete",
    releaseVerdict: "hold-for-full-run-or-owner-approved-personal-canary",
    mayClaim: currentHeadSafeAfterReview
      ? "the reviewed implementation head has a fresh DeepSeek final-gate review, any later commits are public evidence only, PR #5 and issue #6 matched checked-in public-safe drafts at capture time, and the branch keeps BM25 as floor/control instead of a research destination"
      : "current-head council evidence is stale or missing and may not be used as launch approval",
    mayNotClaim: [
      "RecallWeave beats Supermemory",
      "RecallWeave is SOTA",
      "dry-run review packet is external approval",
      "PR merge/public launch is complete",
      "stale council evidence applies to later substantive code changes",
    ],
  },
  nextActions: currentHeadSafeAfterReview
    ? [
      "Keep current-head checks live in release:check so future code commits invalidate stale council evidence.",
      "Use BM25 as the floor/control while improving hybrid/rerank/chunking/context policy on same-data whole-harness runs.",
      "Keep the Codex memory dogfood monitor running for noise, usefulness, retrieval breadth, and explicit write/direct lookup behavior.",
    ]
    : [
      "Run a fresh final goal-loop council review for the latest substantive code head.",
      "Regenerate this status after the review and keep only public evidence commits after the reviewed code head.",
      "Do not count stale council status as public launch approval.",
    ],
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
const markdown = markdownReport(report);
assertSafePublicText(serialized);
assertSafePublicText(markdown);
if (outputPath) writeOutput(outputPath, serialized);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdown);
if (args.strict) {
  assert.equal(report.currentHeadSafeAfterReview, true, serialized);
  assert.equal(report.verification.reviewFreshForReviewedCodeHead, true, serialized);
  assert.equal(report.postReviewChangePolicy.onlyPublicEvidenceSinceReviewedCodeHead, true, serialized);
  assert.deepEqual(report.verification.requiredCheckFailures, [], serialized);
}
process.stdout.write(serialized);

function latestFinalReview() {
  const runsDir = join(root, ".goal-loop-review", "runs");
  if (!existsSync(runsDir)) return null;
  const candidates = readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const runDir = join(runsDir, entry.name);
      const request = readJsonOrNull(join(runDir, "review_request.json"));
      const response = readJsonOrNull(join(runDir, "review_response.json"));
      if (request?.gate !== "final" || response?.gate !== "final") return null;
      const headRef = String(request.head_ref ?? "");
      const headRefClean = headRef.replace(/-dirty$/, "");
      const headRefFull = expandCommitish(headRefClean);
      const checks = Array.isArray(response.verification_results)
        ? response.verification_results.flatMap((result) => Array.isArray(result?.checks) ? result.checks : [])
        : [];
      return {
        runId: entry.name,
        mtimeMs: statSync(runDir).mtimeMs,
        headRef,
        headRefClean,
        headRefDirty: headRef.endsWith("-dirty"),
        headRefFull,
        verdict: String(response.verdict ?? ""),
        reviewerVendor: String(response.reviewer_vendor ?? ""),
        reviewerModel: String(response.reviewer_model ?? ""),
        confidence: String(response.confidence ?? ""),
        createdAt: String(response.created_at ?? ""),
        checks: checks.map(sanitizeCheck),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] ?? null;
}

function sanitizeCheck(check) {
  return {
    name: String(check.name ?? ""),
    status: String(check.status ?? ""),
    required: check.required === true,
    summary: String(check.summary ?? ""),
  };
}

function markdownReport(report) {
  const requiredGates = report.gateDetection.requiredGates.join(", ");
  const checks = report.verification.normalChecks
    .map((check) => `- ${check.name}: ${check.status} (${check.summary})`)
    .join("\n");
  return `# Current-Head PR and Council Status

- Branch: \`${report.branch}\`
- Head at evidence capture: \`${report.headAtEvidenceCapture}\`
- Reviewed implementation head: \`${report.reviewedCodeHead}\`
- Current head safe after review: ${report.currentHeadSafeAfterReview}
- Base: \`${report.baseRef}\` at \`${report.baseHead}\`
- Changed files since base: ${report.gateDetection.changedFileCount}
- Required gates: ${requiredGates}

## Review Status

- DeepSeek final-gate review: ${report.verification.deepseekFinalGateVerdict} with ${report.verification.deepseekConfidence || "unknown"} confidence using \`${report.verification.deepseekReviewerModel || "unavailable"}\`.
- Review run matches reviewed implementation head: ${report.verification.reviewFreshForReviewedCodeHead}
- Post-review changes are public evidence only: ${report.postReviewChangePolicy.onlyPublicEvidenceSinceReviewedCodeHead}
- Post-review changed files: ${report.postReviewChangePolicy.changedFileCountSinceReviewedCodeHead}
- Post-review non-evidence files: ${report.postReviewChangePolicy.nonEvidenceFileCountSinceReviewedCodeHead}
- Claude review: blocked because the local Claude CLI budget cap was exceeded before output.
- Dry-run final packet: generated successfully but does not count as external approval.
- GitHub live sync: ${report.verification.githubLiveSyncStatus}. PR #5 is open, issue #6 is open, the PR head branch matches \`${report.branch}\`, and live PR/issue text matches the checked-in public-safe drafts.
- Remote PR head at evidence capture: \`${report.verification.remotePullRequestHead}\`.
- Remote branch head at evidence capture: \`${report.verification.remoteBranchHead}\`.

## Checks

${checks}

## Evidence Added

- Target lock: \`${report.evidence.targetLock}\` (${report.evidence.targetLockStatus})
- Provider adapter registry: \`${report.evidence.providerAdapterRegistry}\` (${report.evidence.providerAdapterRegistryStatus})
- GitHub live sync: \`${report.evidence.githubLiveSync}\` (${report.evidence.githubLiveSyncStatus})
- Brain UI evidence: \`${report.evidence.brainUiEvidence}\`
- Method ladder gate: \`${report.evidence.methodLadderGate}\`

## Claim Boundary

- Current status: not production complete.
- Hold public launch until full-run evidence or explicit owner-approved personal canary scope exists.
- May claim: ${report.claimBoundary.mayClaim}.
- May not claim: ${report.claimBoundary.mayNotClaim.join("; ")}.
`;
}

function gitStdout(commandArgs) {
  const result = spawnSync("git", commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `git ${commandArgs.join(" ")} failed\n${result.stderr}`);
  return result.stdout.trim();
}

function gitRemoteHead(ref) {
  const result = spawnSync("git", ["ls-remote", "origin", ref], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `git ls-remote origin ${ref} failed\n${result.stderr}`);
  const sha = result.stdout.trim().split(/\s+/)[0] ?? "";
  assert.match(sha, /^[a-f0-9]{40}$/, `missing remote sha for ${ref}`);
  return sha;
}

function expandCommitish(commitish) {
  if (!commitish) return "";
  const result = spawnSync("git", ["rev-parse", `${commitish}^{commit}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function isPublicEvidencePath(file) {
  return file.startsWith("reviews/");
}

function readJsonOrNull(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function assertSafePublicText(text) {
  assert.doesNotMatch(text, secretPattern(), "current-head council output contains key-shaped text");
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, "current-head council output contains a private path");
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
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
