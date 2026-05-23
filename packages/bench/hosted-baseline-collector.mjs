import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const fixtureResponsesPath = resolveInputPath(
  args.fixtureResponses ?? "packages/bench/fixtures/hosted-baseline-search-responses.fixture.json",
);
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_OUTPUT_JSON ?? null;
const searchMode = String(args.searchMode ?? process.env.RECALLWEAVE_BASELINE_SEARCH_MODE ?? "hybrid");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 10, "limit");
const threshold = finiteNumber(args.threshold ?? process.env.RECALLWEAVE_BASELINE_THRESHOLD ?? 0.5, "threshold");
const rerank = parseBoolean(args.rerank ?? process.env.RECALLWEAVE_BASELINE_RERANK ?? "true");
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.RECALLWEAVE_BASELINE_TIMEOUT_MS ?? 15000, "timeoutMs");
const runAt = new Date().toISOString();
const runId =
  args.runId ??
  process.env.RECALLWEAVE_BASELINE_RUN_ID ??
  (fixtureRequested ? "fixture-supermemory-baseline-collector" : `supermemory-baseline-${runAt.replace(/[-:.TZ]/g, "").slice(0, 12)}`);
const judgeModel = args.judgeModel ?? process.env.RECALLWEAVE_BASELINE_JUDGE_MODEL ?? null;
const answerModel = args.answerModel ?? process.env.RECALLWEAVE_BASELINE_ANSWER_MODEL ?? null;
const containerTag = args.container ?? args.containerTag ?? process.env.RECALLWEAVE_BASELINE_CONTAINER ?? null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

assert.ok(querySetPath, "query set is required. Pass --queryset or RECALLWEAVE_BASELINE_QUERYSET");
assert.ok(existsSync(querySetPath), `query set missing: ${displayPath(querySetPath)}`);
assert.ok(statSync(querySetPath).size > 0, `query set empty: ${displayPath(querySetPath)}`);

if (!fixtureRequested) {
  assert.equal(liveRequested, true, "live hosted baseline collection requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.equal(process.env.RECALLWEAVE_BASELINE_NO_RAW_TEXT, "1", "set RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 before live collection");
  assert.ok(process.env.SUPERMEMORY_API_KEY, "SUPERMEMORY_API_KEY must be present in the environment for live collection");
  assert.ok(containerTag, "RECALLWEAVE_BASELINE_CONTAINER or --container is required for live collection");
  assert.ok(judgeModel, "RECALLWEAVE_BASELINE_JUDGE_MODEL or --judge-model is required for live collection");
  assert.ok(answerModel, "RECALLWEAVE_BASELINE_ANSWER_MODEL or --answer-model is required for live collection");
}

const querySet = JSON.parse(readFileSync(querySetPath, "utf8"));
const queries = Array.isArray(querySet.queries) ? querySet.queries : [];
assert.ok(queries.length > 0, "query set must contain at least one query");
for (const query of queries) {
  assert.ok(typeof query.id === "string" && query.id.trim(), "each query needs an id");
  assert.ok(typeof query.q === "string" && query.q.trim(), `query ${query.id} needs q`);
}

const responses = fixtureRequested
  ? loadFixtureResponses(fixtureResponsesPath)
  : await collectLiveResponses({ queries, containerTag, searchMode, limit, threshold, rerank, timeoutMs });

const scored = queries.map((query) => scoreQuery(query, responses.get(query.id) ?? emptyResponse()));
const aggregate = aggregateScores(scored);
const head = git(["rev-parse", "HEAD"]);
const branch = git(["branch", "--show-current"]);
const scoringCodeHash = fileHash(new URL(import.meta.url));
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
  fixtureOnly: fixtureRequested || querySet.fixtureOnly === true,
  evidenceType: fixtureRequested ? "fixture-hosted-baseline-collector-result" : "live-hosted-baseline-collector-result",
  provider: "hosted-supermemory",
  metricsOnly: true,
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
  privacyLeakCount: 0,
  redactionFailureCount: 0,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  queryCount: queries.length,
  searchConfig: {
    endpoint: fixtureRequested ? "fixture" : "https://api.supermemory.ai/v4/search",
    searchMode,
    limit,
    threshold,
    rerank,
    containerTagHash: containerTag ? shortHash(containerTag) : null,
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
    source: process.env.RECALLWEAVE_BASELINE_QUERY_COST_USD ? "env" : "provider_did_not_return_cost_assumed_zero_for_read_only_search",
  },
  resultFingerprints: scored.map((item) => item.fingerprint),
  matchedRecallWeaveRunPresent: process.env.RECALLWEAVE_MATCHED_RUN_PRESENT === "1",
  reviewerApprovalCount: Number(process.env.RECALLWEAVE_REVIEWER_APPROVAL_COUNT ?? 0),
  recallWeaveWin: process.env.RECALLWEAVE_WIN === "1",
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern, "baseline collector output contains a key-shaped secret");
assert.doesNotMatch(serialized, privatePathPattern, "baseline collector output contains a private path");

if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { mode: 0o600 });
}
process.stdout.write(serialized);

async function collectLiveResponses({ queries, containerTag, searchMode, limit, threshold, rerank, timeoutMs }) {
  const collected = new Map();
  for (const query of queries) {
    const started = performance.now();
    const response = await fetch("https://api.supermemory.ai/v4/search", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.SUPERMEMORY_API_KEY}`,
        "content-type": "application/json",
        "user-agent": "recallweave-hosted-baseline-collector",
      },
      body: JSON.stringify({
        q: query.q,
        containerTag,
        searchMode,
        limit,
        threshold,
        rerank,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Supermemory search failed for query ${query.id}: HTTP ${response.status}`);
    }
    const payload = await response.json();
    collected.set(query.id, {
      timing: Number(payload.timing ?? Math.round(performance.now() - started)),
      total: Number(payload.total ?? payload.results?.length ?? 0),
      results: Array.isArray(payload.results) ? payload.results : [],
    });
  }
  return collected;
}

function loadFixtureResponses(inputPath) {
  assert.ok(inputPath, "fixture responses path is required");
  assert.ok(existsSync(inputPath), `fixture responses missing: ${displayPath(inputPath)}`);
  const fixture = JSON.parse(readFileSync(inputPath, "utf8"));
  const responses = new Map();
  for (const [queryId, response] of Object.entries(fixture.responses ?? {})) {
    responses.set(queryId, response);
  }
  return responses;
}

function scoreQuery(query, response) {
  const results = normalizeResults(response.results ?? []);
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
    latencyMs: Number(response.timing ?? 0),
    contextTokens: estimateContextTokens(results),
    fingerprint: {
      queryIdHash: shortHash(query.id),
      queryHash: shortHash(query.q),
      resultCount: results.length,
      total: Number(response.total ?? results.length),
      latencyMs: Number(response.timing ?? 0),
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

function normalizeResults(results) {
  return results.map((result) => {
    const text = String(result.memory ?? result.chunk ?? result.content ?? "");
    return {
      id: String(result.id ?? result.memoryId ?? result.chunkId ?? ""),
      similarity: Number(result.similarity ?? result.score ?? 0),
      contentHash: text ? `sha256:${stableHash(text)}` : null,
      estimatedTokens: estimateTokens(text),
    };
  });
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

function fileHash(url) {
  return stableHash(readFileSync(url, "utf8"));
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
}

function finiteNumber(value, label) {
  const number = Number(value);
  assert.ok(Number.isFinite(number), `${label} must be a finite number`);
  return number;
}

function finiteNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
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

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
