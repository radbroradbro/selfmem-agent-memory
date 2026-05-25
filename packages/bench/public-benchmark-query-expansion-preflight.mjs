import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ?? process.env.RECALLWEAVE_QUERY_EXPANSION_PREFLIGHT_OUTPUT ?? null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ?? process.env.RECALLWEAVE_QUERY_EXPANSION_PREFLIGHT_MARKDOWN ?? null;
const requireReady = Boolean(args.requireReady);

const configs = {
  providerMatrix: loadText("configs/provider-matrix.yaml"),
  defaultLocal: loadText("configs/default.local.yaml"),
  defaultCloud: loadText("configs/default.cloud.yaml"),
  benchBudget: loadText("configs/bench-budget.yaml"),
};
const implementationText = readFileSync(resolve(root, "packages/bench/recallweave-response-export.mjs"), "utf8");

const localEnv = {
  baseUrl: envPresence("SELFMEM_QUERY_EXPANSION_BASE_URL"),
  model: envPresence("SELFMEM_QUERY_EXPANSION_MODEL"),
  apiKey: envPresence("SELFMEM_QUERY_EXPANSION_API_KEY"),
};
const cloudEnv = {
  nvidia: providerPresence(["NVIDIA_API_KEY", "NVIDIA_API_KEYS", "NVAPI_KEY", "NVAPI_KEYS", "NVIDIA_API_KEY_FILE", "NVIDIA_API_KEYS_FILE", "NVAPI_KEY_FILE", "NVAPI_KEYS_FILE"]),
  gemini: providerPresence(["GEMINI_API_KEY", "GEMINI_API_KEYS", "GOOGLE_API_KEY", "GOOGLE_API_KEYS", "AI_STUDIO_API_KEY", "AI_STUDIO_API_KEYS", "GEMINI_API_KEY_FILE", "GEMINI_API_KEYS_FILE"]),
  openrouter: providerPresence(["OPENROUTER_API_KEY", "OPENROUTER_API_KEYS", "OPENROUTER_API_KEY_FILE", "OPENROUTER_API_KEYS_FILE"]),
};
const consent = {
  providerCalls: truthyEnv("RECALLWEAVE_QUERY_EXPANSION_CALLS") || truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS"),
  publicData: truthyEnv("RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA") || truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA"),
};

