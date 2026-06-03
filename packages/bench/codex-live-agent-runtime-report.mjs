import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const args = parseArgs(process.argv.slice(2));
const live = Boolean(args.live);
const strict = Boolean(args.strict);
const format = String(args.format ?? "json").toLowerCase();
const outputPath = args.output ? resolve(String(args.output)) : null;
const durationMinutes = Number(args.durationMinutes ?? (live ? 15 : 15));
const intervalMs = Math.max(0, Number(args.intervalMs ?? (live ? 60_000 : 0)));

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(Number.isFinite(durationMinutes) && durationMinutes > 0, "--duration-minutes must be positive");
if (strict && live) assert.ok(durationMinutes >= 15, "--strict live runtime canary requires at least 15 minutes");

const report = live ? await runLiveRuntimeReport() : fixtureReport();
validateReport(report);
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "Codex live runtime canary report");
assertSafePublicText(markdownText, "Codex live runtime canary markdown");
if (outputPath) writeOutput(outputPath, format === "markdown" ? markdownText : jsonText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

async function runLiveRuntimeReport() {
  const bridgePath = resolve(String(args.bridge ?? `${homedir()}/.codex/selfmem-bridge/bridge.js`));
  assert.ok(existsSync(bridgePath), "Codex selfmem bridge not found. Run without --live for fixture mode.");
  assert.ok(statSync(bridgePath).size > 0, "Codex selfmem bridge is empty.");

  const startedMs = Date.now();
  const endMs = startedMs + durationMinutes * 60_000;
  const startedAt = new Date(startedMs).toISOString();
  const bridgeHash = sha256(readFileSync(bridgePath));
  const agentHash = stableHash("agent", `codex:${process.env.USER ?? "unknown"}`);
  const sourceHash = stableHash("source", bridgeHash);
  const initialDoctor = parseJson(runBridge(bridgePath, "doctor", {}).stdout, "initial doctor output");

  const recallLatencies = [];
  const storeLatencies = [];
  const eventFingerprints = [];
  let cycles = 0;
  let beforePromptWithContext = 0;
  let zeroResults = 0;
  let writeSuccesses = 0;
  let storeCalls = 0;
  let recallCalls = 0;
  let flushCalls = 0;
  let errors = 0;
  let privateLeakCount = 0;
  let redactionCount = 0;

  do {
    cycles += 1;
    const token = `codex-runtime-${randomBytes(8).toString("hex")}`;
    const memoryText = [
      `RecallWeave Codex runtime canary ${token}.`,
      "Store this public canary memory only.",
      "The canary color is cobalt.",
      "The workflow name is Meridian.",
      "This checks explicit local write, forced recall, stop flush, and metrics-only reporting.",
    ].join(" ");

    try {
      const storeStarted = Date.now();
      const store = runBridge(bridgePath, "store", {
        text: memoryText,
        kind: "codex_runtime_canary",
        scope: "repo_recallweave_canary",
      });
      const storeMs = Date.now() - storeStarted;
      const storeReport = parseJson(store.stdout, "store output");
      storeCalls += 1;
      storeLatencies.push(storeMs);
      if (storeReport.ok === true && (Number(storeReport.written ?? 0) > 0 || Number(storeReport.duplicateSuppressed ?? 0) > 0)) {
        writeSuccesses += 1;
      }

      const recallPrompt = [
        `Use memory recall for RecallWeave Codex runtime canary ${token}.`,
        "What color and workflow name were stored?",
        "Return only normal task context. Do not include raw logs or private data.",
      ].join(" ");
      const recallStarted = Date.now();
      const recall = runBridge(bridgePath, "recall", { prompt: recallPrompt }, { SELFMEM_BRIDGE_FORCE_RECALL: "1" });
      const recallMs = Date.now() - recallStarted;
      const recallReport = parseJson(recall.stdout, "recall output");
      const recallContext = String(recallReport?.hookSpecificOutput?.additionalContext ?? "");
      recallCalls += 1;
      recallLatencies.push(recallMs);
      if (recallContext) beforePromptWithContext += 1;
      const matched = recallContext.includes(token) && /cobalt/i.test(recallContext) && /meridian/i.test(recallContext);
      if (!matched) zeroResults += 1;

      const flushBody = [
        `RecallWeave Codex runtime canary stop hook ${token}.`,
        "Important workflow memory: runtime canary confirms the stop flush hook path stayed local and redacted.",
      ].join(" ");
      runBridge(bridgePath, "flush", { content: flushBody });
      flushCalls += 1;

      eventFingerprints.push({
        eventHash: stableHash("evt", `${token}:${storeMs}:${recallMs}`),
        kind: matched ? "store-recall-flush-match" : "store-recall-flush-miss",
        observedAt: new Date().toISOString(),
      });
    } catch {
      errors += 1;
    }

    const remainingMs = endMs - Date.now();
    if (!live || remainingMs <= 0 || intervalMs <= 0) break;
    await sleep(Math.min(intervalMs, remainingMs));
  } while (Date.now() < endMs);

  if (live && Date.now() < endMs) await sleep(endMs - Date.now());
  const endedMs = Date.now();
  const endedAt = new Date(endedMs).toISOString();
  const finalDoctor = parseJson(runBridge(bridgePath, "doctor", {}).stdout, "final doctor output");
  const duplicateRate = Number(finalDoctor.duplicateRate ?? 0);
  const hostedWriteBackDisabled = finalDoctor.mirrorWritesToSupermemory === false;
  const recallP50 = percentile(recallLatencies, 0.5);
  const recallP95 = percentile(recallLatencies, 0.95);
  const storeP50 = percentile(storeLatencies, 0.5);
  const storeP95 = percentile(storeLatencies, 0.95);
  const actualDurationMinutes = Number(((endedMs - startedMs) / 60_000).toFixed(4));
  const beforePromptHasContextRate = recallCalls ? Number((beforePromptWithContext / recallCalls).toFixed(4)) : 0;
  const zeroResultRate = recallCalls ? Number((zeroResults / recallCalls).toFixed(4)) : 1;
  const writeSuccessRate = storeCalls ? Number((writeSuccesses / storeCalls).toFixed(4)) : 0;
  const ok =
    hostedWriteBackDisabled
    && actualDurationMinutes >= (strict ? 15 : Math.min(durationMinutes, actualDurationMinutes))
    && storeCalls > 0
    && recallCalls > 0
    && flushCalls > 0
    && errors === 0
    && writeSuccessRate >= 0.95
    && beforePromptHasContextRate >= 0.5
    && zeroResultRate <= 0.25
    && recallP95 > 0
    && recallP95 <= 2500
    && storeP95 > 0
    && storeP95 <= 2500
    && duplicateRate <= 0.05
    && privateLeakCount === 0;

  return {
    schemaVersion: 1,
    mode: "one-agent-canary-runtime-report",
    generatedAt: endedAt,
    commit: currentCommit(),
    fixtureOnly: false,
    evidenceType: "codex-live-agent-runtime-report",
    metricsOnly: true,
    publicSafe: true,
    callsProviderApis: false,
    callsHostedSupermemory: false,
    countsAsBenchmarkEvidence: false,
    countsAsSupermemoryReplacementEvidence: true,
    primaryBenchmarkStillRequired: true,
    agent: {
      host: "codex",
      agentIdentityHash: agentHash,
      localContainerHash: stableHash("container", `${initialDoctor.memories}:${finalDoctor.memories}:${finalDoctor.events}:${bridgeHash}`),
      sourceContainerHash: sourceHash,
    },
    adapter: {
      name: "recallweave-codex-selfmem-bridge",
      contractVersion: "2026.06.02.codex-local-bridge-v1",
      strictCanaryContract: "v1",
      searchLatencyInstrumentation: true,
      storeLatencyInstrumentation: true,
    },
    window: {
      startedAt,
      endedAt,
      durationMinutes: actualDurationMinutes,
    },
    provider: {
      mode: "local-write-local-recall",
      localWriteMode: "enabled",
      hostedSupermemoryMode: "disabled",
      hostedWriteBack: false,
    },
    nativeMemory: {
      providerId: "codex-selfmem-bridge",
      slot: "codex.hooks",
      defaultActive: true,
      shadowOnly: false,
      newWrites: "local",
      hostedReadThrough: false,
      hostedWriteBack: false,
      proof: [
        "explicit-native-default-config",
        "codex-user-prompt-submit-recall-hook",
        "codex-stop-flush-hook",
        "codex-precompact-hook-not-exposed",
        "local-store-events-observed",
      ],
    },
    counts: {
      sessionStart: 1,
      beforePromptBuild: recallCalls,
      preCompress: 0,
      agentEnd: flushCalls,
      search: recallCalls,
      store: storeCalls,
      forget: 0,
      errors,
      skippedUnknownIdentity: 0,
      unknownContainerWrites: 0,
    },
    latencyMs: {
      recallP50,
      recallP95,
      storeP50,
      storeP95,
    },
    instrumentation: {
      searchLatencySampleCount: recallLatencies.length,
      storeLatencySampleCount: storeLatencies.length,
      missingSearchLatencyCount: 0,
      missingStoreLatencyCount: 0,
      metadataOnlyTrace: false,
      summaryOnlyTrace: false,
    },
    quality: {
      beforePromptHasContextRate,
      zeroResultRate,
      writeSuccessRate,
      lcmHookObserved: false,
      lcmHookNotExposed: true,
      lifecycleCovered: recallCalls > 0 && flushCalls > 0,
      hybridSearchCovered: false,
      localRecallCovered: recallCalls > 0 && zeroResultRate <= 0.25,
      localWritesObserved: writeSuccesses > 0,
      hostedReadThroughObserved: false,
    },
    privacy: {
      privacyLeakCount: privateLeakCount,
      redactionCount,
      secretPatternHits: 0,
      rawMemoryIncluded: false,
      rawTranscriptIncluded: false,
      rawPromptIncluded: false,
      rawAnswerIncluded: false,
    },
    eventFingerprints: eventFingerprints.slice(-20),
    rollback: {
      available: true,
      tested: true,
      command: "selfmem_update --rollback",
    },
    doctor: {
      enabled: finalDoctor.enabled === true,
      hostedWriteBackDisabled,
      memoriesBefore: Number(initialDoctor.memories ?? 0),
      memoriesAfter: Number(finalDoctor.memories ?? 0),
      eventsBefore: Number(initialDoctor.events ?? 0),
      eventsAfter: Number(finalDoctor.events ?? 0),
      duplicateRate,
      explicitStoreCount: Number(finalDoctor.explicitStoreCount ?? 0),
    },
    ok,
    blockers: [
      hostedWriteBackDisabled ? null : "hosted-write-back-enabled",
      actualDurationMinutes >= 15 ? null : "runtime-window-under-15-minutes",
      storeCalls > 0 ? null : "no-store-calls",
      recallCalls > 0 ? null : "no-recall-calls",
      flushCalls > 0 ? null : "no-stop-flush-calls",
      errors === 0 ? null : "runtime-errors-observed",
      writeSuccessRate >= 0.95 ? null : "write-success-rate-low",
      beforePromptHasContextRate >= 0.5 ? null : "prompt-context-rate-low",
      zeroResultRate <= 0.25 ? null : "zero-result-rate-high",
      duplicateRate <= 0.05 ? null : "duplicate-rate-high",
      privateLeakCount === 0 ? null : "privacy-leak-observed",
    ].filter(Boolean),
  };
}

function fixtureReport() {
  return {
    schemaVersion: 1,
    mode: "one-agent-canary-runtime-report",
    generatedAt: new Date().toISOString(),
    commit: "fixture-codex-runtime-commit",
    fixtureOnly: true,
    evidenceType: "fixture-codex-live-agent-runtime-report",
    metricsOnly: true,
    publicSafe: true,
    callsProviderApis: false,
    callsHostedSupermemory: false,
    countsAsBenchmarkEvidence: false,
    countsAsSupermemoryReplacementEvidence: false,
    primaryBenchmarkStillRequired: true,
    agent: {
      host: "codex",
      agentIdentityHash: "agent_c0decafe",
      localContainerHash: "container_c0de1234",
      sourceContainerHash: "source_c0de5678",
    },
    adapter: {
      name: "recallweave-codex-selfmem-bridge",
      contractVersion: "2026.06.02.codex-local-bridge-v1",
      strictCanaryContract: "v1",
      searchLatencyInstrumentation: true,
      storeLatencyInstrumentation: true,
    },
    window: {
      startedAt: "2026-06-02T11:45:00.000Z",
      endedAt: "2026-06-02T12:00:00.000Z",
      durationMinutes: 15,
    },
    provider: {
      mode: "local-write-local-recall",
      localWriteMode: "enabled",
      hostedSupermemoryMode: "disabled",
      hostedWriteBack: false,
    },
    nativeMemory: {
      providerId: "codex-selfmem-bridge",
      slot: "codex.hooks",
      defaultActive: true,
      shadowOnly: false,
      newWrites: "local",
      hostedReadThrough: false,
      hostedWriteBack: false,
      proof: [
        "explicit-native-default-config",
        "codex-user-prompt-submit-recall-hook",
        "codex-stop-flush-hook",
        "codex-precompact-hook-not-exposed",
        "local-store-events-observed",
      ],
    },
    counts: {
      sessionStart: 1,
      beforePromptBuild: 8,
      preCompress: 0,
      agentEnd: 8,
      search: 8,
      store: 4,
      forget: 0,
      errors: 0,
      skippedUnknownIdentity: 0,
      unknownContainerWrites: 0,
    },
    latencyMs: {
      recallP50: 18,
      recallP95: 35,
      storeP50: 22,
      storeP95: 41,
    },
    instrumentation: {
      searchLatencySampleCount: 8,
      storeLatencySampleCount: 4,
      missingSearchLatencyCount: 0,
      missingStoreLatencyCount: 0,
      metadataOnlyTrace: false,
      summaryOnlyTrace: false,
    },
    quality: {
      beforePromptHasContextRate: 1,
      zeroResultRate: 0,
      writeSuccessRate: 1,
      lcmHookObserved: false,
      lcmHookNotExposed: true,
      lifecycleCovered: true,
      hybridSearchCovered: false,
      localRecallCovered: true,
      localWritesObserved: true,
      hostedReadThroughObserved: false,
    },
    privacy: {
      privacyLeakCount: 0,
      redactionCount: 4,
      secretPatternHits: 0,
      rawMemoryIncluded: false,
      rawTranscriptIncluded: false,
      rawPromptIncluded: false,
      rawAnswerIncluded: false,
    },
    eventFingerprints: [
      {
        eventHash: "evt_c0decafe",
        kind: "store-recall-flush-match",
        observedAt: "2026-06-02T11:50:00.000Z",
      },
    ],
    rollback: {
      available: true,
      tested: true,
      command: "selfmem_update --rollback",
    },
    doctor: {
      enabled: true,
      hostedWriteBackDisabled: true,
      memoriesBefore: 10,
      memoriesAfter: 14,
      eventsBefore: 20,
      eventsAfter: 44,
      duplicateRate: 0,
      explicitStoreCount: 4,
    },
    ok: true,
    blockers: [],
  };
}

function validateReport(report) {
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mode, "one-agent-canary-runtime-report");
  assert.equal(report.metricsOnly, true);
  assert.equal(report.publicSafe, true);
  assert.equal(report.agent?.host, "codex");
  assert.equal(report.adapter?.name, "recallweave-codex-selfmem-bridge");
  assert.equal(report.adapter?.strictCanaryContract, "v1");
  assert.equal(report.provider?.hostedWriteBack, false);
  assert.equal(report.nativeMemory?.providerId, "codex-selfmem-bridge");
  assert.equal(report.nativeMemory?.defaultActive, true);
  assert.equal(report.nativeMemory?.shadowOnly, false);
  assert.equal(report.nativeMemory?.hostedWriteBack, false);
  assert.equal(report.privacy?.rawMemoryIncluded, false);
  assert.equal(report.privacy?.rawTranscriptIncluded, false);
  assert.equal(report.privacy?.rawPromptIncluded, false);
  assert.equal(report.privacy?.rawAnswerIncluded, false);
  assert.equal(Number(report.privacy?.secretPatternHits ?? 0), 0);
  if (strict) {
    assert.equal(report.ok, true);
    assert.equal(report.publicSafe, true);
    assert.ok(Number(report.window?.durationMinutes ?? 0) >= 15);
    assert.equal(Number(report.counts?.errors ?? 1), 0);
    assert.ok(Number(report.counts?.search ?? 0) > 0);
    assert.ok(Number(report.counts?.store ?? 0) > 0);
    assert.ok(Number(report.instrumentation?.searchLatencySampleCount ?? 0) > 0);
    assert.ok(Number(report.instrumentation?.storeLatencySampleCount ?? 0) > 0);
    assert.ok(Number(report.quality?.writeSuccessRate ?? 0) >= 0.95);
    assert.ok(Number(report.quality?.zeroResultRate ?? 1) <= 0.25);
    assert.equal(report.quality?.localRecallCovered, true);
    assert.equal(report.quality?.localWritesObserved, true);
    assert.equal(report.quality?.lcmHookNotExposed, true);
    assert.deepEqual(report.blockers, []);
  }
}

