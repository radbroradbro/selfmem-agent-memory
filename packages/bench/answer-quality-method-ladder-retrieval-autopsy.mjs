import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.live;
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const targetPath = resolveInputPath(
  args.target ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ?? "reviews/overnight-20260522/public-longmemeval-full-run-target.json",
);
const methods = splitList(args.methods ?? process.env.RECALLWEAVE_RETRIEVAL_AUTOPSY_METHODS ?? "session-v1,contextual-source-chunk-v1");
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_RETRIEVAL_AUTOPSY_STRATEGIES ?? "bm25-lite");
const baselineMethod = String(args.baselineMethod ?? methods[0] ?? "session-v1");
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 5, "limit");
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_MAX_QUERIES ?? 5, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_BASELINE_QUERY_OFFSET ?? 0, "query offset");
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 300_000_000, "max memory bytes");
const minHitRateLift = Number(args.minHitRateLift ?? 0.001);
const requireReady = Boolean(args.requireReady);

const memoryMethods = ["session-v1", "contextual-source-chunk-v1", "contextual-index-source-chunk-v1", "atomic-memory-v1"];
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
  "wiki-title-amplified-hybrid",
  "wiki-subtopic-amplified-hybrid",
  "wiki-summary-session-hybrid",
  "cloud-voyage-rerank-only",
  "cloud-voyage4-voyage",
  "cloud-voyage4-voyage-lite-rerank",
  "cloud-voyage4-lite-voyage-lite",
  "cloud-gemini-embed-rerank-proxy",
  "cloud-gemini-voyage-rerank",
  "cloud-gemini2-embed-rerank-proxy",
  "cloud-gemini2-voyage-rerank",
  "cloud-nvidia-retriever-500m",
  "cloud-nvidia-nemotron-1b",
  "cloud-nvidia-nemotron-vl-1b",
  "cloud-nvidia-e5-mistral",
  "cloud-nvidia-code",
  "cloud-nvidia-nv-embed-v1-mistral-rerank",
  "cloud-nvidia-embedcode-7b-mistral-rerank",
  "local-apple-qwen3-0_6b",
  "local-apple-qwen3-0_6b-local-rerank",
  "local-apple-qwen3-4b",
  "local-apple-qwen3-4b-local-rerank",
];
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(methods.length >= 2, "retrieval autopsy needs at least two memory methods");
assert.ok(methods.includes(baselineMethod), "--baseline-method must be included in --methods");
assert.ok(Number.isFinite(minHitRateLift), "--min-hit-rate-lift must be numeric");
for (const method of methods) assert.ok(memoryMethods.includes(method), `unknown memory method: ${method}`);
for (const strategy of strategies) assert.ok(retrievalStrategies.includes(strategy), `unknown retrieval strategy: ${strategy}`);
if (fixtureRequested) assert.equal(queryOffset, 0, "--query-offset is only supported for live retrieval autopsies");
if (!fixtureRequested) {
  assert.ok(targetPath && existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
  assert.ok(statSync(targetPath).size > 0, `target empty: ${displayPath(targetPath)}`);
}

const runRoot = mkdtempSync(resolve(tmpdir(), "recallweave-retrieval-autopsy-"));
const methodReports = [];

for (const method of methods) {
  const methodDir = resolve(runRoot, method);
  mkdirSync(methodDir, { recursive: true, mode: 0o700 });
  const materializePath = resolve(methodDir, "materialize.json");
  runNode([
    "packages/bench/public-benchmark-materialize-run.mjs",
    fixtureRequested ? "--fixture" : "--live",
    "--memory-method",
    method,
    "--private-output-dir",
    methodDir,
    "--context-token-budget",
    String(contextTokenBudget),
    "--limit",
    String(limit),
    ...(fixtureRequested ? [] : ["--target", targetPath]),
    ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
    ...(queryOffset ? ["--query-offset", String(queryOffset)] : []),
    "--format",
    "json",
    "--output",
    materializePath,
  ]);
  const materialize = loadJson(materializePath, `${method} materialize report`);
  const querySetPath = resolve(methodDir, "longmemeval-queryset.private.json");
  const memoriesPath = resolve(methodDir, "longmemeval-memories.private.jsonl");
  const querySet = loadJson(querySetPath, `${method} private query set`);
  const memoryProfile = profilePrivateMemories(memoriesPath);
  const arms = [];
  for (const strategy of strategies) {
    const responsePath = resolve(methodDir, `${strategy}-responses.json`);
    runNode(
      [
        "packages/bench/recallweave-response-export.mjs",
        fixtureRequested ? "--fixture" : "--live",
        "--queryset",
        querySetPath,
        "--memories",
        memoriesPath,
        "--preserve-ids",
        "--strategy",
        strategy,
        "--context-token-budget",
        String(contextTokenBudget),
        "--limit",
        String(limit),
        "--max-memory-bytes",
        String(maxMemoryBytes),
        "--output",
        responsePath,
      ],
      {
        RECALLWEAVE_BASELINE_LIVE: "1",
        RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
        SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
        RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
      },
    );
    const response = loadJson(responsePath, `${method}/${strategy} response export`);
    arms.push(analyzeArm({ method, strategy, querySet, response }));
  }
  methodReports.push({
    method,
    materialization: materializationPublicSummary(materialize),
    memoryProfile,
    arms,
  });
}

const report = buildReport({ methodReports });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "retrieval autopsy report");
assertSafePublicText(markdownText, "retrieval autopsy markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_RETRIEVAL_CHALLENGER_FOR_SCORING") process.exit(1);

