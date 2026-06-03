import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const requireReady = Boolean(args.requireReady);
const strategy = String(args.strategy ?? process.env.SELFMEM_LOCAL_EMBED_STRATEGY ?? "local-apple-qwen3-0_6b");
const model = String(args.model ?? process.env.SELFMEM_LOCAL_EMBED_MODEL ?? "Qwen/Qwen3-Embedding-0.6B-GGUF");
const baseUrl = String(args.baseUrl ?? process.env.SELFMEM_LOCAL_EMBED_BASE_URL ?? "").trim();
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? 60_000, "timeout ms");
const expectedDimensions = optionalPositiveInt(args.expectedDimensions ?? process.env.SELFMEM_LOCAL_EMBED_DIMENSIONS ?? 1024, "expected dimensions");
const tokenCounts = parseTokenCounts(args.tokenCounts ?? args.maxTokens ?? "16,128,512,700");

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(tokenCounts.length > 0, "at least one token count is required");

const probes = baseUrl ? await runProbes() : plannedBlockedProbes("local-embedding-base-url-missing");
const probeBlockers = probes.map((probe) => probe.failureClass).filter(Boolean);
const dimensionSet = new Set(probes.filter((probe) => probe.status === "pass").map((probe) => probe.vectorDimensions));
const blockers = [
  !baseUrl ? "local-embedding-base-url-missing" : null,
  ...probeBlockers,
  dimensionSet.size > 1 ? "local-embedding-dimension-mismatch" : null,
].filter(Boolean);
const ready = blockers.length === 0 && probes.length === tokenCounts.length && probes.every((probe) => probe.status === "pass");

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "local-embedding-durability-smoke",
  status: ready ? "READY_LOCAL_EMBEDDING_DURABILITY" : "BLOCKED_LOCAL_EMBEDDING_DURABILITY",
  generatedAt: new Date().toISOString(),
  strategy,
  model,
  localEndpointConfigured: Boolean(baseUrl),
  baseUrlPrinted: false,
  endpointPrinted: false,
  syntheticOnly: true,
  rawSyntheticInputIncluded: false,
  metricsOnly: true,
  publicSafe: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  readyForLocalAppleArmExport: ready,
  expectedDimensions,
  tokenCounts,
  timeoutMs,
  probes,
  blockers: [...new Set(blockers)],
  nextActions: nextActions(ready),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local embedding durability smoke report");
assertSafePublicText(markdownText, "local embedding durability smoke markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

async function runProbes() {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/embeddings`;
  const results = [];
  for (const tokenCount of tokenCounts) {
    results.push(await runProbe(endpoint, tokenCount));
  }
  return results;
}

async function runProbe(endpoint, tokenCount) {
  const input = syntheticInput(tokenCount);
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const elapsedMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return probeResult(tokenCount, input, elapsedMs, {
        status: "blocked",
        httpStatus: response.status,
        failureClass: "local-embedding-non-200",
      });
    }
    const payload = await response.json();
    const vector = payload?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every((item) => Number.isFinite(Number(item)))) {
      return probeResult(tokenCount, input, elapsedMs, {
        status: "blocked",
        httpStatus: response.status,
        failureClass: "local-embedding-empty-vector",
      });
    }
    if (expectedDimensions != null && vector.length !== expectedDimensions) {
      return probeResult(tokenCount, input, elapsedMs, {
        status: "blocked",
        httpStatus: response.status,
        vectorDimensions: vector.length,
        failureClass: "local-embedding-dimension-mismatch",
      });
    }
    return probeResult(tokenCount, input, elapsedMs, {
      status: "pass",
      httpStatus: response.status,
      vectorDimensions: vector.length,
    });
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - started);
    const failureClass = error?.name === "TimeoutError" || error?.name === "AbortError" ? "local-embedding-timeout" : "local-embedding-fetch-failed";
    return probeResult(tokenCount, input, elapsedMs, {
      status: "blocked",
      failureClass,
    });
  }
}

function probeResult(tokenCount, input, elapsedMs, overrides) {
  return {
    tokenCount,
    inputHash: `sha256:${sha256(input)}`,
    status: overrides.status,
    vectorDimensions: overrides.vectorDimensions ?? null,
    httpStatus: overrides.httpStatus ?? null,
    elapsedMs,
    failureClass: overrides.failureClass ?? null,
  };
}

function plannedBlockedProbes(failureClass) {
  return tokenCounts.map((tokenCount) => {
    const input = syntheticInput(tokenCount);
    return probeResult(tokenCount, input, 0, {
      status: "not-run",
      failureClass,
    });
  });
}

function syntheticInput(tokenCount) {
  const tokens = Array.from({ length: tokenCount }, (_, index) => `publicsynthetic${index % 17}`);
  return `Public benchmark embedding durability probe. ${tokens.join(" ")}`;
}

function parseTokenCounts(value) {
  const rawItems = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const counts = rawItems.length === 1 ? [16, 128, Number(rawItems[0])] : rawItems.map((item) => Number(item));
  return [...new Set(counts)].filter((item) => Number.isInteger(item) && item > 0).sort((a, b) => a - b);
}

function nextActions(readyValue) {
  if (readyValue) {
    return [
      "Use this report as the local Apple embedding preflight before response-arm export.",
      "Run the local-full answer-quality shard export with the same local embedding server still alive.",
      "Keep raw benchmark inputs and response files outside the repository.",
    ];
  }
  return [
    "Start the local OpenAI-compatible embedding endpoint and rerun this smoke before local Apple arm export.",
    "If the endpoint closes sockets on public synthetic probes, fix the local runtime before retrying shard 002.",
    "Do not count partial local-full shard attempts as benchmark evidence until every required arm exports.",
  ];
}

function renderMarkdown(value) {
  return [
    "# Local Embedding Durability Smoke",
    "",
    `- Status: ${value.status}`,
    `- Strategy: ${value.strategy}`,
    `- Local endpoint configured: ${value.localEndpointConfigured}`,
    `- Base URL printed: ${value.baseUrlPrinted}`,
    `- Raw synthetic input included: ${value.rawSyntheticInputIncluded}`,
    `- Ready for local Apple arm export: ${value.readyForLocalAppleArmExport}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    "",
    "## Probes",
    ...value.probes.map(
      (probe) =>
        `- tokens=${probe.tokenCount}, status=${probe.status}, dims=${probe.vectorDimensions ?? "n/a"}, elapsedMs=${probe.elapsedMs}, failure=${probe.failureClass ?? "none"}`,
    ),
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

function optionalPositiveInt(value, label) {
  if (value == null || value === "" || value === false) return null;
  return positiveInt(value, label);
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
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
  assert.ok(!text.includes("Public benchmark embedding durability probe"), `${label} includes raw synthetic input`);
}
