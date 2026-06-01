import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProviderBudgetContract } from "./provider-budget-contract.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const targetPath = resolveInputPath(args.target ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ?? "reviews/overnight-20260522/public-longmemeval-run-target.json");
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ? resolveInputPath(args.markdownOutput) : null;
const requireReady = Boolean(args.requireReady);
const memoryMethod = String(args.memoryMethod ?? process.env.RECALLWEAVE_MEMORYBENCH_MEMORY_METHOD ?? "session-v1").trim() || "session-v1";
const materializationContractCheckEnabled =
  !Boolean(args.skipMaterializationContractCheck) && (requireReady || Boolean(args.materializationContractCheck));
const strategies = splitList(
  args.strategies ??
    process.env.RECALLWEAVE_PUBLIC_PROVIDER_PREFLIGHT_STRATEGIES ??
    "bm25-lite,full-hybrid-rerank,cloud-voyage-rerank-only,cloud-voyage4-voyage,cloud-gemini-embed-rerank-proxy,cloud-gemini-voyage-rerank,cloud-gemini2-embed-rerank-proxy,cloud-gemini2-voyage-rerank,cloud-nvidia-nv-embed-v1-mistral-rerank,cloud-nvidia-embedcode-7b-mistral-rerank,local-apple-qwen3-0_6b",
);

const knownStrategies = new Set([
  "bm25-lite",
  "full-hybrid-rerank",
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
  "cloud-nvidia-nv-embed-v1-mistral-rerank",
  "cloud-nvidia-embedcode-7b-mistral-rerank",
  "local-apple-qwen3-0_6b",
  "local-apple-qwen3-0_6b-local-rerank",
  "local-apple-qwen3-4b",
  "local-apple-qwen3-4b-local-rerank",
]);
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;

