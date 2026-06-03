import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const strict = Boolean(args.strict);
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());
const defaultEvidencePath = join(root, reviewDir, "codex-memory-dogfood-evidence-current.json");
const evidencePath = args.evidence ? resolve(String(args.evidence)) : defaultEvidencePath;
const outputPath = args.output ? resolve(String(args.output)) : null;
const relativeEvidencePath = relative(root, evidencePath);
const evidencePathForReport = relativeEvidencePath && !relativeEvidencePath.startsWith("..")
  ? relativeEvidencePath
  : "<external-dogfood-evidence>";
const relativeOutputPath = outputPath ? relative(root, outputPath) : "";
const outputPathForReport = relativeOutputPath && !relativeOutputPath.startsWith("..")
  ? relativeOutputPath
  : "";
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
if (evidence.mode === "codex-memory-dogfood-evidence-check") {
  const report = buildSummaryReport(evidence, evidencePathForReport);
  emitReport(report);
  process.exit(0);
}
const iterations = Array.isArray(evidence.iterations) ? evidence.iterations : [];
const gate = evidence.graduationGate ?? {};
const ignoredIdleBlocker = "rewired-phase-user-facing-recall-not-observed";
const sourceIterationBlockers = iterations.flatMap((iteration) => Array.isArray(iteration?.blockers) ? iteration.blockers.map(String) : []);
const sourceTopLevelBlockers = Array.isArray(evidence.blockers) ? evidence.blockers.map(String) : [];
const sourceOnlyIdlePromptWindowBlockers =
  sourceTopLevelBlockers.every((blocker) => blocker === ignoredIdleBlocker)
  && sourceIterationBlockers.every((blocker) => blocker === ignoredIdleBlocker);
const failedIterationIndexes = iterations
  .filter((iteration) => !iterationEffectivelyClean(iteration))
  .map((iteration) => Number(iteration?.index ?? -1));
const confusingIterationIndexes = iterations
  .filter((iteration) => !iterationClean(iteration))
  .map((iteration) => Number(iteration?.index ?? -1));
const effectiveCleanIterations = iterations.filter((iteration) => iterationClean(iteration)).length;
const minCleanIterations = Number(gate.minCleanIterations ?? 12);
const observedUserFacingRecallEvents = sum(iterations.map((iteration) => Number(iteration?.retrieval?.userFacingRecallRunEvents ?? 0)));
const idleIntervalsWithoutUserFacingRecall = iterations
  .filter((iteration) => Number(iteration?.retrieval?.userFacingRecallRunEvents ?? 0) === 0)
  .length;
const sourceAcceptable = evidence.ok === true || sourceOnlyIdlePromptWindowBlockers;
const checks = [
  evidence.mode === "codex-memory-dogfood-monitor" ? null : "unexpected-monitor-mode",
  sourceAcceptable ? null : "monitor-not-ok",
  evidence.status === "READY_DOGFOOD_MONITOR" || sourceOnlyIdlePromptWindowBlockers ? null : "monitor-status-not-ready",
  evidence.phase === "rewired" ? null : "rewired-phase-required",
  evidence.watch === true ? null : "watched-run-required",
  evidence.metricsOnly === true ? null : "metrics-only-required",
  evidence.callsProviderApis === false ? null : "provider-api-call-not-allowed",
  evidence.callsHostedSupermemory === false ? null : "hosted-supermemory-call-not-allowed",
  evidence.rawMemoryIncluded === false ? null : "raw-memory-included",
  evidence.rawTranscriptIncluded === false ? null : "raw-transcript-included",
  evidence.rawPromptIncluded === false ? null : "raw-prompt-included",
  evidence.rawContextIncluded === false ? null : "raw-context-included",
  evidence.autoFixesApplied === false ? null : "auto-fixes-applied",
  evidence.autoRecallExpansionAllowed === false ? null : "auto-recall-expansion-allowed",
  gate.status === "READY_FOR_DOGFOOD_GRADUATION_REVIEW" || sourceOnlyIdlePromptWindowBlockers ? null : "graduation-gate-not-ready",
  gate.readyForDogfoodGraduationReview === true || sourceOnlyIdlePromptWindowBlockers ? null : "graduation-review-not-ready",
  gate.publicLaunchAllowed === false ? null : "public-launch-allowed",
  gate.countsAsBenchmarkEvidence === false ? null : "counts-as-benchmark-evidence",
  minCleanIterations >= 12 ? null : "min-clean-iterations-too-low",
  Number(gate.observedIterations ?? 0) >= minCleanIterations ? null : "observed-iterations-too-low",
  effectiveCleanIterations >= minCleanIterations ? null : "clean-iterations-too-low",
  effectiveCleanIterations === iterations.length ? null : "iterations-not-all-clean",
  (Array.isArray(gate.blockers) && gate.blockers.length === 0) || sourceOnlyIdlePromptWindowBlockers ? null : "graduation-gate-blocked",
  failedIterationIndexes.length === 0 ? null : "monitor-iteration-failed",
  confusingIterationIndexes.length === 0 ? null : "monitor-iteration-confusing",
].filter(Boolean);

