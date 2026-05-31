import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture);
const executeRequested = Boolean(args.execute);
const format = String(args.format ?? "json").toLowerCase();
const targetPath = resolveInputPath(
  args.target ?? process.env.RECALLWEAVE_MEMORYBENCH_TARGET ?? "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json",
);
const querySetPath = resolveOptionalPath(
  args.queryset ??
    args.querySet ??
    process.env.RECALLWEAVE_BASELINE_QUERYSET ??
    (fixtureRequested ? "packages/bench/fixtures/hosted-baseline-queryset.fixture.json" : null),
);
const memoriesPath = resolveOptionalPath(
  args.memories ??
    args.memoriesJsonl ??
    process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ??
    (fixtureRequested ? "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl" : null),
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 5, "limit");
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_MAX_QUERIES ?? null, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_BASELINE_QUERY_OFFSET ?? 0, "query offset");
const maxMemoryBytes = optionalPositiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? null, "max memory bytes");
const privateOutputDir = resolveOptionalPath(args.privateOutputDir ?? process.env.RECALLWEAVE_SOTA_RESPONSE_ARM_DIR ?? null);
const localEmbeddingDurabilityReportPath = resolveOptionalPath(
  args.localEmbeddingDurabilityReport ?? process.env.SELFMEM_LOCAL_EMBED_DURABILITY_REPORT ?? null,
);
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_SOTA_ANSWER_QUALITY_STRATEGIES ?? defaultStrategies().join(","));
const requireReady = Boolean(args.requireReady);
const reuseExisting = Boolean(args.reuseExisting ?? process.env.RECALLWEAVE_RESPONSE_ARM_REUSE_EXISTING === "1");
const benchmarkSupermemoryDisableEnv = {
  RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
  SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
};

const retrievalStrategies = new Set([
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
]);
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(targetPath), `benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `benchmark target empty: ${displayPath(targetPath)}`);
for (const strategy of strategies) assert.ok(retrievalStrategies.has(strategy), `unknown strategy: ${strategy}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "benchmark target");
const target = JSON.parse(targetRaw);
const targetOk = target.fixtureOnly === false && target.benchmark?.family === "longmemeval" && target.claimTier === "run-only";
const coverage = strategyCoverage(strategies);
const providerHybridContract = buildProviderHybridContract(strategies, coverage);
const env = envReadiness(strategies);
const input = inspectInputs();
const privateDir = inspectPrivateOutputDir();
const localEmbeddingDurability = inspectLocalEmbeddingDurability(coverage);
const preflightBlockers = [
  !targetOk ? "target-not-public-longmemeval-run-only" : null,
  !fixtureRequested && !env.liveExportEnabled ? "RECALLWEAVE_BASELINE_LIVE-not-enabled" : null,
  !fixtureRequested && !env.noRawTextConfirmed ? "RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed" : null,
  !input.querySet.present ? "private-queryset-missing" : null,
  !input.memories.present ? "private-memories-missing" : null,
  !privateDir.present ? "private-response-output-dir-missing" : null,
  !coverage.hasBm25Lite ? "bm25-lite-arm-missing" : null,
  !coverage.hasFullHybridRerank ? "full-hybrid-rerank-arm-missing" : null,
  !coverage.hasQueryExpansion ? "query-expansion-arm-missing" : null,
  !coverage.hasProviderChallenger ? "provider-challenger-arm-missing" : null,
  !coverage.hasLocalApple ? "local-apple-arm-missing" : null,
  !coverage.hasLocalRerank ? "local-rerank-arm-missing" : null,
  coverage.hasProviderChallenger && !fixtureRequested && !env.providerCallsEnabled ? "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled" : null,
  coverage.hasProviderChallenger && !fixtureRequested && !env.providerPublicDataConfirmed
    ? "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed"
    : null,
  coverage.hasQueryExpansion && !fixtureRequested && !env.queryExpansionReady ? "query-expansion-endpoint-or-consent-missing" : null,
  ...localEmbeddingDurability.blockers,
].filter(Boolean);

