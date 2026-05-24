import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
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
const memoriesPath = resolveInputPath(
    args.memories ??
    args.memoriesJsonl ??
    process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ??
    (fixtureRequested ? "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl" : null),
);
const containerDir = resolveInputPath(args.containerDir ?? process.env.RECALLWEAVE_BASELINE_CONTAINER_DIR ?? null);
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_RESPONSES_JSON ?? null;
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 10, "limit");
const preserveIds = fixtureRequested || args.preserveIds === true || process.env.RECALLWEAVE_BASELINE_PRESERVE_IDS === "1";
const rankingStrategy = normalizeStrategy(args.strategy ?? process.env.RECALLWEAVE_BASELINE_RETRIEVAL_STRATEGY ?? "jaccard");
const contextTokenBudget = optionalPositiveInt(
  args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? null,
  "context token budget",
);
const generatedAt = new Date().toISOString();

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(querySetPath, "query set is required. Pass --queryset or RECALLWEAVE_BASELINE_QUERYSET");
assert.ok(existsSync(querySetPath), `query set missing: ${displayPath(querySetPath)}`);
assert.ok(statSync(querySetPath).size > 0, `query set empty: ${displayPath(querySetPath)}`);

const effectiveMemoriesPath = memoriesPath ?? (containerDir ? join(containerDir, "memories.jsonl") : null);
assert.ok(effectiveMemoriesPath, "memories input is required. Pass --memories, --container-dir, or RECALLWEAVE_BASELINE_MEMORIES_JSONL");
assert.ok(existsSync(effectiveMemoriesPath), `memories file missing: ${displayPath(effectiveMemoriesPath)}`);
assert.ok(statSync(effectiveMemoriesPath).size > 0, `memories file empty: ${displayPath(effectiveMemoriesPath)}`);
assert.ok(statSync(effectiveMemoriesPath).size <= 5_000_000, `memories file too large for metrics export: ${displayPath(effectiveMemoriesPath)}`);

if (!fixtureRequested) {
  assert.equal(liveRequested, true, "live RecallWeave response export requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.equal(process.env.RECALLWEAVE_BASELINE_NO_RAW_TEXT, "1", "set RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 before live response export");
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
}

const loaded = loadMemories(effectiveMemoriesPath, { preserveIds });
assert.ok(loaded.candidates.length > 0, "memories input produced no searchable candidates");

const responses = {};
const contextBudgetStats = [];
for (const query of queries) {
  const startedAt = performance.now();
  const ranked = rankCandidates(query.q, loaded.candidates, { strategy: rankingStrategy }).slice(0, limit);
  const budgeted = applyContextBudget(ranked, { contextTokenBudget });
  contextBudgetStats.push({ queryIdHash: shortHash(query.id), ...budgeted.stats });
  responses[query.id] = {
    timing: Math.max(1, Math.round(performance.now() - startedAt)),
    total: budgeted.results.length,
    totalBeforeBudget: ranked.length,
    contextBudget: budgeted.stats,
    results: budgeted.results.map((candidate) => ({
      id: candidate.outputId,
      contentHash: candidate.contentHash,
      score: candidate.score,
      estimatedTokens: candidate.contextEstimatedTokens,
      source: "local_selfmem",
    })),
  };
}

const result = {
  schemaVersion: 1,
  fixtureOnly: fixtureRequested || querySet.fixtureOnly === true,
  evidenceType: fixtureRequested ? "fixture-recallweave-response-export" : "live-recallweave-response-export",
  metricsOnly: true,
  generatedAt,
  querySetHash: `sha256:${stableHash({
    schemaVersion: querySet.schemaVersion ?? 1,
    datasetSlice: querySet.datasetSlice ?? null,
    queries: queries.map((query) => ({
      id: query.id,
      q: query.q,
      expectedResultIds: query.expectedResultIds ?? [],
      expectedResultHashes: query.expectedResultHashes ?? [],
    })),
  })}`,
  source: {
    kind: fixtureRequested ? "fixture-local-container" : "local-container-memories-jsonl",
    containerDirHash: containerDir ? shortHash(containerDir) : null,
    memoriesFileHash: `sha256:${fileHash(effectiveMemoriesPath)}`,
    memoriesFileName: basename(effectiveMemoriesPath),
    preserveIds,
    rankingStrategy,
  },
  privacyLeakCount: 0,
  redactionFailureCount: 0,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  inputStats: {
    linesRead: loaded.linesRead,
    parsed: loaded.parsed,
    candidates: loaded.candidates.length,
    skippedInvalid: loaded.skippedInvalid,
    skippedFullyPrivate: loaded.skippedFullyPrivate,
    redactionCount: loaded.redactionCount,
    keyRedactionCount: loaded.keyRedactionCount,
  },
  contextBudget: summarizeContextBudget(contextBudgetStats, { contextTokenBudget }),
  responses,
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern, "RecallWeave response export contains a key-shaped secret");
assert.doesNotMatch(serialized, privatePathPattern, "RecallWeave response export contains a private path");
assert.doesNotMatch(serialized, privateTagPattern, "RecallWeave response export contains private tags");
assert.doesNotMatch(serialized, /\b(memory|content|chunk|text|raw|rawText|document)"\s*:/, "RecallWeave response export contains raw response text fields");

if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { mode: 0o600 });
}
process.stdout.write(serialized);

