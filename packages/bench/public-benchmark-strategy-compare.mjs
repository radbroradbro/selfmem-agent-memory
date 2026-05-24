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
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_STRATEGY_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_STRATEGY_MARKDOWN ?? null;
const gate = normalizeGate(args.gate ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_GATE ?? "strategy");
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_STRATEGIES ?? defaultStrategies(gate));
const allowSoloSmoke = Boolean(args.allowSoloSmoke) || process.env.RECALLWEAVE_ALLOW_SOLO_BENCHMARK_SMOKE === "1";
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? 1600, "context token budget");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 10, "limit");
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
  "query-expanded-full-hybrid-rerank",
  "cloud-voyage-rerank-only",
  "cloud-voyage4-voyage",
  "cloud-gemini-embed-rerank-proxy",
  "cloud-gemini-voyage-rerank",
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
const privatePathOutputPattern =
  /(\/Users\/[^\s"'`]+|\/Volumes\/[^\s"'`]+|\/private\/[^\s"'`]+|\/var\/folders\/[^\s"'`]+|\/tmp\/[^\s"'`]+|\/home\/[^\s"'`]+|[A-Za-z]:\\Users\\[^\s"'`]+|\.hermes\/profiles[^\s"'`]*|\.openclaw[^\s"'`]*)/gi;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

for (const strategy of strategies) assert.ok(retrievalStrategies.includes(strategy), `unknown strategy: ${strategy}`);
assertGateContract(gate, strategies, { allowSoloSmoke });

const runRoot = mkdtempSync(resolve(tmpdir(), "recallweave-strategy-compare-"));
const input = fixtureRequested ? fixtureInput() : await liveInput(runRoot);
const results = [];

for (const strategy of strategies) {
  const responsePath = resolve(runRoot, `${strategy}-responses.json`);
  const resultPath = resolve(runRoot, `${strategy}-result.json`);
  const exportArgs = [
    "packages/bench/recallweave-response-export.mjs",
    ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath, "--memories", input.memoriesPath, "--preserve-ids"]),
    "--strategy",
    strategy,
    "--context-token-budget",
    String(contextTokenBudget),
    "--limit",
    String(limit),
    "--output",
    responsePath,
  ];
  runNode(exportArgs, { live: !fixtureRequested });
  const collectArgs = [
    "packages/bench/recallweave-baseline-collector.mjs",
    ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", input.querySetPath]),
    "--responses",
    responsePath,
    "--retrieval-mode",
    `strategy:${strategy}`,
    "--output",
    resultPath,
  ];
  runNode(collectArgs, {
    live: !fixtureRequested,
    env: {
      RECALLWEAVE_BASELINE_JUDGE_MODEL: input.judgeModel,
      RECALLWEAVE_BASELINE_ANSWER_MODEL: input.answerModel,
    },
  });
  const response = JSON.parse(readFileSync(responsePath, "utf8"));
  const result = JSON.parse(readFileSync(resultPath, "utf8"));
  assert.equal(result.retrievalProxyOnly, true);
  assert.equal(result.memoryBenchAnswerQuality, false);
  assert.equal(result.publicBenchmarkClaimsAllowed, false);
  assert.equal(result.privacyLeakCount, 0);
  assert.equal(result.redactionFailureCount, 0);
  results.push({
    strategy,
    querySetHash: result.querySetHash,
    responsesHash: `sha256:${fileHash(responsePath)}`,
    resultHash: `sha256:${fileHash(resultPath)}`,
    rankingStrategy: response.source?.rankingStrategy ?? null,
    provider: response.source?.provider ?? null,
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
  });
}

const querySetHashes = new Set(results.map((item) => item.querySetHash));
assert.equal(querySetHashes.size, 1, "all strategies must use the same query set");
if (input.collectorCompatibleQuerySetHash) {
  assert.equal(results[0].querySetHash, input.collectorCompatibleQuerySetHash, "strategy run must bind to materialized query set");
}