const exportRows = preflightBlockers.length === 0 && executeRequested ? exportResponseArms(privateDir.path) : plannedRows();
const exported = exportRows.length > 0 && exportRows.every((row) => row.exported === true);
const status = exported
  ? "EXPORTED_RESPONSE_ARMS"
  : preflightBlockers.length === 0
    ? "READY_TO_EXPORT_RESPONSE_ARMS"
    : "BLOCKED_RESPONSE_ARM_EXPORT_ENV";

const report = {
  schemaVersion: 1,
  ok: !requireReady || status !== "BLOCKED_RESPONSE_ARM_EXPORT_ENV",
  mode: "public-benchmark-answer-quality-arm-export",
  status,
  fixtureOnly: fixtureRequested,
  executesExports: executeRequested,
  writesPrivateResponseFiles: exported,
  reusesExistingPrivateResponseFiles: reuseExisting,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: true,
  memoryBenchAnswerQuality: false,
  readyForAnswerQualityPreflight: exported && !fixtureRequested,
  readyForEndToEndMemoryScoreGate: false,
  countsAsFullMemorySotaEvidence: false,
  callsProviderApis: executeRequested && !fixtureRequested && (coverage.hasProviderChallenger || coverage.hasQueryExpansion || coverage.hasLocalApple),
  sendsBenchmarkTextToProvider: executeRequested && !fixtureRequested && (coverage.hasProviderChallenger || coverage.hasQueryExpansion || coverage.hasLocalApple),
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsCredentials: false,
  generatedAt: new Date().toISOString(),
  target: {
    path: displayPath(targetPath),
    hash: `sha256:${sha256(targetRaw)}`,
    fixtureOnly: Boolean(target.fixtureOnly),
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
    claimTier: target.claimTier ?? null,
    answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
  },
  input,
  privateOutput: {
    present: privateDir.present,
    pathLabel: privateDir.present ? "external-private-output-dir" : null,
    insideRepository: privateDir.insideRepository,
    valuePrinted: false,
  },
  queryShard: {
    requested: maxQueries != null || queryOffset > 0,
    queryOffset,
    maxQueries,
  },
  limits: {
    contextTokenBudget,
    limit,
    maxMemoryBytes,
  },
  env,
  localEmbeddingDurability,
  strategyCoverage: coverage,
  providerHybridContract,
  arms: exportRows,
  blockers: preflightBlockers,
  answerQualityArmArgs: answerQualityArmArgs(strategies),
  nextActions: nextActions(status),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "answer-quality arm export report");
assertSafePublicText(markdownText, "answer-quality arm export markdown");
if (outputPath) writePublicOutput(outputPath, jsonText);
if (markdownOutputPath) writePublicOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function inspectInputs() {
  const querySet = inspectInputFile(querySetPath, "queryset");
  const memories = inspectInputFile(memoriesPath, "memories");
  return { querySet, memories };
}

function inspectInputFile(path, role) {
  if (!path) return { role, present: false, rawTextPrivate: true };
  if (!fixtureRequested) assertOutsideRepo(path, role);
  assert.ok(existsSync(path), `${role} missing: external-input`);
  assert.ok(statSync(path).size > 0, `${role} empty: external-input`);
  const raw = readFileSync(path, "utf8");
  assertNoPattern(raw, secretPattern, `${role} contains a key-shaped secret`);
  return {
    role,
    present: true,
    rawTextPrivate: true,
    pathLabel: fixtureRequested ? "fixture-input" : "external-input",
    name: fixtureRequested ? basename(path) : null,
    hash: `sha256:${sha256(raw)}`,
    sizeBytes: statSync(path).size,
  };
}

function inspectPrivateOutputDir() {
  const path = privateOutputDir ?? (fixtureRequested && executeRequested ? mkdtempSync(join(tmpdir(), "recallweave-arm-export-")) : null);
  if (!path) return { present: false, path: null, insideRepository: null };
  if (!fixtureRequested) assertOutsideRepo(path, "private response output dir");
  mkdirSync(path, { recursive: true, mode: 0o700 });
  return { present: true, path, insideRepository: isInsideRepo(path) };
}