function buildReport({ methodReports }) {
  const arms = methodReports.flatMap((method) => method.arms);
  const baselineArms = arms.filter((arm) => arm.method === baselineMethod);
  const challengers = arms.filter((arm) => arm.method !== baselineMethod);
  const bestBaseline = bestArm(baselineArms);
  const bestChallenger = bestArm(challengers);
  const sameRawQuerySelectionAcrossMethods =
    new Set(methodReports.map((item) => item.materialization.selectedQuestionIdsHash).filter(Boolean)).size === 1;
  const paired = bestBaseline && bestChallenger ? pairedComparison(bestBaseline, bestChallenger) : null;
  const hitRateLift =
    bestBaseline && bestChallenger ? round(Number(bestChallenger.hitRate ?? 0) - Number(bestBaseline.hitRate ?? 0), 6) : null;
  const status =
    bestBaseline
    && bestChallenger
    && sameRawQuerySelectionAcrossMethods
    && Number(hitRateLift) >= minHitRateLift
      ? "READY_RETRIEVAL_CHALLENGER_FOR_SCORING"
      : "BLOCKED_RETRIEVAL_LAYER_NO_CHALLENGER_LIFT";
  const blockers = [
    !sameRawQuerySelectionAcrossMethods ? "methods-not-on-same-raw-query-selection" : null,
    !bestBaseline ? "baseline-method-missing" : null,
    !bestChallenger ? "challenger-method-missing" : null,
    bestBaseline && bestChallenger && !(Number(hitRateLift) >= minHitRateLift)
      ? "best-challenger-does-not-improve-expected-hit-rate"
      : null,
  ].filter(Boolean);
  const nextActions =
    status === "READY_RETRIEVAL_CHALLENGER_FOR_SCORING"
      ? [
          "Run a bounded answer-quality scorer on the same shard for the retrieval challenger before expanding the shard.",
          "Promote only if the standard method-ladder result gate shows a non-session challenger beating session-v1.",
        ]
      : [
          "Do not spend on a larger answer-quality shard yet; the retrieval layer has not shown expected-support lift over the session baseline.",
          "Run the next autoresearch loop on chunking, hybrid/rerank, metadata/query expansion, or rehydration policy rather than on BM25 control scoring.",
          "Keep BM25/session as the floor/control and require a challenger to improve expected-hit coverage before another long scorer run.",
        ];

  return {
    schemaVersion: 1,
    ok: true,
    mode: "answer-quality-method-ladder-retrieval-autopsy",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    fixtureOnly: fixtureRequested,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    runsAnswerQualityScorer: false,
    publicBenchmarkClaimsAllowed: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPrivateOutputPathIncluded: false,
    benchmark: "longmemeval",
    target: {
      targetFileHash: methodReports[0]?.materialization?.targetFileHash ?? null,
      selectedQuestionIdsHash: uniqueOrNull(methodReports.map((item) => item.materialization.selectedQuestionIdsHash)),
    },
    queryShard: {
      startIndex: queryOffset,
      endIndexExclusive: maxQueries ? queryOffset + maxQueries : null,
      requestedLimit: maxQueries,
      sameRawQuerySelectionAcrossMethods,
    },
    contextTokenBudget,
    limit,
    maxMemoryBytes,
    methods,
    strategies,
    baselineMethod,
    thresholds: {
      minHitRateLift,
    },
    status,
    countsAsRetrievalLayerEvidence: status === "READY_RETRIEVAL_CHALLENGER_FOR_SCORING",
    countsAsAnswerQualityEvidence: false,
    countsAsFullMemorySotaEvidence: false,
    reason:
      status === "READY_RETRIEVAL_CHALLENGER_FOR_SCORING"
        ? "A non-session memory method retrieved expected support more often than the session baseline on the same raw query selection; answer-quality scoring is still required."
        : "No non-session memory method retrieved expected support more often than the session baseline on the same raw query selection; expanding answer-quality scoring would not target the failing layer.",
    blockers,
    bestBaseline: publicArmSummary(bestBaseline),
    bestChallenger: publicArmSummary(bestChallenger),
    comparison: {
      hitRateLift,
      paired,
    },
    methodReports,
    nextActions,
  };
}

