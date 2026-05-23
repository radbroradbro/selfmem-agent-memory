import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());
const fixturePath = join(root, "packages/bench/fixtures/hosted-baseline-result.fixture.json");
const fixtureRequested = process.argv.includes("--fixture");
const printTemplate = process.argv.includes("--print-template") || process.argv.includes("--template");
const resultPath =
  readArgValue("--result") ??
  process.env.RECALLWEAVE_BASELINE_RESULT_JSON ??
  (fixtureRequested ? fixturePath : null);
const outputPath = readArgValue("--output") ?? process.env.RECALLWEAVE_BASELINE_PREFLIGHT_OUTPUT_JSON ?? null;
const liveRequested = process.argv.includes("--live") || process.env.RECALLWEAVE_BASELINE_LIVE === "1";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;

const releaseStatePath = join(root, reviewDir, "release-state.json");
const productionReadinessPath = join(root, reviewDir, "production-readiness.md");
const benchmarkPlanPath = join(root, "docs/AUTORESEARCH_BENCHMARK_PLAN.md");
const benchmarkSummaryPath = join(root, "docs/BENCHMARK_SUMMARY.md");

const releaseState = JSON.parse(readFileSync(releaseStatePath, "utf8"));
const productionReadiness = readFileSync(productionReadinessPath, "utf8");
const benchmarkPlan = readFileSync(benchmarkPlanPath, "utf8");
const benchmarkSummary = readFileSync(benchmarkSummaryPath, "utf8");

assert.equal(releaseState.goalStatus, "active");
assert.equal(releaseState.publicLaunchVerdict, "FAIL");
assert.equal(releaseState.productionReady, false);
assert.ok(
  releaseState.remainingBlockers?.includes("hosted-supermemory-baseline-not-current"),
  "release-state must keep the hosted baseline blocker until a live metrics-only baseline is reviewed",
);
assert.match(productionReadiness, /hosted[- ]baseline|Supermemory baseline|fresh.*baseline/i);
assert.match(benchmarkPlan, /same dataset slice/i);
assert.match(benchmarkPlan, /same judge and answer model/i);
assert.match(benchmarkSummary, /valid Supermemory baseline/i);

const head = gitOrFallback(["rev-parse", "HEAD"], process.env.RECALLWEAVE_SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? "unknown");
const branch = gitOrFallback(["branch", "--show-current"], process.env.RECALLWEAVE_SOURCE_BRANCH ?? process.env.GITHUB_REF_NAME ?? "unknown");

const liveEnv = [
  {
    name: "RECALLWEAVE_BASELINE_LIVE",
    purpose: "Must be 1 before any hosted provider call is allowed.",
    sensitive: false,
    required: true,
  },
  {
    name: "SUPERMEMORY_API_KEY",
    purpose: "Hosted Supermemory read/search credential. Never print the value.",
    sensitive: true,
    required: true,
  },
  {
    name: "RECALLWEAVE_BASELINE_CONTAINER",
    purpose: "Isolated hosted container or explicit read-only source container.",
    sensitive: false,
    required: true,
  },
  {
    name: "RECALLWEAVE_BASELINE_QUERYSET",
    purpose: "Source-locked query-set path or benchmark slice id.",
    sensitive: false,
    required: true,
  },
  {
    name: "RECALLWEAVE_BASELINE_RUN_ID",
    purpose: "Unique run id used in aggregate metric output.",
    sensitive: false,
    required: true,
  },
  {
    name: "RECALLWEAVE_BASELINE_JUDGE_MODEL",
    purpose: "Judge model id. Must match the RecallWeave arm.",
    sensitive: false,
    required: true,
  },
  {
    name: "RECALLWEAVE_BASELINE_ANSWER_MODEL",
    purpose: "Answer model id. Must match the RecallWeave arm.",
    sensitive: false,
    required: true,
  },
  {
    name: "RECALLWEAVE_BASELINE_OUTPUT_JSON",
    purpose: "Aggregate metrics-only output path. Do not write raw memory text.",
    sensitive: false,
    required: true,
  },
  {
    name: "RECALLWEAVE_BASELINE_NO_RAW_TEXT",
    purpose: "Must be 1 to confirm reports contain metrics and hashes only.",
    sensitive: false,
    required: true,
  },
];

const envPresence = new Map(liveEnv.map((item) => [item.name, process.env[item.name] != null && process.env[item.name] !== ""]));
const envStatus = liveEnv.map((item) => ({
  name: item.name,
  present: item.sensitive ? "redacted" : envPresence.get(item.name),
  required: item.required,
  sensitive: item.sensitive,
  purpose: item.purpose,
}));
const missingLiveEnv = liveEnv.filter((item) => item.required && !envPresence.get(item.name)).map((item) => item.name);
const liveInputReady = liveRequested && missingLiveEnv.length === 0 && process.env.RECALLWEAVE_BASELINE_NO_RAW_TEXT === "1";