function exportResponseArms(directory) {
  return strategies.map((strategy) => {
    const responsePath = join(directory, `${strategy}-responses.private.json`);
    const existing = reuseExisting ? responseArmRowFromFile(responsePath, strategy, { reusedExisting: true }) : null;
    if (existing) return existing;
    const nodeArgs = [
      "packages/bench/recallweave-response-export.mjs",
      ...(fixtureRequested ? ["--fixture"] : ["--live", "--queryset", querySetPath, "--memories", memoriesPath, "--preserve-ids"]),
      "--strategy",
      strategy,
      "--context-token-budget",
      String(contextTokenBudget),
      "--limit",
      String(limit),
      ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
      ...(queryOffset > 0 ? ["--query-offset", String(queryOffset)] : []),
      ...(maxMemoryBytes ? ["--max-memory-bytes", String(maxMemoryBytes)] : []),
      "--output",
      responsePath,
    ];
    const result = spawnSync("node", nodeArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...benchmarkSupermemoryDisableEnv,
      },
    });
    assert.equal(result.status, 0, `response export failed for ${strategy}: ${safeError(result.stderr || result.stdout)}`);
    assert.ok(existsSync(responsePath), `${strategy} response export missing`);
    return responseArmRowFromFile(responsePath, strategy, { reusedExisting: false });
  });
}

function responseArmRowFromFile(responsePath, strategy, options = {}) {
  if (!existsSync(responsePath) || statSync(responsePath).size === 0) return null;
  const raw = readFileSync(responsePath, "utf8");
  assertResponseExportSafe(raw, strategy);
  const parsed = JSON.parse(raw);
  const provider = parsed.source?.provider ?? {};
  assert.equal(
    parsed.source?.rankingStrategy ?? provider.strategy,
    strategy,
    `${strategy} response export strategy mismatch`,
  );
  assert.equal(Number(parsed.queryShard?.startIndex ?? 0), queryOffset, `${strategy} response export query offset mismatch`);
  if (maxQueries != null) {
    assert.equal(Number(parsed.queryShard?.requestedLimit ?? parsed.queryShard?.responseCount ?? 0), maxQueries, `${strategy} response export query limit mismatch`);
  }
  return {
    strategy,
    exported: true,
    reusedExisting: Boolean(options.reusedExisting),
    pathLabel: "external-private-response-file",
    name: basename(responsePath),
    hash: `sha256:${sha256(raw)}`,
    querySetHash: parsed.querySetHash ?? null,
    responseCount: parsed.responses && typeof parsed.responses === "object" ? Object.keys(parsed.responses).length : 0,
    fixtureOnly: Boolean(parsed.fixtureOnly),
    providerStrategy: Boolean(provider.providerStrategy),
    providerCallsMade: Number(provider.providerCallsMade ?? 0),
    providerMockCalls: Number(provider.providerMockCalls ?? 0),
    queryExpansionCalls: Number(provider.queryExpansionCalls ?? 0),
    queryExpansionFallbacks: Number(provider.queryExpansionFallbacks ?? 0),
    localEmbeddingCacheEnabled: Boolean(provider.localEmbeddingCacheEnabled),
    queryShard: parsed.queryShard ?? null,
    privacyLeakCount: Number(parsed.privacyLeakCount ?? 0),
    redactionFailureCount: Number(parsed.redactionFailureCount ?? 0),
  };
}

function plannedRows() {
  return strategies.map((strategy) => ({
    strategy,
    exported: false,
    pathLabel: "external-private-response-file",
    plannedName: `${strategy}-responses.private.json`,
    queryShard: {
      startIndex: queryOffset,
      maxQueries,
    },
  }));
}

