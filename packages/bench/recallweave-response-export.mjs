import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildQueryExpansionRequest } from "../core/dist/query-expansion/request.js";

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
const retrievalStrategies = [
  "jaccard",
  "bm25-lite",
  "hybrid-v1",
  "dense-proxy",
  "sparse-dense-rrf",
  "sparse-dense-temporal",
  "sparse-dense-graph-temporal",
  "full-hybrid-rerank",
  "metadata-aware-full-hybrid-rerank",
  "query-expanded-full-hybrid-rerank",
  "cloud-voyage-rerank-only",
  "cloud-voyage4-voyage",
  "cloud-voyage4-voyage-lite-rerank",
  "cloud-voyage4-lite-voyage-lite",
  "cloud-gemini-embed-rerank-proxy",
  "cloud-gemini-voyage-rerank",
  "cloud-nvidia-retriever-500m",
  "cloud-nvidia-nemotron-1b",
  "cloud-nvidia-nemotron-vl-1b",
  "cloud-nvidia-e5-mistral",
  "cloud-nvidia-code",
  "local-apple-qwen3-0_6b",
  "local-apple-qwen3-0_6b-local-rerank",
  "local-apple-qwen3-4b",
];
const rankingStrategy = normalizeStrategy(args.strategy ?? process.env.RECALLWEAVE_BASELINE_RETRIEVAL_STRATEGY ?? "jaccard");
const contextTokenBudget = optionalPositiveInt(
  args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? null,
  "context token budget",
);
const maxMemoryBytes =
  optionalPositiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? null, "max memory bytes") ??
  5_000_000;
const generatedAt = new Date().toISOString();
const providerBenchmarkCallsAllowed = process.env.RECALLWEAVE_PROVIDER_BENCHMARK_CALLS === "1";
const providerBenchmarkPublicData = process.env.RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA === "1";
const providerLastRequestAt = new Map();

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
assert.ok(
  statSync(effectiveMemoriesPath).size <= maxMemoryBytes,
  `memories file too large for metrics export: ${displayPath(effectiveMemoriesPath)}; size=${statSync(effectiveMemoriesPath).size}; max=${maxMemoryBytes}`,
);

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
const providerStats = createProviderStats({ strategy: rankingStrategy, fixtureRequested });
const localAppleDocumentEmbeddingCache = new Map();
let localApplePersistentCacheState = null;

const responses = {};
const contextBudgetStats = [];
for (const query of queries) {
  const startedAt = performance.now();
  const ranked = (await rankCandidates(query, loaded.candidates, { strategy: rankingStrategy, fixtureRequested, providerStats })).slice(0, limit);
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
    provider: providerStats.summary(),
  },
  privacyLeakCount: 0,
  redactionFailureCount: 0,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  inputStats: {
    maxMemoryBytes,
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
      const metadata = sanitizeMetadata(item.metadata);
      const tokens = tokenize(redacted.text);
      const contentHash = `sha256:${stableHash(normalizeText(redacted.text))}`;
      candidates.push({
        sourceId,
        outputId: options.preserveIds ? sourceId : `memory:${shortHash(sourceId)}`,
        text: redacted.text,
        contentHash,
        estimatedTokens: estimateTokens(redacted.text),
        metadata,
        dateMs: extractDateMs(item, redacted.text),
        tokens,
        tokenSet: new Set(tokens),
        bigramSet: new Set(ngrams(tokens, 2)),
        semanticVector: hashedSemanticVector(redacted.text),
        topicTermSet: topicTerms(`${redacted.text} ${metadata.kind ?? ""} ${metadata.questionType ?? ""}`),
        roleCoverage: roleCoverageScore(redacted.text),
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

async function rankCandidates(query, candidates, options = {}) {
  const queryText = queryTextValue(query);
  if (options.strategy === "bm25-lite") return rankBm25Lite(queryText, candidates);
  if (options.strategy === "hybrid-v1") return rankHybridV1(queryText, candidates);
  if (options.strategy === "dense-proxy") return rankDenseProxy(queryText, candidates);
  if (options.strategy === "sparse-dense-rrf") return rankSparseDenseRrf(queryText, candidates);
  if (options.strategy === "sparse-dense-temporal") return rankSparseDenseTemporal(query, candidates);
  if (options.strategy === "sparse-dense-graph-temporal") return rankSparseDenseGraphTemporal(query, candidates);
  if (options.strategy === "full-hybrid-rerank") return rankFullHybridRerank(query, candidates);
  if (options.strategy === "metadata-aware-full-hybrid-rerank") return rankMetadataAwareFullHybridRerank(query, candidates);
  if (options.strategy === "query-expanded-full-hybrid-rerank") return rankQueryExpandedFullHybridRerank(query, candidates, options);
  if (options.strategy === "cloud-voyage-rerank-only") return rankCloudVoyageRerankOnly(query, candidates, options);
  if (voyageStrategyConfig(options.strategy)?.mode === "embed-rerank") return rankCloudVoyage4Voyage(query, candidates, options);
  if (options.strategy === "cloud-gemini-embed-rerank-proxy") return rankCloudGeminiEmbedRerankProxy(query, candidates, options);
  if (options.strategy === "cloud-gemini-voyage-rerank") return rankCloudGeminiVoyageRerank(query, candidates, options);
  if (nvidiaStrategyConfig(options.strategy)) return rankCloudNvidiaHybrid(query, candidates, options);
  if (localAppleStrategyConfig(options.strategy)) return rankLocalAppleQwen(query, candidates, options);
  return rankJaccard(queryText, candidates);
}

function rankJaccard(query, candidates) {
  const queryTokens = new Set(tokenize(query));
  return candidates
    .map((candidate) => {
      const docTokens = candidate.tokenSet ?? new Set(tokenize(candidate.text));
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
      const candidateBigramSet = candidate.bigramSet ?? new Set(ngrams(tokenize(candidate.text), 2));
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

function rankDenseProxy(query, candidates) {
  const expandedQuery = expandQuery(query);
  const queryVector = hashedSemanticVector(expandedQuery);
  return candidates
    .map((candidate) => {
      const score = cosine(queryVector, candidate.semanticVector ?? hashedSemanticVector(candidate.text)) + candidate.baseScore * 0.02;
      return { ...candidate, score: round(score) };
    })
    .sort(byScoreThenId);
}

function rankSparseDenseRrf(query, candidates) {
  return fuseRankedChannels(
    candidates,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(query, candidates) },
      { name: "dense", weight: 0.85, ranked: rankDenseProxy(query, candidates) },
    ],
    { scoreScale: 8 },
  );
}

function rankSparseDenseTemporal(query, candidates) {
  const queryText = queryTextValue(query);
  return fuseRankedChannels(
    candidates,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, candidates) },
      { name: "dense", weight: 0.85, ranked: rankDenseProxy(queryText, candidates) },
      { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, candidates) },
    ],
    { scoreScale: 8 },
  );
}

function rankSparseDenseGraphTemporal(query, candidates) {
  const queryText = queryTextValue(query);
  return fuseRankedChannels(
    candidates,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, candidates) },
      { name: "dense", weight: 0.85, ranked: rankDenseProxy(queryText, candidates) },
      { name: "graph", weight: 0.65, ranked: rankGraphProxy(query, candidates) },
      { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, candidates) },
    ],
    { scoreScale: 8 },
  );
}

function rankFullHybridRerank(query, candidates) {
  const firstStage = rankSparseDenseGraphTemporal(query, candidates);
  return rerankProxy(query, firstStage);
}

function rankMetadataAwareFullHybridRerank(query, candidates) {
  const firstStage = fuseRankedChannels(
    candidates,
    [
      { name: "hybrid", weight: 1, ranked: rankSparseDenseGraphTemporal(query, candidates) },
      { name: "metadata", weight: metadataWeight(query), ranked: rankMetadataAlignment(query, candidates) },
    ],
    { scoreScale: 10 },
  );
  return metadataAwareRerankProxy(query, firstStage);
}

async function rankQueryExpandedFullHybridRerank(query, candidates, options = {}) {
  const expansion = await queryExpansionText(query, options);
  const expanded = { ...query, q: expansion.expandedQuery };
  const firstStage = rankSparseDenseGraphTemporal(expanded, candidates);
  return rerankProxy(expanded, firstStage);
}

async function queryExpansionText(query, options = {}) {
  const queryText = queryTextValue(query);
  const plan = queryExpansionPlan(options);
  if (!plan) {
    options.providerStats?.recordQueryExpansionFallback("deterministic-proxy-not-configured");
    return {
      mode: "deterministic-proxy",
      expandedQuery: expandQuery(queryText),
      rewrites: [],
    };
  }

  const started = performance.now();
  const request = buildQueryExpansionRequest({
    query: queryText,
    maxRewrites: queryExpansionMaxRewrites(),
    instruction: queryExpansionInstruction(),
  });
  let rewrites = [];
  if (plan.provider === "local-openai-compatible") {
    rewrites = await openAiCompatibleQueryExpansion(plan, request);
  } else if (plan.provider === "nvidia-openai-compatible") {
    rewrites = await openAiCompatibleQueryExpansion(plan, request);
  } else if (plan.provider === "openrouter-openai-compatible") {
    rewrites = await openAiCompatibleQueryExpansion(plan, request);
  } else if (plan.provider === "gemini") {
    rewrites = await geminiQueryExpansion(plan, request);
  } else {
    throw new Error(`unsupported query expansion provider: ${plan.provider}`);
  }

  const sanitized = sanitizeQueryExpansionRewrites(rewrites, { originalQuery: queryText, maxRewrites: request.maxRewrites });
  assert.ok(sanitized.length > 0, "query expansion provider returned no usable rewrites");
  options.providerStats?.recordQueryExpansionCall({
    mode: plan.mode,
    provider: plan.provider,
    model: plan.model,
    rewritesReturned: sanitized.length,
    elapsedMs: Math.max(1, Math.round(performance.now() - started)),
  });
  return {
    mode: plan.mode,
    expandedQuery: clipQueryExpansion([queryText, ...sanitized].join(" ")),
    rewrites: sanitized,
  };
}

