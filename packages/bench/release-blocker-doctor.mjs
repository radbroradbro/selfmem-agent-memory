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
  baselineSourceMatchPreflight: "baseline-source-match-preflight-evidence.md",
  baselineSourceMatchPreflightReview: "gemini-baseline-source-match-preflight-review.md",
  baselineSourceAlignment: "baseline-source-alignment-evidence.md",
  baselineSourceAlignmentReview: "gemini-baseline-source-alignment-review.md",
  baselineSourceGapPlan: "baseline-source-gap-plan-evidence.md",
  baselineSourceGapPlanReview: "gemini-baseline-source-gap-plan-review.md",
  hostedBaselineLiveDiscovery: "hosted-baseline-live-discovery-evidence.md",
  hostedBaselineLiveDiscoveryReport: "hosted-baseline-live-discovery.json",
  hostedBaselineLiveDiscoveryReview: "gemini-hosted-baseline-live-discovery-review.md",
  hostedBaselineLivePrep: "hosted-baseline-live-prep-evidence.md",
  hostedBaselineLivePrepReview: "gemini-hosted-baseline-live-prep-review.md",
  hostedBaselineLiveQuerySetAuthor: "hosted-baseline-live-queryset-author.json",
  hostedBaselineLiveQuerySetReport: "hosted-baseline-live-queryset-report.json",
  hostedBaselineLiveCodexLocalRun: "hosted-baseline-live-codex-local-run-evidence.md",
  hostedBaselineLiveCodexLocalRunReport: "hosted-baseline-live-codex-local-run.json",
  hostedBaselineLiveCodexLocalRunReview: "gemini-hosted-baseline-live-codex-local-review.md",
  hostedBaselineLiveMirrorRun: "hosted-baseline-live-mirror-run-evidence.md",
  hostedBaselineLiveMirrorRunReport: "hosted-baseline-live-mirror-run.json",
  hostedBaselineLiveMirrorPacketReport: "hosted-baseline-live-mirror-packet.json",
  hostedBaselineLiveMirrorGateReview: "codex-hosted-baseline-live-mirror-gate-review.md",
  hostedBaselineLiveBudgetedRun: "hosted-baseline-live-budgeted-run-evidence.md",
  hostedBaselineLiveBudgetedRunReport: "hosted-baseline-live-budgeted-run.json",
  hostedBaselineLiveBudgetedPacketReport: "hosted-baseline-live-budgeted-packet.json",
  budgetedBaselineReviewerFindings: "reviewer-work/reviewer-findings.md",
  budgetedBaselineReviewerIntakeEvidence: "reviewer-work/budgeted-baseline-reviewer-intake-evidence.md",
  budgetedBaselineReviewerIntakeReport: "reviewer-work/budgeted-baseline-reviewer-intake-two-of-two.json",
  budgetedBaselineReviewedOwnerReviewEvidence: "reviewer-work/reviewed-baseline-owner-review-evidence.md",
  budgetedBaselineCodexApproval: "reviewer-work/codex-5-5-budgeted-baseline-approval.json",
  budgetedBaselineGeminiApproval: "reviewer-work/gemini-3-1-pro-budgeted-baseline-approval.json",
  budgetedBaselineClaudeBlocked: "reviewer-work/claude-opus-blocked-by-hooks.md",
  budgetedBaselineReviewedComparison: "reviewer-work/budgeted-baseline-reviewed-comparison.json",
  budgetedBaselineReviewedPacketReview: "reviewer-work/budgeted-baseline-reviewed-packet-review.json",
  budgetedBaselineReviewedReturnedPacketIntake: "reviewer-work/budgeted-baseline-reviewed-returned-packet-intake.json",
  budgetedBaselineReviewedNextRun: "reviewer-work/budgeted-baseline-reviewed-next-run.json",
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
const hostedBaselineLiveDiscoveryText = readFileSync(join(root, reviewDir, "hosted-baseline-live-discovery-evidence.md"), "utf8");
const baselineSourceMatchText = readFileSync(join(root, reviewDir, "baseline-source-match-preflight-evidence.md"), "utf8");
const baselineSourceMatchReviewText = readFileSync(join(root, reviewDir, "gemini-baseline-source-match-preflight-review.md"), "utf8");
const baselineSourceAlignmentText = readFileSync(join(root, reviewDir, "baseline-source-alignment-evidence.md"), "utf8");
const baselineSourceAlignmentReviewText = readFileSync(join(root, reviewDir, "gemini-baseline-source-alignment-review.md"), "utf8");
const baselineSourceGapPlanText = readFileSync(join(root, reviewDir, "baseline-source-gap-plan-evidence.md"), "utf8");
const baselineSourceGapPlanReviewText = readFileSync(join(root, reviewDir, "gemini-baseline-source-gap-plan-review.md"), "utf8");
const hostedBaselineLiveDiscoveryReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-discovery.json"), "utf8"));
const hostedBaselineLivePrepText = readFileSync(join(root, reviewDir, "hosted-baseline-live-prep-evidence.md"), "utf8");
const hostedBaselineLivePrepReviewText = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-live-prep-review.md"), "utf8");
const hostedBaselineLiveQuerySetAuthor = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-queryset-author.json"), "utf8"));
const hostedBaselineLiveQuerySetReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-queryset-report.json"), "utf8"));
const hostedBaselineLiveCodexLocalRunText = readFileSync(join(root, reviewDir, "hosted-baseline-live-codex-local-run-evidence.md"), "utf8");
const hostedBaselineLiveCodexLocalRunReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-codex-local-run.json"), "utf8"));
const hostedBaselineLiveCodexLocalRunReviewText = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-live-codex-local-review.md"), "utf8");
const hostedBaselineLiveMirrorRunText = readFileSync(join(root, reviewDir, "hosted-baseline-live-mirror-run-evidence.md"), "utf8");
const hostedBaselineLiveMirrorRunReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-mirror-run.json"), "utf8"));
const hostedBaselineLiveMirrorPacketReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-mirror-packet.json"), "utf8"));
const hostedBaselineLiveMirrorGateReviewText = readFileSync(join(root, reviewDir, "codex-hosted-baseline-live-mirror-gate-review.md"), "utf8");
const hostedBaselineLiveBudgetedRunText = readFileSync(join(root, reviewDir, "hosted-baseline-live-budgeted-run-evidence.md"), "utf8");
const hostedBaselineLiveBudgetedRunReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-budgeted-run.json"), "utf8"));
const hostedBaselineLiveBudgetedPacketReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-budgeted-packet.json"), "utf8"));
const budgetedBaselineReviewerFindingsText = readFileSync(join(root, reviewDir, "reviewer-work/reviewer-findings.md"), "utf8");
const budgetedBaselineReviewerIntakeText = readFileSync(join(root, reviewDir, "reviewer-work/budgeted-baseline-reviewer-intake-evidence.md"), "utf8");
const budgetedBaselineReviewerIntakeReport = JSON.parse(readFileSync(join(root, reviewDir, "reviewer-work/budgeted-baseline-reviewer-intake-two-of-two.json"), "utf8"));
const budgetedBaselineClaudeBlockedText = readFileSync(join(root, reviewDir, "reviewer-work/claude-opus-blocked-by-hooks.md"), "utf8");
const budgetedBaselineReviewedComparison = JSON.parse(readFileSync(join(root, reviewDir, "reviewer-work/budgeted-baseline-reviewed-comparison.json"), "utf8"));
const budgetedBaselineReviewedPacketReview = JSON.parse(readFileSync(join(root, reviewDir, "reviewer-work/budgeted-baseline-reviewed-packet-review.json"), "utf8"));
const budgetedBaselineReviewedReturnedPacketIntake = JSON.parse(readFileSync(join(root, reviewDir, "reviewer-work/budgeted-baseline-reviewed-returned-packet-intake.json"), "utf8"));
const budgetedBaselineReviewedNextRun = JSON.parse(readFileSync(join(root, reviewDir, "reviewer-work/budgeted-baseline-reviewed-next-run.json"), "utf8"));
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
assert.match(hostedBaselineLiveDiscoveryText, /does not close the hosted-baseline blocker/i);
assert.match(baselineSourceMatchText, /baseline:source-match/i);
assert.match(baselineSourceMatchText, /sourceMatchReady/i);
assert.match(baselineSourceMatchReviewText, /(?:\*\*)?Verdict:?(?:\*\*)?\s*`?(?:CLEAN|PASS)`?/i);
assert.match(baselineSourceAlignmentText, /baseline:source-align/i);
assert.match(baselineSourceAlignmentText, /BLOCKED_CONTENT_DIVERGENT|matchedBaselineRunAllowed/i);
assert.match(baselineSourceAlignmentReviewText, /(?:\*\*)?Verdict:?(?:\*\*)?\s*`?(?:CLEAN|PASS)`?/i);
assert.match(baselineSourceGapPlanText, /baseline:source-gap/i);
assert.match(baselineSourceGapPlanText, /READY_FOR_MATCHED_BASELINE|BLOCKED_CONTENT_DIVERGENT|BLOCKED_SOURCE_ID_ONLY|BLOCKED_LABEL_MISMATCH/i);
assert.match(baselineSourceGapPlanReviewText, /(?:\*\*)?Verdict:?(?:\*\*)?\s*`?(?:CLEAN|PASS)`?/i);
assert.equal(hostedBaselineLiveDiscoveryReport.mode, "hosted-baseline-discovery");
assert.equal(hostedBaselineLiveDiscoveryReport.fixtureOnly, false);
assert.equal(hostedBaselineLiveDiscoveryReport.callsHostedProvider, true);
assert.equal(hostedBaselineLiveDiscoveryReport.publicSafe, true);
assert.equal(hostedBaselineLiveDiscoveryReport.rawLabelsIncluded, false);
assert.equal(hostedBaselineLiveDiscoveryReport.rawMemoryIncluded, false);
assert.equal(hostedBaselineLiveDiscoveryReport.privacyLeakCount, 0);
assert.ok(Number(hostedBaselineLiveDiscoveryReport.sourceStats?.documentsSeen) > 0);
assert.ok(Number(hostedBaselineLiveDiscoveryReport.containerCandidateCount) > 0);
assert.match(hostedBaselineLivePrepText, /Unique drafted query count:\s*8/i);
assert.match(hostedBaselineLivePrepReviewText, /(?:\*\*)?Verdict:?(?:\*\*)?\s*`?CLEAN`?/i);
assert.equal(hostedBaselineLiveQuerySetAuthor.querySetEvidence?.uniqueQueryCount, 8);
assert.equal(hostedBaselineLiveQuerySetAuthor.querySetEvidence?.duplicateQueryCount, 0);
assert.equal(hostedBaselineLiveQuerySetReport.querySetEvidence?.publicBenchmarkReady, true);
assert.equal(hostedBaselineLiveQuerySetReport.querySetEvidence?.uniqueQueryCount, 8);
assert.equal(hostedBaselineLiveQuerySetReport.querySetEvidence?.duplicateQueryCount, 0);
assert.match(hostedBaselineLiveCodexLocalRunText, /not public benchmark\s+evidence/i);
assert.match(hostedBaselineLiveCodexLocalRunReviewText, /(?:\*\*)?Verdict:?(?:\*\*)?\s*`?CLEAN`?/i);
assert.equal(hostedBaselineLiveCodexLocalRunReport.fixtureOnly, false);
assert.equal(hostedBaselineLiveCodexLocalRunReport.callsHostedProvider, true);
assert.equal(hostedBaselineLiveCodexLocalRunReport.metricsOnly, true);
assert.equal(hostedBaselineLiveCodexLocalRunReport.countsAsProductionBaselineEvidence, true);
assert.equal(hostedBaselineLiveCodexLocalRunReport.countsAsPublicBenchmarkEvidence, false);
assert.equal(hostedBaselineLiveCodexLocalRunReport.publicBenchmarkClaimsAllowed, false);
assert.equal(hostedBaselineLiveCodexLocalRunReport.evidence?.comparison?.recallWeaveWin, false);
assert.equal(hostedBaselineLiveCodexLocalRunReport.evidence?.hosted?.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveCodexLocalRunReport.evidence?.recallWeave?.privacyLeakCount, 0);
assert.match(hostedBaselineLiveMirrorRunText, /source-matched live hosted-vs-local baseline/i);
assert.match(hostedBaselineLiveMirrorRunText, /not a public\s+superiority claim/i);
assert.equal(hostedBaselineLiveMirrorRunReport.fixtureOnly, false);
assert.equal(hostedBaselineLiveMirrorRunReport.callsHostedProvider, true);
assert.equal(hostedBaselineLiveMirrorRunReport.metricsOnly, true);
assert.equal(hostedBaselineLiveMirrorRunReport.countsAsProductionBaselineEvidence, true);
assert.equal(hostedBaselineLiveMirrorRunReport.countsAsPublicBenchmarkEvidence, false);
assert.equal(hostedBaselineLiveMirrorRunReport.publicBenchmarkClaimsAllowed, false);
assert.equal(hostedBaselineLiveMirrorRunReport.evidence?.sourceMatch?.sourceMatchReady, true);
assert.equal(hostedBaselineLiveMirrorRunReport.evidence?.sourceMatch?.collectableQueryCount, 8);
assert.equal(hostedBaselineLiveMirrorRunReport.evidence?.comparison?.countsAsComparisonEvidence, true);
assert.equal(hostedBaselineLiveMirrorRunReport.evidence?.comparison?.recallWeaveWin, true);
assert.equal(hostedBaselineLiveMirrorRunReport.evidence?.comparison?.reviewerApprovalCount, 0);
assert.ok(hostedBaselineLiveMirrorRunReport.evidence?.comparison?.failedChecks?.includes("two-reviewer-approvals"));
assert.equal(hostedBaselineLiveMirrorRunReport.evidence?.hosted?.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveMirrorRunReport.evidence?.recallWeave?.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveMirrorPacketReport.strictReal, true);
assert.equal(hostedBaselineLiveMirrorPacketReport.packagePassesStrictReal, true);
assert.equal(hostedBaselineLiveMirrorPacketReport.publicBenchmarkClaimsAllowed, false);
assert.match(hostedBaselineLiveMirrorGateReviewText, /Verdict:\s*`?CLEAN`?/i);
assert.match(hostedBaselineLiveBudgetedRunText, /context-token-budget 1600/i);
assert.match(hostedBaselineLiveBudgetedRunText, /not a public superiority claim/i);
assert.equal(hostedBaselineLiveBudgetedRunReport.fixtureOnly, false);
assert.equal(hostedBaselineLiveBudgetedRunReport.callsHostedProvider, true);
assert.equal(hostedBaselineLiveBudgetedRunReport.metricsOnly, true);
assert.equal(hostedBaselineLiveBudgetedRunReport.countsAsProductionBaselineEvidence, true);
assert.equal(hostedBaselineLiveBudgetedRunReport.countsAsPublicBenchmarkEvidence, false);
assert.equal(hostedBaselineLiveBudgetedRunReport.publicBenchmarkClaimsAllowed, false);
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.recallWeaveResponses?.contextBudget?.applied, true);
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.recallWeaveResponses?.contextBudget?.tokenBudget, 1600);
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.recallWeave?.metrics?.contextTokensAvg, 1600);
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.comparison?.countsAsComparisonEvidence, true);
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.comparison?.recallWeaveWin, true);
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.comparison?.reviewerApprovalCount, 0);
assert.ok(hostedBaselineLiveBudgetedRunReport.evidence?.comparison?.failedChecks?.includes("two-reviewer-approvals"));
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.hosted?.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveBudgetedRunReport.evidence?.recallWeave?.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveBudgetedPacketReport.strictReal, true);
assert.equal(hostedBaselineLiveBudgetedPacketReport.strictRealPassed, true);
assert.equal(hostedBaselineLiveBudgetedPacketReport.packagePassesStrictReal, true);
assert.equal(hostedBaselineLiveBudgetedPacketReport.publicBenchmarkClaimsAllowed, false);
assert.match(budgetedBaselineReviewerFindingsText, /Codex GPT-5\.5[\s\S]*approved/i);
assert.match(budgetedBaselineReviewerFindingsText, /Gemini[\s\S]*approved/i);
assert.match(budgetedBaselineReviewerIntakeText, /reviewerApprovalCount:\s*2/i);
assert.match(budgetedBaselineClaudeBlockedText, /blocked/i);
assert.equal(budgetedBaselineReviewerIntakeReport.mode, "baseline-reviewer-approval-intake");
assert.equal(budgetedBaselineReviewerIntakeReport.metricsOnly, true);
assert.equal(budgetedBaselineReviewerIntakeReport.publicLaunchAllowed, false);
assert.equal(budgetedBaselineReviewerIntakeReport.publicBenchmarkApprovalReady, true);
assert.equal(budgetedBaselineReviewerIntakeReport.reviewerApprovalCount, 2);
assert.equal(budgetedBaselineReviewerIntakeReport.independentReviewerCount, 2);
assert.deepEqual(budgetedBaselineReviewerIntakeReport.failedChecks, []);
assert.equal(budgetedBaselineReviewedComparison.mode, "baseline-comparison");
assert.equal(budgetedBaselineReviewedComparison.countsAsComparisonEvidence, true);
assert.equal(budgetedBaselineReviewedComparison.publicBenchmarkClaimsAllowed, true);
assert.equal(budgetedBaselineReviewedComparison.reviewerApprovalCount, 2);
assert.equal(budgetedBaselineReviewedComparison.reviewerApprovalTarget?.ok, true);
assert.deepEqual(budgetedBaselineReviewedComparison.failedChecks, []);
assert.equal(budgetedBaselineReviewedPacketReview.mode, "baseline-evidence-packet-review");
assert.equal(budgetedBaselineReviewedPacketReview.countsAsPublicBenchmarkEvidence, true);
assert.equal(budgetedBaselineReviewedPacketReview.publicBenchmarkClaimsAllowed, true);
assert.equal(budgetedBaselineReviewedPacketReview.publicLaunchAllowed, false);
assert.deepEqual(budgetedBaselineReviewedPacketReview.failedChecks, []);
assert.equal(budgetedBaselineReviewedReturnedPacketIntake.mode, "baseline-returned-packet-intake");
assert.equal(budgetedBaselineReviewedReturnedPacketIntake.status, "READY_FOR_PUBLIC_BENCHMARK_REVIEW");
assert.equal(budgetedBaselineReviewedReturnedPacketIntake.countsAsPublicBenchmarkEvidence, true);
assert.equal(budgetedBaselineReviewedReturnedPacketIntake.publicLaunchAllowed, false);
assert.equal(budgetedBaselineReviewedNextRun.mode, "hosted-baseline-next-run");
assert.equal(budgetedBaselineReviewedNextRun.readyForOwnerReview, true);
assert.equal(budgetedBaselineReviewedNextRun.requireReadyPassed, true);
assert.equal(budgetedBaselineReviewedNextRun.status, "READY_FOR_OWNER_REVIEW");
assert.equal(budgetedBaselineReviewedNextRun.publicLaunchAllowed, false);
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
const baselineSourceMatch = JSON.parse(run("node", ["packages/bench/baseline-source-match-preflight.mjs", "--fixture"]).stdout);
assert.equal(baselineSourceMatch.mode, "baseline-source-match-preflight");
assert.equal(baselineSourceMatch.sourceMatchReady, true);
assert.equal(baselineSourceMatch.rawMemoryIncluded, false);
assert.equal(baselineSourceMatch.sourceMatchEvidence?.collectableQueryCount, 3);
const baselineSourceAlignment = JSON.parse(run("node", ["packages/bench/baseline-source-alignment.mjs"]).stdout);
assert.equal(baselineSourceAlignment.mode, "baseline-source-alignment");
assert.equal(baselineSourceAlignment.benchmarkGate?.matchedBaselineRunAllowed, true);
assert.equal(baselineSourceAlignment.rawMemoryIncluded, false);
assert.equal(baselineSourceAlignment.rawLabelsIncluded, false);
const baselineSourceGap = JSON.parse(run("node", ["packages/bench/baseline-source-gap-plan.mjs"]).stdout);
assert.equal(baselineSourceGap.mode, "baseline-source-gap-plan");
assert.equal(baselineSourceGap.benchmarkGate?.matchedBaselineRunAllowed, true);
assert.equal(baselineSourceGap.repairPlan?.status, "READY_FOR_MATCHED_BASELINE");
assert.equal(baselineSourceGap.rawMemoryIncluded, false);
assert.equal(baselineSourceGap.rawLabelsIncluded, false);
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
    id: "fresh-real-container-canary-not-current",
    status: "incomplete",
    evidence: "real-canary-diagnostic-evidence.md",
    nextAction: "Run `canary:batch-audit` on redacted returned diagnostics, use `canary:next-agent` and `canary:next-agent-packet -- --allow-failed-inputs --require-ready` to pick one privacy-clean Hermes/OpenClaw target from a mixed folder, apply the current adapter, follow `canary:drill` during the fresh window, then collect a fresh strict-real canary window and verify the returned metrics-only packet with `canary:returned-inbox -- --require-production-canary` or `canary:returned-packet -- --require-production-canary`.",
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
        baselineSourceMatchPreflight: {
          ok: baselineSourceMatch.ok,
          sourceMatchReady: baselineSourceMatch.sourceMatchReady,
          collectableQueryCount: baselineSourceMatch.sourceMatchEvidence?.collectableQueryCount,
          rawMemoryIncluded: baselineSourceMatch.rawMemoryIncluded,
        },
        hostedBaselineLiveDiscovery: {
          callsHostedProvider: hostedBaselineLiveDiscoveryReport.callsHostedProvider,
          documentsSeen: hostedBaselineLiveDiscoveryReport.sourceStats?.documentsSeen,
          containerCandidateCount: hostedBaselineLiveDiscoveryReport.containerCandidateCount,
          rawLabelsIncluded: hostedBaselineLiveDiscoveryReport.rawLabelsIncluded,
          rawMemoryIncluded: hostedBaselineLiveDiscoveryReport.rawMemoryIncluded,
        },
        hostedBaselineLivePrep: {
          queryCount: hostedBaselineLiveQuerySetReport.querySetEvidence?.queryCount,
          uniqueQueryCount: hostedBaselineLiveQuerySetReport.querySetEvidence?.uniqueQueryCount,
          duplicateQueryCount: hostedBaselineLiveQuerySetReport.querySetEvidence?.duplicateQueryCount,
          publicBenchmarkReady: hostedBaselineLiveQuerySetReport.querySetEvidence?.publicBenchmarkReady,
        },
        hostedBaselineLiveCodexLocalRun: {
          status: hostedBaselineLiveCodexLocalRunReport.status,
          callsHostedProvider: hostedBaselineLiveCodexLocalRunReport.callsHostedProvider,
          countsAsProductionBaselineEvidence: hostedBaselineLiveCodexLocalRunReport.countsAsProductionBaselineEvidence,
          countsAsPublicBenchmarkEvidence: hostedBaselineLiveCodexLocalRunReport.countsAsPublicBenchmarkEvidence,
          hostedQuality: hostedBaselineLiveCodexLocalRunReport.evidence?.hosted?.metrics?.quality,
          recallWeaveQuality: hostedBaselineLiveCodexLocalRunReport.evidence?.recallWeave?.metrics?.quality,
          recallWeaveWin: hostedBaselineLiveCodexLocalRunReport.evidence?.comparison?.recallWeaveWin,
          privacyLeakCount: Number(hostedBaselineLiveCodexLocalRunReport.evidence?.hosted?.privacyLeakCount ?? 0)
            + Number(hostedBaselineLiveCodexLocalRunReport.evidence?.recallWeave?.privacyLeakCount ?? 0),
        },
        hostedBaselineLiveMirrorRun: {
          status: hostedBaselineLiveMirrorRunReport.status,
          callsHostedProvider: hostedBaselineLiveMirrorRunReport.callsHostedProvider,
          countsAsProductionBaselineEvidence: hostedBaselineLiveMirrorRunReport.countsAsProductionBaselineEvidence,
          countsAsPublicBenchmarkEvidence: hostedBaselineLiveMirrorRunReport.countsAsPublicBenchmarkEvidence,
          hostedQuality: hostedBaselineLiveMirrorRunReport.evidence?.hosted?.metrics?.quality,
          recallWeaveQuality: hostedBaselineLiveMirrorRunReport.evidence?.recallWeave?.metrics?.quality,
          recallWeaveWin: hostedBaselineLiveMirrorRunReport.evidence?.comparison?.recallWeaveWin,
          reviewerApprovalCount: hostedBaselineLiveMirrorRunReport.evidence?.comparison?.reviewerApprovalCount,
          failedChecks: hostedBaselineLiveMirrorRunReport.evidence?.comparison?.failedChecks,
          hostedContextTokensAvg: hostedBaselineLiveMirrorRunReport.evidence?.hosted?.metrics?.contextTokensAvg,
          recallWeaveContextTokensAvg: hostedBaselineLiveMirrorRunReport.evidence?.recallWeave?.metrics?.contextTokensAvg,
          privacyLeakCount: Number(hostedBaselineLiveMirrorRunReport.evidence?.hosted?.privacyLeakCount ?? 0)
            + Number(hostedBaselineLiveMirrorRunReport.evidence?.recallWeave?.privacyLeakCount ?? 0),
          strictRealPacket: hostedBaselineLiveMirrorPacketReport.packagePassesStrictReal,
        },
        hostedBaselineLiveBudgetedRun: {
          status: hostedBaselineLiveBudgetedRunReport.status,
          callsHostedProvider: hostedBaselineLiveBudgetedRunReport.callsHostedProvider,
          countsAsProductionBaselineEvidence: hostedBaselineLiveBudgetedRunReport.countsAsProductionBaselineEvidence,
          countsAsPublicBenchmarkEvidence: hostedBaselineLiveBudgetedRunReport.countsAsPublicBenchmarkEvidence,
          hostedQuality: hostedBaselineLiveBudgetedRunReport.evidence?.hosted?.metrics?.quality,
          recallWeaveQuality: hostedBaselineLiveBudgetedRunReport.evidence?.recallWeave?.metrics?.quality,
          recallWeaveWin: hostedBaselineLiveBudgetedRunReport.evidence?.comparison?.recallWeaveWin,
          reviewerApprovalCount: hostedBaselineLiveBudgetedRunReport.evidence?.comparison?.reviewerApprovalCount,
          failedChecks: hostedBaselineLiveBudgetedRunReport.evidence?.comparison?.failedChecks,
          hostedContextTokensAvg: hostedBaselineLiveBudgetedRunReport.evidence?.hosted?.metrics?.contextTokensAvg,
          recallWeaveContextTokensAvg: hostedBaselineLiveBudgetedRunReport.evidence?.recallWeave?.metrics?.contextTokensAvg,
          contextBudget: hostedBaselineLiveBudgetedRunReport.evidence?.recallWeaveResponses?.contextBudget,
          privacyLeakCount: Number(hostedBaselineLiveBudgetedRunReport.evidence?.hosted?.privacyLeakCount ?? 0)
            + Number(hostedBaselineLiveBudgetedRunReport.evidence?.recallWeave?.privacyLeakCount ?? 0),
          strictRealPacket: hostedBaselineLiveBudgetedPacketReport.packagePassesStrictReal,
        },
        budgetedBaselineReviewerIntake: {
          ok: budgetedBaselineReviewerIntakeReport.ok,
          publicBenchmarkApprovalReady: budgetedBaselineReviewerIntakeReport.publicBenchmarkApprovalReady,
          reviewerApprovalCount: budgetedBaselineReviewerIntakeReport.reviewerApprovalCount,
          independentReviewerCount: budgetedBaselineReviewerIntakeReport.independentReviewerCount,
          failedChecks: budgetedBaselineReviewerIntakeReport.failedChecks,
        },
        budgetedBaselineReviewedComparison: {
          countsAsComparisonEvidence: budgetedBaselineReviewedComparison.countsAsComparisonEvidence,
          publicBenchmarkClaimsAllowed: budgetedBaselineReviewedComparison.publicBenchmarkClaimsAllowed,
          reviewerApprovalCount: budgetedBaselineReviewedComparison.reviewerApprovalCount,
          failedChecks: budgetedBaselineReviewedComparison.failedChecks,
        },
        budgetedBaselineReviewedPacketReview: {
          countsAsPublicBenchmarkEvidence: budgetedBaselineReviewedPacketReview.countsAsPublicBenchmarkEvidence,
          publicBenchmarkClaimsAllowed: budgetedBaselineReviewedPacketReview.publicBenchmarkClaimsAllowed,
          publicLaunchAllowed: budgetedBaselineReviewedPacketReview.publicLaunchAllowed,
          failedChecks: budgetedBaselineReviewedPacketReview.failedChecks,
        },
        budgetedBaselineReviewedNextRun: {
          readyForOwnerReview: budgetedBaselineReviewedNextRun.readyForOwnerReview,
          requireReadyPassed: budgetedBaselineReviewedNextRun.requireReadyPassed,
          status: budgetedBaselineReviewedNextRun.status,
          publicLaunchAllowed: budgetedBaselineReviewedNextRun.publicLaunchAllowed,
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
        "RECALLWEAVE_BASELINE_LIVE=1 npm exec --yes pnpm@10.23.0 -- baseline:discover -- --live --output /tmp/recallweave-hosted-baseline-discovery.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 npm exec --yes pnpm@10.23.0 -- baseline:discover -- --live --output /tmp/recallweave-hosted-baseline-discovery.json --private-map-output /tmp/recallweave-hosted-container-map.private.jsonl",
        "npm exec --yes pnpm@10.23.0 -- baseline:select-container -- --discovery /tmp/recallweave-hosted-baseline-discovery.json --private-map /tmp/recallweave-hosted-container-map.private.jsonl --env-output /tmp/recallweave-hosted-baseline.private.env",
        "RECALLWEAVE_BASELINE_LIVE=1 npm exec --yes pnpm@10.23.0 -- baseline:author-queryset -- --live --discovery /tmp/recallweave-hosted-baseline-discovery.json --private-map /tmp/recallweave-hosted-container-map.private.jsonl --queryset-output /tmp/recallweave-hosted-baseline-queryset.json --output /tmp/recallweave-hosted-baseline-queryset-author-report.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:queryset -- --queryset /tmp/recallweave-hosted-baseline-queryset.json --strict --output /tmp/recallweave-hosted-baseline-queryset-report.json",
        "RECALLWEAVE_BASELINE_LIVE=1 npm exec --yes pnpm@10.23.0 -- baseline:mirror-hosted -- --live --discovery /tmp/recallweave-hosted-baseline-discovery.json --private-map /tmp/recallweave-hosted-container-map.private.jsonl --output-dir /tmp/recallweave-hosted-local-mirror --output /tmp/recallweave-hosted-local-mirror.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:source-match -- --live --queryset /tmp/recallweave-hosted-baseline-queryset.json --container-dir /tmp/recallweave-hosted-local-mirror --preserve-ids --strict --output /tmp/recallweave-baseline-source-match.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:source-align -- --source-match /tmp/recallweave-baseline-source-match.json --local-map /tmp/recallweave-hosted-local-mirror/container-map.json --private-map /tmp/recallweave-hosted-container-map.private.jsonl --strict --output /tmp/recallweave-baseline-source-alignment.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:source-gap -- --source-match /tmp/recallweave-baseline-source-match.json --source-alignment /tmp/recallweave-baseline-source-alignment.json --output /tmp/recallweave-baseline-source-gap.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1 RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET=1600 RECALLWEAVE_BASELINE_PRESERVE_IDS=1 npm exec --yes pnpm@10.23.0 -- baseline:run -- --live --container-env /tmp/recallweave-hosted-baseline.private.env --queryset /tmp/recallweave-hosted-baseline-queryset.json --container-dir /tmp/recallweave-hosted-local-mirror --local-map /tmp/recallweave-hosted-local-mirror/container-map.json --private-map /tmp/recallweave-hosted-container-map.private.jsonl --preserve-ids --reviewed-queryset --context-token-budget 1600 --output /tmp/recallweave-baseline-run.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture",
        "npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture",
        "npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture",
        "npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --output /tmp/recallweave-canary-batch-audit.json",
        "npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch /tmp/recallweave-canary-batch-audit.json --output /tmp/recallweave-canary-next-agent-plan.json",
        "npm exec --yes pnpm@10.23.0 -- canary:operator-packet -- --host openclaw",
        "npm exec --yes pnpm@10.23.0 -- canary:drill -- --host openclaw --format markdown --output /tmp/recallweave-canary-drill.md",
        "npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input-root <redacted-diagnostics-folder> --allow-failed-inputs --output /tmp/recallweave-canary-batch-audit.json",
        "npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --batch /tmp/recallweave-canary-batch-audit.json --output /tmp/recallweave-canary-next-agent-plan.json",
        "npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --batch /tmp/recallweave-canary-batch-audit.json --require-ready --output /tmp/recallweave-next-agent-handoff.zip",
        "npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root <redacted-diagnostics-folder> --allow-failed-inputs --require-ready --output /tmp/recallweave-next-agent-handoff.zip",
        "npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root <folder-of-agent-zips> --require-production-canary --output /tmp/recallweave-returned-canary-inbox.json",
        "npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet /tmp/recallweave-canary-evidence-packet.zip --require-production-canary --output /tmp/recallweave-returned-canary-intake.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output /tmp/recallweave-hosted-baseline-result.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET=1600 npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --live --container-dir <local-recallweave-container-dir> --context-token-budget 1600 --output /tmp/recallweave-search-responses.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --live --responses /tmp/recallweave-search-responses.json --output /tmp/recallweave-result.json",
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result /tmp/recallweave-hosted-baseline-result.json --output /tmp/recallweave-hosted-baseline-preflight.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:compare -- --hosted /tmp/recallweave-hosted-baseline-result.json --recallweave /tmp/recallweave-result.json --output /tmp/recallweave-baseline-comparison.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:packet -- --hosted /tmp/recallweave-hosted-baseline-result.json --recallweave /tmp/recallweave-result.json --comparison /tmp/recallweave-baseline-comparison.json --preflight /tmp/recallweave-hosted-baseline-preflight.json --strict-real --output /tmp/recallweave-baseline-evidence-packet.zip",
        "Set RECALLWEAVE_REVIEW_OPENAI_API_KEY in the environment, not in this command or any file.",
        "RECALLWEAVE_REVIEW_OPENAI_PROVIDER=deepseek RECALLWEAVE_REVIEW_OPENAI_MODEL=deepseek-v4-pro npm exec --yes pnpm@10.23.0 -- baseline:reviewer:openai-compatible -- --packet /tmp/recallweave-baseline-evidence-packet.zip --comparison /tmp/recallweave-baseline-comparison.json --reviewer-id deepseek-reviewer-a --output /tmp/reviewer-a-approval.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake -- --packet /tmp/recallweave-baseline-evidence-packet.zip --comparison /tmp/recallweave-baseline-comparison.json --strict-target --review /tmp/reviewer-a-approval.json --review /tmp/reviewer-b-approval.json --output /tmp/recallweave-reviewer-approval-report.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:compare -- --hosted /tmp/recallweave-hosted-baseline-result.json --recallweave /tmp/recallweave-result.json --reviewer-approval-report /tmp/recallweave-reviewer-approval-report.json --output /tmp/recallweave-baseline-comparison.json",
        "npm exec --yes pnpm@10.23.0 -- baseline:next-run -- --hosted /tmp/recallweave-hosted-baseline-result.json --recallweave /tmp/recallweave-result.json --preflight /tmp/recallweave-hosted-baseline-preflight.json --comparison /tmp/recallweave-baseline-comparison.json --require-ready",
        "npm exec --yes pnpm@10.23.0 -- baseline:returned-packet -- --packet /tmp/recallweave-baseline-evidence-packet.zip --require-public-benchmark --output /tmp/recallweave-returned-baseline-intake.json",
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
