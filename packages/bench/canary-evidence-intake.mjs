import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixturePath = join(root, "packages/bench/fixtures/canary-runtime-report.fixture.json");
const reportPath = readArgValue("--report") ?? process.env.RECALLWEAVE_CANARY_REPORT_JSON ?? fixturePath;
const strictReal = process.argv.includes("--strict-real") || process.env.RECALLWEAVE_CANARY_STRICT_REAL === "1";
const outputPath = readArgValue("--output") ?? process.env.RECALLWEAVE_CANARY_INTAKE_OUTPUT_JSON ?? null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /(?:rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)/i;

const inputPath = isAbsolute(reportPath) ? reportPath : resolve(root, reportPath);
assert.ok(existsSync(inputPath), `canary report missing: ${reportPath}`);
assert.ok(statSync(inputPath).size > 0, `canary report empty: ${reportPath}`);

const raw = readFileSync(inputPath, "utf8");
assert.doesNotMatch(raw, secretPattern, "canary report contains a key-shaped secret");
assert.doesNotMatch(raw, privatePathPattern, "canary report contains a raw local path");

const report = JSON.parse(raw);
const fixtureOnly = inputPath === fixturePath || report.fixtureOnly === true || report.evidenceType === "fixture-trace-derived-canary-report";
const forbiddenKeys = findForbiddenKeys(report);
assert.deepEqual(forbiddenKeys, [], `canary report contains forbidden raw-content keys: ${forbiddenKeys.join(", ")}`);

const counts = report.counts ?? {};
const latency = report.latencyMs ?? {};
const instrumentation = report.instrumentation ?? {};
const quality = report.quality ?? {};
const privacy = report.privacy ?? {};
const agent = report.agent ?? {};
const provider = report.provider ?? {};
const window = report.window ?? {};
const adapter = report.adapter ?? {};

const checks = [
  check("schema-version", report.schemaVersion === 1),
  check("mode", report.mode === "one-agent-canary-runtime-report"),
  check("host", ["hermes", "openclaw", "codex", "claude-code"].includes(String(agent.host ?? ""))),
  check("identity-hash", /^agent_[a-f0-9]{8,}$/i.test(String(agent.agentIdentityHash ?? ""))),
  check("local-container-hash", /^container_[a-f0-9]{8,}$/i.test(String(agent.localContainerHash ?? ""))),
  check("source-container-hash", /^source_[a-f0-9]{8,}$/i.test(String(agent.sourceContainerHash ?? ""))),
  check(
    "adapter-contract",
    adapter.name === "recallweave-selfmem-canary"
      && adapter.strictCanaryContract === "v1"
      && adapter.searchLatencyInstrumentation === true
      && adapter.storeLatencyInstrumentation === true,
  ),
  check("window-duration", Number(window.durationMinutes) >= 15),
  check("local-write-mode", provider.localWriteMode === "enabled"),
  check("hosted-read-only", provider.hostedSupermemoryMode === "read-through-only"),
  check("session-start", Number(counts.sessionStart) > 0),
  check("before-prompt-build", Number(counts.beforePromptBuild) > 0),
  check("agent-end", Number(counts.agentEnd) > 0),
  check("search-events", Number(counts.search) > 0),
  check("store-events", Number(counts.store) > 0),
  check("zero-errors", Number(counts.errors) === 0),
  check("known-identity", Number(counts.skippedUnknownIdentity) === 0 && Number(counts.unknownContainerWrites) === 0),
  check("search-latency-instrumented", Number(instrumentation.searchLatencySampleCount ?? 0) > 0),
  check("store-latency-instrumented", Number(instrumentation.storeLatencySampleCount ?? 0) > 0),
  check("recall-p95", Number(latency.recallP95) > 0 && Number(latency.recallP95) <= 2500),
  check("store-p95", Number(latency.storeP95) > 0 && Number(latency.storeP95) <= 2500),
  check("context-rate", Number(quality.beforePromptHasContextRate) >= 0.5),
  check("zero-result-rate", Number(quality.zeroResultRate) <= 0.25),
  check("write-success", Number(quality.writeSuccessRate) >= 0.95),
  check("lifecycle-covered", quality.lifecycleCovered === true),
  check("hybrid-search-covered", quality.hybridSearchCovered === true),
  check("local-writes-observed", quality.localWritesObserved === true),
  check("lcm-hook-observed", quality.lcmHookObserved === true || Number(counts.preCompress) > 0),
  check("zero-privacy-leaks", Number(privacy.privacyLeakCount) === 0),
  check("zero-secret-hits", Number(privacy.secretPatternHits) === 0),
  check("no-raw-memory", privacy.rawMemoryIncluded === false),
  check("no-raw-transcript", privacy.rawTranscriptIncluded === false),
  check("no-raw-prompt", privacy.rawPromptIncluded === false),
  check("no-raw-answer", privacy.rawAnswerIncluded === false),
  check("rollback-ready", report.rollback?.available === true && report.rollback?.tested === true),
];

const failedChecks = checks.filter((item) => !item.ok).map((item) => item.name);
const canaryPass = failedChecks.length === 0;
const strictFailureReason = strictReal && fixtureOnly
  ? "--strict-real cannot use the bundled fixture report"
  : strictReal && !canaryPass
    ? `real canary report failed checks: ${failedChecks.join(", ")}`
    : null;

