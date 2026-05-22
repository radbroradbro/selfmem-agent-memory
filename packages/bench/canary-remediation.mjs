import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const defaultReportPath = join(root, "packages/bench/fixtures/canary-runtime-report-failing.fixture.json");
const fixtureRoot = join(root, "packages/bench/fixtures");
const reportPath = readArgValue("--report") ?? readArgValue("--intake") ?? process.env.RECALLWEAVE_CANARY_REPORT_JSON ?? defaultReportPath;
const outputPath = readArgValue("--output");

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

const input = JSON.parse(raw);
const report = normalizeReport(input);
const fixtureOnly = Boolean(
  inputPath.startsWith(fixtureRoot)
    || report.fixtureOnly
    || report.evidenceType === "fixture-trace-derived-canary-report",
);
const forbiddenKeys = findForbiddenKeys(report);
assert.deepEqual(forbiddenKeys, [], `canary report contains forbidden raw-content keys: ${forbiddenKeys.join(", ")}`);

const checks = evaluateChecks(report);
const failedChecks = input.mode === "canary-evidence-intake" && Array.isArray(input.failedChecks)
  ? input.failedChecks
  : checks.filter((item) => !item.ok).map((item) => item.name);
const actions = dedupeActions(failedChecks.flatMap((name) => actionFor(name, report)));
const canaryPass = failedChecks.length === 0;
const severity = canaryPass ? "ready-for-maintainer-review" : actions.some((item) => item.priority === "blocker") ? "blocked" : "needs-review";

const output = {
  ok: true,
  mode: "canary-remediation-plan",
  writesRealFiles: false,
  metricsOnly: true,
  fixtureOnly,
  canaryPass,
  severity,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  report: {
    path: fixtureOnly ? "fixture-canary-report" : "external-canary-report",
    sha256: createHash("sha256").update(raw).digest("hex"),
    generatedAt: report.generatedAt ?? null,
    commit: report.commit ?? null,
  },
  target: {
    host: report.agent?.host ?? input.target?.host ?? null,
    agentIdentityHash: report.agent?.agentIdentityHash ?? input.target?.agentIdentityHash ?? null,
    localContainerHash: report.agent?.localContainerHash ?? input.target?.localContainerHash ?? null,
    sourceContainerHash: report.agent?.sourceContainerHash ?? input.target?.sourceContainerHash ?? null,
    providerMode: report.provider?.mode ?? input.target?.providerMode ?? null,
    hostedSupermemoryMode: report.provider?.hostedSupermemoryMode ?? input.target?.hostedSupermemoryMode ?? null,
  },
  failedChecks,
  measurements: {
    windowMinutes: numberValue(report.window?.durationMinutes),
    recallP95Ms: numberValue(report.latencyMs?.recallP95),
    storeP95Ms: numberValue(report.latencyMs?.storeP95),
    searchLatencySampleCount: numberValue(report.instrumentation?.searchLatencySampleCount),
    storeLatencySampleCount: numberValue(report.instrumentation?.storeLatencySampleCount),
    missingSearchLatencyCount: numberValue(report.instrumentation?.missingSearchLatencyCount),
    missingStoreLatencyCount: numberValue(report.instrumentation?.missingStoreLatencyCount),
    zeroResultRate: numberValue(report.quality?.zeroResultRate),
    beforePromptHasContextRate: numberValue(report.quality?.beforePromptHasContextRate),
    writeSuccessRate: numberValue(report.quality?.writeSuccessRate),
    errors: numberValue(report.counts?.errors),
    privacyLeakCount: numberValue(report.privacy?.privacyLeakCount),
  },
  actions,
  recollectWindow: {
    minimumMinutes: 15,
    needsFreshWindow: failedChecks.includes("store-p95")
      || failedChecks.includes("recall-p95")
      || failedChecks.includes("window-duration")
      || failedChecks.includes("zero-errors"),
    reason: canaryPass
      ? "The report passed canary checks; maintainer review is still required before broader rollout."
      : "Collect a fresh sanitized report after applying the remediation items.",
  },
  safeCommands: [
    "npm exec --yes pnpm@10.23.0 -- canary:report -- --diagnostic-dir <redacted-diagnostic-dir> --rollback-tested --output sanitized-report.json",
    "npm exec --yes pnpm@10.23.0 -- canary:intake -- --report sanitized-report.json --strict-real",
    "npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report sanitized-report.json",
  ],
  operatorSummary: canaryPass
    ? "Canary metrics passed. Keep fleet rollout blocked until a maintainer reviews the metrics-only report."
    : `Canary metrics failed ${failedChecks.length} check(s). Do not update another agent until the remediation actions are handled.`,
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern);
assert.doesNotMatch(serialized, privatePathPattern);
if (outputPath) writeFileSync(resolvePath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);