async function rankCloudVoyageRerankOnly(query, candidates, options = {}) {
  const queryText = queryTextValue(query);
  const config = voyageStrategyConfig(options.strategy);
  assert.ok(config?.mode === "rerank-only", `invalid Voyage rerank-only strategy: ${options.strategy}`);
  const firstStage = rankBm25Lite(queryText, candidates).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_RERANK_CANDIDATE_LIMIT", config.rerankCandidateLimit));
  if (options.fixtureRequested) {
    options.providerStats?.recordMockCall("voyage-rerank");
    return providerMockRerank(query, firstStage);
  }
  assertProviderBenchmarkAllowed(options.strategy);
  const ranked = await voyageRerank(queryText, firstStage, { providerStats: options.providerStats, model: config.rerankModel });
  return [...ranked, ...candidatesNotIn(firstStage, candidates)].sort(byScoreThenId);
}

async function rankCloudVoyage4Voyage(query, candidates, options = {}) {
  const queryText = queryTextValue(query);
  const config = voyageStrategyConfig(options.strategy);
  assert.ok(config?.mode === "embed-rerank", `invalid Voyage embed/rerank strategy: ${options.strategy}`);
  const densePool = rankBm25Lite(queryText, candidates).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_DENSE_CANDIDATE_LIMIT", config.denseCandidateLimit));
  if (options.fixtureRequested) {
    options.providerStats?.recordMockCall("voyage-embedding");
    options.providerStats?.recordMockCall("voyage-rerank");
    const dense = rankDenseProxy(queryText, densePool);
    const fused = fuseRankedChannels(
      densePool,
      [
        { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
        { name: "voyage-dense-mock", weight: 1, ranked: dense },
        { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
        { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
      ],
      { scoreScale: 8 },
    );
    return [...providerMockRerank(query, fused), ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
  }
  assertProviderBenchmarkAllowed(options.strategy);
  const queryVector = (await voyageEmbed([queryText], "query", { providerStats: options.providerStats, model: config.embedModel }))[0];
  const documentVectors = await voyageEmbed(densePool.map((candidate) => candidate.text), "document", { providerStats: options.providerStats, model: config.embedModel });
  const denseRanked = densePool
    .map((candidate, index) => ({ ...candidate, score: round(cosine(queryVector, documentVectors[index] ?? [])) }))
    .sort(byScoreThenId);
  const fused = fuseRankedChannels(
    densePool,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
      { name: "voyage-dense", weight: 1, ranked: denseRanked },
      { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
      { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
    ],
    { scoreScale: 8 },
  ).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_RERANK_CANDIDATE_LIMIT", config.rerankCandidateLimit));
  const reranked = await voyageRerank(queryText, fused, { providerStats: options.providerStats, model: config.rerankModel });
  return [...reranked, ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
}

async function rankCloudGeminiEmbedRerankProxy(query, candidates, options = {}) {
  const queryText = queryTextValue(query);
  const densePool = rankBm25Lite(queryText, candidates).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_DENSE_CANDIDATE_LIMIT", 120));
  if (options.fixtureRequested) {
    options.providerStats?.recordMockCall("gemini-embedding");
    const dense = rankDenseProxy(queryText, densePool);
    const fused = fuseRankedChannels(
      densePool,
      [
        { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
        { name: "gemini-dense-mock", weight: 1, ranked: dense },
        { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
        { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
      ],
      { scoreScale: 8 },
    );
    return [...rerankProxy(query, fused), ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
  }
  assertProviderBenchmarkAllowed("cloud-gemini-embed-rerank-proxy");
  const queryVector = (await geminiEmbed([queryText], "query", { providerStats: options.providerStats }))[0];
  const documentVectors = await geminiEmbed(densePool.map((candidate) => candidate.text), "document", { providerStats: options.providerStats });
  const denseRanked = densePool
    .map((candidate, index) => ({ ...candidate, score: round(cosine(queryVector, documentVectors[index] ?? [])) }))
    .sort(byScoreThenId);
  const fused = fuseRankedChannels(
    densePool,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
      { name: "gemini-dense", weight: 1, ranked: denseRanked },
      { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
      { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
    ],
    { scoreScale: 8 },
  );
  return [...rerankProxy(query, fused), ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
}

async function rankCloudGeminiVoyageRerank(query, candidates, options = {}) {
  const queryText = queryTextValue(query);
  const densePool = rankBm25Lite(queryText, candidates).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_DENSE_CANDIDATE_LIMIT", 120));
  if (options.fixtureRequested) {
    options.providerStats?.recordMockCall("gemini-embedding");
    options.providerStats?.recordMockCall("voyage-rerank");
    const dense = rankDenseProxy(queryText, densePool);
    const fused = fuseRankedChannels(
      densePool,
      [
        { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
        { name: "gemini-dense-mock", weight: 1, ranked: dense },
        { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
        { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
      ],
      { scoreScale: 8 },
    ).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_RERANK_CANDIDATE_LIMIT", 60));
    return [...providerMockRerank(query, fused), ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
  }
  assertProviderBenchmarkAllowed("cloud-gemini-voyage-rerank");
  const queryVector = (await geminiEmbed([queryText], "query", { providerStats: options.providerStats }))[0];
  const documentVectors = await geminiEmbed(densePool.map((candidate) => candidate.text), "document", { providerStats: options.providerStats });
  const denseRanked = densePool
    .map((candidate, index) => ({ ...candidate, score: round(cosine(queryVector, documentVectors[index] ?? [])) }))
    .sort(byScoreThenId);
  const fused = fuseRankedChannels(
    densePool,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
      { name: "gemini-dense", weight: 1, ranked: denseRanked },
      { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
      { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
    ],
    { scoreScale: 8 },
  ).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_RERANK_CANDIDATE_LIMIT", 60));
  const reranked = await voyageRerank(queryText, fused, { providerStats: options.providerStats });
  return [...reranked, ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
}

async function rankCloudNvidiaHybrid(query, candidates, options = {}) {
  const queryText = queryTextValue(query);
  const config = nvidiaStrategyConfig(options.strategy);
  assert.ok(config, `unknown NVIDIA strategy: ${options.strategy}`);
  const densePool = rankBm25Lite(queryText, candidates).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_DENSE_CANDIDATE_LIMIT", 120));
  if (options.fixtureRequested) {
    options.providerStats?.recordMockCall("nvidia-embedding");
    options.providerStats?.recordMockCall("nvidia-rerank");
    const dense = rankDenseProxy(queryText, densePool);
    const fused = fuseRankedChannels(
      densePool,
      [
        { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
        { name: "nvidia-dense-mock", weight: 1, ranked: dense },
        { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
        { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
      ],
      { scoreScale: 8 },
    ).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_RERANK_CANDIDATE_LIMIT", 60));
    return [...providerMockRerank(query, fused), ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
  }
  assertProviderBenchmarkAllowed(options.strategy);
  const queryVector = (await nvidiaEmbed([queryText], "query", config, { providerStats: options.providerStats }))[0];
  const documentVectors = await nvidiaEmbed(densePool.map((candidate) => candidate.text), "passage", config, { providerStats: options.providerStats });
  const denseRanked = densePool
    .map((candidate, index) => ({ ...candidate, score: round(cosine(queryVector, documentVectors[index] ?? [])) }))
    .sort(byScoreThenId);
  const fused = fuseRankedChannels(
    densePool,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
      { name: "nvidia-dense", weight: 1, ranked: denseRanked },
      { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
      { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
    ],
    { scoreScale: 8 },
  ).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_RERANK_CANDIDATE_LIMIT", 60));
  const reranked = await nvidiaRerank(queryText, fused, config, { providerStats: options.providerStats });
  return [...reranked, ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
}

async function rankLocalAppleQwen(query, candidates, options = {}) {
  const queryText = queryTextValue(query);
  const config = localAppleStrategyConfig(options.strategy);
  const densePool = rankBm25Lite(queryText, candidates).slice(0, providerCandidateLimit("RECALLWEAVE_PROVIDER_DENSE_CANDIDATE_LIMIT", 120));
  if (options.fixtureRequested) {
    options.providerStats?.recordMockCall("local-apple-embedding");
    if (config?.rerankMode === "sidecar") options.providerStats?.recordMockCall("local-rerank");
    const dense = rankDenseProxy(queryText, densePool);
    const fused = fuseRankedChannels(
      densePool,
      [
        { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
        { name: "local-apple-dense-mock", weight: 1, ranked: dense },
        { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
        { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
      ],
      { scoreScale: 8 },
    );
    const reranked = config?.rerankMode === "sidecar" ? providerMockRerank(query, fused) : rerankProxy(query, fused);
    return [...reranked, ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
  }
  assertProviderBenchmarkAllowed(options.strategy);
  const queryVector = (await localAppleEmbed([queryText], { providerStats: options.providerStats }))[0];
  const documentVectors = await localAppleEmbedCandidates(densePool, { providerStats: options.providerStats });
  const denseRanked = densePool
    .map((candidate, index) => ({ ...candidate, score: round(cosine(queryVector, documentVectors[index] ?? [])) }))
    .sort(byScoreThenId);
  const fused = fuseRankedChannels(
    densePool,
    [
      { name: "sparse", weight: 1, ranked: rankBm25Lite(queryText, densePool) },
      { name: "local-apple-dense", weight: 1, ranked: denseRanked },
      { name: "graph", weight: 0.45, ranked: rankGraphProxy(query, densePool) },
      { name: "temporal", weight: temporalWeight(query), ranked: rankTemporal(query, densePool) },
    ],
    { scoreScale: 8 },
  );
  if (config?.rerankMode === "sidecar") {
    const rerankLimit = providerCandidateLimit("SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT", config.rerankCandidateLimit ?? 30);
    const reranked = await localAppleRerank(queryText, fused.slice(0, rerankLimit), { providerStats: options.providerStats, model: config.rerankModel });
    return [...reranked, ...candidatesNotIn(fused.slice(0, rerankLimit), candidates)].sort(byScoreThenId);
  }
  return [...rerankProxy(query, fused), ...candidatesNotIn(densePool, candidates)].sort(byScoreThenId);
}

async function localAppleEmbedCandidates(candidates, options = {}) {
  ensureLocalApplePersistentCacheLoaded(options);
  const vectors = new Array(candidates.length);
  const missing = [];
  const missingIndexes = [];
  candidates.forEach((candidate, index) => {
    const descriptor = localAppleEmbeddingCacheDescriptor(candidate);
    const key = descriptor.cacheKey;
    const cached = localAppleDocumentEmbeddingCache.get(key);
    if (cached) {
      options.providerStats?.recordLocalEmbeddingCacheHit();
      vectors[index] = cached;
      return;
    }
    options.providerStats?.recordLocalEmbeddingCacheMiss();
    missing.push(descriptor.embeddingView);
    missingIndexes.push({ descriptor, index, key });
  });
  if (missing.length) {
    const embedded = await localAppleEmbed(missing, options);
    assert.equal(embedded.length, missing.length, "local Apple candidate embedding cache fill mismatch");
    embedded.forEach((vector, offset) => {
      const { descriptor, index, key } = missingIndexes[offset];
      localAppleDocumentEmbeddingCache.set(key, vector);
      persistLocalAppleEmbeddingCacheEntry(descriptor, vector, options);
      vectors[index] = vector;
    });
  }
  return vectors;
}

function fuseRankedChannels(candidates, channels, options = {}) {
  const scores = new Map(candidates.map((candidate) => [candidate.outputId, 0]));
  for (const channel of channels) {
    channel.ranked.forEach((candidate, index) => {
      const rank = index + 1;
      const previous = scores.get(candidate.outputId) ?? 0;
      scores.set(candidate.outputId, previous + Number(channel.weight ?? 1) / (60 + rank));
    });
  }
  const scale = Number(options.scoreScale ?? 1);
  return candidates
    .map((candidate) => ({ ...candidate, score: round((scores.get(candidate.outputId) ?? 0) * scale + candidate.baseScore * 0.01) }))
    .sort(byScoreThenId);
}

function rankTemporal(query, candidates) {
  const queryText = normalizeText(queryTextValue(query));
  const wantsTemporal = /\b(new|newer|latest|recent|recently|last|current|now|after|before|when|date|time|changed|updated|previous|earlier|first)\b/.test(queryText);
  const dates = candidates.map((candidate) => candidate.dateMs).filter((value) => Number.isFinite(value));
  const min = dates.length ? Math.min(...dates) : Date.now();
  const max = dates.length ? Math.max(...dates) : Date.now();
  const span = Math.max(1, max - min);
  return candidates
    .map((candidate) => {
      const recency = Number.isFinite(candidate.dateMs) ? (candidate.dateMs - min) / span : 0;
      const queryType = String(query?.metadata?.questionType ?? "").toLowerCase();
      const candidateType = String(candidate.metadata?.questionType ?? "").toLowerCase();
      const typeMatch = queryType && candidateType && queryType === candidateType ? 0.18 : 0;
      const temporalCue = wantsTemporal ? 0.2 : 0;
      return { ...candidate, score: round(recency * 0.62 + typeMatch + temporalCue + candidate.baseScore * 0.01) };
    })
    .sort(byScoreThenId);
}

function rankGraphProxy(query, candidates) {
  const queryTopics = topicTerms(`${queryTextValue(query)} ${query?.metadata?.questionType ?? ""}`);
  return candidates
    .map((candidate) => {
      const overlap = overlapRatio(queryTopics, candidate.topicTermSet ?? topicTerms(candidate.text));
      const roleCoverage = candidate.roleCoverage ?? roleCoverageScore(candidate.text);
      return { ...candidate, score: round(overlap * 0.78 + roleCoverage * 0.18 + candidate.baseScore * 0.01) };
    })
    .sort(byScoreThenId);
}

function rankMetadataAlignment(query, candidates) {
  const queryMetadata = query?.metadata && typeof query.metadata === "object" ? query.metadata : {};
  const queryType = normalizeText(queryMetadata.questionType ?? "");
  const queryMetadataTokens = metadataTokens(queryMetadata);
  return candidates
    .map((candidate) => {
      const candidateMetadata = candidate.metadata && typeof candidate.metadata === "object" ? candidate.metadata : {};
      const candidateType = normalizeText(candidateMetadata.questionType ?? "");
      const exactType = queryType && candidateType && queryType === candidateType ? 0.54 : 0;
      const broadType = queryType && candidateType && broadQuestionType(queryType) === broadQuestionType(candidateType) ? 0.16 : 0;
      const metadataOverlap = overlapRatio(queryMetadataTokens, metadataTokens(candidateMetadata)) * 0.22;
      const temporalFit = temporalCompatibility(query, candidate) * 0.08;
      return { ...candidate, score: round(exactType + broadType + metadataOverlap + temporalFit + candidate.baseScore * 0.01) };
    })
    .sort(byScoreThenId);
}

function rerankProxy(query, candidates) {
  const queryText = queryTextValue(query);
  const queryTokens = new Set(tokenize(queryText));
  const queryBigrams = new Set(ngrams([...queryTokens], 2));
  return candidates
    .map((candidate, index) => {
      const candidateTokens = candidate.tokenSet ?? new Set(tokenize(candidate.text));
      const lexical = overlapRatio(queryTokens, candidateTokens);
      const bigrams = overlapRatio(queryBigrams, candidate.bigramSet ?? new Set(ngrams([...candidateTokens], 2)));
      const exact = candidate.text.toLowerCase().includes(queryText.toLowerCase()) ? 0.18 : 0;
      const roleCoverage = roleCoverageScore(candidate.text) * 0.08;
      const prior = reciprocalRankBoost(index + 1) * 3;
      return { ...candidate, score: round(candidate.score * 0.58 + lexical * 0.18 + bigrams * 0.08 + exact + roleCoverage + prior) };
    })
    .sort(byScoreThenId);
}

function metadataAwareRerankProxy(query, candidates) {
  const metadataRank = new Map(rankMetadataAlignment(query, candidates).map((candidate, index) => [candidate.outputId, index + 1]));
  return rerankProxy(query, candidates)
    .map((candidate) => {
      const rank = metadataRank.get(candidate.outputId);
      return { ...candidate, score: round(candidate.score + reciprocalRankBoost(rank) * 4) };
    })
    .sort(byScoreThenId);
}

function rankBm25Lite(query, candidates) {
  const queryTokens = tokenize(query);
  const uniqueQueryTokens = [...new Set(queryTokens)];
  const docs = candidates.map((candidate) => {
    const tokens = candidate.tokens ?? tokenize(candidate.text);
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

function hashedSemanticVector(text, dimensions = 192) {
  const vector = Array(dimensions).fill(0);
  const normalized = normalizeText(text);
  const features = [
    ...tokenize(normalized),
    ...ngrams(tokenize(normalized), 2),
    ...charNgrams(normalized, 3),
  ];
  for (const feature of features) {
    const hash = stableHash(feature);
    const bucket = Number.parseInt(hash.slice(0, 8), 16) % dimensions;
    const sign = Number.parseInt(hash.slice(8, 10), 16) % 2 === 0 ? 1 : -1;
    vector[bucket] += sign;
  }
  return vector;
}

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return 0;
  return Math.max(0, dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)));
}

function createProviderStats(options = {}) {
  const providerStrategy = isProviderStrategy(options.strategy);
  const providerNames = providerStrategy ? requiredProvidersForStrategy(options.strategy) : [];
  const stats = {
    strategy: options.strategy,
    providerStrategy,
    providerCallsAllowed: providerBenchmarkCallsAllowed,
    providerPublicDataConfirmed: providerBenchmarkPublicData,
    providerCallsMade: 0,
    providerMockCalls: 0,
    embeddingCalls: 0,
    rerankCalls: 0,
    documentCountSent: 0,
    queryCountSent: 0,
    queryExpansionCalls: 0,
    queryExpansionFallbacks: 0,
    queryExpansionRewritesReturned: 0,
    queryExpansionProvider: null,
    queryExpansionMode: null,
    queryExpansionModel: null,
    queryExpansionElapsedMsTotal: 0,
    queryExpansionOnlyCurrentQuerySent: true,
    queryExpansionStoredMemoriesSent: false,
    localEmbeddingCacheEnabled: false,
    localEmbeddingCacheEntriesLoaded: 0,
    localEmbeddingCacheHits: 0,
    localEmbeddingCacheMisses: 0,
    localEmbeddingCacheWrites: 0,
    localEmbeddingCacheReadErrors: 0,
    localEmbeddingCacheWriteErrors: 0,
    modelArm: providerStrategy ? options.strategy : null,
    providers: providerNames,
    embedModel: providerStrategy ? embedModelForStrategy(options.strategy) : null,
    embedDimensions: providerStrategy ? embedDimensionsForStrategy(options.strategy) : null,
    rerankModel: providerStrategy ? rerankModelForStrategy(options.strategy) : null,
    fixtureProviderMock: providerStrategy && options.fixtureRequested,
  };
  return {
    recordMockCall(kind) {
      stats.providerMockCalls += 1;
      if (kind.includes("embedding")) stats.embeddingCalls += 1;
      if (kind.includes("rerank")) stats.rerankCalls += 1;
    },
    recordProviderCall(kind, count) {
      stats.providerCallsMade += 1;
      if (kind === "embedding") stats.embeddingCalls += 1;
      if (kind === "rerank") stats.rerankCalls += 1;
      if (kind === "embedding") stats.documentCountSent += Math.max(0, Number(count ?? 0));
      if (kind === "rerank") stats.documentCountSent += Math.max(0, Number(count ?? 0));
      if (kind === "query-embedding") {
        stats.embeddingCalls += 1;
        stats.queryCountSent += 1;
      }
    },
    recordQueryExpansionCall({ mode, provider, model, rewritesReturned = 0, elapsedMs = 0 } = {}) {
      stats.providerCallsMade += 1;
      stats.queryExpansionCalls += 1;
      stats.queryCountSent += 1;
      stats.queryExpansionProvider = String(provider ?? "unknown");
      stats.queryExpansionMode = String(mode ?? "unknown");
      stats.queryExpansionModel = String(model ?? "unknown");
      stats.queryExpansionRewritesReturned += Math.max(0, Number(rewritesReturned ?? 0));
      stats.queryExpansionElapsedMsTotal += Math.max(0, Number(elapsedMs ?? 0));
    },
    recordQueryExpansionFallback(reason) {
      stats.queryExpansionFallbacks += 1;
      stats.queryExpansionMode = "deterministic-proxy";
      stats.queryExpansionProvider = "local-deterministic";
      stats.queryExpansionModel = String(reason ?? "not-configured");
    },
    recordLocalEmbeddingCacheLoad({ enabled, entriesLoaded = 0, readErrors = 0 } = {}) {
      stats.localEmbeddingCacheEnabled = Boolean(enabled);
      stats.localEmbeddingCacheEntriesLoaded += Math.max(0, Number(entriesLoaded ?? 0));
      stats.localEmbeddingCacheReadErrors += Math.max(0, Number(readErrors ?? 0));
    },
    recordLocalEmbeddingCacheHit(count = 1) {
      stats.localEmbeddingCacheHits += Math.max(0, Number(count ?? 0));
    },
    recordLocalEmbeddingCacheMiss(count = 1) {
      stats.localEmbeddingCacheMisses += Math.max(0, Number(count ?? 0));
    },
    recordLocalEmbeddingCacheWrite(count = 1) {
      stats.localEmbeddingCacheWrites += Math.max(0, Number(count ?? 0));
    },
    recordLocalEmbeddingCacheWriteError(count = 1) {
      stats.localEmbeddingCacheWriteErrors += Math.max(0, Number(count ?? 0));
    },
    summary() {
      const providerKeyCounts = Object.fromEntries(providerNames.map((provider) => [provider, providerKeyCount(provider)]));
      return {
        ...stats,
        queryExpansionElapsedMsAverage:
          stats.queryExpansionCalls > 0 ? Math.max(1, Math.round(stats.queryExpansionElapsedMsTotal / stats.queryExpansionCalls)) : 0,
        providerKeyCounts,
        keyCountAvailable: providerNames.length ? Math.min(...providerNames.map((provider) => providerKeyCount(provider))) : 0,
      };
    },
  };
}

function isProviderStrategy(strategy) {
  return [
    "cloud-voyage-rerank-only",
    "cloud-voyage4-voyage",
    "cloud-voyage4-voyage-lite-rerank",
    "cloud-voyage4-lite-voyage-lite",
    "cloud-gemini-embed-rerank-proxy",
    "cloud-gemini-voyage-rerank",
    "cloud-nvidia-retriever-500m",
    "cloud-nvidia-nemotron-1b",
    "cloud-nvidia-nemotron-vl-1b",
    "cloud-nvidia-e5-mistral",
    "cloud-nvidia-code",
    "local-apple-qwen3-0_6b",
    "local-apple-qwen3-0_6b-local-rerank",
    "local-apple-qwen3-4b",
  ].includes(strategy);
}

function assertProviderBenchmarkAllowed(strategy) {
  assert.equal(providerBenchmarkCallsAllowed, true, `${strategy} requires RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1`);
  assert.equal(providerBenchmarkPublicData, true, `${strategy} requires RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1`);
  for (const provider of requiredProvidersForStrategy(strategy)) {
    assert.ok(providerKeyCount(provider) > 0, `${strategy} requires ${providerEnvHint(provider)}`);
  }
}

function requiredProvidersForStrategy(strategy) {
  if (strategy === "cloud-gemini-embed-rerank-proxy") return ["gemini"];
  if (strategy === "cloud-gemini-voyage-rerank") return ["gemini", "voyage"];
  if (voyageStrategyConfig(strategy)) return ["voyage"];
  if (nvidiaStrategyConfig(strategy)) return ["nvidia"];
  if (localAppleStrategyConfig(strategy)?.rerankMode === "sidecar") return ["local-apple", "local-rerank"];
  if (localAppleStrategyConfig(strategy)) return ["local-apple"];
  return [];
}

function embedModelForStrategy(strategy) {
  if (strategy === "cloud-gemini-embed-rerank-proxy" || strategy === "cloud-gemini-voyage-rerank") return geminiEmbedModel();
  if (voyageStrategyConfig(strategy)?.embedModel) return voyageStrategyConfig(strategy).embedModel;
  if (nvidiaStrategyConfig(strategy)) return nvidiaStrategyConfig(strategy).embedModel;
  if (localAppleStrategyConfig(strategy)) return localAppleEmbedModel(strategy);
  return null;
}

function embedDimensionsForStrategy(strategy) {
  if (strategy === "cloud-gemini-embed-rerank-proxy" || strategy === "cloud-gemini-voyage-rerank") return geminiOutputDimensionality();
  if (voyageStrategyConfig(strategy)?.embedModel) return optionalPositiveInt(process.env.VOYAGE_EMBED_DIMENSIONS ?? process.env.VOYAGE_OUTPUT_DIMENSION ?? null, "Voyage output dimension");
  if (nvidiaStrategyConfig(strategy)) return optionalPositiveInt(process.env.NVIDIA_EMBED_DIMENSIONS ?? null, "NVIDIA output dimension");
  if (localAppleStrategyConfig(strategy)) return localAppleEmbedDimensions(strategy);
  return null;
}

function rerankModelForStrategy(strategy) {
  if (strategy === "cloud-gemini-voyage-rerank") return voyageRerankModel();
  if (voyageStrategyConfig(strategy)?.rerankModel) return voyageStrategyConfig(strategy).rerankModel;
  if (strategy === "cloud-gemini-embed-rerank-proxy") return "local-deterministic-rerank-proxy";
  if (nvidiaStrategyConfig(strategy)) return nvidiaStrategyConfig(strategy).rerankModel;
  if (localAppleStrategyConfig(strategy)?.rerankMode === "sidecar") return localAppleRerankModel(strategy);
  if (localAppleStrategyConfig(strategy)) return "local-deterministic-rerank-proxy";
  return null;
}

function providerEnvHint(provider) {
  if (provider === "gemini") return "GEMINI_API_KEY, GEMINI_API_KEYS, GOOGLE_API_KEY, GOOGLE_API_KEYS, AI_STUDIO_API_KEY, AI_STUDIO_API_KEYS, or matching *_FILE vars";
  if (provider === "voyage") return "VOYAGE_API_KEY, VOYAGE_API_KEYS, VOYAGE_API_KEY_FILE, or VOYAGE_API_KEYS_FILE";
  if (provider === "nvidia") return "NVIDIA_API_KEY, NVIDIA_API_KEYS, NVAPI_KEY, NVAPI_KEYS, or matching *_FILE vars";
  if (provider === "local-apple") return "SELFMEM_LOCAL_EMBED_BASE_URL";
  if (provider === "local-rerank") return "SELFMEM_LOCAL_RERANK_ENDPOINT or SELFMEM_LOCAL_RERANK_BASE_URL";
  return `${provider.toUpperCase()} provider credentials`;
}

function providerKeyCount(provider) {
  return providerKeys(provider).length;
}

function providerKeys(provider) {
  if (provider === "voyage") {
    return [
      ...splitProviderKeys(process.env.VOYAGE_API_KEYS),
      ...splitProviderKeys(process.env.VOYAGE_API_KEY),
      ...providerKeysFromFiles("VOYAGE_API_KEYS_FILE", "VOYAGE_API_KEY_FILE"),
    ];
  }
  if (provider === "gemini") {
    return [
      ...splitProviderKeys(process.env.GEMINI_API_KEYS),
      ...splitProviderKeys(process.env.GEMINI_API_KEY),
      ...splitProviderKeys(process.env.GOOGLE_API_KEYS),
      ...splitProviderKeys(process.env.GOOGLE_API_KEY),
      ...splitProviderKeys(process.env.AI_STUDIO_API_KEYS),
      ...splitProviderKeys(process.env.AI_STUDIO_API_KEY),
      ...providerKeysFromFiles(
        "GEMINI_API_KEYS_FILE",
        "GEMINI_API_KEY_FILE",
        "GOOGLE_API_KEYS_FILE",
        "GOOGLE_API_KEY_FILE",
        "AI_STUDIO_API_KEYS_FILE",
        "AI_STUDIO_API_KEY_FILE",
      ),
    ];
  }
  if (provider === "nvidia") {
    return [
      ...splitProviderKeys(process.env.NVIDIA_API_KEYS),
      ...splitProviderKeys(process.env.NVIDIA_API_KEY),
      ...splitProviderKeys(process.env.NVAPI_KEYS),
      ...splitProviderKeys(process.env.NVAPI_KEY),
      ...providerKeysFromFiles("NVIDIA_API_KEYS_FILE", "NVIDIA_API_KEY_FILE", "NVAPI_KEYS_FILE", "NVAPI_KEY_FILE"),
    ];
  }
  if (provider === "local-apple") {
    return splitProviderKeys(process.env.SELFMEM_LOCAL_EMBED_BASE_URL);
  }
  if (provider === "local-rerank") {
    return splitProviderKeys(process.env.SELFMEM_LOCAL_RERANK_ENDPOINT ?? process.env.SELFMEM_LOCAL_RERANK_BASE_URL);
  }
  if (provider === "openrouter") {
    return [
      ...splitProviderKeys(process.env.OPENROUTER_API_KEYS),
      ...splitProviderKeys(process.env.OPENROUTER_API_KEY),
      ...providerKeysFromFiles("OPENROUTER_API_KEYS_FILE", "OPENROUTER_API_KEY_FILE"),
    ];
  }
  return [];
}

function splitProviderKeys(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function providerKeysFromFiles(...envNames) {
  return envNames.flatMap((name) => {
    const path = process.env[name];
    if (!path) return [];
    const resolved = resolve(String(path));
    assert.ok(existsSync(resolved), `${name} points to a missing provider key file`);
    assert.ok(statSync(resolved).isFile(), `${name} must point to a provider key file`);
    assertOutsideRepo(resolved, `${name} provider key file`);
    return splitProviderKeys(readFileSync(resolved, "utf8"));
  });
}

function chooseProviderKey(provider, seed) {
  const keys = providerKeys(provider);
  assert.ok(keys.length > 0, `${provider} provider key missing`);
  const index = Number.parseInt(stableHash(seed).slice(0, 8), 16) % keys.length;
  return keys[index];
}

async function voyageEmbed(texts, inputType, options = {}) {
  const input = texts.map((text) => String(text ?? ""));
  const isQuery = inputType === "query";
  const batches = batchProviderInputs(input, {
    maxCount: optionalPositiveInt(process.env.VOYAGE_EMBED_BATCH_SIZE ?? null, "Voyage embed batch size") ?? 32,
    maxEstimatedTokens: optionalPositiveInt(process.env.VOYAGE_EMBED_BATCH_TOKENS ?? null, "Voyage embed batch tokens") ?? 60_000,
  });
  const embeddings = [];
  for (const [batchIndex, batch] of batches.entries()) {
    options.providerStats?.recordProviderCall(isQuery ? "query-embedding" : "embedding", isQuery ? 0 : batch.length);
    const body = {
      input: batch,
      model: options.model ?? voyageEmbedModel(),
      input_type: inputType,
      truncation: true,
    };
    const outputDimension = optionalPositiveInt(process.env.VOYAGE_EMBED_DIMENSIONS ?? process.env.VOYAGE_OUTPUT_DIMENSION ?? null, "Voyage output dimension");
    if (outputDimension) body.output_dimension = outputDimension;
    const response = await voyagePost("/v1/embeddings", body, { seed: `${inputType}:${batchIndex}:${batch.length}:${batch[0] ?? ""}` });
    embeddings.push(...embeddingsFromVoyageResponse(response));
  }
  assert.equal(embeddings.length, input.length, "Voyage embeddings response length mismatch");
  return embeddings;
}

async function voyageRerank(query, candidates, options = {}) {
  const documents = candidates.map((candidate) => candidate.text);
  options.providerStats?.recordProviderCall("rerank", documents.length);
  const response = await voyagePost(
    "/v1/rerank",
    {
      query,
      documents,
      model: options.model ?? voyageRerankModel(),
      top_k: documents.length,
      return_documents: false,
      truncation: true,
    },
    { seed: `rerank:${query}:${documents.length}` },
  );
  const scores = rerankScoresFromVoyageResponse(response);
  assert.ok(scores.length > 0, "Voyage rerank returned no results");
  return scores
    .map((item, rank) => {
      const candidate = candidates[item.index];
      assert.ok(candidate, "Voyage rerank returned an invalid document index");
      return { ...candidate, score: round(Number(item.score ?? 0) + reciprocalRankBoost(rank + 1)) };
    })
    .sort(byScoreThenId);
}

async function geminiEmbed(texts, inputType, options = {}) {
  const input = texts.map((text) => String(text ?? ""));
  const isQuery = inputType === "query";
  options.providerStats?.recordProviderCall(isQuery ? "query-embedding" : "embedding", isQuery ? 0 : input.length);
  const model = geminiEmbedModel();
  const modelResource = geminiModelResource(model);
  const outputDimensionality = geminiOutputDimensionality();
  const taskType = isQuery ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";
  const body = {
    requests: input.map((text) => ({
      model: modelResource,
      content: { parts: [{ text }] },
      taskType,
      ...(outputDimensionality ? { outputDimensionality } : {}),
    })),
  };
  const response = await geminiPost(`${modelResource}:batchEmbedContents`, body, { seed: `${inputType}:${input.length}:${input[0] ?? ""}` });
  const embeddings = embeddingsFromGeminiResponse(response);
  assert.equal(embeddings.length, input.length, "Gemini embeddings response length mismatch");
  return embeddings;
}

async function nvidiaEmbed(texts, inputType, config, options = {}) {
  const input = texts.map((text) => String(text ?? ""));
  const isQuery = inputType === "query";
  options.providerStats?.recordProviderCall(isQuery ? "query-embedding" : "embedding", isQuery ? 0 : input.length);
  const body = {
    input,
    model: nvidiaEmbedModel(config),
    input_type: isQuery ? "query" : "passage",
    encoding_format: "float",
    truncate: process.env.NVIDIA_EMBED_TRUNCATE ?? "END",
  };
  const response = await nvidiaPost(nvidiaEmbeddingEndpoint(), body, { seed: `${inputType}:${input.length}:${input[0] ?? ""}` });
  const embeddings = embeddingsFromOpenAiCompatibleResponse(response);
  assert.equal(embeddings.length, input.length, "NVIDIA embeddings response length mismatch");
  return embeddings;
}

async function nvidiaRerank(query, candidates, config, options = {}) {
  const documents = candidates.map((candidate) => candidate.text);
  options.providerStats?.recordProviderCall("rerank", documents.length);
  const response = await nvidiaPost(
    nvidiaRerankEndpoint(config),
    {
      model: nvidiaRerankModel(config),
      query: { text: query },
      passages: documents.map((text) => ({ text })),
      truncate: process.env.NVIDIA_RERANK_TRUNCATE ?? "END",
    },
    { seed: `rerank:${query}:${documents.length}` },
  );
  const scores = rerankScoresFromNvidiaResponse(response);
  assert.ok(scores.length > 0, "NVIDIA rerank returned no results");
  return scores
    .map((item, rank) => {
      const candidate = candidates[item.index];
      assert.ok(candidate, "NVIDIA rerank returned an invalid document index");
      return { ...candidate, score: round(Number(item.score ?? 0) + reciprocalRankBoost(rank + 1)) };
    })
    .sort(byScoreThenId);
}

async function localAppleEmbed(texts, options = {}) {
  const input = texts.map((text) => prepareLocalAppleEmbeddingInput(text));
  const embeddings = [];
  const batches = batchProviderInputs(input, {
    maxCount: optionalPositiveInt(process.env.SELFMEM_LOCAL_EMBED_BATCH_MAX_COUNT ?? "8", "local Apple embedding batch max count"),
    maxEstimatedTokens: optionalPositiveInt(process.env.SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS ?? "12000", "local Apple embedding batch max tokens"),
  });
  for (const batch of batches) {
    options.providerStats?.recordProviderCall("embedding", batch.length);
    const response = await localApplePost("/embeddings", {
      input: batch,
      model: localAppleEmbedModel(),
      encoding_format: "float",
    });
    const batchEmbeddings = embeddingsFromOpenAiCompatibleResponse(response);
    assert.equal(batchEmbeddings.length, batch.length, "local Apple embeddings response length mismatch");
    embeddings.push(...batchEmbeddings);
  }
  return embeddings;
}

async function localAppleRerank(query, candidates, options = {}) {
  const documents = candidates.map((candidate) => candidate.text);
  options.providerStats?.recordProviderCall("rerank", documents.length);
  const response = await localAppleRerankPost({
    model: options.model ?? localAppleRerankModel(),
    query,
    documents,
    top_n: documents.length,
  });
  const scores = rerankScoresFromLocalResponse(response);
  assert.ok(scores.length > 0, "local Apple rerank returned no results");
  return scores
    .map((item, rank) => {
      const candidate = candidates[item.index];
      assert.ok(candidate, "local Apple rerank returned an invalid document index");
      return { ...candidate, score: round(Number(item.score ?? 0) + reciprocalRankBoost(rank + 1)) };
    })
    .sort(byScoreThenId);
}

async function geminiPost(path, body, options = {}) {
  const key = chooseProviderKey("gemini", options.seed ?? path);
  return providerPostJson({
    provider: "gemini",
    url: `https://generativelanguage.googleapis.com/v1beta/${path}`,
    body,
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key,
    },
  });
}

async function voyagePost(path, body, options = {}) {
  const key = chooseProviderKey("voyage", options.seed ?? path);
  return providerPostJson({
    provider: "voyage",
    url: `https://api.voyageai.com${path}`,
    body,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
  });
}

async function nvidiaPost(url, body, options = {}) {
  const key = chooseProviderKey("nvidia", options.seed ?? url);
  return providerPostJson({
    provider: "nvidia",
    url,
    body,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
  });
}

async function providerPostJson({ provider, url, body, headers }) {
  const timeoutMs = optionalPositiveInt(process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? null, "provider timeout") ?? 60_000;
  const attempts = optionalPositiveInt(process.env.RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS ?? null, "provider retry attempts") ?? 4;
  let lastStatus = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await waitProviderTurn(provider);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();
      lastStatus = response.status;
      if (response.ok) return JSON.parse(raw);
      if (!retryableProviderStatus(response.status) || attempt === attempts) {
        throw new Error(`${providerDisplayName(provider)} provider request failed with status ${response.status}`);
      }
      await sleep(providerRetryDelayMs(response, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${providerDisplayName(provider)} provider request failed with status ${lastStatus ?? "unknown"}`);
}

async function queryExpansionPost(plan, body) {
  const timeoutMs =
    optionalPositiveInt(process.env.RECALLWEAVE_QUERY_EXPANSION_TIMEOUT_MS ?? process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? null, "query expansion timeout") ??
    60_000;
  const attempts = optionalPositiveInt(process.env.RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS ?? null, "provider retry attempts") ?? 4;
  const headers = { "content-type": "application/json" };
  if (plan.apiKey) headers.authorization = `Bearer ${plan.apiKey}`;
  let lastStatus = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(plan.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
      const raw = await response.text();
      lastStatus = response.status;
      if (response.ok) return JSON.parse(raw);
      if (!retryableProviderStatus(response.status) || attempt === attempts) {
        throw new Error(`query expansion request failed with status ${response.status}`);
      }
      await sleep(providerRetryDelayMs(response, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`query expansion request failed with status ${lastStatus ?? "unknown"}`);
}

async function waitProviderTurn(provider) {
  const providerSpecific = process.env[`${String(provider).toUpperCase()}_PROVIDER_MIN_INTERVAL_MS`];
  const intervalMs = optionalPositiveInt(providerSpecific ?? process.env.RECALLWEAVE_PROVIDER_MIN_INTERVAL_MS ?? null, "provider min interval") ?? 0;
  if (!intervalMs) return;
  const now = Date.now();
  const previous = providerLastRequestAt.get(provider) ?? 0;
  const waitMs = Math.max(0, previous + intervalMs - now);
  if (waitMs > 0) await sleep(waitMs);
  providerLastRequestAt.set(provider, Date.now());
}

function retryableProviderStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function providerRetryDelayMs(response, attempt) {
  const retryAfter = Number(response.headers?.get?.("retry-after") ?? 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(120_000, Math.ceil(retryAfter * 1000));
  const baseMs = optionalPositiveInt(process.env.RECALLWEAVE_PROVIDER_RETRY_BASE_MS ?? null, "provider retry base ms") ?? 2_000;
  return Math.min(120_000, baseMs * 2 ** Math.max(0, attempt - 1));
}

function providerDisplayName(provider) {
  if (provider === "gemini") return "Gemini";
  if (provider === "voyage") return "Voyage";
  if (provider === "nvidia") return "NVIDIA";
  return String(provider ?? "provider");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function localApplePost(path, body) {
  const baseUrl = String(process.env.SELFMEM_LOCAL_EMBED_BASE_URL ?? "").replace(/\/+$/, "");
  assert.ok(baseUrl, "SELFMEM_LOCAL_EMBED_BASE_URL is required for local Apple embeddings");
  const url = baseUrl.endsWith("/v1") ? `${baseUrl}${path}` : `${baseUrl}/v1${path}`;
  const timeoutMs = optionalPositiveInt(process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? null, "provider timeout") ?? 60_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`local Apple embedding request failed with status ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function localAppleRerankPost(body) {
  const endpoint = localAppleRerankEndpoint();
  const timeoutMs = optionalPositiveInt(process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? null, "provider timeout") ?? 60_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { "content-type": "application/json" };
  const token = process.env.SELFMEM_LOCAL_RERANK_API_KEY;
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`local Apple rerank request failed with status ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function openAiCompatibleQueryExpansion(plan, request) {
  const response = await queryExpansionPost(plan, {
    model: plan.model,
    temperature: queryExpansionTemperature(),
    max_tokens: queryExpansionMaxOutputTokens(),
    chat_template_kwargs: { enable_thinking: false, preserve_thinking: false },
    messages: [
      { role: "system", content: request.instruction },
      {
        role: "user",
        content: [
          "Rewrite this recall query. Return only a JSON array of strings.",
          `Max rewrites: ${request.maxRewrites}`,
          `Query: ${request.query}`,
        ].join("\n"),
      },
    ],
  });
  return rewritesFromQueryExpansionText(chatCompletionText(response));
}

async function geminiQueryExpansion(plan, request) {
  const response = await geminiPost(`${geminiModelResource(plan.model)}:generateContent`, {
    generationConfig: {
      temperature: queryExpansionTemperature(),
      maxOutputTokens: queryExpansionMaxOutputTokens(),
      responseMimeType: "application/json",
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              request.instruction,
              "Return only a JSON array of strings.",
              `Max rewrites: ${request.maxRewrites}`,
              `Query: ${request.query}`,
            ].join("\n"),
          },
        ],
      },
    ],
  });
  return rewritesFromQueryExpansionText(geminiText(response));
}

function embeddingsFromVoyageResponse(response) {
  if (Array.isArray(response?.data)) {
    return [...response.data]
      .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
      .map((item) => item.embedding)
      .filter(Array.isArray);
  }
  if (Array.isArray(response?.embeddings)) return response.embeddings.filter(Array.isArray);
  return [];
}

function embeddingsFromGeminiResponse(response) {
  if (Array.isArray(response?.embeddings)) {
    return response.embeddings
      .map((item) => item?.values ?? item?.embedding?.values)
      .filter(Array.isArray);
  }
  if (Array.isArray(response?.data)) {
    return response.data
      .map((item) => item?.embedding?.values ?? item?.values)
      .filter(Array.isArray);
  }
  return [];
}

function embeddingsFromOpenAiCompatibleResponse(response) {
  if (Array.isArray(response?.data)) {
    return [...response.data]
      .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
      .map((item) => {
        if (Array.isArray(item?.embedding)) return item.embedding;
        if (Array.isArray(item?.embedding?.values)) return item.embedding.values;
        if (Array.isArray(item?.values)) return item.values;
        return null;
      })
      .filter(Array.isArray);
  }
  if (Array.isArray(response?.embeddings)) return response.embeddings.filter(Array.isArray);
  return [];
}

function rerankScoresFromVoyageResponse(response) {
  const items = Array.isArray(response?.data) ? response.data : Array.isArray(response?.results) ? response.results : [];
  return items
    .map((item) => ({
      index: Number(item.index),
      score: finiteNumberOrDefault(item.relevance_score ?? item.score, 0),
    }))
    .filter((item) => Number.isInteger(item.index) && item.index >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function rerankScoresFromNvidiaResponse(response) {
  const items = Array.isArray(response?.rankings)
    ? response.rankings
    : Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.results)
    ? response.results
    : [];
  return items
    .map((item) => ({
      index: Number(item.index),
      score: finiteNumberOrDefault(item.logit ?? item.relevance_score ?? item.score, 0),
    }))
    .filter((item) => Number.isInteger(item.index) && item.index >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function rerankScoresFromLocalResponse(response) {
  if (Array.isArray(response)) {
    return response
      .map((score, index) => ({ index, score: finiteNumberOrDefault(score, 0) }))
      .sort((left, right) => right.score - left.score || left.index - right.index);
  }
  const items = Array.isArray(response?.rankings)
    ? response.rankings
    : Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.results)
    ? response.results
    : Array.isArray(response?.scores)
    ? response.scores.map((score, index) => ({ index, score }))
    : [];
  return items
    .map((item, index) => ({
      index: Number(item.index ?? item.document_index ?? item.rank_index ?? index),
      score: finiteNumberOrDefault(item.relevance_score ?? item.score ?? item.logit ?? item.value, 0),
    }))
    .filter((item) => Number.isInteger(item.index) && item.index >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function chatCompletionText(response) {
  const choice = Array.isArray(response?.choices) ? response.choices[0] : null;
  const content = choice?.message?.content ?? choice?.text ?? response?.output_text ?? response?.text ?? "";
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text ?? ""))
      .join("\n")
      .trim();
  }
  return String(content ?? "").trim();
}

function geminiText(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map((part) => part?.text ?? "").join("\n").trim();
  return String(response?.text ?? "").trim();
}

function rewritesFromQueryExpansionText(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(withoutFence);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? ""));
    if (Array.isArray(parsed?.queries)) return parsed.queries.map((item) => String(item ?? ""));
    if (Array.isArray(parsed?.rewrites)) return parsed.rewrites.map((item) => String(item ?? ""));
  } catch {
    // Providers sometimes return plain lines even after JSON instruction.
  }
  return withoutFence
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[-*\d.)\s"]+/, "").replace(/["\s]+$/g, ""))
    .filter(Boolean);
}

function sanitizeQueryExpansionRewrites(rewrites, options = {}) {
  const original = normalizeText(options.originalQuery ?? "");
  const maxRewrites = Math.max(1, Number(options.maxRewrites ?? 3));
  const seen = new Set([original]);
  const sanitized = [];
  for (const rewrite of rewrites) {
    const redacted = redactForExport(String(rewrite ?? ""));
    const clipped = clipQueryExpansion(redacted.text);
    const normalized = normalizeText(clipped);
    if (!normalized || seen.has(normalized)) continue;
    if (redacted.privateRedactionCount > 0 && !clipped.trim()) continue;
    seen.add(normalized);
    sanitized.push(clipped);
    if (sanitized.length >= maxRewrites) break;
  }
  return sanitized;
}

function voyageEmbedModel() {
  return String(process.env.VOYAGE_EMBED_MODEL ?? "voyage-4-large");
}

function voyageRerankModel() {
  return String(process.env.VOYAGE_RERANK_MODEL ?? "rerank-2.5");
}

function voyageStrategyConfig(strategy) {
  const configs = {
    "cloud-voyage-rerank-only": {
      mode: "rerank-only",
      embedModel: null,
      rerankModel: voyageRerankModel(),
      denseCandidateLimit: 0,
      rerankCandidateLimit: 60,
    },
    "cloud-voyage4-voyage": {
      mode: "embed-rerank",
      embedModel: voyageEmbedModel(),
      rerankModel: voyageRerankModel(),
      denseCandidateLimit: 120,
      rerankCandidateLimit: 60,
    },
    "cloud-voyage4-voyage-lite-rerank": {
      mode: "embed-rerank",
      embedModel: "voyage-4-large",
      rerankModel: "rerank-2.5-lite",
      denseCandidateLimit: 30,
      rerankCandidateLimit: 15,
    },
    "cloud-voyage4-lite-voyage-lite": {
      mode: "embed-rerank",
      embedModel: "voyage-4-lite",
      rerankModel: "rerank-2.5-lite",
      denseCandidateLimit: 30,
      rerankCandidateLimit: 15,
    },
  };
  return configs[strategy] ?? null;
}

function geminiEmbedModel() {
  return String(process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001").replace(/^models\//, "");
}

function geminiModelResource(model) {
  return `models/${String(model ?? "").replace(/^models\//, "")}`;
}

function geminiOutputDimensionality() {
  return optionalPositiveInt(process.env.GEMINI_EMBED_DIMENSIONS ?? process.env.GEMINI_OUTPUT_DIMENSION ?? "1536", "Gemini output dimension");
}

function nvidiaStrategyConfig(strategy) {
  const configs = {
    "cloud-nvidia-retriever-500m": {
      embedModel: "nvidia/llama-nemotron-embed-1b-v2",
      rerankModel: "nvidia/llama-3.2-nemoretriever-500m-rerank-v2",
    },
    "cloud-nvidia-nemotron-1b": {
      embedModel: "nvidia/llama-nemotron-embed-1b-v2",
      rerankModel: "nvidia/llama-nemotron-rerank-1b-v2",
    },
    "cloud-nvidia-nemotron-vl-1b": {
      embedModel: "nvidia/llama-nemotron-embed-vl-1b-v2",
      rerankModel: "nvidia/llama-nemotron-rerank-vl-1b-v2",
    },
    "cloud-nvidia-e5-mistral": {
      embedModel: "nvidia/nv-embedqa-e5-v5",
      rerankModel: "nvidia/nv-rerankqa-mistral-4b-v3",
    },
    "cloud-nvidia-code": {
      embedModel: "nvidia/nv-embedcode-7b-v1",
      rerankModel: "nvidia/llama-nemotron-rerank-1b-v2",
    },
  };
  return configs[strategy] ?? null;
}

function nvidiaEmbedModel(config) {
  return String(process.env.NVIDIA_EMBED_MODEL ?? config.embedModel);
}

function nvidiaRerankModel(config) {
  return String(process.env.NVIDIA_RERANK_MODEL ?? config.rerankModel);
}

function nvidiaEmbeddingEndpoint() {
  return String(process.env.NVIDIA_EMBEDDING_ENDPOINT ?? "https://integrate.api.nvidia.com/v1/embeddings");
}

function nvidiaRerankEndpoint(config) {
  if (process.env.NVIDIA_RERANK_ENDPOINT) return String(process.env.NVIDIA_RERANK_ENDPOINT);
  return `https://ai.api.nvidia.com/v1/retrieval/${nvidiaRerankModel(config)}/reranking`;
}

function queryExpansionPlan(options = {}) {
  if (options.fixtureRequested) return null;
  const localBaseUrl = String(process.env.SELFMEM_QUERY_EXPANSION_BASE_URL ?? "").trim();
  const localModel = String(process.env.SELFMEM_QUERY_EXPANSION_MODEL ?? "").trim();
  if (localBaseUrl && localModel) {
    return {
      mode: "pure-local",
      provider: "local-openai-compatible",
      endpoint: openAiCompatibleChatEndpoint(localBaseUrl),
      model: localModel,
      apiKey: String(process.env.SELFMEM_QUERY_EXPANSION_API_KEY ?? "").trim() || null,
    };
  }

  const cloudCallsAllowed = process.env.RECALLWEAVE_QUERY_EXPANSION_CALLS === "1" || providerBenchmarkCallsAllowed;
  const publicDataConfirmed = process.env.RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA === "1" || providerBenchmarkPublicData;
  if (!cloudCallsAllowed || !publicDataConfirmed) return null;
  if (providerKeyCount("nvidia") > 0) {
    return {
      mode: "mixed-local-cloud",
      provider: "nvidia-openai-compatible",
      endpoint: openAiCompatibleChatEndpoint(process.env.NVIDIA_QUERY_EXPANSION_BASE_URL ?? "https://integrate.api.nvidia.com/v1"),
      model: String(process.env.NVIDIA_QUERY_EXPANSION_MODEL ?? process.env.SELFMEM_QUERY_EXPANSION_MODEL ?? "nvidia/llama-3.1-nemotron-nano-8b-v1"),
      apiKey: chooseProviderKey("nvidia", "query-expansion"),
    };
  }
  if (providerKeyCount("gemini") > 0) {
    return {
      mode: "mixed-local-cloud",
      provider: "gemini",
      endpoint: null,
      model: String(process.env.GEMINI_QUERY_EXPANSION_MODEL ?? "gemini-2.5-flash"),
      apiKey: null,
    };
  }
  if (providerKeyCount("openrouter") > 0) {
    return {
      mode: "mixed-local-cloud",
      provider: "openrouter-openai-compatible",
      endpoint: openAiCompatibleChatEndpoint(process.env.OPENROUTER_QUERY_EXPANSION_BASE_URL ?? "https://openrouter.ai/api/v1"),
      model: String(process.env.OPENROUTER_QUERY_EXPANSION_MODEL ?? process.env.SELFMEM_QUERY_EXPANSION_MODEL ?? "qwen/qwen3-next-80b-a3b-instruct:free"),
      apiKey: chooseProviderKey("openrouter", "query-expansion"),
    };
  }
  return null;
}

function openAiCompatibleChatEndpoint(baseUrl) {
  const normalized = String(baseUrl ?? "").replace(/\/+$/, "");
  assert.ok(normalized, "query expansion base URL is required");
  if (normalized.endsWith("/chat/completions")) return normalized;
  return normalized.endsWith("/v1") ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;
}

function queryExpansionInstruction() {
  return String(
    process.env.SELFMEM_QUERY_EXPANSION_INSTRUCTION ??
      "Rewrite the user query into short recall/search queries. Preserve exact identifiers, names, dates, citations, numbers, and negations. Do not add facts. Return only rewritten queries.",
  );
}

function queryExpansionMaxRewrites() {
  return optionalPositiveInt(process.env.SELFMEM_QUERY_EXPANSION_MAX_REWRITES ?? null, "query expansion max rewrites") ?? 3;
}

function queryExpansionMaxChars() {
  return optionalPositiveInt(process.env.SELFMEM_QUERY_EXPANSION_MAX_CHARS ?? null, "query expansion max chars") ?? 1200;
}

function queryExpansionMaxOutputTokens() {
  return optionalPositiveInt(process.env.SELFMEM_QUERY_EXPANSION_MAX_OUTPUT_TOKENS ?? null, "query expansion max output tokens") ?? 160;
}

function queryExpansionTemperature() {
  return finiteNumberOrDefault(process.env.SELFMEM_QUERY_EXPANSION_TEMPERATURE, 0);
}

function clipQueryExpansion(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, queryExpansionMaxChars());
}

function localAppleStrategyConfig(strategy = rankingStrategy) {
  const configs = {
    "local-apple-qwen3-0_6b": {
      model: "Qwen/Qwen3-Embedding-0.6B-GGUF",
      dimensions: 1024,
    },
    "local-apple-qwen3-0_6b-local-rerank": {
      model: "Qwen/Qwen3-Embedding-0.6B-GGUF",
      dimensions: 1024,
      rerankMode: "sidecar",
      rerankModel: "Qwen/Qwen3-Reranker-0.6B",
      rerankCandidateLimit: 30,
    },
    "local-apple-qwen3-4b": {
      model: "Qwen/Qwen3-Embedding-4B-GGUF",
      dimensions: 2560,
    },
  };
  return configs[strategy] ?? null;
}

function localAppleEmbedModel(strategy = rankingStrategy) {
  return String(process.env.SELFMEM_LOCAL_EMBED_MODEL ?? localAppleStrategyConfig(strategy)?.model ?? "Qwen/Qwen3-Embedding-0.6B-GGUF");
}

function localAppleEmbedDimensions(strategy = rankingStrategy) {
  return optionalPositiveInt(
    process.env.SELFMEM_LOCAL_EMBED_DIMENSIONS ?? String(localAppleStrategyConfig(strategy)?.dimensions ?? 1024),
    "local Apple output dimension",
  );
}

function localAppleRerankModel(strategy = rankingStrategy) {
  return String(process.env.SELFMEM_LOCAL_RERANK_MODEL ?? localAppleStrategyConfig(strategy)?.rerankModel ?? "Qwen/Qwen3-Reranker-0.6B");
}

function localAppleRerankEndpoint() {
  if (process.env.SELFMEM_LOCAL_RERANK_ENDPOINT) return String(process.env.SELFMEM_LOCAL_RERANK_ENDPOINT);
  const baseUrl = String(process.env.SELFMEM_LOCAL_RERANK_BASE_URL ?? "").replace(/\/+$/, "");
  assert.ok(baseUrl, "SELFMEM_LOCAL_RERANK_ENDPOINT or SELFMEM_LOCAL_RERANK_BASE_URL is required for local Apple rerank");
  return baseUrl.endsWith("/v1") ? `${baseUrl}/rerank` : `${baseUrl}/v1/rerank`;
}

function localAppleEmbedMaxEstimatedTokens() {
  return optionalPositiveInt(process.env.SELFMEM_LOCAL_EMBED_MAX_TOKENS ?? "3000", "local Apple embedding max tokens");
}

function localAppleEmbeddingCacheDescriptor(candidate) {
  const text = String(candidate?.text ?? "");
  const embeddingView = prepareLocalAppleEmbeddingInput(text);
  const settings = localAppleEmbeddingCacheSettings();
  const contentHash = candidate?.contentHash ?? stableHash(text);
  const embeddingViewHash = stableHash(embeddingView);
  const cacheKey = stableHash({
    ...settings,
    contentHash,
    embeddingViewHash,
  });
  return {
    ...settings,
    cacheKey,
    contentHash,
    embeddingViewHash,
    embeddingView,
  };
}

function localAppleEmbeddingCacheSettings() {
  return {
    schemaVersion: 1,
    provider: "local-apple",
    inputPolicy: "head-tail-v1",
    model: localAppleEmbedModel(),
    configuredDimensions: localAppleEmbedDimensions(),
    maxEstimatedTokens: localAppleEmbedMaxEstimatedTokens(),
  };
}

function ensureLocalApplePersistentCacheLoaded(options = {}) {
  if (localApplePersistentCacheState) return localApplePersistentCacheState;
  const enabled = !envFlagDisabled(process.env.SELFMEM_LOCAL_EMBED_CACHE ?? process.env.SELFMEM_LOCAL_EMBED_CACHE_ENABLED ?? "1");
  const settings = localAppleEmbeddingCacheSettings();
  localApplePersistentCacheState = {
    enabled,
    settings,
    path: null,
  };
  if (!enabled) {
    options.providerStats?.recordLocalEmbeddingCacheLoad({ enabled: false });
    return localApplePersistentCacheState;
  }
  let entriesLoaded = 0;
  let readErrors = 0;
  try {
    const cachePath = localAppleEmbeddingCachePath(settings);
    localApplePersistentCacheState.path = cachePath;
    mkdirSync(dirname(cachePath), { recursive: true, mode: 0o700 });
    try {
      chmodSync(dirname(cachePath), 0o700);
    } catch {
      // Best-effort privacy hardening. Existing filesystem ACLs may be stricter.
    }
    if (existsSync(cachePath)) {
      const lines = readFileSync(cachePath, "utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (!isCurrentLocalAppleEmbeddingCacheEntry(entry, settings)) continue;
          localAppleDocumentEmbeddingCache.set(entry.cacheKey, entry.vector);
          entriesLoaded += 1;
        } catch {
          readErrors += 1;
        }
      }
      try {
        chmodSync(cachePath, 0o600);
      } catch {
        // Best effort only.
      }
    }
  } catch {
    readErrors += 1;
    localApplePersistentCacheState.enabled = false;
  }
  options.providerStats?.recordLocalEmbeddingCacheLoad({
    enabled: localApplePersistentCacheState.enabled,
    entriesLoaded,
    readErrors,
  });
  return localApplePersistentCacheState;
}

function persistLocalAppleEmbeddingCacheEntry(descriptor, vector, options = {}) {
  const state = ensureLocalApplePersistentCacheLoaded(options);
  if (!state.enabled || !state.path) return;
  try {
    const entry = {
      schemaVersion: 1,
      provider: "local-apple",
      inputPolicy: descriptor.inputPolicy,
      model: descriptor.model,
      configuredDimensions: descriptor.configuredDimensions,
      dimensions: Array.isArray(vector) ? vector.length : 0,
      maxEstimatedTokens: descriptor.maxEstimatedTokens,
      cacheKey: descriptor.cacheKey,
      contentHash: descriptor.contentHash,
      embeddingViewHash: descriptor.embeddingViewHash,
      vector,
      createdAt: generatedAt,
    };
    appendFileSync(state.path, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    options.providerStats?.recordLocalEmbeddingCacheWrite();
  } catch {
    options.providerStats?.recordLocalEmbeddingCacheWriteError();
  }
}

function localAppleEmbeddingCachePath(settings) {
  if (process.env.SELFMEM_LOCAL_EMBED_CACHE_PATH) return resolve(String(process.env.SELFMEM_LOCAL_EMBED_CACHE_PATH));
  const settingsHash = stableHash(settings).slice(0, 16);
  return join(homedir(), ".cache", "recallweave", `local-apple-embeddings-${settingsHash}.jsonl`);
}

function isCurrentLocalAppleEmbeddingCacheEntry(entry, settings) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.schemaVersion !== 1 || entry.provider !== "local-apple") return false;
  if (entry.inputPolicy !== settings.inputPolicy) return false;
  if (entry.model !== settings.model) return false;
  if (entry.configuredDimensions !== settings.configuredDimensions) return false;
  if (entry.maxEstimatedTokens !== settings.maxEstimatedTokens) return false;
  if (typeof entry.cacheKey !== "string" || typeof entry.contentHash !== "string" || typeof entry.embeddingViewHash !== "string") return false;
  if (!Array.isArray(entry.vector) || !entry.vector.length) return false;
  if (Number.isFinite(entry.dimensions) && entry.vector.length !== entry.dimensions) return false;
  return entry.vector.every((value) => Number.isFinite(value));
}

function prepareLocalAppleEmbeddingInput(text) {
  const source = providerSafeText(text);
  const maxEstimatedTokens = localAppleEmbedMaxEstimatedTokens();
  if (estimateTokens(source) <= maxEstimatedTokens) return source;
  const maxChars = Math.max(64, maxEstimatedTokens * 4);
  const marker = "\n\n[RecallWeave local embedding view: middle elided]\n\n";
  const available = Math.max(64, maxChars - marker.length);
  const headChars = Math.max(32, Math.floor(available * 0.6));
  const tailChars = Math.max(32, available - headChars);
  return `${source.slice(0, headChars)}${marker}${source.slice(-tailChars)}`;
}

function providerSafeText(value) {
  const text = String(value ?? "");
  if (typeof text.toWellFormed === "function") return text.toWellFormed();
  return text.replace(/[\uD800-\uDFFF]/g, " ");
}

function providerCandidateLimit(envName, fallback) {
  return optionalPositiveInt(process.env[envName] ?? null, envName) ?? fallback;
}

function batchProviderInputs(items, options = {}) {
  const maxCount = Math.max(1, Number(options.maxCount ?? 32));
  const maxEstimatedTokens = Math.max(1, Number(options.maxEstimatedTokens ?? 60_000));
  const batches = [];
  let current = [];
  let currentTokens = 0;
  for (const item of items) {
    const estimated = estimateTokens(item);
    if (current.length && (current.length >= maxCount || currentTokens + estimated > maxEstimatedTokens)) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(item);
    currentTokens += estimated;
  }
  if (current.length) batches.push(current);
  return batches;
}

function providerMockRerank(query, candidates) {
  const reranked = rerankProxy(query, candidates);
  return reranked.map((candidate, index) => ({
    ...candidate,
    score: round(candidate.score + reciprocalRankBoost(index + 1) + deterministicNoise(`${queryTextValue(query)}:${candidate.outputId}`) * 0.01),
  })).sort(byScoreThenId);
}

function deterministicNoise(value) {
  return Number.parseInt(stableHash(value).slice(0, 8), 16) / 0xffffffff;
}

function candidatesNotIn(selected, allCandidates) {
  const ids = new Set(selected.map((candidate) => candidate.outputId));
  return allCandidates.filter((candidate) => !ids.has(candidate.outputId)).map((candidate) => ({ ...candidate, score: 0 }));
}

function charNgrams(text, size) {
  const compact = String(text).replace(/\s+/g, " ").trim();
  if (compact.length < size) return compact ? [compact] : [];
  return Array.from({ length: compact.length - size + 1 }, (_, index) => compact.slice(index, index + size));
}

function expandQuery(query) {
  const tokens = tokenize(query);
  const expanded = new Set(tokens);
  const expansionMap = {
    remember: ["memory", "store", "write", "recall"],
    memory: ["remember", "recall", "stored", "context"],
    policy: ["rule", "decision", "setting"],
    ui: ["interface", "dashboard", "brain", "preview"],
    proof: ["evidence", "verified", "smoke", "review"],
    latest: ["recent", "updated", "current", "new"],
    recent: ["latest", "updated", "current", "new"],
    when: ["date", "time", "after", "before"],
    changed: ["updated", "superseded", "replaced"],
    canary: ["benchmark", "smoke", "gate", "test"],
  };
  for (const token of tokens) {
    if (token.endsWith("s") && token.length > 3) expanded.add(token.slice(0, -1));
    if (token.endsWith("ed") && token.length > 4) expanded.add(token.slice(0, -2));
    for (const synonym of expansionMap[token] ?? []) expanded.add(synonym);
  }
  return [...expanded].join(" ");
}

function topicTerms(text) {
  const stop = new Set(["what", "when", "where", "which", "with", "that", "this", "from", "into", "have", "does", "must", "should", "would", "could", "about", "before", "after", "session", "assistant", "user"]);
  return new Set(tokenize(text).filter((token) => token.length > 2 && !stop.has(token)));
}

function overlapRatio(left, right) {
  if (!left.size || !right.size) return 0;
  let hits = 0;
  for (const item of left) {
    if (right.has(item)) hits += 1;
  }
  return hits / Math.max(1, left.size);
}

function roleCoverageScore(text) {
  const normalized = normalizeText(text);
  let score = 0;
  if (normalized.includes("user:")) score += 0.35;
  if (normalized.includes("assistant:")) score += 0.35;
  if (normalized.includes("date:")) score += 0.15;
  if (normalized.includes("session:")) score += 0.15;
  return Math.min(1, score);
}

function temporalWeight(query) {
  const text = normalizeText(`${queryTextValue(query)} ${query?.metadata?.questionType ?? ""}`);
  return /\btemporal|knowledge-update|latest|recent|recently|last|current|now|after|before|when|changed|updated\b/.test(text) ? 0.7 : 0.25;
}

function metadataWeight(query) {
  const type = normalizeText(query?.metadata?.questionType ?? "");
  if (!type) return 0.35;
  if (/\b(temporal|knowledge-update|multi-session)\b/.test(type)) return 0.85;
  return 0.65;
}

function metadataTokens(metadata) {
  return new Set(
    Object.entries(metadata ?? {})
      .filter(([key]) => ["kind", "type", "category", "questionType", "source"].includes(key))
      .flatMap(([key, value]) => tokenize(`${key} ${String(value ?? "")}`)),
  );
}

function broadQuestionType(value) {
  const text = normalizeText(value);
  if (text.startsWith("single-session")) return "single-session";
  if (text.startsWith("multi-session")) return "multi-session";
  if (text.startsWith("knowledge-update")) return "knowledge-update";
  if (text.startsWith("temporal")) return "temporal";
  return text;
}

function temporalCompatibility(query, candidate) {
  const text = normalizeText(`${queryTextValue(query)} ${query?.metadata?.questionType ?? ""}`);
  const wantsTemporal = /\b(temporal|knowledge-update|latest|recent|recently|last|current|now|after|before|when|changed|updated)\b/.test(text);
  if (!wantsTemporal) return 0;
  return Number.isFinite(candidate.dateMs) ? 1 : 0;
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

function byScoreThenId(left, right) {
  return right.score - left.score || left.outputId.localeCompare(right.outputId);
}

function queryTextValue(query) {
  return typeof query === "string" ? query : String(query?.q ?? "");
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

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return {};
  const safe = {};
  for (const key of ["kind", "type", "category", "questionType", "date", "createdAt", "updatedAt", "source"]) {
    if (metadata[key] == null) continue;
    const value = String(metadata[key]).slice(0, 160);
    assert.doesNotMatch(value, secretPattern, `metadata.${key} contains a key-shaped secret`);
    assert.doesNotMatch(value, privatePathPattern, `metadata.${key} contains a private path`);
    safe[key] = value;
  }
  return safe;
}

function extractDateMs(item, text) {
  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  for (const value of [metadata.date, metadata.createdAt, metadata.updatedAt, item?.createdAt, item?.updatedAt]) {
    const parsed = Date.parse(String(value ?? ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  const match = String(text ?? "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (match) {
    const parsed = Date.parse(match[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function assertOutsideRepo(path, label) {
  const rel = relative(root, path);
  assert.ok(rel.startsWith("..") || isAbsolute(rel), `${label} must live outside the repository`);
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

function envFlagDisabled(value) {
  return ["0", "false", "off", "no", "disabled"].includes(String(value ?? "").trim().toLowerCase());
}

function normalizeStrategy(value) {
  const strategy = String(value ?? "").trim().toLowerCase() || "jaccard";
  assert.ok(retrievalStrategies.includes(strategy), `unknown retrieval strategy: ${strategy}`);
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