for (const strategy of strategies) assert.ok(knownStrategies.has(strategy), `unknown provider benchmark strategy: ${strategy}`);
assert.ok(existsSync(targetPath), `benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `benchmark target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafeText(targetRaw, "benchmark target");
const target = JSON.parse(targetRaw);
const targetOk = target.fixtureOnly === false && target.benchmark?.family === "longmemeval" && target.claimTier === "run-only";
const materializationContract = materializationContractCheckEnabled && targetOk
  ? runMaterializationContractCheck({ targetPath, memoryMethod })
  : {
      enabled: materializationContractCheckEnabled,
      ok: !materializationContractCheckEnabled,
      skipped: true,
      reason: targetOk ? "not-requested" : "target-not-public-longmemeval-run-only",
    };
const providerCallsEnabled = process.env.RECALLWEAVE_PROVIDER_BENCHMARK_CALLS === "1";
const publicDataConfirmed = process.env.RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA === "1";
const requiredProviders = [...new Set(strategies.flatMap(requiredProvidersForStrategy))].sort();
const providerBudget = buildProviderBudgetContract({
  root,
  benchmarkKind: "provider-benchmark-live-preflight",
  fixtureOnly: false,
  providerCallsEnabled,
  publicDataConfirmed,
  requiredProviders,
});
const credentialPresence = Object.fromEntries(
  requiredProviders.map((provider) => [
    provider,
    {
      present: providerKeyCount(provider) > 0,
      keyCount: providerKeyCount(provider),
      envNames: providerEnvNames(provider),
    },
  ]),
);
const providerExecutionPolicy = buildProviderExecutionPolicy(requiredProviders);
const missingCredentialProviders = requiredProviders.filter((provider) => !credentialPresence[provider]?.present);
const queryExpansion = buildQueryExpansionReadiness(strategies);
const blockers = [
  !targetOk ? "target-not-public-longmemeval-run-only" : null,
  materializationContract.enabled && !materializationContract.ok ? "target-materialization-contract-failed" : null,
  !providerCallsEnabled ? "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled" : null,
  !publicDataConfirmed ? "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed" : null,
  ...missingCredentialProviders.map((provider) => `${provider}-credentials-missing`),
  ...queryExpansion.blockers,
  ...providerBudget.blockers,
].filter(Boolean);
const ready = blockers.length === 0;

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "provider-benchmark-live-preflight",
  status: ready ? "READY_FOR_LIVE_PROVIDER_BENCHMARK" : "BLOCKED_PROVIDER_ENV",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  publicSafe: true,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  printsCredentials: false,
  target: {
    path: displayPath(targetPath),
    hash: `sha256:${sha256(targetRaw)}`,
    fixtureOnly: Boolean(target.fixtureOnly),
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
    claimTier: target.claimTier ?? null,
    querySelectionPolicyHash: hashNullable(target.benchmark?.questionIdPolicy),
    answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
  },
  memoryMethod,
  materializationContract,
  strategies,
  requiredProviders,
  providerCallsEnabled,
  publicDataConfirmed,
  providerBudget,
  queryExpansion,
  credentialPresence,
  providerExecutionPolicy,
  missingCredentialProviders,
  singleProviderArmReady: requiredProviders.length === 1,
  liveRunAllowed: ready,
  blockers,
  nextActions: ready
    ? [
        "Run benchmark:public-provider with --live against the source-locked target.",
        "Keep reports metrics-only until MemoryBench answer-quality or another end-to-end memory score is run.",
      ]
    : [
        "Set provider credentials only in the shell environment, never in committed files.",
        "Set RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 and RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 only for public benchmark slices.",
        "Re-run this preflight before spending provider calls.",
      ],
  liveCommandTemplate: liveCommandTemplate({ requiredProviders, strategies, targetPath }),
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafeText(serialized, "provider live preflight report");
if (outputPath) writeOutput(outputPath, serialized);
if (markdownOutputPath) writeOutput(markdownOutputPath, `${toMarkdown(report)}\n`);
process.stdout.write(serialized);
if (!report.ok) process.exitCode = 1;

function requiredProvidersForStrategy(strategy) {
  if (strategy === "query-expanded-full-hybrid-rerank") return [];
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

function providerKeyCount(provider) {
  return providerKeys(provider).length;
}

function providerKeys(provider) {
  return uniqueProviderKeys([
    ...providerValueEnvNames(provider).flatMap((name) => splitList(process.env[name] ?? "")),
    ...providerKeyFileEnvNames(provider).flatMap(keysFromPrivateFileEnv),
  ]);
}

function uniqueProviderKeys(keys) {
  return [...new Set(keys.map((key) => String(key ?? "").trim()).filter(Boolean))];
}

function providerEnvNames(provider) {
  return [...providerValueEnvNames(provider), ...providerKeyFileEnvNames(provider)];
}

function providerValueEnvNames(provider) {
  if (provider === "gemini") return ["GEMINI_API_KEY", "GEMINI_API_KEYS", "GOOGLE_API_KEY", "GOOGLE_API_KEYS", "AI_STUDIO_API_KEY", "AI_STUDIO_API_KEYS"];
  if (provider === "voyage") return ["VOYAGE_API_KEY", "VOYAGE_API_KEYS"];
  if (provider === "nvidia") return ["NVIDIA_API_KEY", "NVIDIA_API_KEYS", "NVAPI_KEY", "NVAPI_KEYS"];
  if (provider === "openrouter") return ["OPENROUTER_API_KEY", "OPENROUTER_API_KEYS"];
  if (provider === "deepseek") return ["DEEPSEEK_API_KEY", "DEEPSEEK_API_KEYS"];
  if (provider === "local-apple") return ["SELFMEM_LOCAL_EMBED_BASE_URL"];
  if (provider === "local-rerank") return ["SELFMEM_LOCAL_RERANK_ENDPOINT", "SELFMEM_LOCAL_RERANK_BASE_URL"];
  return [];
}

function providerKeyFileEnvNames(provider) {
  if (provider === "gemini") return ["GEMINI_API_KEY_FILE", "GEMINI_API_KEYS_FILE", "GOOGLE_API_KEY_FILE", "GOOGLE_API_KEYS_FILE", "AI_STUDIO_API_KEY_FILE", "AI_STUDIO_API_KEYS_FILE"];
  if (provider === "voyage") return ["VOYAGE_API_KEY_FILE", "VOYAGE_API_KEYS_FILE"];
  if (provider === "nvidia") return ["NVIDIA_API_KEY_FILE", "NVIDIA_API_KEYS_FILE", "NVAPI_KEY_FILE", "NVAPI_KEYS_FILE"];
  if (provider === "openrouter") return ["OPENROUTER_API_KEY_FILE", "OPENROUTER_API_KEYS_FILE"];
  if (provider === "deepseek") return ["DEEPSEEK_API_KEY_FILE", "DEEPSEEK_API_KEYS_FILE"];
  return [];
}

function keysFromPrivateFileEnv(envName) {
  const value = process.env[envName];
  if (!value) return [];
  const resolved = resolveInputPath(value);
  assert.ok(existsSync(resolved), `${envName} points to a missing provider key file`);
  assert.ok(statSync(resolved).isFile(), `${envName} must point to a provider key file`);
  assertOutsideRepo(resolved, `${envName} provider key file`);
  return splitList(readFileSync(resolved, "utf8"));
}

function liveCommandTemplate({ requiredProviders, strategies, targetPath }) {
  return [
    "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1",
    "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1",
    "RECALLWEAVE_PROVIDER_THROTTLE_SCOPE=key",
    "RECALLWEAVE_PROVIDER_MIN_INTERVAL_MS=<optional-provider-or-key-paced-ms>",
    ...requiredProviders.flatMap(providerEnvTemplateLines),
    [
      "npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live",
      `--target ${displayPath(targetPath)}`,
      `--strategies ${strategies.join(",")}`,
    ].join(" "),
  ];
}

function providerEnvTemplateLines(provider) {
  if (provider === "gemini") return ["GEMINI_API_KEY=<env-only-gemini-key>", "GEMINI_API_KEYS_FILE=<optional-private-gemini-key-file>"];
  if (provider === "voyage") return ["VOYAGE_API_KEY=<env-only-voyage-key>", "VOYAGE_API_KEYS_FILE=<optional-private-voyage-key-file>"];
  if (provider === "nvidia") return ["NVIDIA_API_KEY=<env-only-nvidia-key>", "NVIDIA_API_KEYS_FILE=<optional-private-nvidia-key-file>"];
  if (provider === "local-apple") return ["SELFMEM_LOCAL_EMBED_BASE_URL=<env-only-local-apple-server-url>"];
  if (provider === "local-rerank") return ["SELFMEM_LOCAL_RERANK_ENDPOINT=<env-only-local-rerank-endpoint>"];
  return [];
}

function buildProviderExecutionPolicy(providers) {
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
            keyCount: providerKeyCount(provider),
          },
        ];
      }),
    ),
  };
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