const report = {
  schemaVersion: 1,
  mode: "codex-memory-dogfood-evidence-check",
  ok: checks.length === 0,
  evidence: outputPathForReport || evidencePathForReport,
  sourceEvidence: outputPathForReport ? evidencePathForReport : "",
  evidenceGeneratedAt: String(evidence.generatedAt ?? ""),
  phase: String(evidence.phase ?? ""),
  watch: evidence.watch === true,
  intervalMs: Number(evidence.intervalMs ?? 0),
  iterationCount: Number(evidence.iterationCount ?? iterations.length),
  metricsOnly: evidence.metricsOnly === true,
  callsProviderApis: evidence.callsProviderApis === true,
  callsHostedSupermemory: evidence.callsHostedSupermemory === true,
  sourceMonitorOk: evidence.ok === true,
  sourceMonitorStatus: String(evidence.status ?? ""),
  sourceMonitorReinterpreted: sourceOnlyIdlePromptWindowBlockers,
  ignoredSourceBlockers: sourceOnlyIdlePromptWindowBlockers ? [ignoredIdleBlocker] : [],
  sourceTopLevelBlockers,
  rawMemoryIncluded: evidence.rawMemoryIncluded === true,
  rawTranscriptIncluded: evidence.rawTranscriptIncluded === true,
  rawPromptIncluded: evidence.rawPromptIncluded === true,
  rawContextIncluded: evidence.rawContextIncluded === true,
  autoFixesApplied: evidence.autoFixesApplied === true,
  autoRecallExpansionAllowed: evidence.autoRecallExpansionAllowed === true,
  graduationGate: {
    status: checks.length === 0 ? "READY_FOR_DOGFOOD_GRADUATION_REVIEW" : String(gate.status ?? ""),
    readyForDogfoodGraduationReview: checks.length === 0,
    publicLaunchAllowed: gate.publicLaunchAllowed === true,
    countsAsBenchmarkEvidence: gate.countsAsBenchmarkEvidence === true,
    minCleanIterations,
    observedIterations: Number(gate.observedIterations ?? 0),
    cleanIterations: effectiveCleanIterations,
    elapsedMs: Number(gate.elapsedMs ?? 0),
    allIterationsClean: effectiveCleanIterations === iterations.length,
    observedUserFacingRecallEvents,
    idleIntervalsWithoutUserFacingRecall,
    blockers: checks,
  },
  monitoredSignals: {
    quietPromptClean: iterations.every((iteration) => iteration?.usefulness?.quietPromptHasNoContext === true),
    directLookupUseful: iterations.every((iteration) => iteration?.directLookup?.directLookupUsefulnessOk === true),
    directLookupQuietEmpty: iterations.every((iteration) => iteration?.directLookup?.quietLookupEmpty === true),
    relevanceGated: iterations.every((iteration) => iteration?.relevance?.relevanceReadyForAutoInjection === true),
    forcedOrPeriodicRecallAnchored: iterations.every((iteration) => iteration?.relevance?.forcedOrPeriodicRecallAnchored === true),
    randomCanaryBenchmarkInjectionRisk: iterations.some((iteration) => iteration?.relevance?.randomCanaryBenchmarkInjectionRisk === true),
    severeNoiseClean: iterations.every((iteration) => iteration?.noise?.severeNoiseClean === true),
    explicitWritesObserved: iterations.every((iteration) => Number(iteration?.writes?.explicitStoreEvents ?? 0) > 0),
  },
  failedIterationIndexes,
  confusingIterationIndexes,
  blockers: checks,
  claimBoundary: {
    publicLaunchAllowed: false,
    countsAsBenchmarkEvidence: false,
    releaseStillNeedsOwnerApproval: true,
    policy:
      "Watched dogfood evidence can make the Codex memory lane ready for graduation review, but it is not public launch approval or benchmark evidence. Idle intervals do not need a fresh user-facing prompt recall.",
  },
};

emitReport(report);

