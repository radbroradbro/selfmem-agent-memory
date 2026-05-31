import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.live;
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_STRATEGY_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_STRATEGY_MARKDOWN ?? null;
const gate = normalizeGate(args.gate ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_GATE ?? "strategy");
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_STRATEGIES ?? defaultStrategies(gate));
const allowSoloSmoke = Boolean(args.allowSoloSmoke) || process.env.RECALLWEAVE_ALLOW_SOLO_BENCHMARK_SMOKE === "1";
const allowPartial = Boolean(args.allowPartial) || process.env.RECALLWEAVE_PUBLIC_BENCHMARK_ALLOW_PARTIAL === "1";
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? 1600, "context token budget");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 10, "limit");
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_MAX_QUERIES ?? null, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_BASELINE_QUERY_OFFSET ?? 0, "query offset");
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 300_000_000, "max memory bytes");
const armTimeoutMs = optionalPositiveInt(args.armTimeoutMs ?? process.env.RECALLWEAVE_BENCHMARK_ARM_TIMEOUT_MS ?? null, "arm timeout") ?? 0;
const providerArmTimeoutMs = optionalPositiveInt(args.providerArmTimeoutMs ?? process.env.RECALLWEAVE_PROVIDER_ARM_TIMEOUT_MS ?? null, "provider arm timeout") ?? 0;
const providerTimeoutMs =
  optionalPositiveInt(args.providerTimeoutMs ?? process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? null, "provider timeout") ??
  (!fixtureRequested && gate === "provider" ? 45_000 : 0);
const providerRetryAttempts =
  optionalPositiveInt(args.providerRetryAttempts ?? process.env.RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS ?? null, "provider retry attempts") ??
  (!fixtureRequested && gate === "provider" ? 2 : 0);
const parallelArms = optionalPositiveInt(args.parallelArms ?? process.env.RECALLWEAVE_BENCHMARK_PARALLEL_ARMS ?? null, "parallel arms") ?? 1;
const reuseControlReportPaths = splitList(args.reuseControlReport ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_REUSE_CONTROL_REPORT ?? "").map(resolveInputPath);
const isolateArms =
  Boolean(args.isolateArms) || process.env.RECALLWEAVE_BENCHMARK_ISOLATE_ARMS === "1" || (!fixtureRequested && gate === "provider" && process.env.RECALLWEAVE_BENCHMARK_ISOLATE_ARMS !== "0");

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
const privatePathOutputPattern =
  /(\/Users\/[^\s"'`]+|\/Volumes\/[^\s"'`]+|\/private\/[^\s"'`]+|\/var\/folders\/[^\s"'`]+|\/tmp\/[^\s"'`]+|\/home\/[^\s"'`]+|[A-Za-z]:\\Users\\[^\s"'`]+|\.hermes\/profiles[^\s"'`]*|\.openclaw[^\s"'`]*)/gi;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

if (args.promotionGateSmoke === true) {
  runPromotionGateSmoke();
  process.exit(0);
}

for (const strategy of strategies) assert.ok(retrievalStrategies.includes(strategy), `unknown strategy: ${strategy}`);
assertGateContract(gate, strategies, { allowSoloSmoke });

const runRoot = mkdtempSync(resolve(tmpdir(), "recallweave-strategy-compare-"));
const input = fixtureRequested ? fixtureInput() : await liveInput(runRoot);
const reusableControls = loadReusableControls(input, reuseControlReportPaths);
const results = [];
const failedStrategies = [];
const reusedControls = [];

const armOutcomes = await mapLimit(strategies, parallelArms, runStrategyArm);
for (const outcome of armOutcomes) {
  if (outcome.result) results.push(outcome.result);
  if (outcome.failure) failedStrategies.push(outcome.failure);
  if (outcome.reusedControl) reusedControls.push(outcome.reusedControl);
}

async function runStrategyArm(strategy) {
  const reused = reusableControls.get(strategy);
  if (reused) return { result: reused.result, reusedControl: reused.summary };

  const responsePath = resolve(runRoot, `${strategy}-responses.json`);
  const resultPath = resolve(runRoot, `${strategy}-result.json`);
  const effectiveArmTimeoutMs = armTimeoutForStrategy(strategy);
  const armContext = armRunContext(strategy, runRoot, effectiveArmTimeoutMs);
  const exportArgs = [
    "packages/bench/recallweave-response-export.mjs",
    ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath, "--memories", input.memoriesPath, "--preserve-ids"]),
    "--strategy",
    strategy,
    "--context-token-budget",
    String(contextTokenBudget),
    "--limit",
    String(limit),
    ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
    ...(queryOffset ? ["--query-offset", String(queryOffset)] : []),
    "--output",
    responsePath,
  ];
  const collectArgs = [
    "packages/bench/recallweave-baseline-collector.mjs",
    ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath]),
    "--responses",
    responsePath,
    "--retrieval-mode",
    `strategy:${strategy}`,
    ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
    ...(queryOffset ? ["--query-offset", String(queryOffset)] : []),
    "--output",
    resultPath,
  ];
  try {
    await runNodeAsync(exportArgs, { live: !fixtureRequested, env: armContext.env, timeoutMs: effectiveArmTimeoutMs });
    await runNodeAsync(collectArgs, {
      live: !fixtureRequested,
      env: {
        ...armContext.env,
        RECALLWEAVE_BASELINE_JUDGE_MODEL: input.judgeModel,
        RECALLWEAVE_BASELINE_ANSWER_MODEL: input.answerModel,
      },
      timeoutMs: effectiveArmTimeoutMs,
    });
    const response = JSON.parse(readFileSync(responsePath, "utf8"));
    const result = JSON.parse(readFileSync(resultPath, "utf8"));
    assert.equal(result.retrievalProxyOnly, true);
    assert.equal(result.memoryBenchAnswerQuality, false);
    assert.equal(result.publicBenchmarkClaimsAllowed, false);
    assert.equal(result.privacyLeakCount, 0);
    assert.equal(result.redactionFailureCount, 0);
    if (response.queryShard?.selectedQueryIdHash) {
      assert.equal(result.querySelection?.selectedQueryIdHash, response.queryShard.selectedQueryIdHash, "scored query shard must match exported query shard");
      assert.equal(result.queryCount, response.queryShard.responseCount, "scored query count must match exported response count");
    }
    return { result: {
      strategy,
      querySetHash: result.querySetHash,
      responsesHash: `sha256:${fileHash(responsePath)}`,
      resultHash: `sha256:${fileHash(resultPath)}`,
      rankingStrategy: response.source?.rankingStrategy ?? null,
      provider: response.source?.provider ?? null,
      armIsolation: armContext.summary,
      queryShard: response.queryShard ?? null,
      metrics: result.metrics,
      contextBudget: result.retrievalConfig?.contextBudget ?? null,
      privacyLeakCount: result.privacyLeakCount,
      redactionFailureCount: result.redactionFailureCount,
      resultFingerprints: (result.resultFingerprints ?? []).map((item) => ({
        queryIdHash: item.queryIdHash,
        topResultIdHash: item.topResultIdHash,
        pAt1: item.pAt1,
        recallAt5: item.recallAt5,
        recallAt10: item.recallAt10,
        ndcgAt10: item.ndcgAt10,
      })),
    } };
  } catch (error) {
    if (!allowPartial) throw error;
    return { failure: strategyFailureSummary(strategy, error) };
  }
}