function loadMemories(inputPath, options) {
  const raw = readFileSync(inputPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const candidates = [];
  let parsed = 0;
  let skippedInvalid = 0;
  let skippedFullyPrivate = 0;
  let redactionCount = 0;
  let keyRedactionCount = 0;

  lines.forEach((line, index) => {
    try {
      const item = JSON.parse(line);
      parsed += 1;
      const text = extractMemoryText(item);
      if (!text.trim()) {
        skippedInvalid += 1;
        return;
      }
      const redacted = redactForExport(text);
      redactionCount += redacted.privateRedactionCount;
      keyRedactionCount += redacted.keyRedactionCount;
      if (!redacted.text.trim()) {
        skippedFullyPrivate += 1;
        return;
      }
      const sourceId = safeScalar(item.id ?? item.memory_id ?? item.memoryId ?? item.sourceId ?? `line-${index + 1}`);
      const contentHash = `sha256:${stableHash(normalizeText(redacted.text))}`;
      candidates.push({
        sourceId,
        outputId: options.preserveIds ? sourceId : `memory:${shortHash(sourceId)}`,
        text: redacted.text,
        contentHash,
        estimatedTokens: estimateTokens(redacted.text),
        baseScore: finiteNumberOrDefault(item.score ?? item.similarity ?? item.confidence, 0),
      });
    } catch {
      skippedInvalid += 1;
    }
  });

  return {
    linesRead: lines.length,
    parsed,
    candidates,
    skippedInvalid,
    skippedFullyPrivate,
    redactionCount,
    keyRedactionCount,
  };
}

function extractMemoryText(item) {
  if (!item || typeof item !== "object") return "";
  for (const key of ["content", "memory", "text", "summary", "value", "distilled", "replacementText"]) {
    if (typeof item[key] === "string") return item[key];
  }
  if (item.metadata && typeof item.metadata === "object") {
    for (const key of ["content", "memory", "text", "summary"]) {
      if (typeof item.metadata[key] === "string") return item.metadata[key];
    }
  }
  return "";
}

function rankCandidates(query, candidates, options = {}) {
  if (options.strategy === "bm25-lite") return rankBm25Lite(query, candidates);
  if (options.strategy === "hybrid-v1") return rankHybridV1(query, candidates);
  return rankJaccard(query, candidates);
}

function rankJaccard(query, candidates) {
  const queryTokens = new Set(tokenize(query));
  return candidates
    .map((candidate) => {
      const docTokens = new Set(tokenize(candidate.text));
      let overlap = 0;
      for (const token of queryTokens) {
        if (docTokens.has(token)) overlap += 1;
      }
      const union = new Set([...queryTokens, ...docTokens]).size || 1;
      const lexical = overlap / union;
      const exactBoost = candidate.text.toLowerCase().includes(query.toLowerCase()) ? 0.1 : 0;
      return { ...candidate, score: round(Math.min(1, candidate.baseScore + lexical + exactBoost)) };
    })
    .sort((left, right) => right.score - left.score || left.outputId.localeCompare(right.outputId));
}

function rankHybridV1(query, candidates) {
  const bm25 = new Map(rankBm25Lite(query, candidates).map((candidate, index) => [candidate.outputId, { score: candidate.score, rank: index + 1 }]));
  const jaccard = new Map(rankJaccard(query, candidates).map((candidate, index) => [candidate.outputId, { score: candidate.score, rank: index + 1 }]));
  const queryBigrams = new Set(ngrams(tokenize(query), 2));
  return candidates
    .map((candidate) => {
      const candidateTokens = tokenize(candidate.text);
      const candidateBigramSet = new Set(ngrams(candidateTokens, 2));
      let bigramHits = 0;
      for (const bigram of queryBigrams) {
        if (candidateBigramSet.has(bigram)) bigramHits += 1;
      }
      const bigramScore = queryBigrams.size ? bigramHits / queryBigrams.size : 0;
      const bm25Score = bm25.get(candidate.outputId)?.score ?? 0;
      const jaccardScore = jaccard.get(candidate.outputId)?.score ?? 0;
      const rankBoost = reciprocalRankBoost(bm25.get(candidate.outputId)?.rank) + reciprocalRankBoost(jaccard.get(candidate.outputId)?.rank);
      const score = bm25Score * 0.72 + jaccardScore * 0.18 + bigramScore * 0.08 + rankBoost * 0.02;
      return { ...candidate, score: round(score) };
    })
    .sort((left, right) => right.score - left.score || left.outputId.localeCompare(right.outputId));
}

function rankBm25Lite(query, candidates) {
  const queryTokens = tokenize(query);
  const uniqueQueryTokens = [...new Set(queryTokens)];
  const docs = candidates.map((candidate) => {
    const tokens = tokenize(candidate.text);
    return {
      candidate,
      tokens,
      frequencies: tokenFrequencies(tokens),
      length: Math.max(1, tokens.length),
    };
  });
  const averageLength = Math.max(1, average(docs.map((doc) => doc.length)));
  const documentCount = Math.max(1, docs.length);
  const documentFrequency = new Map();
  for (const token of uniqueQueryTokens) {
    documentFrequency.set(token, docs.filter((doc) => doc.frequencies.has(token)).length);
  }
  const k1 = 1.2;
  const b = 0.75;
  return docs
    .map((doc) => {
      let score = 0;
      for (const token of uniqueQueryTokens) {
        const tf = doc.frequencies.get(token) ?? 0;
        if (!tf) continue;
        const df = documentFrequency.get(token) ?? 0;
        const idf = Math.log(1 + (documentCount - df + 0.5) / (df + 0.5));
        score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.length / averageLength))));
      }
      const exactBoost = doc.candidate.text.toLowerCase().includes(query.toLowerCase()) ? 0.1 : 0;
      return { ...doc.candidate, score: round(score + exactBoost + doc.candidate.baseScore) };
    })
    .sort((left, right) => right.score - left.score || left.outputId.localeCompare(right.outputId));
}

