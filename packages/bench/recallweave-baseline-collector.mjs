import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baselineScoringContractHash } from "./baseline-scoring-contract.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture);
const liveRequested = Boolean(args.live) || process.env.RECALLWEAVE_BASELINE_LIVE === "1";
const querySetPath = resolveInputPath(
  args.queryset ??
    args.querySet ??
    process.env.RECALLWEAVE_BASELINE_QUERYSET ??
    (fixtureRequested ? "packages/bench/fixtures/hosted-baseline-queryset.fixture.json" : null),
);
const responsesPath = resolveInputPath(
  args.responses ??
    args.searchResponses ??
    process.env.RECALLWEAVE_BASELINE_RESPONSES_JSON ??
    (fixtureRequested ? "packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json" : null),
);
const outputPath = args.output ?? process.env.RECALLWEAVE_RESULT_OUTPUT_JSON ?? null;
const retrievalMode = String(args.retrievalMode ?? process.env.RECALLWEAVE_BASELINE_RETRIEVAL_MODE ?? "hybrid-local-first");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 10, "limit");
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_MAX_QUERIES ?? null, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_BASELINE_QUERY_OFFSET ?? 0, "query offset");
const runAt = new Date().toISOString();
const runId =
  args.runId ??
  process.env.RECALLWEAVE_BASELINE_RUN_ID ??
  (fixtureRequested ? "fixture-recallweave-baseline-collector" : `recallweave-baseline-${runAt.replace(/[-:.TZ]/g, "").slice(0, 12)}`);
const judgeModel = args.judgeModel ?? process.env.RECALLWEAVE_BASELINE_JUDGE_MODEL ?? null;
const answerModel = args.answerModel ?? process.env.RECALLWEAVE_BASELINE_ANSWER_MODEL ?? null;
const localContainer = args.container ?? args.containerTag ?? process.env.RECALLWEAVE_BASELINE_CONTAINER ?? null;
const allowRawResponseText = process.env.RECALLWEAVE_BASELINE_ALLOW_RAW_RESPONSE_TEXT === "1";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

assert.ok(querySetPath, "query set is required. Pass --queryset or RECALLWEAVE_BASELINE_QUERYSET");
assert.ok(existsSync(querySetPath), `query set missing: ${displayPath(querySetPath)}`);
assert.ok(statSync(querySetPath).size > 0, `query set empty: ${displayPath(querySetPath)}`);
assert.ok(responsesPath, "RecallWeave responses are required. Pass --responses or RECALLWEAVE_BASELINE_RESPONSES_JSON");
assert.ok(existsSync(responsesPath), `RecallWeave responses missing: ${displayPath(responsesPath)}`);
assert.ok(statSync(responsesPath).size > 0, `RecallWeave responses empty: ${displayPath(responsesPath)}`);