assert.ok(results.length > 0 || failedStrategies.length > 0, "strategy comparison produced no completed or failed arms");
const querySetHashes = new Set(results.map((item) => item.querySetHash));
if (results.length > 0) assert.equal(querySetHashes.size, 1, "all strategies must use the same query set");
if (results.length > 0 && input.collectorCompatibleQuerySetHash) {
  assert.equal(results[0].querySetHash, input.collectorCompatibleQuerySetHash, "strategy run must bind to materialized query set");
}

const promotion = promotionDecision(gate, results);
const status = results.length === 0 ? "FAILED_ALL_ARMS" : failedStrategies.length === 0 ? "COMPLETED" : "PARTIAL_COMPLETED_WITH_ARM_FAILURES";
const report = {
  schemaVersion: 1,
  ok: failedStrategies.length === 0,
  status,
  mode: gate === "provider" ? "public-benchmark-provider-gate" : gate === "hybrid" ? "public-benchmark-hybrid-gate" : "public-benchmark-strategy-compare",
  gate,
  fixtureOnly: fixtureRequested,
  benchmark: input.benchmark,
  metricsOnly: true,
  retrievalProxyOnly: true,
  memoryBenchAnswerQuality: false,
  publicBenchmarkClaimsAllowed: false,
  comparisonContract: comparisonContract(gate, strategies, { allowSoloSmoke }),
  publicSafe: true,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  partialResultsAllowed: allowPartial,
  generatedAt: new Date().toISOString(),
  input: {
    source: input.source,
    datasetSlice: input.datasetSlice,
    querySetHash: results[0]?.querySetHash ?? input.collectorCompatibleQuerySetHash ?? null,
    collectorCompatibleQuerySetHash: input.collectorCompatibleQuerySetHash ?? null,
    materializerHash: input.materializerHash ?? null,
    queryCount: input.queryCount,
    expectedResultRefCount: input.expectedResultRefCount,
    haystackSessionCount: input.haystackSessionCount,
    requestedQuerySelection: {
      queryOffset,
      maxQueries,
      completeDataset: queryOffset === 0 && !maxQueries,
    },
    selectedQueryCount: results[0]?.queryShard?.responseCount ?? null,
    armTimeoutMs,
    providerArmTimeoutMs,
    providerTimeoutMs,
    providerRetryAttempts,
    parallelArms,
    isolateArms,
    controlReuse: {
      enabled: reuseControlReportPaths.length > 0,
      requestedReportCount: reuseControlReportPaths.length,
      reusedStrategyCount: reusedControls.length,
      reusedStrategies: reusedControls.map((item) => item.strategy),
    },
  },
  reusedControls,
  strategies: results,
  failedStrategies,
  winner: bestStrategy(results),
  control: summarizeNamedStrategy(results, "bm25-lite"),
  promotion,
  hybridPromotion: promotion,
  safety: {
    publicSafe: true,
    metricsOnly: true,
    privateInputsStoredOutsideRepository: true,
    printsCredentials: false,
  },
  nextActions:
    gate === "provider"
      ? [
          "Keep provider-backed arms opt-in until the operator sets provider-call and public-data environment guards.",
          "Compare Voyage, Gemini, NVIDIA, and local Apple Silicon provider arms against bm25-lite on the same source-locked data before any default promotion.",
          "Do not turn provider-backed retrieval-proxy metrics into MemoryBench answer-quality claims.",
        ]
      : gate === "hybrid"
      ? [
          "Keep bm25-lite as the lexical control unless a hybrid arm beats it on quality or ties quality with a meaningful operational gain.",
          "Use the winning hybrid-family arm only as retrieval-proxy methodology evidence until MemoryBench answer-quality is run.",
          "Run a larger source-locked LongMemEval or MemoryBench slice before any public SOTA or leaderboard language.",
        ]
      : [
          "Keep the winning retrieval-proxy strategy only if reviewer approves it as a methodology change.",
          "Use this report to choose the next embedding, reranker, temporal, or query-expansion autoresearch arm.",
          "Do not turn retrieval-proxy metrics into MemoryBench answer-quality claims.",
        ],
};