function assertResponseExportSafe(raw, strategy) {
  assertNoPattern(raw, secretPattern, `${strategy} response export contains a key-shaped secret`);
  assertNoPattern(raw, privatePathPattern, `${strategy} response export contains a private path`);
  assertNoPattern(raw, privateTagPattern, `${strategy} response export contains private tags`);
  assertNoPattern(raw, /\b(content|memory|text|raw|rawText|document|prompt)"\s*:/, `${strategy} response export contains raw text fields`);
}

function strategyCoverage(items) {
  return {
    hasBm25Lite: items.includes("bm25-lite"),
    hasFullHybridRerank: items.includes("full-hybrid-rerank"),
    hasQueryExpansion: items.includes("query-expanded-full-hybrid-rerank"),
    hasProviderChallenger: items.some(isProviderChallenger),
    hasLocalApple: items.some((item) =>
      ["local-apple-qwen3-0_6b", "local-apple-qwen3-0_6b-local-rerank", "local-apple-qwen3-4b", "local-apple-qwen3-4b-local-rerank"].includes(item),
    ),
    hasLocalRerank: items.some((item) => item.endsWith("-local-rerank")),
    strategyCount: items.length,
  };
}

function buildProviderHybridContract(items, coverageValue) {
  const cloudProviderStrategies = items.filter((strategy) => strategy.startsWith("cloud-")).sort();
  const providerChallengerPresent = cloudProviderStrategies.length > 0;
  return {
    bm25LexicalFloorRequired: true,
    fullHybridControlRequired: true,
    sameShardControlsRequired: true,
    providerChallengersAreHybridContextArms: true,
    providerOnlyDenseClaimsAllowed: false,
    providerChallengerPresent,
    providerChallengerControlsPresent: !providerChallengerPresent || (coverageValue.hasBm25Lite && coverageValue.hasFullHybridRerank),
    cloudProviderStrategies,
  };
}

function envReadiness(items) {
  const localQueryExpansionReady =
    Boolean(String(process.env.SELFMEM_QUERY_EXPANSION_BASE_URL ?? "").trim()) &&
    Boolean(String(process.env.SELFMEM_QUERY_EXPANSION_MODEL ?? "").trim());
  const cloudQueryExpansionReady =
    truthyEnv("RECALLWEAVE_QUERY_EXPANSION_CALLS") ||
    (truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS") && truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA"));
  return {
    liveExportEnabled: Boolean(args.live) || truthyEnv("RECALLWEAVE_BASELINE_LIVE"),
    noRawTextConfirmed: truthyEnv("RECALLWEAVE_BASELINE_NO_RAW_TEXT"),
    supermemorySearchPolicy: "disabled-for-benchmark-methodology",
    supermemorySearchDisabled: true,
    providerCallsEnabled: truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS"),
    providerPublicDataConfirmed: truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA"),
    providerExecutionPolicy: buildProviderExecutionPolicy(items),
    queryExpansionReady: !items.includes("query-expanded-full-hybrid-rerank") || localQueryExpansionReady || cloudQueryExpansionReady || fixtureRequested,
    localQueryExpansionEndpointPresent: localQueryExpansionReady,
    valuePrinted: false,
  };
}

function buildProviderExecutionPolicy(items) {
  const providers = [...new Set(items.flatMap(requiredProvidersForStrategy))].sort();
  const throttleScope = providerThrottleScope();
  return {
    throttleScope,
    keyScopedThrottleEnabled: throttleScope === "key",
    retryAttempts: positiveIntOrDefault(process.env.RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS, 4),
    timeoutMs: positiveIntOrDefault(process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS, 60_000),
    globalMinIntervalMs: positiveIntOrDefault(process.env.RECALLWEAVE_PROVIDER_MIN_INTERVAL_MS, 0),
    providers: Object.fromEntries(
      providers.map((provider) => {
        const throttleKey = providerThrottleKey(provider);
        return [
          provider,
          {
            minIntervalMs: positiveIntOrDefault(
              process.env[`${throttleKey.toUpperCase()}_PROVIDER_MIN_INTERVAL_MS`] ?? process.env.RECALLWEAVE_PROVIDER_MIN_INTERVAL_MS,
              0,
            ),
          },
        ];
      }),
    ),
  };
}

