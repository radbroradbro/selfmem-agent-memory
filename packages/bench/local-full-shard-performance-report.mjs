import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const planPath = resolveInputPath(args.plan ?? `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`);
const intakePath = resolveInputPath(
  args.intake ?? `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526.json`,
);
const runtimeBlockerPath = resolveInputPath(
  args.runtimeBlocker ?? `${reviewDir}/answer-quality-local-full-shard-003-runtime-blocker-20260526.json`,
);
const resumeResultDoctorPath = resolveInputPath(
  args.resumeResultDoctor ?? `${reviewDir}/local-full-shard-002-resume-result-doctor-20260526.json`,
);
const recoveryArmExportPath = resolveInputPath(
  args.recoveryArmExport ?? `${reviewDir}/answer-quality-local-full-shard-003-arm-export-20260527.json`,
);
const recoveryPreflightPath = resolveInputPath(
  args.recoveryPreflight ?? `${reviewDir}/answer-quality-local-full-shard-003-preflight-20260527.json`,
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const planState = loadRequiredJson(planPath, "local-full shard plan");
const intakeState = loadRequiredJson(intakePath, "local-full shard intake");
const runtimeBlockerState = loadOptionalJson(runtimeBlockerPath, "local-full runtime blocker");
const resumeResultDoctorState = loadOptionalJson(resumeResultDoctorPath, "local-full resume result doctor");
const recoveryArmExportState = loadOptionalJson(recoveryArmExportPath, "local-full shard recovery arm export");
const recoveryPreflightState = loadOptionalJson(recoveryPreflightPath, "local-full shard recovery preflight");
const plan = planState.json;
const intake = intakeState.json;
const runtimeBlocker = runtimeBlockerState.json;
const resumeResultDoctor = resumeResultDoctorState.json;
const recoveryArmExport = recoveryArmExportState.json;
const recoveryPreflight = recoveryPreflightState.json;
const acceptedShardStates = loadAcceptedShardStates(intake);
const acceptedResults = acceptedShardStates.filter((state) => state.present).map((state) => state.json);
const strategySummaries = summarizeStrategies(acceptedResults);
const coverage = summarizeCoverage({ plan, intake, acceptedResults });
const bm25 = strategySummaries.find((item) => item.strategy === "bm25-lite") ?? null;
const bestAnswerQuality = bestBy(strategySummaries, (item) => item.answerQuality);
const lowestLatency = bestBy(
  strategySummaries.filter((item) => item.answerLatencyP50Ms != null),
  (item) => -item.answerLatencyP50Ms,
);
const localApple = summarizeLocalApple(strategySummaries);
const runtime = summarizeRuntimeBlocker({
  runtimeState: runtimeBlockerState,
  runtimeReport: runtimeBlocker,
  resultDoctorState: resumeResultDoctorState,
  resultDoctor: resumeResultDoctor,
  recoveryArmExportState,
  recoveryArmExport,
  recoveryPreflightState,
  recoveryPreflight,
});
const blockers = [
  plan.mode !== "public-benchmark-answer-quality-shard-plan" ? "local-full-plan-mode-mismatch" : null,
  (plan.runPlan?.claimScope ?? plan.claimScope) !== "local-full" ? "local-full-plan-claim-scope-mismatch" : null,
  intake.mode !== "public-benchmark-answer-quality-shard-intake" ? "local-full-intake-mode-mismatch" : null,
  acceptedShardStates.some((state) => !state.present) ? "accepted-shard-result-file-missing" : null,
  acceptedShardStates.some((state) => state.hashMismatch) ? "accepted-shard-result-hash-mismatch" : null,
  acceptedResults.length === 0 ? "local-full-accepted-shards-missing" : null,
  !bm25 ? "bm25-baseline-missing" : null,
  !bestAnswerQuality ? "best-answer-quality-unavailable" : null,
  coverage.acceptedShardCount < coverage.shardCount ? "local-full-coverage-incomplete" : null,
  runtime.runtimeBlockedShardCount > 0 ? "local-full-runtime-blocker-present" : null,
  runtime.recovery?.retrievalRecovered === true && runtime.recovery?.answerQualityPreflightReady !== true
    ? "local-full-shard-003-scoring-env-missing"
    : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-shard-performance-report",
  status: coverage.acceptedShardCount > 0 ? "PARTIAL_LOCAL_FULL_PERFORMANCE_SNAPSHOT" : "NO_LOCAL_FULL_PERFORMANCE_YET",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  callsLocalEndpoint: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsPrivatePaths: false,
  printsEnvValues: false,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  readyForShardCombine: false,
  readyForEndToEndMemoryScoreGate: false,
  performanceSnapshotMature: coverage.completeCoverage,
  plan: {
    path: planState.path,
    hash: planState.hash,
    claimScope: plan.runPlan?.claimScope ?? plan.claimScope ?? null,
    queryCount: Number(plan.runPlan?.queryCount ?? 0),
    shardCount: Number(plan.runPlan?.shardCount ?? 0),
    shardSize: Number(plan.runPlan?.shardSize ?? 0),
    strategies: plan.runPlan?.strategies ?? [],
  },
  intake: {
    path: intakeState.path,
    hash: intakeState.hash,
    status: intake.status ?? null,
    acceptedShardCount: Number(intake.intake?.acceptedShardCount ?? 0),
    missingShardCount: Number(intake.intake?.missingShardCount ?? 0),
    rejectedShardCount: Number(intake.intake?.rejectedShardCount ?? 0),
    completeCoverage: Boolean(intake.intake?.completeCoverage),
  },
  coverage,
  acceptedShardInputs: acceptedShardStates.map((state) => ({
    fileName: state.fileName,
    hash: state.hash,
    expectedHash: state.expectedHash,
    hashMatches: state.hashMismatch ? false : state.present,
    present: state.present,
    startIndex: state.startIndex,
    endIndexExclusive: state.endIndexExclusive,
    scoredQueryCount: state.scoredQueryCount,
  })),
  strategySummaries,
  bestAnswerQuality: bestAnswerQuality
    ? withBaselineDeltas(bestAnswerQuality, bm25)
    : null,
  lowestLatency: lowestLatency
    ? withBaselineDeltas(lowestLatency, bm25)
    : null,
  localApple,
  runtime,
  blockers,
  nextActions: [
    runtime.recovery?.retrievalRecovered === true
      ? `Score and intake ${runtime.recovery.shardId ?? coverage.nextPendingShardId} before treating the next 25-query slice as accepted.`
      : coverage.nextPendingShardId
        ? `Finish or rerun ${coverage.nextPendingShardId} before treating the next 25-query slice as accepted.`
        : "No next local-full shard is pending; run shard intake and combine gates before any claim changes.",
    "Regenerate this report after each accepted local-full shard to track quality and latency without claiming SOTA.",
    "Only use combine and full-memory SOTA gates after local-full or full-SOTA intake reports complete non-overlapping shard coverage.",
  ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local-full shard performance report");
assertSafePublicText(markdownText, "local-full shard performance markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function loadAcceptedShardStates(intakeReport) {
  return arrayOf(intakeReport.acceptedShards).map((accepted) => {
    const path = resolveInputPath(join(reviewDir, accepted.fileName));
    if (!existsSync(path) || statSync(path).size === 0) {
      return {
        fileName: accepted.fileName,
        path: displayPath(path),
        present: false,
        expectedHash: accepted.hash ?? null,
        hash: null,
        hashMismatch: false,
        json: null,
        startIndex: accepted.startIndex ?? null,
        endIndexExclusive: accepted.endIndexExclusive ?? null,
        scoredQueryCount: accepted.scoredQueryCount ?? null,
      };
    }
    const state = loadJson(path, `accepted shard ${accepted.fileName}`);
    const range = state.json.input?.queryShard ?? {};
    return {
      fileName: accepted.fileName,
      path: state.path,
      present: true,
      expectedHash: accepted.hash ?? null,
      hash: state.hash,
      hashMismatch: accepted.hash ? state.hash !== accepted.hash : false,
      json: state.json,
      startIndex: Number(range.startIndex ?? accepted.startIndex ?? 0),
      endIndexExclusive: Number(range.endIndexExclusive ?? accepted.endIndexExclusive ?? 0),
      scoredQueryCount: Number(state.json.input?.scoredQueryCount ?? accepted.scoredQueryCount ?? 0),
    };
  });
}

function summarizeStrategies(results) {
  const rows = new Map();
  for (const result of results) {
    const resultScored = Number(result.input?.scoredQueryCount ?? 0);
    for (const entry of arrayOf(result.strategies)) {
      const strategy = String(entry.strategy ?? "");
      if (!strategy) continue;
      const scoredQueryCount = Number(entry.scoredQueryCount ?? resultScored);
      const row =
        rows.get(strategy) ??
        {
          strategy,
          shardCount: 0,
          scoredQueryCount: 0,
          answerQualityNumerator: 0,
          qualityNumerator: 0,
          judgeCorrectRateNumerator: 0,
          answerLatencyP50Numerator: 0,
          answerLatencyP95Numerator: 0,
          contextTokensNumerator: 0,
        };
      row.shardCount += 1;
      row.scoredQueryCount += scoredQueryCount;
      row.answerQualityNumerator += Number(entry.metrics?.answerQuality ?? 0) * scoredQueryCount;
      row.qualityNumerator += Number(entry.metrics?.quality ?? 0) * scoredQueryCount;
      row.judgeCorrectRateNumerator += Number(entry.metrics?.judgeCorrectRate ?? 0) * scoredQueryCount;
      row.answerLatencyP50Numerator += Number(entry.metrics?.answerLatencyP50Ms ?? 0) * scoredQueryCount;
      row.answerLatencyP95Numerator += Number(entry.metrics?.answerLatencyP95Ms ?? 0) * scoredQueryCount;
      row.contextTokensNumerator += Number(entry.metrics?.contextTokensAvg ?? 0) * scoredQueryCount;
      rows.set(strategy, row);
    }
  }
  return [...rows.values()]
    .map((row) => ({
      strategy: row.strategy,
      shardCount: row.shardCount,
      scoredQueryCount: row.scoredQueryCount,
      answerQuality: weighted(row.answerQualityNumerator, row.scoredQueryCount),
      quality: weighted(row.qualityNumerator, row.scoredQueryCount),
      judgeCorrectRate: weighted(row.judgeCorrectRateNumerator, row.scoredQueryCount),
      answerLatencyP50Ms: weighted(row.answerLatencyP50Numerator, row.scoredQueryCount),
      answerLatencyP95Ms: weighted(row.answerLatencyP95Numerator, row.scoredQueryCount),
      contextTokensAvg: weighted(row.contextTokensNumerator, row.scoredQueryCount),
    }))
    .sort((left, right) => right.answerQuality - left.answerQuality || left.answerLatencyP50Ms - right.answerLatencyP50Ms);
}

function summarizeCoverage({ plan: planValue, intake: intakeValue, acceptedResults: results }) {
  const queryCount = Number(planValue.runPlan?.queryCount ?? 0);
  const shardCount = Number(planValue.runPlan?.shardCount ?? 0);
  const acceptedShardCount = Number(intakeValue.intake?.acceptedShardCount ?? results.length);
  const missingShardCount = Number(intakeValue.intake?.missingShardCount ?? Math.max(0, shardCount - acceptedShardCount));
  const acceptedQueryCount = results.reduce((sum, result) => sum + Number(result.input?.scoredQueryCount ?? 0), 0);
  const nextMissing = arrayOf(intakeValue.missingShards)[0] ?? null;
  return {
    acceptedShardCount,
    missingShardCount,
    shardCount,
    acceptedQueryCount,
    queryCount,
    coveragePercent: round(queryCount > 0 ? (acceptedQueryCount / queryCount) * 100 : 0),
    completeCoverage: Boolean(intakeValue.intake?.completeCoverage),
    nextPendingShardId: nextMissing?.shardId ?? null,
    nextPendingShardRange:
      nextMissing?.startIndex != null && nextMissing?.endIndexExclusive != null
        ? `${nextMissing.startIndex}-${nextMissing.endIndexExclusive}`
        : null,
  };
}

function summarizeLocalApple(strategies) {
  const base = strategies.find((item) => item.strategy === "local-apple-qwen3-0_6b") ?? null;
  const rerank = strategies.find((item) => item.strategy === "local-apple-qwen3-0_6b-local-rerank") ?? null;
  const bm25 = strategies.find((item) => item.strategy === "bm25-lite") ?? null;
  return {
    base: base ? withBaselineDeltas(base, bm25) : null,
    rerank: rerank ? withBaselineDeltas(rerank, bm25) : null,
    rerankDeltaVsBase: base && rerank ? deltaSummary(rerank, base) : null,
  };
}

function summarizeRuntimeBlocker({
  runtimeState,
  runtimeReport,
  resultDoctorState,
  resultDoctor,
  recoveryArmExportState,
  recoveryArmExport,
  recoveryPreflightState,
  recoveryPreflight,
}) {
  const recovery = inspectRuntimeRecovery({
    runtimeReport,
    recoveryArmExportState,
    recoveryArmExport,
    recoveryPreflightState,
    recoveryPreflight,
  });
  const activeRuntimeBlocked = Boolean(runtimeState.present && !recovery.retrievalRecovered);
  return {
    runtimeBlockerPresent: activeRuntimeBlocked,
    runtimeBlockedShardCount: activeRuntimeBlocked ? 1 : 0,
    historicalRuntimeBlockerPresent: Boolean(runtimeState.present),
    historicalRuntimeBlockedShardCount: runtimeState.present ? 1 : 0,
    runtimeBlockerStatus: runtimeReport?.status ?? null,
    runtimeRecoveryStatus: recovery.status,
    runtimeBlockedShardId: runtimeReport?.queryShard?.shardId ?? null,
    runtimeBlockedRange:
      runtimeReport?.queryShard?.startIndex != null && runtimeReport?.queryShard?.endIndexExclusive != null
        ? `${runtimeReport.queryShard.startIndex}-${runtimeReport.queryShard.endIndexExclusive}`
        : null,
    failedArm: runtimeReport?.failedArm?.strategy ?? null,
    failureClass: runtimeReport?.failedArm?.failureClass ?? null,
    completedArmCount: Number(runtimeReport?.partialAttempt?.completedArmCount ?? 0),
    missingArmCount: Number(runtimeReport?.partialAttempt?.missingArmCount ?? 0),
    missingStrategies: arrayOf(runtimeReport?.partialAttempt?.missingStrategies),
    recovery,
    resumeResultDoctorPresent: Boolean(resultDoctorState.present),
    resumeResultDoctorStatus: resultDoctor?.status ?? null,
    resumeReadyForLocalShardIntake: Boolean(resultDoctor?.readyForLocalShardIntake),
    resumeBlockers: arrayOf(resultDoctor?.blockers),
  };
}

function inspectRuntimeRecovery({ runtimeReport, recoveryArmExportState, recoveryArmExport, recoveryPreflightState, recoveryPreflight }) {
  const failedArm = runtimeReport?.failedArm?.strategy ?? null;
  const shardId = runtimeReport?.queryShard?.shardId ?? null;
  const armRows = arrayOf(recoveryArmExport?.arms);
  const recoveredArm = armRows.find((arm) => arm.strategy === failedArm) ?? null;
  const selectedShard = recoveryPreflight?.queryShard ?? null;
  const expectedStart = Number(runtimeReport?.queryShard?.startIndex ?? Number.NaN);
  const expectedEnd = Number(runtimeReport?.queryShard?.endIndexExclusive ?? Number.NaN);
  const shardMatches =
    Number(selectedShard?.startIndex ?? Number.NaN) === expectedStart &&
    Number(selectedShard?.endIndexExclusive ?? Number.NaN) === expectedEnd;
  const armExportReady =
    recoveryArmExport?.mode === "public-benchmark-answer-quality-arm-export" &&
    recoveryArmExport?.status === "EXPORTED_RESPONSE_ARMS" &&
    recoveryArmExport?.readyForAnswerQualityPreflight === true &&
    recoveryArmExport?.publicSafe === true &&
    recoveryArmExport?.metricsOnly === true &&
    recoveredArm?.exported === true &&
    Number(recoveredArm?.responseCount ?? 0) === Number(runtimeReport?.queryShard?.queryCount ?? 25);
  const preflightReadyForScoring =
    recoveryPreflight?.mode === "public-benchmark-answer-quality-preflight" &&
    recoveryPreflight?.status === "READY_FOR_LIVE_ANSWER_QUALITY" &&
    recoveryPreflight?.readiness?.liveAnswerQualityCanRun === true;
  const retrievalRecovered =
    armExportReady &&
    recoveryPreflight?.mode === "public-benchmark-answer-quality-preflight" &&
    recoveryPreflight?.readiness?.armsReady === true &&
    recoveryPreflight?.readiness?.sameDataReady === true &&
    recoveryPreflight?.readiness?.responseArmsCoverSelectedShard === true &&
    shardMatches;
  return {
    status: retrievalRecovered
      ? preflightReadyForScoring
        ? "RETRIEVAL_AND_SCORING_READY"
        : "RETRIEVAL_RECOVERED_SCORING_PENDING"
      : "RUNTIME_BLOCKER_ACTIVE",
    shardId,
    failedArm,
    armExportPresent: Boolean(recoveryArmExportState.present),
    armExportStatus: recoveryArmExport?.status ?? null,
    armExportReady,
    armExportHash: recoveryArmExportState.hash,
    recoveredArmHash: recoveredArm?.hash ?? null,
    recoveredArmResponseCount: Number(recoveredArm?.responseCount ?? 0),
    preflightPresent: Boolean(recoveryPreflightState.present),
    preflightStatus: recoveryPreflight?.status ?? null,
    preflightHash: recoveryPreflightState.hash,
    responseArmsReady: Boolean(recoveryPreflight?.readiness?.armsReady),
    sameDataReady: Boolean(recoveryPreflight?.readiness?.sameDataReady),
    responseArmsCoverSelectedShard: Boolean(recoveryPreflight?.readiness?.responseArmsCoverSelectedShard),
    selectedShardMatchesRuntimeBlocker: shardMatches,
    retrievalRecovered,
    answerQualityPreflightReady: preflightReadyForScoring,
    answerQualityEnvReady: Boolean(recoveryPreflight?.readiness?.envReady),
    blockers: arrayOf(recoveryPreflight?.blockers),
  };
}

function withBaselineDeltas(row, baseline) {
  return {
    ...row,
    deltaVsBm25: baseline ? deltaSummary(row, baseline) : null,
  };
}

function deltaSummary(row, baseline) {
  return {
    answerQuality: round(row.answerQuality - baseline.answerQuality),
    quality: round(row.quality - baseline.quality),
    judgeCorrectRate: round(row.judgeCorrectRate - baseline.judgeCorrectRate),
    answerLatencyP50Ms: round(row.answerLatencyP50Ms - baseline.answerLatencyP50Ms),
    answerLatencyP95Ms: round(row.answerLatencyP95Ms - baseline.answerLatencyP95Ms),
    contextTokensAvg: round(row.contextTokensAvg - baseline.contextTokensAvg),
  };
}

function renderMarkdown(value) {
  return [
    "# Local-Full Shard Performance Report",
    "",
    `- Status: ${value.status}`,
    `- Accepted shards: ${value.coverage.acceptedShardCount}/${value.coverage.shardCount}`,
    `- Accepted queries: ${value.coverage.acceptedQueryCount}/${value.coverage.queryCount}`,
    `- Coverage: ${value.coverage.coveragePercent}%`,
    `- Next pending shard: ${value.coverage.nextPendingShardId ?? "n/a"} (${value.coverage.nextPendingShardRange ?? "n/a"})`,
    `- Performance snapshot mature: ${value.performanceSnapshotMature}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    "",
    "## Best Current Strategy",
    `- Strategy: ${value.bestAnswerQuality?.strategy ?? "n/a"}`,
    `- Answer quality: ${value.bestAnswerQuality?.answerQuality ?? "n/a"}`,
    `- Delta vs BM25: ${value.bestAnswerQuality?.deltaVsBm25?.answerQuality ?? "n/a"}`,
    `- P50 latency ms: ${value.bestAnswerQuality?.answerLatencyP50Ms ?? "n/a"}`,
    "",
    "## Local Apple",
    `- Base answer quality: ${value.localApple.base?.answerQuality ?? "n/a"}`,
    `- Rerank answer quality: ${value.localApple.rerank?.answerQuality ?? "n/a"}`,
    `- Rerank delta vs base: ${value.localApple.rerankDeltaVsBase?.answerQuality ?? "n/a"}`,
    "",
    "## Runtime",
    `- Runtime blocker status: ${value.runtime.runtimeBlockerStatus ?? "n/a"}`,
    `- Runtime recovery status: ${value.runtime.runtimeRecoveryStatus ?? "n/a"}`,
    `- Active runtime-blocked shards: ${value.runtime.runtimeBlockedShardCount}`,
    `- Historical runtime-blocked shards: ${value.runtime.historicalRuntimeBlockedShardCount}`,
    `- Failed arm: ${value.runtime.failedArm ?? "n/a"}`,
    `- Failure class: ${value.runtime.failureClass ?? "n/a"}`,
    `- Recovery arm export ready: ${value.runtime.recovery?.armExportReady ?? false}`,
    `- Recovery preflight same-data ready: ${value.runtime.recovery?.sameDataReady ?? false}`,
    `- Recovery scoring env ready: ${value.runtime.recovery?.answerQualityEnvReady ?? false}`,
    `- Resume result doctor: ${value.runtime.resumeResultDoctorStatus ?? "n/a"}`,
    "",
    "## Strategy Summary",
    ...value.strategySummaries.map(
      (item) =>
        `- ${item.strategy}: answerQuality=${item.answerQuality}; p50=${item.answerLatencyP50Ms}; scored=${item.scoredQueryCount}`,
    ),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function loadRequiredJson(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  return loadJson(path, label);
}

function loadOptionalJson(path, label) {
  if (!existsSync(path) || statSync(path).size === 0) {
    return {
      path: displayPath(path),
      hash: null,
      present: false,
      json: null,
    };
  }
  return loadJson(path, label);
}

function loadJson(path, label) {
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return {
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    present: true,
    json: JSON.parse(raw),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function resolveInputPath(pathLike) {
  const value = String(pathLike);
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : "external-file";
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function bestBy(items, score) {
  return items.reduce((best, item) => (best == null || score(item) > score(best) ? item : best), null);
}

function weighted(numerator, denominator) {
  return round(denominator > 0 ? numerator / denominator : 0);
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10000) / 10000 : null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
  assert.equal(secretPattern.test(text), false, `${label} contains secret-shaped text`);
  assert.equal(privatePathPattern.test(text), false, `${label} contains absolute private path`);
  assert.equal(privateTagPattern.test(text), false, `${label} contains private tag`);
}
