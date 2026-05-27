import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const requireReady = Boolean(args.requireReady);
const configEnvPath = stringOrNull(args.configEnv ?? process.env.SELFMEM_LOCAL_EMBED_CONFIG_ENV);
const configEnv = configEnvPath ? loadEnvFile(configEnvPath) : {};
const strategy = String(args.strategy ?? process.env.SELFMEM_LOCAL_EMBED_STRATEGY ?? "local-apple-qwen3-0_6b");
const expectedFamily = String(args.expectedFamily ?? process.env.SELFMEM_LOCAL_EMBED_EXPECTED_FAMILY ?? "qwen3-embedding");
const hfRepo = stringOrNull(args.hfRepo ?? args.hf ?? process.env.SELFMEM_LOCAL_EMBED_HF_REPO);
const modelName = String(args.model ?? process.env.SELFMEM_LOCAL_EMBED_MODEL ?? hfRepo ?? configEnv.MODEL_REPO ?? configEnv.MODEL_ALIAS ?? "");
const modelPath = stringOrNull(args.modelPath ?? process.env.SELFMEM_LOCAL_EMBED_MODEL_PATH ?? configEnv.MODEL_PATH);
const serverBin = stringOrNull(args.serverBin ?? process.env.SELFMEM_LOCAL_EMBED_SERVER_BIN ?? configEnv.SERVER_BIN);
const baseUrl = stringOrNull(args.baseUrl ?? process.env.SELFMEM_LOCAL_EMBED_BASE_URL) ?? localBaseUrlFromConfig(configEnv);
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.RECALLWEAVE_LOCAL_RUNTIME_TIMEOUT_MS ?? 3_000, "timeout ms");
const helpTimeoutMs = positiveInt(args.helpTimeoutMs ?? process.env.RECALLWEAVE_LOCAL_RUNTIME_HELP_TIMEOUT_MS ?? 15_000, "help timeout ms");

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const serverBinary = inspectServerBinary(serverBin, helpTimeoutMs);
const modelArtifact = inspectModelArtifact({ modelName, modelPath, hfRepo, expectedFamily });
const localEndpoint = await inspectLocalEndpoint(baseUrl, timeoutMs);

const ready =
  serverBinary.present === true &&
  serverBinary.executable === true &&
  serverBinary.helpSupportsEmbedding === true &&
  modelArtifact.configured === true &&
  modelArtifact.resolvable === true &&
  (modelArtifact.extension == null || modelArtifact.extension === ".gguf") &&
  modelArtifact.likelyDedicatedEmbedding === true &&
  modelArtifact.likelyVocabFixture === false &&
  modelArtifact.expectedFamilyMatched === true &&
  localEndpoint.configured === true &&
  localEndpoint.localOnly === true &&
  localEndpoint.modelsEndpointReachable === true;

const detailBlockers = [
  serverBinary.configured ? null : "local-embedding-server-bin-missing",
  serverBinary.configured && !serverBinary.present ? "local-embedding-server-bin-not-found" : null,
  serverBinary.present && !serverBinary.executable ? "local-embedding-server-bin-not-executable" : null,
  serverBinary.present && serverBinary.helpChecked && !serverBinary.helpSupportsEmbedding ? "local-embedding-server-bin-no-embedding-flag" : null,
  modelArtifact.configured ? null : "local-embedding-model-path-missing",
  modelArtifact.configured && modelArtifact.source === "local-path" && !modelArtifact.present ? "local-embedding-model-not-found" : null,
  modelArtifact.present && modelArtifact.extension !== ".gguf" ? "local-embedding-model-not-gguf" : null,
  modelArtifact.configured && modelArtifact.likelyVocabFixture ? "local-embedding-model-vocab-fixture" : null,
  modelArtifact.configured && !modelArtifact.likelyDedicatedEmbedding ? "local-embedding-model-not-dedicated-embedding" : null,
  modelArtifact.configured && !modelArtifact.expectedFamilyMatched ? "local-embedding-model-family-mismatch" : null,
  localEndpoint.configured ? null : "local-embedding-endpoint-missing",
  localEndpoint.configured && !localEndpoint.localOnly ? "local-embedding-endpoint-not-local" : null,
  localEndpoint.localOnly && !localEndpoint.modelsEndpointReachable ? "local-embedding-endpoint-not-reachable" : null,
  localEndpoint.failureClass,
].filter(Boolean);
const blockers = ready ? [] : [...new Set(["local-embedding-runtime-not-ready", ...detailBlockers])];

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "local-embedding-runtime-doctor",
  status: ready ? "READY_LOCAL_EMBEDDING_RUNTIME" : "BLOCKED_LOCAL_EMBEDDING_RUNTIME",
  generatedAt: new Date().toISOString(),
  strategy,
  expectedFamily,
  metricsOnly: true,
  publicSafe: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  callsLocalEndpoint: localEndpoint.configured,
  sendsBenchmarkTextToProvider: false,
  rawBenchmarkInputIncluded: false,
  rawConfigIncluded: false,
  rawServerHelpIncluded: false,
  configEnvProvided: Boolean(configEnvPath),
  hfRepoConfigured: Boolean(hfRepo),
  configEnvPathPrinted: false,
  hfRepoPrinted: false,
  privatePathPrinted: false,
  endpointPrinted: false,
  modelPathPrinted: false,
  serverBinPrinted: false,
  helpTimeoutMs,
  readyForLocalEmbeddingDurabilitySmoke: ready,
  readyForLocalAppleArmExport: ready,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  timeoutMs,
  serverBinary,
  modelArtifact,
  localEndpoint,
  blockers,
  nextActions: nextActions(ready, modelArtifact, localEndpoint),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local embedding runtime doctor report");