function buildSummaryReport(summary, evidencePathForReport) {
  const gate = summary.graduationGate ?? {};
  const signals = summary.monitoredSignals ?? {};
  const checks = [
    summary.ok === true ? null : "summary-not-ok",
    summary.phase === "rewired" ? null : "rewired-phase-required",
    summary.watch === true ? null : "watched-run-required",
    summary.metricsOnly === true ? null : "metrics-only-required",
    summary.callsProviderApis === false ? null : "provider-api-call-not-allowed",
    summary.callsHostedSupermemory === false ? null : "hosted-supermemory-call-not-allowed",
    summary.rawMemoryIncluded === false ? null : "raw-memory-included",
    summary.rawTranscriptIncluded === false ? null : "raw-transcript-included",
    summary.rawPromptIncluded === false ? null : "raw-prompt-included",
    summary.rawContextIncluded === false ? null : "raw-context-included",
    summary.autoFixesApplied === false ? null : "auto-fixes-applied",
    summary.autoRecallExpansionAllowed === false ? null : "auto-recall-expansion-allowed",
    gate.status === "READY_FOR_DOGFOOD_GRADUATION_REVIEW" ? null : "graduation-gate-not-ready",
    gate.readyForDogfoodGraduationReview === true ? null : "graduation-review-not-ready",
    gate.publicLaunchAllowed === false ? null : "public-launch-allowed",
    gate.countsAsBenchmarkEvidence === false ? null : "counts-as-benchmark-evidence",
    Number(gate.minCleanIterations ?? 0) >= 12 ? null : "min-clean-iterations-too-low",
    Number(gate.observedIterations ?? 0) >= Number(gate.minCleanIterations ?? 12) ? null : "observed-iterations-too-low",
    Number(gate.cleanIterations ?? 0) >= Number(gate.minCleanIterations ?? 12) ? null : "clean-iterations-too-low",
    gate.allIterationsClean === true ? null : "iterations-not-all-clean",
    Array.isArray(gate.blockers) && gate.blockers.length === 0 ? null : "graduation-gate-blocked",
    signals.quietPromptClean === true ? null : "quiet-prompt-not-clean",
    signals.directLookupUseful === true ? null : "direct-lookup-not-useful",
    signals.directLookupQuietEmpty === true ? null : "direct-lookup-quiet-not-empty",
    signals.relevanceGated === true ? null : "relevance-not-gated",
    signals.forcedOrPeriodicRecallAnchored === true ? null : "forced-periodic-not-anchored",
    signals.randomCanaryBenchmarkInjectionRisk === false ? null : "random-benchmark-canary-risk",
    signals.severeNoiseClean === true ? null : "severe-noise-not-clean",
    signals.explicitWritesObserved === true ? null : "explicit-writes-not-observed",
    Array.isArray(summary.failedIterationIndexes) && summary.failedIterationIndexes.length === 0
      ? null
      : "monitor-iteration-failed",
    Array.isArray(summary.confusingIterationIndexes) && summary.confusingIterationIndexes.length === 0
      ? null
      : "monitor-iteration-confusing",
    summary.claimBoundary?.publicLaunchAllowed === false ? null : "claim-boundary-public-launch-allowed",
    summary.claimBoundary?.countsAsBenchmarkEvidence === false ? null : "claim-boundary-counts-as-benchmark",
  ].filter(Boolean);
  return {
    ...summary,
    evidence: evidencePathForReport,
    sourceEvidenceMode: "summary",
    ok: checks.length === 0,
    blockers: checks,
    writesRealFiles: Boolean(outputPath),
  };
}

function emitReport(report) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  assertSafePublicText(serialized);
  if (outputPath) writeOutput(outputPath, serialized);
  if (strict) {
    assert.equal(report.ok, true, serialized);
    assert.deepEqual(report.blockers, [], serialized);
  }
  process.stdout.write(serialized);
}

function iterationClean(iteration) {
  return iteration?.noise?.severeNoiseClean === true
    && iteration?.usefulness?.quietPromptHasNoContext === true
    && iteration?.usefulness?.contextQualityOk === true
    && iteration?.directLookup?.directLookupUsefulnessOk === true
    && iteration?.directLookup?.quietLookupEmpty === true
    && iteration?.relevance?.relevanceReadyForAutoInjection === true
    && iteration?.relevance?.forcedOrPeriodicRecallAnchored === true
    && Number(iteration?.relevance?.unanchoredRecallEvents ?? 0) === 0
    && Number(iteration?.relevance?.missingAnchorForcedOrPeriodicRecallEvents ?? 0) === 0
    && iteration?.relevance?.randomCanaryBenchmarkInjectionRisk === false
    && Number(iteration?.writes?.explicitStoreEvents ?? 0) > 0
    && Number(iteration?.writes?.explicitStoreWriteRate ?? 0) >= 0.95;
}

function iterationEffectivelyClean(iteration) {
  return iterationClean(iteration)
    && (iteration?.ok === true || iterationOnlyHasIdlePromptWindowBlocker(iteration));
}

function iterationOnlyHasIdlePromptWindowBlocker(iteration) {
  const blockers = Array.isArray(iteration?.blockers) ? iteration.blockers.map(String) : [];
  return blockers.length > 0 && blockers.every((blocker) => blocker === ignoredIdleBlocker);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
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

function assertSafePublicText(text) {
  assert.doesNotMatch(text, secretPattern(), "dogfood evidence check output contains key-shaped text");
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, "dogfood evidence check output contains a private path");
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
}

async function latestReviewDir() {
  const entries = await readdir(join(root, "reviews"), { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `reviews/${entry.name}`)
    .sort();
  assert.ok(dirs.length > 0, "no review evidence directories found");
  return dirs.at(-1);
}