const report = {
  schemaVersion: 1,
  ok: true,
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
  strategies: results,
  winner: bestStrategy(results),
  control: summarizeNamedStrategy(results, "bm25-lite"),
  hybridPromotion: hybridPromotionDecision(results),
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
  const hybridItems = items.filter((item) => !["jaccard", "bm25-lite"].includes(item.strategy));
  const bestHybrid = bestStrategy(hybridItems);
  if (!control || !bestHybrid) {
    return {
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
  return {
    bestHybridStrategy: bestHybrid.strategy,
    promoteHybrid: qualityBeats || (qualityTies && latencyImproves),
    reason: qualityBeats
      ? "Best hybrid-family arm beats bm25-lite on retrieval-proxy quality."
      : qualityTies && latencyImproves
        ? "Best hybrid-family arm ties quality and improves p50 latency by at least 15%."
        : "Keep bm25-lite as control/fallback; hybrid-family arm has not earned promotion on this slice.",
    qualityDeltaVsBm25: round(hybridQuality - controlQuality),
    latencyDeltaVsBm25: round(hybridLatency - controlLatency),
  };
}

function renderMarkdown(value) {
  return [
    "# Public Benchmark Strategy Compare",
    "",
    `- OK: ${value.ok}`,
    `- Gate: ${value.gate}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Benchmark: ${value.benchmark}`,
    `- Retrieval proxy only: ${value.retrievalProxyOnly}`,
    `- MemoryBench answer quality: ${value.memoryBenchAnswerQuality}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Solo smoke only: ${value.comparisonContract.soloRunsAreSmokeOnly}`,
    `- Same-data controls required: ${value.comparisonContract.sameDataControlsRequired}`,
    `- Query set hash: ${value.input.querySetHash}`,
    `- Query count: ${value.input.queryCount}`,
    `- Expected result refs: ${value.input.expectedResultRefCount}`,
    `- Winner: ${value.winner?.strategy ?? "none"}`,
    `- Hybrid promotion: ${value.hybridPromotion.promoteHybrid}`,
    `- Hybrid decision: ${value.hybridPromotion.reason}`,
    "",
    "## Strategies",
    "",
    "| Strategy | Provider arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...value.strategies.map((item) =>
      `| ${item.strategy} | ${item.provider?.modelArm ?? "none"} | ${item.metrics.quality} | ${item.metrics.pAt1} | ${item.metrics.recallAt5} | ${item.metrics.recallAt10} | ${item.metrics.ndcgAt10} | ${item.metrics.latencyP50Ms} |`,
    ),
    "",
    "## Safety",
    "",
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Raw transcript included: ${value.rawTranscriptIncluded}`,
    `- Private output path included: ${value.rawPrivateOutputPathIncluded}`,
  ].join("\n");
}

function defaultStrategies(value) {
  if (value === "provider") {
    return [
      "bm25-lite",
      "full-hybrid-rerank",
      "cloud-voyage-rerank-only",
      "cloud-voyage4-voyage",
      "cloud-gemini-embed-rerank-proxy",
      "cloud-gemini-voyage-rerank",
      "cloud-nvidia-retriever-500m",
      "cloud-nvidia-nemotron-1b",
      "cloud-nvidia-e5-mistral",
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

function isHybridFamilyStrategy(strategy) {
  return [
    "hybrid-v1",
    "dense-proxy",
    "sparse-dense-rrf",
    "sparse-dense-temporal",
    "sparse-dense-graph-temporal",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
  ].includes(strategy);
}

function isProviderBackedStrategy(strategy) {
  return strategy.startsWith("cloud-") || strategy.startsWith("local-apple-");
}

function normalizeGate(value) {
  const gate = String(value ?? "strategy").trim().toLowerCase();
  assert.ok(["strategy", "hybrid", "provider"].includes(gate), `unknown benchmark gate: ${gate}`);
  return gate;
}

function round(value) {
  return Number(Number(value).toFixed(4));
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
          }
        : {}),
      ...(options.env ?? {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(sanitizeFailureText(`node ${argv.join(" ")} failed\n${result.stdout}\n${result.stderr}`));
  }
  assertSafePublicText(result.stdout, "child stdout");
  assertSafePublicText(result.stderr, "child stderr");
  return result;
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
