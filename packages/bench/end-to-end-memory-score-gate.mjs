import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const resultPath = args.result ? resolve(root, args.result) : null;
const targetPath = resolve(root, args.target ?? "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
const reportedTargetsPath = resolve(
  root,
  args.reportedTargets ?? process.env.RECALLWEAVE_REPORTED_TARGETS_INPUT ?? "reviews/overnight-20260522/reported-memory-targets-20260525.json",
);
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const reviewerApprovalReportPath = args.reviewerApprovalReport ?? args.reviewerReport ?? process.env.RECALLWEAVE_MEMORY_SCORE_REVIEWER_APPROVAL_REPORT ?? null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const fixtureProxySmoke = Boolean(args.fixtureProxySmoke);
const claimScope = String(args.claimScope ?? process.env.RECALLWEAVE_MEMORY_SCORE_CLAIM_SCOPE ?? "full-sota").trim();
const reportedTargetId = String(args.reportedTargetId ?? process.env.RECALLWEAVE_REPORTED_TARGET_ID ?? "").trim();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(
  ["full-sota", "local-full", "model-challenger"].includes(claimScope),
  "--claim-scope must be full-sota, local-full, or model-challenger",
);
assert.ok(existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "target");
const target = JSON.parse(targetRaw);
const loaded = loadResult();
const reportedTargetsEvidence = loadReportedTargetsEvidence();
const reviewerApproval = loadReviewerApprovalReport();
const report = buildGateReport({ loaded, target, targetRaw, reportedTargetsEvidence, reviewerApproval });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "end-to-end memory score gate");
assertSafePublicText(markdownText, "end-to-end memory score gate markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && claimScope === "full-sota" && !report.countsAsFullMemorySotaEvidence) process.exit(1);
if (requireReady && claimScope === "local-full" && !report.countsAsLocalFullBenchmarkEvidence) process.exit(1);
if (requireReady && claimScope === "model-challenger" && !report.countsAsModelChallengerReportedScoreEvidence) process.exit(1);

function loadResult() {
  if (fixtureProxySmoke) {
    const result = spawnSync(
      "node",
      [
        "packages/bench/public-benchmark-strategy-compare.mjs",
        "--fixture",
        "--strategies",
        "bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(result.status, 0, `fixture strategy compare failed\n${result.stderr}\n${result.stdout}`);
    assertSafePublicText(result.stdout, "fixture retrieval-proxy result");
    return {
      source: "generated-fixture-retrieval-proxy-smoke",
      path: null,
      exists: true,
      json: JSON.parse(result.stdout),
      hash: `sha256:${sha256(result.stdout)}`,
    };
  }
  if (!resultPath || !existsSync(resultPath)) {
    return {
      source: "missing-result",
      path: resultPath ? displayPath(resultPath) : null,
      exists: false,
      json: null,
      hash: null,
    };
  }
  assert.ok(statSync(resultPath).size > 0, `result empty: ${displayPath(resultPath)}`);
  const text = readFileSync(resultPath, "utf8");
  assertSafePublicText(text, displayPath(resultPath));
  return {
    source: "result-file",
    path: displayPath(resultPath),
    exists: true,
    json: JSON.parse(text),
    hash: `sha256:${sha256(text)}`,
  };
}

function loadReviewerApprovalReport() {
  if (!reviewerApprovalReportPath || !existsSync(resolve(root, reviewerApprovalReportPath))) {
    return {
      source: "missing-reviewer-approval-report",
      path: reviewerApprovalReportPath ? displayPath(resolve(root, reviewerApprovalReportPath)) : null,
      exists: false,
      json: null,
      hash: null,
    };
  }
  const path = resolve(root, reviewerApprovalReportPath);
  assert.ok(statSync(path).size > 0, `reviewer approval report empty: ${displayPath(path)}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, displayPath(path));
  const json = JSON.parse(text);
  assert.equal(json.mode, "memory-score-reviewer-approval-intake", "reviewer approval report must be memory-score-reviewer-approval-intake");
  return {
    source: "reviewer-approval-report-file",
    path: displayPath(path),
    exists: true,
    json,
    hash: `sha256:${sha256(text)}`,
  };
}

function loadReportedTargetsEvidence() {
  if (!existsSync(reportedTargetsPath)) {
    return {
      source: "missing-reported-targets",
      path: displayPath(reportedTargetsPath),
      exists: false,
      json: null,
      hash: null,
      status: "MISSING_REPORTED_TARGETS",
      blockers: ["reported-targets-file-missing"],
    };
  }
  assert.ok(statSync(reportedTargetsPath).size > 0, `reported targets empty: ${displayPath(reportedTargetsPath)}`);
  const result = spawnSync(
    "node",
    ["packages/bench/public-benchmark-reported-targets.mjs", "--input", displayPath(reportedTargetsPath)],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    return {
      source: "reported-targets-validation-failed",
      path: displayPath(reportedTargetsPath),
      exists: true,
      json: null,
      hash: null,
      status: "BLOCKED_REPORTED_TARGETS",
      blockers: ["reported-targets-validation-failed"],
    };
  }
  assertSafePublicText(result.stdout, "reported targets evidence");
  const json = JSON.parse(result.stdout);
  return {
    source: "reported-targets-report",
    path: displayPath(reportedTargetsPath),
    exists: true,
    json,
    hash: `sha256:${sha256(result.stdout)}`,
    status: json.status ?? null,
    blockers: Array.isArray(json.blockers) ? json.blockers : [],
  };
}

function buildGateReport({ loaded, target, targetRaw, reportedTargetsEvidence, reviewerApproval }) {
  const result = loaded.json;
  const effectiveClaimScope = String(result?.claimScope ?? result?.scoringPolicy?.claimScope ?? claimScope);
  const claimScopeMatchesRequest = effectiveClaimScope === claimScope;
  const isLocalFull = effectiveClaimScope === "local-full";
  const isFullSota = effectiveClaimScope === "full-sota";
  const isModelChallenger = effectiveClaimScope === "model-challenger";
  const rows = normalizeRows(result);
  const rowNames = rows.map((item) => item.strategy ?? item.armId).filter(Boolean);
  const answerMetric = bestAnswerMetric(rows, result);
  const fullBenchmarkPolicy = buildFullBenchmarkPolicy({ target, result, rows });
  const selectedReportedTarget = selectReportedTarget(reportedTargetsEvidence.json, { isModelChallenger });
  const primaryReportedTarget = selectedReportedTarget ?? null;
  const reviewerApprovalCount = reviewerApproval.exists ? Number(reviewerApproval.json?.reviewerApprovalCount ?? 0) : 0;
  const targetBenchmark = target.benchmark?.family ?? target.benchmark?.name;
  const targetScoringHash = target.benchmark?.scoringCodeHash ?? null;
  const targetAnswerLabelsHash = target.benchmark?.answerLabelsHash ?? null;
  const targetAnswerModel = target.benchmark?.answerModel ?? null;
  const targetJudgeModel = target.benchmark?.judgeModel ?? null;
  const targetHash = `sha256:${sha256(targetRaw)}`;
  const resultTargetHash = result?.target?.hash ?? result?.input?.targetHash ?? result?.sourceLock?.targetHash ?? null;
  const resultScoringHash = result?.scoringCodeHash ?? result?.input?.scoringCodeHash ?? result?.target?.scoringCodeHash ?? null;
  const resultAnswerLabelsHash = result?.answerLabelsHash ?? result?.input?.answerLabelsHash ?? result?.target?.answerLabelsHash ?? null;
  const resultAnswerModel = extractActualAnswerModel(result);
  const resultJudgeModel = extractActualJudgeModel(result);
  const modelMatchPolicy = String(result?.scoringPolicy?.modelMatchPolicy ?? (isLocalFull ? "local-diagnostic-allowed" : "exact-target-required"));
  const localDiagnosticScoringSatisfied =
    isLocalFull &&
    modelMatchPolicy === "local-diagnostic-allowed" &&
    typeof resultAnswerModel === "string" &&
    resultAnswerModel.length > 0 &&
    typeof resultJudgeModel === "string" &&
    resultJudgeModel.length > 0 &&
    (result?.scoringPolicy?.localDiagnosticEndpointSatisfied === true || result?.provider?.endpointIsLocal === true);
  const exactTargetScoringSatisfied =
    Boolean(targetAnswerModel) &&
    Boolean(targetJudgeModel) &&
    resultAnswerModel === targetAnswerModel &&
    resultJudgeModel === targetJudgeModel;
  const challengerModelScoringSatisfied =
    isModelChallenger &&
    modelMatchPolicy === "challenger-model-allowed" &&
    typeof resultAnswerModel === "string" &&
    resultAnswerModel.length > 0 &&
    typeof resultJudgeModel === "string" &&
    resultJudgeModel.length > 0;
  const scoringModelPolicySatisfied = isLocalFull
    ? localDiagnosticScoringSatisfied
    : isModelChallenger
      ? challengerModelScoringSatisfied
      : exactTargetScoringSatisfied;
  const reportedTargetComparison = compareReportedTarget({
    answerMetric,
    resultAnswerModel,
    resultJudgeModel,
    targetBenchmark,
    primaryReportedTarget,
  });
  const reviewerTarget = reviewerApproval.json?.target ?? {};
  const reviewerApprovalReportTargetBound =
    reviewerApproval.exists &&
    reviewerTarget.resultHash === loaded.hash &&
    (!resultTargetHash || reviewerTarget.targetHash === resultTargetHash) &&
    (!resultScoringHash || reviewerTarget.scoringCodeHash === resultScoringHash) &&
    (!resultAnswerLabelsHash || reviewerTarget.answerLabelsHash === resultAnswerLabelsHash) &&
    (!resultAnswerModel || reviewerTarget.answerModel === resultAnswerModel) &&
    (!resultJudgeModel || reviewerTarget.judgeModel === resultJudgeModel);
  const checks = {
    resultExists: loaded.exists,
    modeRecognized: [
      "end-to-end-memory-score",
      "memorybench-answer-quality",
      "public-benchmark-answer-quality",
      "public-benchmark-memory-score",
    ].includes(String(result?.mode ?? "")),
    metricsOnly: result?.metricsOnly === true,
    publicSafe: result?.publicSafe === true,
    fixtureOnlyFalse: result?.fixtureOnly === false,
    retrievalProxyOnlyFalse: result?.retrievalProxyOnly === false,
    memoryBenchAnswerQualityTrue: result?.memoryBenchAnswerQuality === true,
    publicClaimsDisabledBeforeReview:
      result?.publicBenchmarkClaimsAllowed === false || (reviewerApprovalCount >= 2 && result?.publicBenchmarkClaimsAllowed === true),
    rawQuestionsExcluded: result?.rawQuestionsIncluded === false,
    rawAnswersExcluded: result?.rawAnswersIncluded === false,
    rawMemoryExcluded: result?.rawMemoryIncluded === false,
    rawTranscriptExcluded: result?.rawTranscriptIncluded === false,
    sourceLockedTarget:
      result?.input?.source === "materialized-source-locked-longmemeval" ||
      result?.sourceLock?.sameDataAttestation === true ||
      result?.target?.sourceLocked === true,
    claimScopeMatchesRequest,
    targetHashMatches: resultTargetHash === targetHash,
    benchmarkMatchesTarget: result?.benchmark === targetBenchmark || result?.benchmark?.family === targetBenchmark || result?.target?.benchmark === targetBenchmark,
    querySetHashPresent: typeof (result?.input?.querySetHash ?? result?.querySetHash) === "string" && String(result?.input?.querySetHash ?? result?.querySetHash).startsWith("sha256:"),
    materializerHashPresent:
      typeof (result?.input?.materializerHash ?? result?.materializerHash) === "string" &&
      String(result?.input?.materializerHash ?? result?.materializerHash).startsWith("sha256:"),
    scoringCodeHashMatches: Boolean(targetScoringHash) && resultScoringHash === targetScoringHash,
    answerLabelsHashMatches: Boolean(targetAnswerLabelsHash) && resultAnswerLabelsHash === targetAnswerLabelsHash,
    answerModelPresent: typeof resultAnswerModel === "string" && resultAnswerModel.length > 0,
    judgeModelPresent: typeof resultJudgeModel === "string" && resultJudgeModel.length > 0,
    answerModelMatchesTarget: Boolean(targetAnswerModel) && resultAnswerModel === targetAnswerModel,
    judgeModelMatchesTarget: Boolean(targetJudgeModel) && resultJudgeModel === targetJudgeModel,
    scoringModelPolicySatisfied,
    localDiagnosticScoringSatisfied,
    challengerModelScoringSatisfied,
    answerQualityMetricPresent: answerMetric.value != null && Number.isFinite(Number(answerMetric.value)),
    answerQualityMetricInRange: answerMetric.value != null && Number(answerMetric.value) >= 0 && Number(answerMetric.value) <= 100,
    bm25ControlPresent: hasAny(rowNames, ["bm25-lite"]),
    denseControlPresent: hasAny(rowNames, ["dense-proxy", "local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]),
    fullHybridControlPresent: hasAny(rowNames, ["full-hybrid-rerank"]),
    queryExpansionArmPresent: hasAny(rowNames, ["query-expanded-full-hybrid-rerank"]),
    voyageProviderArmPresent: hasAny(rowNames, ["cloud-voyage4-voyage", "cloud-voyage4-voyage-lite-rerank", "cloud-voyage4-lite-voyage-lite"]),
    nvidiaOrGeminiProviderArmPresent: rowNames.some((name) => String(name).startsWith("cloud-nvidia-") || name === "cloud-gemini-voyage-rerank"),
    localAppleArmPresent: hasAny(rowNames, ["local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]),
    localRerankArmPresent: hasAny(rowNames, ["local-apple-qwen3-0_6b-local-rerank", "local-apple-qwen3-4b-local-rerank"]),
    reviewerApprovalReportPresent: reviewerApproval.exists,
    reviewerApprovalReportReady:
      reviewerApproval.json?.publicBenchmarkApprovalReady === true && reviewerApproval.json?.countsAsFullMemorySotaReview === true,
    reviewerApprovalReportTargetBound,
    reviewerApprovalsPresent: reviewerApprovalCount >= 2,
    privacyLeakCountersClear: rows.every((item) => Number(item.privacyLeakCount ?? 0) === 0 && Number(item.redactionFailureCount ?? 0) === 0),
    reportedTargetsSourceLocked: reportedTargetsEvidence.status === "READY_REPORTED_TARGETS",
    primaryReportedMemoryTargetPresent: Boolean(primaryReportedTarget),
    reportedTargetBenchmarkMatchesResult: reportedTargetComparison.sameBenchmarkFamilyAsPrimaryTarget === true,
    reportedTargetJudgeMatchesResult: reportedTargetComparison.sameJudgeModelAsPrimaryTarget === true,
    reportedTargetAnswerModelComparable: reportedTargetComparison.answerModelComparable !== false,
    fullOrOfficiallyComparableRunPresent: fullBenchmarkPolicy.fullOrOfficiallyComparableRunPresent === true,
    scoreMeetsPrimaryReportedTarget: reportedTargetComparison.scoreMeetsPrimaryReportedTarget === true,
    modelChallengerReportedScoreComparisonReady: reportedTargetComparison.meetsReportedScoreComparison === true,
  };

  const blockers = [
    !checks.resultExists ? "missing-end-to-end-memory-score-file" : null,
    !checks.modeRecognized ? "result-not-end-to-end-memory-score-report" : null,
    !checks.metricsOnly ? "result-not-metrics-only" : null,
    !checks.publicSafe ? "result-not-public-safe" : null,
    !checks.fixtureOnlyFalse ? "fixture-result-cannot-count-as-end-to-end-memory-score" : null,
    !checks.retrievalProxyOnlyFalse ? "retrieval-proxy-result-cannot-count-as-answer-quality" : null,
    !checks.memoryBenchAnswerQualityTrue ? "memorybench-answer-quality-not-proven" : null,
    !checks.publicClaimsDisabledBeforeReview ? "public-claims-enabled-without-review" : null,
    !checks.rawQuestionsExcluded ? "raw-questions-included" : null,
    !checks.rawAnswersExcluded ? "raw-answers-included" : null,
    !checks.rawMemoryExcluded ? "raw-memory-included" : null,
    !checks.rawTranscriptExcluded ? "raw-transcript-included" : null,
    !checks.sourceLockedTarget ? "result-not-bound-to-source-locked-target" : null,
    !checks.claimScopeMatchesRequest ? "result-claim-scope-does-not-match-requested-gate" : null,
    !checks.targetHashMatches ? "target-hash-does-not-match-source-locked-target" : null,
    !checks.benchmarkMatchesTarget ? "benchmark-does-not-match-target" : null,
    !checks.querySetHashPresent ? "missing-query-set-hash" : null,
    !checks.materializerHashPresent ? "missing-materializer-hash" : null,
    !checks.scoringCodeHashMatches ? "scoring-code-hash-does-not-match-target" : null,
    !checks.answerLabelsHashMatches ? "answer-labels-hash-does-not-match-target" : null,
    !checks.answerModelPresent ? "missing-actual-answer-model" : null,
    !checks.judgeModelPresent ? "missing-actual-judge-model" : null,
    isFullSota && !checks.answerModelMatchesTarget ? "answer-model-does-not-match-target" : null,
    isFullSota && !checks.judgeModelMatchesTarget ? "judge-model-does-not-match-target" : null,
    isLocalFull && !checks.localDiagnosticScoringSatisfied ? "local-diagnostic-scoring-policy-not-satisfied" : null,
    isModelChallenger && !checks.challengerModelScoringSatisfied ? "challenger-model-scoring-policy-not-satisfied" : null,
    !checks.answerQualityMetricPresent ? "missing-answer-quality-score" : null,
    !checks.answerQualityMetricInRange ? "answer-quality-score-out-of-range" : null,
    !checks.bm25ControlPresent ? "missing-bm25-control" : null,
    !checks.denseControlPresent ? "missing-dense-or-vector-control" : null,
    !checks.fullHybridControlPresent ? "missing-full-hybrid-control" : null,
    !checks.queryExpansionArmPresent ? "missing-query-expansion-arm" : null,
    isFullSota && !checks.voyageProviderArmPresent ? "missing-voyage-provider-arm" : null,
    isFullSota && !checks.nvidiaOrGeminiProviderArmPresent ? "missing-nvidia-or-gemini-provider-arm" : null,
    !checks.localAppleArmPresent ? "missing-local-apple-arm" : null,
    !checks.localRerankArmPresent ? "missing-local-rerank-arm" : null,
    isFullSota && !checks.reviewerApprovalReportPresent ? "missing-memory-score-reviewer-approval-report" : null,
    isFullSota && checks.reviewerApprovalReportPresent && !checks.reviewerApprovalReportReady
      ? "memory-score-reviewer-approval-report-not-ready"
      : null,
    isFullSota && checks.reviewerApprovalReportPresent && !checks.reviewerApprovalReportTargetBound
      ? "memory-score-reviewer-approval-report-not-bound-to-result"
      : null,
    isFullSota && !checks.reviewerApprovalsPresent ? "missing-two-independent-reviewer-approvals" : null,
    !checks.privacyLeakCountersClear ? "privacy-or-redaction-counter-nonzero" : null,
  ].filter(Boolean);

  const fullSotaBlockers = isFullSota
    ? [
    !checks.reportedTargetsSourceLocked ? "reported-memory-targets-not-source-locked" : null,
    !checks.primaryReportedMemoryTargetPresent ? "missing-primary-reported-memory-target" : null,
    checks.primaryReportedMemoryTargetPresent && !checks.reportedTargetBenchmarkMatchesResult ? "reported-target-benchmark-does-not-match-result" : null,
    checks.primaryReportedMemoryTargetPresent && !checks.reportedTargetJudgeMatchesResult ? "reported-target-judge-model-does-not-match-result" : null,
    checks.primaryReportedMemoryTargetPresent && !checks.reportedTargetAnswerModelComparable ? "reported-target-answer-model-does-not-match-result" : null,
    !checks.fullOrOfficiallyComparableRunPresent ? "missing-full-or-officially-comparable-memory-benchmark-run" : null,
      checks.primaryReportedMemoryTargetPresent && !checks.scoreMeetsPrimaryReportedTarget ? "best-end-to-end-score-below-primary-reported-memory-target" : null,
    ].filter(Boolean)
    : [isLocalFull ? "local-full-diagnostic-result-not-sota-comparable" : "model-challenger-result-not-strict-sota-comparable"];
  const modelChallengerBlockers = isModelChallenger
    ? [
        !checks.reportedTargetsSourceLocked ? "reported-memory-targets-not-source-locked" : null,
        !checks.primaryReportedMemoryTargetPresent ? "missing-selected-reported-memory-target" : null,
        checks.primaryReportedMemoryTargetPresent && !checks.reportedTargetBenchmarkMatchesResult
          ? "reported-target-benchmark-does-not-match-result"
          : null,
        !checks.fullOrOfficiallyComparableRunPresent ? "missing-full-or-officially-comparable-memory-benchmark-run" : null,
        checks.primaryReportedMemoryTargetPresent && !checks.scoreMeetsPrimaryReportedTarget
          ? "best-end-to-end-score-below-selected-reported-memory-target"
          : null,
      ].filter(Boolean)
    : ["not-a-model-challenger-claim-scope"];
  const countsAsEndToEndMemoryBenchmark = blockers.length === 0;
  const countsAsLocalFullBenchmarkEvidence = isLocalFull && countsAsEndToEndMemoryBenchmark;
  const countsAsFullMemorySotaEvidence = isFullSota && countsAsEndToEndMemoryBenchmark && fullSotaBlockers.length === 0;
  const countsAsModelChallengerReportedScoreEvidence =
    isModelChallenger && countsAsEndToEndMemoryBenchmark && modelChallengerBlockers.length === 0;
  const activeClaimBlockers = isFullSota ? fullSotaBlockers : isModelChallenger ? modelChallengerBlockers : [];
  const readyModelChallengerClaim = buildModelChallengerClaim({
    ready: countsAsModelChallengerReportedScoreEvidence,
    reportedTargetComparison,
  });

  return {
    schemaVersion: 1,
    ok: true,
    mode: "end-to-end-memory-score-gate",
    status: blockers.length === 0
      ? isLocalFull
        ? "READY_LOCAL_FULL_MEMORY_SCORE"
        : isModelChallenger
          ? "READY_MODEL_CHALLENGER_MEMORY_SCORE"
          : "READY_END_TO_END_MEMORY_SCORE"
      : "BLOCKED_END_TO_END_MEMORY_SCORE",
    claimScope: effectiveClaimScope,
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    publicBenchmarkClaimsAllowed: false,
    countsAsEndToEndMemoryBenchmark,
    countsAsLocalFullBenchmarkEvidence,
    countsAsFullMemorySotaEvidence,
    countsAsModelChallengerReportedScoreEvidence,
    reason:
      countsAsFullMemorySotaEvidence
        ? "Same-data answer-quality result is source-locked, reviewed, and eligible for the full memory SOTA ladder."
        : countsAsModelChallengerReportedScoreEvidence
          ? "Same-data answer-quality result is source-locked and beats the selected reported Supermemory score as an explicitly labeled stronger-model challenger lane, not strict same-model SOTA evidence."
        : countsAsLocalFullBenchmarkEvidence
          ? "Same-data local-full answer-quality result is source-locked and eligible as local diagnostic benchmark evidence, but not SOTA evidence."
        : blockers.length
          ? "Result is missing, retrieval-only, fixture-only, unreviewed, or otherwise insufficient for end-to-end memory quality claims."
          : "Result passes the end-to-end memory-score checks, but still lacks the full-run or reported-target comparison needed for SOTA evidence.",
    target: {
      path: displayPath(targetPath),
      hash: targetHash,
      benchmark: targetBenchmark ?? null,
      claimTier: target.claimTier ?? null,
      scoringCodeHash: targetScoringHash,
      answerLabelsHash: targetAnswerLabelsHash,
      answerModel: targetAnswerModel,
      judgeModel: targetJudgeModel,
    },
    result: {
      source: loaded.source,
      path: loaded.path,
      hash: loaded.hash,
      fixtureOnly: Boolean(result?.fixtureOnly),
      mode: result?.mode ?? null,
      benchmark: typeof result?.benchmark === "string" ? result.benchmark : result?.benchmark?.family ?? null,
      targetHash: resultTargetHash,
      querySetHash: result?.input?.querySetHash ?? result?.querySetHash ?? null,
      materializerHash: result?.input?.materializerHash ?? result?.materializerHash ?? null,
      scoringCodeHash: resultScoringHash,
      answerLabelsHash: resultAnswerLabelsHash,
      answerModel: resultAnswerModel,
      judgeModel: resultJudgeModel,
      scoredQueryCount: fullBenchmarkPolicy.currentAnswerQualityQueryCount,
      totalQueryCount: fullBenchmarkPolicy.totalQueryCount,
      answerQualityMetric: answerMetric,
      reviewerApprovalCount,
      arms: rowNames,
    },
    scoringPolicy: {
      modelMatchPolicy,
      exactTargetModelsRequired: isFullSota,
      localDiagnosticModelAllowed: isLocalFull,
      challengerModelAllowed: isModelChallenger,
      scoringModelPolicySatisfied,
      localDiagnosticScoringSatisfied,
      challengerModelScoringSatisfied,
      modelMismatchAllowed: isLocalFull || isModelChallenger,
      countsAsFullMemorySotaEvidence: false,
      countsAsLocalFullBenchmarkEvidence,
      countsAsModelChallengerReportedScoreEvidence,
    },
    reportedTargetsEvidence: {
      source: reportedTargetsEvidence.source,
      path: reportedTargetsEvidence.path,
      hash: reportedTargetsEvidence.hash,
      exists: reportedTargetsEvidence.exists,
      status: reportedTargetsEvidence.status,
      primaryReportedMemoryTarget: primaryReportedTarget?.id ?? null,
      memoryTargetCount: Number(reportedTargetsEvidence.json?.checks?.memoryTargetCount ?? 0),
      componentTargetCount: Number(reportedTargetsEvidence.json?.checks?.componentTargetCount ?? 0),
      blockers: reportedTargetsEvidence.blockers,
    },
    reportedTargetComparison,
    modelChallengerClaim: readyModelChallengerClaim,
    fullBenchmarkPolicy,
    reviewerApproval: {
      source: reviewerApproval.source,
      path: reviewerApproval.path,
      hash: reviewerApproval.hash,
      exists: reviewerApproval.exists,
      status: reviewerApproval.json?.status ?? null,
      publicBenchmarkApprovalReady: Boolean(reviewerApproval.json?.publicBenchmarkApprovalReady),
      countsAsFullMemorySotaReview: Boolean(reviewerApproval.json?.countsAsFullMemorySotaReview),
      reviewerApprovalCount,
      independentReviewerCount: Number(reviewerApproval.json?.independentReviewerCount ?? 0),
      targetBound: reviewerApprovalReportTargetBound,
    },
    checks,
    blockers,
    fullSotaBlockers,
    modelChallengerBlockers,
    nextActions: blockers.length || activeClaimBlockers.length
      ? isLocalFull
        ? [
            "Run the same-data local-full answer-quality harness across the full 500-query target.",
            "Include BM25, full-hybrid, live query-expansion, local Apple, and local reranker arms on the exact source-locked target.",
            "Keep SOTA and production-replacement claims blocked until the exact-scoring full provider/SOTA lane passes.",
            "Attach only metrics-only public-safe output, then send the local-full packet to independent reviewers before release wording changes.",
          ]
        : isModelChallenger
          ? [
              "Run the same-data LongMemEval/MemoryBench answer-quality harness across the full target with the selected stronger answer/judge model.",
              "Compare the resulting score to the selected reported Supermemory row with --reported-target-id, keeping same-judge/SOTA wording separate.",
              "Attach only metrics-only public-safe output, then send the model-challenger packet to independent reviewers before public wording changes.",
            ]
        : [
            "Run the same-data LongMemEval/MemoryBench answer-quality harness across the full target or an officially comparable benchmark target.",
            "Include BM25, dense/vector, full-hybrid, live query-expansion, provider challenger, local Apple, and local reranker arms on the exact source-locked target.",
            "Beat the source-locked reported memory-system target under matching benchmark and judge semantics before claiming full-memory SOTA evidence.",
            "Attach only metrics-only public-safe output, then re-run this gate with --require-ready before SOTA ladder promotion.",
            "Send the exact gate-passing packet to two independent reviewers before owner/public release approval.",
          ]
      : [
          "Attach this gate report to the benchmark packet and reviewer packet.",
          "Update UI evidence, docs, and release notes against the reviewed result before owner approval.",
        ],
  };
}

function normalizeRows(result) {
  if (!result || typeof result !== "object") return [];
  const candidates = [
    ...(Array.isArray(result.strategies) ? result.strategies : []),
    ...(Array.isArray(result.arms) ? result.arms : []),
    ...(Array.isArray(result.results) ? result.results : []),
  ];
  return candidates.filter((item) => item && typeof item === "object");
}

function bestAnswerMetric(rows, result) {
  const direct =
    result?.metrics?.answerQuality ??
    result?.metrics?.memoryScore ??
    result?.metrics?.longmemevalScore ??
    result?.score ??
    result?.answerQualityScore ??
    null;
  if (direct != null) return { name: "result", value: Number(direct) };
  for (const row of rows) {
    const value = row.metrics?.answerQuality ?? row.metrics?.memoryScore ?? row.metrics?.longmemevalScore ?? row.answerQualityScore ?? row.score;
    if (value != null && Number.isFinite(Number(value))) {
      return { name: row.strategy ?? row.armId ?? "row", value: Number(value) };
    }
  }
  return { name: null, value: null };
}

function buildFullBenchmarkPolicy({ target, result, rows }) {
  const targetClaimTier = target?.claimTier ?? null;
  const benchmarkFamily = target?.benchmark?.family ?? target?.benchmark?.name ?? null;
  const datasetSlice = target?.benchmark?.split ?? null;
  const scoredQueryCandidates = [
    finiteNumber(result?.input?.scoredQueryCount),
    finiteNumber(result?.queryShard?.scoredQueryCount),
    finiteNumber(result?.scoredQueryCount),
    ...rows.flatMap((row) => [
      finiteNumber(row.scoredQueryCount),
      finiteNumber(row.input?.scoredQueryCount),
    ]),
  ];
  const fallbackQueryCountCandidates = [
    finiteNumber(result?.queryShard?.queryCount),
    finiteNumber(result?.queryCount),
    ...rows.flatMap((row) => [finiteNumber(row.queryCount), finiteNumber(row.input?.queryCount)]),
  ];
  const totalQueryCount = Math.max(
    finiteNumber(result?.input?.totalQueryCount),
    finiteNumber(result?.input?.queryCount),
    finiteNumber(result?.queryShard?.totalQueryCount),
    finiteNumber(target?.benchmark?.queryCount),
    ...fallbackQueryCountCandidates,
  );
  const currentAnswerQualityQueryCount = Math.max(...scoredQueryCandidates);
  const effectiveAnswerQualityQueryCount =
    currentAnswerQualityQueryCount > 0 ? currentAnswerQualityQueryCount : Math.max(...fallbackQueryCountCandidates);
  const minimumFullQueryCount = String(benchmarkFamily ?? "").toLowerCase().includes("longmemeval") ? 500 : null;
  const fullQueryCountPresent = minimumFullQueryCount != null && effectiveAnswerQualityQueryCount >= minimumFullQueryCount;
  const officiallyComparableClaimTier = ["public-benchmark", "full-benchmark", "officially-comparable", "broad-sota"].includes(
    String(targetClaimTier ?? ""),
  );
  return {
    requirement:
      "Broad SOTA or production-replacement wording requires a full benchmark run or an explicitly official comparable target, not only a canary slice.",
    benchmarkFamily,
    datasetSlice,
    targetClaimTier,
    currentAnswerQualityQueryCount: effectiveAnswerQualityQueryCount,
    totalQueryCount,
    minimumFullQueryCount,
    fullQueryCountPresent,
    officiallyComparableClaimTier,
    fullOrOfficiallyComparableRunPresent: fullQueryCountPresent || officiallyComparableClaimTier,
    currentCanaryOnly: !fullQueryCountPresent && !officiallyComparableClaimTier,
  };
}

function selectReportedTarget(json, { isModelChallenger }) {
  const targets = Array.isArray(json?.memoryTargets) ? json.memoryTargets : [];
  if (reportedTargetId) {
    return targets.find((target) => target.id === reportedTargetId) ?? null;
  }
  if (isModelChallenger) {
    return targets.find((target) => target.id === "supermemory-production-research-gpt4o") ?? json?.primaryReportedMemoryTarget ?? null;
  }
  return json?.primaryReportedMemoryTarget ?? null;
}

function compareReportedTarget({ answerMetric, resultAnswerModel, resultJudgeModel, targetBenchmark, primaryReportedTarget }) {
  const score = answerMetric.value != null && Number.isFinite(Number(answerMetric.value)) ? Number(answerMetric.value) : null;
  const targetScore =
    primaryReportedTarget?.score != null && Number.isFinite(Number(primaryReportedTarget.score)) ? Number(primaryReportedTarget.score) : null;
  const targetJudgeModel = primaryReportedTarget?.judge ?? primaryReportedTarget?.judgeModel ?? null;
  const reportedBenchmark = primaryReportedTarget?.benchmarkFamily ?? primaryReportedTarget?.benchmark ?? null;
  const answerModelReported = primaryReportedTarget?.answerModelReported === true;
  const sameBenchmarkFamilyAsPrimaryTarget =
    primaryReportedTarget != null && normalizeBenchmark(targetBenchmark) === normalizeBenchmark(reportedBenchmark);
  const sameJudgeModelAsPrimaryTarget =
    resultJudgeModel != null && targetJudgeModel != null && normalizeModel(resultJudgeModel) === normalizeModel(targetJudgeModel);
  const answerModelComparable = answerModelReported
    ? resultAnswerModel != null && normalizeModel(resultAnswerModel) === normalizeModel(primaryReportedTarget?.answerModel)
    : null;
  const scoreMeetsPrimaryReportedTarget = score != null && targetScore != null && score >= targetScore;
  const meetsReportedScoreComparison =
    scoreMeetsPrimaryReportedTarget &&
    sameBenchmarkFamilyAsPrimaryTarget &&
    answerModelComparable !== false;
  return {
    primaryTarget: primaryReportedTarget
      ? {
          id: primaryReportedTarget.id,
          systemName: primaryReportedTarget.systemName ?? null,
          benchmark: primaryReportedTarget.benchmark,
          benchmarkFamily: primaryReportedTarget.benchmarkFamily ?? null,
          score: primaryReportedTarget.score,
          scoreUnit: primaryReportedTarget.scoreUnit,
          judgeModel: targetJudgeModel,
          answerModel: firstString(primaryReportedTarget.answerModel),
          answerModelReported,
          source: primaryReportedTarget.source ?? primaryReportedTarget.sourceUrl,
          caveat: primaryReportedTarget.caveat,
        }
      : null,
    observed: {
      metricName: answerMetric.name ?? null,
      score,
      scoreUnit: "answer-quality percent",
      benchmarkFamily: targetBenchmark ?? null,
      answerModel: resultAnswerModel,
      judgeModel: resultJudgeModel,
    },
    scoreDelta: score != null && targetScore != null ? Number((score - targetScore).toFixed(4)) : null,
    sameBenchmarkFamilyAsPrimaryTarget,
    sameJudgeModelAsPrimaryTarget,
    answerModelComparable,
    scoreMeetsPrimaryReportedTarget,
    meetsReportedScoreComparison,
    meetsPrimaryReportedTarget:
      scoreMeetsPrimaryReportedTarget &&
      sameBenchmarkFamilyAsPrimaryTarget &&
      sameJudgeModelAsPrimaryTarget &&
      answerModelComparable !== false,
    sameJudgeStrictComparisonRequired: true,
    reportedScoreOnlyComparisonAllowed: true,
    matchingBenchmarkSemanticsRequired: true,
    comparisonRule:
      "Strict SOTA requires same-benchmark, same-scoring, same-judge full-memory answer-quality evidence. A model-challenger claim may compare a clearly labeled stronger-model RecallWeave score to a selected reported Supermemory score without treating it as strict same-model SOTA.",
  };
}

function buildModelChallengerClaim({ ready, reportedTargetComparison }) {
  const target = reportedTargetComparison.primaryTarget;
  const observed = reportedTargetComparison.observed ?? {};
  const answerModel = observed.answerModel ?? "missing-answer-model";
  const judgeModel = observed.judgeModel ?? "missing-judge-model";
  const modelPhrase = answerModel === judgeModel ? answerModel : `${answerModel} answer / ${judgeModel} judge`;
  const targetSystem = target?.systemName ?? "Supermemory";
  const targetJudge = target?.judgeModel ?? "reported";
  const targetScore = target?.score ?? "missing";
  const targetUnit = target?.scoreUnit ?? "percent";
  const observedScore = observed.score ?? "missing";
  const delta = reportedTargetComparison.scoreDelta ?? "missing";
  const benchmark = target?.benchmark ?? observed.benchmarkFamily ?? "selected benchmark";
  const selectedTargetId = target?.id ?? "missing";
  const statement = ready
    ? `RecallWeave ran ${benchmark} answer-quality with ${modelPhrase} and surpassed ${targetSystem}'s reported ${targetJudge} score (${targetScore} ${targetUnit}) with ${observedScore} ${targetUnit}, a +${delta} point delta.`
    : `No model-challenger claim is ready yet; run the full same-data answer-quality benchmark with the selected challenger model and beat ${targetSystem}'s reported ${targetJudge} score (${targetScore} ${targetUnit}).`;
  return {
    ready,
    statement,
    selectedReportedTargetId: selectedTargetId,
    observedModel: modelPhrase,
    observedScore,
    reportedSystem: targetSystem,
    reportedJudgeModel: targetJudge,
    reportedScore: targetScore,
    reportedScoreUnit: targetUnit,
    scoreDelta: delta,
    strictSameModelSotaEvidence: false,
    caveat: "This statement is valid only as a labeled model-challenger comparison; strict SOTA still requires matching judge/model semantics.",
  };
}

function extractActualAnswerModel(result) {
  return firstString(
    result?.provider?.answerModel,
    result?.input?.answerModel,
    result?.answerModel,
    result?.models?.answerModel,
    result?.model?.answerModel,
  );
}

function extractActualJudgeModel(result) {
  return firstString(
    result?.provider?.judgeModel,
    result?.input?.judgeModel,
    result?.judgeModel,
    result?.models?.judgeModel,
    result?.model?.judgeModel,
  );
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function hasAny(values, wanted) {
  const set = new Set(values);
  return wanted.some((item) => set.has(item));
}

function renderMarkdown(value) {
  return [
    "# End-to-End Memory Score Gate",
    "",
    `- Status: ${value.status}`,
    `- Claim scope: ${value.claimScope}`,
    `- Counts as end-to-end memory benchmark: ${value.countsAsEndToEndMemoryBenchmark}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Counts as model-challenger reported-score evidence: ${value.countsAsModelChallengerReportedScoreEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Target: ${value.target.path}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Full SOTA Blockers",
    ...(value.fullSotaBlockers.length ? value.fullSotaBlockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Model-Challenger Blockers",
    ...(value.modelChallengerBlockers.length ? value.modelChallengerBlockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Result",
    `- Source: ${value.result.source}`,
    `- Fixture only: ${value.result.fixtureOnly}`,
    `- Answer model: ${value.result.answerModel ?? "missing"} (target ${value.target.answerModel ?? "missing"})`,
    `- Judge model: ${value.result.judgeModel ?? "missing"} (target ${value.target.judgeModel ?? "missing"})`,
    `- Scored queries: ${value.result.scoredQueryCount}`,
    `- Answer quality metric: ${value.result.answerQualityMetric.name ?? "missing"}=${value.result.answerQualityMetric.value ?? "missing"}`,
    `- Reviewer approvals: ${value.result.reviewerApprovalCount}`,
    `- Arms: ${value.result.arms.join(", ") || "none"}`,
    `- Model match policy: ${value.scoringPolicy.modelMatchPolicy}`,
    `- Scoring model policy satisfied: ${value.scoringPolicy.scoringModelPolicySatisfied}`,
    "",
    "## Reported Target",
    `- Source lock status: ${value.reportedTargetsEvidence.status ?? "missing"}`,
    `- Primary target: ${value.reportedTargetComparison.primaryTarget?.id ?? "missing"} (${value.reportedTargetComparison.primaryTarget?.score ?? "missing"} ${value.reportedTargetComparison.primaryTarget?.scoreUnit ?? ""})`,
    `- Score delta: ${value.reportedTargetComparison.scoreDelta ?? "missing"}`,
    `- Same benchmark family: ${value.reportedTargetComparison.sameBenchmarkFamilyAsPrimaryTarget}`,
    `- Same judge model: ${value.reportedTargetComparison.sameJudgeModelAsPrimaryTarget}`,
    `- Meets reported score comparison: ${value.reportedTargetComparison.meetsReportedScoreComparison}`,
    `- Meets reported target: ${value.reportedTargetComparison.meetsPrimaryReportedTarget}`,
    "",
    "## Model-Challenger Claim",
    `- Ready: ${value.modelChallengerClaim.ready}`,
    `- Statement: ${value.modelChallengerClaim.statement}`,
    `- Caveat: ${value.modelChallengerClaim.caveat}`,
    "",
    "## Full Benchmark Policy",
    `- Dataset slice: ${value.fullBenchmarkPolicy.datasetSlice ?? "missing"}`,
    `- Current answer-quality query count: ${value.fullBenchmarkPolicy.currentAnswerQualityQueryCount}`,
    `- Total query count: ${value.fullBenchmarkPolicy.totalQueryCount}`,
    `- Minimum full query count: ${value.fullBenchmarkPolicy.minimumFullQueryCount ?? "missing"}`,
    `- Full or officially comparable run present: ${value.fullBenchmarkPolicy.fullOrOfficiallyComparableRunPresent}`,
    "",
    "## Reviewer Approval",
    `- Report exists: ${value.reviewerApproval.exists}`,
    `- Report status: ${value.reviewerApproval.status ?? "missing"}`,
    `- Target bound: ${value.reviewerApproval.targetBound}`,
    `- Independent reviewers: ${value.reviewerApproval.independentReviewerCount}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
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

function displayPath(path) {
  return String(path).replace(root, "").replace(/^\/+/, "") || ".";
}

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeBenchmark(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeModel(value) {
  return String(value ?? "").trim().toLowerCase();
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
}