if (!fixtureRequested) {
  assert.equal(liveRequested, true, "live RecallWeave baseline collection requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.equal(process.env.RECALLWEAVE_BASELINE_NO_RAW_TEXT, "1", "set RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 before live collection");
  assert.ok(judgeModel, "RECALLWEAVE_BASELINE_JUDGE_MODEL or --judge-model is required for live collection");
  assert.ok(answerModel, "RECALLWEAVE_BASELINE_ANSWER_MODEL or --answer-model is required for live collection");
}

const querySetRaw = readFileSync(querySetPath, "utf8");
assert.doesNotMatch(querySetRaw, secretPattern, `${displayPath(querySetPath)} contains a key-shaped secret`);
assert.doesNotMatch(querySetRaw, privatePathPattern, `${displayPath(querySetPath)} contains a private path`);
const querySet = JSON.parse(querySetRaw);
const queries = Array.isArray(querySet.queries) ? querySet.queries : [];
assert.ok(queries.length > 0, "query set must contain at least one query");
for (const query of queries) {
  assert.ok(typeof query.id === "string" && query.id.trim(), "each query needs an id");
  assert.ok(typeof query.q === "string" && query.q.trim(), `query ${query.id} needs q`);
  assert.ok(queryExpectedRefCount(query) > 0, `query ${query.id} needs at least one expectedResultId or expectedResultHash`);
}
const querySelection = selectQueries(queries);
const querySetEvidence = summarizeQuerySetEvidence(querySelection.queries);

const responsesEnvelope = loadResponses(responsesPath, { fixture: fixtureRequested, allowRawResponseText });
const responses = responsesEnvelope.responses;
if (responsesEnvelope.queryShard?.selectedQueryIdHash) {
  assert.equal(
    responsesEnvelope.queryShard.selectedQueryIdHash,
    querySelection.selectedQueryIdHash,
    "responses query shard must match collector query selection",
  );
}
const privacy = privacyFromEnvelope(responsesEnvelope, fixtureRequested);
const scored = querySelection.queries.map((query) => scoreQuery(query, responses.get(query.id) ?? emptyResponse(), { fixture: fixtureRequested, allowRawResponseText }));
const aggregate = aggregateScores(scored);
const head = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]);
const scoringCodeHash = baselineScoringContractHash();
const querySetHash = stableHash({
  schemaVersion: querySet.schemaVersion ?? 1,
  datasetSlice: querySet.datasetSlice ?? null,
  queries: queries.map((query) => ({
    id: query.id,
    q: query.q,
    expectedResultIds: query.expectedResultIds ?? [],
    expectedResultHashes: query.expectedResultHashes ?? [],
  })),
});

const result = {
  schemaVersion: 1,
  fixtureOnly: fixtureRequested || querySet.fixtureOnly === true || responsesEnvelope.fixtureOnly === true,
  evidenceType: fixtureRequested ? "fixture-recallweave-baseline-collector-result" : "live-recallweave-baseline-collector-result",
  provider: "recallweave",
  metricsOnly: true,
  retrievalProxyOnly: true,
  memoryBenchAnswerQuality: false,
  publicBenchmarkClaimsAllowed: false,
  runId,
  runAt,
  branch,
  sourceCommit: head,
  datasetSlice: String(querySet.datasetSlice ?? process.env.RECALLWEAVE_BASELINE_DATASET_SLICE ?? basename(querySetPath, ".json")),
  querySetHash: `sha256:${querySetHash}`,
  scoringCodeHash: `sha256:${scoringCodeHash}`,
  judgeModel: judgeModel ?? querySet.judgeModel ?? "fixture-judge",
  answerModel: answerModel ?? querySet.answerModel ?? "fixture-answer",
  sameHarness: true,
  sameDataset: true,
  sameJudge: true,
  sameAnswerModel: true,
  privacyLeakCount: privacy.privacyLeakCount,
  redactionFailureCount: privacy.redactionFailureCount,
  rawMemoryIncluded: privacy.rawMemoryIncluded,
  rawTranscriptIncluded: privacy.rawTranscriptIncluded,
  rawPromptIncluded: privacy.rawPromptIncluded,
  rawAnswerIncluded: privacy.rawAnswerIncluded,
  queryCount: querySelection.queries.length,
  totalQueryCount: querySelection.totalQueryCount,
  querySelection: {
    startIndex: querySelection.startIndex,
    endIndexExclusive: querySelection.endIndexExclusive,
    requestedLimit: maxQueries,
    completeDataset: querySelection.startIndex === 0 && querySelection.endIndexExclusive === querySelection.totalQueryCount,
    selectedQueryIdHash: querySelection.selectedQueryIdHash,
  },
  querySetEvidence,
  retrievalConfig: {
    source: fixtureRequested ? "fixture" : "recallweave-response-export",
    retrievalMode,
    rankingStrategy: responsesEnvelope.source?.rankingStrategy ?? null,
    limit,
    localContainerHash: localContainer ? shortHash(localContainer) : null,
    responsesHash: `sha256:${fileHash(responsesPath)}`,
    rawResponseTextAllowed: allowRawResponseText,
    contextBudget: normalizeContextBudget(responsesEnvelope.contextBudget),
  },
  metrics: {
    quality: aggregate.quality,
    pAt1: aggregate.pAt1,
    recallAt5: aggregate.recallAt5,
    recallAt10: aggregate.recallAt10,
    ndcgAt10: aggregate.ndcgAt10,
    latencyP50Ms: aggregate.latencyP50Ms,
    latencyP95Ms: aggregate.latencyP95Ms,
    contextTokensAvg: aggregate.contextTokensAvg,
  },
  cost: {
    ingestUsd: finiteNumberOrDefault(process.env.RECALLWEAVE_BASELINE_INGEST_COST_USD, 0),
    queryUsd: finiteNumberOrDefault(process.env.RECALLWEAVE_BASELINE_QUERY_COST_USD, 0),
  },
  costAssumptions: {
    source: process.env.RECALLWEAVE_BASELINE_QUERY_COST_USD ? "env" : "local_response_export_cost_assumed_zero",
  },
  resultFingerprints: scored.map((item) => item.fingerprint),
  matchedHostedRunPresent: process.env.RECALLWEAVE_MATCHED_HOSTED_RUN_PRESENT === "1",
  reviewerApprovalCount: Number(process.env.RECALLWEAVE_REVIEWER_APPROVAL_COUNT ?? 0),
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern, "RecallWeave baseline output contains a key-shaped secret");
assert.doesNotMatch(serialized, privatePathPattern, "RecallWeave baseline output contains a private path");

