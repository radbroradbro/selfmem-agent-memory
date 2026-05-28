import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = args.reviewDir ?? "reviews/overnight-20260522";
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const files = {
  fullTarget: `${reviewDir}/public-longmemeval-full-run-target.json`,
  fullMaterialize: `${reviewDir}/public-longmemeval-full-materialize-run.json`,
  shardPlan: `${reviewDir}/answer-quality-full-shard-plan-20260525.json`,
  localFullShardPlan: `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`,
  localFullShardWorkorder: `${reviewDir}/answer-quality-local-full-shard-workorder-20260526.json`,
  localFullShardIntake: `${reviewDir}/answer-quality-local-full-shard-intake-20260526.json`,
  localFullShardIntakeAfterShard009: preferReviewFile(
    "answer-quality-local-full-shard-intake-after-shard-009-common-arm-20260528.json",
    "answer-quality-local-full-shard-intake-after-shard-009-20260528.json",
  ),
  localFullShardIntakeAfterShard008: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-008-20260527.json`,
  localFullShardIntakeAfterShard007: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-007-20260527.json`,
  localFullShardIntakeAfterShard006: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-006-20260527.json`,
  localFullShardIntakeAfterShard005: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-005-common-arm-20260527.json`,
  localFullShardIntakeAfterShard004: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-004-20260527.json`,
  localFullShardIntakeAfterShard003: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-003-20260527.json`,
  localFullShardIntakeLatest: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526.json`,
  localFullShardIntakeAfterShard001: `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-001-20260526.json`,
  localFullPerformanceReport: preferReviewFile(
    "local-full-shard-performance-report-after-shard-009-common-arm-20260528.json",
    "local-full-shard-performance-report-after-shard-009-20260528.json",
    "local-full-shard-performance-report-20260527.json",
    "local-full-shard-performance-report-20260526.json",
  ),
  localFullResumeEnvDoctor: preferReviewFile(
    "local-full-shard-003-resume-env-doctor-20260527.json",
    "local-full-shard-002-resume-env-doctor-20260526.json",
  ),
  localFullResumeCommandSecurity: `${reviewDir}/local-full-shard-003-resume-command-security-20260526.json`,
  localFullResumeResultDoctor: `${reviewDir}/local-full-shard-002-resume-result-doctor-20260526.json`,
  localFullShard002RuntimeBlocker: `${reviewDir}/answer-quality-local-full-shard-002-runtime-blocker-20260526.json`,
  localFullShard003RuntimeBlocker: `${reviewDir}/answer-quality-local-full-shard-003-runtime-blocker-20260526.json`,
  localEmbeddingRuntimeDoctor: preferReviewFile(
    "local-embedding-runtime-doctor-20260527.json",
    "local-embedding-runtime-doctor-20260526.json",
  ),
  localEmbeddingDurabilitySmoke: preferReviewFile(
    "local-embedding-durability-smoke-20260527.json",
    "local-embedding-durability-smoke-20260526.json",
  ),
  localFullAcceptedLaneLaunchDoctor: `${reviewDir}/local-full-accepted-lane-launch-doctor-20260526.json`,
  privateInputDoctor: `${reviewDir}/full-shard-private-input-doctor-current.json`,
  acceptedLaneLaunchDoctor: `${reviewDir}/full-shard-accepted-lane-launch-doctor-20260526.json`,
  controlPreflight: `${reviewDir}/full-shard-control-answer-quality-preflight-20260526.json`,
  shardWorkorder: `${reviewDir}/answer-quality-full-shard-workorder-20260525.json`,
  shardIntake: `${reviewDir}/answer-quality-full-shard-intake-20260525.json`,
  sotaLadder: `${reviewDir}/sota-ladder-full-target-report-20260525.json`,
  sotaOperatorPacket: `${reviewDir}/sota-ladder-full-target-operator-packet-20260525.json`,
  endToEndGate: `${reviewDir}/end-to-end-memory-score-gate-20260525.json`,
  combinedCanary: `${reviewDir}/end-to-end-memory-score-combined-20260525.json`,
  liveLocalCanary: `${reviewDir}/end-to-end-memory-score-live-local-20260525.json`,
  liveProviderCanary: `${reviewDir}/end-to-end-memory-score-live-provider-20260525.json`,
  voyageRateLimit: `${reviewDir}/voyage-provider-rate-limit-20260525.json`,
  reviewerIntake: `${reviewDir}/memory-score-reviewer-intake-20260525.json`,
  uiEvidence: `${reviewDir}/ui-evidence/brain-ui-current-head-live-evidence.json`,
  releaseNotes: `${reviewDir}/pr-body-update-draft.md`,
  benchmarkDocs: "docs/BENCHMARK_SUMMARY.md",
  targetDocs: "docs/PUBLIC_BENCHMARK_TARGETS.md",
  releaseHandoff: "docs/RELEASE_HANDOFF.md",
};

const evidence = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, loadFile(file)]));
const goalAudit = runJson(["packages/bench/goal-completion-audit.mjs"]);

const fullTarget = evidence.fullTarget.json;
const fullMaterialize = evidence.fullMaterialize.json;
const shardPlan = evidence.shardPlan.json;
const localFullShardPlan = evidence.localFullShardPlan.json;
const localFullShardWorkorder = evidence.localFullShardWorkorder.json;
const localFullShardIntakeSelection = selectPreferredLocalFullShardIntake([
  evidence.localFullShardIntake,
  evidence.localFullShardIntakeAfterShard009,
  evidence.localFullShardIntakeAfterShard008,
  evidence.localFullShardIntakeAfterShard007,
  evidence.localFullShardIntakeAfterShard006,
  evidence.localFullShardIntakeAfterShard005,
  evidence.localFullShardIntakeAfterShard004,
  evidence.localFullShardIntakeAfterShard003,
  evidence.localFullShardIntakeLatest,
  evidence.localFullShardIntakeAfterShard001,
]);
const localFullShardIntake = localFullShardIntakeSelection.json;
const localFullPerformanceReport = evidence.localFullPerformanceReport.json;
const localFullResumeEnvDoctor = evidence.localFullResumeEnvDoctor.json;
const localFullResumeCommandSecurity = evidence.localFullResumeCommandSecurity.json;
const localFullResumeResultDoctor = evidence.localFullResumeResultDoctor.json;
const localFullShard002RuntimeBlocker = evidence.localFullShard002RuntimeBlocker.json;
const localFullShard003RuntimeBlocker = evidence.localFullShard003RuntimeBlocker.json;
const localEmbeddingRuntimeDoctor = evidence.localEmbeddingRuntimeDoctor.json;
const localEmbeddingDurabilitySmoke = evidence.localEmbeddingDurabilitySmoke.json;
const localFullAcceptedLaneLaunchDoctor = evidence.localFullAcceptedLaneLaunchDoctor.json;
const privateInputDoctor = evidence.privateInputDoctor.json;
const acceptedLaneLaunchDoctor = evidence.acceptedLaneLaunchDoctor.json;
const controlPreflight = evidence.controlPreflight.json;
const shardWorkorder = evidence.shardWorkorder.json;
const shardIntake = evidence.shardIntake.json;
const sotaLadder = evidence.sotaLadder.json;
const sotaOperatorPacket = evidence.sotaOperatorPacket.json;
const endToEndGate = evidence.endToEndGate.json;
const combinedCanary = evidence.combinedCanary.json;
const voyageRateLimit = evidence.voyageRateLimit.json;
const reviewerIntake = evidence.reviewerIntake.json;
const uiEvidence = evidence.uiEvidence.json;

const rawRetention = inspectRawSourceRetention(fullMaterialize);
const controlPreflightState = inspectControlPreflightState(controlPreflight);
const shardState = inspectShardState({ shardPlan, shardWorkorder, shardIntake });
const localFullLaneState = inspectLocalFullLaneState({
  localFullShardPlan,
  localFullShardWorkorder,
  localFullShardIntake,
  localFullShardIntakePath: localFullShardIntakeSelection.path,
  localFullPerformanceReport,
  localFullResumeEnvDoctor,
  localFullResumeCommandSecurity,
  localFullResumeResultDoctor,
  localFullShardRuntimeBlockers: [localFullShard002RuntimeBlocker, localFullShard003RuntimeBlocker],
  localEmbeddingRuntimeDoctor,
  localEmbeddingDurabilitySmoke,
  localFullAcceptedLaneLaunchDoctor,
});
const currentCanary = inspectCurrentCanary({ combinedCanary, endToEndGate, reviewerIntake, voyageRateLimit });
const reviewerState = inspectReviewerState(reviewerIntake);
const docState = inspectDocs(evidence);

const gates = [
  gate("source-locked-full-target", fullTarget?.fixtureOnly === false && Number(fullMaterialize?.selection?.queryCount ?? 0) === 500, [
    "missing-or-non-live-full-target",
    "full-target-query-count-not-500",
  ]),
  gate("raw-source-retention", rawRetention.retainsRawSourcesPrivately && rawRetention.publicReportIsSafe, [
    "raw-sources-not-retained-privately",
    "raw-source-public-report-not-safe",
  ]),
  gate("full-shard-private-inputs", privateInputDoctor?.readyForAnswerQualityShardRun === true, privateInputDoctor?.blockers ?? [
    "full-shard-private-input-doctor-not-ready",
  ]),
  gate("accepted-sota-lane-launch-readiness", acceptedLaneLaunchDoctor?.launchGate?.readyForFirstAcceptedShardRun === true, acceptedLaneLaunchDoctor?.blockers ?? [
    "accepted-sota-lane-launch-doctor-not-ready",
  ]),
  gate("full-shard-control-preflight", controlPreflightState.sameDataShardReady, controlPreflightState.blockers),
  gate("bm25-is-control-only", sotaOperatorPacket?.sameDataContract?.bm25LexicalFloorRequired === true, [
    "bm25-control-contract-missing",
  ]),
  gate("local-full-benchmark-lane", localFullLaneState.readyForLocalFullBenchmarkPlan, localFullLaneState.blockers),
  gate("local-full-launch-readiness", localFullLaneState.readyForFirstShardRun, localFullLaneState.launchBlockers),
  gate("local-embedding-runtime", localFullLaneState.localEmbeddingRuntimeReady, localFullLaneState.localEmbeddingRuntimeBlockers),
  gate("local-embedding-durability", localFullLaneState.localEmbeddingDurabilityReady, localFullLaneState.localEmbeddingDurabilityBlockers),
  gate("local-full-shard-intake", localFullLaneState.readyForShardCombine, localFullLaneState.shardIntakeBlockers),
  gate(
    "local-full-performance-snapshot",
    localFullLaneState.performanceReport.evidenceReady,
    localFullLaneState.performanceReport.evidenceBlockers,
  ),
  gate(
    "local-full-resume-env",
    localFullLaneState.resumeEnv.evidenceReady,
    localFullLaneState.resumeEnv.evidenceBlockers,
  ),
  gate(
    "local-full-resume-command-security",
    localFullLaneState.resumeCommandSecurity.evidenceReady,
    localFullLaneState.resumeCommandSecurity.evidenceBlockers,
  ),
  gate(
    "local-full-resume-result",
    localFullLaneState.resumeResult.evidenceGateReady,
    localFullLaneState.resumeResult.evidenceBlockers,
  ),
  gate("full-shard-results", shardState.readyForShardCombine, shardState.blockers),
  gate("same-data-provider-arms", !arrayOf(sotaLadder?.blockers).includes("missing-voyage-answer-quality-same-data-result"), [
    "missing-voyage-answer-quality-same-data-result",
  ]),
  gate("full-score-result-gate", endToEndGate?.countsAsFullMemorySotaEvidence === true, endToEndGate?.fullSotaBlockers ?? endToEndGate?.blockers ?? []),
  gate("reported-target-beaten", sotaLadder?.reportedTargetComparison?.meetsPrimaryReportedTarget === true, [
    "best-end-to-end-score-below-reported-supermemory-target",
  ]),
  gate("independent-reviewers", reviewerState.ready, reviewerState.blockers),
  gate("ui-docs-release-refresh", docState.readyAfterBenchmarkResult, docState.blockers),
  gate("owner-and-real-canary", goalAudit.goalComplete === true, [
    ...goalAudit.requirements?.filter((item) => item.status !== "proven").map((item) => item.id) ?? [],
  ]),
];

const blockers = [
  ...new Set([
    ...gates.flatMap((item) => (item.status === "pass" ? [] : item.blockers)),
    ...arrayOf(sotaOperatorPacket?.blockers),
  ]),
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "full-memory-sota-doctor",
  status: blockers.length === 0 ? "READY_FOR_REVIEWED_FULL_MEMORY_SOTA_CLAIM" : "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE",
  generatedAt: new Date().toISOString(),
  reviewDir,
  metricsOnly: true,
  publicSafe: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  publicBenchmarkClaimsAllowed: blockers.length === 0,
  countsAsFullMemorySotaEvidence: blockers.length === 0,
  benchmarkContract: {
    bm25IsLexicalFloorOnly: true,
    retrievalProxyOnlyIsNotEnough: true,
    componentBenchmarksAreModelSelectionOnly: true,
    benchmarkHarnessSourceOnlyIsNotAScore: true,
    fullMemoryAnswerQualityRequired: true,
    sameDataExternalTargetRequired: true,
    sameAnswerAndJudgeModelRequired: true,
    reviewerApprovalRequired: true,
    uiDocsOwnerAndRealCanaryStillRequired: true,
  },
  evidenceFiles: summarizeEvidence(evidence),
  goalAudit: {
    mode: goalAudit.mode,
    goalComplete: goalAudit.goalComplete,
    mayCallUpdateGoalComplete: goalAudit.mayCallUpdateGoalComplete,
    counts: goalAudit.counts,
    openRequirements: goalAudit.requirements?.filter((item) => item.status !== "proven").map((item) => ({
      id: item.id,
      status: item.status,
      requirement: item.requirement,
    })),
  },
  fullTarget: {
    path: files.fullTarget,
    hash: evidence.fullTarget.hash,
    fixtureOnly: fullTarget?.fixtureOnly ?? null,
    claimTier: fullTarget?.claimTier ?? null,
    benchmarkFamily: fullTarget?.benchmark?.family ?? fullTarget?.benchmark?.name ?? null,
    split: fullTarget?.benchmark?.split ?? null,
    answerModel: fullTarget?.answerModel ?? fullTarget?.target?.answerModel ?? fullMaterialize?.target?.answerModel ?? null,
    judgeModel: fullTarget?.judgeModel ?? fullTarget?.target?.judgeModel ?? fullMaterialize?.target?.judgeModel ?? null,
    queryCount: Number(fullMaterialize?.selection?.queryCount ?? shardPlan?.runPlan?.queryCount ?? 0),
    haystackSessionCount: Number(fullMaterialize?.selection?.haystackSessionCount ?? 0),
    expectedReferenceCount: Number(fullMaterialize?.selection?.expectedResultRefCount ?? 0),
  },
  reportedTargets: inspectReportedTargets(sotaLadder),
  rawSourceRetention: rawRetention,
  privateInputState: inspectPrivateInputState(privateInputDoctor),
  acceptedLaneLaunchState: inspectAcceptedLaneLaunchState(acceptedLaneLaunchDoctor),
  controlPreflightState,
  shardState,
  localFullLaneState,
  currentCanary,
  reviewerState,
  docState,
  gates,
  blockers,
  nextRunPlan: buildNextRunPlan({ shardPlan, sotaOperatorPacket }),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "full memory SOTA doctor report");
assertSafePublicText(markdownText, "full memory SOTA doctor markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inspectRawSourceRetention(materializeReport) {
  const retention = materializeReport?.sourceRetention ?? {};
  const privateFiles = materializeReport?.privateOutputs?.files ?? [];
  const roles = privateFiles.map((item) => ({
    role: item.role,
    name: item.name,
    hash: item.hash,
    rawTextPrivate: Boolean(item.rawTextPrivate),
  }));
  const requiredRoles = ["queryset", "memories", "answer-labels", "raw-dataset", "selected-raw-rows", "source-manifest"];
  const presentRoles = new Set(roles.map((item) => item.role));
  const missingRoles = requiredRoles.filter((role) => !presentRoles.has(role));
  return {
    retainsRawSourcesPrivately:
      retention.rawDatasetRetainedPrivate === true &&
      retention.selectedRawRowsRetainedPrivate === true &&
      retention.sourceManifestRetainedPrivate === true &&
      missingRoles.length === 0,
    publicReportIsSafe:
      materializeReport?.rawQuestionsIncluded === false &&
      materializeReport?.rawAnswersIncluded === false &&
      materializeReport?.rawMemoryIncluded === false &&
      materializeReport?.rawPrivateOutputPathIncluded === false &&
      retention.rawTextPubliclyIncluded === false &&
      retention.privateOutputPathIncluded === false,
    privateOutputDirectoryLabel: materializeReport?.privateOutputs?.directoryLabel ?? null,
    directoryInsideRepository: Boolean(materializeReport?.privateOutputs?.directoryInsideRepository),
    requiredRoles,
    missingRoles,
    roles,
    rawDatasetItemCount: Number(retention.rawDatasetItemCount ?? 0),
    selectedRawRowsCount: Number(retention.selectedRawRowsCount ?? 0),
    rawDatasetHash: retention.rawDatasetHash ?? null,
    selectedRawRowsHash: retention.selectedRawRowsHash ?? null,
    sourceManifestHash: retention.sourceManifestHash ?? null,
    uiMayUseCompressedDefaultButAuditRetainsRawSource: true,
  };
}

function inspectReportedTargets(sotaLadderReport) {
  return {
    sourceEvidenceCheckedAt: sotaLadderReport?.reportedTargetsEvidence?.sourceEvidenceCheckedAt ?? null,
    status: sotaLadderReport?.reportedTargetsEvidence?.status ?? null,
    primaryReportedMemoryTarget: sotaLadderReport?.reportedTargetsEvidence?.primaryReportedMemoryTarget ?? null,
    memoryTargetCount: Number(sotaLadderReport?.reportedTargetsEvidence?.memoryTargetCount ?? 0),
    componentTargetCount: Number(sotaLadderReport?.reportedTargetsEvidence?.componentTargetCount ?? 0),
    benchmarkHarnessTargetCount: Number(sotaLadderReport?.reportedTargetsEvidence?.benchmarkHarnessTargetCount ?? 0),
    componentBenchmarksAreModelSelectionOnly: Boolean(sotaLadderReport?.componentBenchmarksAreModelSelectionOnly),
    benchmarkHarnessTargetsSourceLocked: Boolean(sotaLadderReport?.checks?.benchmarkHarnessTargetsSourceLocked),
    benchmarkHarnessEvidence: arrayOf(sotaLadderReport?.benchmarkHarnessEvidence).map((target) => ({
      id: target.id,
      harnessName: target.harnessName,
      claimUse: target.claimUse,
      benchmarkFamilies: target.benchmarkFamilies ?? [],
      supportedProviders: target.supportedProviders ?? [],
    })),
  };
}

function inspectShardState({ shardPlan, shardWorkorder, shardIntake }) {
  const executionLaneReadiness = arrayOf(shardWorkorder?.executionLaneReadiness);
  const fullSotaLane = executionLaneReadiness.find((lane) => lane.laneId === "full-sota-accepted-shards");
  return {
    planStatus: shardPlan?.status ?? null,
    workorderStatus: shardWorkorder?.status ?? null,
    intakeStatus: shardIntake?.status ?? null,
    queryCount: Number(shardPlan?.runPlan?.queryCount ?? 0),
    shardSize: Number(shardPlan?.runPlan?.shardSize ?? 0),
    shardCount: Number(shardPlan?.runPlan?.shardCount ?? 0),
    strategies: shardPlan?.runPlan?.strategies ?? [],
    acceptedShardCount: Number(shardIntake?.intake?.acceptedShardCount ?? shardWorkorder?.progress?.acceptedShardCount ?? 0),
    missingShardCount: Number(shardIntake?.intake?.missingShardCount ?? shardWorkorder?.progress?.pendingShardCount ?? 0),
    rejectedShardCount: Number(shardIntake?.intake?.rejectedShardCount ?? shardWorkorder?.progress?.rejectedResultCount ?? 0),
    duplicateShardCount: Number(shardIntake?.intake?.duplicateShardCount ?? shardWorkorder?.progress?.duplicateResultCount ?? 0),
    completeCoverage: Boolean(shardIntake?.intake?.completeCoverage),
    readyForShardCombine: Boolean(shardIntake?.readyForShardCombine),
    executionLaneReadiness: executionLaneReadiness.map((lane) => ({
      laneId: lane.laneId,
      acceptedByFullShardIntake: Boolean(lane.acceptedByFullShardIntake),
      readyForResponseArmExport: Boolean(lane.readyForResponseArmExport),
      readyForAnswerQualityScoring: Boolean(lane.readyForAnswerQualityScoring),
      blockerCount: Number(lane.blockers?.length ?? 0),
    })),
    fullSotaLaneReadyForResponseArmExport: Boolean(fullSotaLane?.readyForResponseArmExport),
    fullSotaLaneReadyForAnswerQualityScoring: Boolean(fullSotaLane?.readyForAnswerQualityScoring),
    fullSotaLaneEnvironmentBlockers: fullSotaLane?.blockers ?? [],
    blockers: [
      ...arrayOf(shardWorkorder?.blockers),
      ...arrayOf(shardIntake?.blockers),
      ...arrayOf(fullSotaLane?.blockers),
    ],
  };
}

function inspectLocalFullLaneState({
  localFullShardPlan,
  localFullShardWorkorder,
  localFullShardIntake,
  localFullShardIntakePath,
  localFullPerformanceReport,
  localFullResumeEnvDoctor,
  localFullResumeCommandSecurity,
  localFullResumeResultDoctor,
  localFullShardRuntimeBlockers,
  localEmbeddingRuntimeDoctor,
  localEmbeddingDurabilitySmoke,
  localFullAcceptedLaneLaunchDoctor,
}) {
  const acceptedLane = arrayOf(localFullShardWorkorder?.executionLaneReadiness).find((lane) => lane.acceptedByFullShardIntake === true);
  const envBlockers = arrayOf(localFullShardWorkorder?.acceptedLaneEnvironmentBlockers ?? acceptedLane?.blockers);
  const runtimeBlockerReports = arrayOf(localFullShardRuntimeBlockers).filter(Boolean);
  const acceptedShardIds = new Set(arrayOf(localFullShardIntake?.acceptedShards).map((shard) => String(shard?.shardId ?? "")));
  const performanceReportState = inspectLocalFullPerformanceReport(localFullPerformanceReport, {
    localFullShardPlan,
    localFullShardIntake,
    localFullAcceptedLaneLaunchDoctor,
  });
  const nextPendingShardId =
    performanceReportState.nextPendingShardId ?? localFullAcceptedLaneLaunchDoctor?.shardProgress?.firstPendingShardId ?? null;
  const nextPendingShardRange =
    performanceReportState.nextPendingShardRange ?? localFullAcceptedLaneLaunchDoctor?.shardProgress?.firstPendingShardRange ?? null;
  const recoveredRuntimeShardIds = new Set(
    performanceReportState.runtimeRecoveryRetrievalRecovered && performanceReportState.runtimeRecoveryShardId
      ? [performanceReportState.runtimeRecoveryShardId]
      : [],
  );
  const recoveredRuntimeBlockerReports = runtimeBlockerReports.filter((report) => {
    const shardId = String(report?.queryShard?.shardId ?? "");
    return acceptedShardIds.has(shardId) || recoveredRuntimeShardIds.has(shardId);
  });
  const activeRuntimeBlockerReports = runtimeBlockerReports.filter((report) => {
    const shardId = String(report?.queryShard?.shardId ?? "");
    return !acceptedShardIds.has(shardId) && !recoveredRuntimeShardIds.has(shardId);
  });
  const activeRuntimeBlockerIds = [...new Set(activeRuntimeBlockerReports.flatMap((report) => arrayOf(report?.blockers)))];
  const historicalNextPendingShardResumeMissingStrategies =
    localFullShardWorkorder?.workorders?.[0]?.runtimeResume?.missingStrategies ?? [];
  const nextPendingShardResumeMissingStrategies =
    performanceReportState.runtimeRecoveryRetrievalRecovered === true ||
    performanceReportState.runtimeRecoveryShardId !== nextPendingShardId
      ? []
      : historicalNextPendingShardResumeMissingStrategies;
  const localEmbeddingRuntimeReady =
    localEmbeddingRuntimeDoctor?.mode === "local-embedding-runtime-doctor" &&
    localEmbeddingRuntimeDoctor?.status === "READY_LOCAL_EMBEDDING_RUNTIME" &&
    localEmbeddingRuntimeDoctor?.readyForLocalEmbeddingDurabilitySmoke === true &&
    localEmbeddingRuntimeDoctor?.readyForLocalAppleArmExport === true &&
    localEmbeddingRuntimeDoctor?.privatePathPrinted === false &&
    localEmbeddingRuntimeDoctor?.endpointPrinted === false &&
    localEmbeddingRuntimeDoctor?.rawConfigIncluded === false;
  const localEmbeddingRuntimeBlockers = localEmbeddingRuntimeReady
    ? []
    : [...new Set(["local-embedding-runtime-not-ready", ...arrayOf(localEmbeddingRuntimeDoctor?.blockers)])];
  const localEmbeddingDurabilityReady =
    localEmbeddingDurabilitySmoke?.mode === "local-embedding-durability-smoke" &&
    localEmbeddingDurabilitySmoke?.status === "READY_LOCAL_EMBEDDING_DURABILITY" &&
    localEmbeddingDurabilitySmoke?.readyForLocalAppleArmExport === true &&
    localEmbeddingDurabilitySmoke?.rawSyntheticInputIncluded === false &&
    localEmbeddingDurabilitySmoke?.baseUrlPrinted === false &&
    localEmbeddingDurabilitySmoke?.endpointPrinted === false;
  const localEmbeddingDurabilityBlockers = localEmbeddingDurabilityReady
    ? []
    : [...new Set(["local-embedding-durability-smoke-not-ready", ...arrayOf(localEmbeddingDurabilitySmoke?.blockers)])];
  const cloudProviderBlockers = envBlockers.filter((item) =>
    ["voyage-credentials-missing", "nvidia-credentials-missing", "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled", "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed"].includes(item),
  );
  const blockers = [
    localFullShardPlan?.claimScope !== "local-full" ? "local-full-claim-scope-missing" : null,
    localFullShardPlan?.readyForAnswerQualityShardRun !== true ? "local-full-shard-plan-not-ready" : null,
    acceptedLane?.laneId !== "local-full-accepted-shards" ? "local-full-accepted-lane-missing" : null,
    acceptedLane?.canReachFullSotaGateAfterShardIntake !== false ? "local-full-lane-should-not-claim-sota" : null,
    cloudProviderBlockers.length > 0 ? "local-full-lane-has-cloud-provider-blockers" : null,
  ].filter(Boolean);
  const resumeResult = inspectLocalFullResumeResultDoctor(localFullResumeResultDoctor);
  const resumeResultGateSatisfied = resumeResult.evidenceReady || acceptedShardIds.has("shard-002");
  const resumeResultEvidenceBlockers = resumeResultGateSatisfied
    ? []
    : resumeResult.evidenceBlockers;
  return {
    planPath: files.localFullShardPlan,
    workorderPath: files.localFullShardWorkorder,
    intakePath: localFullShardIntakePath ?? files.localFullShardIntake,
    status: blockers.length === 0 ? "READY_LOCAL_FULL_BENCHMARK_PLAN" : "BLOCKED_LOCAL_FULL_BENCHMARK_PLAN",
    readyForLocalFullBenchmarkPlan: blockers.length === 0,
    readyForResponseArmExport: Boolean(localFullShardWorkorder?.acceptedLaneReadyForResponseArmExport),
    readyForAnswerQualityScoring: Boolean(localFullShardWorkorder?.acceptedLaneReadyForAnswerQualityScoring),
    intakeStatus: localFullShardIntake?.status ?? null,
    readyForShardCombine: Boolean(localFullShardIntake?.readyForShardCombine),
    acceptedShardCount: Number(localFullShardIntake?.intake?.acceptedShardCount ?? 0),
    acceptedShardIds: [...acceptedShardIds].filter(Boolean).sort(),
    missingShardCount: Number(localFullShardIntake?.intake?.missingShardCount ?? 0),
    launchDoctorStatus: localFullAcceptedLaneLaunchDoctor?.status ?? null,
    readyForFirstShardRun: localFullAcceptedLaneLaunchDoctor?.launchGate?.readyForFirstAcceptedShardRun === true,
    readyForLocalFullBenchmarkResult: localFullAcceptedLaneLaunchDoctor?.launchGate?.readyForLocalFullBenchmarkResult === true,
    claimScope: localFullShardPlan?.claimScope ?? null,
    queryCount: Number(localFullShardPlan?.runPlan?.queryCount ?? 0),
    shardCount: Number(localFullShardPlan?.runPlan?.shardCount ?? 0),
    strategies: localFullShardPlan?.runPlan?.strategies ?? [],
    acceptedLaneId: acceptedLane?.laneId ?? null,
    canReachFullSotaGateAfterShardIntake: Boolean(acceptedLane?.canReachFullSotaGateAfterShardIntake),
    cloudProviderBlockerCount: cloudProviderBlockers.length,
    runtimeBlockedShardCount: activeRuntimeBlockerReports.length,
    historicalRuntimeBlockedShardCount: runtimeBlockerReports.length,
    recoveredRuntimeBlockedShardCount: recoveredRuntimeBlockerReports.length,
    latestRuntimeBlockedShard: activeRuntimeBlockerReports.at(-1)?.queryShard?.shardId ?? null,
    latestRuntimeBlockedArm: activeRuntimeBlockerReports.at(-1)?.failedArm?.strategy ?? null,
    runtimeRecoveryStatus: performanceReportState.runtimeRecoveryStatus,
    runtimeRecoveryRetrievalRecovered: performanceReportState.runtimeRecoveryRetrievalRecovered,
    runtimeRecoveryAnswerQualityEnvReady: performanceReportState.runtimeRecoveryAnswerQualityEnvReady,
    runtimeRecoveryBlockers: performanceReportState.runtimeRecoveryBlockers,
    runtimeBlockerWorkorderInputCount: Number(localFullShardWorkorder?.runtimeBlockers?.inputCount ?? 0),
    runtimeBlockerResumeAvailableCount: Number(localFullShardWorkorder?.runtimeBlockers?.resumeAvailableCount ?? 0),
    nextPendingShardResumeMissingStrategies,
    historicalNextPendingShardResumeMissingStrategies,
    launchProgressSource: localFullAcceptedLaneLaunchDoctor?.shardProgress?.progressSource ?? null,
    launchProgressInputCount: Number(localFullAcceptedLaneLaunchDoctor?.shardProgress?.progressInputCount ?? 0),
    launchAcceptedShardCount: Number(localFullAcceptedLaneLaunchDoctor?.shardProgress?.acceptedShardCount ?? 0),
    launchPendingShardCount: Number(localFullAcceptedLaneLaunchDoctor?.shardProgress?.pendingShardCount ?? 0),
    performanceReport: performanceReportState,
    resumeEnv: inspectLocalFullResumeEnvDoctor(localFullResumeEnvDoctor),
    resumeCommandSecurity: inspectLocalFullResumeCommandSecurity(localFullResumeCommandSecurity),
    resumeResult: {
      ...resumeResult,
      gateSatisfiedByAcceptedShardIntake: acceptedShardIds.has("shard-002"),
      evidenceGateReady: resumeResultGateSatisfied,
      evidenceBlockers: resumeResultEvidenceBlockers,
    },
    nextPendingShardId,
    nextPendingShardRange,
    localEmbeddingRuntimeStatus: localEmbeddingRuntimeDoctor?.status ?? null,
    localEmbeddingRuntimeReady,
    localEmbeddingRuntimeBlockers,
    localEmbeddingRuntimeModelLooksDedicated: Boolean(localEmbeddingRuntimeDoctor?.modelArtifact?.likelyDedicatedEmbedding),
    localEmbeddingRuntimeEndpointReachable: Boolean(localEmbeddingRuntimeDoctor?.localEndpoint?.modelsEndpointReachable),
    localEmbeddingDurabilityStatus: localEmbeddingDurabilitySmoke?.status ?? null,
    localEmbeddingDurabilityReady,
    localEmbeddingDurabilityProbeCount: Number(localEmbeddingDurabilitySmoke?.probes?.length ?? 0),
    localEmbeddingDurabilityBlockers,
    runtimeBlockers: runtimeBlockerReports.map((report) => ({
      status: report.status ?? null,
      shardId: report.queryShard?.shardId ?? null,
      failedArm: report.failedArm?.strategy ?? null,
      failureClass: report.failedArm?.failureClass ?? null,
      publicSyntheticReproduced: Boolean(report.publicSyntheticReproduction?.reproduced),
      acceptedShard: acceptedShardIds.has(String(report.queryShard?.shardId ?? "")),
      recoveredByCurrentEvidence: recoveredRuntimeShardIds.has(String(report.queryShard?.shardId ?? "")),
      activeRuntimeBlocker:
        !acceptedShardIds.has(String(report.queryShard?.shardId ?? "")) &&
        !recoveredRuntimeShardIds.has(String(report.queryShard?.shardId ?? "")),
      completedArmCount: Number(report.partialAttempt?.completedArmCount ?? 0),
      missingArmCount: Number(report.partialAttempt?.missingArmCount ?? 0),
    })),
    operatorInputCount: arrayOf(localFullAcceptedLaneLaunchDoctor?.operatorInputsNeeded).length,
    pendingShardCount: Number(localFullShardWorkorder?.progress?.pendingShardCount ?? 0),
    countsAsFullMemorySotaEvidence: false,
    publicBenchmarkClaimsAllowed: false,
    envBlockers,
    blockers,
    shardIntakeBlockers: [
      ...arrayOf(localFullShardIntake?.blockers),
      ...activeRuntimeBlockerIds,
      ...performanceReportState.blockers,
      ...localEmbeddingRuntimeBlockers,
      ...localEmbeddingDurabilityBlockers,
    ],
    launchBlockers: arrayOf(localFullAcceptedLaneLaunchDoctor?.blockers),
  };
}

function inspectLocalFullPerformanceReport(
  performanceReport,
  { localFullShardPlan, localFullShardIntake, localFullAcceptedLaneLaunchDoctor },
) {
  const expectedAcceptedShardCount = Number(localFullShardIntake?.intake?.acceptedShardCount ?? 0);
  const expectedMissingShardCount = Number(localFullShardIntake?.intake?.missingShardCount ?? 0);
  const expectedAcceptedQueryCount = arrayOf(localFullShardIntake?.acceptedShards).reduce(
    (total, shard) => total + Number(shard?.scoredQueryCount ?? 0),
    0,
  );
  const expectedQueryCount = Number(localFullShardPlan?.runPlan?.queryCount ?? 0);
  const expectedCoveragePercent = expectedQueryCount > 0 ? roundTo((expectedAcceptedQueryCount / expectedQueryCount) * 100, 4) : 0;
  const expectedNextPendingShard = arrayOf(localFullShardIntake?.missingShards).at(0);
  const expectedNextPendingShardId = expectedNextPendingShard?.shardId ?? localFullAcceptedLaneLaunchDoctor?.shardProgress?.firstPendingShardId ?? null;
  const expectedNextPendingShardRange =
    expectedNextPendingShard && Number.isInteger(Number(expectedNextPendingShard.startIndex)) && Number.isInteger(Number(expectedNextPendingShard.endIndexExclusive))
      ? `${expectedNextPendingShard.startIndex}-${expectedNextPendingShard.endIndexExclusive}`
      : (localFullAcceptedLaneLaunchDoctor?.shardProgress?.firstPendingShardRange ?? null);
  const generatedAtMs = Date.parse(performanceReport?.generatedAt ?? "");
  const intakeGeneratedAtMs = Date.parse(localFullShardIntake?.generatedAt ?? "");
  const freshForIntake =
    Number.isFinite(generatedAtMs) &&
    Number.isFinite(intakeGeneratedAtMs) &&
    generatedAtMs >= intakeGeneratedAtMs;
  const safe =
    performanceReport?.mode === "local-full-shard-performance-report" &&
    performanceReport?.publicSafe === true &&
    performanceReport?.metricsOnly === true &&
    performanceReport?.callsProviderApis === false &&
    performanceReport?.callsHostedSupermemory === false &&
    performanceReport?.callsLocalEndpoint === false &&
    performanceReport?.sendsBenchmarkTextToProvider === false &&
    performanceReport?.rawQuestionIdsIncluded === false &&
    performanceReport?.rawQuestionsIncluded === false &&
    performanceReport?.rawAnswersIncluded === false &&
    performanceReport?.rawMemoryIncluded === false &&
    performanceReport?.rawTranscriptIncluded === false &&
    performanceReport?.rawPromptIncluded === false &&
    performanceReport?.rawPrivateOutputPathIncluded === false &&
    performanceReport?.printsPrivatePaths === false &&
    performanceReport?.printsEnvValues === false &&
    performanceReport?.countsAsLocalFullBenchmarkEvidence === false &&
    performanceReport?.countsAsFullMemorySotaEvidence === false &&
    performanceReport?.publicBenchmarkClaimsAllowed === false &&
    performanceReport?.readyForShardCombine === false &&
    performanceReport?.readyForEndToEndMemoryScoreGate === false;
  const countsMatch =
    Number(performanceReport?.coverage?.acceptedShardCount ?? -1) === expectedAcceptedShardCount &&
    Number(performanceReport?.coverage?.missingShardCount ?? -1) === expectedMissingShardCount &&
    Number(performanceReport?.coverage?.acceptedQueryCount ?? -1) === expectedAcceptedQueryCount &&
    Number(performanceReport?.coverage?.queryCount ?? -1) === expectedQueryCount &&
    Number(performanceReport?.coverage?.coveragePercent ?? -1) === expectedCoveragePercent;
  const nextShardMatches =
    expectedNextPendingShardId == null ||
    performanceReport?.coverage?.nextPendingShardId === expectedNextPendingShardId;
  const evidenceBlockers = [
    !performanceReport ? "local-full-performance-report-missing" : null,
    performanceReport?.mode !== "local-full-shard-performance-report" ? "local-full-performance-report-mode-mismatch" : null,
    performanceReport?.status !== "PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT" ? "local-full-performance-report-status-not-partial" : null,
    !safe ? "local-full-performance-report-unsafe" : null,
    performanceReport?.countsAsLocalFullBenchmarkEvidence !== false ||
    performanceReport?.countsAsFullMemorySotaEvidence !== false ||
    performanceReport?.publicBenchmarkClaimsAllowed !== false
      ? "local-full-performance-report-claim-enabled"
      : null,
    !freshForIntake ? "local-full-performance-report-stale" : null,
    !countsMatch ? "local-full-performance-report-intake-mismatch" : null,
    !nextShardMatches ? "local-full-performance-report-next-shard-mismatch" : null,
  ].filter(Boolean);
  return {
    path: files.localFullPerformanceReport,
    status: performanceReport?.status ?? null,
    publicSafe: Boolean(performanceReport?.publicSafe),
    metricsOnly: Boolean(performanceReport?.metricsOnly),
    safe,
    evidenceReady: evidenceBlockers.length === 0,
    evidenceBlockers,
    generatedAt: performanceReport?.generatedAt ?? null,
    intakeGeneratedAt: localFullShardIntake?.generatedAt ?? null,
    freshForIntake,
    expectedAcceptedShardCount,
    expectedAcceptedQueryCount,
    expectedCoveragePercent,
    expectedNextPendingShardId,
    expectedNextPendingShardRange,
    acceptedShardCount: Number(performanceReport?.coverage?.acceptedShardCount ?? 0),
    acceptedQueryCount: Number(performanceReport?.coverage?.acceptedQueryCount ?? 0),
    queryCount: Number(performanceReport?.coverage?.queryCount ?? 0),
    coveragePercent: Number(performanceReport?.coverage?.coveragePercent ?? 0),
    nextPendingShardId: performanceReport?.coverage?.nextPendingShardId ?? null,
    nextPendingShardRange: performanceReport?.coverage?.nextPendingShardRange ?? null,
    bestStrategy: performanceReport?.bestAnswerQuality?.strategy ?? null,
    bestAnswerQuality: performanceReport?.bestAnswerQuality?.answerQuality ?? null,
    bestDeltaVsBm25: performanceReport?.bestAnswerQuality?.deltaVsBm25?.answerQuality ?? null,
    localAppleBaseAnswerQuality: performanceReport?.localApple?.base?.answerQuality ?? null,
    localAppleRerankAnswerQuality: performanceReport?.localApple?.rerank?.answerQuality ?? null,
    localAppleRerankDeltaVsBase: performanceReport?.localApple?.rerankDeltaVsBase?.answerQuality ?? null,
    runtimeBlockerStatus: performanceReport?.runtime?.runtimeBlockerStatus ?? null,
    runtimeFailedArm: performanceReport?.runtime?.failedArm ?? null,
    runtimeRecoveryStatus: performanceReport?.runtime?.runtimeRecoveryStatus ?? null,
    runtimeRecoveryShardId: performanceReport?.runtime?.recovery?.shardId ?? null,
    runtimeRecoveryFailedArm: performanceReport?.runtime?.recovery?.failedArm ?? null,
    runtimeRecoveryRetrievalRecovered: Boolean(performanceReport?.runtime?.recovery?.retrievalRecovered),
    runtimeRecoveryAnswerQualityPreflightReady: Boolean(performanceReport?.runtime?.recovery?.answerQualityPreflightReady),
    runtimeRecoveryAnswerQualityEnvReady: Boolean(performanceReport?.runtime?.recovery?.answerQualityEnvReady),
    runtimeRecoveryBlockers: arrayOf(performanceReport?.runtime?.recovery?.blockers),
    activeRuntimeBlockedShardCount: Number(performanceReport?.runtime?.runtimeBlockedShardCount ?? 0),
    historicalRuntimeBlockedShardCount: Number(performanceReport?.runtime?.historicalRuntimeBlockedShardCount ?? 0),
    countsAsFullMemorySotaEvidence: Boolean(performanceReport?.countsAsFullMemorySotaEvidence),
    publicBenchmarkClaimsAllowed: Boolean(performanceReport?.publicBenchmarkClaimsAllowed),
    blockers: arrayOf(performanceReport?.blockers),
  };
}

function inspectLocalFullResumeEnvDoctor(envDoctor) {
  const publicSafe =
    envDoctor?.mode === "local-full-shard-resume-env-doctor" &&
    envDoctor?.publicSafe === true &&
    envDoctor?.metricsOnly === true &&
    envDoctor?.callsProviderApis === false &&
    envDoctor?.callsHostedSupermemory === false &&
    envDoctor?.sendsBenchmarkTextToProvider === false &&
    envDoctor?.rawQuestionIdsIncluded === false &&
    envDoctor?.rawQuestionsIncluded === false &&
    envDoctor?.rawAnswersIncluded === false &&
    envDoctor?.rawMemoryIncluded === false &&
    envDoctor?.rawTranscriptIncluded === false &&
    envDoctor?.rawPromptIncluded === false &&
    envDoctor?.rawPrivateOutputPathIncluded === false &&
    envDoctor?.printsEnvValues === false &&
    envDoctor?.printsPrivatePaths === false &&
    envDoctor?.countsAsLocalFullBenchmarkEvidence === false &&
    envDoctor?.countsAsFullMemorySotaEvidence === false &&
    envDoctor?.publicBenchmarkClaimsAllowed === false;
  const sourceRetentionReady =
    envDoctor?.sourceRetention?.contractReady === true &&
    envDoctor?.sourceRetention?.rawSourcesRetainedPrivately === true &&
    envDoctor?.sourceRetention?.publicReportIsSafe === true &&
    envDoctor?.sourceRetention?.compressedDefaultRetrievalAllowed === true &&
    envDoctor?.sourceRetention?.uiMayUseCompressedDefaultButAuditRetainsRawSource === true;
  const durabilityReady =
    envDoctor?.localEmbeddingDurability?.reportReady === true &&
    envDoctor?.localEmbeddingDurability?.longProbeReady === true &&
    envDoctor?.localEmbeddingDurability?.generatedAfterRuntimeBlocker === true &&
    envDoctor?.localEmbeddingDurability?.readyForLocalFullResume === true;
  const evidenceReady =
    publicSafe &&
    sourceRetentionReady &&
    durabilityReady &&
    envDoctor?.status === "READY_LOCAL_FULL_SHARD_RESUME_ENV" &&
    envDoctor?.readyForMissingArmExport === true &&
    envDoctor?.readyForAnswerQualityPreflight === true &&
    envDoctor?.readyForShardAnswerQuality === true &&
    envDoctor?.readyForLocalShardIntake === true &&
    envDoctor?.readyForCommandMaterialization === true;
  const evidenceBlockers = [
    !envDoctor ? "local-full-resume-env-doctor-missing" : null,
    envDoctor?.mode !== "local-full-shard-resume-env-doctor" ? "local-full-resume-env-mode-mismatch" : null,
    !publicSafe ? "local-full-resume-env-public-report-unsafe" : null,
    !sourceRetentionReady ? "local-full-resume-env-source-retention-not-ready" : null,
    !durabilityReady ? "local-full-resume-env-durability-not-ready" : null,
    envDoctor?.status !== "READY_LOCAL_FULL_SHARD_RESUME_ENV" ? "local-full-resume-env-not-ready" : null,
    envDoctor?.readyForMissingArmExport !== true ? "local-full-resume-missing-arm-export-not-ready" : null,
    envDoctor?.readyForAnswerQualityPreflight !== true ? "local-full-resume-answer-quality-preflight-not-ready" : null,
    envDoctor?.readyForShardAnswerQuality !== true ? "local-full-resume-shard-answer-quality-not-ready" : null,
    envDoctor?.readyForLocalShardIntake !== true ? "local-full-resume-local-shard-intake-not-ready" : null,
    envDoctor?.readyForCommandMaterialization !== true ? "local-full-resume-command-materialization-not-ready" : null,
    ...arrayOf(envDoctor?.blockers),
  ].filter(Boolean);
  return {
    path: files.localFullResumeEnvDoctor,
    status: envDoctor?.status ?? null,
    publicSafe,
    evidenceReady,
    evidenceBlockers,
    readyForMissingArmExport: Boolean(envDoctor?.readyForMissingArmExport),
    readyForAnswerQualityPreflight: Boolean(envDoctor?.readyForAnswerQualityPreflight),
    readyForShardAnswerQuality: Boolean(envDoctor?.readyForShardAnswerQuality),
    readyForLocalShardIntake: Boolean(envDoctor?.readyForLocalShardIntake),
    readyForCommandMaterialization: Boolean(envDoctor?.readyForCommandMaterialization),
    privateInputFilesReady: Boolean(envDoctor?.privateInputFilesReady),
    completedPrivateArmFilesReady: Boolean(envDoctor?.completedPrivateArmFilesReady),
    readyForMissingArmExportExceptEnv: Boolean(envDoctor?.readyForMissingArmExportExceptEnv),
    localResumeExecutionEnvReady: Boolean(envDoctor?.localResumeExecutionEnvReady),
    privateDirectoryProvided: Boolean(envDoctor?.privateDir?.provided),
    privateDirectoryPresent: Boolean(envDoctor?.privateDir?.present),
    privateDirectoryOutsideRepository: Boolean(envDoctor?.privateDir?.outsideRepository),
    rawSourceRetentionContractReady: Boolean(envDoctor?.sourceRetention?.contractReady),
    rawSourcesRetainedPrivately: Boolean(envDoctor?.sourceRetention?.rawSourcesRetainedPrivately),
    rawSourcePrivateAuditReady: Boolean(envDoctor?.sourceRetention?.readyForPrivateAudit),
    compressedDefaultRetrievalAllowed: Boolean(envDoctor?.sourceRetention?.compressedDefaultRetrievalAllowed),
    uiMayUseCompressedDefaultButAuditRetainsRawSource: Boolean(
      envDoctor?.sourceRetention?.uiMayUseCompressedDefaultButAuditRetainsRawSource,
    ),
    localEmbeddingDurabilityReady: durabilityReady,
    localEmbeddingEnvReady: Boolean(envDoctor?.env?.localEmbedding?.ready),
    localRerankEnvReady: Boolean(envDoctor?.env?.localRerank?.ready),
    localSafetyEnvReady: Boolean(envDoctor?.env?.localSafety?.ready),
    answerQualityEnvReady: Boolean(envDoctor?.env?.answerQuality?.ready),
    missingEnvironmentNameCount:
      arrayOf(envDoctor?.env?.localEmbedding?.missingNames).length +
      arrayOf(envDoctor?.env?.localRerank?.missingNames).length +
      arrayOf(envDoctor?.env?.localSafety?.missingNames).length +
      arrayOf(envDoctor?.env?.answerQuality?.missingNames).length,
    requiredPrivateInputFileCount: arrayOf(envDoctor?.requiredInputFiles).length,
    presentPrivateInputFileCount: arrayOf(envDoctor?.requiredInputFiles).filter((file) => file.present === true).length,
    completedArmFileCount: arrayOf(envDoctor?.completedArmFiles).length,
    presentCompletedArmFileCount: arrayOf(envDoctor?.completedArmFiles).filter((file) => file.present === true).length,
    blockers: arrayOf(envDoctor?.blockers),
    countsAsFullMemorySotaEvidence: Boolean(envDoctor?.countsAsFullMemorySotaEvidence),
    publicBenchmarkClaimsAllowed: Boolean(envDoctor?.publicBenchmarkClaimsAllowed),
  };
}

function inspectLocalFullResumeCommandSecurity(securityReport) {
  const publicSafe =
    securityReport?.mode === "local-full-shard-resume-command-security-doctor" &&
    securityReport?.status === "READY_LOCAL_FULL_RESUME_COMMAND_SECURITY" &&
    securityReport?.securityReady === true &&
    securityReport?.publicSafe === true &&
    securityReport?.metricsOnly === true &&
    securityReport?.writesRealPrivateCommandFile === false &&
    securityReport?.callsProviderApis === false &&
    securityReport?.callsHostedSupermemory === false &&
    securityReport?.callsLocalEndpoint === false &&
    securityReport?.sendsBenchmarkTextToProvider === false &&
    securityReport?.rawQuestionIdsIncluded === false &&
    securityReport?.rawQuestionsIncluded === false &&
    securityReport?.rawAnswersIncluded === false &&
    securityReport?.rawMemoryIncluded === false &&
    securityReport?.rawTranscriptIncluded === false &&
    securityReport?.rawPromptIncluded === false &&
    securityReport?.rawPrivateOutputPathIncluded === false &&
    securityReport?.printsMaterializedCommands === false &&
    securityReport?.printsEnvValues === false &&
    securityReport?.printsPrivatePaths === false &&
    securityReport?.privateCommandPathPrinted === false &&
    securityReport?.privateScriptContentPrinted === false &&
    securityReport?.countsAsLocalFullBenchmarkEvidence === false &&
    securityReport?.countsAsFullMemorySotaEvidence === false &&
    securityReport?.publicBenchmarkClaimsAllowed === false;
  const fixtureSafe =
    securityReport?.fixtureProbe?.ready === true &&
    securityReport?.fixtureProbe?.publicOutputSafe === true &&
    securityReport?.fixtureProbe?.privateCommandFileWritten === true &&
    securityReport?.fixtureProbe?.privateCommandFileOutsideRepository === true &&
    securityReport?.fixtureProbe?.privateCommandFileMode === "0700" &&
    securityReport?.fixtureProbe?.privateCommandFilePathPrinted === false &&
    securityReport?.fixtureProbe?.privateScriptContentPrinted === false &&
    securityReport?.fixtureProbe?.privateScriptPlaceholderCount === 0 &&
    securityReport?.fixtureProbe?.privateScriptOrderReady === true &&
    securityReport?.fixtureProbe?.firstCommandId === "rerunRuntimeDoctor" &&
    securityReport?.fixtureProbe?.secondCommandId === "rerunDurabilitySmoke" &&
    securityReport?.fixtureProbe?.thirdCommandId === "rerunLocalRerankDurabilitySmoke" &&
    securityReport?.fixtureProbe?.guardedCommandId === "missingArmResponseExport" &&
    securityReport?.fixtureProbe?.materializedCommandCount === 9 &&
    securityReport?.fixtureProbe?.printsMaterializedCommands === false &&
    securityReport?.fixtureProbe?.printsPrivatePaths === false &&
    securityReport?.fixtureProbe?.printsEnvValues === false;
  const materializerReportSafe =
    securityReport?.materializerReport?.publicReportSafe === true &&
    securityReport?.materializerReport?.commandsPrinted === false &&
    securityReport?.materializerReport?.guardPlan?.ready === true;
  const evidenceBlockers = [
    !securityReport ? "local-full-resume-command-security-report-missing" : null,
    securityReport?.mode !== "local-full-shard-resume-command-security-doctor"
      ? "local-full-resume-command-security-mode-mismatch"
      : null,
    securityReport?.status !== "READY_LOCAL_FULL_RESUME_COMMAND_SECURITY"
      ? "local-full-resume-command-security-not-ready"
      : null,
    !publicSafe ? "local-full-resume-command-security-public-report-unsafe" : null,
    !fixtureSafe ? "local-full-resume-command-security-fixture-unsafe" : null,
    !materializerReportSafe ? "local-full-resume-command-materializer-report-unsafe" : null,
    ...arrayOf(securityReport?.blockers),
  ].filter(Boolean);
  return {
    path: files.localFullResumeCommandSecurity,
    status: securityReport?.status ?? null,
    publicSafe,
    fixtureSafe,
    materializerReportSafe,
    evidenceReady: evidenceBlockers.length === 0,
    evidenceBlockers,
    privateCommandFileMode: securityReport?.fixtureProbe?.privateCommandFileMode ?? null,
    privateCommandFileOutsideRepository: Boolean(securityReport?.fixtureProbe?.privateCommandFileOutsideRepository),
    privateScriptPlaceholderCount: Number(securityReport?.fixtureProbe?.privateScriptPlaceholderCount ?? 0),
    privateScriptOrderReady: Boolean(securityReport?.fixtureProbe?.privateScriptOrderReady),
    firstCommandId: securityReport?.fixtureProbe?.firstCommandId ?? null,
    secondCommandId: securityReport?.fixtureProbe?.secondCommandId ?? null,
    thirdCommandId: securityReport?.fixtureProbe?.thirdCommandId ?? null,
    guardedCommandId: securityReport?.fixtureProbe?.guardedCommandId ?? null,
    materializedCommandCount: Number(securityReport?.fixtureProbe?.materializedCommandCount ?? 0),
    printsMaterializedCommands: Boolean(securityReport?.fixtureProbe?.printsMaterializedCommands),
    printsPrivatePaths: Boolean(securityReport?.fixtureProbe?.printsPrivatePaths),
    printsEnvValues: Boolean(securityReport?.fixtureProbe?.printsEnvValues),
    countsAsFullMemorySotaEvidence: Boolean(securityReport?.countsAsFullMemorySotaEvidence),
    publicBenchmarkClaimsAllowed: Boolean(securityReport?.publicBenchmarkClaimsAllowed),
    blockers: arrayOf(securityReport?.blockers),
  };
}

function inspectLocalFullResumeResultDoctor(resultDoctor) {
  const publicSafe =
    resultDoctor?.mode === "local-full-shard-resume-result-doctor" &&
    resultDoctor?.publicSafe === true &&
    resultDoctor?.metricsOnly === true &&
    resultDoctor?.callsProviderApis === false &&
    resultDoctor?.callsHostedSupermemory === false &&
    resultDoctor?.callsLocalEndpoint === false &&
    resultDoctor?.sendsBenchmarkTextToProvider === false &&
    resultDoctor?.rawQuestionIdsIncluded === false &&
    resultDoctor?.rawQuestionsIncluded === false &&
    resultDoctor?.rawAnswersIncluded === false &&
    resultDoctor?.rawMemoryIncluded === false &&
    resultDoctor?.rawTranscriptIncluded === false &&
    resultDoctor?.rawPromptIncluded === false &&
    resultDoctor?.rawPrivateOutputPathIncluded === false &&
    resultDoctor?.printsPrivatePaths === false &&
    resultDoctor?.printsEnvValues === false &&
    resultDoctor?.printsMaterializedCommands === false &&
    resultDoctor?.countsAsLocalFullBenchmarkEvidence === false &&
    resultDoctor?.countsAsFullMemorySotaEvidence === false &&
    resultDoctor?.publicBenchmarkClaimsAllowed === false;
  const evidenceReady =
    publicSafe &&
    resultDoctor?.status === "READY_LOCAL_FULL_SHARD_002_RESULT_FOR_INTAKE" &&
    resultDoctor?.readyForLocalShardIntake === true &&
    resultDoctor?.previousShard?.accepted === true &&
    resultDoctor?.shardResult?.accepted === true;
  const evidenceBlockers = [
    !resultDoctor ? "local-full-resume-result-doctor-missing" : null,
    resultDoctor?.mode !== "local-full-shard-resume-result-doctor" ? "local-full-resume-result-mode-mismatch" : null,
    !publicSafe ? "local-full-resume-result-public-report-unsafe" : null,
    resultDoctor?.status !== "READY_LOCAL_FULL_SHARD_002_RESULT_FOR_INTAKE" ? "local-full-resume-result-not-ready" : null,
    resultDoctor?.readyForLocalShardIntake !== true ? "local-full-resume-result-not-ready-for-intake" : null,
    resultDoctor?.previousShard?.accepted !== true ? "local-full-previous-shard-not-accepted" : null,
    resultDoctor?.shardResult?.accepted !== true ? "local-full-shard-002-result-not-accepted" : null,
    ...arrayOf(resultDoctor?.blockers),
  ].filter(Boolean);
  return {
    path: files.localFullResumeResultDoctor,
    status: resultDoctor?.status ?? null,
    publicSafe,
    evidenceReady,
    evidenceBlockers,
    readyForLocalShardIntake: Boolean(resultDoctor?.readyForLocalShardIntake),
    previousShardAccepted: Boolean(resultDoctor?.previousShard?.accepted),
    shard002ResultPresent: Boolean(resultDoctor?.shardResult?.present),
    shard002ResultAccepted: Boolean(resultDoctor?.shardResult?.accepted),
    shard002ScoredQueryCount: Number(resultDoctor?.shardResult?.scoredQueryCount ?? 0),
    shard002StrategyCount: Number(resultDoctor?.shardResult?.strategyCount ?? 0),
    commandMaterializerReady: Boolean(resultDoctor?.commandMaterializer?.ready),
    commandMaterializerWrotePrivateCommandFile: Boolean(resultDoctor?.commandMaterializer?.writesPrivateCommandFile),
    blockers: arrayOf(resultDoctor?.blockers),
    countsAsFullMemorySotaEvidence: Boolean(resultDoctor?.countsAsFullMemorySotaEvidence),
    publicBenchmarkClaimsAllowed: Boolean(resultDoctor?.publicBenchmarkClaimsAllowed),
  };
}

function selectPreferredLocalFullShardIntake(candidates) {
  const present = candidates.filter((candidate) => candidate?.json);
  assert.ok(present.length > 0, "required local-full shard intake evidence missing");
  return present.sort((left, right) => {
    const rightAccepted = Number(right.json?.intake?.acceptedShardCount ?? 0);
    const leftAccepted = Number(left.json?.intake?.acceptedShardCount ?? 0);
    if (rightAccepted !== leftAccepted) return rightAccepted - leftAccepted;
    const rightGeneratedAt = Date.parse(right.json?.generatedAt ?? "") || 0;
    const leftGeneratedAt = Date.parse(left.json?.generatedAt ?? "") || 0;
    return rightGeneratedAt - leftGeneratedAt;
  })[0];
}

function inspectPrivateInputState(privateInputDoctorReport) {
  return {
    path: files.privateInputDoctor,
    status: privateInputDoctorReport?.status ?? null,
    readyForAnswerQualityShardRun: Boolean(privateInputDoctorReport?.readyForAnswerQualityShardRun),
    privateDirectoryPresent: Boolean(privateInputDoctorReport?.privateInput?.directoryPresent),
    privateDirectoryInsideRepository: Boolean(privateInputDoctorReport?.privateInput?.directoryInsideRepository),
    maxMemoryBytes: privateInputDoctorReport?.plan?.maxMemoryBytes ?? null,
    filesPresent: Number((privateInputDoctorReport?.privateInput?.files ?? []).filter((file) => file.present).length),
    filesHashMatched: Number((privateInputDoctorReport?.privateInput?.files ?? []).filter((file) => file.hashMatches).length),
    blockers: privateInputDoctorReport?.blockers ?? [],
  };
}

function inspectAcceptedLaneLaunchState(launchDoctorReport) {
  return {
    path: files.acceptedLaneLaunchDoctor,
    status: launchDoctorReport?.status ?? null,
    readyForFirstAcceptedShardRun: Boolean(launchDoctorReport?.launchGate?.readyForFirstAcceptedShardRun),
    readyForAcceptedShardIntake: Boolean(launchDoctorReport?.launchGate?.readyForAcceptedShardIntake),
    readyForPublicSotaClaim: Boolean(launchDoctorReport?.launchGate?.readyForPublicSotaClaim),
    acceptedLaneId: launchDoctorReport?.acceptedLane?.laneId ?? null,
    queryExpansionRequirement: launchDoctorReport?.acceptedLane?.queryExpansion?.evidenceRequirement ?? null,
    queryExpansionModelBacked: Boolean(launchDoctorReport?.acceptedLane?.queryExpansion?.modelBackedReady),
    queryExpansionSotaEligible: Boolean(launchDoctorReport?.acceptedLane?.queryExpansion?.countsAsFullSotaQueryExpansionEvidence),
    responseExportReady: Boolean(launchDoctorReport?.launchGate?.acceptedLaneReadyForResponseArmExport),
    answerQualityScoringReady: Boolean(launchDoctorReport?.launchGate?.acceptedLaneReadyForAnswerQualityScoring),
    privateInputsReady: Boolean(launchDoctorReport?.launchGate?.privateInputsReady),
    operatorInputCount: Number(launchDoctorReport?.operatorInputsNeeded?.length ?? 0),
    pendingShardCount: Number(launchDoctorReport?.shardProgress?.pendingShardCount ?? 0),
    firstPendingShardId: launchDoctorReport?.shardProgress?.firstPendingShardId ?? null,
    blockers: launchDoctorReport?.blockers ?? [],
  };
}

function inspectControlPreflightState(controlPreflightReport) {
  const arms = arrayOf(controlPreflightReport?.arms);
  const blockers = [
    controlPreflightReport?.mode !== "public-benchmark-answer-quality-preflight" ? "control-preflight-mode-mismatch" : null,
    controlPreflightReport?.status !== "BLOCKED_ANSWER_QUALITY_ENV" ? "control-preflight-status-should-remain-env-blocked" : null,
    controlPreflightReport?.readiness?.privateInputsReady !== true ? "control-preflight-private-inputs-not-ready" : null,
    controlPreflightReport?.readiness?.armsReady !== true ? "control-preflight-arms-not-ready" : null,
    controlPreflightReport?.readiness?.responseArmsCoverSelectedShard !== true ? "control-preflight-shard-coverage-not-ready" : null,
    controlPreflightReport?.readiness?.sameDataReady !== true ? "control-preflight-same-data-not-ready" : null,
    controlPreflightReport?.readiness?.liveAnswerQualityCanRun !== false ? "control-preflight-should-not-enable-live-scoring" : null,
    controlPreflightReport?.readiness?.readyForEndToEndMemoryScoreGate !== false ? "control-preflight-should-not-count-for-score-gate" : null,
    controlPreflightReport?.readiness?.countsAsFullMemorySotaEvidence !== false ? "control-preflight-should-not-count-as-sota" : null,
    controlPreflightReport?.callsProviderApis !== false ? "control-preflight-provider-calls-not-zero" : null,
    controlPreflightReport?.sendsBenchmarkTextToProvider !== false ? "control-preflight-sent-benchmark-text" : null,
    controlPreflightReport?.queryShard?.startIndex !== 0 || controlPreflightReport?.queryShard?.endIndexExclusive !== 25
      ? "control-preflight-shard-range-mismatch"
      : null,
    arms.length !== 3 ? "control-preflight-arm-count-mismatch" : null,
    ...["bm25-lite", "full-hybrid-rerank", "query-expanded-full-hybrid-rerank"].map((strategy) =>
      arms.some(
        (arm) =>
          arm.strategy === strategy &&
          arm.selectedShardCoverage?.ready === true &&
          arm.querySetMatches === true &&
          arm.selectedShardCoverage?.selectedQueryIdHashMatches === true,
      )
        ? null
        : `control-preflight-${strategy}-not-ready`,
    ),
  ].filter(Boolean);
  return {
    path: files.controlPreflight,
    status: controlPreflightReport?.status ?? null,
    sameDataShardReady: blockers.length === 0,
    liveAnswerQualityCanRun: Boolean(controlPreflightReport?.readiness?.liveAnswerQualityCanRun),
    countsAsFullMemorySotaEvidence: Boolean(controlPreflightReport?.readiness?.countsAsFullMemorySotaEvidence),
    privateInputsReady: Boolean(controlPreflightReport?.readiness?.privateInputsReady),
    armsReady: Boolean(controlPreflightReport?.readiness?.armsReady),
    responseArmsCoverSelectedShard: Boolean(controlPreflightReport?.readiness?.responseArmsCoverSelectedShard),
    sameDataReady: Boolean(controlPreflightReport?.readiness?.sameDataReady),
    queryShard: controlPreflightReport?.queryShard ?? null,
    arms: arms.map((arm) => ({
      strategy: arm.strategy,
      responseCount: Number(arm.responseCount ?? 0),
      querySetMatches: Boolean(arm.querySetMatches),
      selectedShardCoverageReady: Boolean(arm.selectedShardCoverage?.ready),
      selectedQueryIdHashMatches: Boolean(arm.selectedShardCoverage?.selectedQueryIdHashMatches),
    })),
    envBlockers: controlPreflightReport?.blockers ?? [],
    blockers,
  };
}

function inspectCurrentCanary({ combinedCanary, endToEndGate, reviewerIntake, voyageRateLimit }) {
  return {
    resultPath: files.combinedCanary,
    gatePath: files.endToEndGate,
    queryCount: Number(combinedCanary?.input?.scoredQueryCount ?? combinedCanary?.input?.queryCount ?? 0),
    winner: combinedCanary?.winner ?? null,
    answerModel: endToEndGate?.result?.answerModel ?? combinedCanary?.provider?.answerModel ?? null,
    judgeModel: endToEndGate?.result?.judgeModel ?? combinedCanary?.provider?.judgeModel ?? null,
    targetAnswerModel: endToEndGate?.target?.answerModel ?? null,
    targetJudgeModel: endToEndGate?.target?.judgeModel ?? null,
    score: endToEndGate?.result?.answerQualityMetric?.value ?? combinedCanary?.winner?.answerQuality ?? null,
    primaryReportedTarget: endToEndGate?.reportedTargetComparison?.primaryTarget ?? null,
    scoreDelta: endToEndGate?.reportedTargetComparison?.scoreDelta ?? null,
    countsAsEndToEndMemoryBenchmark: Boolean(endToEndGate?.countsAsEndToEndMemoryBenchmark),
    countsAsFullMemorySotaEvidence: Boolean(endToEndGate?.countsAsFullMemorySotaEvidence),
    fullSotaBlockers: endToEndGate?.fullSotaBlockers ?? [],
    gateBlockers: endToEndGate?.blockers ?? [],
    reviewerApprovalCount: Number(reviewerIntake?.reviewerApprovalCount ?? 0),
    voyageStatus: voyageRateLimit?.status ?? null,
    voyageHttpStatus: voyageRateLimit?.httpStatus ?? null,
  };
}

function inspectReviewerState(reviewerIntake) {
  const blockers = reviewerIntake?.blockers ?? ["memory-score-reviewer-intake-missing"];
  return {
    path: files.reviewerIntake,
    status: reviewerIntake?.status ?? null,
    ready: reviewerIntake?.publicBenchmarkApprovalReady === true && reviewerIntake?.countsAsFullMemorySotaReview === true,
    reviewerApprovalCount: Number(reviewerIntake?.reviewerApprovalCount ?? 0),
    independentReviewerCount: Number(reviewerIntake?.independentReviewerCount ?? 0),
    countsAsFullMemorySotaReview: Boolean(reviewerIntake?.countsAsFullMemorySotaReview),
    blockers,
    acceptableRoutes: ["Gemini", "Claude", "NVIDIA/DeepSeek-style external critic", "Codex reviewer not involved in implementation"],
  };
}

function inspectDocs(loadedEvidence) {
  const requiredPhrases = [
    [loadedEvidence.benchmarkDocs.text, /This is an execution\s+plan and harness upgrade, not a completed full-SOTA result/i],
    [loadedEvidence.targetDocs.text, /The full LongMemEval-S run-only target is now authored|full 500-row public set/i],
    [loadedEvidence.releaseHandoff.text, /Do not use MemoryBench, LongMemEval, or SOTA wording/i],
    [loadedEvidence.releaseNotes.text, /full-memory|SOTA|answer-quality/i],
  ];
  const missing = requiredPhrases
    .map(([text, pattern], index) => (!pattern.test(text ?? "") ? `doc-phrase-${index + 1}-missing` : null))
    .filter(Boolean);
  return {
    docsCurrentForBlockedState: missing.length === 0,
    readyAfterBenchmarkResult: false,
    blockers: [
      ...missing,
      "docs-release-notes-and-ui-evidence-must-refresh-after-full-result",
    ],
    uiEvidencePath: files.uiEvidence,
    uiFixtureOnly: Boolean(uiEvidence?.fixtureOnly),
    uiPrivateLeakCount: Number(uiEvidence?.privateLeakCount ?? 0),
  };
}

function gate(id, passed, blockers) {
  return {
    id,
    status: passed ? "pass" : "blocked",
    blockers: passed ? [] : arrayOf(blockers),
  };
}

function roundTo(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function buildNextRunPlan({ shardPlan, sotaOperatorPacket }) {
  const fullShardFlow = arrayOf(sotaOperatorPacket?.operatorFlow).find((item) => item.id === "full-longmemeval-answer-quality-shards");
  return {
    primaryStage: "full-longmemeval-answer-quality-shards",
    privateOutputRequired: true,
    rawSourcesStayOutsideRepo: true,
    queryCount: Number(shardPlan?.runPlan?.queryCount ?? 500),
    shardCount: Number(shardPlan?.runPlan?.shardCount ?? 20),
    shardSize: Number(shardPlan?.runPlan?.shardSize ?? 25),
    strategySet: shardPlan?.runPlan?.strategies ?? [],
    executionLanes: shardPlan?.executionLanes ?? [],
    acceptedShardIntakeLaneIds: arrayOf(shardPlan?.executionLanes)
      .filter((lane) => lane.acceptedByFullShardIntake === true)
      .map((lane) => lane.id),
    diagnosticLaneIds: arrayOf(shardPlan?.executionLanes)
      .filter((lane) => lane.acceptedByFullShardIntake !== true)
      .map((lane) => lane.id),
    commandSource: files.sotaOperatorPacket,
    commandCount: fullShardFlow?.commands?.length ?? 0,
    firstCommands: arrayOf(fullShardFlow?.commands).slice(0, 6),
    requiredAfterShardRuns: [
      "benchmark:answer-quality:shard-workorder",
      "benchmark:local-embedding:runtime-doctor before local Apple embedding durability",
      "benchmark:local-embedding:durability before local Apple response-arm export",
      "benchmark:answer-quality:shard-intake --require-ready",
      "benchmark:answer-quality:combine -- --combine-mode shards",
      "benchmark:memory-score:reviewer-intake -- --strict-target",
      "benchmark:memory-score:result-gate -- --require-ready",
      "benchmark:sota-ladder",
      "UI evidence, docs, release notes, owner approval, and real canary refresh",
    ],
  };
}

function summarizeEvidence(loadedEvidence) {
  return Object.fromEntries(
    Object.entries(loadedEvidence).map(([key, value]) => [
      key,
      {
        path: value.path,
        exists: value.exists,
        hash: value.hash,
        mode: value.json?.mode ?? null,
        status: value.json?.status ?? null,
      },
    ]),
  );
}

function renderMarkdown(value) {
  const lines = [
    "# Full Memory SOTA Doctor",
    "",
    `- Status: ${value.status}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Full target query count: ${value.fullTarget.queryCount}`,
    `- Current canary query count: ${value.currentCanary.queryCount}`,
    `- Current best score: ${value.currentCanary.score ?? "n/a"}`,
    `- Current score delta vs reported target: ${value.currentCanary.scoreDelta ?? "n/a"}`,
    `- Reported target source evidence checked at: ${value.reportedTargets.sourceEvidenceCheckedAt ?? "n/a"}`,
    `- Benchmark harness source locks: ${value.reportedTargets.benchmarkHarnessTargetCount}`,
    "",
    "## Gates",
    ...value.gates.map((item) => `- ${item.id}: ${item.status}${item.blockers.length ? ` (${item.blockers.join(", ")})` : ""}`),
    "",
    "## Raw Source Retention",
    `- Retains raw sources privately: ${value.rawSourceRetention.retainsRawSourcesPrivately}`,
    `- Public report is safe: ${value.rawSourceRetention.publicReportIsSafe}`,
    `- Private raw roles: ${value.rawSourceRetention.roles.map((item) => item.role).join(", ")}`,
    "",
    "## Private Inputs",
    `- Status: ${value.privateInputState.status}`,
    `- Ready for shard run: ${value.privateInputState.readyForAnswerQualityShardRun}`,
    `- Private directory present: ${value.privateInputState.privateDirectoryPresent}`,
    `- Private directory inside repository: ${value.privateInputState.privateDirectoryInsideRepository}`,
    `- Files present/hash-matched: ${value.privateInputState.filesPresent}/${value.privateInputState.filesHashMatched}`,
    `- Max memory bytes: ${value.privateInputState.maxMemoryBytes ?? "n/a"}`,
    "",
    "## Accepted Lane Launch",
    `- Status: ${value.acceptedLaneLaunchState.status}`,
    `- Ready for first accepted shard run: ${value.acceptedLaneLaunchState.readyForFirstAcceptedShardRun}`,
    `- Query expansion requirement: ${value.acceptedLaneLaunchState.queryExpansionRequirement ?? "n/a"}`,
    `- Query expansion model-backed: ${value.acceptedLaneLaunchState.queryExpansionModelBacked}`,
    `- Response export ready: ${value.acceptedLaneLaunchState.responseExportReady}`,
    `- Answer-quality scoring ready: ${value.acceptedLaneLaunchState.answerQualityScoringReady}`,
    `- Operator inputs needed: ${value.acceptedLaneLaunchState.operatorInputCount}`,
    "",
    "## Control Preflight",
    `- Status: ${value.controlPreflightState.status}`,
    `- Same-data shard ready: ${value.controlPreflightState.sameDataShardReady}`,
    `- Live answer-quality can run: ${value.controlPreflightState.liveAnswerQualityCanRun}`,
    `- Counts as full memory SOTA evidence: ${value.controlPreflightState.countsAsFullMemorySotaEvidence}`,
    `- Arms: ${value.controlPreflightState.arms.map((item) => `${item.strategy}:${item.responseCount}`).join(", ")}`,
    "",
    "## Shards",
    `- Plan status: ${value.shardState.planStatus}`,
    `- Intake status: ${value.shardState.intakeStatus}`,
    `- Accepted shards: ${value.shardState.acceptedShardCount}`,
    `- Missing shards: ${value.shardState.missingShardCount}`,
    `- Full SOTA lane ready for response export: ${value.shardState.fullSotaLaneReadyForResponseArmExport}`,
    `- Full SOTA lane ready for answer-quality scoring: ${value.shardState.fullSotaLaneReadyForAnswerQualityScoring}`,
    "",
    "## Local Full Lane",
    `- Status: ${value.localFullLaneState.status}`,
    `- Claim scope: ${value.localFullLaneState.claimScope}`,
    `- Accepted lane: ${value.localFullLaneState.acceptedLaneId ?? "n/a"}`,
    `- Query count: ${value.localFullLaneState.queryCount}`,
    `- Shard count: ${value.localFullLaneState.shardCount}`,
    `- Ready for response export: ${value.localFullLaneState.readyForResponseArmExport}`,
    `- Ready for first shard run: ${value.localFullLaneState.readyForFirstShardRun}`,
    `- Intake status: ${value.localFullLaneState.intakeStatus}`,
    `- Ready for shard combine: ${value.localFullLaneState.readyForShardCombine}`,
    `- Accepted local-full shards: ${value.localFullLaneState.acceptedShardCount}`,
    `- Missing local-full shards: ${value.localFullLaneState.missingShardCount}`,
    `- Launch progress source: ${value.localFullLaneState.launchProgressSource ?? "n/a"}`,
    `- Performance coverage: ${value.localFullLaneState.performanceReport.coveragePercent}%`,
    `- Performance best strategy: ${value.localFullLaneState.performanceReport.bestStrategy ?? "n/a"}`,
    `- Performance best answer quality: ${value.localFullLaneState.performanceReport.bestAnswerQuality ?? "n/a"}`,
    `- Performance counts as SOTA evidence: ${value.localFullLaneState.performanceReport.countsAsFullMemorySotaEvidence}`,
    `- Resume env ready for missing-arm export: ${value.localFullLaneState.resumeEnv.readyForMissingArmExport}`,
    `- Resume env ready for missing-arm export except env: ${value.localFullLaneState.resumeEnv.readyForMissingArmExportExceptEnv}`,
    `- Resume env ready for command materialization: ${value.localFullLaneState.resumeEnv.readyForCommandMaterialization}`,
    `- Resume env private input files ready: ${value.localFullLaneState.resumeEnv.privateInputFilesReady}`,
    `- Resume env completed private arm files ready: ${value.localFullLaneState.resumeEnv.completedPrivateArmFilesReady}`,
    `- Resume env private directory provided: ${value.localFullLaneState.resumeEnv.privateDirectoryProvided}`,
    `- Resume env raw-source private audit ready: ${value.localFullLaneState.resumeEnv.rawSourcePrivateAuditReady}`,
    `- Resume env compressed default retrieval allowed: ${value.localFullLaneState.resumeEnv.compressedDefaultRetrievalAllowed}`,
    `- Resume env local execution env ready: ${value.localFullLaneState.resumeEnv.localResumeExecutionEnvReady}`,
    `- Resume env local embedding env ready: ${value.localFullLaneState.resumeEnv.localEmbeddingEnvReady}`,
    `- Resume env local rerank env ready: ${value.localFullLaneState.resumeEnv.localRerankEnvReady}`,
    `- Resume env answer-quality env ready: ${value.localFullLaneState.resumeEnv.answerQualityEnvReady}`,
    `- Resume command security ready: ${value.localFullLaneState.resumeCommandSecurity.evidenceReady}`,
    `- Resume command private file mode: ${value.localFullLaneState.resumeCommandSecurity.privateCommandFileMode ?? "n/a"}`,
    `- Resume command first guard: ${value.localFullLaneState.resumeCommandSecurity.firstCommandId ?? "n/a"}`,
    `- Resume command second guard: ${value.localFullLaneState.resumeCommandSecurity.secondCommandId ?? "n/a"}`,
    `- Resume command third guard: ${value.localFullLaneState.resumeCommandSecurity.thirdCommandId ?? "n/a"}`,
    `- Resume command guarded command: ${value.localFullLaneState.resumeCommandSecurity.guardedCommandId ?? "n/a"}`,
    `- Resume command counts as SOTA evidence: ${value.localFullLaneState.resumeCommandSecurity.countsAsFullMemorySotaEvidence}`,
    `- Resume result gate satisfied by accepted shard intake: ${value.localFullLaneState.resumeResult.gateSatisfiedByAcceptedShardIntake}`,
    `- Resume result ready for local shard intake: ${value.localFullLaneState.resumeResult.readyForLocalShardIntake}`,
    `- Resume result previous shard accepted: ${value.localFullLaneState.resumeResult.previousShardAccepted}`,
    `- Resume result shard 002 present: ${value.localFullLaneState.resumeResult.shard002ResultPresent}`,
    `- Resume result shard 002 accepted: ${value.localFullLaneState.resumeResult.shard002ResultAccepted}`,
    `- Next local-full shard: ${value.localFullLaneState.nextPendingShardId ?? "n/a"} (${value.localFullLaneState.nextPendingShardRange ?? "n/a"})`,
    `- Runtime-blocked local-full shards: ${value.localFullLaneState.runtimeBlockedShardCount}`,
    `- Historical runtime-blocked local-full shards: ${value.localFullLaneState.historicalRuntimeBlockedShardCount}`,
    `- Recovered runtime-blocked local-full shards: ${value.localFullLaneState.recoveredRuntimeBlockedShardCount}`,
    `- Runtime recovery status: ${value.localFullLaneState.runtimeRecoveryStatus ?? "n/a"}`,
    `- Runtime recovery retrieval recovered: ${value.localFullLaneState.runtimeRecoveryRetrievalRecovered}`,
    `- Runtime recovery answer-quality env ready: ${value.localFullLaneState.runtimeRecoveryAnswerQualityEnvReady}`,
    `- Runtime blocker resume plans: ${value.localFullLaneState.runtimeBlockerResumeAvailableCount}`,
    `- Next shard missing resume arms: ${value.localFullLaneState.nextPendingShardResumeMissingStrategies.join(", ") || "none"}`,
    `- Historical next shard missing resume arms: ${value.localFullLaneState.historicalNextPendingShardResumeMissingStrategies.join(", ") || "none"}`,
    `- Latest runtime-blocked shard: ${value.localFullLaneState.latestRuntimeBlockedShard ?? "n/a"}`,
    `- Latest runtime-blocked arm: ${value.localFullLaneState.latestRuntimeBlockedArm ?? "n/a"}`,
    `- Local embedding runtime status: ${value.localFullLaneState.localEmbeddingRuntimeStatus ?? "n/a"}`,
    `- Local embedding runtime ready: ${value.localFullLaneState.localEmbeddingRuntimeReady}`,
    `- Local embedding durability status: ${value.localFullLaneState.localEmbeddingDurabilityStatus ?? "n/a"}`,
    `- Local embedding durability ready: ${value.localFullLaneState.localEmbeddingDurabilityReady}`,
    `- Cloud provider blocker count: ${value.localFullLaneState.cloudProviderBlockerCount}`,
    `- Operator inputs needed: ${value.localFullLaneState.operatorInputCount}`,
    `- Counts as full memory SOTA evidence: ${value.localFullLaneState.countsAsFullMemorySotaEvidence}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Run",
    `- Primary stage: ${value.nextRunPlan.primaryStage}`,
    `- Strategy set: ${value.nextRunPlan.strategySet.join(", ")}`,
    `- Required after shard runs: ${value.nextRunPlan.requiredAfterShardRuns.join("; ")}`,
  ];
  return lines.join("\n");
}

