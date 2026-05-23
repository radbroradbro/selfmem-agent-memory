import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture);
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_COMPARISON_OUTPUT_JSON ?? null;
const hostedPath = resolveInputPath(
  args.hosted ??
    args.hostedResult ??
    process.env.RECALLWEAVE_HOSTED_BASELINE_RESULT_JSON ??
    (fixtureRequested ? "packages/bench/fixtures/hosted-baseline-result.fixture.json" : null),
);
const recallWeavePath = resolveInputPath(
  args.recallweave ??
    args.recallWeave ??
    args.recallweaveResult ??
    process.env.RECALLWEAVE_RESULT_JSON ??
    (fixtureRequested ? "packages/bench/fixtures/recallweave-baseline-result.fixture.json" : null),
);
const reviewerApprovalCount = Number(process.env.RECALLWEAVE_REVIEWER_APPROVAL_COUNT ?? args.reviewerApprovalCount ?? 0);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

assert.ok(hostedPath, "hosted baseline result is required. Pass --hosted or RECALLWEAVE_HOSTED_BASELINE_RESULT_JSON");
assert.ok(recallWeavePath, "RecallWeave result is required. Pass --recallweave or RECALLWEAVE_RESULT_JSON");

const hosted = loadResult(hostedPath, "hosted-supermemory");
const recallWeave = loadResult(recallWeavePath, "recallweave");
const comparability = compareHarness(hosted, recallWeave);
const privacy = {
  privacyLeakCount: hosted.privacyLeakCount + recallWeave.privacyLeakCount,
  redactionFailureCount: hosted.redactionFailureCount + recallWeave.redactionFailureCount,
  rawMemoryIncluded: hosted.rawMemoryIncluded || recallWeave.rawMemoryIncluded,
  rawTranscriptIncluded: hosted.rawTranscriptIncluded || recallWeave.rawTranscriptIncluded,
  rawPromptIncluded: hosted.rawPromptIncluded || recallWeave.rawPromptIncluded,
  rawAnswerIncluded: hosted.rawAnswerIncluded || recallWeave.rawAnswerIncluded,
};
const deltas = metricDeltas(hosted.metrics, recallWeave.metrics, hosted.cost, recallWeave.cost);
const recallWeaveWin = deltas.quality > 0 && noQualityRegression(deltas);
const bothReal = !hosted.fixtureOnly && !recallWeave.fixtureOnly;
const sameHarness = Object.values(comparability).every(Boolean);
const labeledQuerySets = hosted.querySetEvidence.publicBenchmarkReady && recallWeave.querySetEvidence.publicBenchmarkReady;
const countsAsComparisonEvidence = !fixtureRequested && bothReal && sameHarness && labeledQuerySets && privacyClean(privacy);
const publicBenchmarkClaimsAllowed = countsAsComparisonEvidence && recallWeaveWin && reviewerApprovalCount >= 2;
const failedChecks = [
  check("hosted-not-fixture", !hosted.fixtureOnly),
  check("recallweave-not-fixture", !recallWeave.fixtureOnly),
  check("same-dataset", comparability.sameDataset),
  check("same-query-set", comparability.sameQuerySet),
  check("same-scoring-code", comparability.sameScoringCode),
  check("same-judge", comparability.sameJudge),
  check("same-answer-model", comparability.sameAnswerModel),
  check("same-harness-flags", comparability.sameHarnessFlags),
  check("labeled-query-sets", labeledQuerySets),
  check("metrics-only", hosted.metricsOnly && recallWeave.metricsOnly),
  check("privacy-clean", privacyClean(privacy)),
  check("recallweave-win", recallWeaveWin),
  check("two-reviewer-approvals", reviewerApprovalCount >= 2),
]
  .filter((item) => !item.ok)
  .map((item) => item.name);

const result = {
  schemaVersion: 1,
  mode: "baseline-comparison",
  fixtureOnly: hosted.fixtureOnly || recallWeave.fixtureOnly || fixtureRequested,
  evidenceType: fixtureRequested ? "fixture-baseline-comparison" : "metrics-only-baseline-comparison",
  writesRealFiles: false,
  callsHostedProvider: false,
  metricsOnly: true,
  branch: git(["branch", "--show-current"]),
  sourceCommit: git(["rev-parse", "HEAD"]),
  hosted: resultSummary(hosted),
  recallWeave: resultSummary(recallWeave),
  comparability,
  deltas,
  privacy,
  countsAsComparisonEvidence,
  recallWeaveWin,
  reviewerApprovalCount,
  publicBenchmarkClaimsAllowed,
  failedChecks,
  safety: {
    printsCredentialValues: false,
    includesRawMemoryText: false,
    includesRawTranscriptText: false,
    includesRawPromptText: false,
    includesRawAnswerText: false,
    requiresTwoReviewerApprovalsForClaims: true,
  },
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern, "comparison output contains a key-shaped secret");
assert.doesNotMatch(serialized, privatePathPattern, "comparison output contains a private path");
if (outputPath) writeFileSync(resolveOutputPath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);