function requiredProvidersForStrategy(strategy) {
  if (strategy === "cloud-gemini-embed-rerank-proxy" || strategy === "cloud-gemini2-embed-rerank-proxy") return ["gemini"];
  if (strategy === "cloud-gemini-voyage-rerank" || strategy === "cloud-gemini2-voyage-rerank") return ["gemini", "voyage"];
  if (
    strategy === "cloud-voyage-rerank-only" ||
    strategy === "cloud-voyage4-voyage" ||
    strategy === "cloud-voyage4-voyage-lite-rerank" ||
    strategy === "cloud-voyage4-lite-voyage-lite"
  ) return ["voyage"];
  if (strategy.startsWith("cloud-nvidia-")) return ["nvidia"];
  if (strategy === "local-apple-qwen3-0_6b-local-rerank" || strategy === "local-apple-qwen3-4b-local-rerank") return ["local-apple", "local-rerank"];
  if (strategy === "local-apple-qwen3-0_6b" || strategy === "local-apple-qwen3-4b") return ["local-apple"];
  return [];
}

function providerThrottleScope() {
  const value = String(process.env.RECALLWEAVE_PROVIDER_THROTTLE_SCOPE ?? "provider").trim().toLowerCase();
  return value === "key" || value === "per-key" || value === "credential" ? "key" : "provider";
}

function providerThrottleKey(provider) {
  const normalized = String(provider ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized.startsWith("nvidia")) return "nvidia";
  if (normalized.startsWith("gemini")) return "gemini";
  if (normalized.startsWith("voyage")) return "voyage";
  if (normalized.startsWith("local")) return "local";
  return normalized.replace(/-/g, "_") || "provider";
}

function positiveIntOrDefault(value, fallback) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, "provider execution policy values must be non-negative integers");
  return number;
}

function inspectLocalEmbeddingDurability(coverageValue) {
  const applicable = coverageValue.hasLocalApple;
  const required =
    applicable && (Boolean(args.requireLocalEmbeddingDurability) || truthyEnv("RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY"));
  if (!applicable) {
    return {
      applicable: false,
      required: false,
      ready: null,
      reportPresent: false,
      valuePrinted: false,
      blockers: [],
    };
  }
  if (!required) {
    return {
      applicable: true,
      required: false,
      ready: null,
      reportPresent: Boolean(localEmbeddingDurabilityReportPath),
      valuePrinted: false,
      blockers: [],
    };
  }
  if (!localEmbeddingDurabilityReportPath || !existsSync(localEmbeddingDurabilityReportPath)) {
    return {
      applicable: true,
      required: true,
      ready: false,
      reportPresent: false,
      valuePrinted: false,
      blockers: ["local-embedding-durability-report-missing"],
    };
  }
  if (statSync(localEmbeddingDurabilityReportPath).size === 0) {
    return {
      applicable: true,
      required: true,
      ready: false,
      reportPresent: true,
      pathLabel: "public-evidence-file",
      valuePrinted: false,
      blockers: ["local-embedding-durability-report-empty"],
    };
  }
  const raw = readFileSync(localEmbeddingDurabilityReportPath, "utf8");
  assertSafePublicText(raw, "local embedding durability report");
  const parsed = JSON.parse(raw);
  const ready =
    parsed.mode === "local-embedding-durability-smoke" &&
    parsed.status === "READY_LOCAL_EMBEDDING_DURABILITY" &&
    parsed.readyForLocalAppleArmExport === true &&
    parsed.syntheticOnly === true &&
    parsed.metricsOnly === true &&
    parsed.publicSafe === true &&
    parsed.rawSyntheticInputIncluded === false &&
    parsed.baseUrlPrinted === false &&
    parsed.endpointPrinted === false &&
    parsed.publicBenchmarkClaimsAllowed === false &&
    parsed.countsAsLocalFullBenchmarkEvidence === false &&
    parsed.countsAsFullMemorySotaEvidence === false &&
    arrayOf(parsed.blockers).length === 0;
  return {
    applicable: true,
    required: true,
    ready,
    reportPresent: true,
    pathLabel: isInsideRepo(localEmbeddingDurabilityReportPath) ? displayPath(localEmbeddingDurabilityReportPath) : "public-evidence-file",
    hash: `sha256:${sha256(raw)}`,
    status: parsed.status ?? null,
    readyForLocalAppleArmExport: Boolean(parsed.readyForLocalAppleArmExport),
    syntheticOnly: Boolean(parsed.syntheticOnly),
    rawSyntheticInputIncluded: Boolean(parsed.rawSyntheticInputIncluded),
    baseUrlPrinted: Boolean(parsed.baseUrlPrinted),
    endpointPrinted: Boolean(parsed.endpointPrinted),
    probeCount: Number(parsed.probes?.length ?? 0),
    valuePrinted: false,
    blockers: ready ? [] : ["local-embedding-durability-report-not-ready"],
  };
}

