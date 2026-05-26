import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const fixtureMode = Boolean(args.fixture);
const logInputs = fixtureMode ? fixtureLogs() : parseLogInputs(args.log ?? args.logs);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(logInputs.length > 0, "provide at least one --log label=/path");

const attempts = logInputs.map(inspectLaunchLog);
const readyAttempts = attempts.filter((attempt) => attempt.endpointReadyEvidence === true);
const failedBeforeReady = attempts.filter((attempt) => attempt.processExitedBeforeEndpointReady === true);
const launchRecovered = readyAttempts.length > 0;
const launchBlocked = !launchRecovered && failedBeforeReady.length > 0;
const blockers = [
  launchBlocked ? "local-embedding-launch-exited-before-endpoint-ready" : null,
  !launchRecovered && failedBeforeReady.length === 0 ? "local-embedding-launch-readiness-unproven" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-embedding-launch-diagnostic",
  status: launchRecovered
    ? "READY_LOCAL_EMBEDDING_LAUNCH"
    : launchBlocked
      ? "BLOCKED_LOCAL_EMBEDDING_LAUNCH"
      : "UNKNOWN_LOCAL_EMBEDDING_LAUNCH",
  generatedAt: new Date().toISOString(),
  fixtureOnly: fixtureMode,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  callsLocalEndpoint: false,
  sendsBenchmarkTextToProvider: false,
  rawLogIncluded: false,
  rawConfigIncluded: false,
  rawBenchmarkInputIncluded: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  privatePathPrinted: false,
  endpointPrinted: false,
  modelPathPrinted: false,
  serverBinPrinted: false,
  printsEnvValues: false,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  readyForShard002Resume: launchRecovered,
  launchRecovered,
  launchBlocked,
  attemptCount: attempts.length,
  attempts,
  blockers,
  nextActions: launchRecovered
    ? [
        "Run the local embedding runtime doctor against the same live endpoint.",
        "Run the local embedding durability smoke before retrying shard 002.",
        "Keep response arms and benchmark inputs outside the repository.",
      ]
    : [
        "Free local memory pressure or stop stale model/browser processes before relaunching the embedding endpoint.",
        "Relaunch the dedicated Qwen3 Embedding 0.6B GGUF endpoint and wait for /v1/models readiness.",
        "Rerun the runtime doctor and durability smoke before shard-002 missing-arm export.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local embedding launch diagnostic");
assertSafePublicText(markdownText, "local embedding launch diagnostic markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inspectLaunchLog(input) {
  const text = input.fixtureText ?? readLogText(input.path);
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const phases = {
    metalInitialized: /ggml_metal_device_init|MTL0|Metal/i.test(text),
    httpServerStarted: /HTTP server|Running without SSL|binding port/i.test(text),
    modelLoadStarted: /loading model/i.test(text),
    modelMetadataLoaded: /loaded meta data|Dumping metadata/i.test(text),
    tensorLoadStarted: /load_tensors|loading model tensors/i.test(text),
    endpointReady: /server is listening|listening on|HTTP server listening|models endpoint ready|all slots are idle/i.test(text),
  };
  const failureClass = classifyFailure({ text, phases });
  const lastPhase = lastReachedPhase(phases);
  return {
    label: input.label,
    fileNameHash: input.fileNameHash,
    logPresent: true,
    logHash: `sha256:${sha256(text)}`,
    lineCount: lines.length,
    byteCount: Buffer.byteLength(text, "utf8"),
    tailHash: `sha256:${sha256(lines.slice(-25).join("\n"))}`,
    phases,
    lastReachedPhase: lastPhase,
    endpointReadyEvidence: phases.endpointReady,
    processExitedBeforeEndpointReady: !phases.endpointReady,
    failureClass,
    rawLogPrinted: false,
    privatePathPrinted: false,
  };
}

function classifyFailure({ text, phases }) {
  if (phases.endpointReady) return null;
  if (/killed|out of memory|cannot allocate memory|memory pressure|segmentation fault|abort trap|trace\/breakpoint/i.test(text)) {
    return "local-embedding-launch-memory-or-process-exit";
  }
  if (/failed to bind|address already in use|port.*in use/i.test(text)) {
    return "local-embedding-launch-port-conflict";
  }
  if (/error|exception|failed/i.test(text)) {
    return "local-embedding-launch-error-before-readiness";
  }
  if (phases.tensorLoadStarted || phases.modelMetadataLoaded || phases.modelLoadStarted) {
    return "local-embedding-launch-exited-during-model-load";
  }
  return "local-embedding-launch-exited-before-readiness";
}

function lastReachedPhase(phases) {
  const order = [
    ["endpoint-ready", phases.endpointReady],
    ["tensor-load-started", phases.tensorLoadStarted],
    ["model-metadata-loaded", phases.modelMetadataLoaded],
    ["model-load-started", phases.modelLoadStarted],
    ["http-server-started", phases.httpServerStarted],
    ["metal-initialized", phases.metalInitialized],
  ];
  return order.find(([, reached]) => reached)?.[0] ?? "none";
}

function readLogText(path) {
  assert.ok(path, "log path missing");
  assert.ok(existsSync(path), "launch log missing");
  assert.ok(statSync(path).isFile(), "launch log must be a file");
  return readFileSync(path, "utf8");
}

function parseLogInputs(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((entry, index) => {
    const raw = String(entry);
    const separatorIndex = raw.indexOf("=");
    const label = separatorIndex > 0 ? raw.slice(0, separatorIndex) : `attempt-${index + 1}`;
    const path = resolveInputPath(separatorIndex > 0 ? raw.slice(separatorIndex + 1) : raw);
    assert.ok(/^[A-Za-z0-9_.-]+$/.test(label), "log label must be public-safe");
    return {
      label,
      path,
      fileNameHash: `sha256:${sha256(basename(path))}`,
    };
  });
}

function fixtureLogs() {
  return [
    {
      label: "fixture-load-exit",
      fileNameHash: `sha256:${sha256("fixture-load-exit.log")}`,
      fixtureText: [
        "ggml_metal_device_init: GPU name: MTL0",
        "Running without SSL",
        "start: binding port with default address family",
        "main: loading model",
        "llama_model_loader: loaded meta data with 36 key-value pairs",
        "load_tensors: loading model tensors, this can take a while...",
      ].join("\n"),
    },
  ];
}

function renderMarkdown(value) {
  return [
    "# Local Embedding Launch Diagnostic",
    "",
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Public safe: ${value.publicSafe}`,
    `- Attempt count: ${value.attemptCount}`,
    `- Launch recovered: ${value.launchRecovered}`,
    `- Ready for shard 002 resume: ${value.readyForShard002Resume}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    "",
    "## Attempts",
    ...value.attempts.map(
      (attempt) =>
        `- ${attempt.label}: ${attempt.failureClass ?? "ready"}; last phase ${attempt.lastReachedPhase}; lines ${attempt.lineCount}; raw log printed ${attempt.rawLogPrinted}`,
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
}
