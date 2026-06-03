import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const planPath = resolveInputPath(args.plan ?? "reviews/overnight-20260522/answer-quality-full-shard-plan-20260525.json");
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const maxWorkorders = positiveInt(args.maxWorkorders ?? args.max ?? Number.MAX_SAFE_INTEGER, "max workorders");
const inputs = inputPaths();
const runtimeBlockerInputs = runtimeBlockerPaths();

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(planPath), `shard plan missing: ${displayPath(planPath)}`);
assert.ok(statSync(planPath).size > 0, `shard plan empty: ${displayPath(planPath)}`);
const planRaw = readFileSync(planPath, "utf8");
assertSafePublicText(planRaw, "shard plan");
const plan = JSON.parse(planRaw);
assert.equal(plan.mode, "public-benchmark-answer-quality-shard-plan", "plan must be a full answer-quality shard plan");

const loaded = inputs.map(loadCandidateResult);
const evaluated = evaluateExistingShardResults({ plan, loaded });
const runtimeBlockerState = evaluateRuntimeBlockers({ plan, loaded: runtimeBlockerInputs.map(loadRuntimeBlocker) });
const pendingShards = (plan.shards ?? []).filter((shard) => !evaluated.acceptedByShardId.has(shard.id));
const selectedPendingShards = pendingShards.slice(0, maxWorkorders);
const allExpectedPublicInputs = (plan.shards ?? []).map(
  (shard) => shard.answerQualityOutputLabel ?? `<public-review-dir>/answer-quality-${shard.id}.json`,
);
const readyForShardIntake = pendingShards.length === 0 && evaluated.rejectedResults.length === 0 && evaluated.duplicateResults.length === 0;
const executionLaneReadiness = buildExecutionLaneReadiness(plan.executionLanes ?? []);
const acceptedLaneReadiness = executionLaneReadiness.find((lane) => lane.acceptedByFullShardIntake === true) ?? null;
const fullSotaLaneReadiness = executionLaneReadiness.find((lane) => lane.laneId === "full-sota-accepted-shards") ?? null;
const claimScope = String(plan.runPlan?.claimScope ?? "full-sota");
const intakeOutputStem =
  claimScope === "local-full" ? "answer-quality-local-full-shard-intake" : "answer-quality-full-shard-intake";