function loadFile(file) {
  const path = file;
  const abs = resolveInputPath(file);
  assert.ok(existsSync(abs), `required evidence missing: ${file}`);
  const text = readFileSync(abs, "utf8");
  assertNoCredentialText(text, file);
  return {
    path,
    exists: true,
    hash: `sha256:${sha256(text)}`,
    text,
    json: file.endsWith(".json") ? JSON.parse(text) : null,
  };
}

function preferReviewFile(...names) {
  for (const name of names) {
    const candidate = `${reviewDir}/${name}`;
    if (existsSync(resolveInputPath(candidate))) return candidate;
  }
  return `${reviewDir}/${names.at(-1)}`;
}

function runJson(nodeArgs) {
  const result = spawnSync("node", nodeArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `node ${nodeArgs.join(" ")} failed\n${result.stderr}\n${result.stdout}`);
  assertSafePublicText(result.stdout, nodeArgs.join(" "));
  return JSON.parse(result.stdout);
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function resolveInputPath(path) {
  return isAbsolute(path) ? path : resolve(root, path);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  assert.ok(!secretPattern.test(text), `${label} appears to contain a credential`);
  assert.ok(!privatePathPattern.test(text), `${label} appears to contain a private path`);
}

function assertNoCredentialText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  assert.ok(!secretPattern.test(text), `${label} appears to contain a credential`);
}