let baselineResult = null;
if (resultPath) {
  baselineResult = inspectBaselineResult(resultPath);
}

const hostedBaselineFresh = Boolean(baselineResult?.fresh);
const countsAsHostedBaselineEvidence = Boolean(baselineResult?.countsAsHostedBaselineEvidence);
const matchedRecallWeaveRunPresent = Boolean(baselineResult?.matchedRecallWeaveRunPresent);
const reviewerApprovalCount = Number(baselineResult?.reviewerApprovalCount ?? 0);
const recallWeaveWin = Boolean(baselineResult?.recallWeaveWin);
const benchmarkClaimsAllowed =
  countsAsHostedBaselineEvidence && matchedRecallWeaveRunPresent && reviewerApprovalCount >= 2 && recallWeaveWin;

const report = {
  ok: true,
  mode: "hosted-baseline-preflight",
  writesRealFiles: false,
  callsHostedProvider: false,
  metricsOnly: true,
  reviewDir,
  branch,
  head,
  releaseBlockerPresent: true,
  liveRequested,
  liveInputReady,
  missingLiveEnv,
  hostedBaselineFresh,
  countsAsHostedBaselineEvidence,
  matchedRecallWeaveRunPresent,
  reviewerApprovalCount,
  recallWeaveWin,
  benchmarkClaimsAllowed,
  publicBenchmarkClaimsAllowed: benchmarkClaimsAllowed,
  resultInspection: baselineResult,
  resultTemplateIncluded: printTemplate,
  baselineResultTemplate: printTemplate ? buildBaselineResultTemplate({ branch, head }) : undefined,
  envContract: envStatus,
  safety: {
    printsCredentialValues: false,
    permitsHostedWriteBack: false,
    permitsRawMemoryOutput: false,
    permitsRawTranscriptOutput: false,
    requiresPrivacyLeakCountZero: true,
    requiresSameHarnessSettings: true,
    requiresTwoReviewerApprovalsForClaims: true,
  },
  liveRunContract: {
    provider: "hosted-supermemory",
    writeMode: "read-and-measure-only",
    hostedWriteBack: false,
    requiredComparability: [
      "same dataset slice",
      "same query set",
      "same judge model",
      "same answer model",
      "same scoring code",
      "labeled query set",
      "same redaction policy",
      "same latency and cost accounting",
    ],
    requiredMetrics: [
      "accuracy or benchmark-native quality",
      "P@1",
      "recall@5",
      "recall@10",
      "NDCG@10 when available",
      "latency p50",
      "latency p95",
      "context tokens",
      "ingest cost",
      "query cost",
      "redaction failure count",
    ],
    allowedOutput: "aggregate metrics, run ids, timestamps, source commits, model ids, cost, latency, and hashes only",
    forbiddenOutput: "raw memories, raw transcripts, raw prompts, raw answers from private containers, credentials, cookies, and bearer tokens",
  },
  nextActions: [
    "Run `baseline:preflight -- --fixture` to validate the metrics-only result shape without making any benchmark claim.",
    "Run `baseline:preflight -- --print-template` to print the live result schema before collecting a hosted baseline.",
    "Choose an isolated source-locked query set or explicit read-only hosted container.",
    "Run the hosted Supermemory baseline with RECALLWEAVE_BASELINE_LIVE=1 and RECALLWEAVE_BASELINE_NO_RAW_TEXT=1.",
    "Store only aggregate metrics and hashes in RECALLWEAVE_BASELINE_OUTPUT_JSON.",
    "Run this preflight again with --result pointing at that metrics-only JSON.",
    "Run the matched RecallWeave arm with the same harness settings.",
    "Get two independent reviewer approvals before publishing any comparison score.",
  ],
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern);
if (outputPath) writeFileSync(resolveOutputPath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);