if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { mode: 0o600 });
}
process.stdout.write(serialized);

function loadResponses(inputPath, options) {
  const raw = readFileSync(inputPath, "utf8");
  assert.doesNotMatch(raw, secretPattern, `${displayPath(inputPath)} contains a key-shaped secret`);
  assert.doesNotMatch(raw, privatePathPattern, `${displayPath(inputPath)} contains a private path`);
  const envelope = JSON.parse(raw);
  if (!options.fixture && !options.allowRawResponseText) assertNoRawResponseText(envelope);
  const responses = new Map();
  for (const [queryId, response] of Object.entries(envelope.responses ?? {})) {
    responses.set(queryId, response);
  }
  return { ...envelope, responses };
}

function assertNoRawResponseText(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawResponseText(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (["memory", "content", "chunk", "text", "raw", "rawText", "document"].includes(key) && typeof child === "string" && child.trim()) {
      throw new Error(`${nextPath} contains raw response text; provide contentHash and estimatedTokens or set RECALLWEAVE_BASELINE_ALLOW_RAW_RESPONSE_TEXT=1 for local-only experiments`);
    }
    assertNoRawResponseText(child, nextPath);
  }
}

function privacyFromEnvelope(envelope, fixture) {
  return {
    privacyLeakCount: fixture ? Number(envelope.privacyLeakCount ?? 0) : requiredNumber(envelope.privacyLeakCount, "privacyLeakCount"),
    redactionFailureCount: fixture ? Number(envelope.redactionFailureCount ?? 0) : requiredNumber(envelope.redactionFailureCount, "redactionFailureCount"),
    rawMemoryIncluded: fixture ? Boolean(envelope.rawMemoryIncluded ?? false) : requiredBoolean(envelope, "rawMemoryIncluded"),
    rawTranscriptIncluded: fixture ? Boolean(envelope.rawTranscriptIncluded ?? false) : requiredBoolean(envelope, "rawTranscriptIncluded"),
    rawPromptIncluded: fixture ? Boolean(envelope.rawPromptIncluded ?? false) : requiredBoolean(envelope, "rawPromptIncluded"),
    rawAnswerIncluded: fixture ? Boolean(envelope.rawAnswerIncluded ?? false) : requiredBoolean(envelope, "rawAnswerIncluded"),
  };
}