function ngrams(tokens, size) {
  if (tokens.length < size) return [];
  return Array.from({ length: tokens.length - size + 1 }, (_, index) => tokens.slice(index, index + size).join(" "));
}

function tokenFrequencies(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function reciprocalRankBoost(rank) {
  return Number.isFinite(rank) && rank > 0 ? 1 / (60 + rank) : 0;
}

function applyContextBudget(candidates, options) {
  const fullTokens = sumTokens(candidates.map((candidate) => candidate.estimatedTokens));
  if (!options.contextTokenBudget) {
    return {
      results: candidates.map((candidate) => ({ ...candidate, contextEstimatedTokens: candidate.estimatedTokens })),
      stats: {
        applied: false,
        tokenBudget: null,
        selectedCount: candidates.length,
        skippedByBudgetCount: 0,
        clippedResultCount: 0,
        fullCandidateTokens: fullTokens,
        exportedContextTokens: fullTokens,
      },
    };
  }

  let remaining = options.contextTokenBudget;
  let clippedResultCount = 0;
  let skippedByBudgetCount = 0;
  const results = [];
  for (const candidate of candidates) {
    if (remaining <= 0) {
      skippedByBudgetCount += 1;
      continue;
    }
    const full = Math.max(1, Number(candidate.estimatedTokens ?? 1));
    const contextEstimatedTokens = Math.min(full, remaining);
    if (contextEstimatedTokens < full) clippedResultCount += 1;
    results.push({ ...candidate, contextEstimatedTokens });
    remaining -= contextEstimatedTokens;
  }

  return {
    results,
    stats: {
      applied: true,
      tokenBudget: options.contextTokenBudget,
      selectedCount: results.length,
      skippedByBudgetCount,
      clippedResultCount,
      fullCandidateTokens: fullTokens,
      exportedContextTokens: sumTokens(results.map((candidate) => candidate.contextEstimatedTokens)),
    },
  };
}

function summarizeContextBudget(stats, options) {
  const applied = Boolean(options.contextTokenBudget);
  return {
    applied,
    tokenBudget: options.contextTokenBudget ?? null,
    strategy: applied ? "ranked-prefix-with-last-result-clipping" : "unbounded-full-memory-token-estimate",
    queryCount: stats.length,
    queriesClipped: stats.filter((item) => item.clippedResultCount > 0 || item.skippedByBudgetCount > 0).length,
    clippedResultCount: sumTokens(stats.map((item) => item.clippedResultCount)),
    skippedByBudgetCount: sumTokens(stats.map((item) => item.skippedByBudgetCount)),
    fullCandidateTokensAvg: Math.round(average(stats.map((item) => item.fullCandidateTokens))),
    exportedContextTokensAvg: Math.round(average(stats.map((item) => item.exportedContextTokens))),
  };
}

function redactForExport(text) {
  const privateMatches = text.match(privateTagPattern) ?? [];
  let redacted = text.replace(privateTagPattern, " ");
  const keyMatches = redacted.match(secretPattern) ?? [];
  redacted = redacted.replace(secretPattern, " ");
  return {
    text: redacted.replace(/\s+/g, " ").trim(),
    privateRedactionCount: privateMatches.length,
    keyRedactionCount: keyMatches.length,
  };
}

function tokenize(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9_/-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

function sumTokens(values) {
  return values.reduce((sum, value) => sum + Number(value ?? 0), 0);
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function safeScalar(value) {
  const text = String(value ?? "").trim() || "unknown";
  assert.doesNotMatch(text, secretPattern, "memory id contains a key-shaped secret");
  assert.doesNotMatch(text, privatePathPattern, "memory id contains a private path");
  return text.slice(0, 160);
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
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

function round(value) {
  return Number(Number(value).toFixed(4));
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

function optionalPositiveInt(value, label) {
  if (value == null || value === "" || value === false) return null;
  return positiveInt(value, label);
}

function normalizeStrategy(value) {
  const strategy = String(value ?? "").trim().toLowerCase() || "jaccard";
  assert.ok(["jaccard", "bm25-lite", "hybrid-v1"].includes(strategy), `unknown retrieval strategy: ${strategy}`);
  return strategy;
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
