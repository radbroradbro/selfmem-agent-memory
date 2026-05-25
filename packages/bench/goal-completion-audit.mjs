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
  githubWriteEvidence: `${reviewDir}/github-write-route-evidence.md`,
  claudeBlocked: `${reviewDir}/claude-pr5-review-blocked.md`,
  claudeReview: `${reviewDir}/claude-pr5-review.md`,
  handoffPacketEvidence: `${reviewDir}/github-handoff-packet-evidence.md`,
  handoffPacketReview: `${reviewDir}/gemini-github-handoff-packet-review.md`,
  githubLiveSyncEvidence: `${reviewDir}/github-live-sync-evidence.md`,
  canaryReportGeneratorEvidence: `${reviewDir}/canary-report-generator-evidence.md`,
  canaryReportGeneratorReview: `${reviewDir}/gemini-canary-report-generator-review.md`,
  canaryEvidenceIntakeEvidence: `${reviewDir}/canary-evidence-intake-evidence.md`,
  canaryEvidenceIntakeReview: `${reviewDir}/gemini-canary-evidence-intake-review.md`,
  canaryRemediationEvidence: `${reviewDir}/canary-remediation-evidence.md`,
  canaryRemediationReview: `${reviewDir}/gemini-canary-remediation-review.md`,
  canaryDrillEvidence: `${reviewDir}/canary-drill-evidence.md`,
  canaryDrillReview: `${reviewDir}/gemini-canary-drill-review.md`,
  canaryReturnedPacketIntakeEvidence: `${reviewDir}/canary-returned-packet-intake-evidence.md`,
  canaryReturnedPacketIntakeReview: `${reviewDir}/gemini-canary-returned-packet-intake-review.md`,
  canaryReturnedInboxEvidence: `${reviewDir}/canary-returned-inbox-evidence.md`,
  canaryReturnedInboxReview: `${reviewDir}/gemini-canary-returned-inbox-review.md`,
  canaryNextAgentPlanEvidence: `${reviewDir}/canary-next-agent-plan-evidence.md`,
  canaryNextAgentPlanReview: `${reviewDir}/gemini-canary-next-agent-plan-review.md`,
  adapterBoundedReadThroughEvidence: `${reviewDir}/adapter-bounded-read-through-evidence.md`,
  realCanaryDiagnosticEvidence: `${reviewDir}/real-canary-diagnostic-evidence.md`,
  hostedBaselinePreflightEvidence: `${reviewDir}/hosted-baseline-preflight-evidence.md`,
  hostedBaselinePreflightReview: `${reviewDir}/gemini-hosted-baseline-preflight-review.md`,
  hostedBaselineLiveDiscoveryReport: `${reviewDir}/hosted-baseline-live-discovery.json`,
  hostedBaselineLiveDiscoveryEvidence: `${reviewDir}/hosted-baseline-live-discovery-evidence.md`,
  hostedBaselineLiveDiscoveryReview: `${reviewDir}/gemini-hosted-baseline-live-discovery-review.md`,
  hostedBaselineLivePrepEvidence: `${reviewDir}/hosted-baseline-live-prep-evidence.md`,
  hostedBaselineLivePrepReview: `${reviewDir}/gemini-hosted-baseline-live-prep-review.md`,
  hostedBaselineLiveQuerySetAuthorReport: `${reviewDir}/hosted-baseline-live-queryset-author.json`,
  hostedBaselineLiveQuerySetReport: `${reviewDir}/hosted-baseline-live-queryset-report.json`,
  baselineSourceMatchPreflightEvidence: `${reviewDir}/baseline-source-match-preflight-evidence.md`,
  baselineSourceMatchPreflightReview: `${reviewDir}/gemini-baseline-source-match-preflight-review.md`,
  baselineSourceAlignmentEvidence: `${reviewDir}/baseline-source-alignment-evidence.md`,
  baselineSourceAlignmentReview: `${reviewDir}/gemini-baseline-source-alignment-review.md`,
  baselineSourceGapPlanEvidence: `${reviewDir}/baseline-source-gap-plan-evidence.md`,
  baselineSourceGapPlanReview: `${reviewDir}/gemini-baseline-source-gap-plan-review.md`,
  hostedBaselineLiveCodexLocalRunEvidence: `${reviewDir}/hosted-baseline-live-codex-local-run-evidence.md`,
  hostedBaselineLiveCodexLocalRunReport: `${reviewDir}/hosted-baseline-live-codex-local-run.json`,
  hostedBaselineLiveCodexLocalRunReview: `${reviewDir}/gemini-hosted-baseline-live-codex-local-review.md`,
  hostedBaselineLiveMirrorRunEvidence: `${reviewDir}/hosted-baseline-live-mirror-run-evidence.md`,
  hostedBaselineLiveMirrorRunReport: `${reviewDir}/hosted-baseline-live-mirror-run.json`,
  hostedBaselineLiveMirrorPacketReport: `${reviewDir}/hosted-baseline-live-mirror-packet.json`,
  hostedBaselineLiveMirrorGateReview: `${reviewDir}/codex-hosted-baseline-live-mirror-gate-review.md`,
  hostedBaselineLiveBudgetedRunEvidence: `${reviewDir}/hosted-baseline-live-budgeted-run-evidence.md`,
  hostedBaselineLiveBudgetedRunReport: `${reviewDir}/hosted-baseline-live-budgeted-run.json`,
  hostedBaselineLiveBudgetedPacketReport: `${reviewDir}/hosted-baseline-live-budgeted-packet.json`,
  budgetedBaselineReviewerFindings: `${reviewDir}/reviewer-work/reviewer-findings.md`,
  budgetedBaselineReviewerIntakeEvidence: `${reviewDir}/reviewer-work/budgeted-baseline-reviewer-intake-evidence.md`,
  budgetedBaselineReviewerIntakeReport: `${reviewDir}/reviewer-work/budgeted-baseline-reviewer-intake-two-of-two.json`,
  budgetedBaselineReviewedOwnerReviewEvidence: `${reviewDir}/reviewer-work/reviewed-baseline-owner-review-evidence.md`,
  budgetedBaselineCodexApproval: `${reviewDir}/reviewer-work/codex-5-5-budgeted-baseline-approval.json`,
  budgetedBaselineGeminiApproval: `${reviewDir}/reviewer-work/gemini-3-1-pro-budgeted-baseline-approval.json`,
  budgetedBaselineClaudeBlocked: `${reviewDir}/reviewer-work/claude-opus-blocked-by-hooks.md`,
  budgetedBaselineReviewedComparison: `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-comparison.json`,
  budgetedBaselineReviewedPacketReview: `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-packet-review.json`,
  budgetedBaselineReviewedReturnedPacketIntake: `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-returned-packet-intake.json`,
  budgetedBaselineReviewedNextRun: `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-next-run.json`,
  hostedBaselineNextRunEvidence: `${reviewDir}/hosted-baseline-next-run-evidence.md`,
  hostedBaselineNextRunReview: `${reviewDir}/gemini-hosted-baseline-next-run-review.md`,
  baselineReturnedPacketIntakeEvidence: `${reviewDir}/baseline-returned-packet-intake-evidence.md`,
  baselineReturnedPacketIntakeReview: `${reviewDir}/gemini-baseline-returned-packet-intake-review.md`,
  sessionCompactionLocalBatchAuditEvidence: `${reviewDir}/session-compaction-local-batch-audit-evidence.md`,
  sessionCompactionLocalBatchAuditReview: `${reviewDir}/gemini-session-compaction-local-batch-audit-review.md`,
  issueDraft: `${reviewDir}/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`,
  browserEvidence: `${reviewDir}/ui-evidence/brain-ui-current-head-live-evidence.json`,
  releaseReadinessEvidence: `${reviewDir}/ui-evidence/brain-ui-release-readiness-evidence.json`,
  benchmarkSotaReadiness: `${reviewDir}/benchmark-sota-readiness-20260525.md`,
  benchmarkSotaLadderReport: `${reviewDir}/sota-ladder-report-20260525.json`,
  benchmarkSotaLadderMarkdown: `${reviewDir}/sota-ladder-report-20260525.md`,
  benchmarkSotaOperatorPacket: `${reviewDir}/sota-ladder-operator-packet-20260525.json`,
  benchmarkSotaOperatorMarkdown: `${reviewDir}/sota-ladder-operator-packet-20260525.md`,
  queryExpansionPreflightReport: `${reviewDir}/query-expansion-preflight-20260525.json`,
  queryExpansionPreflightMarkdown: `${reviewDir}/query-expansion-preflight-20260525.md`,
  queryExpansionLiveLocalSmokeReport: `${reviewDir}/query-expansion-live-local-smoke-20260525.json`,
  queryExpansionLiveLocalSmokeMarkdown: `${reviewDir}/query-expansion-live-local-smoke-20260525.md`,
  queryExpansionResultGateReport: `${reviewDir}/query-expansion-result-gate-20260525.json`,
  queryExpansionResultGateMarkdown: `${reviewDir}/query-expansion-result-gate-20260525.md`,
  localRerankResultGateReport: `${reviewDir}/local-rerank-result-gate-20260525.json`,
  localRerankResultGateMarkdown: `${reviewDir}/local-rerank-result-gate-20260525.md`,
  providerChallengerResultGateReport: `${reviewDir}/provider-challenger-result-gate-20260525.json`,
  providerChallengerResultGateMarkdown: `${reviewDir}/provider-challenger-result-gate-20260525.md`,
  endToEndMemoryScoreGateReport: `${reviewDir}/end-to-end-memory-score-gate-20260525.json`,
  endToEndMemoryScoreGateMarkdown: `${reviewDir}/end-to-end-memory-score-gate-20260525.md`,
  answerQualityHarnessSmokeReport: `${reviewDir}/answer-quality-harness-smoke-20260525.json`,
  answerQualityHarnessSmokeMarkdown: `${reviewDir}/answer-quality-harness-smoke-20260525.md`,
};