function scoreQuery(query, response, options) {
  const results = normalizeResults(response.results ?? [], options);
  const expectedIds = new Set(query.expectedResultIds ?? []);
  const expectedHashes = new Set(query.expectedResultHashes ?? []);
  const expectedCount = expectedIds.size + expectedHashes.size;
  const ranks = [];
  results.forEach((result, index) => {
    if (isRelevant(result, expectedIds, expectedHashes)) ranks.push(index + 1);
  });
  const pAt1 = ranks.includes(1) ? 1 : 0;
  const recallAt5 = expectedCount > 0 ? hitsAt(ranks, 5) / expectedCount : 0;
  const recallAt10 = expectedCount > 0 ? hitsAt(ranks, 10) / expectedCount : 0;
  const ndcgAt10 = expectedCount > 0 ? dcg(ranks.filter((rank) => rank <= 10)) / idealDcg(Math.min(expectedCount, 10)) : 0;
  const top = results[0] ?? null;
  return {
    pAt1,
    recallAt5: cap01(recallAt5),
    recallAt10: cap01(recallAt10),
    ndcgAt10: cap01(ndcgAt10),
    latencyMs: Number(response.timing ?? response.latencyMs ?? 0),
    contextTokens: estimateContextTokens(results),
    fingerprint: {
      queryIdHash: shortHash(query.id),
      queryHash: shortHash(query.q),
      resultCount: results.length,
      total: Number(response.total ?? results.length),
      latencyMs: Number(response.timing ?? response.latencyMs ?? 0),
      topResultIdHash: top?.id ? shortHash(top.id) : null,
      topResultContentHash: top?.contentHash ?? null,
      expectedCount,
      pAt1,
      recallAt5: cap01(recallAt5),
      recallAt10: cap01(recallAt10),
      ndcgAt10: cap01(ndcgAt10),
    },
  };
}

function summarizeQuerySetEvidence(queries) {
  const expectedRefCounts = queries.map(queryExpectedRefCount);
  const queryHashes = queries.map((query) => shortHash(query.q));
  const uniqueQueryCount = new Set(queryHashes).size;
  const duplicateQueryCount = queries.length - uniqueQueryCount;
  return {
    queryCount: queries.length,
    uniqueQueryCount,
    duplicateQueryCount,
    labeledQueryCount: expectedRefCounts.filter((count) => count > 0).length,
    unlabeledQueryCount: expectedRefCounts.filter((count) => count === 0).length,
    expectedResultRefCount: expectedRefCounts.reduce((sum, count) => sum + count, 0),
    minExpectedRefsPerQuery: Math.min(...expectedRefCounts),
    usesExpectedIds: queries.some((query) => Array.isArray(query.expectedResultIds) && query.expectedResultIds.length > 0),
    usesExpectedHashes: queries.some((query) => Array.isArray(query.expectedResultHashes) && query.expectedResultHashes.length > 0),
    publicBenchmarkReady: expectedRefCounts.every((count) => count > 0) && duplicateQueryCount === 0,
  };
}

function queryExpectedRefCount(query) {
  return arrayLength(query.expectedResultIds) + arrayLength(query.expectedResultHashes);
}

function arrayLength(value) {
  return Array.isArray(value) ? value.filter((item) => String(item).trim()).length : 0;
}

function normalizeResults(results, options) {
  return results.map((result) => {
    const text = options.fixture || options.allowRawResponseText ? String(result.memory ?? result.chunk ?? result.content ?? result.text ?? "") : "";
    return {
      id: String(result.id ?? result.memoryId ?? result.chunkId ?? ""),
      similarity: Number(result.similarity ?? result.score ?? 0),
      contentHash: String(result.contentHash ?? result.hash ?? (text ? `sha256:${stableHash(text)}` : "")) || null,
      estimatedTokens: Number(result.estimatedTokens ?? result.tokens ?? (text ? estimateTokens(text) : 0)),
    };
  });
}