function loadResult(inputPath, expectedProvider) {
  assert.ok(existsSync(inputPath), `result missing: ${displayPath(inputPath)}`);
  assert.ok(statSync(inputPath).size > 0, `result empty: ${displayPath(inputPath)}`);
  const raw = readFileSync(inputPath, "utf8");
  assert.doesNotMatch(raw, secretPattern, `${displayPath(inputPath)} contains a key-shaped secret`);
  assert.doesNotMatch(raw, privatePathPattern, `${displayPath(inputPath)} contains a private path`);
  const result = JSON.parse(raw);
  const provider = String(result.provider ?? result.baselineProvider ?? "");
  assert.equal(provider, expectedProvider, `${displayPath(inputPath)} provider must be ${expectedProvider}`);
  return {
    path: displayPath(inputPath),
    provider,
    fixtureOnly:
      result.fixtureOnly === true ||
      String(result.evidenceType ?? "").toLowerCase().includes("fixture") ||
      displayPath(inputPath).includes("/fixtures/"),
    metricsOnly: result.metricsOnly === true,
    runId: String(result.runId ?? ""),
    runAt: String(result.runAt ?? result.generatedAt ?? ""),
    sourceCommit: String(result.sourceCommit ?? result.commit ?? ""),
    datasetSlice: String(result.datasetSlice ?? result.benchmarkSlice ?? result.datasetVersion ?? ""),
    querySetHash: String(result.querySetHash ?? result.queryHash ?? result.questionSetHash ?? ""),
    scoringCodeHash: String(result.scoringCodeHash ?? result.harnessHash ?? result.scoringHash ?? ""),
    judgeModel: String(result.judgeModel ?? ""),
    answerModel: String(result.answerModel ?? ""),
    sameHarness: result.sameHarness === true || result.comparability?.sameHarness === true,
    sameDataset: result.sameDataset === true || result.comparability?.sameDataset === true,
    sameJudge: result.sameJudge === true || result.comparability?.sameJudge === true,
    sameAnswerModel: result.sameAnswerModel === true || result.comparability?.sameAnswerModel === true,
    querySetEvidence: normalizeQuerySetEvidence(result.querySetEvidence, inputPath),
    privacyLeakCount: requiredNumber(result.privacyLeakCount ?? result.privacy?.leakCount, "privacyLeakCount", inputPath),
    redactionFailureCount: requiredNumber(result.redactionFailureCount ?? result.redactionFailures, "redactionFailureCount", inputPath),
    rawMemoryIncluded: requiredBoolean(result, ["rawMemoryIncluded", "includesRawMemoryText"], inputPath),
    rawTranscriptIncluded: requiredBoolean(result, ["rawTranscriptIncluded", "includesRawTranscriptText"], inputPath),
    rawPromptIncluded: requiredBoolean(result, ["rawPromptIncluded", "includesRawPromptText"], inputPath),
    rawAnswerIncluded: requiredBoolean(result, ["rawAnswerIncluded", "includesRawAnswerText"], inputPath),
    metrics: normalizeMetrics(result.metrics ?? result),
    cost: {
      ingestUsd: requiredNumber(result.cost?.ingestUsd ?? result.ingestCostUsd, "cost.ingestUsd", inputPath),
      queryUsd: requiredNumber(result.cost?.queryUsd ?? result.queryCostUsd, "cost.queryUsd", inputPath),
    },
  };
}

function normalizeMetrics(metrics) {
  return {
    quality: requiredNumber(metrics.quality ?? metrics.accuracy, "metrics.quality"),
    pAt1: requiredNumber(metrics.pAt1, "metrics.pAt1"),
    recallAt5: requiredNumber(metrics.recallAt5, "metrics.recallAt5"),
    recallAt10: requiredNumber(metrics.recallAt10, "metrics.recallAt10"),
    ndcgAt10: requiredNumber(metrics.ndcgAt10, "metrics.ndcgAt10"),
    latencyP50Ms: requiredNumber(metrics.latencyP50Ms, "metrics.latencyP50Ms"),
    latencyP95Ms: requiredNumber(metrics.latencyP95Ms, "metrics.latencyP95Ms"),
    contextTokensAvg: requiredNumber(metrics.contextTokensAvg, "metrics.contextTokensAvg"),
  };
}