function answerQualityArmArgs(items) {
  return items.map((strategy) => `--arm ${strategy}=<private-output-dir>/${strategy}-responses.private.json`);
}

function nextActions(statusValue) {
  if (statusValue === "EXPORTED_RESPONSE_ARMS") {
    return [
      "Run benchmark:answer-quality:preflight with these arm files and the private materialized query set, memories, and answer labels.",
      "Run benchmark:answer-quality only after the preflight passes and answer-quality model-call consent is explicit.",
      "Attach the metrics-only answer-quality result to benchmark:memory-score:result-gate --require-ready.",
    ];
  }
  if (statusValue === "READY_TO_EXPORT_RESPONSE_ARMS") {
    return [
      "Re-run this command with --execute to write the private response arm files outside the repository.",
      "Keep the generated response files private; only commit metrics-only hashes and aggregate evidence.",
      "Then run benchmark:answer-quality:preflight before answer-quality model scoring.",
    ];
  }
  return [
    "Materialize the source-locked LongMemEval target into a private directory outside the repository.",
    "Set RECALLWEAVE_BASELINE_LIVE=1 and RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 for live exports.",
    "Run benchmark:local-embedding:durability before exporting local Apple embedding arms.",
    "Enable provider or local endpoint consent only for the arms being tested.",
    "Keep BM25, full-hybrid, query-expansion, provider, local Apple, and local rerank arms on the same data.",
  ];
}

function defaultStrategies() {
  return [
    "bm25-lite",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
    "cloud-gemini2-embed-rerank-proxy",
    "cloud-voyage4-voyage-lite-rerank",
    "cloud-nvidia-nv-embed-v1-mistral-rerank",
    "local-apple-qwen3-0_6b",
    "local-apple-qwen3-0_6b-local-rerank",
  ];
}

function isProviderChallenger(strategy) {
  return strategy.startsWith("cloud-") || strategy.startsWith("local-apple-");
}

function truthyEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] ?? ""));
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (parsed[key] == null) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
    if (value !== true) index += 1;
  }
  return parsed;
}