assertSafePublicText(markdownText, "local embedding runtime doctor markdown");

if (outputPath) await writeOutput(outputPath, jsonText);
if (markdownOutputPath) await writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function inspectServerBinary(path, helpTimeout) {
  const configured = Boolean(path);
  const present = configured && existsSync(path);
  const executable = present ? isExecutable(path) : false;
  const help = executable ? readServerHelp(path, helpTimeout) : { checked: false, supportsEmbedding: false, supportsRerank: false, timedOut: false };
  return {
    configured,
    present,
    executable,
    descriptorHash: configured ? `sha256:${sha256(basename(path))}` : null,
    helpChecked: help.checked,
    helpTimedOut: help.timedOut,
    helpSupportsEmbedding: help.supportsEmbedding,
    helpSupportsRerank: help.supportsRerank,
  };
}

function inspectModelArtifact({ modelName: rawModelName, modelPath: rawModelPath, hfRepo: rawHfRepo, expectedFamily: rawExpectedFamily }) {
  const source = rawModelPath ? "local-path" : rawHfRepo ? "hf-repo" : rawModelName ? "model-name" : "missing";
  const configured = source !== "missing";
  const present = Boolean(rawModelPath) && existsSync(rawModelPath);
  const resolvable = source === "hf-repo" || source === "model-name" || present;
  const descriptor = [rawModelPath ? basename(String(rawModelPath)) : "", rawHfRepo, rawModelName].filter(Boolean).join(" ");
  const normalized = descriptor.toLowerCase();
  const family = rawExpectedFamily.toLowerCase();
  const likelyVocabFixture = /\bvocab\b|ggml-vocab/.test(normalized);
  const likelyDedicatedEmbedding = /embedding|embed|bge|e5|gte|nomic/.test(normalized) && !likelyVocabFixture;
  const expectedFamilyMatched = family ? normalized.includes(family) || normalized.includes(family.replaceAll("-", "")) : likelyDedicatedEmbedding;
  return {
    configured,
    present,
    resolvable,
    source,
    hfRepoConfigured: Boolean(rawHfRepo),
    descriptorHash: descriptor ? `sha256:${sha256(descriptor)}` : null,
    extension: present ? extname(rawModelPath).toLowerCase() : null,
    sizeClass: present ? sizeClass(statSync(rawModelPath).size) : null,
    likelyDedicatedEmbedding,
    likelyVocabFixture,
    expectedFamilyMatched,
  };
}