function analyzeArm({ method, strategy, querySet, response }) {
  const queries = Array.isArray(querySet.queries) ? querySet.queries : [];
  const responses = response.responses ?? {};
  const queryOutcomes = queries.map((query) => {
    const expectedIds = new Set(asArray(query.expectedResultIds).map(String).filter(Boolean));
    const expectedHashes = new Set(asArray(query.expectedResultHashes).map(String).filter(Boolean));
    const result = responses[query.id] ?? {};
    const items = Array.isArray(result.results) ? result.results : [];
    const firstHitIndex = items.findIndex((item) => {
      const id = String(item?.id ?? "");
      const hash = String(item?.contentHash ?? "");
      return (id && expectedIds.has(id)) || (hash && expectedHashes.has(hash));
    });
    const firstHitRank = firstHitIndex >= 0 ? firstHitIndex + 1 : null;
    const hitCount = items.filter((item) => {
      const id = String(item?.id ?? "");
      const hash = String(item?.contentHash ?? "");
      return (id && expectedIds.has(id)) || (hash && expectedHashes.has(hash));
    }).length;
    return {
      queryIdHash: shortHash(query.id),
      queryHash: shortHash(query.q),
      expectedRefCount: expectedIds.size + expectedHashes.size,
      expectedIdRefCount: expectedIds.size,
      expectedHashRefCount: expectedHashes.size,
      responseResultCount: items.length,
      responseTotal: Number(result.total ?? items.length),
      responseTotalBeforeBudget: Number(result.totalBeforeBudget ?? result.total ?? items.length),
      firstHitRank,
      hit: firstHitRank != null,
      hitCount,
      rankBucket: rankBucket(firstHitRank),
    };
  });
  const hitQueries = queryOutcomes.filter((item) => item.hit);
  const misses = queryOutcomes.filter((item) => !item.hit);
  const reciprocalRanks = queryOutcomes.map((item) => (item.firstHitRank ? 1 / item.firstHitRank : 0));
  const firstHitRanks = hitQueries.map((item) => item.firstHitRank).filter((item) => item != null);
  return {
    method,
    strategy,
    queryCount: queryOutcomes.length,
    hitQueryCount: hitQueries.length,
    missQueryCount: misses.length,
    hitRate: round(hitQueries.length / Math.max(1, queryOutcomes.length), 6),
    meanReciprocalRank: round(sum(reciprocalRanks) / Math.max(1, reciprocalRanks.length), 6),
    averageFirstHitRank: firstHitRanks.length ? round(sum(firstHitRanks) / firstHitRanks.length, 3) : null,
    rankBuckets: {
      rank1: queryOutcomes.filter((item) => item.rankBucket === "rank-1").length,
      rank2to5: queryOutcomes.filter((item) => item.rankBucket === "rank-2-to-5").length,
      rankAfter5: queryOutcomes.filter((item) => item.rankBucket === "rank-after-5").length,
      miss: misses.length,
    },
    expectedRefCount: sum(queryOutcomes.map((item) => item.expectedRefCount)),
    averageResponseResultCount: round(sum(queryOutcomes.map((item) => item.responseResultCount)) / Math.max(1, queryOutcomes.length), 3),
    response: {
      querySetHash: response.querySetHash ?? null,
      queryShard: response.queryShard ?? null,
      inputStats: response.inputStats ?? null,
      contextBudget: response.contextBudget ?? null,
      privacyLeakCount: Number(response.privacyLeakCount ?? 0),
      redactionFailureCount: Number(response.redactionFailureCount ?? 0),
      rawMemoryIncluded: response.rawMemoryIncluded === true,
      rawPromptIncluded: response.rawPromptIncluded === true,
      rawAnswerIncluded: response.rawAnswerIncluded === true,
      rawTranscriptIncluded: response.rawTranscriptIncluded === true,
    },
    queryOutcomes,
  };
}

