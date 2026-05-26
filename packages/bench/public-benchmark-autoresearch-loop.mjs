import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
].join(",");
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_STRATEGIES ?? defaultAutoresearchStrategies);
const budgets = splitList(args.contextTokenBudgets ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_BUDGETS ?? "800,1200,1600,2400").map((value) =>
  positiveInt(value, "context token budget"),
);
const limits = splitList(args.limits ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_AUTORESEARCH_LIMITS ?? "5,10").map((value) =>
  positiveInt(value, "limit"),
);
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 5_000_000, "max memory bytes");

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
  "cloud-gemini2-embed-rerank-proxy",
  "cloud-gemini2-voyage-rerank",
  "cloud-nvidia-retriever-500m",
  "cloud-nvidia-nemotron-1b",
  "cloud-nvidia-nemotron-vl-1b",
  "cloud-nvidia-e5-mistral",
  "cloud-nvidia-code",
  "local-apple-qwen3-0_6b",
];
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

for (const strategy of strategies) assert.ok(retrievalStrategies.includes(strategy), `unknown strategy: ${strategy}`);
assertAutoresearchContract(strategies, { allowSoloSmoke });

const runRoot = mkdtempSync(resolve(tmpdir(), "recallweave-autoresearch-loop-"));
const input = fixtureRequested ? fixtureInput() : await liveInput(runRoot);
const arms = buildArms({ strategies, budgets, limits });
const results = [];

for (const arm of arms) {
  const label = `${arm.strategy}-b${arm.contextTokenBudget}-k${arm.limit}`;
  const responsePath = resolve(runRoot, `${label}-responses.json`);
  const resultPath = resolve(runRoot, `${label}-result.json`);
  runNode(
    [
      "packages/bench/recallweave-response-export.mjs",
      ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath, "--memories", input.memoriesPath, "--preserve-ids"]),
      "--strategy",
      arm.strategy,
      "--context-token-budget",
      String(arm.contextTokenBudget),
      "--limit",
      String(arm.limit),
      "--max-memory-bytes",
      String(maxMemoryBytes),
      "--output",
      responsePath,
    ],
    { live: !fixtureRequested },
  );
  runNode(
    [
      "packages/bench/recallweave-baseline-collector.mjs",
      ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath]),
      "--responses",
      responsePath,
      "--retrieval-mode",
      `strategy:${arm.strategy}`,
      "--limit",
      String(arm.limit),
      "--output",
      resultPath,
    ],
    {
      live: !fixtureRequested,
      env: {
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
  results.push({
    armId: label,
    strategy: arm.strategy,
    contextTokenBudget: arm.contextTokenBudget,
    limit: arm.limit,
    querySetHash: result.querySetHash,
    responsesHash: `sha256:${fileHash(responsePath)}`,
    resultHash: `sha256:${fileHash(resultPath)}`,
    rankingStrategy: response.source?.rankingStrategy ?? result.retrievalConfig?.rankingStrategy ?? null,
    metrics: result.metrics,
    contextBudget: result.retrievalConfig?.contextBudget ?? null,
    privacyLeakCount: result.privacyLeakCount,
    redactionFailureCount: result.redactionFailureCount,
  });
}

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
  ok: true,
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
  },
  loop: {
    hypothesis:
      "A local hybrid recall family must beat or materially improve on the BM25 lexical control on source-locked LongMemEval recall before any default promotion; provider-backed arms remain a separate opt-in gate.",
    armCount: results.length,
    variables: {
      strategies,
      contextTokenBudgets: budgets,
      limits,
      maxMemoryBytes,
    },
    keepDecision: winner ? `Use ${winner.strategy} with budget ${winner.contextTokenBudget} and limit ${winner.limit} for the next canary arm.` : "No winning arm.",
    rollbackPlan: "Fall back to the previous checked-in retrieval-proxy result and keep publicBenchmarkClaimsAllowed=false.",
  },
  baseline: summarizeArm(baseline),
  winner: summarizeArm(winner),
  arms: results.map(summarizeArm),
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
    metrics: item.metrics,
    contextBudget: item.contextBudget,
    privacyLeakCount: item.privacyLeakCount,
    redactionFailureCount: item.redactionFailureCount,
  };
}

function renderMarkdown(value) {
  return [
    "# Public Benchmark Autoresearch Loop",
    "",
    `- OK: ${value.ok}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Benchmark: ${value.benchmark}`,
    `- Retrieval proxy only: ${value.retrievalProxyOnly}`,
    `- MemoryBench answer quality: ${value.memoryBenchAnswerQuality}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Solo smoke only: ${value.comparisonContract.soloRunsAreSmokeOnly}`,
    `- Same-data controls required: ${value.comparisonContract.sameDataControlsRequired}`,
    `- Query set hash: ${value.input.querySetHash}`,
    `- Arm count: ${value.loop.armCount}`,
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
    "## Decision",
    "",
    `- ${value.loop.keepDecision}`,
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Private output path included: ${value.rawPrivateOutputPathIncluded}`,
  ].join("\n");
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
  const target = resolveInputPath(args.target ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ?? "reviews/overnight-20260522/public-longmemeval-run-target.json");
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
      ...(options.live ? { RECALLWEAVE_BASELINE_LIVE: "1", RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1" } : {}),
      ...(options.env ?? {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`node ${argv.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  assertSafePublicText(result.stdout, "child stdout");
  assertSafePublicText(result.stderr, "child stderr");
  return result;
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