async function inspectLocalEndpoint(rawBaseUrl, timeout) {
  const configured = Boolean(rawBaseUrl);
  const localOnly = configured ? isLocalEndpoint(rawBaseUrl) : false;
  if (!configured || !localOnly) {
    return {
      configured,
      localOnly,
      modelsEndpointChecked: false,
      modelsEndpointReachable: false,
      modelsEndpointStatus: null,
      modelCount: 0,
      modelListHash: null,
      failureClass: null,
    };
  }

  try {
    const response = await fetch(`${rawBaseUrl.replace(/\/+$/, "")}/models`, {
      method: "GET",
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
      return {
        configured,
        localOnly,
        modelsEndpointChecked: true,
        modelsEndpointReachable: false,
        modelsEndpointStatus: response.status,
        modelCount: 0,
        modelListHash: null,
        failureClass: "local-embedding-models-endpoint-non-200",
      };
    }
    const payload = await response.json();
    const ids = arrayOf(payload?.data).map((item) => String(item?.id ?? "")).filter(Boolean).sort();
    return {
      configured,
      localOnly,
      modelsEndpointChecked: true,
      modelsEndpointReachable: true,
      modelsEndpointStatus: response.status,
      modelCount: ids.length,
      modelListHash: ids.length ? `sha256:${sha256(ids.join("\n"))}` : null,
      failureClass: null,
    };
  } catch (error) {
    const failureClass = error?.name === "TimeoutError" || error?.name === "AbortError" ? "local-embedding-models-endpoint-timeout" : "local-embedding-models-endpoint-fetch-failed";
    return {
      configured,
      localOnly,
      modelsEndpointChecked: true,
      modelsEndpointReachable: false,
      modelsEndpointStatus: null,
      modelCount: 0,
      modelListHash: null,
      failureClass,
    };
  }
}

function readServerHelp(path, timeoutMsValue) {
  const result = spawnSync(path, ["--help"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMsValue,
  });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return {
    checked: true,
    supportsEmbedding: /--embeddings?\b/.test(text),
    supportsRerank: /--rerank(?:ing)?\b/.test(text),
    timedOut: Boolean(result.error && result.error.code === "ETIMEDOUT"),
  };
}

function localBaseUrlFromConfig(env) {
  const host = stringOrNull(env.SERVER_HOST);
  const port = stringOrNull(env.PORT);
  if (!host || !port) return null;
  return `http://${host}:${port}/v1`;
}

function loadEnvFile(path) {
  const content = readFileSync(path, "utf8");
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    parsed[match[1]] = unquote(match[2].trim());
  }
  return parsed;
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isLocalEndpoint(value) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function sizeClass(bytes) {
  if (bytes < 100 * 1024 * 1024) return "tiny-or-fixture";
  if (bytes < 2 * 1024 * 1024 * 1024) return "small";
  if (bytes < 8 * 1024 * 1024 * 1024) return "medium";
  return "large";
}

function nextActions(readyValue, modelArtifact, localEndpoint) {
  if (readyValue) {
    return [
      "Run benchmark:local-embedding:durability -- --require-ready while the same local endpoint is alive.",
      "Run local-full response-arm export only after the durability smoke passes.",
      "Keep raw benchmark inputs and response files outside the repository.",
    ];
  }
  const actions = [
    "Provision a dedicated local embedding GGUF checkpoint for the local Apple arm.",
    "Start llama.cpp in embedding mode against that checkpoint before retrying shard 002.",
    "Rerun this runtime doctor, then the durability smoke, before local-full response-arm export.",
  ];
  if (modelArtifact.present && !modelArtifact.likelyDedicatedEmbedding) {
    actions.unshift("Do not reuse a chat/generation model selection as the embedding runtime.");
  }
  if (localEndpoint.configured && !localEndpoint.modelsEndpointReachable) {
    actions.unshift("Fix or start the local OpenAI-compatible embedding endpoint.");
  }
  return actions;
}

function renderMarkdown(value) {
  return [
    "# Local Embedding Runtime Doctor",
    "",
    `- Status: ${value.status}`,
    `- Strategy: ${value.strategy}`,
    `- Expected family: ${value.expectedFamily}`,
    `- Config env path printed: ${value.configEnvPathPrinted}`,
    `- Private path printed: ${value.privatePathPrinted}`,
    `- Endpoint printed: ${value.endpointPrinted}`,
    `- Ready for durability smoke: ${value.readyForLocalEmbeddingDurabilitySmoke}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    "",
    "## Runtime",
    `- Server binary configured: ${value.serverBinary.configured}`,
    `- Server binary present: ${value.serverBinary.present}`,
    `- Server supports embedding flag: ${value.serverBinary.helpSupportsEmbedding}`,
    `- Model configured: ${value.modelArtifact.configured}`,
    `- Model present: ${value.modelArtifact.present}`,
    `- Model source: ${value.modelArtifact.source}`,
    `- HF repo configured: ${value.modelArtifact.hfRepoConfigured}`,
    `- Model size class: ${value.modelArtifact.sizeClass ?? "n/a"}`,
    `- Likely dedicated embedding model: ${value.modelArtifact.likelyDedicatedEmbedding}`,
    `- Likely vocab fixture: ${value.modelArtifact.likelyVocabFixture}`,
    `- Expected family matched: ${value.modelArtifact.expectedFamilyMatched}`,
    `- Endpoint configured: ${value.localEndpoint.configured}`,
    `- Endpoint local only: ${value.localEndpoint.localOnly}`,
    `- Models endpoint reachable: ${value.localEndpoint.modelsEndpointReachable}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
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

function positiveInt(value, label) {
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

async function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, text, { encoding: "utf8", mode: 0o600 });
}

function stringOrNull(value) {
  const stringValue = String(value ?? "").trim();
  return stringValue ? stringValue : null;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  const endpointPattern = /https?:\/\/|127\.0\.0\.1|localhost|\[::1\]/i;
  assert.ok(!secretPattern.test(text), `${label} appears to contain a credential`);
  assert.ok(!privatePathPattern.test(text), `${label} appears to contain a private path`);
  assert.ok(!endpointPattern.test(text), `${label} appears to print a local endpoint`);
}