function buildQueryExpansionReadiness(strategies) {
  const requested = strategies.includes("query-expanded-full-hybrid-rerank");
  const mode = queryExpansionMode();
  const localConfigured = Boolean(process.env.SELFMEM_QUERY_EXPANSION_BASE_URL && process.env.SELFMEM_QUERY_EXPANSION_MODEL);
  const cloudCallsAllowed = process.env.RECALLWEAVE_QUERY_EXPANSION_CALLS === "1" || providerCallsEnabled;
  const publicDataAllowed = process.env.RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA === "1" || publicDataConfirmed;
  const providerOrder = splitList(process.env.RECALLWEAVE_QUERY_EXPANSION_PROVIDER_ORDER ?? process.env.SELFMEM_QUERY_EXPANSION_PROVIDER_ORDER ?? "deepseek,nvidia,gemini,openrouter")
    .map(normalizeQueryExpansionProvider)
    .filter(Boolean);
  const configuredProviders = providerOrder.filter((provider) => providerKeyCount(provider) > 0);
  const unsupportedMode = mode === "unsupported";
  const externalProviderRequired = requested && mode === "rewrites" && !localConfigured;
  const blockers = [
    requested && unsupportedMode ? "query-expansion-mode-unsupported" : null,
    externalProviderRequired && !cloudCallsAllowed ? "RECALLWEAVE_QUERY_EXPANSION_CALLS-not-enabled" : null,
    externalProviderRequired && !publicDataAllowed ? "RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA-not-confirmed" : null,
    externalProviderRequired && configuredProviders.length === 0 ? "query-expansion-provider-credentials-missing" : null,
  ].filter(Boolean);
  return {
    requested,
    mode,
    externalProviderRequired,
    localOpenAiCompatibleConfigured: localConfigured,
    cloudCallsAllowed,
    publicDataAllowed,
    providerOrder,
    configuredProviderFamilies: configuredProviders,
    ready: !requested || (!unsupportedMode && (mode !== "rewrites" || localConfigured || (cloudCallsAllowed && publicDataAllowed && configuredProviders.length > 0))),
    sendsOnlyCurrentQuery: true,
    storedMemoriesSent: false,
    blockers,
  };
}