function inspectBaselineResult(inputPath) {
  const path = isAbsolute(inputPath) ? inputPath : resolve(root, inputPath);
  assert.ok(existsSync(path), `baseline result missing: ${inputPath}`);
  assert.ok(statSync(path).size > 0, `baseline result empty: ${inputPath}`);
  const result = JSON.parse(readFileSync(path, "utf8"));
  const serializedResult = JSON.stringify(result);
  assert.doesNotMatch(serializedResult, secretPattern, "baseline result contains a key-shaped secret");

  const privacyLeakCount = Number(result.privacyLeakCount ?? result.privacy?.leakCount ?? NaN);
  const redactionFailureCount = Number(result.redactionFailureCount ?? result.redactionFailures ?? NaN);
  const rawMemoryIncluded = Boolean(result.rawMemoryIncluded ?? result.includesRawMemoryText ?? false);
  const rawTranscriptIncluded = Boolean(result.rawTranscriptIncluded ?? result.includesRawTranscriptText ?? false);
  const rawPromptIncluded = Boolean(result.rawPromptIncluded ?? result.includesRawPromptText ?? false);
  const rawAnswerIncluded = Boolean(result.rawAnswerIncluded ?? result.includesRawAnswerText ?? false);
  const metricsOnly = result.metricsOnly === true;
  const provider = String(result.provider ?? result.baselineProvider ?? "");
  const runAt = String(result.runAt ?? result.generatedAt ?? "");
  const fixtureOnly =
    result.fixtureOnly === true ||
    String(result.evidenceType ?? "").toLowerCase().includes("fixture") ||
    relative(root, path).replaceAll("\\", "/").includes("/fixtures/");
  const ageHours = runAt ? (Date.now() - Date.parse(runAt)) / 36e5 : Number.POSITIVE_INFINITY;
  const sameHarness = result.sameHarness === true || result.comparability?.sameHarness === true;
  const sameDataset = result.sameDataset === true || result.comparability?.sameDataset === true;
  const sameJudge = result.sameJudge === true || result.comparability?.sameJudge === true;
  const sameAnswerModel = result.sameAnswerModel === true || result.comparability?.sameAnswerModel === true;
  const hasRunId = nonEmpty(result.runId);
  const sourceCommit = String(result.sourceCommit ?? result.commit ?? "");
  const hasSourceCommit = fixtureOnly ? nonEmpty(sourceCommit) : nonEmpty(sourceCommit) && sourceCommit !== "unknown";
  const hasDatasetSlice = nonEmpty(result.datasetSlice ?? result.benchmarkSlice ?? result.datasetVersion);
  const hasQuerySetHash = hashLike(result.querySetHash ?? result.queryHash ?? result.questionSetHash);
  const hasScoringCodeHash = hashLike(result.scoringCodeHash ?? result.harnessHash ?? result.scoringHash);
  const querySetEvidence = normalizeQuerySetEvidence(result.querySetEvidence);
  const ingestCost = result.ingestCostUsd ?? result.cost?.ingestUsd;
  const queryCost = result.queryCostUsd ?? result.cost?.queryUsd;
  const hasCostLatency =
    isFiniteNumber(result.latencyP50Ms ?? result.metrics?.latencyP50Ms) &&
    isFiniteNumber(result.latencyP95Ms ?? result.metrics?.latencyP95Ms) &&
    isFiniteNumber(ingestCost) &&
    isFiniteNumber(queryCost);
  const hasRetrievalMetric =
    isFiniteNumber(result.accuracy ?? result.quality ?? result.metrics?.accuracy ?? result.metrics?.quality) ||
    isFiniteNumber(result.pAt1 ?? result.metrics?.pAt1) ||
    isFiniteNumber(result.recallAt5 ?? result.metrics?.recallAt5) ||
    isFiniteNumber(result.ndcgAt10 ?? result.metrics?.ndcgAt10);
  const freshWindow = fixtureOnly || (ageHours >= 0 && ageHours <= 168);
  const checks = [
    resultCheck("not-fixture", !fixtureOnly),
    resultCheck("provider-hosted-supermemory", provider === "hosted-supermemory"),
    resultCheck("metrics-only", metricsOnly),
    resultCheck("privacy-leaks-zero", privacyLeakCount === 0),
    resultCheck("redaction-failures-zero", redactionFailureCount === 0),
    resultCheck("no-raw-memory", rawMemoryIncluded === false),
    resultCheck("no-raw-transcript", rawTranscriptIncluded === false),
    resultCheck("no-raw-prompt", rawPromptIncluded === false),
    resultCheck("no-raw-answer", rawAnswerIncluded === false),
    resultCheck("same-harness", sameHarness),
    resultCheck("same-dataset", sameDataset),
    resultCheck("same-judge", sameJudge),
    resultCheck("same-answer-model", sameAnswerModel),
    resultCheck("run-id", hasRunId),
    resultCheck("source-commit", hasSourceCommit),
    resultCheck("dataset-slice", hasDatasetSlice),
    resultCheck("query-set-hash", hasQuerySetHash),
    resultCheck("scoring-code-hash", hasScoringCodeHash),
    resultCheck("labeled-query-set", querySetEvidence.publicBenchmarkReady),
    resultCheck("cost-latency", hasCostLatency),
    resultCheck("retrieval-or-quality-metric", hasRetrievalMetric),
    resultCheck("fresh-window", freshWindow),
  ];
  const failedResultChecks = checks.filter((item) => !item.ok).map((item) => item.name);
  const fresh =
    failedResultChecks.length === 0;

  return {
    path: relative(root, path).replaceAll("\\", "/"),
    provider,
    fixtureOnly,
    metricsOnly,
    privacyLeakCount,
    redactionFailureCount,
    rawMemoryIncluded,
    rawTranscriptIncluded,
    rawPromptIncluded,
    rawAnswerIncluded,
    sameHarness,
    sameDataset,
    sameJudge,
    sameAnswerModel,
    hasRunId,
    hasSourceCommit,
    hasDatasetSlice,
    hasQuerySetHash,
    hasScoringCodeHash,
    querySetEvidence,
    hasCostLatency,
    hasRetrievalMetric,
    ageHours: Number.isFinite(ageHours) ? Number(ageHours.toFixed(2)) : null,
    fresh,
    countsAsHostedBaselineEvidence: fresh,
    checks,
    failedResultChecks,
    matchedRecallWeaveRunPresent: Boolean(result.matchedRecallWeaveRunPresent ?? result.matchedRecallWeaveRun?.present),
    reviewerApprovalCount: Number(result.reviewerApprovalCount ?? result.reviewers?.approvedCount ?? 0),
    recallWeaveWin: Boolean(result.recallWeaveWin ?? result.comparison?.recallWeaveWin),
  };
}