function normalizeContextBudget(value) {
  if (!value || typeof value !== "object") {
    return {
      applied: false,
      tokenBudget: null,
      strategy: "not-reported",
      exportedContextTokensAvg: null,
    };
  }
  return {
    applied: Boolean(value.applied),
    tokenBudget: finiteNumberOrNull(value.tokenBudget),
    strategy: String(value.strategy ?? ""),
    queryCount: finiteNumberOrNull(value.queryCount),
    queriesClipped: finiteNumberOrNull(value.queriesClipped),
    clippedResultCount: finiteNumberOrNull(value.clippedResultCount),
    skippedByBudgetCount: finiteNumberOrNull(value.skippedByBudgetCount),
    fullCandidateTokensAvg: finiteNumberOrNull(value.fullCandidateTokensAvg),
    exportedContextTokensAvg: finiteNumberOrNull(value.exportedContextTokensAvg),
  };
}

function isRelevant(result, expectedIds, expectedHashes) {
  return (result.id && expectedIds.has(result.id)) || (result.contentHash && expectedHashes.has(result.contentHash));
}

function aggregateScores(scored) {
  const latencies = scored.map((item) => item.latencyMs).filter(Number.isFinite).sort((a, b) => a - b);
  const pAt1 = average(scored.map((item) => item.pAt1));
  const recallAt5 = average(scored.map((item) => item.recallAt5));
  const recallAt10 = average(scored.map((item) => item.recallAt10));
  const ndcgAt10 = average(scored.map((item) => item.ndcgAt10));
  return {
    quality: round((pAt1 + recallAt5 + recallAt10 + ndcgAt10) / 4),
    pAt1,
    recallAt5,
    recallAt10,
    ndcgAt10,
    latencyP50Ms: percentile(latencies, 0.5),
    latencyP95Ms: percentile(latencies, 0.95),
    contextTokensAvg: Math.round(average(scored.map((item) => item.contextTokens))),
  };
}

function emptyResponse() {
  return { timing: 0, total: 0, results: [] };
}

function hitsAt(ranks, k) {
  return ranks.filter((rank) => rank <= k).length;
}

function dcg(ranks) {
  return ranks.reduce((sum, rank) => sum + 1 / Math.log2(rank + 1), 0);
}

function idealDcg(count) {
  return Array.from({ length: count }, (_, index) => 1 / Math.log2(index + 2)).reduce((sum, value) => sum + value, 0) || 1;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
  return Math.round(values[index]);
}

function estimateContextTokens(results) {
  return results.reduce((sum, result) => sum + Number(result.estimatedTokens ?? 0), 0);
}

function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}

function cap01(value) {
  return round(Math.max(0, Math.min(1, value)));
}

function round(value) {
  return Number(Number(value).toFixed(4));
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function fileHash(path) {
  return stableHash(readFileSync(path, "utf8"));
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
}

function finiteNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "" || value === false) return null;
  return positiveInt(value, label);
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "" || value === false) return 0;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer`);
  return number;
}

function selectQueries(inputQueries) {
  const totalQueryCount = inputQueries.length;
  assert.ok(queryOffset <= totalQueryCount, `query offset ${queryOffset} exceeds query count ${totalQueryCount}`);
  const endIndexExclusive = maxQueries ? Math.min(totalQueryCount, queryOffset + maxQueries) : totalQueryCount;
  const selected = inputQueries.slice(queryOffset, endIndexExclusive);
  assert.ok(selected.length > 0, "selected query shard is empty");
  return {
    queries: selected,
    totalQueryCount,
    startIndex: queryOffset,
    endIndexExclusive,
    selectedQueryIdHash: `sha256:${stableHash(selected.map((query) => shortHash(query.id)).join("\n"))}`,
  };
}

function requiredNumber(value, label) {
  const number = Number(value);
  assert.ok(Number.isFinite(number), `${label} must be present and finite`);
  return number;
}

function requiredBoolean(value, label) {
  assert.equal(typeof value[label], "boolean", `${label} must be present and boolean`);
  return value[label];
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