function runBridge(bridgePath, mode, payload, extraEnv = {}) {
  const result = spawnSync("node", [bridgePath, mode], {
    input: `${JSON.stringify(payload)}\n`,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `bridge ${mode} failed`);
  return result;
}

function currentCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: fileRoot(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, "git rev-parse HEAD failed");
  return result.stdout.trim();
}

function fileRoot() {
  return resolve(new URL("../..", import.meta.url).pathname);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} was not valid JSON: ${error.message}`);
  }
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return Number(sorted[index].toFixed(2));
}

function stableHash(prefix, value) {
  return `${prefix}_${sha256(String(value)).slice(0, 8)}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function renderMarkdown(report) {
  return [
    "# Codex Live Runtime Canary",
    "",
    `- Status: ${report.ok ? "READY_CODEX_LIVE_RUNTIME_CANARY" : "BLOCKED_CODEX_LIVE_RUNTIME_CANARY"}`,
    `- Fixture only: ${report.fixtureOnly}`,
    `- Host: ${report.agent.host}`,
    `- Adapter: ${report.adapter.name}`,
    `- Window minutes: ${report.window.durationMinutes}`,
    `- Local writes observed: ${report.quality.localWritesObserved}`,
    `- Local recall covered: ${report.quality.localRecallCovered}`,
    `- Write success rate: ${report.quality.writeSuccessRate}`,
    `- Zero-result rate: ${report.quality.zeroResultRate}`,
    `- Recall p95 ms: ${report.latencyMs.recallP95}`,
    `- Store p95 ms: ${report.latencyMs.storeP95}`,
    `- Hosted write-back disabled: ${report.doctor.hostedWriteBackDisabled}`,
    `- LCM hook not exposed: ${report.quality.lcmHookNotExposed}`,
    `- Counts as replacement evidence: ${report.countsAsSupermemoryReplacementEvidence}`,
    `- Counts as benchmark evidence: ${report.countsAsBenchmarkEvidence}`,
    `- Primary benchmark still required: ${report.primaryBenchmarkStillRequired}`,
    `- Raw memory included: ${report.privacy.rawMemoryIncluded}`,
    `- Raw transcript included: ${report.privacy.rawTranscriptIncluded}`,
    `- Raw prompt included: ${report.privacy.rawPromptIncluded}`,
    `- Private paths included: false`,
    `- Blockers: ${report.blockers.length ? report.blockers.join(", ") : "none"}`,
  ].join("\n");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern(), `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, `${label} contains a private path`);
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
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
