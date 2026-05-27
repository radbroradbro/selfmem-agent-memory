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
const fixtureOnly = Boolean(args.fixture);
const strategy = String(args.strategy ?? process.env.SELFMEM_LOCAL_RERANK_STRATEGY ?? "local-apple-qwen3-0_6b-local-rerank");
const model = String(args.model ?? process.env.SELFMEM_LOCAL_RERANK_MODEL ?? "Qwen/Qwen3-Reranker-0.6B");
const endpoint = localRerankEndpoint(args.endpoint ?? process.env.SELFMEM_LOCAL_RERANK_ENDPOINT, args.baseUrl ?? process.env.SELFMEM_LOCAL_RERANK_BASE_URL);
const timeoutMs = positiveInt(args.timeoutMs ?? process.env.SELFMEM_LOCAL_RERANK_TIMEOUT_MS ?? process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? 60_000, "timeout ms");
const documentCounts = parseDocumentCounts(args.documentCounts ?? args.maxDocuments ?? "3,8,12");
const maxDocumentChars = positiveInt(args.maxDocumentChars ?? process.env.SELFMEM_LOCAL_RERANK_MAX_DOCUMENT_CHARS ?? 180, "max document chars");

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(documentCounts.length > 0, "at least one document count is required");

const probes = fixtureOnly
  ? fixtureProbes()
  : endpoint
    ? await runProbes()
    : plannedBlockedProbes("local-rerank-endpoint-missing");
const probeBlockers = probes.map((probe) => probe.failureClass).filter(Boolean);
const blockers = [
  !fixtureOnly && !endpoint ? "local-rerank-endpoint-missing" : null,
  ...probeBlockers,
].filter(Boolean);
const ready = blockers.length === 0 && probes.length === documentCounts.length && probes.every((probe) => probe.status === "pass");

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "local-rerank-durability-smoke",
  status: ready ? "READY_LOCAL_RERANK_DURABILITY" : "BLOCKED_LOCAL_RERANK_DURABILITY",
  generatedAt: new Date().toISOString(),
  fixtureOnly,
  strategy,
  model,
  localEndpointConfigured: Boolean(endpoint),
  endpointPrinted: false,
  baseUrlPrinted: false,
  syntheticOnly: true,
  rawSyntheticInputIncluded: false,
  metricsOnly: true,
  publicSafe: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  callsLocalEndpoint: Boolean(endpoint) && !fixtureOnly,
  sendsBenchmarkTextToProvider: false,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  readyForLocalRerankArmExport: ready,
  timeoutMs,
  responseBodyTimeoutBounded: true,
  documentCounts,
  maxDocumentChars,
  probes,
  blockers: [...new Set(blockers)],
  nextActions: nextActions(ready),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local rerank durability smoke report");
assertSafePublicText(markdownText, "local rerank durability smoke markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

async function runProbes() {
  const results = [];
  for (const documentCount of documentCounts) {
    results.push(await runProbe(documentCount));
  }
  return results;
}

async function runProbe(documentCount) {
  const payload = syntheticPayload(documentCount);
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const elapsedMs = Math.round(performance.now() - started);
      return probeResult(payload, elapsedMs, {
        status: "blocked",
        httpStatus: response.status,
        failureClass: "local-rerank-non-200",
      });
    }
    const raw = await response.text();
    const parsed = JSON.parse(raw);
    const elapsedMs = Math.round(performance.now() - started);
    const scores = rerankScores(parsed);
    if (scores.length === 0) {
      return probeResult(payload, elapsedMs, {
        status: "blocked",
        httpStatus: response.status,
        failureClass: "local-rerank-empty-results",
      });
    }
    const invalid = scores.find((item) => !Number.isInteger(item.index) || item.index < 0 || item.index >= documentCount || !Number.isFinite(Number(item.score)));
    if (invalid) {
      return probeResult(payload, elapsedMs, {
        status: "blocked",
        httpStatus: response.status,
        scoreCount: scores.length,
        failureClass: "local-rerank-invalid-result",
      });
    }
    return probeResult(payload, elapsedMs, {
      status: "pass",
      httpStatus: response.status,
      scoreCount: scores.length,
    });
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - started);
    const failureClass =
      error?.name === "TimeoutError" || error?.name === "AbortError" ? "local-rerank-response-body-timeout" : "local-rerank-fetch-or-parse-failed";
    return probeResult(payload, elapsedMs, {
      status: "blocked",
      failureClass,
    });
  }
}