function resolveOptionalPath(value) {
  return value ? resolveInputPath(value) : null;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function assertOutsideRepo(path, label) {
  assert.ok(!isInsideRepo(path), `${label} must stay outside the repository`);
}

function isInsideRepo(path) {
  const rel = relative(root, resolve(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function writePublicOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function positiveInt(value, label) {
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "" || value === false) return null;
  return positiveInt(value, label);
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "" || value === false) return 0;
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed >= 0, `${label} must be a non-negative integer`);
  return parsed;
}

function assertSafePublicText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privatePathPattern, `${label} contains a private local path`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
  assertNoPattern(text, /\b(q|answer|content|memory|text|raw|prompt)"\s*:/, `${label} contains raw text-like fields`);
}

function assertNoPattern(text, pattern, message) {
  pattern.lastIndex = 0;
  if (pattern.test(String(text))) throw new Error(message);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function safeError(value) {
  return String(value ?? "")
    .replace(secretPattern, "<redacted-secret>")
    .replace(privatePathPattern, "external-input")
    .slice(0, 400);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function renderMarkdown(value) {
  return [
    "# Answer-Quality Response Arm Export",
    "",
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Executes exports: ${value.executesExports}`,
    `- Writes private response files: ${value.writesPrivateResponseFiles}`,
    `- Ready for answer-quality preflight: ${value.readyForAnswerQualityPreflight}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Calls provider APIs: ${value.callsProviderApis}`,
    `- Sends benchmark text to provider: ${value.sendsBenchmarkTextToProvider}`,
    `- Query shard requested: ${value.queryShard.requested}`,
    `- Query offset: ${value.queryShard.queryOffset}`,
    `- Max queries: ${value.queryShard.maxQueries ?? "all"}`,
    "",
    "## Strategy Coverage",
    `- BM25 lite: ${value.strategyCoverage.hasBm25Lite}`,
    `- Full hybrid rerank: ${value.strategyCoverage.hasFullHybridRerank}`,
    `- Query expansion: ${value.strategyCoverage.hasQueryExpansion}`,
    `- Provider challenger: ${value.strategyCoverage.hasProviderChallenger}`,
    `- Local Apple: ${value.strategyCoverage.hasLocalApple}`,
    `- Local rerank: ${value.strategyCoverage.hasLocalRerank}`,
    "",
    "## Provider Hybrid Contract",
    `- BM25 lexical floor required: ${value.providerHybridContract.bm25LexicalFloorRequired}`,
    `- Full hybrid control required: ${value.providerHybridContract.fullHybridControlRequired}`,
    `- Same-shard controls required: ${value.providerHybridContract.sameShardControlsRequired}`,
    `- Provider challengers are hybrid context arms: ${value.providerHybridContract.providerChallengersAreHybridContextArms}`,
    `- Provider-only dense claims allowed: ${value.providerHybridContract.providerOnlyDenseClaimsAllowed}`,
    `- Provider challenger controls present: ${value.providerHybridContract.providerChallengerControlsPresent}`,
    `- Cloud provider strategies: ${value.providerHybridContract.cloudProviderStrategies.join(", ") || "none"}`,
    "",
    "## Provider Execution Policy",
    `- Throttle scope: ${value.env.providerExecutionPolicy.throttleScope}`,
    `- Key-scoped throttle enabled: ${value.env.providerExecutionPolicy.keyScopedThrottleEnabled}`,
    `- Retry attempts: ${value.env.providerExecutionPolicy.retryAttempts}`,
    `- Timeout ms: ${value.env.providerExecutionPolicy.timeoutMs}`,
    `- Global min interval ms: ${value.env.providerExecutionPolicy.globalMinIntervalMs}`,
    ...Object.entries(value.env.providerExecutionPolicy.providers).map(
      ([provider, state]) => `- ${provider}: minIntervalMs=${state.minIntervalMs}`,
    ),
    "",
    "## Local Embedding Durability",
    `- Applicable: ${value.localEmbeddingDurability.applicable}`,
    `- Required: ${value.localEmbeddingDurability.required}`,
    `- Ready: ${value.localEmbeddingDurability.ready ?? "n/a"}`,
    `- Report present: ${value.localEmbeddingDurability.reportPresent}`,
    `- Report: ${value.localEmbeddingDurability.pathLabel ?? "n/a"}`,
    "",
    "## Arms",
    ...value.arms.map(
      (arm) =>
        `- ${arm.strategy}: exported=${arm.exported}, responses=${arm.responseCount ?? 0}, providerCalls=${arm.providerCallsMade ?? 0}, queryExpansionCalls=${arm.queryExpansionCalls ?? 0}, shard=${arm.queryShard?.startIndex ?? arm.queryShard?.queryOffset ?? "n/a"}-${arm.queryShard?.endIndexExclusive ?? "n/a"}`,
    ),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Answer-Quality Arm Args",
    "```bash",
    ...value.answerQualityArmArgs,
    "```",
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}