const shardIntakeScript =
  claimScope === "local-full" ? "benchmark:answer-quality:local-shard-intake" : "benchmark:answer-quality:shard-intake";

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "public-benchmark-answer-quality-shard-workorder",
  status: readyForShardIntake ? "READY_TO_RUN_FULL_ANSWER_QUALITY_SHARD_INTAKE" : "PENDING_FULL_ANSWER_QUALITY_SHARD_RUNS",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  readyForShardIntake,
  readyForShardCombine: false,
  readyForEndToEndMemoryScoreGate: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  generatedAt: new Date().toISOString(),
  plan: {
    path: displayPath(planPath),
    hash: `sha256:${sha256(planRaw)}`,
    claimScope: plan.runPlan?.claimScope ?? null,
    targetHash: plan.target?.hash ?? null,
    queryCount: plan.runPlan?.queryCount ?? null,
    shardSize: plan.runPlan?.shardSize ?? null,
    shardCount: plan.runPlan?.shardCount ?? null,
    strategies: plan.runPlan?.strategies ?? [],
  },
  executionLanes: plan.executionLanes ?? [],
  executionLaneReadiness,
  acceptedLaneReadiness,
  acceptedLaneReadyForResponseArmExport: Boolean(acceptedLaneReadiness?.readyForResponseArmExport),
  acceptedLaneReadyForAnswerQualityScoring: Boolean(acceptedLaneReadiness?.readyForAnswerQualityScoring),
  acceptedLaneEnvironmentBlockers: acceptedLaneReadiness?.blockers ?? [],
  fullSotaLaneReadiness,
  fullSotaLaneReadyForResponseArmExport: Boolean(fullSotaLaneReadiness?.readyForResponseArmExport),
  fullSotaLaneReadyForAnswerQualityScoring: Boolean(fullSotaLaneReadiness?.readyForAnswerQualityScoring),
  fullSotaLaneEnvironmentBlockers: fullSotaLaneReadiness?.blockers ?? [],
  progress: {
    inputCount: inputs.length,
    acceptedShardCount: evaluated.acceptedResults.length,
    pendingShardCount: pendingShards.length,
    rejectedResultCount: evaluated.rejectedResults.length,
    duplicateResultCount: evaluated.duplicateResults.length,
    workorderCount: selectedPendingShards.length,
  },
  acceptedShards: evaluated.acceptedResults,
  pendingShards: pendingShards.map(publicShardRow),
  rejectedResults: evaluated.rejectedResults,
  duplicateResults: evaluated.duplicateResults,
  runtimeBlockers: runtimeBlockerState.report,
  workorders: selectedPendingShards.map((shard) => buildWorkorder(plan, shard, runtimeBlockerState.byShardId.get(shard.id) ?? null)),
  gatedCommands: {
    shardIntake: [
      `npm exec --yes pnpm@10.23.0 -- ${shardIntakeScript}`,
      `--input ${allExpectedPublicInputs.join(",")}`,
      `--output <public-review-dir>/${intakeOutputStem}.json`,
      `--markdown-output <public-review-dir>/${intakeOutputStem}.md`,
      "--require-ready",
    ].join(" "),
    combineAfterIntakePasses: plan.runPlan?.combineCommand ?? null,
    resultGateAfterCombine: plan.runPlan?.resultGateCommand ?? null,
    reviewerIntakeAfterCombine: plan.runPlan?.reviewerIntakeCommand ?? null,
  },
  blockers: [
    pendingShards.length > 0 ? "answer-quality-shard-runs-pending" : null,
    evaluated.rejectedResults.length > 0 ? "answer-quality-shard-results-rejected" : null,
    evaluated.duplicateResults.length > 0 ? "answer-quality-shard-results-duplicated" : null,
  ].filter(Boolean),
  nextActions: readyForShardIntake
    ? [
        "Run benchmark:answer-quality:shard-intake with --require-ready against the accepted public shard-result JSONs.",
        "Run benchmark:answer-quality:combine only after shard intake reports READY_TO_COMBINE_FULL_ANSWER_QUALITY_SHARDS.",
        "Keep SOTA, public benchmark, and production-replacement claims blocked until result gate, reviewer intake, UI/docs, owner approval, and real canary all pass.",
      ]
    : [
        "Run the listed response-arm export and answer-quality commands for the pending shards.",
        "Re-run this workorder with the returned public shard-result JSONs to track progress.",
        "Do not run combine until benchmark:answer-quality:shard-intake passes with complete coverage.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "shard workorder report");
assertSafePublicText(markdownText, "shard workorder markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inputPaths() {
  const explicit = normalizeList([args.input, args.inputs].flatMap(coerceArray));
  const directory = args.directory ?? args.dir ?? null;
  if (!directory) return explicit;
  const dir = resolveInputPath(directory);
  assert.ok(existsSync(dir), `shard result directory missing: ${displayPath(dir)}`);
  const discovered = readdirSync(dir)
    .filter((name) => /^answer-quality(?:-[a-z]+)*-shard-\d{3}\.json$/u.test(name))
    .map((name) => join(dir, name));
  return [...explicit, ...discovered].sort();
}

function runtimeBlockerPaths() {
  return normalizeList([args.runtimeBlocker, args.runtimeBlockers].flatMap(coerceArray)).map(resolveInputPath);
}

function loadCandidateResult(pathLike) {
  const path = resolveInputPath(pathLike);
  assert.ok(existsSync(path), `shard result missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `shard result empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, displayPath(path));
  return {
    fileName: basename(path),
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json: JSON.parse(raw),
  };
}

function loadRuntimeBlocker(pathLike) {
  const path = resolveInputPath(pathLike);
  assert.ok(existsSync(path), `runtime blocker report missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `runtime blocker report empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, displayPath(path));
  return {
    fileName: basename(path),
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json: JSON.parse(raw),
  };
}

function evaluateExistingShardResults({ plan: planValue, loaded: loadedItems }) {
  const expected = new Map((planValue.shards ?? []).map((shard) => [rangeKey(shard), shard]));
  const acceptedByShardId = new Map();
  const acceptedResults = [];
  const rejectedResults = [];
  const duplicateResults = [];
  const seenRanges = new Set();
  for (const item of loadedItems) {
    const range = shardRange(item.json);
    const key = range ? rangeKey(range) : null;
    const expectedShard = key ? expected.get(key) : null;
    const failures = candidateFailures({ item, range, expectedShard, planValue });
    if (key && seenRanges.has(key)) {
      duplicateResults.push({ range: key, fileName: item.fileName, hash: item.hash });
      failures.push("duplicate-shard-range");
    }
    if (key) seenRanges.add(key);
    const row = {
      shardId: expectedShard?.id ?? null,
      range: key,
      startIndex: range?.startIndex ?? null,
      endIndexExclusive: range?.endIndexExclusive ?? null,
      scoredQueryCount: range?.scoredQueryCount ?? null,
      fileName: item.fileName,
      hash: item.hash,
    };
    if (failures.length) rejectedResults.push({ ...row, failures });
    else {
      acceptedResults.push(row);
      acceptedByShardId.set(expectedShard.id, row);
    }
  }
  acceptedResults.sort((left, right) => left.startIndex - right.startIndex);
  return { acceptedByShardId, acceptedResults, rejectedResults, duplicateResults };
}

function evaluateRuntimeBlockers({ plan: planValue, loaded: loadedItems }) {
  const expectedById = new Map((planValue.shards ?? []).map((shard) => [shard.id, shard]));
  const byShardId = new Map();
  const matched = [];
  const rejected = [];
  for (const item of loadedItems) {
    const shardId = String(item.json.queryShard?.shardId ?? "");
    const expectedShard = expectedById.get(shardId) ?? null;
    const failures = runtimeBlockerFailures({ item, expectedShard, planValue });
    const row = runtimeBlockerRow({ item, expectedShard, failures });
    if (failures.length) rejected.push(row);
    else {
      matched.push(row);
      byShardId.set(row.shardId, row);
    }
  }
  matched.sort((left, right) => left.startIndex - right.startIndex);
  rejected.sort((left, right) => (left.startIndex ?? 0) - (right.startIndex ?? 0));
  return {
    byShardId,
    report: {
      inputCount: loadedItems.length,
      matchedCount: matched.length,
      rejectedCount: rejected.length,
      resumeAvailableCount: matched.filter((item) => item.resumeAvailable).length,
      matched,
      rejected,
      blockers: rejected.length ? ["runtime-blocker-report-rejected"] : [],
    },
  };
}

function runtimeBlockerFailures({ item, expectedShard, planValue }) {
  const shard = item.json.queryShard ?? {};
  const completedStrategies = arrayOfStrings(item.json.partialAttempt?.completedStrategies);
  const missingStrategies = arrayOfStrings(item.json.partialAttempt?.missingStrategies);
  const plannedStrategies = arrayOfStrings(planValue.runPlan?.strategies);
  const completedEvidence = arrayOf(item.json.completedPrivateArmEvidence);
  return [
    item.json.mode !== "answer-quality-local-full-shard-runtime-blocker" ? "not-local-full-runtime-blocker-report" : null,
    item.json.publicSafe !== true ? "not-public-safe" : null,
    item.json.metricsOnly !== true ? "not-metrics-only" : null,
    item.json.claimScope !== planValue.runPlan?.claimScope ? "claim-scope-mismatch" : null,
    item.json.acceptedShard !== false ? "runtime-blocker-must-not-be-accepted-shard" : null,
    item.json.countsAsLocalFullBenchmarkEvidence !== false ? "local-full-claim-enabled" : null,
    item.json.countsAsFullMemorySotaEvidence !== false ? "sota-claim-enabled" : null,
    item.json.publicBenchmarkClaimsAllowed !== false ? "public-claims-enabled" : null,
    item.json.rawQuestionsIncluded !== false ? "raw-questions-included" : null,
    item.json.rawAnswersIncluded !== false ? "raw-answers-included" : null,
    item.json.rawMemoryIncluded !== false ? "raw-memory-included" : null,
    item.json.rawTranscriptIncluded !== false ? "raw-transcript-included" : null,
    item.json.rawPromptIncluded !== false ? "raw-prompt-included" : null,
    item.json.rawPrivateOutputPathIncluded !== false ? "raw-private-output-path-included" : null,
    !expectedShard ? "runtime-blocker-shard-not-in-plan" : null,
    expectedShard && Number(shard.queryOffset ?? shard.startIndex) !== Number(expectedShard.startIndex) ? "runtime-blocker-offset-mismatch" : null,
    expectedShard && Number(shard.maxQueries ?? shard.scoredQueryCount) !== Number(expectedShard.queryCount) ? "runtime-blocker-query-count-mismatch" : null,
    expectedShard && Number(shard.endIndexExclusive) !== Number(expectedShard.endIndexExclusive) ? "runtime-blocker-range-end-mismatch" : null,
    expectedShard && shard.rangeHash && shard.rangeHash !== expectedShard.rangeHash ? "runtime-blocker-range-hash-mismatch" : null,
    completedStrategies.length !== Number(item.json.partialAttempt?.completedArmCount ?? completedStrategies.length)
      ? "completed-arm-count-mismatch"
      : null,
    missingStrategies.length !== Number(item.json.partialAttempt?.missingArmCount ?? missingStrategies.length) ? "missing-arm-count-mismatch" : null,
    completedEvidence.length !== completedStrategies.length ? "completed-arm-evidence-count-mismatch" : null,
    missingStrategies.length === 0 ? "missing-strategy-list-empty" : null,
    completedStrategies.some((strategy) => !plannedStrategies.includes(strategy)) ? "completed-strategy-not-in-plan" : null,
    missingStrategies.some((strategy) => !plannedStrategies.includes(strategy)) ? "missing-strategy-not-in-plan" : null,
    completedStrategies.some((strategy) => missingStrategies.includes(strategy)) ? "strategy-listed-as-complete-and-missing" : null,
    [...completedStrategies, ...missingStrategies].sort().join(",") !== plannedStrategies.sort().join(",")
      ? "runtime-blocker-strategy-set-mismatch"
      : null,
    item.json.partialAttempt?.readyForAnswerQualityPreflight !== false ? "partial-attempt-preflight-should-be-blocked" : null,
    item.json.partialAttempt?.readyForShardIntake !== false ? "partial-attempt-intake-should-be-blocked" : null,
    item.json.failedArm?.strategy && !missingStrategies.includes(item.json.failedArm.strategy) ? "failed-arm-not-marked-missing" : null,
    completedEvidence.some((entry) => Number(entry.responseCount ?? 0) !== Number(expectedShard?.queryCount ?? 0))
      ? "completed-arm-response-count-mismatch"
      : null,
    completedEvidence.some((entry) => !String(entry.hash ?? "").startsWith("sha256:")) ? "completed-arm-hash-missing" : null,
  ].filter(Boolean);
}

function runtimeBlockerRow({ item, expectedShard, failures }) {
  const shard = item.json.queryShard ?? {};
  const completedStrategies = arrayOfStrings(item.json.partialAttempt?.completedStrategies);
  const missingStrategies = arrayOfStrings(item.json.partialAttempt?.missingStrategies);
  return {
    shardId: String(shard.shardId ?? expectedShard?.id ?? ""),
    startIndex: intOrNull(shard.startIndex ?? shard.queryOffset),
    endIndexExclusive: intOrNull(shard.endIndexExclusive),
    queryCount: intOrNull(shard.maxQueries ?? expectedShard?.queryCount),
    fileName: item.fileName,
    hash: item.hash,
    status: item.json.status ?? null,
    failureClass: item.json.failedArm?.failureClass ?? null,
    failedStrategy: item.json.failedArm?.strategy ?? null,
    publicSyntheticReproduced: item.json.publicSyntheticReproduction?.reproduced === true,
    completedArmCount: completedStrategies.length,
    missingArmCount: missingStrategies.length,
    completedStrategies,
    missingStrategies,
    completedPrivateArmEvidence: arrayOf(item.json.completedPrivateArmEvidence).map((entry) => ({
      strategy: entry.strategy,
      name: entry.name,
      pathLabel: entry.pathLabel,
      hash: entry.hash,
      responseCount: entry.responseCount,
      providerCallsMade: entry.providerCallsMade,
      queryExpansionCalls: entry.queryExpansionCalls,
      queryExpansionMode: entry.queryExpansionMode ?? null,
      queryExpansionModel: entry.queryExpansionModel ?? null,
    })),
    readyForAnswerQualityPreflight: item.json.partialAttempt?.readyForAnswerQualityPreflight === true,
    readyForShardIntake: item.json.partialAttempt?.readyForShardIntake === true,
    resumeAvailable: failures.length === 0 && completedStrategies.length > 0 && missingStrategies.length > 0,
    blockers: arrayOfStrings(item.json.blockers),
    failures,
  };
}

function candidateFailures({ item, range, expectedShard, planValue }) {
  const sourceCompatible = resultSourceCompatible(item.json, planValue);
  return [
    item.json.mode !== "public-benchmark-answer-quality" ? "not-answer-quality-report" : null,
    item.json.fixtureOnly !== false ? "fixture-result" : null,
    item.json.metricsOnly !== true ? "not-metrics-only" : null,
    item.json.publicSafe !== true ? "not-public-safe" : null,
    item.json.retrievalProxyOnly !== false ? "retrieval-proxy-only" : null,
    item.json.memoryBenchAnswerQuality !== true ? "memorybench-answer-quality-not-proven" : null,
    item.json.publicBenchmarkClaimsAllowed !== false ? "public-claims-enabled" : null,
    item.json.rawQuestionsIncluded !== false ? "raw-questions-included" : null,
    item.json.rawAnswersIncluded !== false ? "raw-answers-included" : null,
    item.json.rawMemoryIncluded !== false ? "raw-memory-included" : null,
    item.json.rawTranscriptIncluded !== false ? "raw-transcript-included" : null,
    item.json.target?.hash !== planValue.target?.hash ? "target-hash-mismatch" : null,
    item.json.input?.targetHash !== planValue.target?.hash ? "input-target-hash-mismatch" : null,
    !sourceCompatible.answerLabels ? "answer-labels-hash-mismatch" : null,
    item.json.input?.scoringCodeHash !== planValue.target?.scoringCodeHash ? "scoring-code-hash-mismatch" : null,
    !sourceCompatible.querySet ? "query-set-hash-mismatch" : null,
    item.json.input?.materializerHash !== planValue.materializeReport?.materializerHash ? "materializer-hash-mismatch" : null,
    Number(item.json.input?.totalQueryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "total-query-count-mismatch" : null,
    Number(item.json.input?.queryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "input-query-count-mismatch" : null,
    ...scoringModelFailures(item.json, planValue),
    Number(item.json.privacyLeakCount ?? 0) !== 0 ? "privacy-leak-count-nonzero" : null,
    Number(item.json.redactionFailureCount ?? 0) !== 0 ? "redaction-failure-count-nonzero" : null,
    !range ? "query-shard-range-missing" : null,
    range && !expectedShard ? "query-shard-range-not-in-plan" : null,
    range && Number(range.totalQueryCount) !== Number(planValue.runPlan?.queryCount ?? 0) ? "range-total-query-count-mismatch" : null,
    range && expectedShard && range.scoredQueryCount !== expectedShard.queryCount ? "scored-query-count-mismatch" : null,
    range && range.scoredQueryCount !== range.endIndexExclusive - range.startIndex ? "range-count-mismatch" : null,
    expectedShard && (item.json.input?.queryShard?.rangeHash ?? item.json.input?.queryShard?.selectedQueryIdHash) !== expectedShard.rangeHash
      ? "shard-range-hash-mismatch"
      : null,
    strategyNamesHash(item.json) !== planStrategyHash(planValue) ? "strategy-set-mismatch" : null,
  ].filter(Boolean);
}

function resultSourceCompatible(result, planValue) {
  const input = result.input ?? {};
  const shard = input.materializationShard ?? {};
  const materializedShard = shard.applied === true;
  const directAnswerLabels = input.answerLabelsHash === planValue.target?.answerLabelsHash;
  const shardAnswerLabels = materializedShard && input.targetAnswerLabelsHash === planValue.target?.answerLabelsHash;
  const directQuerySet = input.querySetHash === planValue.materializeReport?.collectorCompatibleQuerySetHash;
  const shardQuerySet =
    materializedShard &&
    Number(shard.totalQueryCount ?? input.totalQueryCount ?? 0) === Number(planValue.runPlan?.queryCount ?? 0) &&
    Number(shard.selectedCount ?? input.scoredQueryCount ?? 0) === Number(input.scoredQueryCount ?? 0);
  return {
    answerLabels: directAnswerLabels || shardAnswerLabels,
    querySet: directQuerySet || shardQuerySet,
  };
}

function buildWorkorder(planValue, shard, runtimeResume) {
  const shardMaterialize = replaceShardTokens(
    planValue.runPlan?.shardMaterializeTemplate ?? planValue.runPlan?.materializeCommand ?? "",
    shard,
  );
  const responseArmExport = replaceShardTokens(planValue.runPlan?.responseArmExportTemplate ?? "", shard);
  const preflight = replaceShardTokens(planValue.runPlan?.preflightTemplate ?? "", shard);
  const answerQuality = replaceShardTokens(planValue.runPlan?.answerQualityTemplate ?? "", shard);
  const missingArmResponseExport =
    runtimeResume?.resumeAvailable === true ? replaceStrategyList(responseArmExport, runtimeResume.missingStrategies) : null;
  return {
    shardId: shard.id,
    startIndex: shard.startIndex,
    endIndexExclusive: shard.endIndexExclusive,
    queryCount: shard.queryCount,
    expectedPublicResult: shard.answerQualityOutputLabel ?? `<public-review-dir>/answer-quality-${shard.id}.json`,
    expectedPublicMarkdown: shard.answerQualityMarkdownLabel ?? `<public-review-dir>/answer-quality-${shard.id}.md`,
    expectedPrivateShardDirectory: `<private-output-dir>/shards/${shard.id}`,
    expectedPrivateMaterializedDirectory: `<private-output-dir>/shards/${shard.id}/materialized`,
    expectedPrivateArmDirectory: `<private-output-dir>/shards/${shard.id}/arms`,
    runtimeResume: runtimeResume
      ? {
          sourceFileName: runtimeResume.fileName,
          sourceHash: runtimeResume.hash,
          status: runtimeResume.status,
          failureClass: runtimeResume.failureClass,
          failedStrategy: runtimeResume.failedStrategy,
          completedArmCount: runtimeResume.completedArmCount,
          missingArmCount: runtimeResume.missingArmCount,
          completedStrategies: runtimeResume.completedStrategies,
          missingStrategies: runtimeResume.missingStrategies,
          completedPrivateArmEvidence: runtimeResume.completedPrivateArmEvidence,
          readyForAnswerQualityPreflight: runtimeResume.readyForAnswerQualityPreflight,
          readyForShardIntake: runtimeResume.readyForShardIntake,
          resumeAvailable: runtimeResume.resumeAvailable,
          blockers: runtimeResume.blockers,
        }
      : null,
    commands: {
      shardMaterialize,
      responseArmExport,
      missingArmResponseExport,
      preflight,
      answerQuality,
    },
  };
}

function replaceShardTokens(template, shard) {
  return String(template)
    .replaceAll("{shardId}", shard.id)
    .replaceAll("{startIndex}", String(shard.startIndex))
    .replaceAll("{queryCount}", String(shard.queryCount));
}

function replaceStrategyList(command, strategies) {
  const strategyList = arrayOfStrings(strategies).join(",");
  if (!strategyList) return null;
  return String(command).replace(/--strategies\s+\S+/u, `--strategies ${strategyList}`);
}

function publicShardRow(shard) {
  return {
    shardId: shard.id,
    startIndex: shard.startIndex,
    endIndexExclusive: shard.endIndexExclusive,
    queryCount: shard.queryCount,
    rangeHash: shard.rangeHash,
  };
}

function buildExecutionLaneReadiness(lanes) {
  return lanes.map((lane) => {
    const strategies = lane.strategies ?? [];
    const providers = lane.providerRequirements ?? [];
    const providerReadiness = Object.fromEntries(providers.map((provider) => [provider, inspectProviderReadiness(provider)]));
    const exportReadiness = inspectResponseArmExportReadiness({ lane, providers, strategies, providerReadiness });
    const answerQualityReadiness = inspectAnswerQualityReadiness(lane);
    const queryExpansionReadiness = inspectQueryExpansionReadiness(lane);
    const blockers = unique([
      !lane.coverageReady ? "lane-strategy-coverage-missing" : null,
      ...exportReadiness.blockers,
      ...answerQualityReadiness.blockers,
      ...queryExpansionReadiness.blockers,
    ].filter(Boolean));
    return {
      laneId: lane.id,
      label: lane.label,
      acceptedByFullShardIntake: Boolean(lane.acceptedByFullShardIntake),
      canReachFullSotaGateAfterShardIntake: Boolean(lane.canReachFullSotaGateAfterShardIntake),
      diagnosticOnly: lane.acceptedByFullShardIntake !== true,
      coverageReady: Boolean(lane.coverageReady),
      strategies,
      providerRequirements: providers,
      providerReadiness,
      responseArmExport: exportReadiness,
      queryExpansion: queryExpansionReadiness,
      answerQuality: answerQualityReadiness,
      readyForResponseArmExport: lane.coverageReady === true && exportReadiness.ready && queryExpansionReadiness.readyForResponseArmExport,
      readyForAnswerQualityScoring:
        lane.coverageReady === true &&
        exportReadiness.ready &&
        queryExpansionReadiness.readyForAnswerQualityScoring &&
        answerQualityReadiness.ready,
      readyForAcceptedShardIntakeCandidate:
        lane.acceptedByFullShardIntake === true &&
        lane.coverageReady === true &&
        exportReadiness.ready &&
        queryExpansionReadiness.readyForAcceptedShardIntake &&
        answerQualityReadiness.ready,
      countsAsFullMemorySotaEvidence: false,
      publicBenchmarkClaimsAllowed: false,
      blockers,
    };
  });
}

function inspectResponseArmExportReadiness({ lane, providers, strategies, providerReadiness }) {
  const requiresProviderCalls = providers.some((provider) => provider !== "local-apple" && provider !== "local-rerank");
  const providerCredentialBlockers = providers.flatMap((provider) => {
    const state = providerReadiness[provider];
    return state?.ready ? [] : [`${provider}-credentials-missing`];
  });
  const blockers = [
    !truthyEnv("RECALLWEAVE_BASELINE_LIVE") ? "RECALLWEAVE_BASELINE_LIVE-not-enabled" : null,
    !truthyEnv("RECALLWEAVE_BASELINE_NO_RAW_TEXT") ? "RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed" : null,
    requiresProviderCalls && !truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS")
      ? "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled"
      : null,
    requiresProviderCalls && !truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA")
      ? "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed"
      : null,
    ...providerCredentialBlockers,
  ].filter(Boolean);
  return {
    laneId: lane.id,
    ready: blockers.length === 0,
    liveExportEnabled: truthyEnv("RECALLWEAVE_BASELINE_LIVE"),
    noRawTextConfirmed: truthyEnv("RECALLWEAVE_BASELINE_NO_RAW_TEXT"),
    providerCallsRequired: requiresProviderCalls,
    providerCallsEnabled: truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS"),
    providerPublicDataConfirmed: truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA"),
    queryExpansionStrategyPresent: strategies.includes("query-expanded-full-hybrid-rerank"),
    printsEnvValues: false,
    blockers,
  };
}

function inspectAnswerQualityReadiness(lane) {
  const baseUrl = String(process.env.RECALLWEAVE_MEMORYBENCH_BASE_URL ?? "").trim();
  const answerModel = envPresence("RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL", "RECALLWEAVE_BASELINE_ANSWER_MODEL");
  const judgeModel = envPresence("RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL", "RECALLWEAVE_BASELINE_JUDGE_MODEL");
  const targetAnswerModel = String(lane.answerQualityEndpoint?.targetAnswerModel ?? lane.answerQualityEndpoint?.answerModel ?? "").trim();
  const targetJudgeModel = String(lane.answerQualityEndpoint?.targetJudgeModel ?? lane.answerQualityEndpoint?.judgeModel ?? "").trim();
  const modelMatchPolicy = String(lane.answerQualityEndpoint?.modelMatchPolicy ?? "exact-target-required");
  const exactTargetModelsRequired = modelMatchPolicy === "exact-target-required";
  const localDiagnosticModelAllowed = modelMatchPolicy === "local-diagnostic-allowed";
  const challengerModelAllowed = modelMatchPolicy === "challenger-model-allowed";
  const answerModelMatchesTarget = answerModel.present && targetAnswerModel.length > 0 && answerModel.value === targetAnswerModel;
  const judgeModelMatchesTarget = judgeModel.present && targetJudgeModel.length > 0 && judgeModel.value === targetJudgeModel;
  const baseUrlPresent = baseUrl.length > 0;
  const endpointIsLocal = baseUrlPresent ? isLocalUrl(baseUrl) : false;
  const cloudEndpointRequiresApiKey = baseUrlPresent && !endpointIsLocal;
  const apiKeyPresent = hasAnyEnv("RECALLWEAVE_MEMORYBENCH_API_KEY");
  const localDiagnosticEndpointSatisfied = localDiagnosticModelAllowed && endpointIsLocal;
  const scoringModelPolicySatisfied = exactTargetModelsRequired
    ? answerModelMatchesTarget && judgeModelMatchesTarget
    : challengerModelAllowed
      ? answerModel.present && judgeModel.present
      : answerModel.present && judgeModel.present && localDiagnosticEndpointSatisfied;
  const blockers = [
    !truthyEnv("RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS")
      ? "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled"
      : null,
    !truthyEnv("RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA") ? "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed" : null,
    !truthyEnv("RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT")
      ? "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed"
      : null,
    !answerModel.present ? "answer-model-missing" : null,
    !judgeModel.present ? "judge-model-missing" : null,
    exactTargetModelsRequired && answerModel.present && !answerModelMatchesTarget ? "answer-model-does-not-match-target" : null,
    exactTargetModelsRequired && judgeModel.present && !judgeModelMatchesTarget ? "judge-model-does-not-match-target" : null,
    localDiagnosticModelAllowed && baseUrlPresent && !endpointIsLocal ? "local-diagnostic-scoring-requires-local-endpoint" : null,
    !baseUrlPresent ? "openai-compatible-base-url-missing" : null,
    cloudEndpointRequiresApiKey && !apiKeyPresent ? "RECALLWEAVE_MEMORYBENCH_API_KEY-missing-for-cloud-endpoint" : null,
  ].filter(Boolean);
  return {
    ready: blockers.length === 0,
    answerQualityCallsEnabled: truthyEnv("RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS"),
    publicDataConfirmed: truthyEnv("RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA"),
    noRawTextOutputConfirmed: truthyEnv("RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT"),
    answerModelPresent: answerModel.present,
    judgeModelPresent: judgeModel.present,
    targetAnswerModel: targetAnswerModel || null,
    targetJudgeModel: targetJudgeModel || null,
    answerModelMatchesTarget,
    judgeModelMatchesTarget,
    modelMatchPolicy,
    exactTargetModelsRequired,
    localDiagnosticModelAllowed,
    challengerModelAllowed,
    localDiagnosticEndpointSatisfied,
    scoringModelPolicySatisfied,
    baseUrlPresent,
    endpointIsLocal,
    cloudEndpointRequiresApiKey,
    apiKeyPresent,
    printsEnvValues: false,
    blockers,
  };
}

function inspectQueryExpansionReadiness(lane) {
  const strategies = lane.strategies ?? [];
  const requirement = lane.queryExpansionEvidenceRequirement ?? (lane.acceptedByFullShardIntake ? "local-or-cloud-model-required" : "local-or-cloud-model-required");
  if (!strategies.includes("query-expanded-full-hybrid-rerank")) {
    return {
      required: false,
      evidenceRequirement: "not-required",
      ready: true,
      readyForResponseArmExport: true,
      readyForAnswerQualityScoring: true,
      readyForAcceptedShardIntake: true,
      diagnosticFallbackAllowed: false,
      deterministicFallbackOnly: false,
      countsAsQueryExpansionEvidence: false,
      countsAsFullSotaQueryExpansionEvidence: false,
      localEndpointPresent: false,
      localModelPresent: false,
      localReady: false,
      cloudCallsEnabled: false,
      publicDataConfirmed: false,
      cloudProviderReady: false,
      readyProviderKinds: [],
      printsEnvValues: false,
      blockers: [],
    };
  }
  const localEndpointPresent = hasAnyEnv("SELFMEM_QUERY_EXPANSION_BASE_URL");
  const localModelPresent = hasAnyEnv("SELFMEM_QUERY_EXPANSION_MODEL");
  const localReady = localEndpointPresent && localModelPresent;
  const cloudCallsEnabled = truthyEnv("RECALLWEAVE_QUERY_EXPANSION_CALLS") || truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS");
  const publicDataConfirmed =
    truthyEnv("RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA") || truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA");
  const readyProviderKinds = ["deepseek", "nvidia", "gemini", "openrouter"].filter((provider) => inspectProviderReadiness(provider).ready);
  const cloudProviderReady = cloudCallsEnabled && publicDataConfirmed && readyProviderKinds.length > 0;
  const modelBackedReady = localReady || cloudProviderReady;
  const diagnosticFallbackAllowed = Boolean(lane.queryExpansionDiagnosticFallbackAllowed);
  const deterministicFallbackOnly = requirement === "deterministic-fallback-only";
  const blocksAcceptedShardIntake = requirement === "local-or-cloud-model-required";
  const blockers = blocksAcceptedShardIntake
    ? [
        !modelBackedReady && !cloudCallsEnabled ? "query-expansion-local-endpoint-or-cloud-consent-missing" : null,
        !localReady && cloudCallsEnabled && !publicDataConfirmed ? "query-expansion-public-data-not-confirmed" : null,
        !localReady && cloudCallsEnabled && publicDataConfirmed && readyProviderKinds.length === 0
          ? "query-expansion-cloud-provider-credentials-missing"
          : null,
      ].filter(Boolean)
    : [];
  const readyForResponseArmExport = modelBackedReady || diagnosticFallbackAllowed || deterministicFallbackOnly;
  const readyForAnswerQualityScoring = blocksAcceptedShardIntake ? modelBackedReady : readyForResponseArmExport;
  return {
    required: true,
    evidenceRequirement: requirement,
    ready: readyForAnswerQualityScoring,
    readyForResponseArmExport,
    readyForAnswerQualityScoring,
    readyForAcceptedShardIntake: blocksAcceptedShardIntake ? modelBackedReady : false,
    diagnosticFallbackAllowed,
    deterministicFallbackOnly,
    modelBackedReady,
    countsAsQueryExpansionEvidence: modelBackedReady,
    countsAsFullSotaQueryExpansionEvidence: Boolean(lane.queryExpansionSotaEligible) && modelBackedReady,
    localEndpointPresent,
    localModelPresent,
    localReady,
    cloudCallsEnabled,
    publicDataConfirmed,
    cloudProviderReady,
    readyProviderKinds,
    defaultCloudProviderOrder: ["deepseek", "nvidia", "gemini", "openrouter"],
    printsEnvValues: false,
    blockers,
  };
}

function inspectProviderReadiness(provider) {
  const valueEnvNames = providerValueEnvNames(provider);
  const keyFileEnvNames = providerKeyFileEnvNames(provider);
  const valueKeys = valueEnvNames.flatMap((name) => splitEnvList(process.env[name] ?? ""));
  const fileStates = keyFileEnvNames.map(inspectProviderKeyFileEnv);
  const keyCount = uniqueProviderKeys([...valueKeys, ...fileStates.flatMap((state) => state.keys ?? [])]).length;
  return {
    ready: keyCount > 0,
    keyCount,
    valueEnvNames,
    keyFileEnvNames,
    configuredValueEnvNames: valueEnvNames.filter((name) => hasAnyEnv(name)),
    configuredKeyFileEnvNames: fileStates.filter((state) => state.configured).map((state) => state.envName),
    keyFileIssues: fileStates.filter((state) => state.issue).map((state) => ({ envName: state.envName, issue: state.issue })),
    printsEnvValues: false,
  };
}

function inspectProviderKeyFileEnv(envName) {
  const value = process.env[envName];
  if (!value) return { envName, configured: false, keyCount: 0, issue: null, keys: [] };
  const resolved = resolve(String(value));
  if (!existsSync(resolved)) return { envName, configured: true, keyCount: 0, issue: "file-missing", keys: [] };
  if (!statSync(resolved).isFile()) return { envName, configured: true, keyCount: 0, issue: "not-a-file", keys: [] };
  if (!isOutsideRepo(resolved)) return { envName, configured: true, keyCount: 0, issue: "file-inside-repository", keys: [] };
  const fileRaw = readFileSync(resolved, "utf8");
  const keys = splitEnvList(fileRaw);
  return { envName, configured: true, keyCount: uniqueProviderKeys(keys).length, issue: null, keys };
}

function uniqueProviderKeys(keys) {
  return [...new Set(keys.map((key) => String(key ?? "").trim()).filter(Boolean))];
}

function providerValueEnvNames(provider) {
  if (provider === "gemini") return ["GEMINI_API_KEY", "GEMINI_API_KEYS", "GOOGLE_API_KEY", "GOOGLE_API_KEYS", "AI_STUDIO_API_KEY", "AI_STUDIO_API_KEYS"];
  if (provider === "voyage") return ["VOYAGE_API_KEY", "VOYAGE_API_KEYS"];
  if (provider === "deepseek") return ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEYS"];
  if (provider === "nvidia") return ["NVIDIA_API_KEY", "NVIDIA_API_KEYS", "NVAPI_KEY", "NVAPI_KEYS"];
  if (provider === "openrouter") return ["OPENROUTER_API_KEY", "OPENROUTER_API_KEYS"];
  if (provider === "local-apple") return ["SELFMEM_LOCAL_EMBED_BASE_URL"];
  if (provider === "local-rerank") return ["SELFMEM_LOCAL_RERANK_ENDPOINT", "SELFMEM_LOCAL_RERANK_BASE_URL"];
  return [];
}

function providerKeyFileEnvNames(provider) {
  if (provider === "gemini") return ["GEMINI_API_KEY_FILE", "GEMINI_API_KEYS_FILE", "GOOGLE_API_KEY_FILE", "GOOGLE_API_KEYS_FILE", "AI_STUDIO_API_KEY_FILE", "AI_STUDIO_API_KEYS_FILE"];
  if (provider === "voyage") return ["VOYAGE_API_KEY_FILE", "VOYAGE_API_KEYS_FILE"];
  if (provider === "deepseek") return ["DEEPSEEK_API_KEY_FILE", "DEEPSEEK_API_KEYS_FILE"];
  if (provider === "nvidia") return ["NVIDIA_API_KEY_FILE", "NVIDIA_API_KEYS_FILE", "NVAPI_KEY_FILE", "NVAPI_KEYS_FILE"];
  if (provider === "openrouter") return ["OPENROUTER_API_KEY_FILE", "OPENROUTER_API_KEYS_FILE"];
  return [];
}

function truthyEnv(name) {
  return process.env[name] === "1";
}

function hasAnyEnv(...names) {
  return names.some((name) => String(process.env[name] ?? "").trim().length > 0);
}

function envPresence(...names) {
  for (const name of names) {
    const value = String(process.env[name] ?? "").trim();
    if (value.length > 0) return { present: true, envName: name, value };
  }
  return { present: false, envName: null, value: null };
}

function splitEnvList(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalUrl(value) {
  try {
    const parsed = new URL(String(value));
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isOutsideRepo(path) {
  const rel = relative(root, path);
  return rel.startsWith("..") || isAbsolute(rel);
}

function shardRange(result) {
  const shard = result.input?.queryShard ?? {};
  const startIndex = intOrNull(result.input?.scoredQueryStart ?? shard.startIndex ?? result.input?.queryOffset);
  const endIndexExclusive = intOrNull(result.input?.scoredQueryEndExclusive ?? shard.endIndexExclusive);
  const totalQueryCount = intOrNull(result.input?.totalQueryCount ?? shard.totalQueryCount ?? result.input?.queryCount);
  const scoredQueryCount = intOrNull(result.input?.scoredQueryCount ?? shard.scoredQueryCount);
  if ([startIndex, endIndexExclusive, totalQueryCount, scoredQueryCount].some((value) => value == null)) return null;
  return { startIndex, endIndexExclusive, totalQueryCount, scoredQueryCount, rangeHash: shard.rangeHash ?? null };
}

function strategyNamesHash(result) {
  return `sha256:${sha256(JSON.stringify((result.strategies ?? []).map((item) => item.strategy).filter(Boolean).sort()))}`;
}

function planStrategyHash(planValue) {
  return `sha256:${sha256(JSON.stringify([...(planValue.runPlan?.strategies ?? [])].sort()))}`;
}

function scoringModelFailures(result, planValue) {
  const state = scoringModelsSatisfyPlan(result, planValue);
  if (state.ready) return [];
  if (state.policy === "local-diagnostic-allowed") {
    return [
      !state.answerModelPresent ? "answer-model-missing" : null,
      !state.judgeModelPresent ? "judge-model-missing" : null,
      !state.localDiagnosticEndpointSatisfied ? "local-diagnostic-scoring-policy-mismatch" : null,
    ].filter(Boolean);
  }
  if (state.policy === "challenger-model-allowed") {
    return [
      !state.answerModelPresent ? "answer-model-missing" : null,
      !state.judgeModelPresent ? "judge-model-missing" : null,
    ].filter(Boolean);
  }
  return [
    !state.answerModelPresent ? "answer-model-missing" : null,
    !state.judgeModelPresent ? "judge-model-missing" : null,
    state.answerModelPresent && !state.answerModelMatchesTarget ? "answer-model-mismatch" : null,
    state.judgeModelPresent && !state.judgeModelMatchesTarget ? "judge-model-mismatch" : null,
  ].filter(Boolean);
}

function scoringModelsSatisfyPlan(result, planValue) {
  const policy = String(
    planValue.scoringPolicy?.modelMatchPolicy ??
      defaultModelMatchPolicy(planValue.runPlan?.claimScope),
  );
  const answerModel = String(result.provider?.answerModel ?? "").trim();
  const judgeModel = String(result.provider?.judgeModel ?? "").trim();
  const targetAnswerModel = String(planValue.target?.answerModel ?? "").trim();
  const targetJudgeModel = String(planValue.target?.judgeModel ?? "").trim();
  const answerModelPresent = answerModel.length > 0;
  const judgeModelPresent = judgeModel.length > 0;
  const answerModelMatchesTarget = answerModelPresent && answerModel === targetAnswerModel;
  const judgeModelMatchesTarget = judgeModelPresent && judgeModel === targetJudgeModel;
  const localDiagnosticEndpointSatisfied = result.scoringPolicy?.localDiagnosticEndpointSatisfied === true || result.provider?.endpointIsLocal === true;
  if (policy === "local-diagnostic-allowed") {
    return {
      policy,
      ready: answerModelPresent && judgeModelPresent && localDiagnosticEndpointSatisfied,
      answerModelPresent,
      judgeModelPresent,
      answerModelMatchesTarget,
      judgeModelMatchesTarget,
      localDiagnosticEndpointSatisfied,
    };
  }
  if (policy === "challenger-model-allowed") {
    return {
      policy,
      ready: answerModelPresent && judgeModelPresent,
      answerModelPresent,
      judgeModelPresent,
      answerModelMatchesTarget,
      judgeModelMatchesTarget,
      localDiagnosticEndpointSatisfied,
    };
  }
  return {
    policy,
    ready: answerModelMatchesTarget && judgeModelMatchesTarget,
    answerModelPresent,
    judgeModelPresent,
    answerModelMatchesTarget,
    judgeModelMatchesTarget,
    localDiagnosticEndpointSatisfied,
  };
}

function defaultModelMatchPolicy(scope) {
  if (scope === "local-full") return "local-diagnostic-allowed";
  if (scope === "model-challenger") return "challenger-model-allowed";
  return "exact-target-required";
}

function rangeKey(value) {
  return `${value.startIndex}-${value.endIndexExclusive}`;
}

function renderMarkdown(value) {
  return [
    "# Full Answer-Quality Shard Workorder",
    "",
    `- Status: ${value.status}`,
    `- Ready for shard intake: ${value.readyForShardIntake}`,
    `- Ready for shard combine: ${value.readyForShardCombine}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Accepted shards: ${value.progress.acceptedShardCount}`,
    `- Pending shards: ${value.progress.pendingShardCount}`,
    `- Rejected results: ${value.progress.rejectedResultCount}`,
    `- Workorders emitted: ${value.progress.workorderCount}`,
    `- Runtime blocker reports: ${value.runtimeBlockers.inputCount}`,
    `- Runtime resume plans: ${value.runtimeBlockers.resumeAvailableCount}`,
    "",
    "## Workorders",
    ...(value.workorders.length
      ? value.workorders.map((item) => `- ${item.shardId}: ${item.startIndex}-${item.endIndexExclusive}`)
      : ["- none"]),
    "",
    "## Runtime Resume Plans",
    ...((value.runtimeBlockers.matched ?? []).length
      ? value.runtimeBlockers.matched.map(
          (item) =>
            `- ${item.shardId}: completed=${item.completedStrategies.join(", ") || "none"}; missing=${item.missingStrategies.join(", ") || "none"}; failure=${item.failureClass ?? "unknown"}`,
        )
      : ["- none"]),
    "",
    "## Execution Lanes",
    ...((value.executionLanes ?? []).length
      ? value.executionLanes.map(
          (lane) =>
            `- ${lane.id}: ready=${lane.coverageReady}; intake-compatible=${lane.acceptedByFullShardIntake}; providers=${lane.providerRequirements?.join(", ") || "none"}`,
        )
      : ["- none"]),
    "",
    "## Execution Lane Readiness",
    ...((value.executionLaneReadiness ?? []).length
      ? value.executionLaneReadiness.flatMap((lane) => [
          `- ${lane.laneId}: response-export=${lane.readyForResponseArmExport}; answer-quality=${lane.readyForAnswerQualityScoring}; intake-candidate=${lane.readyForAcceptedShardIntakeCandidate}`,
          `  - scoring-policy=${lane.answerQuality.modelMatchPolicy}; scoring-policy-ready=${lane.answerQuality.scoringModelPolicySatisfied}`,
          `  - query-expansion=${lane.queryExpansion.evidenceRequirement}; model-backed=${lane.queryExpansion.modelBackedReady ?? false}; fallback-allowed=${lane.queryExpansion.diagnosticFallbackAllowed}`,
          `  - blockers=${lane.blockers.length ? lane.blockers.join(", ") : "none"}`,
        ])
      : ["- none"]),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Gated Commands",
    `- Intake: ${value.gatedCommands.shardIntake}`,
    `- Combine after intake passes: ${value.gatedCommands.combineAfterIntakePasses ?? "none"}`,
    `- Result gate after combine: ${value.gatedCommands.resultGateAfterCombine ?? "none"}`,
    `- Reviewer intake after combine: ${value.gatedCommands.reviewerIntakeAfterCombine ?? "none"}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function assertSafePublicText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privatePathPattern, `${label} contains a private local path`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
  assertNoPattern(text, /\b(q|answer|content|memory|text|raw|prompt)"\s*:/, `${label} contains raw text-like fields`);
}

function assertNoPattern(text, pattern, message) {
  pattern.lastIndex = 0;
  if (pattern.test(String(text))) throw new Error(message);
}

function normalizeList(values) {
  return values
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items)].sort();
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function arrayOfStrings(value) {
  return arrayOf(value).map((item) => String(item)).filter(Boolean);
}

function coerceArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function intOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
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
    const value = !next || next.startsWith("--") ? true : next;
    if (parsed[key] == null) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
    if (value !== true) index += 1;
  }
  return parsed;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value ?? "") : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