const serialized = format === "markdown" ? `${renderMarkdown(report)}\n` : `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "strategy comparison report");
if (outputPath) writePublicOutput(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (markdownOutputPath) writePublicOutput(markdownOutputPath, `${renderMarkdown(report)}\n`);
process.stdout.write(serialized);

function fixtureInput() {
  const querySetPath = resolve(root, "packages/bench/fixtures/hosted-baseline-queryset.fixture.json");
  const querySet = JSON.parse(readFileSync(querySetPath, "utf8"));
  const queries = Array.isArray(querySet.queries) ? querySet.queries : [];
  return {
    benchmark: "longmemeval",
    source: "fixture",
    datasetSlice: "fixture-memory-canary-slice",
    querySetPath,
    memoriesPath: resolve(root, "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl"),
    judgeModel: "fixture-judge",
    answerModel: "fixture-answer",
    queryCount: queries.length,
    expectedResultRefCount: queries.reduce((sum, query) => sum + arrayLength(query.expectedResultIds) + arrayLength(query.expectedResultHashes), 0),
    haystackSessionCount: 6,
    collectorCompatibleQuerySetHash: collectorCompatibleQuerySetHash(querySet),
  };
}

async function liveInput(runRootPath) {
  const querySetPath = resolveInputPath(args.queryset ?? args.querySet ?? process.env.RECALLWEAVE_BASELINE_QUERYSET ?? null);
  const memoriesPath = resolveInputPath(args.memories ?? args.memoriesJsonl ?? process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ?? null);
  if (querySetPath && memoriesPath) return inputFromPrivateFiles(querySetPath, memoriesPath, null);

  const target = resolveInputPath(args.target ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ?? "reviews/overnight-20260522/public-longmemeval-full-run-target.json");
  const materializerReportPath = resolve(runRootPath, "materialize-report.json");
  runNode([
    "packages/bench/public-benchmark-materialize-run.mjs",
    "--live",
    "--target",
    target,
    "--private-output-dir",
    runRootPath,
    "--output",
    materializerReportPath,
  ]);
  const materializer = JSON.parse(readFileSync(materializerReportPath, "utf8"));
  return inputFromPrivateFiles(
    resolve(runRootPath, "longmemeval-queryset.private.json"),
    resolve(runRootPath, "longmemeval-memories.private.jsonl"),
    materializer,
  );
}

function inputFromPrivateFiles(querySetPath, memoriesPath, materializer) {
  assert.ok(existsSync(querySetPath), `query set missing: ${displayPath(querySetPath)}`);
  assert.ok(existsSync(memoriesPath), `memories file missing: ${displayPath(memoriesPath)}`);
  assert.ok(statSync(querySetPath).size > 0, "query set is empty");
  assert.ok(statSync(memoriesPath).size > 0, "memories file is empty");
  assertOutsideRepo(querySetPath, "live query set");
  assertOutsideRepo(memoriesPath, "live memories file");
  const querySet = JSON.parse(readFileSync(querySetPath, "utf8"));
  const queries = Array.isArray(querySet.queries) ? querySet.queries : [];
  const expectedResultRefCount = queries.reduce(
    (sum, query) => sum + arrayLength(query.expectedResultIds) + arrayLength(query.expectedResultHashes),
    0,
  );
  return {
    benchmark: "longmemeval",
    source: materializer ? "materialized-source-locked-longmemeval" : "private-input-files",
    datasetSlice: String(querySet.datasetSlice ?? "private-longmemeval-slice"),
    querySetPath,
    memoriesPath,
    judgeModel: String(querySet.judgeModel ?? args.judgeModel ?? "gpt-4o"),
    answerModel: String(querySet.answerModel ?? args.answerModel ?? "gpt-4o"),
    queryCount: queries.length,
    expectedResultRefCount,
    haystackSessionCount: materializer?.selection?.haystackSessionCount ?? lineCount(memoriesPath),
    collectorCompatibleQuerySetHash: materializer?.selection?.collectorCompatibleQuerySetHash ?? collectorCompatibleQuerySetHash(querySet),
    materializerHash: materializer ? `sha256:${stableHash(JSON.stringify(materializer))}` : null,
  };
}

function collectorCompatibleQuerySetHash(querySet) {
  return `sha256:${stableHash(JSON.stringify({
    schemaVersion: querySet.schemaVersion ?? 1,
    datasetSlice: querySet.datasetSlice ?? null,
    queries: (querySet.queries ?? []).map((query) => ({
      id: query.id,
      q: query.q,
      expectedResultIds: query.expectedResultIds ?? [],
      expectedResultHashes: query.expectedResultHashes ?? [],
    })),
  }))}`;
}

function loadReusableControls(currentInput, paths) {
  const reusable = new Map();
  for (const path of paths) {
    assert.ok(path, "reuse control report path is required");
    assert.ok(existsSync(path), `reuse control report missing: ${displayPath(path)}`);
    assert.ok(statSync(path).isFile(), `reuse control report must be a file: ${displayPath(path)}`);
    const reportText = readFileSync(path, "utf8");
    assertSafePublicText(reportText, "reuse control report");
    const report = JSON.parse(reportText);
    assertReusableReportContract(report, currentInput, path);
    for (const item of report.strategies ?? []) {
      if (!isReusableControlStrategy(item?.strategy)) continue;
      if (!strategies.includes(item.strategy)) continue;
      assertReusableControlResult(item, currentInput, report, path);
      if (!reusable.has(item.strategy)) {
        reusable.set(item.strategy, {
          result: {
            ...item,
            reusedControl: true,
            reuse: {
              sourceReportHash: `sha256:${stableHash(reportText)}`,
              sourceReportPath: displayPath(path),
              sourceGeneratedAt: report.generatedAt ?? null,
            },
          },
          summary: {
            strategy: item.strategy,
            sourceReportHash: `sha256:${stableHash(reportText)}`,
            sourceReportPath: displayPath(path),
            sourceGeneratedAt: report.generatedAt ?? null,
            queryShard: item.queryShard ?? null,
          },
        });
      }
    }
  }
  return reusable;
}

function assertReusableReportContract(report, currentInput, path) {
  assert.equal(report.metricsOnly, true, `reuse control report must be metrics-only: ${displayPath(path)}`);
  assert.equal(report.retrievalProxyOnly, true, `reuse control report must be retrieval-proxy only: ${displayPath(path)}`);
  assert.equal(report.memoryBenchAnswerQuality, false, `reuse control report must not be answer-quality evidence: ${displayPath(path)}`);
  assert.equal(report.publicBenchmarkClaimsAllowed, false, `reuse control report must not allow public claims: ${displayPath(path)}`);
  assert.equal(report.publicSafe, true, `reuse control report must be public safe: ${displayPath(path)}`);
  assert.equal(report.rawQuestionsIncluded, false, `reuse control report must not include raw questions: ${displayPath(path)}`);
  assert.equal(report.rawAnswersIncluded, false, `reuse control report must not include raw answers: ${displayPath(path)}`);
  assert.equal(report.rawMemoryIncluded, false, `reuse control report must not include raw memory: ${displayPath(path)}`);
  assert.equal(report.rawTranscriptIncluded, false, `reuse control report must not include raw transcript: ${displayPath(path)}`);
  assert.equal(report.rawPrivateOutputPathIncluded, false, `reuse control report must not include private output paths: ${displayPath(path)}`);
  assert.equal(report.fixtureOnly, fixtureRequested, `reuse control report fixture/live mode must match: ${displayPath(path)}`);
  assert.equal(report.benchmark, currentInput.benchmark, `reuse control report benchmark must match: ${displayPath(path)}`);
  const reportQuerySetHash = report.input?.querySetHash ?? report.input?.collectorCompatibleQuerySetHash ?? null;
  const currentQuerySetHash = currentInput.collectorCompatibleQuerySetHash ?? null;
  assert.ok(currentQuerySetHash, `current input query-set hash missing: ${displayPath(path)}`);
  assert.ok(reportQuerySetHash, `reuse control report query-set hash missing: ${displayPath(path)}`);
  assert.equal(reportQuerySetHash, currentQuerySetHash, `reuse control report query-set hash must match: ${displayPath(path)}`);
  assert.equal(Number(report.input?.queryCount ?? 0), currentInput.queryCount, `reuse control report query count must match: ${displayPath(path)}`);
}

function assertReusableControlResult(item, currentInput, report, path) {
  assert.ok(item && typeof item === "object", `reuse control result must be an object: ${displayPath(path)}`);
  assert.ok(isReusableControlStrategy(item.strategy), `cannot reuse non-control strategy: ${item.strategy}`);
  assert.equal(item.privacyLeakCount, 0, `reuse control result must have zero privacy leaks: ${item.strategy}`);
  assert.equal(item.redactionFailureCount, 0, `reuse control result must have zero redaction failures: ${item.strategy}`);
  assert.equal(item.querySetHash, report.input?.querySetHash ?? report.input?.collectorCompatibleQuerySetHash, `reuse control query-set hash must match report: ${item.strategy}`);
  const shard = item.queryShard ?? {};
  assert.equal(shard.totalQueryCount, currentInput.queryCount, `reuse control shard total must match current input: ${item.strategy}`);
  assert.equal(shard.startIndex, queryOffset, `reuse control shard offset must match: ${item.strategy}`);
  const selectedQueryCount = Number(report.input?.selectedQueryCount ?? 0);
  assert.ok(selectedQueryCount > 0, `reuse control selected query count missing: ${item.strategy}`);
  assert.equal(shard.responseCount, selectedQueryCount, `reuse control selected query count must match source report: ${item.strategy}`);
  assert.ok(shard.selectedQueryIdHash, `reuse control selected query hash missing: ${item.strategy}`);
  const requested = report.input?.requestedQuerySelection ?? {};
  assert.equal(requested.queryOffset, queryOffset, `reuse control report requested offset must match: ${item.strategy}`);
  assert.equal(requested.maxQueries ?? null, maxQueries ?? null, `reuse control report requested max queries must match: ${item.strategy}`);
  assert.equal(item.contextBudget?.applied, true, `reuse control must include an applied context budget: ${item.strategy}`);
  assert.equal(item.contextBudget?.tokenBudget, contextTokenBudget, `reuse control context budget must match: ${item.strategy}`);
  assertSafePublicText(JSON.stringify(item), `reuse control result ${item.strategy}`);
}

function isReusableControlStrategy(strategy) {
  return strategy === "bm25-lite" || strategy === "full-hybrid-rerank";
}

function bestStrategy(items) {
  const sorted = [...items].sort((left, right) => {
    const qualityDelta = Number(right.metrics?.quality ?? 0) - Number(left.metrics?.quality ?? 0);
    if (qualityDelta !== 0) return qualityDelta;
    return Number(left.metrics?.latencyP50Ms ?? Infinity) - Number(right.metrics?.latencyP50Ms ?? Infinity);
  });
  const best = sorted[0] ?? null;
  return best
    ? {
        strategy: best.strategy,
        quality: best.metrics.quality,
        pAt1: best.metrics.pAt1,
        recallAt5: best.metrics.recallAt5,
        recallAt10: best.metrics.recallAt10,
        ndcgAt10: best.metrics.ndcgAt10,
        latencyP50Ms: best.metrics.latencyP50Ms,
      }
    : null;
}

function summarizeNamedStrategy(items, strategy) {
  const found = items.find((item) => item.strategy === strategy) ?? null;
  return found
    ? {
        strategy: found.strategy,
        quality: found.metrics.quality,
        pAt1: found.metrics.pAt1,
        recallAt5: found.metrics.recallAt5,
        recallAt10: found.metrics.recallAt10,
        ndcgAt10: found.metrics.ndcgAt10,
        latencyP50Ms: found.metrics.latencyP50Ms,
      }
    : null;
}

function hybridPromotionDecision(items) {
  const control = items.find((item) => item.strategy === "bm25-lite") ?? null;
  const hybridItems = items.filter((item) => isHybridFamilyStrategy(item.strategy));
  const bestHybrid = bestStrategy(hybridItems);
  if (!control || !bestHybrid) {
    return {
      kind: "hybrid",
      promoteHybrid: false,
      reason: "Missing bm25-lite control or hybrid-family candidate.",
    };
  }
  const controlQuality = Number(control.metrics?.quality ?? 0);
  const hybridQuality = Number(bestHybrid.quality ?? 0);
  const controlLatency = Number(control.metrics?.latencyP50Ms ?? Infinity);
  const hybridLatency = Number(bestHybrid.latencyP50Ms ?? Infinity);
  const qualityBeats = hybridQuality > controlQuality;
  const qualityTies = hybridQuality === controlQuality;
  const latencyImproves = hybridLatency <= controlLatency * 0.85;
  const pairedDeltaVsBm25 = pairedQualityDelta(hybridItems.find((item) => item.strategy === bestHybrid.strategy), control);
  return {
    kind: "hybrid",
    bestHybridStrategy: bestHybrid.strategy,
    promoteHybrid: qualityBeats || (qualityTies && latencyImproves),
    reason: qualityBeats
      ? "Best hybrid-family arm beats bm25-lite on retrieval-proxy quality."
      : qualityTies && latencyImproves
        ? "Best hybrid-family arm ties quality and improves p50 latency by at least 15%."
        : "Keep bm25-lite as control/fallback; hybrid-family arm has not earned promotion on this slice.",
    qualityDeltaVsBm25: round(hybridQuality - controlQuality),
    latencyDeltaVsBm25: round(hybridLatency - controlLatency),
    pairedDeltaVsBm25,
  };
}

function providerPromotionDecision(items) {
  const control = items.find((item) => item.strategy === "bm25-lite") ?? null;
  const fullHybridControl = items.find((item) => item.strategy === "full-hybrid-rerank") ?? null;
  const providerItems = items.filter((item) => isProviderBackedStrategy(item.strategy));
  const bestProvider = bestStrategy(providerItems);
  if (!control || !fullHybridControl || !bestProvider) {
    return {
      kind: "provider",
      promoteProvider: false,
      promoteHybrid: false,
      reason: "Missing bm25-lite control, full-hybrid-rerank control, or provider-backed arm.",
    };
  }
  const controlQuality = Number(control.metrics?.quality ?? 0);
  const fullHybridQuality = Number(fullHybridControl.metrics?.quality ?? 0);
  const providerQuality = Number(bestProvider.quality ?? 0);
  const controlLatency = Number(control.metrics?.latencyP50Ms ?? Infinity);
  const fullHybridLatency = Number(fullHybridControl.metrics?.latencyP50Ms ?? Infinity);
  const providerLatency = Number(bestProvider.latencyP50Ms ?? Infinity);
  const qualityFloor = Math.max(controlQuality, fullHybridQuality);
  const latencyFloor = Math.min(controlLatency, fullHybridLatency);
  const qualityBeatsBothControls = providerQuality > qualityFloor;
  const qualityTiesBothControls = providerQuality === qualityFloor;
  const latencyImproves = providerLatency <= latencyFloor * 0.85;
  const promoteProvider = qualityBeatsBothControls || (qualityTiesBothControls && latencyImproves);
  const bestProviderItem = providerItems.find((item) => item.strategy === bestProvider.strategy) ?? null;
  const pairedDeltaVsBm25 = pairedQualityDelta(bestProviderItem, control);
  const pairedDeltaVsFullHybrid = pairedQualityDelta(bestProviderItem, fullHybridControl);
  return {
    kind: "provider",
    bestProviderStrategy: bestProvider.strategy,
    bestHybridStrategy: fullHybridControl.strategy,
    promoteProvider,
    promoteHybrid: promoteProvider,
    reason: qualityBeatsBothControls
      ? "Best provider-backed arm beats both bm25-lite and full-hybrid-rerank on retrieval-proxy quality."
      : qualityTiesBothControls && latencyImproves
        ? "Best provider-backed arm ties the strongest control and improves p50 latency by at least 15%."
        : "Keep bm25-lite and full-hybrid-rerank as controls; provider-backed arm has not earned promotion on this slice.",
    qualityDeltaVsBm25: round(providerQuality - controlQuality),
    qualityDeltaVsFullHybrid: round(providerQuality - fullHybridQuality),
    latencyDeltaVsBm25: round(providerLatency - controlLatency),
    latencyDeltaVsFullHybrid: round(providerLatency - fullHybridLatency),
    pairedDeltaVsBm25,
    pairedDeltaVsFullHybrid,
  };
}

function pairedQualityDelta(candidate, control) {
  if (!candidate || !control) return null;
  const controlByQuery = new Map((control.resultFingerprints ?? []).map((item) => [item.queryIdHash, item]));
  const diffs = [];
  for (const item of candidate.resultFingerprints ?? []) {
    const controlItem = controlByQuery.get(item.queryIdHash);
    if (!controlItem) continue;
    diffs.push(queryFingerprintQuality(item) - queryFingerprintQuality(controlItem));
  }
  if (diffs.length === 0) {
    return {
      candidateStrategy: candidate.strategy,
      controlStrategy: control.strategy,
      pairedQueryCount: 0,
      mean: null,
      ci95: null,
      ciExcludesZero: false,
    };
  }
  const mean = average(diffs);
  const ci95 = bootstrapMeanCi(diffs, `${candidate.strategy}:${control.strategy}:${diffs.length}`);
  return {
    candidateStrategy: candidate.strategy,
    controlStrategy: control.strategy,
    pairedQueryCount: diffs.length,
    mean: round(mean),
    ci95,
    ciExcludesZero: Boolean(ci95 && (ci95.lower > 0 || ci95.upper < 0)),
  };
}

function queryFingerprintQuality(item) {
  return (
    Number(item?.pAt1 ?? 0) +
    Number(item?.recallAt5 ?? 0) +
    Number(item?.recallAt10 ?? 0) +
    Number(item?.ndcgAt10 ?? 0)
  ) / 4;
}

function bootstrapMeanCi(values, seedText, iterations = 500) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (clean.length === 0) return null;
  if (clean.length === 1) return { lower: round(clean[0]), upper: round(clean[0]), iterations: 0 };
  const random = seededRandom(seedText);
  const means = [];
  for (let index = 0; index < iterations; index += 1) {
    let sum = 0;
    for (let draw = 0; draw < clean.length; draw += 1) {
      sum += clean[Math.floor(random() * clean.length)];
    }
    means.push(sum / clean.length);
  }
  means.sort((left, right) => left - right);
  return {
    lower: round(means[Math.floor((iterations - 1) * 0.025)]),
    upper: round(means[Math.ceil((iterations - 1) * 0.975)]),
    iterations,
  };
}

function seededRandom(seedText) {
  let state = Number.parseInt(stableHash(seedText).slice(0, 8), 16) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function promotionDecision(value, items) {
  if (value === "provider") return providerPromotionDecision(items);
  return hybridPromotionDecision(items);
}

function runPromotionGateSmoke() {
  const providerDecision = providerPromotionDecision([
    promotionSmokeItem("bm25-lite", [0.45, 0.45, 0.45], 4),
    promotionSmokeItem("full-hybrid-rerank", [0.5, 0.5, 0.5], 5),
    promotionSmokeItem("cloud-voyage4-lite-voyage-lite", [0.8, 0.75, 0.7], 6),
  ]);
  assert.equal(providerDecision.bestProviderStrategy, "cloud-voyage4-lite-voyage-lite");
  assert.equal(providerDecision.bestHybridStrategy, "full-hybrid-rerank");
  assert.equal(providerDecision.pairedDeltaVsBm25?.pairedQueryCount, 3);
  assert.equal(providerDecision.pairedDeltaVsFullHybrid?.pairedQueryCount, 3);
  assert.ok(providerDecision.pairedDeltaVsBm25?.ci95?.lower > 0);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      mode: "promotion-gate-smoke",
      providerBestHybridStrategyTracksControl: true,
      pairedDeltasPresent: true,
      bootstrapCiPresent: true,
    })}\n`,
  );
}

