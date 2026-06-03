import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const live = Boolean(args.live);
const strict = Boolean(args.strict);
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ? resolve(String(args.output)) : null;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const report = live ? runLiveCanary() : fixtureReport();
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "codex live agent-memory canary");
assertSafePublicText(markdownText, "codex live agent-memory canary markdown");
if (strict) {
  assert.equal(report.ok, true, jsonText);
  assert.equal(report.publicSafe, true, jsonText);
  assert.equal(report.rawMemoryIncluded, false, jsonText);
  assert.equal(report.rawRecallContextIncluded, false, jsonText);
  assert.equal(report.hostedWriteBackDisabled, true, jsonText);
  assert.equal(report.explicitWriteObserved, true, jsonText);
  assert.equal(report.postBoundaryRecallObserved, true, jsonText);
}
if (outputPath) writeOutput(outputPath, format === "markdown" ? markdownText : jsonText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function runLiveCanary() {
  const bridgePath = resolve(String(args.bridge ?? `${process.env.HOME}/.codex/selfmem-bridge/bridge.js`));
  assert.ok(existsSync(bridgePath), "Codex selfmem bridge not found. Run without --live for fixture mode.");
  assert.ok(statSync(bridgePath).size > 0, "Codex selfmem bridge is empty.");

  const runToken = `codex-live-${randomBytes(8).toString("hex")}`;
  const memoryText = [
    `RecallWeave Codex live-agent canary ${runToken}.`,
    "Store this public test memory only.",
    "The canary color is cobalt.",
    "The workflow name is Meridian.",
    "This verifies an explicit write followed by a separate forced recall process.",
  ].join(" ");
  const writeStartedAt = new Date().toISOString();
  const store = runBridge(bridgePath, "store", {
    text: memoryText,
    kind: "codex_live_canary",
    scope: "repo_recallweave_canary",
  });
  const writeEndedAt = new Date().toISOString();
  const storeReport = parseJson(store.stdout, "store output");
  const recallPrompt = [
    `Use memory recall for RecallWeave Codex live-agent canary ${runToken}.`,
    "What color and workflow name were stored?",
    "Do not include raw logs or private data.",
  ].join(" ");
  const recallStartedAt = new Date().toISOString();
  const recall = runBridge(bridgePath, "recall", { prompt: recallPrompt }, { SELFMEM_BRIDGE_FORCE_RECALL: "1" });
  const recallEndedAt = new Date().toISOString();
  const recallReport = parseJson(recall.stdout, "recall output");
  const recallContext = String(recallReport?.hookSpecificOutput?.additionalContext ?? "");
  const doctor = runBridge(bridgePath, "doctor", {});
  const doctorReport = parseJson(doctor.stdout, "doctor output");
  const termMatches = {
    token: recallContext.includes(runToken),
    color: /cobalt/i.test(recallContext),
    workflow: /meridian/i.test(recallContext),
  };
  const hostedWriteBackDisabled = doctorReport.mirrorWritesToSupermemory === false;
  const explicitWriteObserved = storeReport.ok === true && (Number(storeReport.written ?? 0) > 0 || Number(storeReport.duplicateSuppressed ?? 0) > 0);
  const postBoundaryRecallObserved = Object.values(termMatches).every(Boolean);
  const ok =
    store.status === 0 &&
    recall.status === 0 &&
    doctor.status === 0 &&
    explicitWriteObserved &&
    postBoundaryRecallObserved &&
    hostedWriteBackDisabled &&
    Number(doctorReport.duplicateRate ?? 1) <= 0.02;

  return {
    schemaVersion: 1,
    mode: "codex-live-agent-memory-canary",
    status: ok ? "READY_CODEX_LIVE_AGENT_MEMORY_CANARY" : "BLOCKED_CODEX_LIVE_AGENT_MEMORY_CANARY",
    ok,
    fixtureOnly: false,
    generatedAt: new Date().toISOString(),
    writesRealFiles: true,
    metricsOnly: true,
    publicSafe: true,
    rawMemoryIncluded: false,
    rawPromptIncluded: false,
    rawRecallContextIncluded: false,
    rawTranscriptIncluded: false,
    privatePathsIncluded: false,
    callsProviderApis: false,
    callsHostedSupermemory: false,
    countsAsBenchmarkEvidence: false,
    countsAsSupermemoryReplacementEvidence: false,
    canaryEvidenceOnly: true,
    primaryBenchmarkStillRequired: true,
    pluginActor: "codex-selfmem-bridge",
    comparisonSurface: "agent-memory-plugin-lifecycle",
    hostedWriteBackDisabled,
    boundary: {
      type: "separate-process-explicit-store-to-forced-recall",
      writeStartedAt,
      writeEndedAt,
      recallStartedAt,
      recallEndedAt,
    },
    bridge: {
      sourceHash: `sha256:${sha256(readFileSync(bridgePath))}`,
      explicitStoreModeAvailable: true,
    },
    store: {
      exitStatus: store.status,
      ok: storeReport.ok === true,
      written: Number(storeReport.written ?? 0),
      duplicateSuppressed: Number(storeReport.duplicateSuppressed ?? 0),
      rejected: Number(storeReport.rejected ?? 0),
      idCount: Array.isArray(storeReport.ids) ? storeReport.ids.length : 0,
    },
    recall: {
      exitStatus: recall.status,
      hookContextReturned: recallContext.length > 0,
      matchedExpectedTerms: termMatches,
      contextLength: recallContext.length,
    },
    doctor: {
      exitStatus: doctor.status,
      enabled: doctorReport.enabled === true,
      mode: String(doctorReport.mode ?? ""),
      hostedWriteBackDisabled,
      liveSupermemorySearch: doctorReport.liveSupermemorySearch === true,
      memories: Number(doctorReport.memories ?? 0),
      events: Number(doctorReport.events ?? 0),
      transcripts: Number(doctorReport.transcripts ?? 0),
      explicitStoreCount: Number(doctorReport.explicitStoreCount ?? 0),
      duplicateRate: Number(doctorReport.duplicateRate ?? 0),
      eventTypes: Array.isArray(doctorReport.eventTypes) ? doctorReport.eventTypes : [],
    },
    explicitWriteObserved,
    postBoundaryRecallObserved,
    blockers: [
      explicitWriteObserved ? null : "explicit-write-not-observed",
      postBoundaryRecallObserved ? null : "post-boundary-recall-missing-canary-terms",
      hostedWriteBackDisabled ? null : "hosted-write-back-enabled",
      Number(doctorReport.duplicateRate ?? 1) <= 0.02 ? null : "duplicate-rate-too-high",
    ].filter(Boolean),
  };
}

function fixtureReport() {
  return {
    schemaVersion: 1,
    mode: "codex-live-agent-memory-canary",
    status: "READY_CODEX_LIVE_AGENT_MEMORY_CANARY_FIXTURE",
    ok: true,
    fixtureOnly: true,
    generatedAt: new Date().toISOString(),
    writesRealFiles: false,
    metricsOnly: true,
    publicSafe: true,
    rawMemoryIncluded: false,
    rawPromptIncluded: false,
    rawRecallContextIncluded: false,
    rawTranscriptIncluded: false,
    privatePathsIncluded: false,
    callsProviderApis: false,
    callsHostedSupermemory: false,
    countsAsBenchmarkEvidence: false,
    countsAsSupermemoryReplacementEvidence: false,
    canaryEvidenceOnly: true,
    primaryBenchmarkStillRequired: true,
    pluginActor: "codex-selfmem-bridge",
    comparisonSurface: "agent-memory-plugin-lifecycle",
    hostedWriteBackDisabled: true,
    boundary: {
      type: "fixture-separate-process-explicit-store-to-forced-recall",
    },
    bridge: {
      sourceHash: "sha256:fixture",
      explicitStoreModeAvailable: true,
    },
    store: {
      exitStatus: 0,
      ok: true,
      written: 1,
      duplicateSuppressed: 0,
      rejected: 0,
      idCount: 1,
    },
    recall: {
      exitStatus: 0,
      hookContextReturned: true,
      matchedExpectedTerms: {
        token: true,
        color: true,
        workflow: true,
      },
      contextLength: 180,
    },
    doctor: {
      exitStatus: 0,
      enabled: true,
      mode: "local-first-read-through",
      hostedWriteBackDisabled: true,
      liveSupermemorySearch: false,
      memories: 1,
      events: 3,
      transcripts: 0,
      explicitStoreCount: 1,
      duplicateRate: 0,
      eventTypes: ["explicit-store", "prompt", "recall-run"],
    },
    explicitWriteObserved: true,
    postBoundaryRecallObserved: true,
    blockers: [],
  };
}

function runBridge(bridgePath, mode, payload, extraEnv = {}) {
  const result = spawnSync("node", [bridgePath, mode], {
    input: `${JSON.stringify(payload)}\n`,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `bridge ${mode} failed: ${result.stderr}`);
  return result;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} was not valid JSON: ${error.message}`);
  }
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Live Agent-Memory Canary",
    "",
    `- Status: ${report.status}`,
    `- OK: ${report.ok}`,
    `- Fixture only: ${report.fixtureOnly}`,
    `- Plugin actor: ${report.pluginActor}`,
    `- Comparison surface: ${report.comparisonSurface}`,
    `- Explicit write observed: ${report.explicitWriteObserved}`,
    `- Post-boundary recall observed: ${report.postBoundaryRecallObserved}`,
    `- Hosted write-back disabled: ${report.doctor.hostedWriteBackDisabled}`,
    `- Counts as benchmark evidence: ${report.countsAsBenchmarkEvidence}`,
    `- Counts as replacement evidence: ${report.countsAsSupermemoryReplacementEvidence}`,
    `- Primary benchmark still required: ${report.primaryBenchmarkStillRequired}`,
    `- Raw memory included: ${report.rawMemoryIncluded}`,
    `- Raw recall context included: ${report.rawRecallContextIncluded}`,
    `- Private paths included: ${report.privatePathsIncluded}`,
    `- Blockers: ${report.blockers.length ? report.blockers.join(", ") : "none"}`,
  ];
  return lines.join("\n");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
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

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern(), `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, `${label} contains a private path`);
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
}