function normalizeQueryExpansionProvider(provider) {
  const value = String(provider ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!value) return "";
  if (value.startsWith("nvidia") || value.startsWith("nvapi")) return "nvidia";
  if (value.startsWith("gemini") || value.startsWith("google")) return "gemini";
  if (value.startsWith("openrouter") || value.startsWith("open-router")) return "openrouter";
  if (value.startsWith("deepseek")) return "deepseek";
  return value;
}

function queryExpansionMode() {
  const value = String(process.env.RECALLWEAVE_QUERY_EXPANSION_MODE ?? process.env.SELFMEM_QUERY_EXPANSION_MODE ?? "off")
    .trim()
    .toLowerCase();
  if (["0", "false", "no", "disabled"].includes(value)) return "off";
  if (["1", "true", "yes", "enabled", "provider", "providers", "cloud", "llm", "rewrite"].includes(value)) return "rewrites";
  if (["off", "planner", "rewrites"].includes(value)) return value;
  return "unsupported";
}

function runMaterializationContractCheck({ targetPath, memoryMethod }) {
  const result = spawnSync(
    process.execPath,
    [
      "packages/bench/public-benchmark-materialize-run.mjs",
      "--live",
      "--contract-check",
      "--target",
      targetPath,
      "--memory-method",
      memoryMethod,
    ],
    {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    return {
      enabled: true,
      ok: false,
      status: result.status,
      signal: result.signal ?? null,
      stdoutHash: result.stdout ? `sha256:${sha256(result.stdout)}` : null,
      stderrHash: result.stderr ? `sha256:${sha256(result.stderr)}` : null,
      error: "materialization-contract-check-failed",
    };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      enabled: true,
      ok: parsed.ok === true && parsed.mode === "public-benchmark-materialize-contract-check",
      status: result.status,
      mode: parsed.mode,
      targetFileHash: parsed.target?.targetFileHash ?? null,
      datasetHash: parsed.source?.datasetHash ?? null,
      selectedCount: parsed.selection?.selectedCount ?? null,
      targetSelectedQuestionIdsHash: parsed.selection?.targetSelectedQuestionIdsHash ?? null,
      targetAnswerLabelsHash: parsed.selection?.targetAnswerLabelsHash ?? null,
    };
  } catch {
    return {
      enabled: true,
      ok: false,
      status: result.status,
      stdoutHash: result.stdout ? `sha256:${sha256(result.stdout)}` : null,
      stderrHash: result.stderr ? `sha256:${sha256(result.stderr)}` : null,
      error: "materialization-contract-check-json-parse-failed",
    };
  }
}

function positiveIntOrDefault(value, fallback) {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, "provider execution policy values must be non-negative integers");
  return number;
}