const configContract = {
  providerMatrixDefaultEnabledFalse: /queryExpansion:[\s\S]*?defaultEnabled:\s*false/.test(configs.providerMatrix.text),
  defaultLocalEnabledFalse: /queryExpansion:[\s\S]*?enabled:\s*false/.test(configs.defaultLocal.text),
  defaultCloudEnabledFalse: /queryExpansion:[\s\S]*?enabled:\s*false/.test(configs.defaultCloud.text),
  rewriteQueryDefaultFalse:
    /retrieval:[\s\S]*?rewriteQuery:\s*false/.test(configs.defaultLocal.text) &&
    /retrieval:[\s\S]*?rewriteQuery:\s*false/.test(configs.defaultCloud.text),
  onlySendUserQuery:
    /onlySend:\s*user_query/.test(configs.providerMatrix.text) &&
    /onlySend:\s*user_query/.test(configs.defaultCloud.text),
  fallbackDisabled:
    /fallbackEnabled:\s*false/.test(configs.providerMatrix.text) &&
    /fallbackEnabled:\s*false/.test(configs.defaultLocal.text) &&
    /fallbackEnabled:\s*false/.test(configs.defaultCloud.text),
  providerMatrixHash: configs.providerMatrix.hash,
  defaultLocalHash: configs.defaultLocal.hash,
  defaultCloudHash: configs.defaultCloud.hash,
  benchBudgetHash: configs.benchBudget.hash,
};
const implementationContract = {
  responseExporterHash: `sha256:${sha256(implementationText)}`,
  liveRequestBuilderImported: /buildQueryExpansionRequest/.test(implementationText),
  liveQueryExpansionPlanPresent: /function queryExpansionPlan\(/.test(implementationText),
  openAiCompatibleQueryExpansionPresent: /function openAiCompatibleQueryExpansion\(/.test(implementationText),
  geminiQueryExpansionPresent: /function geminiQueryExpansion\(/.test(implementationText),
  deterministicFallbackPresent: /recordQueryExpansionFallback\("deterministic-proxy-not-configured"\)/.test(implementationText),
  metricsOnlyStatsPresent: /queryExpansionOnlyCurrentQuerySent/.test(implementationText) && /queryExpansionStoredMemoriesSent/.test(implementationText),
};
implementationContract.liveLlmExpansionWiringPresent =
  implementationContract.liveRequestBuilderImported &&
  implementationContract.liveQueryExpansionPlanPresent &&
  (implementationContract.openAiCompatibleQueryExpansionPresent || implementationContract.geminiQueryExpansionPresent) &&
  implementationContract.metricsOnlyStatsPresent;

const pureLocalReady = localEnv.baseUrl.present && localEnv.model.present && configContract.defaultLocalEnabledFalse;
const anyCloudCredential = Object.values(cloudEnv).some((value) => value.present);
const mixedCloudReady = consent.providerCalls && consent.publicData && anyCloudCredential && configContract.onlySendUserQuery;
const selectedMode = pureLocalReady
  ? "PURE_LOCAL_QUERY_EXPANSION_READY"
  : mixedCloudReady
    ? "MIXED_LOCAL_CLOUD_QUERY_EXPANSION_READY"
    : "BLOCKED_QUERY_EXPANSION_ENV";

const candidatePolicy = {
  currentAsOf: "2026-05-25",
  defaultState: "off",
  pureLocalCandidates: [
    {
      family: "Qwen 3.6",
      role: "bounded query rewrite and exact-identifier preserving expansion",
      sourceUse: "current-model-radar-needs-local-measurement",
      env: ["SELFMEM_QUERY_EXPANSION_BASE_URL", "SELFMEM_QUERY_EXPANSION_MODEL"],
    },
    {
      family: "Gemma 4",
      role: "small local instruction-model challenger for query rewrites",
      sourceUse: "current-model-radar-needs-local-measurement",
      env: ["SELFMEM_QUERY_EXPANSION_BASE_URL", "SELFMEM_QUERY_EXPANSION_MODEL"],
    },
    {
      family: "local:qwen3-0.6b-instruct",
      role: "repo-configured small local baseline",
      sourceUse: "provider-matrix-configured",
      env: ["SELFMEM_QUERY_EXPANSION_BASE_URL", "SELFMEM_QUERY_EXPANSION_MODEL"],
    },
  ],
  mixedCloudCandidates: [
    {
      family: "NVIDIA hosted LLM",
      role: "cloud query expansion when local 24GB-class hardware is the limiting factor",
      sourceUse: "nvidia-nim-sweep-configured",
      env: ["RECALLWEAVE_QUERY_EXPANSION_CALLS", "RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA", "NVIDIA_API_KEY or NVIDIA_API_KEYS_FILE"],
    },
    {
      family: "Gemini challenger",
      role: "cloud query expansion challenger if NVIDIA is unavailable",
      sourceUse: "default-cloud-configured",
      env: ["RECALLWEAVE_QUERY_EXPANSION_CALLS", "RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA", "GEMINI_API_KEY or GEMINI_API_KEY_FILE"],
    },
  ],
  labelRule: "A run with cloud query expansion must be reported as mixed local-plus-cloud, never as pure local.",
  payloadRule: "Only the current user query may be sent to a query expansion provider; stored memories, raw transcripts, provider keys, and private-tagged content stay out of provider payloads.",
};

const blockers = [
  !configContract.providerMatrixDefaultEnabledFalse ? "provider-matrix-query-expansion-not-default-off" : null,
  !configContract.defaultLocalEnabledFalse ? "default-local-query-expansion-not-default-off" : null,
  !configContract.defaultCloudEnabledFalse ? "default-cloud-query-expansion-not-default-off" : null,
  !configContract.rewriteQueryDefaultFalse ? "rewrite-query-not-default-false" : null,
  !configContract.onlySendUserQuery ? "query-expansion-payload-not-limited-to-user-query" : null,
  !configContract.fallbackDisabled ? "query-expansion-fallback-not-disabled" : null,
  !implementationContract.liveLlmExpansionWiringPresent ? "query-expansion-live-wiring-missing" : null,
  !implementationContract.deterministicFallbackPresent ? "query-expansion-deterministic-fallback-missing" : null,
  selectedMode === "BLOCKED_QUERY_EXPANSION_ENV" ? "no-query-expansion-arm-ready" : null,
  selectedMode === "MIXED_LOCAL_CLOUD_QUERY_EXPANSION_READY" && !consent.providerCalls ? "cloud-query-expansion-provider-calls-not-enabled" : null,
  selectedMode === "MIXED_LOCAL_CLOUD_QUERY_EXPANSION_READY" && !consent.publicData ? "cloud-query-expansion-public-data-not-confirmed" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: blockers.filter((item) => item !== "no-query-expansion-arm-ready").length === 0,
  mode: "public-benchmark-query-expansion-preflight",
  status: selectedMode,
  metricsOnly: true,
  publicSafe: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  printsCredentials: false,
  generatedAt: new Date().toISOString(),
  configContract,
  implementationContract,
  consent,
  localEnv,
  cloudEnv,
  readiness: {
    pureLocalReady,
    mixedCloudReady,
    selectedMode,
    queryExpansionCanBeBenchmarked: pureLocalReady || mixedCloudReady,
    liveLlmExpansionWiringPresent: implementationContract.liveLlmExpansionWiringPresent,
    countsAsPureLocal: pureLocalReady,
    countsAsMixedLocalCloud: mixedCloudReady && !pureLocalReady,
  },
  candidatePolicy,
  blockers,
  nextActions: nextActions({ pureLocalReady, mixedCloudReady }),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "query expansion preflight report");
assertSafePublicText(markdownText, "query expansion preflight markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(args.format === "markdown" ? markdownText : jsonText);
if (requireReady && !report.readiness.queryExpansionCanBeBenchmarked) process.exit(1);

function nextActions(state) {
  if (state.pureLocalReady) {
    return [
      "Run query-expanded-full-hybrid-rerank as a pure local query-expansion arm on the same source-locked target.",
      "Report query expansion latency separately from embedding and rerank latency.",
      "Compare against bm25-lite, dense/vector-only, full-hybrid-rerank, and provider arms before promotion.",
    ];
  }
  if (state.mixedCloudReady) {
    return [
      "Run query expansion as a clearly labeled mixed local-plus-cloud arm.",
      "Send only the current user query to the cloud query-expansion provider.",
      "Keep cloud query-expansion cost, latency, and provider name explicit in the benchmark report.",
    ];
  }
  return [
    "For pure local: start a local OpenAI-compatible query-expansion endpoint and set SELFMEM_QUERY_EXPANSION_BASE_URL plus SELFMEM_QUERY_EXPANSION_MODEL.",
    "For mixed cloud: set RECALLWEAVE_QUERY_EXPANSION_CALLS=1, RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=1, and an env-only provider key or key file.",
    "Keep query expansion off by default until a same-data canary wins and reviewers approve the exact metrics-only packet.",
  ];
}

function loadText(file) {
  const abs = resolve(root, file);
  assert.ok(existsSync(abs), `required config missing: ${file}`);
  const text = readFileSync(abs, "utf8");
  assertSafePublicText(text, file);
  return { path: file, text, hash: `sha256:${sha256(text)}` };
}

function envPresence(name) {
  const value = process.env[name];
  return {
    present: Boolean(value && String(value).trim()),
    envName: name,
    valuePrinted: false,
  };
}

function providerPresence(names) {
  const presentNames = names.filter((name) => envPresence(name).present);
  return {
    present: presentNames.length > 0,
    keyCount: presentNames.length,
    envNames: names,
    presentEnvNames: presentNames,
    valuesPrinted: false,
  };
}

function truthyEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] ?? ""));
}

function renderMarkdown(value) {
  const lines = [
    "# Query Expansion Benchmark Preflight",
    "",
    `- Status: ${value.status}`,
    `- Pure local ready: ${value.readiness.pureLocalReady}`,
    `- Mixed local-plus-cloud ready: ${value.readiness.mixedCloudReady}`,
    `- Sends benchmark text to provider: ${value.sendsBenchmarkTextToProvider}`,
    `- Live LLM wiring present: ${value.readiness.liveLlmExpansionWiringPresent}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Candidate Policy",
    `- Label rule: ${value.candidatePolicy.labelRule}`,
    `- Payload rule: ${value.candidatePolicy.payloadRule}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function writeOutput(path, text) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  assert.ok(!secretPattern.test(text), `${label} appears to contain a credential`);
}