for (const [name, file] of Object.entries(files)) {
  const path = join(root, file);
  assert.ok(existsSync(path), `${name} missing at ${file}`);
  assert.ok(statSync(path).size > 0, `${name} empty at ${file}`);
}

const releaseState = JSON.parse(readFileSync(join(root, files.releaseState), "utf8"));
const hostedBaselineLiveDiscovery = JSON.parse(readFileSync(join(root, files.hostedBaselineLiveDiscoveryReport), "utf8"));
const hostedBaselineLiveQuerySet = JSON.parse(readFileSync(join(root, files.hostedBaselineLiveQuerySetReport), "utf8"));
const hostedBaselineLiveCodexLocalRun = JSON.parse(readFileSync(join(root, files.hostedBaselineLiveCodexLocalRunReport), "utf8"));
const hostedBaselineLiveMirrorRun = JSON.parse(readFileSync(join(root, files.hostedBaselineLiveMirrorRunReport), "utf8"));
const hostedBaselineLiveMirrorPacket = JSON.parse(readFileSync(join(root, files.hostedBaselineLiveMirrorPacketReport), "utf8"));
const hostedBaselineLiveBudgetedRun = JSON.parse(readFileSync(join(root, files.hostedBaselineLiveBudgetedRunReport), "utf8"));
const hostedBaselineLiveBudgetedPacket = JSON.parse(readFileSync(join(root, files.hostedBaselineLiveBudgetedPacketReport), "utf8"));
const budgetedBaselineReviewerIntake = JSON.parse(readFileSync(join(root, files.budgetedBaselineReviewerIntakeReport), "utf8"));
const budgetedBaselineReviewedComparison = JSON.parse(readFileSync(join(root, files.budgetedBaselineReviewedComparison), "utf8"));
const budgetedBaselineReviewedPacketReview = JSON.parse(readFileSync(join(root, files.budgetedBaselineReviewedPacketReview), "utf8"));
const budgetedBaselineReviewedReturnedPacketIntake = JSON.parse(readFileSync(join(root, files.budgetedBaselineReviewedReturnedPacketIntake), "utf8"));
const budgetedBaselineReviewedNextRun = JSON.parse(readFileSync(join(root, files.budgetedBaselineReviewedNextRun), "utf8"));
const releaseReadinessEvidence = JSON.parse(readFileSync(join(root, files.releaseReadinessEvidence), "utf8"));
const currentHeadLiveEvidence = JSON.parse(readFileSync(join(root, files.browserEvidence), "utf8"));
const benchmarkSotaLadder = JSON.parse(readFileSync(join(root, files.benchmarkSotaLadderReport), "utf8"));
const benchmarkSotaOperatorPacket = JSON.parse(readFileSync(join(root, files.benchmarkSotaOperatorPacket), "utf8"));
const queryExpansionPreflight = JSON.parse(readFileSync(join(root, files.queryExpansionPreflightReport), "utf8"));
const queryExpansionLiveLocalSmoke = JSON.parse(readFileSync(join(root, files.queryExpansionLiveLocalSmokeReport), "utf8"));
const queryExpansionResultGate = JSON.parse(readFileSync(join(root, files.queryExpansionResultGateReport), "utf8"));
const localRerankResultGate = JSON.parse(readFileSync(join(root, files.localRerankResultGateReport), "utf8"));
const providerChallengerResultGate = JSON.parse(readFileSync(join(root, files.providerChallengerResultGateReport), "utf8"));
const endToEndMemoryScoreGate = JSON.parse(readFileSync(join(root, files.endToEndMemoryScoreGateReport), "utf8"));
const answerQualityHarnessSmoke = JSON.parse(readFileSync(join(root, files.answerQualityHarnessSmokeReport), "utf8"));
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
assert.equal(hostedBaselineLiveDiscovery.mode, "hosted-baseline-discovery");
assert.equal(hostedBaselineLiveDiscovery.fixtureOnly, false);
assert.equal(hostedBaselineLiveDiscovery.callsHostedProvider, true);
assert.equal(hostedBaselineLiveDiscovery.publicSafe, true);
assert.equal(hostedBaselineLiveDiscovery.metricsOnly, true);
assert.equal(hostedBaselineLiveDiscovery.rawLabelsIncluded, false);
assert.equal(hostedBaselineLiveDiscovery.rawMemoryIncluded, false);
assert.equal(hostedBaselineLiveDiscovery.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveDiscovery.redactionFailureCount, 0);
assert.ok(Number(hostedBaselineLiveDiscovery.sourceStats?.documentsSeen) > 0);
assert.ok(Number(hostedBaselineLiveDiscovery.containerCandidateCount) > 0);
assert.equal(hostedBaselineLiveQuerySet.querySetEvidence?.publicBenchmarkReady, true);
assert.equal(hostedBaselineLiveQuerySet.querySetEvidence?.uniqueQueryCount, 8);
assert.equal(hostedBaselineLiveQuerySet.querySetEvidence?.duplicateQueryCount, 0);
assert.equal(hostedBaselineLiveCodexLocalRun.fixtureOnly, false);
assert.equal(hostedBaselineLiveCodexLocalRun.callsHostedProvider, true);
assert.equal(hostedBaselineLiveCodexLocalRun.metricsOnly, true);
assert.equal(hostedBaselineLiveCodexLocalRun.countsAsProductionBaselineEvidence, true);
assert.equal(hostedBaselineLiveCodexLocalRun.countsAsPublicBenchmarkEvidence, false);
assert.equal(hostedBaselineLiveCodexLocalRun.publicBenchmarkClaimsAllowed, false);
assert.equal(hostedBaselineLiveCodexLocalRun.evidence?.comparison?.recallWeaveWin, false);
assert.match(texts.hostedBaselineLiveMirrorRunEvidence, /not a public\s+superiority claim/i);
assert.equal(hostedBaselineLiveMirrorRun.fixtureOnly, false);
assert.equal(hostedBaselineLiveMirrorRun.callsHostedProvider, true);
assert.equal(hostedBaselineLiveMirrorRun.metricsOnly, true);
assert.equal(hostedBaselineLiveMirrorRun.countsAsProductionBaselineEvidence, true);
assert.equal(hostedBaselineLiveMirrorRun.countsAsPublicBenchmarkEvidence, false);
assert.equal(hostedBaselineLiveMirrorRun.publicBenchmarkClaimsAllowed, false);
assert.equal(hostedBaselineLiveMirrorRun.evidence?.sourceMatch?.sourceMatchReady, true);
assert.equal(hostedBaselineLiveMirrorRun.evidence?.sourceMatch?.collectableQueryCount, 8);
assert.equal(hostedBaselineLiveMirrorRun.evidence?.comparison?.countsAsComparisonEvidence, true);
assert.equal(hostedBaselineLiveMirrorRun.evidence?.comparison?.recallWeaveWin, true);
assert.equal(hostedBaselineLiveMirrorRun.evidence?.comparison?.reviewerApprovalCount, 0);
assert.ok(hostedBaselineLiveMirrorRun.evidence?.comparison?.failedChecks?.includes("two-reviewer-approvals"));
assert.equal(hostedBaselineLiveMirrorRun.evidence?.hosted?.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveMirrorRun.evidence?.recallWeave?.privacyLeakCount, 0);
assert.ok(Number(hostedBaselineLiveMirrorRun.evidence?.recallWeave?.metrics?.contextTokensAvg) > Number(hostedBaselineLiveMirrorRun.evidence?.hosted?.metrics?.contextTokensAvg));
assert.equal(hostedBaselineLiveMirrorPacket.strictReal, true);
assert.equal(hostedBaselineLiveMirrorPacket.packagePassesStrictReal, true);
assert.equal(hostedBaselineLiveMirrorPacket.publicBenchmarkClaimsAllowed, false);
assert.match(texts.hostedBaselineLiveMirrorGateReview, /Verdict:\s*`?CLEAN`?/i);
assert.match(texts.hostedBaselineLiveBudgetedRunEvidence, /removes the earlier context-budget caveat/i);
assert.equal(hostedBaselineLiveBudgetedRun.fixtureOnly, false);
assert.equal(hostedBaselineLiveBudgetedRun.callsHostedProvider, true);
assert.equal(hostedBaselineLiveBudgetedRun.metricsOnly, true);
assert.equal(hostedBaselineLiveBudgetedRun.countsAsProductionBaselineEvidence, true);
assert.equal(hostedBaselineLiveBudgetedRun.countsAsPublicBenchmarkEvidence, false);
assert.equal(hostedBaselineLiveBudgetedRun.publicBenchmarkClaimsAllowed, false);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.sourceMatch?.sourceMatchReady, true);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.sourceMatch?.collectableQueryCount, 8);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.recallWeaveResponses?.contextBudget?.applied, true);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.recallWeaveResponses?.contextBudget?.tokenBudget, 1600);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.recallWeaveResponses?.contextBudget?.exportedContextTokensAvg, 1600);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.comparison?.countsAsComparisonEvidence, true);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.comparison?.recallWeaveWin, true);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.comparison?.reviewerApprovalCount, 0);
assert.ok(hostedBaselineLiveBudgetedRun.evidence?.comparison?.failedChecks?.includes("two-reviewer-approvals"));
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.hosted?.privacyLeakCount, 0);
assert.equal(hostedBaselineLiveBudgetedRun.evidence?.recallWeave?.privacyLeakCount, 0);
assert.ok(
  Number(hostedBaselineLiveBudgetedRun.evidence?.recallWeave?.metrics?.contextTokensAvg)
    <= Math.max(
      Number(hostedBaselineLiveBudgetedRun.evidence?.hosted?.metrics?.contextTokensAvg) * 1.5,
      Number(hostedBaselineLiveBudgetedRun.evidence?.hosted?.metrics?.contextTokensAvg) + 512,
    ),
);
assert.equal(hostedBaselineLiveBudgetedPacket.strictReal, true);
assert.equal(hostedBaselineLiveBudgetedPacket.strictRealPassed, true);
assert.equal(hostedBaselineLiveBudgetedPacket.packagePassesStrictReal, true);
assert.equal(hostedBaselineLiveBudgetedPacket.publicBenchmarkClaimsAllowed, false);
assert.match(texts.budgetedBaselineReviewerFindings, /Codex GPT-5\.5[\s\S]*approved/i);
assert.match(texts.budgetedBaselineReviewerFindings, /Gemini[\s\S]*approved/i);
assert.match(texts.budgetedBaselineReviewerIntakeEvidence, /reviewerApprovalCount:\s*2/i);
assert.match(texts.budgetedBaselineClaudeBlocked, /blocked/i);
assert.equal(budgetedBaselineReviewerIntake.mode, "baseline-reviewer-approval-intake");
assert.equal(budgetedBaselineReviewerIntake.metricsOnly, true);
assert.equal(budgetedBaselineReviewerIntake.publicLaunchAllowed, false);
assert.equal(budgetedBaselineReviewerIntake.publicBenchmarkApprovalReady, true);
assert.equal(budgetedBaselineReviewerIntake.reviewerApprovalCount, 2);
assert.equal(budgetedBaselineReviewerIntake.independentReviewerCount, 2);
assert.deepEqual(budgetedBaselineReviewerIntake.failedChecks, []);
assert.equal(budgetedBaselineReviewedComparison.countsAsComparisonEvidence, true);
assert.equal(budgetedBaselineReviewedComparison.publicBenchmarkClaimsAllowed, true);
assert.equal(budgetedBaselineReviewedComparison.reviewerApprovalCount, 2);
assert.deepEqual(budgetedBaselineReviewedComparison.failedChecks, []);
assert.equal(budgetedBaselineReviewedPacketReview.countsAsPublicBenchmarkEvidence, true);
assert.equal(budgetedBaselineReviewedPacketReview.publicBenchmarkClaimsAllowed, true);
assert.equal(budgetedBaselineReviewedPacketReview.publicLaunchAllowed, false);
assert.deepEqual(budgetedBaselineReviewedPacketReview.failedChecks, []);
assert.equal(budgetedBaselineReviewedReturnedPacketIntake.status, "READY_FOR_PUBLIC_BENCHMARK_REVIEW");
assert.equal(budgetedBaselineReviewedReturnedPacketIntake.countsAsPublicBenchmarkEvidence, true);
assert.equal(budgetedBaselineReviewedReturnedPacketIntake.publicLaunchAllowed, false);
assert.equal(budgetedBaselineReviewedNextRun.status, "READY_FOR_OWNER_REVIEW");
assert.equal(budgetedBaselineReviewedNextRun.readyForOwnerReview, true);
assert.equal(budgetedBaselineReviewedNextRun.publicLaunchAllowed, false);
assert.equal(benchmarkSotaLadder.mode, "public-benchmark-sota-ladder");
assert.equal(benchmarkSotaLadder.status, "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE");
assert.equal(benchmarkSotaLadder.publicBenchmarkClaimsAllowed, false);
assert.equal(benchmarkSotaLadder.componentBenchmarksAreModelSelectionOnly, true);
assert.ok(benchmarkSotaLadder.blockers.includes("missing-end-to-end-memory-benchmark-score"));
assert.ok(benchmarkSotaLadder.blockers.includes("missing-live-llm-query-expansion-result"));
assert.ok(benchmarkSotaLadder.blockers.includes("missing-local-apple-reranker-sidecar-result"));
assert.equal(benchmarkSotaOperatorPacket.mode, "public-benchmark-sota-operator-packet");
assert.equal(benchmarkSotaOperatorPacket.status, "BLOCKED_SOTA_OPERATOR_INPUTS");
assert.equal(benchmarkSotaOperatorPacket.publicBenchmarkClaimsAllowed, false);
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.queryExpansionImplementation?.liveLlmExpansionWiringPresent, true);
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.queryExpansionImplementation?.liveLlmExpansionProven, false);
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.queryExpansionLiveLocalSmoke?.evidenceExists, true);
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.queryExpansionLiveLocalSmoke?.publicBenchmarkClaimsAllowed, false);
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.endToEndMemoryScoreGate?.status, "BLOCKED_END_TO_END_MEMORY_SCORE");
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.endToEndMemoryScoreGate?.countsAsEndToEndMemoryBenchmark, false);
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.answerQualityHarnessSmoke?.mode, "public-benchmark-answer-quality");
assert.equal(benchmarkSotaOperatorPacket.currentEvidence?.answerQualityHarnessSmoke?.readyForEndToEndMemoryScoreGate, false);
assert.equal(queryExpansionPreflight.mode, "public-benchmark-query-expansion-preflight");
assert.equal(queryExpansionPreflight.status, "BLOCKED_QUERY_EXPANSION_ENV");
assert.equal(queryExpansionPreflight.readiness?.liveLlmExpansionWiringPresent, true);
assert.equal(queryExpansionPreflight.readiness?.queryExpansionCanBeBenchmarked, false);
assert.ok(queryExpansionPreflight.blockers.includes("no-query-expansion-arm-ready"));
assert.equal(queryExpansionLiveLocalSmoke.mode, "query-expansion-live-local-smoke");
assert.equal(queryExpansionLiveLocalSmoke.ok, true);
assert.equal(queryExpansionLiveLocalSmoke.claimUse, "wiring-smoke-only");
assert.equal(queryExpansionLiveLocalSmoke.publicBenchmarkClaimsAllowed, false);
assert.equal(queryExpansionLiveLocalSmoke.queryExpansionOnlyCurrentQuerySent, true);
assert.equal(queryExpansionLiveLocalSmoke.queryExpansionStoredMemoriesSent, false);
assert.equal(queryExpansionResultGate.mode, "query-expansion-result-gate");
assert.equal(queryExpansionResultGate.status, "BLOCKED_QUERY_EXPANSION_RESULT");
assert.equal(queryExpansionResultGate.countsAsLiveQueryExpansionBenchmark, false);
assert.equal(queryExpansionResultGate.countsAsFullMemorySotaEvidence, false);
assert.equal(queryExpansionResultGate.publicBenchmarkClaimsAllowed, false);
assert.ok(queryExpansionResultGate.blockers.includes("query-expansion-live-calls-missing"));
assert.ok(queryExpansionResultGate.blockers.includes("query-expansion-used-deterministic-fallback"));
assert.equal(localRerankResultGate.mode, "local-rerank-result-gate");
assert.equal(localRerankResultGate.status, "BLOCKED_LOCAL_RERANK_RESULT");
assert.equal(localRerankResultGate.countsAsLiveLocalRerankBenchmark, false);
assert.equal(localRerankResultGate.countsAsFullMemorySotaEvidence, false);
assert.equal(localRerankResultGate.publicBenchmarkClaimsAllowed, false);
assert.ok(localRerankResultGate.blockers.includes("local-rerank-live-calls-missing"));
assert.ok(localRerankResultGate.blockers.includes("local-rerank-used-mock-calls"));
assert.equal(providerChallengerResultGate.mode, "provider-challenger-result-gate");
assert.equal(providerChallengerResultGate.status, "BLOCKED_PROVIDER_CHALLENGER_RESULT");
assert.equal(providerChallengerResultGate.countsAsLiveProviderChallengerBenchmark, false);
assert.equal(providerChallengerResultGate.countsAsFullMemorySotaEvidence, false);
assert.equal(providerChallengerResultGate.publicBenchmarkClaimsAllowed, false);
assert.ok(providerChallengerResultGate.blockers.includes("provider-live-calls-missing"));
assert.ok(providerChallengerResultGate.blockers.includes("provider-used-mock-calls"));
assert.equal(endToEndMemoryScoreGate.mode, "end-to-end-memory-score-gate");
assert.equal(endToEndMemoryScoreGate.status, "BLOCKED_END_TO_END_MEMORY_SCORE");
assert.equal(endToEndMemoryScoreGate.countsAsEndToEndMemoryBenchmark, false);
assert.equal(endToEndMemoryScoreGate.countsAsFullMemorySotaEvidence, false);
assert.equal(endToEndMemoryScoreGate.publicBenchmarkClaimsAllowed, false);
assert.ok(endToEndMemoryScoreGate.blockers.includes("retrieval-proxy-result-cannot-count-as-answer-quality"));
assert.ok(endToEndMemoryScoreGate.blockers.includes("memorybench-answer-quality-not-proven"));
assert.ok(endToEndMemoryScoreGate.blockers.includes("missing-answer-quality-score"));
assert.equal(answerQualityHarnessSmoke.mode, "public-benchmark-answer-quality");
assert.equal(answerQualityHarnessSmoke.fixtureOnly, true);
assert.equal(answerQualityHarnessSmoke.memoryBenchAnswerQuality, true);
assert.equal(answerQualityHarnessSmoke.readyForEndToEndMemoryScoreGate, false);
assert.equal(answerQualityHarnessSmoke.publicBenchmarkClaimsAllowed, false);
assert.equal(answerQualityHarnessSmoke.rawAnswersIncluded, false);
assert.equal(answerQualityHarnessSmoke.rawMemoryIncluded, false);
assert.match(texts.completionAudit, /Verdict: not complete/i);
assert.match(texts.productionReadiness, /verdict.*FAIL|not production ready/i);
assert.match(texts.claudeReview, /Verdict:\s*CONCERNS/i);
assert.match(texts.claudeReview, /Can mark native goal complete:\s*no/i);
assert.match(texts.githubWriteEvidence, /PR #5 body updated/);
assert.match(texts.githubWriteEvidence, /issues\/6/);
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
  proven("local-only-compaction-benchmark", "Local-only compaction benchmark plus metrics-only local and batch audits are covered", [
    "packages/bench/session-compaction-benchmark.mjs",
    "packages/bench/session-compaction-local-audit.mjs",
    "packages/bench/session-compaction-local-batch-audit.mjs",
    `${reviewDir}/session-compaction-local-audit-evidence.md`,
    files.sessionCompactionLocalBatchAuditEvidence,
    files.sessionCompactionLocalBatchAuditReview,
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
  proven("claude-council-review", "Claude/Opus reviewer route completed with CONCERNS and preserved launch blockers", [
    files.claudeReview,
    files.claudeBlocked,
  ]),
  proven("github-live-sync-current", "Live PR and blocker issue content match the checked-in public-safe drafts", [
    "packages/bench/github-live-sync-check.mjs",
    files.githubLiveSyncEvidence,
    files.prBodyDraft,
    files.issueDraft,
  ]),
  proven("hosted-baseline-preflight", "Hosted baseline comparison has a metrics-only preflight that keeps public claims blocked by default", [
    "packages/bench/hosted-baseline-preflight.mjs",
    files.hostedBaselinePreflightEvidence,
    files.hostedBaselinePreflightReview,
  ]),
  proven("hosted-baseline-live-discovery", "Hosted Supermemory metadata discovery is proven live with hashed candidates only", [
    "packages/bench/hosted-baseline-discovery.mjs",
    files.hostedBaselineLiveDiscoveryReport,
    files.hostedBaselineLiveDiscoveryEvidence,
    files.hostedBaselineLiveDiscoveryReview,
  ]),
  proven("hosted-baseline-live-prep", "Hosted Supermemory private-map query-set preparation is proven live with public-safe reports and distinct labeled queries", [
    "packages/bench/hosted-baseline-queryset-author.mjs",
    "packages/bench/baseline-queryset-inspect.mjs",
    files.hostedBaselineLivePrepEvidence,
    files.hostedBaselineLivePrepReview,
    files.hostedBaselineLiveQuerySetAuthorReport,
    files.hostedBaselineLiveQuerySetReport,
  ]),
  proven("baseline-source-match-preflight", "Local RecallWeave source-match preflight blocks hosted/local runs when reviewed query labels are not collectable from the selected local source", [
    "packages/bench/baseline-source-match-preflight.mjs",
    files.baselineSourceMatchPreflightEvidence,
    files.baselineSourceMatchPreflightReview,
  ]),
  proven("baseline-source-alignment", "Hosted/local baseline source alignment distinguishes matching container labels from collectable matching content before another hosted comparison run", [
    "packages/bench/baseline-source-alignment.mjs",
    files.baselineSourceAlignmentEvidence,
    files.baselineSourceAlignmentReview,
  ]),
  proven("baseline-source-gap-plan", "Hosted/local baseline source-gap planner turns public-safe source-match and source-alignment reports into a deterministic repair path before another hosted comparison run", [
    "packages/bench/baseline-source-gap-plan.mjs",
    files.baselineSourceGapPlanEvidence,
    files.baselineSourceGapPlanReview,
  ]),
  proven("hosted-baseline-live-codex-local-run", "Live hosted-vs-local Codex baseline chain is proven metrics-only but does not support public claims", [
    "packages/bench/hosted-baseline-run.mjs",
    files.hostedBaselineLiveCodexLocalRunEvidence,
    files.hostedBaselineLiveCodexLocalRunReport,
    files.hostedBaselineLiveCodexLocalRunReview,
  ]),
  proven("hosted-baseline-live-mirror-run", "Source-matched hosted mirror baseline is proven metrics-only with zero privacy leaks, but does not support public claims", [
    "packages/bench/hosted-baseline-local-mirror.mjs",
    "packages/bench/hosted-baseline-run.mjs",
    files.hostedBaselineLiveMirrorRunEvidence,
    files.hostedBaselineLiveMirrorRunReport,
    files.hostedBaselineLiveMirrorPacketReport,
    files.hostedBaselineLiveMirrorGateReview,
  ]),
  proven("hosted-baseline-live-budgeted-run", "Source-matched hosted mirror baseline is rerun with local context budget enforcement and remains metrics-only", [
    "packages/bench/hosted-baseline-run.mjs",
    "packages/bench/recallweave-response-export.mjs",
    files.hostedBaselineLiveBudgetedRunEvidence,
    files.hostedBaselineLiveBudgetedRunReport,
    files.hostedBaselineLiveBudgetedPacketReport,
  ]),
  proven("hosted-baseline-reviewer-approval-intake", "Two independent reviewers approved the source-matched budgeted hosted baseline canary target", [
    "packages/bench/baseline-openai-compatible-reviewer.mjs",
    "packages/bench/baseline-reviewer-approval-intake.mjs",
    files.budgetedBaselineReviewerFindings,
    files.budgetedBaselineReviewerIntakeEvidence,
    files.budgetedBaselineReviewerIntakeReport,
    files.budgetedBaselineCodexApproval,
    files.budgetedBaselineGeminiApproval,
    files.budgetedBaselineClaudeBlocked,
  ]),
  proven("hosted-baseline-next-run", "Hosted baseline comparison has a state-aware next-run planner that keeps public claims blocked while producing the exact next metrics-only run packet", [
    "packages/bench/hosted-baseline-next-run.mjs",
    files.hostedBaselineNextRunEvidence,
    files.hostedBaselineNextRunReview,
  ]),
  proven("baseline-returned-packet-intake", "Returned hosted-baseline evidence packets have a maintainer-facing strict-real intake gate", [
    "packages/bench/baseline-returned-packet-intake.mjs",
    files.baselineReturnedPacketIntakeEvidence,
    files.baselineReturnedPacketIntakeReview,
  ]),
  proven("canary-evidence-intake", "One-agent runtime canary reports have a metrics-only, sanitized intake gate that does not count fixtures as real rollout evidence", [
    "packages/bench/canary-evidence-intake.mjs",
    files.canaryEvidenceIntakeEvidence,
    files.canaryEvidenceIntakeReview,
  ]),
  proven("canary-report-generator", "Hermes and OpenClaw trace logs can be converted into sanitized metrics-only canary reports without raw content", [
    "packages/bench/canary-report-from-trace.mjs",
    files.canaryReportGeneratorEvidence,
    files.canaryReportGeneratorReview,
  ]),
  proven("canary-diagnostic-bundle-report", "Redacted diagnostic directories and zip bundles can be converted into sanitized metrics-only canary reports while relocated fixtures remain fixture-only", [
    "packages/bench/canary-report-from-trace.mjs",
    "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary_metadata/trace_metadata_only.jsonl",
    files.canaryReportGeneratorEvidence,
    files.canaryReportGeneratorReview,
  ]),
  proven("canary-remediation-plan", "Failed canary reports can be converted into sanitized metrics-only remediation guidance without raw content", [
    "packages/bench/canary-remediation.mjs",
    "packages/bench/fixtures/canary-runtime-report-failing.fixture.json",
    files.canaryRemediationEvidence,
    files.canaryRemediationReview,
  ]),
  proven("canary-strict-real-drill", "One-agent canaries have a deterministic public-safe drill for local write, recall, read-through, lifecycle, rollback, and strict-real packet collection", [
    "packages/bench/canary-drill.mjs",
    files.canaryDrillEvidence,
    files.canaryDrillReview,
  ]),
  proven("canary-returned-packet-intake", "Returned one-agent canary evidence packets have a maintainer-facing strict-real intake gate", [
    "packages/bench/canary-returned-packet-intake.mjs",
    files.canaryReturnedPacketIntakeEvidence,
    files.canaryReturnedPacketIntakeReview,
  ]),
  proven("canary-returned-inbox", "Returned one-agent canary evidence can be scanned from a mixed inbox while handoff packets and diagnostic bundles stay blocked from production evidence", [
    "packages/bench/canary-returned-inbox.mjs",
    files.canaryReturnedInboxEvidence,
    files.canaryReturnedInboxReview,
  ]),
  proven("canary-next-agent-plan", "Returned diagnostic batches can be converted into a single metrics-only one-agent fresh-window update plan", [
    "packages/bench/canary-next-agent-plan.mjs",
    files.canaryNextAgentPlanEvidence,
    files.canaryNextAgentPlanReview,
  ]),
  proven("adapter-bounded-read-through", "Hermes and OpenClaw adapters bound hosted read-through and trace local, remote, and total recall latency for fresh canaries", [
    "packages/adapters/hermes/selfmem_canary/__init__.py",
    "packages/adapters/openclaw/selfmem_canary/index.mjs",
    files.adapterBoundedReadThroughEvidence,
  ]),
  proven("github-pr-body-current", "PR body is current on GitHub", [
    files.prBodyDraft,
    files.githubWriteEvidence,
  ]),
  proven("github-blocker-issue-created", "External blocker issue exists on GitHub", [
    files.issueDraft,
    files.githubWriteEvidence,
  ]),
  blocked("human-public-launch-approval", "Human approval is required before merge, visibility change, or public live update", [
    files.releaseState,
    "docs/PUBLIC_RELEASE_CHECKLIST.md",
  ]),
  proven("hosted-baseline-reviewed-comparison", "Hosted canary comparison was rerun with reviewer approvals, packet review passed, and the next-run planner reached owner-review state without authorizing launch", [
    files.hostedBaselineLiveBudgetedRunEvidence,
    files.hostedBaselineLiveBudgetedRunReport,
    files.hostedBaselineLiveBudgetedPacketReport,
    files.budgetedBaselineReviewerIntakeReport,
    files.budgetedBaselineReviewedComparison,
    files.budgetedBaselineReviewedPacketReview,
    files.budgetedBaselineReviewedReturnedPacketIntake,
    files.budgetedBaselineReviewedNextRun,
    "packages/bench/baseline-openai-compatible-reviewer.mjs",
    "packages/bench/baseline-reviewer-approval-intake.mjs",
    "packages/bench/baseline-comparison.mjs",
    "packages/bench/baseline-evidence-packet.mjs",
    "packages/bench/baseline-evidence-packet-review.mjs",
    "docs/AUTORESEARCH_BENCHMARK_PLAN.md",
  ]),
  incomplete("full-memory-sota-benchmark-gate", "Full same-data memory benchmark/SOTA gate remains incomplete until end-to-end answer quality, live query expansion, local reranker, provider challengers, reviewers, UI, docs, and owner approval all pass", [
    files.benchmarkSotaReadiness,
    files.benchmarkSotaLadderReport,
    files.benchmarkSotaLadderMarkdown,
    files.benchmarkSotaOperatorPacket,
    files.benchmarkSotaOperatorMarkdown,
    files.queryExpansionPreflightReport,
    files.queryExpansionPreflightMarkdown,
    files.queryExpansionLiveLocalSmokeReport,
    files.queryExpansionLiveLocalSmokeMarkdown,
    files.queryExpansionResultGateReport,
    files.queryExpansionResultGateMarkdown,
    files.localRerankResultGateReport,
    files.localRerankResultGateMarkdown,
    files.providerChallengerResultGateReport,
    files.providerChallengerResultGateMarkdown,
    files.endToEndMemoryScoreGateReport,
    files.endToEndMemoryScoreGateMarkdown,
    files.answerQualityHarnessSmokeReport,
    files.answerQualityHarnessSmokeMarkdown,
    "packages/bench/public-benchmark-sota-ladder.mjs",
    "packages/bench/public-benchmark-sota-operator-packet.mjs",
    "packages/bench/public-benchmark-answer-quality.mjs",
    "packages/bench/public-benchmark-query-expansion-preflight.mjs",
    "packages/bench/query-expansion-result-gate.mjs",
    "packages/bench/local-rerank-result-gate.mjs",
    "packages/bench/provider-challenger-result-gate.mjs",
    "packages/bench/end-to-end-memory-score-gate.mjs",
    "packages/bench/recallweave-response-export.mjs",
  ]),
  incomplete("real-container-production-rollout", "One-agent real runtime rollout remains a canary step, not a completed production rollout", [
    `${reviewDir}/brain-ui-canary-rollout-evidence.md`,
    files.realCanaryDiagnosticEvidence,
    `${reviewDir}/returned-downloads-current-scan.md`,
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
assert.ok(blockedRequirements.length >= 1, "goal completion audit must preserve remaining blockers");
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
  reason: "The core preview work and source-matched hosted mirror baseline are evidenced, including a fresh budgeted-context rerun, two independent reviewer approvals, and a reviewed comparison packet. Human approval, full-memory SOTA benchmark evidence, and real rollout requirements remain unresolved.",
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