function toMarkdown(value) {
  return [
    "# Provider Benchmark Live Preflight",
    "",
    `Status: ${value.status}`,
    `Live run allowed: ${value.liveRunAllowed}`,
    `Calls provider APIs: ${value.callsProviderApis}`,
    `Sends benchmark text to provider: ${value.sendsBenchmarkTextToProvider}`,
    `Target hash: ${value.target.hash}`,
    `Benchmark: ${value.target.benchmark}`,
    `Memory method: ${value.memoryMethod}`,
    `Materialization contract: ${value.materializationContract.ok ? "ok" : "blocked"}`,
    "",
    "## Strategies",
    "",
    ...value.strategies.map((strategy) => `- ${strategy}`),
    "",
    "## Provider Readiness",
    "",
    `- Provider calls enabled: ${value.providerCallsEnabled}`,
    `- Public data confirmed: ${value.publicDataConfirmed}`,
    ...Object.entries(value.credentialPresence).map(([provider, state]) => `- ${provider}: ${state.present ? "present" : "missing"} (${state.envNames.join(", ")})`),
    "",
    "## Query Expansion",
    "",
    `- Requested: ${value.queryExpansion.requested}`,
    `- Mode: ${value.queryExpansion.mode}`,
    `- External provider required: ${value.queryExpansion.externalProviderRequired}`,
    `- Local OpenAI-compatible configured: ${value.queryExpansion.localOpenAiCompatibleConfigured}`,
    `- Cloud calls allowed: ${value.queryExpansion.cloudCallsAllowed}`,
    `- Public data allowed: ${value.queryExpansion.publicDataAllowed}`,
    `- Configured provider families: ${value.queryExpansion.configuredProviderFamilies.join(", ") || "none"}`,
    `- Sends only current query: ${value.queryExpansion.sendsOnlyCurrentQuery}`,
    `- Stored memories sent: ${value.queryExpansion.storedMemoriesSent}`,
    "",
    "## Provider Execution Policy",
    "",
    `- Throttle scope: ${value.providerExecutionPolicy.throttleScope}`,
    `- Key-scoped throttle enabled: ${value.providerExecutionPolicy.keyScopedThrottleEnabled}`,
    `- Retry attempts: ${value.providerExecutionPolicy.retryAttempts}`,
    `- Timeout ms: ${value.providerExecutionPolicy.timeoutMs}`,
    `- Global min interval ms: ${value.providerExecutionPolicy.globalMinIntervalMs}`,
    ...Object.entries(value.providerExecutionPolicy.providers).map(
      ([provider, state]) => `- ${provider}: minIntervalMs=${state.minIntervalMs}, keyCount=${state.keyCount}`,
    ),
    "",
    "## Provider Budget Contract",
    "",
    `- Mode: ${value.providerBudget.mode}`,
    `- Max paid USD: ${value.providerBudget.maxPaidUsd}`,
    `- Required providers: ${value.providerBudget.requiredProviders.join(", ") || "none"}`,
    `- Required providers within allowed set: ${value.providerBudget.requiredProvidersWithinAllowed}`,
    `- Paid provider requested in no-spend mode: ${value.providerBudget.paidProviderRequestedInNoSpendMode}`,
    `- Cross-provider fallback enabled: ${value.providerBudget.fallbackPolicy.crossProviderFallbackEnabled}`,
    `- Cache provider outputs before full wave: ${value.providerBudget.cachePolicy.reuseCachedProviderOutputsBeforeFullWave}`,
    "",
    "## Blockers",
    "",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    "",
    ...value.nextActions.map((item) => `- ${item}`),
    "",
    "## Live Command Template",
    "",
    "```bash",
    ...value.liveCommandTemplate,
    "```",
  ].join("\n");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path or raw memory artifact name`);
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function assertOutsideRepo(path, label) {
  const rel = relative(root, path);
  assert.ok(rel.startsWith("..") || isAbsolute(rel), `${label} must live outside the repository`);
}

function splitList(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hashNullable(value) {
  return value == null ? null : `sha256:${sha256(String(value))}`;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--require-ready") {
      parsed.requireReady = true;
    } else if (item.startsWith("--")) {
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
