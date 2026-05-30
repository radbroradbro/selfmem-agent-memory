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
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_MARKDOWN ?? null;
const allowSoloSmoke = Boolean(args.allowSoloSmoke) || process.env.RECALLWEAVE_ALLOW_SOLO_BENCHMARK_SMOKE === "1";
const allowPartial = Boolean(args.allowPartial) || process.env.RECALLWEAVE_PUBLIC_BENCHMARK_ALLOW_PARTIAL === "1";
const defaultAutoresearchStrategies = [
  "jaccard",
  "bm25-lite",
  "hybrid-v1",
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
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_STRATEGIES ?? defaultAutoresearchStrategies);
const budgets = splitList(args.contextTokenBudgets ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_BUDGETS ?? "800,1200,1600,2400").map((value) =>
  positiveInt(value, "context token budget"),
);
const limits = splitList(args.limits ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_LIMITS ?? "5,10").map((value) =>
  positiveInt(value, "limit"),
);
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_MAX_QUERIES ?? null, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_BASELINE_QUERY_OFFSET ?? 0, "query offset");
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 300_000_000, "max memory bytes");
const armTimeoutMs = optionalPositiveInt(args.armTimeoutMs ?? process.env.RECALLWEAVE_BENCHMARK_ARM_TIMEOUT_MS ?? null, "arm timeout") ?? 0;
const includesProviderBackedStrategies = strategies.some((strategy) => strategy.startsWith("cloud-") || strategy.startsWith("local-apple-"));
const providerTimeoutMs =
  optionalPositiveInt(args.providerTimeoutMs ?? process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? null, "provider timeout") ??
  (!fixtureRequested && includesProviderBackedStrategies ? 45_000 : 0);
const providerRetryAttempts =
  optionalPositiveInt(args.providerRetryAttempts ?? process.env.RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS ?? null, "provider retry attempts") ??
  (!fixtureRequested && includesProviderBackedStrategies ? 2 : 0);
const parallelArms = optionalPositiveInt(args.parallelArms ?? process.env.RECALLWEAVE_BENCHMARK_PARALLEL_ARMS ?? null, "parallel arms") ?? 1;
const isolateArms =
  Boolean(args.isolateArms) ||
  process.env.RECALLWEAVE_BENCHMARK_ISOLATE_ARMS === "1" ||
  (!fixtureRequested && includesProviderBackedStrategies && process.env.RECALLWEAVE_BENCHMARK_ISOLATE_ARMS !== "0");

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
];
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privatePathOutputPattern =
  /(\/Users\/[^\s"'`]+|\/Volumes\/[^\s"'`]+|\/private\/[^\s"'`]+|\/var\/folders\/[^\s"'`]+|\/tmp\/[^\s"'`]+|\/home\/[^\s"'`]+|[A-Za-z]:\\Users\\[^\s"'`]+|\.hermes\/profiles[^\s"'`]*|\.openclaw[^\s"'`]*)/gi;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

for (const strategy of strategies) assert.ok(retrievalStrategies.includes(strategy), `unknown strategy: ${strategy}`);
assertAutoresearchContract(strategies, { allowSoloSmoke });

const runRoot = mkdtempSync(resolve(tmpdir(), "recallweave-autoresearch-loop-"));
const input = fixtureRequested ? fixtureInput() : await liveInput(runRoot);
const arms = buildArms({ strategies, budgets, limits });
const results = [];
const failedArms = [];

const armOutcomes = await mapLimit(arms, parallelArms, runAutoresearchArm);
for (const outcome of armOutcomes) {
  if (outcome.result) results.push(outcome.result);
  if (outcome.failure) failedArms.push(outcome.failure);
}

async function runAutoresearchArm(arm) {
  const label = `${arm.strategy}-b${arm.contextTokenBudget}-k${arm.limit}`;
  const responsePath = resolve(runRoot, `${label}-responses.json`);
  const resultPath = resolve(runRoot, `${label}-result.json`);
  const armContext = armRunContext(label, runRoot);
  try {
    await runNodeAsync(
      [
        "packages/bench/recallweave-response-export.mjs",
        ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath, "--memories", input.memoriesPath, "--preserve-ids"]),
        "--strategy",
        arm.strategy,
        "--context-token-budget",
        String(arm.contextTokenBudget),
        "--limit",
        String(arm.limit),
        ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
        ...(queryOffset ? ["--query-offset", String(queryOffset)] : []),
        "--max-memory-bytes",
        String(maxMemoryBytes),
        "--output",
        responsePath,
      ],
      { live: !fixtureRequested, env: armContext.env },
    );
    await runNodeAsync(
      [
        "packages/bench/recallweave-baseline-collector.mjs",
        ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath]),
        "--responses",
        responsePath,
        "--retrieval-mode",
        `strategy:${arm.strategy}`,
        "--limit",
        String(arm.limit),
        ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
        ...(queryOffset ? ["--query-offset", String(queryOffset)] : []),
        "--output",
        resultPath,
      ],
      {
        live: !fixtureRequested,
        env: {
          ...armContext.env,
          RECALLWEAVE_BASELINE_JUDGE_MODEL: input.judgeModel,
          RECALLWEAVE_BASELINE_ANSWER_MODEL: input.answerModel,
        },
      },
    );
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
      armId: label,
      strategy: arm.strategy,
      contextTokenBudget: arm.contextTokenBudget,
      limit: arm.limit,
      querySetHash: result.querySetHash,
      responsesHash: `sha256:${fileHash(responsePath)}`,
      resultHash: `sha256:${fileHash(resultPath)}`,
      rankingStrategy: response.source?.rankingStrategy ?? result.retrievalConfig?.rankingStrategy ?? null,
      armIsolation: armContext.summary,
      queryShard: response.queryShard ?? null,
      metrics: result.metrics,
      contextBudget: result.retrievalConfig?.contextBudget ?? null,
      privacyLeakCount: result.privacyLeakCount,
      redactionFailureCount: result.redactionFailureCount,
    } };
  } catch (error) {
    if (!allowPartial) throw error;
    return { failure: armFailureSummary(label, arm, error) };
  }
}