function pairedComparison(baseline, challenger) {
  const baseByQuery = new Map(baseline.queryOutcomes.map((item) => [item.queryIdHash, item]));
  const pairs = challenger.queryOutcomes.flatMap((challengerItem) => {
    const baselineItem = baseByQuery.get(challengerItem.queryIdHash);
    if (!baselineItem) return [];
    return [{
      queryIdHash: challengerItem.queryIdHash,
      baselineFirstHitRank: baselineItem.firstHitRank,
      challengerFirstHitRank: challengerItem.firstHitRank,
      outcome: pairedOutcome(baselineItem, challengerItem),
    }];
  });
  return {
    pairCount: pairs.length,
    bothHit: pairs.filter((item) => item.outcome === "both-hit").length,
    baselineOnlyHit: pairs.filter((item) => item.outcome === "baseline-only-hit").length,
    challengerOnlyHit: pairs.filter((item) => item.outcome === "challenger-only-hit").length,
    bothMiss: pairs.filter((item) => item.outcome === "both-miss").length,
    challengerBetterRank: pairs.filter((item) => rankScore(item.challengerFirstHitRank) > rankScore(item.baselineFirstHitRank)).length,
    baselineBetterRank: pairs.filter((item) => rankScore(item.baselineFirstHitRank) > rankScore(item.challengerFirstHitRank)).length,
    sameRankOrBothMiss: pairs.filter((item) => rankScore(item.baselineFirstHitRank) === rankScore(item.challengerFirstHitRank)).length,
    pairs,
  };
}