function promotionSmokeItem(strategy, qualities, latencyP50Ms) {
  const averageQuality = average(qualities);
  return {
    strategy,
    metrics: {
      quality: round(averageQuality),
      pAt1: round(averageQuality),
      recallAt5: round(averageQuality),
      recallAt10: round(averageQuality),
      ndcgAt10: round(averageQuality),
      latencyP50Ms,
    },
    resultFingerprints: qualities.map((quality, index) => ({
      queryIdHash: `query-${index}`,
      pAt1: quality,
      recallAt5: quality,
      recallAt10: quality,
      ndcgAt10: quality,
    })),
  };
}

function renderMarkdown(value) {
  const promotionLabel = value.gate === "provider" ? "Provider arm beats control" : "Hybrid promotion";
  const decisionLabel = value.gate === "provider" ? "Provider arm decision" : "Hybrid decision";
  const decision = value.promotion ?? value.hybridPromotion;
  const decisionReason = decision.reason;
  const lines = [
    "# Public Benchmark Strategy Compare",
    "",
    `- OK: ${value.ok}`,
    `- Status: ${value.status}`,
    `- Gate: ${value.gate}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Benchmark: ${value.benchmark}`,
    `- Retrieval proxy only: ${value.retrievalProxyOnly}`,
    `- MemoryBench answer quality: ${value.memoryBenchAnswerQuality}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Partial results allowed: ${value.partialResultsAllowed}`,
    `- Solo smoke only: ${value.comparisonContract.soloRunsAreSmokeOnly}`,
    `- Same-data controls required: ${value.comparisonContract.sameDataControlsRequired}`,
    `- Query set hash: ${value.input.querySetHash}`,
    `- Query count: ${value.input.queryCount}`,
    `- Selected query count: ${value.input.selectedQueryCount ?? "unknown"}`,
    `- Reused control strategies: ${value.input.controlReuse.reusedStrategies.length ? value.input.controlReuse.reusedStrategies.join(", ") : "none"}`,
    `- Expected result refs: ${value.input.expectedResultRefCount}`,
    `- Winner: ${value.winner?.strategy ?? "none"}`,
    `- ${promotionLabel}: ${value.gate === "provider" ? Boolean(decision.promoteProvider) : Boolean(decision.promoteHybrid)}`,
    `- ${decisionLabel}: ${decisionReason}`,
    "",
    "## Strategies",
    "",
    "| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...value.strategies.map((item) =>
      `| ${item.strategy} | ${item.provider?.modelArm ?? "none"} | ${item.metrics.quality} | ${item.metrics.pAt1} | ${item.metrics.recallAt5} | ${item.metrics.recallAt10} | ${item.metrics.ndcgAt10} | ${item.metrics.latencyP50Ms} |`,
    ),
    "",
  ];
  if (value.reusedControls.length) {
    lines.push(
      "## Reused Controls",
      "",
      "| Strategy | Source report | Source report hash |",
      "| --- | --- | --- |",
      ...value.reusedControls.map((item) => `| ${item.strategy} | ${item.sourceReportPath} | ${item.sourceReportHash} |`),
      "",
    );
  }
  if (value.failedStrategies.length) {
    lines.push(
      "## Failed Arms",
      "",
      "| Strategy | Failure class | Retryable/provider limit |",
      "| --- | --- | ---: |",
      ...value.failedStrategies.map((item) => `| ${item.strategy} | ${item.failureClass} | ${item.retryableProviderLimit} |`),
      "",
    );
  }
  lines.push(
    "## Safety",
    "",
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Raw transcript included: ${value.rawTranscriptIncluded}`,
    `- Private output path included: ${value.rawPrivateOutputPathIncluded}`,
  );
  return lines.join("\n");
}

function defaultStrategies(value) {
  if (value === "provider") {
    return [
      "bm25-lite",
      "full-hybrid-rerank",
      "cloud-voyage-rerank-only",
      "cloud-voyage4-voyage",
      "cloud-voyage4-voyage-lite-rerank",
      "cloud-voyage4-lite-voyage-lite",
      "cloud-gemini-embed-rerank-proxy",
      "cloud-gemini-voyage-rerank",
      "cloud-gemini2-embed-rerank-proxy",
      "cloud-gemini2-voyage-rerank",
      "cloud-nvidia-nv-embed-v1-mistral-rerank",
      "cloud-nvidia-embedcode-7b-mistral-rerank",
      "local-apple-qwen3-0_6b",
    ].join(",");
  }
  if (value === "hybrid") {
    return [
      "bm25-lite",
      "dense-proxy",
      "sparse-dense-rrf",
      "sparse-dense-temporal",
      "sparse-dense-graph-temporal",
      "full-hybrid-rerank",
      "query-expanded-full-hybrid-rerank",
      "wiki-title-amplified-hybrid",
      "wiki-subtopic-amplified-hybrid",
      "wiki-summary-session-hybrid",
    ].join(",");
  }
  return "jaccard,bm25-lite,hybrid-v1";
}

function assertGateContract(value, strategyNames, options = {}) {
  const strategySet = new Set(strategyNames);
  if (options.allowSoloSmoke) return;
  assert.ok(strategyNames.length >= 2, "benchmark comparison must include at least two arms; use --allow-solo-smoke only for wiring tests");
  assert.ok(strategySet.has("bm25-lite"), "benchmark comparison must include bm25-lite as the same-data lexical control");
  if (value === "hybrid") {
    assert.ok(
      strategyNames.some((strategy) => isHybridFamilyStrategy(strategy)),
      "hybrid gate must include at least one hybrid-family candidate",
    );
  }
  if (value === "provider") {
    assert.ok(strategySet.has("full-hybrid-rerank"), "provider gate must include full-hybrid-rerank as the same-data hybrid control");
    assert.ok(
      strategyNames.some((strategy) => isProviderBackedStrategy(strategy)),
      "provider gate must include at least one provider-backed arm",
    );
  }
}

function comparisonContract(value, strategyNames, options = {}) {
  const strategySet = new Set(strategyNames);
  const includesHybridFamily = strategyNames.some((strategy) => isHybridFamilyStrategy(strategy));
  const includesProviderBacked = strategyNames.some((strategy) => isProviderBackedStrategy(strategy));
  return {
    soloRunsAreSmokeOnly: true,
    allowSoloSmoke: Boolean(options.allowSoloSmoke),
    partialResultsAllowed: allowPartial,
    sameDataControlsRequired: !options.allowSoloSmoke,
    bm25ControlRequired: !options.allowSoloSmoke,
    bm25ControlPresent: strategySet.has("bm25-lite"),
    hybridFamilyRequired: value === "hybrid" || includesHybridFamily,
    hybridFamilyPresent: includesHybridFamily,
    fullHybridControlRequired: value === "provider" || includesProviderBacked,
    fullHybridControlPresent: strategySet.has("full-hybrid-rerank"),
    providerArmRequired: value === "provider",
    providerArmPresent: includesProviderBacked,
    actualBenchmarkTargetRequiredForClaims: true,
    publicClaimsAllowedByThisReport: false,
  };
}

function strategyFailureSummary(strategy, error) {
  const text = sanitizeFailureText(error?.message ?? error ?? "");
  let failureClass = classifyFailure(text);
  if (failureClass === "provider-timeout" && !isProviderBackedStrategy(strategy)) failureClass = "arm-timeout";
  const summary = {
    strategy,
    failureClass,
    retryableProviderLimit: isProviderBackedStrategy(strategy) && ["provider-rate-limit", "provider-timeout"].includes(failureClass),
  };
  assertSafePublicText(JSON.stringify(summary), "strategy failure summary");
  return summary;
}

function classifyFailure(text) {
  const value = String(text ?? "").toLowerCase();
  if (/\bstatus 429\b/.test(value) || value.includes("rate limit") || value.includes("quota")) return "provider-rate-limit";
  if (value.includes("aborterror") || value.includes("timeout") || value.includes("timed out") || value.includes("etimedout")) return "provider-timeout";
  if (value.includes("sigterm") || value.includes("sigkill")) return "arm-terminated";
  if (value.includes("memories file too large")) return "memory-size-limit";
  if (/\bstatus 5\d\d\b/.test(value)) return "provider-server-error";
  if (value.includes("requires recallweave_provider_benchmark_calls") || value.includes("requires recallweave_provider_benchmark_public_data")) {
    return "provider-env-not-enabled";
  }
  if (value.includes("provider key missing") || value.includes("requires gemini") || value.includes("requires voyage") || value.includes("requires nvidia")) {
    return "provider-credentials-missing";
  }
  if (value.includes("privacy") || value.includes("contains a key-shaped secret") || value.includes("private path")) return "public-safety-check-failed";
  return "strategy-arm-failed";
}

function isHybridFamilyStrategy(strategy) {
  return [
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
  ].includes(strategy);
}

function isProviderBackedStrategy(strategy) {
  return strategy.startsWith("cloud-") || strategy.startsWith("local-apple-");
}

function isCloudProviderStrategy(strategy) {
  return strategy.startsWith("cloud-");
}

function armTimeoutForStrategy(strategy) {
  if (armTimeoutMs) return armTimeoutMs;
  if (fixtureRequested) return 0;
  if (isCloudProviderStrategy(strategy)) {
    if (providerArmTimeoutMs) return providerArmTimeoutMs;
    if (!providerTimeoutMs || !maxQueries) return 0;
    const attempts = Math.max(1, providerRetryAttempts + 1);
    const computed = maxQueries * attempts * providerTimeoutMs + 90_000;
    return Math.max(120_000, Math.min(20 * 60_000, computed));
  }
  if (maxQueries && isHybridFamilyStrategy(strategy)) {
    const computed = maxQueries * 20_000 + 60_000;
    return Math.max(90_000, Math.min(10 * 60_000, computed));
  }
  return 0;
}

function normalizeGate(value) {
  const gate = String(value ?? "strategy").trim().toLowerCase();
  assert.ok(["strategy", "hybrid", "provider"].includes(gate), `unknown benchmark gate: ${gate}`);
  return gate;
}

function round(value) {
  return Number(Number(value).toFixed(4));
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function runNode(argv, options = {}) {
  const timeoutMs = options.timeoutMs ?? armTimeoutMs;
  const result = spawnSync(process.execPath, argv, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.live
        ? {
            RECALLWEAVE_BASELINE_LIVE: "1",
            RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
            RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES: String(maxMemoryBytes),
            ...(providerTimeoutMs ? { RECALLWEAVE_PROVIDER_TIMEOUT_MS: String(providerTimeoutMs) } : {}),
            ...(providerRetryAttempts ? { RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS: String(providerRetryAttempts) } : {}),
          }
        : {}),
      ...(options.env ?? {}),
    },
    ...(timeoutMs ? { timeout: timeoutMs, killSignal: "SIGTERM" } : {}),
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(`node ${argv.join(" ")} timed out after ${timeoutMs}ms`);
  }
  if (result.signal) {
    throw new Error(`node ${argv.join(" ")} terminated by signal ${result.signal}`);
  }
  if (result.status !== 0) {
    throw new Error(sanitizeFailureText(`node ${argv.join(" ")} failed\n${result.stdout}\n${result.stderr}`));
  }
  assertSafePublicText(result.stdout, "child stdout");
  assertSafePublicText(result.stderr, "child stderr");
  return result;
}

function runNodeAsync(argv, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const timeoutMs = options.timeoutMs ?? armTimeoutMs;
    const child = spawn(process.execPath, argv, {
      cwd: root,
      env: {
        ...process.env,
        ...(options.live
          ? {
              RECALLWEAVE_BASELINE_LIVE: "1",
              RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
              RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES: String(maxMemoryBytes),
              ...(providerTimeoutMs ? { RECALLWEAVE_PROVIDER_TIMEOUT_MS: String(providerTimeoutMs) } : {}),
              ...(providerRetryAttempts ? { RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS: String(providerRetryAttempts) } : {}),
            }
          : {}),
        ...(options.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, timeoutMs)
      : null;
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status, signal) => {
      if (timeout) clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`node ${argv.join(" ")} timed out after ${timeoutMs}ms`));
        return;
      }
      if (signal) {
        reject(new Error(`node ${argv.join(" ")} terminated by signal ${signal}`));
        return;
      }
      if (status !== 0) {
        reject(new Error(sanitizeFailureText(`node ${argv.join(" ")} failed\n${stdout}\n${stderr}`)));
        return;
      }
      try {
        assertSafePublicText(stdout, "child stdout");
        assertSafePublicText(stderr, "child stderr");
        resolvePromise({ stdout, stderr, status, signal });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function mapLimit(items, limit, worker) {
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const outputs = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        outputs[index] = await worker(items[index]);
      }
    }),
  );
  return outputs;
}

function armRunContext(label, runRootPath, effectiveArmTimeoutMs = 0) {
  const baseEnv = {
    RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
    SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
  };
  if (!isolateArms) {
    return {
      env: baseEnv,
      summary: {
        isolated: false,
        supermemorySearchDisabled: true,
        effectiveArmTimeoutMs,
      },
    };
  }
  const armId = sanitizeFileSegment(label);
  const cachePath = resolve(runRootPath, "arm-caches", `${armId}-local-apple-embeddings.jsonl`);
  mkdirSync(dirname(cachePath), { recursive: true });
  const containerTag = `selfmem-bench-${shortHash(`${label}:${runRootPath}`)}`;
  return {
    env: {
      ...baseEnv,
      RECALLWEAVE_BENCHMARK_ARM_ID: armId,
      RECALLWEAVE_BENCHMARK_ARM_CONTAINER_TAG: containerTag,
      SELFMEM_LOCAL_EMBED_CACHE_PATH: cachePath,
    },
    summary: {
      isolated: true,
      supermemorySearchDisabled: true,
      effectiveArmTimeoutMs,
      armIdHash: shortHash(armId),
      containerTagHash: shortHash(containerTag),
      localEmbeddingCachePathHash: `sha256:${stableHash(cachePath)}`,
    },
  };
}

function sanitizeFileSegment(value) {
  return String(value ?? "arm")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "arm";
}

function sanitizeFailureText(text) {
  return String(text).replace(privatePathOutputPattern, "<private-path>");
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private path or raw memory filename`);
  assert.doesNotMatch(String(text), privateTagPattern, `${label} contains private tags`);
}

function writePublicOutput(path, text) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  assertSafePublicText(text, "public output");
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
}

function assertOutsideRepo(path, label) {
  const rel = relative(root, resolve(path));
  assert.ok(rel.startsWith("..") || isAbsolute(rel), `${label} must stay outside the repository`);
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, resolve(value)).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function splitList(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function optionalPositiveInt(value, label) {
  if (value === null || value === undefined || value === "") return null;
  return positiveInt(value, label);
}

function optionalNonNegativeInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer`);
  return number;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.filter((item) => String(item).trim()).length : 0;
}

function lineCount(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.trim()).length;
}

function fileHash(path) {
  return stableHash(readFileSync(path, "utf8"));
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
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