assert.ok(results.length > 0, "autoresearch loop produced no completed arms");
const querySetHashes = new Set(results.map((item) => item.querySetHash));
assert.equal(querySetHashes.size, 1, "all autoresearch arms must use the same query set");
if (input.collectorCompatibleQuerySetHash) {
  assert.equal(results[0].querySetHash, input.collectorCompatibleQuerySetHash, "autoresearch run must bind to materialized query set");
}

const sorted = [...results].sort(compareArms);
const winner = sorted[0] ?? null;
const baseline = results.find((item) => item.strategy === "jaccard" && item.contextTokenBudget === 1600 && item.limit === 10) ?? null;
const report = {
  schemaVersion: 1,
  ok: failedArms.length === 0,
  status: failedArms.length === 0 ? "COMPLETED" : "PARTIAL_COMPLETED_WITH_ARM_FAILURES",
  mode: "public-benchmark-autoresearch-loop",
  fixtureOnly: fixtureRequested,
  benchmark: input.benchmark,
  metricsOnly: true,
  retrievalProxyOnly: true,
  memoryBenchAnswerQuality: false,
  publicBenchmarkClaimsAllowed: false,
  comparisonContract: comparisonContract(strategies, { allowSoloSmoke }),
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
    querySetHash: results[0].querySetHash,
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
  },
  loop: {
    hypothesis:
      "A local hybrid recall family must beat or materially improve on the BM25 lexical control on source-locked LongMemEval recall before any default promotion; provider-backed arms remain a separate opt-in gate.",
    armCount: results.length,
    requestedArmCount: arms.length,
    failedArmCount: failedArms.length,
    variables: {
      strategies,
      contextTokenBudgets: budgets,
      limits,
      maxMemoryBytes,
      armTimeoutMs,
      providerTimeoutMs,
      providerRetryAttempts,
      parallelArms,
      isolateArms,
    },
    keepDecision: winner ? `Use ${winner.strategy} with budget ${winner.contextTokenBudget} and limit ${winner.limit} for the next canary arm.` : "No winning arm.",
    rollbackPlan: "Fall back to the previous checked-in retrieval-proxy result and keep publicBenchmarkClaimsAllowed=false.",
  },
  baseline: summarizeArm(baseline),
  winner: summarizeArm(winner),
  arms: results.map(summarizeArm),
  failedArms,
  safety: {
    publicSafe: true,
    metricsOnly: true,
    privateInputsStoredOutsideRepository: true,
    printsCredentials: false,
  },
  nextActions: [
    "Promote the winning arm only as retrieval-proxy methodology evidence.",
    "Run the provider-backed loop with Voyage, Gemini, NVIDIA, or Apple Silicon arms only after the env-only public-data preflight passes.",
    "Do not turn this loop into MemoryBench answer-quality or SOTA language.",
  ],
};