function normalizeReport(value) {
  if (value.mode === "canary-evidence-intake") {
    return {
      schemaVersion: 1,
      mode: "one-agent-canary-runtime-report",
      generatedAt: value.report?.generatedAt,
      commit: value.report?.commit,
      fixtureOnly: value.fixtureOnly,
      agent: {
        host: value.target?.host,
        agentIdentityHash: value.target?.agentIdentityHash,
        localContainerHash: value.target?.localContainerHash,
        sourceContainerHash: value.target?.sourceContainerHash,
      },
      window: value.window,
      provider: {
        mode: value.target?.providerMode,
        localWriteMode: "enabled",
        hostedSupermemoryMode: value.target?.hostedSupermemoryMode,
      },
      counts: {
        sessionStart: value.lifecycle?.sessionStart,
        beforePromptBuild: value.lifecycle?.beforePromptBuild,
        preCompress: value.lifecycle?.preCompress,
        agentEnd: value.lifecycle?.agentEnd,
        search: value.lifecycle?.search,
        store: value.lifecycle?.store,
        errors: value.lifecycle?.errors,
        skippedUnknownIdentity: 0,
        unknownContainerWrites: 0,
      },
      latencyMs: value.latencyMs,
      instrumentation: value.instrumentation,
      quality: value.quality,
      privacy: value.privacy,
      rollback: { available: true, tested: true },
    };
  }
  return value;
}

function evaluateChecks(report) {
  const counts = report.counts ?? {};
  const latency = report.latencyMs ?? {};
  const instrumentation = report.instrumentation ?? {};
  const quality = report.quality ?? {};
  const privacy = report.privacy ?? {};
  const agent = report.agent ?? {};
  const provider = report.provider ?? {};
  const window = report.window ?? {};
  return [
    check("schema-version", report.schemaVersion === 1),
    check("mode", report.mode === "one-agent-canary-runtime-report"),
    check("host", ["hermes", "openclaw", "codex", "claude-code"].includes(String(agent.host ?? ""))),
    check("identity-hash", /^agent_[a-f0-9]{8,}$/i.test(String(agent.agentIdentityHash ?? ""))),
    check("local-container-hash", /^container_[a-f0-9]{8,}$/i.test(String(agent.localContainerHash ?? ""))),
    check("source-container-hash", /^source_[a-f0-9]{8,}$/i.test(String(agent.sourceContainerHash ?? ""))),
    check("window-duration", numberValue(window.durationMinutes) >= 15),
    check("local-write-mode", provider.localWriteMode === "enabled"),
    check("hosted-read-only", provider.hostedSupermemoryMode === "read-through-only"),
    check("session-start", numberValue(counts.sessionStart) > 0),
    check("before-prompt-build", numberValue(counts.beforePromptBuild) > 0),
    check("agent-end", numberValue(counts.agentEnd) > 0),
    check("search-events", numberValue(counts.search) > 0),
    check("store-events", numberValue(counts.store) > 0),
    check("zero-errors", numberValue(counts.errors) === 0),
    check("known-identity", numberValue(counts.skippedUnknownIdentity) === 0 && numberValue(counts.unknownContainerWrites) === 0),
    check("search-latency-instrumented", numberValue(instrumentation.searchLatencySampleCount) > 0),
    check("store-latency-instrumented", numberValue(instrumentation.storeLatencySampleCount) > 0),
    check("recall-p95", numberValue(latency.recallP95) > 0 && numberValue(latency.recallP95) <= 2500),
    check("store-p95", numberValue(latency.storeP95) > 0 && numberValue(latency.storeP95) <= 2500),
    check("context-rate", numberValue(quality.beforePromptHasContextRate) >= 0.5),
    check("zero-result-rate", numberValue(quality.zeroResultRate) <= 0.25),
    check("write-success", numberValue(quality.writeSuccessRate) >= 0.95),
    check("lifecycle-covered", quality.lifecycleCovered === true),
    check("hybrid-search-covered", quality.hybridSearchCovered === true),
    check("local-writes-observed", quality.localWritesObserved === true),
    check("lcm-hook-observed", quality.lcmHookObserved === true || numberValue(counts.preCompress) > 0),
    check("zero-privacy-leaks", numberValue(privacy.privacyLeakCount) === 0),
    check("zero-secret-hits", numberValue(privacy.secretPatternHits) === 0),
    check("no-raw-memory", privacy.rawMemoryIncluded === false),
    check("no-raw-transcript", privacy.rawTranscriptIncluded === false),
    check("no-raw-prompt", privacy.rawPromptIncluded === false),
    check("no-raw-answer", privacy.rawAnswerIncluded === false),
    check("rollback-ready", report.rollback?.available === true && report.rollback?.tested === true),
  ];
}