const output = {
  ok: !strictFailureReason,
  mode: "canary-evidence-intake",
  writesRealFiles: false,
  metricsOnly: true,
  strictReal,
  strictRealPassed: strictReal ? !strictFailureReason : null,
  strictFailureReason,
  fixtureOnly,
  countsAsRealRolloutEvidence: !fixtureOnly && canaryPass,
  canaryPass,
  fleetRolloutAllowed: false,
  publicLaunchAllowed: false,
  report: {
    path: fixtureOnly ? "fixture-canary-report" : "external-canary-report",
    sha256: createHash("sha256").update(raw).digest("hex"),
    generatedAt: report.generatedAt ?? null,
    commit: report.commit ?? null,
  },
  target: {
    host: agent.host,
    agentIdentityHash: agent.agentIdentityHash,
    localContainerHash: agent.localContainerHash,
    sourceContainerHash: agent.sourceContainerHash,
    providerMode: provider.mode,
    hostedSupermemoryMode: provider.hostedSupermemoryMode,
  },
  adapter: {
    name: adapter.name ?? null,
    contractVersion: adapter.contractVersion ?? null,
    strictCanaryContract: adapter.strictCanaryContract ?? null,
    searchLatencyInstrumentation: adapter.searchLatencyInstrumentation === true,
    storeLatencyInstrumentation: adapter.storeLatencyInstrumentation === true,
  },
  window: {
    startedAt: window.startedAt ?? null,
    endedAt: window.endedAt ?? null,
    durationMinutes: Number(window.durationMinutes ?? 0),
  },
  lifecycle: {
    sessionStart: Number(counts.sessionStart ?? 0),
    beforePromptBuild: Number(counts.beforePromptBuild ?? 0),
    preCompress: Number(counts.preCompress ?? 0),
    agentEnd: Number(counts.agentEnd ?? 0),
    search: Number(counts.search ?? 0),
    store: Number(counts.store ?? 0),
    errors: Number(counts.errors ?? 0),
  },
  latencyMs: {
    recallP50: Number(latency.recallP50 ?? 0),
    recallP95: Number(latency.recallP95 ?? 0),
    storeP50: Number(latency.storeP50 ?? 0),
    storeP95: Number(latency.storeP95 ?? 0),
  },
  instrumentation: {
    searchLatencySampleCount: Number(instrumentation.searchLatencySampleCount ?? 0),
    storeLatencySampleCount: Number(instrumentation.storeLatencySampleCount ?? 0),
    missingSearchLatencyCount: Number(instrumentation.missingSearchLatencyCount ?? 0),
    missingStoreLatencyCount: Number(instrumentation.missingStoreLatencyCount ?? 0),
    metadataOnlyTrace: Boolean(instrumentation.metadataOnlyTrace),
    summaryOnlyTrace: Boolean(instrumentation.summaryOnlyTrace),
  },
  quality: {
    beforePromptHasContextRate: Number(quality.beforePromptHasContextRate ?? 0),
    zeroResultRate: Number(quality.zeroResultRate ?? 1),
    writeSuccessRate: Number(quality.writeSuccessRate ?? 0),
    lcmHookObserved: Boolean(quality.lcmHookObserved),
    lifecycleCovered: Boolean(quality.lifecycleCovered),
    hybridSearchCovered: Boolean(quality.hybridSearchCovered),
    localWritesObserved: Boolean(quality.localWritesObserved),
    hostedReadThroughObserved: Boolean(quality.hostedReadThroughObserved),
  },
  privacy: {
    privacyLeakCount: Number(privacy.privacyLeakCount ?? 0),
    redactionCount: Number(privacy.redactionCount ?? 0),
    secretPatternHits: Number(privacy.secretPatternHits ?? 0),
    rawMemoryIncluded: Boolean(privacy.rawMemoryIncluded),
    rawTranscriptIncluded: Boolean(privacy.rawTranscriptIncluded),
    rawPromptIncluded: Boolean(privacy.rawPromptIncluded),
    rawAnswerIncluded: Boolean(privacy.rawAnswerIncluded),
  },
  checks,
  failedChecks,
  nextActions: canaryPass
    ? [
        "Keep fleet rollout blocked until a maintainer reviews this report.",
        "Attach this metrics-only output to the PR or issue, not raw memory logs.",
        "If this is a fixture report, rerun with --report pointing to the live agent metrics file.",
      ]
    : ["Fix failed checks before any additional agent updates.", "Do not roll out to a second agent."],
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern);
assert.doesNotMatch(serialized, privatePathPattern);
if (outputPath) writeFileSync(resolveOutputPath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);
if (strictFailureReason) {
  process.exitCode = 1;
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function resolveOutputPath(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

function findForbiddenKeys(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, `${prefix}[${index}]`));
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const isAllowedRawPresenceFlag = /^(rawMemory|rawTranscript|rawPrompt|rawAnswer)Included$/.test(key);
    const self = forbiddenKeyPattern.test(key) && !isAllowedRawPresenceFlag ? [path] : [];
    return [...self, ...findForbiddenKeys(nested, path)];
  });
}