const serialized = format === "markdown" ? `${renderMarkdown(report)}\n` : `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "autoresearch loop report");
if (outputPath) writePublicOutput(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (markdownOutputPath) writePublicOutput(markdownOutputPath, `${renderMarkdown(report)}\n`);
process.stdout.write(serialized);

function buildArms(input) {
  const arms = [];
  for (const strategy of input.strategies) {
    for (const contextTokenBudget of input.budgets) {
      for (const limit of input.limits) arms.push({ strategy, contextTokenBudget, limit });
    }
  }
  return arms;
}

function assertAutoresearchContract(strategyNames, options = {}) {
  if (options.allowSoloSmoke) return;
  const strategySet = new Set(strategyNames);
  assert.ok(strategyNames.length >= 2, "autoresearch benchmark must compare multiple arms; use --allow-solo-smoke only for wiring tests");
  assert.ok(strategySet.has("bm25-lite"), "autoresearch benchmark must include bm25-lite as the same-data lexical control");
  assert.ok(
    strategyNames.some((strategy) => isHybridFamilyStrategy(strategy)),
    "autoresearch benchmark must include at least one hybrid-family candidate",
  );
  if (strategyNames.some((strategy) => isProviderBackedStrategy(strategy))) {
    assert.ok(strategySet.has("full-hybrid-rerank"), "provider-backed autoresearch must include full-hybrid-rerank as the same-data hybrid control");
  }
}

function comparisonContract(strategyNames, options = {}) {
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
    hybridFamilyRequired: !options.allowSoloSmoke,
    hybridFamilyPresent: includesHybridFamily,
    fullHybridControlRequired: includesProviderBacked,
    fullHybridControlPresent: strategySet.has("full-hybrid-rerank"),
    providerArmPresent: includesProviderBacked,
    actualBenchmarkTargetRequiredForClaims: true,
    publicClaimsAllowedByThisReport: false,
  };
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

function compareArms(left, right) {
  const qualityDelta = Number(right.metrics?.quality ?? 0) - Number(left.metrics?.quality ?? 0);
  if (qualityDelta !== 0) return qualityDelta;
  const ndcgDelta = Number(right.metrics?.ndcgAt10 ?? 0) - Number(left.metrics?.ndcgAt10 ?? 0);
  if (ndcgDelta !== 0) return ndcgDelta;
  const tokenDelta = Number(left.metrics?.contextTokensAvg ?? Infinity) - Number(right.metrics?.contextTokensAvg ?? Infinity);
  if (tokenDelta !== 0) return tokenDelta;
  return Number(left.metrics?.latencyP50Ms ?? Infinity) - Number(right.metrics?.latencyP50Ms ?? Infinity);
}

function summarizeArm(item) {
  if (!item) return null;
  return {
    armId: item.armId,
    strategy: item.strategy,
    contextTokenBudget: item.contextTokenBudget,
    limit: item.limit,
    rankingStrategy: item.rankingStrategy,
    armIsolation: item.armIsolation,
    metrics: item.metrics,
    contextBudget: item.contextBudget,
    privacyLeakCount: item.privacyLeakCount,
    redactionFailureCount: item.redactionFailureCount,
  };
}

function renderMarkdown(value) {
  const lines = [
    "# Public Benchmark Autoresearch Loop",
    "",
    `- OK: ${value.ok}`,
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Benchmark: ${value.benchmark}`,
    `- Retrieval proxy only: ${value.retrievalProxyOnly}`,
    `- MemoryBench answer quality: ${value.memoryBenchAnswerQuality}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Partial results allowed: ${value.partialResultsAllowed}`,
    `- Solo smoke only: ${value.comparisonContract.soloRunsAreSmokeOnly}`,
    `- Same-data controls required: ${value.comparisonContract.sameDataControlsRequired}`,
    `- Query set hash: ${value.input.querySetHash}`,
    `- Selected query count: ${value.input.selectedQueryCount ?? "unknown"}`,
    `- Completed arm count: ${value.loop.armCount}`,
    `- Failed arm count: ${value.loop.failedArmCount}`,
    `- Winner: ${value.winner?.armId ?? "none"}`,
    "",
    "## Top Arms",
    "",
    "| Arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | Tokens | p50 ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...[...value.arms]
      .sort(compareSummaries)
      .slice(0, 8)
      .map(
        (item) =>
          `| ${item.armId} | ${item.metrics.quality} | ${item.metrics.pAt1} | ${item.metrics.recallAt5} | ${item.metrics.recallAt10} | ${item.metrics.ndcgAt10} | ${item.metrics.contextTokensAvg} | ${item.metrics.latencyP50Ms} |`,
      ),
    "",
  ];
  if (value.failedArms.length) {
    lines.push(
      "## Failed Arms",
      "",
      "| Arm | Strategy | Failure class | Retryable/provider limit |",
      "| --- | --- | --- | ---: |",
      ...value.failedArms.map((item) => `| ${item.armId} | ${item.strategy} | ${item.failureClass} | ${item.retryableProviderLimit} |`),
      "",
    );
  }
  lines.push(
    "## Decision",
    "",
    `- ${value.loop.keepDecision}`,
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Private output path included: ${value.rawPrivateOutputPathIncluded}`,
  );
  return lines.join("\n");
}

function compareSummaries(left, right) {
  return compareArms(left, right);
}

function fixtureInput() {
  return {
    benchmark: "longmemeval",
    source: "fixture",
    datasetSlice: "fixture-memory-canary-slice",
    querySetPath: resolve(root, "packages/bench/fixtures/hosted-baseline-queryset.fixture.json"),
    memoriesPath: resolve(root, "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl"),
    judgeModel: "fixture-judge",
    answerModel: "fixture-answer",
    queryCount: 3,
    expectedResultRefCount: 3,
    haystackSessionCount: 6,
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
    collectorCompatibleQuerySetHash: materializer?.selection?.collectorCompatibleQuerySetHash ?? null,
    materializerHash: materializer ? `sha256:${stableHash(JSON.stringify(materializer))}` : null,
  };
}

function runNode(argv, options = {}) {
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
      RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
      SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
      ...(options.env ?? {}),
    },
    ...(armTimeoutMs ? { timeout: armTimeoutMs, killSignal: "SIGTERM" } : {}),
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(`node ${argv.join(" ")} timed out after ${armTimeoutMs}ms`);
  }
  if (result.signal) {
    throw new Error(`node ${argv.join(" ")} terminated by signal ${result.signal}`);
  }
  if (result.status !== 0) throw new Error(sanitizeFailureText(`node ${argv.join(" ")} failed\n${result.stdout}\n${result.stderr}`));
  assertSafePublicText(result.stdout, "child stdout");
  assertSafePublicText(result.stderr, "child stderr");
  return result;
}

function runNodeAsync(argv, options = {}) {
  return new Promise((resolvePromise, reject) => {
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
        RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
        SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
        ...(options.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = armTimeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, armTimeoutMs)
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
        reject(new Error(`node ${argv.join(" ")} timed out after ${armTimeoutMs}ms`));
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

function armRunContext(label, runRootPath) {
  if (!isolateArms) return { env: {}, summary: { isolated: false } };
  const armId = sanitizeFileSegment(label);
  const cachePath = resolve(runRootPath, "arm-caches", `${armId}-local-apple-embeddings.jsonl`);
  mkdirSync(dirname(cachePath), { recursive: true });
  const containerTag = `selfmem-bench-${shortHash(`${label}:${runRootPath}`)}`;
  return {
    env: {
      RECALLWEAVE_BENCHMARK_ARM_ID: armId,
      RECALLWEAVE_BENCHMARK_ARM_CONTAINER_TAG: containerTag,
      SELFMEM_LOCAL_EMBED_CACHE_PATH: cachePath,
    },
    summary: {
      isolated: true,
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

function armFailureSummary(armId, arm, error) {
  const text = sanitizeFailureText(error?.message ?? error ?? "");
  let failureClass = classifyFailure(text);
  if (failureClass === "provider-timeout" && !isProviderBackedStrategy(arm.strategy)) failureClass = "arm-timeout";
  const summary = {
    armId,
    strategy: arm.strategy,
    contextTokenBudget: arm.contextTokenBudget,
    limit: arm.limit,
    failureClass,
    retryableProviderLimit: isProviderBackedStrategy(arm.strategy) && ["provider-rate-limit", "provider-timeout"].includes(failureClass),
  };
  assertSafePublicText(JSON.stringify(summary), "autoresearch arm failure summary");
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
  return "autoresearch-arm-failed";
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