function actionFor(name, report) {
  const recallP95 = numberValue(report.latencyMs?.recallP95);
  const storeP95 = numberValue(report.latencyMs?.storeP95);
  const base = {
    check: name,
    priority: "blocker",
    category: "runtime",
  };
  const map = {
    "schema-version": [{ ...base, category: "report-shape", recommendation: "Regenerate the report with the current canary:report command." }],
    mode: [{ ...base, category: "report-shape", recommendation: "Use canary:report output, not a raw trace or ad hoc diagnostic file." }],
    host: [{ ...base, category: "targeting", recommendation: "Confirm the runtime host is one of hermes, openclaw, codex, or claude-code before rerunning the canary." }],
    "identity-hash": [{ ...base, category: "identity", recommendation: "Regenerate the report with hashed identity metadata from the current adapter." }],
    "local-container-hash": [{ ...base, category: "identity", recommendation: "Regenerate the report after confirming the local container mapping is present." }],
    "source-container-hash": [{ ...base, category: "identity", recommendation: "Regenerate the report after confirming the hosted read-through source container mapping is present." }],
    "window-duration": [{ ...base, category: "evidence-window", recommendation: "Collect at least 15 minutes of active runtime after applying the patch." }],
    "local-write-mode": [{ ...base, category: "write-lane", recommendation: "Make RecallWeave the local write lane for this agent before claiming native memory coverage." }],
    "hosted-read-only": [{ ...base, category: "supermemory-bridge", recommendation: "Keep hosted Supermemory in read-through-only mode. Do not enable hosted write-back for canary evidence." }],
    "session-start": [{ ...base, category: "lifecycle", recommendation: "Check plugin registration. The session-start hook did not appear in the report." }],
    "before-prompt-build": [{ ...base, category: "lifecycle", recommendation: "Check prompt-build or prefetch hook registration. Recall may not be entering production prompts." }],
    "agent-end": [{ ...base, category: "lifecycle", recommendation: "Check end-of-turn hook registration. The agent may not be writing distilled memories." }],
    "search-events": [{ ...base, category: "retrieval", recommendation: "Run an active prompt after installation; no search or recall events were observed." }],
    "store-events": [{ ...base, category: "write-lane", recommendation: "Run an active prompt that should create a durable memory; no store events were observed." }],
    "zero-errors": [{ ...base, category: "runtime-errors", recommendation: "Inspect sanitized error classes, patch the failing lifecycle path, then collect a fresh report." }],
    "known-identity": [{ ...base, category: "identity", recommendation: "Pin the agent identity and container mapping so writes cannot land in an unknown bucket." }],
    "search-latency-instrumented": [{
      ...base,
      category: "instrumentation",
      measured: {
        searchLatencySampleCount: numberValue(report.instrumentation?.searchLatencySampleCount),
        missingSearchLatencyCount: numberValue(report.instrumentation?.missingSearchLatencyCount),
      },
      recommendation: "Collect a fresh report from a patched adapter that records elapsed_ms on search/prefetch events. Summary-only exports cannot pass strict canary latency gates.",
    }],
    "store-latency-instrumented": [{
      ...base,
      category: "instrumentation",
      measured: {
        storeLatencySampleCount: numberValue(report.instrumentation?.storeLatencySampleCount),
        missingStoreLatencyCount: numberValue(report.instrumentation?.missingStoreLatencyCount),
      },
      recommendation: "Collect a fresh report from a patched adapter that records elapsed_ms on every store event. Older bundles without store latency cannot pass strict canary.",
    }],
    "recall-p95": [{
      ...base,
      category: "latency",
      measured: { recallP95Ms: recallP95 },
      recommendation: "Reduce recall work before prompt build: skip maintenance traffic, cap first-stage candidates, verify provider/read-through latency, and collect a fresh window.",
    }],
    "store-p95": [{
      ...base,
      category: storeP95 === 0 ? "instrumentation" : "latency",
      measured: { storeP95Ms: storeP95 },
      recommendation: storeP95 === 0
        ? "Update the adapter so store events record elapsed_ms, then collect a fresh report. Missing store latency cannot pass strict canary."
        : "Inspect embedding/rerank/store latency and reduce synchronous write work before collecting a fresh report.",
    }],
    "context-rate": [{ ...base, category: "retrieval-quality", recommendation: "Tune query routing or container mapping; fewer than half of prompt builds received context." }],
    "zero-result-rate": [{ ...base, category: "retrieval-quality", recommendation: "Check local container scope, hosted read-through mapping, and query terms. Too many recall attempts returned zero results." }],
    "write-success": [{ ...base, category: "write-lane", recommendation: "Fix rejected stores, char-limit failures, or provider write failures before additional rollout." }],
    "lifecycle-covered": [{ ...base, category: "lifecycle", recommendation: "Restore full lifecycle coverage: start, prompt-build recall, and end-of-turn store must all appear." }],
    "hybrid-search-covered": [{ ...base, category: "retrieval", recommendation: "Verify local search and hosted read-through both contribute, or explicitly disable hosted read-through claims." }],
    "local-writes-observed": [{ ...base, category: "write-lane", recommendation: "Confirm local writes land in the mapped RecallWeave container." }],
    "lcm-hook-observed": [{ ...base, category: "lifecycle", recommendation: "Trigger a compression or pre-compress cycle and confirm it is traced before rollout." }],
    "zero-privacy-leaks": [{ ...base, category: "privacy", recommendation: "Hard stop. Redact or remove the leaking diagnostic source and do not share the report." }],
    "zero-secret-hits": [{ ...base, category: "privacy", recommendation: "Hard stop. Rotate any exposed secret and regenerate a clean report." }],
    "no-raw-memory": [{ ...base, category: "privacy", recommendation: "Hard stop. The report must contain metrics only, never memory text." }],
    "no-raw-transcript": [{ ...base, category: "privacy", recommendation: "Hard stop. The report must not include session transcript text." }],
    "no-raw-prompt": [{ ...base, category: "privacy", recommendation: "Hard stop. The report must not include prompt text." }],
    "no-raw-answer": [{ ...base, category: "privacy", recommendation: "Hard stop. The report must not include answer text." }],
    "rollback-ready": [{ ...base, category: "rollback", recommendation: "Run and record the rollback drill before treating a canary as safe." }],
  };
  return map[name] ?? [{ ...base, recommendation: "Regenerate the report and inspect the named failed check." }];
}

function dedupeActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.check}:${action.category}:${action.recommendation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
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