function normalizeQuerySetEvidence(value, inputPath) {
  assert.ok(value && typeof value === "object", `${displayPath(inputPath)} missing querySetEvidence`);
  return {
    queryCount: requiredNumber(value.queryCount, "querySetEvidence.queryCount", inputPath),
    labeledQueryCount: requiredNumber(value.labeledQueryCount, "querySetEvidence.labeledQueryCount", inputPath),
    unlabeledQueryCount: requiredNumber(value.unlabeledQueryCount, "querySetEvidence.unlabeledQueryCount", inputPath),
    expectedResultRefCount: requiredNumber(value.expectedResultRefCount, "querySetEvidence.expectedResultRefCount", inputPath),
    minExpectedRefsPerQuery: requiredNumber(value.minExpectedRefsPerQuery, "querySetEvidence.minExpectedRefsPerQuery", inputPath),
    usesExpectedIds: Boolean(value.usesExpectedIds),
    usesExpectedHashes: Boolean(value.usesExpectedHashes),
    publicBenchmarkReady:
      value.publicBenchmarkReady === true &&
      Number(value.queryCount) > 0 &&
      Number(value.unlabeledQueryCount) === 0 &&
      Number(value.labeledQueryCount) === Number(value.queryCount) &&
      Number(value.minExpectedRefsPerQuery) > 0 &&
      Number(value.expectedResultRefCount) >= Number(value.queryCount),
  };
}

function compareHarness(hosted, recallWeave) {
  return {
    sameDataset: hosted.datasetSlice === recallWeave.datasetSlice && nonEmpty(hosted.datasetSlice),
    sameQuerySet: hosted.querySetHash === recallWeave.querySetHash && hashLike(hosted.querySetHash),
    sameScoringCode: hosted.scoringCodeHash === recallWeave.scoringCodeHash && hashLike(hosted.scoringCodeHash),
    sameJudge: hosted.judgeModel === recallWeave.judgeModel && nonEmpty(hosted.judgeModel),
    sameAnswerModel: hosted.answerModel === recallWeave.answerModel && nonEmpty(hosted.answerModel),
    sameHarnessFlags:
      hosted.sameHarness &&
      recallWeave.sameHarness &&
      hosted.sameDataset &&
      recallWeave.sameDataset &&
      hosted.sameJudge &&
      recallWeave.sameJudge &&
      hosted.sameAnswerModel &&
      recallWeave.sameAnswerModel,
  };
}

function metricDeltas(hostedMetrics, recallWeaveMetrics, hostedCost, recallWeaveCost) {
  return {
    quality: round(recallWeaveMetrics.quality - hostedMetrics.quality),
    pAt1: round(recallWeaveMetrics.pAt1 - hostedMetrics.pAt1),
    recallAt5: round(recallWeaveMetrics.recallAt5 - hostedMetrics.recallAt5),
    recallAt10: round(recallWeaveMetrics.recallAt10 - hostedMetrics.recallAt10),
    ndcgAt10: round(recallWeaveMetrics.ndcgAt10 - hostedMetrics.ndcgAt10),
    latencyP50Ms: round(recallWeaveMetrics.latencyP50Ms - hostedMetrics.latencyP50Ms),
    latencyP95Ms: round(recallWeaveMetrics.latencyP95Ms - hostedMetrics.latencyP95Ms),
    contextTokensAvg: round(recallWeaveMetrics.contextTokensAvg - hostedMetrics.contextTokensAvg),
    ingestCostUsd: round(recallWeaveCost.ingestUsd - hostedCost.ingestUsd),
    queryCostUsd: round(recallWeaveCost.queryUsd - hostedCost.queryUsd),
  };
}

function noQualityRegression(deltas) {
  return deltas.pAt1 >= -0.05 && deltas.recallAt5 >= -0.05 && deltas.recallAt10 >= -0.05 && deltas.ndcgAt10 >= -0.05;
}

function privacyClean(privacy) {
  return (
    privacy.privacyLeakCount === 0 &&
    privacy.redactionFailureCount === 0 &&
    privacy.rawMemoryIncluded === false &&
    privacy.rawTranscriptIncluded === false &&
    privacy.rawPromptIncluded === false &&
    privacy.rawAnswerIncluded === false
  );
}

function resultSummary(result) {
  return {
    provider: result.provider,
    fixtureOnly: result.fixtureOnly,
    metricsOnly: result.metricsOnly,
    runIdHash: result.runId ? shortHash(result.runId) : null,
    sourceCommit: result.sourceCommit,
    datasetSlice: result.datasetSlice,
    querySetHash: result.querySetHash,
    scoringCodeHash: result.scoringCodeHash,
    judgeModel: result.judgeModel,
    answerModel: result.answerModel,
    querySetEvidence: result.querySetEvidence,
    metrics: result.metrics,
    cost: result.cost,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function resolveOutputPath(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  return relative(root, value).replaceAll("\\", "/");
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hashLike(value) {
  return typeof value === "string" && /^(sha256:)?[A-Za-z0-9_-]{8,}$/.test(value.trim());
}

function requiredNumber(value, label, inputPath = null) {
  const number = Number(value);
  assert.ok(Number.isFinite(number), `${inputPath ? `${displayPath(inputPath)} ` : ""}${label} must be present and finite`);
  return number;
}

function requiredBoolean(result, keys, inputPath) {
  for (const key of keys) {
    if (Object.hasOwn(result, key)) return Boolean(result[key]);
  }
  throw new Error(`${displayPath(inputPath)} missing required privacy flag ${keys[0]}`);
}

function round(value) {
  return Number(Number(value).toFixed(4));
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortHash(value) {
  return stableHash(value).slice(0, 16);
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}