function profilePrivateMemories(memoriesPath) {
  const lines = readFileSync(memoriesPath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  let parsed = 0;
  const byKind = new Map();
  const byRetrievalRole = new Map();
  for (const line of lines) {
    const item = JSON.parse(line);
    parsed += 1;
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const kind = String(metadata.kind ?? "unknown");
    const role = String(metadata.retrievalRole ?? "candidate");
    byKind.set(kind, Number(byKind.get(kind) ?? 0) + 1);
    byRetrievalRole.set(role, Number(byRetrievalRole.get(role) ?? 0) + 1);
  }
  return {
    fileName: basename(memoriesPath),
    fileHash: `sha256:${sha256(readFileSync(memoriesPath))}`,
    lineCount: lines.length,
    parsed,
    byKind: Object.fromEntries([...byKind.entries()].sort()),
    byRetrievalRole: Object.fromEntries([...byRetrievalRole.entries()].sort()),
  };
}

function materializationPublicSummary(materialize) {
  return {
    ok: materialize.ok === true,
    mode: materialize.mode ?? null,
    fixtureOnly: materialize.fixtureOnly === true,
    targetFileHash: materialize.target?.targetFileHash ?? null,
    targetIdHash: materialize.target?.targetIdHash ?? null,
    memoryMethod: materialize.selection?.memoryMethod ?? materialize.target?.memoryMethod ?? null,
    selectedQuestionIdsHash: materialize.selection?.selectedQuestionIdsHash ?? null,
    targetSelectedQuestionIdsHash: materialize.selection?.targetSelectedQuestionIdsHash ?? null,
    materializerHash: materialize.selection?.materializerHash ?? null,
    materializationShard: materialize.selection?.materializationShard ?? null,
    queryCount: materialize.selection?.queryCount ?? null,
    memoryRecordCount: materialize.selection?.memoryRecordCount ?? null,
    haystackSessionCount: materialize.selection?.haystackSessionCount ?? null,
    contextualSourceChunkCount: materialize.selection?.contextualSourceChunkCount ?? null,
    contextualIndexMemoryCount: materialize.selection?.contextualIndexMemoryCount ?? null,
    atomicMemoryCount: materialize.selection?.atomicMemoryCount ?? null,
    rawSessionMemoryCount: materialize.selection?.rawSessionMemoryCount ?? null,
    expectedResultRefCount: materialize.selection?.expectedResultRefCount ?? null,
    querySetHash: materialize.selection?.querySetHash ?? null,
    collectorCompatibleQuerySetHash: materialize.selection?.collectorCompatibleQuerySetHash ?? null,
    memoriesFileHash: materialize.selection?.memoriesFileHash ?? null,
    answerLabelsFileHash: materialize.selection?.answerLabelsFileHash ?? null,
    rawTextPubliclyIncluded: materialize.sourceRetention?.rawTextPubliclyIncluded === true,
    privateOutputPathIncluded: materialize.sourceRetention?.privateOutputPathIncluded === true,
  };
}

function bestArm(arms) {
  return [...arms].sort(
    (left, right) =>
      Number(right.hitRate) - Number(left.hitRate) ||
      Number(right.meanReciprocalRank) - Number(left.meanReciprocalRank) ||
      Number(left.averageFirstHitRank ?? Infinity) - Number(right.averageFirstHitRank ?? Infinity),
  )[0] ?? null;
}

function publicArmSummary(arm) {
  if (!arm) return null;
  return {
    method: arm.method,
    strategy: arm.strategy,
    queryCount: arm.queryCount,
    hitQueryCount: arm.hitQueryCount,
    missQueryCount: arm.missQueryCount,
    hitRate: arm.hitRate,
    meanReciprocalRank: arm.meanReciprocalRank,
    averageFirstHitRank: arm.averageFirstHitRank,
    rankBuckets: arm.rankBuckets,
    expectedRefCount: arm.expectedRefCount,
    averageResponseResultCount: arm.averageResponseResultCount,
  };
}

function pairedOutcome(baseline, challenger) {
  if (baseline.hit && challenger.hit) return "both-hit";
  if (baseline.hit && !challenger.hit) return "baseline-only-hit";
  if (!baseline.hit && challenger.hit) return "challenger-only-hit";
  return "both-miss";
}

function rankScore(rank) {
  return rank ? 1 / Number(rank) : 0;
}

function rankBucket(rank) {
  if (rank == null) return "miss";
  if (rank === 1) return "rank-1";
  if (rank <= 5) return "rank-2-to-5";
  return "rank-after-5";
}

function renderMarkdown(value) {
  const lines = [
    "# Answer-quality method ladder retrieval autopsy",
    "",
    `Status: ${value.status}`,
    `Fixture only: ${value.fixtureOnly}`,
    `Methods: ${value.methods.join(", ")}`,
    `Strategies: ${value.strategies.join(", ")}`,
    `Shard: ${value.queryShard.startIndex}-${value.queryShard.endIndexExclusive ?? "end"}`,
    `Same raw query selection: ${value.queryShard.sameRawQuerySelectionAcrossMethods}`,
    "",
    "## Best Baseline",
    armMarkdown(value.bestBaseline),
    "",
    "## Best Challenger",
    armMarkdown(value.bestChallenger),
    "",
    "## Comparison",
    `- Hit-rate lift: ${value.comparison.hitRateLift}`,
    value.comparison.paired
      ? `- Paired outcomes: both hit ${value.comparison.paired.bothHit}, baseline-only ${value.comparison.paired.baselineOnlyHit}, challenger-only ${value.comparison.paired.challengerOnlyHit}, both miss ${value.comparison.paired.bothMiss}`
      : "- Paired outcomes: unavailable",
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function armMarkdown(arm) {
  if (!arm) return "- unavailable";
  return [
    `- Method: ${arm.method}`,
    `- Strategy: ${arm.strategy}`,
    `- Hit rate: ${arm.hitRate}`,
    `- Hit queries: ${arm.hitQueryCount}/${arm.queryCount}`,
    `- MRR: ${arm.meanReciprocalRank}`,
    `- Rank buckets: rank1 ${arm.rankBuckets.rank1}, rank2-5 ${arm.rankBuckets.rank2to5}, miss ${arm.rankBuckets.miss}`,
  ].join("\n");
}

function runNode(commandArgs, env = {}) {
  const child = spawnSync("node", commandArgs, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(
      [
        `command failed: node ${commandArgs[0]}`,
        child.stdout ? `stdout:\n${child.stdout.slice(-4000)}` : null,
        child.stderr ? `stderr:\n${child.stderr.slice(-4000)}` : null,
      ].filter(Boolean).join("\n"),
    );
  }
}

function loadJson(path, label) {
  assert.ok(path && existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, privateTagPattern, `${label} contains private tags`);
  assert.doesNotMatch(text, /\b(question|answer|content|memory|transcript|prompt|rawText)"\s*:/i, `${label} contains raw text fields`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      parsed[camelCaseFlag(arg.slice(2, eq))] = arg.slice(eq + 1);
      continue;
    }
    const key = camelCaseFlag(arg.slice(2));
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function camelCaseFlag(value) {
  return String(value).replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}

function resolveInputPath(input) {
  if (!input) return null;
  const value = String(input);
  return value.startsWith("/") ? value : resolve(root, value);
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "") return null;
  return positiveInt(value, label);
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "") return 0;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer`);
  return number;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueOrNull(values) {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 1 ? unique[0] : null;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function shortHash(value) {
  return `sha256:${sha256(String(value)).slice(0, 16)}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function displayPath(path) {
  return basename(String(path ?? ""));
}
