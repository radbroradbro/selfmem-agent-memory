import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const strict = Boolean(args.strict);
const watch = Boolean(args.watch);
const intervalMs = Math.max(1000, Number(args.intervalMs ?? 60000));
const maxIterations = Math.max(1, Number(args.maxIterations ?? (watch ? 12 : 1)));
const phase = String(args.phase ?? "reset");
const outputPath = args.output ? resolve(String(args.output)) : null;

const iterations = [];
for (let index = 0; index < maxIterations; index += 1) {
  const health = runResetHealth();
  const evaluation = evaluateHealth(health, { phase });
  iterations.push({
    index,
    checkedAt: new Date().toISOString(),
    healthHash: `sha256:${sha256(JSON.stringify({
      status: health.status,
      injection: health.injection,
      contextQuality: health.contextQuality,
      dogfoodMonitor: health.dogfoodMonitor,
      blockers: health.blockers,
      release: health.release,
    }))}`,
    status: evaluation.status,
    ok: evaluation.ok,
    phase,
    injection: {
      customHooksDisabled: health.injection?.customHooksDisabled === true,
      userPromptSubmitHookCount: Number(health.injection?.userPromptSubmitHookCount ?? 0),
      stopHookCount: Number(health.injection?.stopHookCount ?? 0),
    },
    noise: evaluation.noise,
    retrieval: evaluation.retrieval,
    writes: evaluation.writes,
    usefulness: evaluation.usefulness,
    directLookup: evaluation.directLookup,
    blockers: evaluation.blockers,
    nextActions: evaluation.nextActions,
  });
  if (!watch || index === maxIterations - 1) break;
  await sleep(intervalMs);
}

const failedIterations = iterations.filter((item) => !item.ok);
const report = {
  schemaVersion: 1,
  mode: "codex-memory-dogfood-monitor",
  generatedAt: new Date().toISOString(),
  ok: failedIterations.length === 0,
  status: failedIterations.length ? "BLOCKED_DOGFOOD_MONITOR" : "READY_DOGFOOD_MONITOR",
  phase,
  watch,
  intervalMs: watch ? intervalMs : 0,
  iterationCount: iterations.length,
  metricsOnly: true,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  writesRealFiles: Boolean(outputPath),
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawContextIncluded: false,
  autoFixesApplied: false,
  autoRecallExpansionAllowed: false,
  fixPolicy:
    "If monitoring detects noisy or confusing context, keep or turn automatic injection off, repair ranking/dedupe/write policy, rerun this monitor, and only then continue dogfood.",
  iterations,
  blockers: unique(failedIterations.flatMap((item) => item.blockers)),
  nextActions: unique(failedIterations.flatMap((item) => item.nextActions)),
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized);
if (outputPath) writeOutput(outputPath, serialized);
if (strict) {
  assert.equal(report.ok, true, serialized);
  assert.deepEqual(report.blockers, [], serialized);
}
process.stdout.write(serialized);

function evaluateHealth(health, { phase }) {
  const dogfood = health.dogfoodMonitor ?? {};
  const injection = health.injection ?? {};
  const noise = dogfood.noise ?? {};
  const retrieval = dogfood.retrieval ?? {};
  const writes = dogfood.writes ?? {};
  const usefulness = dogfood.usefulness ?? {};
  const directLookup = dogfood.directLookup ?? {};
  const blockers = [];

  if (dogfood.metricsOnly !== true) blockers.push("monitor-not-metrics-only");
  if (dogfood.rawMemoryIncluded === true || dogfood.rawTranscriptIncluded === true || dogfood.rawPromptIncluded === true) {
    blockers.push("monitor-raw-data-leak");
  }
  if (noise.severeNoiseClean !== true) blockers.push("severe-memory-noise-present");
  if (usefulness.contextQualityOk !== true) blockers.push("context-quality-failed");
  if (usefulness.quietPromptHasNoContext !== true) blockers.push("quiet-prompt-retrieved-context");
  if (Number(usefulness.taskScenarioPassRate ?? 0) < 1) blockers.push("task_context_scenario_incomplete");
  if (directLookup.directLookupUsefulnessOk !== true) blockers.push("direct_lookup_usefulness_failed");
  if (directLookup.quietLookupEmpty !== true) blockers.push("direct_lookup_noise_leaked");
  if (Number(writes.explicitStoreEvents ?? 0) === 0) blockers.push("explicit-write-not-observed");
  if (Number(writes.explicitStoreWriteRate ?? 0) < 0.95) blockers.push("explicit-write-rate-low");

  if (phase === "reset") {
    if (injection.customHooksDisabled !== true) blockers.push("reset-phase-hooks-enabled");
  } else if (phase === "rewired") {
    if (Number(injection.userPromptSubmitHookCount ?? 0) === 0) blockers.push("rewired-phase-recall-hook-missing");
    if (Number(injection.stopHookCount ?? 0) === 0) blockers.push("rewired-phase-stop-hook-missing");
    if (Number(retrieval.recallRunEvents ?? 0) === 0) blockers.push("rewired-phase-recall-not-observed");
    if (Number(retrieval.averageRecallMatches ?? 0) > 4) blockers.push("rewired-phase-recall-too-broad");
  } else if (phase !== "either") {
    blockers.push("unknown-monitor-phase");
  }

  const nextActions = [];
  if (blockers.includes("quiet-prompt-retrieved-context") || blockers.includes("context-quality-failed")) {
    nextActions.push("Disable or keep disabled automatic recall, repair ranking/domain gating, and rerun context-quality live audit.");
  }
  if (blockers.includes("severe-memory-noise-present")) {
    nextActions.push("Run local scrub/quarantine, inspect rejected/noise counts, and do not expand dogfood until severe noise is zero.");
  }
  if (blockers.includes("explicit-write-not-observed") || blockers.includes("explicit-write-rate-low")) {
    nextActions.push("Fix explicit store/write tooling before relying on automatic transcript extraction.");
  }
  if (blockers.includes("direct_lookup_usefulness_failed") || blockers.includes("direct_lookup_noise_leaked")) {
    nextActions.push("Fix direct lookup/query policy so task prompts retrieve bounded useful context and unrelated prompts retrieve nothing.");
  }
  if (blockers.includes("rewired-phase-recall-too-broad")) {
    nextActions.push("Tighten candidate limits, authority scoring, or domain filters before continuing live rewire.");
  }
  if (blockers.some((item) => item.startsWith("rewired-phase"))) {
    nextActions.push("Keep rewire to one Codex lane and gather another monitored interval after repair.");
  }

  return {
    ok: blockers.length === 0,
    status: blockers.length ? "BLOCKED_DOGFOOD_MONITOR" : "READY_DOGFOOD_MONITOR",
    noise,
    retrieval,
    writes,
    usefulness,
    directLookup,
    blockers,
    nextActions,
  };
}

function runResetHealth() {
  const result = spawnSync("node", ["packages/bench/codex-memory-reset-health.mjs"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `codex-memory-reset-health failed\n${result.stderr}\n${result.stdout}`);
  return JSON.parse(result.stdout);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function assertSafePublicText(text) {
  assert.doesNotMatch(text, secretPattern(), "dogfood monitor output contains key-shaped text");
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, "dogfood monitor output contains a private path");
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
}