function fixtureProbes() {
  return documentCounts.map((documentCount) => {
    const payload = syntheticPayload(documentCount);
    return probeResult(payload, 1, {
      status: "pass",
      httpStatus: 200,
      scoreCount: documentCount,
    });
  });
}

function plannedBlockedProbes(failureClass) {
  return documentCounts.map((documentCount) => {
    const payload = syntheticPayload(documentCount);
    return probeResult(payload, 0, {
      status: "not-run",
      failureClass,
    });
  });
}

function probeResult(payload, elapsedMs, overrides) {
  return {
    documentCount: payload.documents.length,
    queryHash: `sha256:${sha256(payload.query)}`,
    documentsHash: `sha256:${sha256(payload.documents.join("\n"))}`,
    status: overrides.status,
    httpStatus: overrides.httpStatus ?? null,
    scoreCount: overrides.scoreCount ?? 0,
    elapsedMs,
    failureClass: overrides.failureClass ?? null,
  };
}

function syntheticPayload(documentCount) {
  const query = "Public benchmark rerank durability probe.";
  const documents = Array.from({ length: documentCount }, (_, index) =>
    `Public synthetic rerank document ${index + 1}. topic_${index % 5} ${"context ".repeat(8 + index)}`.slice(0, maxDocumentChars),
  );
  return {
    model,
    query,
    documents,
    top_n: documentCount,
  };
}

function rerankScores(value) {
  const items = Array.isArray(value?.results) ? value.results : Array.isArray(value?.data) ? value.data : Array.isArray(value?.scores) ? value.scores : [];
  return items.map((item, index) => {
    if (typeof item === "number") return { index, score: item };
    return {
      index: Number(item?.index ?? item?.document_index ?? index),
      score: Number(item?.score ?? item?.relevance_score ?? item?.value),
    };
  });
}

function localRerankEndpoint(rawEndpoint, rawBaseUrl) {
  if (rawEndpoint) return String(rawEndpoint).trim();
  const baseUrl = String(rawBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) return "";
  return baseUrl.endsWith("/v1") ? `${baseUrl}/rerank` : `${baseUrl}/v1/rerank`;
}

function parseDocumentCounts(value) {
  const rawItems = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const counts = rawItems.length === 1 ? [3, 8, Number(rawItems[0])] : rawItems.map((item) => Number(item));
  return [...new Set(counts)].filter((item) => Number.isInteger(item) && item > 0).sort((a, b) => a - b);
}

function nextActions(readyValue) {
  if (readyValue) {
    return [
      "Use this report as the local rerank response-body completion guard before missing-arm export.",
      "Run the local-full shard retry with the same local rerank sidecar still alive.",
      "Keep raw benchmark inputs and response files outside the repository.",
    ];
  }
  return [
    "Start the local rerank sidecar or endpoint and rerun this smoke before local-rerank arm export.",
    "If the endpoint accepts work but times out on these public synthetic probes, lower candidate count or fix the local sidecar before retrying the shard.",
    "Do not count partial local-full shard attempts as benchmark evidence until every required arm exports and scores.",
  ];
}

function renderMarkdown(value) {
  return [
    "# Local Rerank Durability Smoke",
    "",
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Strategy: ${value.strategy}`,
    `- Local endpoint configured: ${value.localEndpointConfigured}`,
    `- Endpoint printed: ${value.endpointPrinted}`,
    `- Raw synthetic input included: ${value.rawSyntheticInputIncluded}`,
    `- Response body timeout bounded: ${value.responseBodyTimeoutBounded}`,
    `- Ready for local rerank arm export: ${value.readyForLocalRerankArmExport}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    "",
    "## Probes",
    ...value.probes.map(
      (probe) =>
        `- documents=${probe.documentCount}, status=${probe.status}, scoreCount=${probe.scoreCount}, elapsedMs=${probe.elapsedMs}, failure=${probe.failureClass ?? "none"}`,
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
  assert.ok(!text.includes("Public benchmark rerank durability probe"), `${label} includes raw synthetic query`);
  assert.ok(!text.includes("Public synthetic rerank document"), `${label} includes raw synthetic document`);
}