function buildBaselineResultTemplate({ branch, head }) {
  return {
    schemaVersion: 1,
    provider: "hosted-supermemory",
    fixtureOnly: false,
    metricsOnly: true,
    runId: "supermemory-baseline-YYYYMMDD-HHMM",
    runAt: new Date().toISOString(),
    branch,
    sourceCommit: head,
    datasetSlice: "source-locked-canary-slice-id",
    querySetHash: "sha256:<hash-of-query-set>",
    scoringCodeHash: "sha256:<hash-of-scoring-code>",
    judgeModel: "same-judge-as-recallweave-run",
    answerModel: "same-answer-model-as-recallweave-run",
    sameHarness: true,
    sameDataset: true,
    sameJudge: true,
    sameAnswerModel: true,
    querySetEvidence: {
      queryCount: 0,
      labeledQueryCount: 0,
      unlabeledQueryCount: 0,
      expectedResultRefCount: 0,
      minExpectedRefsPerQuery: 0,
      usesExpectedIds: false,
      usesExpectedHashes: false,
      publicBenchmarkReady: false,
    },
    privacyLeakCount: 0,
    redactionFailureCount: 0,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPromptIncluded: false,
    rawAnswerIncluded: false,
    metrics: {
      quality: 0,
      pAt1: 0,
      recallAt5: 0,
      recallAt10: 0,
      ndcgAt10: 0,
      latencyP50Ms: 0,
      latencyP95Ms: 0,
      contextTokensAvg: 0,
    },
    cost: {
      ingestUsd: 0,
      queryUsd: 0,
    },
    matchedRecallWeaveRunPresent: false,
    reviewerApprovalCount: 0,
    recallWeaveWin: false,
  };
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function resolveOutputPath(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

function isFiniteNumber(value) {
  return typeof Number(value) === "number" && Number.isFinite(Number(value));
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hashLike(value) {
  return typeof value === "string" && /^(sha256:)?[A-Za-z0-9_-]{8,}$/.test(value.trim());
}

function normalizeQuerySetEvidence(value) {
  const queryCount = Number(value?.queryCount ?? 0);
  const labeledQueryCount = Number(value?.labeledQueryCount ?? 0);
  const unlabeledQueryCount = Number(value?.unlabeledQueryCount ?? Number.POSITIVE_INFINITY);
  const expectedResultRefCount = Number(value?.expectedResultRefCount ?? 0);
  const minExpectedRefsPerQuery = Number(value?.minExpectedRefsPerQuery ?? 0);
  const uniqueQueryCount = Number(value?.uniqueQueryCount ?? queryCount);
  const duplicateQueryCount = Number(value?.duplicateQueryCount ?? Math.max(0, queryCount - uniqueQueryCount));
  return {
    queryCount,
    uniqueQueryCount,
    duplicateQueryCount,
    labeledQueryCount,
    unlabeledQueryCount,
    expectedResultRefCount,
    minExpectedRefsPerQuery,
    usesExpectedIds: Boolean(value?.usesExpectedIds),
    usesExpectedHashes: Boolean(value?.usesExpectedHashes),
    publicBenchmarkReady:
      value?.publicBenchmarkReady === true &&
      Number.isFinite(queryCount) &&
      queryCount > 0 &&
      labeledQueryCount === queryCount &&
      unlabeledQueryCount === 0 &&
      uniqueQueryCount === queryCount &&
      duplicateQueryCount === 0 &&
      minExpectedRefsPerQuery > 0 &&
      expectedResultRefCount >= queryCount,
  };
}

function resultCheck(name, ok) {
  return { name, ok: Boolean(ok) };
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

function gitOrFallback(args, fallback) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const value = result.status === 0 ? result.stdout.trim() : "";
  return value || fallback;
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
