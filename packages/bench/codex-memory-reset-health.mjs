import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const strict = Boolean(args.strict);
const bridgePath = resolve(String(args.bridge ?? `${homedir()}/.codex/selfmem-bridge/bridge.js`));
const hooksPath = resolve(String(args.hooks ?? `${homedir()}/.codex/hooks.json`));
const codexConfigPath = resolve(String(args.codexConfig ?? `${homedir()}/.codex/config.toml`));
const bridgeStoreRoot = resolve(String(args.store ?? `${homedir()}/.codex/selfmem-bridge/store`));

const hooks = readJsonOrNull(hooksPath);
const codexConfig = readOptional(codexConfigPath);
const doctor = runJson(["node", bridgePath, "doctor"], "bridge doctor");
const contextQuality = runJson(
  ["node", join(root, "packages/bench/codex-memory-context-quality-audit.mjs"), "--live"],
  "context quality audit",
);
const storeHealth = inspectStore(bridgeStoreRoot);
const dogfoodMonitor = buildDogfoodMonitor({ storeHealth, contextQuality, doctor });
const publicSurface = inspectPublicSurface();
const injection = inspectInjectionState({ hooks, codexConfig });

const baseMemoryHealthReady =
  injection.nativeMemoryUseDisabled
  && injection.nativeMemoryGenerationDisabled
  && doctor.ok === true
  && doctor.mirrorWritesToSupermemory === false
  && contextQuality.ok === true;
const hooksRewired = injection.userPromptSubmitHookCount > 0 && injection.stopHookCount > 0;
const resetModeReady = injection.customHooksDisabled && baseMemoryHealthReady;
const rewiredDogfoodReady =
  hooksRewired
  && baseMemoryHealthReady
  && dogfoodMonitor.relevance?.relevanceReadyForAutoInjection === true
  && Array.isArray(dogfoodMonitor.rewireBlockers)
  && dogfoodMonitor.rewireBlockers.length === 0;
const controlledDogfoodReady = resetModeReady || rewiredDogfoodReady;
const phase = rewiredDogfoodReady ? "rewired" : resetModeReady ? "reset" : "blocked";
const status = rewiredDogfoodReady
  ? "READY_FOR_REWIRED_CONTROLLED_DOGFOOD"
  : resetModeReady
    ? "READY_FOR_CONTROLLED_DOGFOOD"
    : "BLOCKED_MEMORY_DOGFOOD_HEALTH";

const releaseBlockedByPublicSurface = publicSurface.publicSurfaceNeedsCollapse === true;
const releaseBlockedByDogfoodMode = true;
const releaseBlockers = [
  releaseBlockedByDogfoodMode ? "codex-memory-controlled-dogfood-active" : null,
  releaseBlockedByPublicSurface ? "public-review-surface-collapse-required" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  mode: "codex-memory-reset-health",
  generatedAt: new Date().toISOString(),
  ok: controlledDogfoodReady,
  status,
  phase,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  writesRealFiles: false,
  printsRawMemory: false,
  printsRawTranscript: false,
  printsPrivatePaths: false,
  countsAsBenchmarkEvidence: false,
  injection,
  bridge: {
    present: existsSync(bridgePath),
    sourceHash: existsSync(bridgePath) ? `sha256:${sha256(readFileSync(bridgePath))}` : "",
    doctorOk: doctor.ok === true,
    enabled: doctor.enabled === true,
    explicitStoreMode: doctor.explicitStoreMode === true,
    liveSupermemorySearch: doctor.liveSupermemorySearch === true,
    hostedWriteBackDisabled: doctor.mirrorWritesToSupermemory === false,
    recallPolicy: String(doctor.recallPolicy ?? ""),
  },
  contextQuality: {
    ok: contextQuality.ok === true,
    failedScenarios: Array.isArray(contextQuality.failedScenarios) ? contextQuality.failedScenarios : [],
    scenarioCount: Array.isArray(contextQuality.scenarios) ? contextQuality.scenarios.length : 0,
  },
  storeHealth,
  dogfoodMonitor,
  publicSurface,
  release: {
    resetPhaseReady: resetModeReady,
    blockedByDogfoodMode: releaseBlockedByDogfoodMode,
    blockedByPublicSurface: releaseBlockedByPublicSurface,
    blockers: releaseBlockers,
    reason: releaseBlockers.length
      ? "Codex memory is in controlled dogfood and public review evidence must stay compact before release."
      : "",
  },
  blockers: [
    injection.customHooksDisabled || hooksRewired ? null : "custom-prompt-stop-hooks-partially-enabled",
    injection.nativeMemoryUseDisabled ? null : "codex-native-memory-use-still-enabled",
    injection.nativeMemoryGenerationDisabled ? null : "codex-native-memory-generation-still-enabled",
    doctor.ok === true ? null : "bridge-doctor-failed",
    doctor.mirrorWritesToSupermemory === false ? null : "hosted-write-back-enabled",
    contextQuality.ok === true ? null : "context-quality-gate-failed",
    phase === "blocked" && hooksRewired ? "rewired-dogfood-gate-failed" : null,
  ].filter(Boolean),
};

const output = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(output);
if (strict) {
  assert.equal(report.ok, true, output);
  assert.deepEqual(report.blockers, [], output);
}
process.stdout.write(output);

function inspectInjectionState({ hooks, codexConfig }) {
  const hookNames = hooks?.hooks && typeof hooks.hooks === "object" ? Object.keys(hooks.hooks) : [];
  const userPromptHookCount = countHookCommands(hooks, "UserPromptSubmit");
  const stopHookCount = countHookCommands(hooks, "Stop");
  const nativeUse = readTomlBool(codexConfig.text, "use_memories");
  const nativeGenerate = readTomlBool(codexConfig.text, "generate_memories");
  return {
    hooksFilePresent: hooks !== null,
    hookEventCount: hookNames.length,
    userPromptSubmitHookCount: userPromptHookCount,
    stopHookCount,
    customHooksDisabled: userPromptHookCount === 0 && stopHookCount === 0,
    nativeMemoryUseDisabled: nativeUse === false,
    nativeMemoryGenerationDisabled: nativeGenerate === false,
  };
}

function countHookCommands(hooks, name) {
  const groups = Array.isArray(hooks?.hooks?.[name]) ? hooks.hooks[name] : [];
  return groups.flatMap((group) => Array.isArray(group?.hooks) ? group.hooks : []).length;
}

function inspectStore(storeRoot) {
  const memories = readJsonl(join(storeRoot, "memories.jsonl"));
  const distilled = readJsonl(join(storeRoot, "distilled-memories.jsonl"));
  const events = readJsonl(join(storeRoot, "events.jsonl"));
  const transcriptDir = join(storeRoot, "transcripts");
  const transcriptFiles = existsSync(transcriptDir) ? readdirSync(transcriptDir).filter((name) => name.endsWith(".jsonl")) : [];
  const allMemoryText = [...memories, ...distilled].map((item) => String(item.text ?? ""));
  const severeNoise = countNoise(allMemoryText);
  const kindCounts = {};
  for (const item of memories) {
    const kind = String(item.kind ?? "unknown");
    kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
  }
  return {
    memoryCount: memories.length,
    distilledCount: distilled.length,
    eventCount: events.length,
    transcriptCount: transcriptFiles.length,
    explicitStoreCount: events.filter((item) => item.type === "explicit-store").length,
    recallRunCount: events.filter((item) => item.type === "recall-run").length,
    recallSkipCount: events.filter((item) => item.type === "recall-skip").length,
    stopCount: events.filter((item) => item.type === "stop").length,
    kindCounts,
    eventMetrics: inspectEventMetrics(events),
    severeNoise,
    rawMemoryPrinted: false,
    rawTranscriptPrinted: false,
  };
}

function inspectEventMetrics(events) {
  const windowSize = Math.min(events.length, 500);
  const window = events.slice(-windowSize);
  const recallRuns = window.filter((item) => item.type === "recall-run");
  const recallSkips = window.filter((item) => item.type === "recall-skip");
  const prompts = window.filter((item) => item.type === "prompt");
  const stops = window.filter((item) => item.type === "stop");
  const explicitStores = events.filter((item) => item.type === "explicit-store");
  const recentExplicitStores = window.filter((item) => item.type === "explicit-store");
  const scrubs = window.filter((item) => item.type === "scrub");
  const recallMatchCounts = recallRuns.map((item) => numeric(item.matches)).filter((value) => value !== null);
  const auditForcedRecallEvents = recallRuns.filter((item) => String(item.reason ?? "") === "audit-forced").length;
  const forcedRecallEvents = recallRuns.filter((item) => String(item.reason ?? "") === "forced").length;
  const periodicRecallEvents = recallRuns.filter((item) => [
    "first-run",
    "prompt-interval",
    "time-interval",
    "long-prompt",
  ].includes(String(item.reason ?? ""))).length;
  const signalRecallEvents = recallRuns.filter((item) => String(item.reason ?? "").startsWith("signal:")).length;
  const domainRecallEvents = recallRuns.filter((item) => String(item.reason ?? "").startsWith("domain:")).length;
  const userFacingRecallRuns = recallRuns.filter((item) => String(item.reason ?? "") !== "audit-forced");
  const unanchoredRecallEvents = userFacingRecallRuns.filter((item) => {
    const reason = String(item.reason ?? "");
    const isAnchoredReason = ["forced", "first-run", "prompt-interval", "time-interval", "long-prompt"].includes(reason);
    if (!isAnchoredReason) return false;
    if (!Object.hasOwn(item, "anchorSource")) return false;
    return !["prompt", "stored", "signal"].includes(String(item.anchorSource ?? ""));
  }).length;
  const stopWritten = sum(stops.map((item) => numeric(item.written) ?? 0));
  const stopCandidates = sum(stops.map((item) => numeric(item.candidates) ?? 0));
  const explicitWritten = sum(explicitStores.map((item) => numeric(item.written) ?? 0));
  const explicitRejected = sum(explicitStores.map((item) => numeric(item.rejected) ?? 0));
  const explicitDuplicates = sum(explicitStores.map((item) => numeric(item.duplicateSuppressed) ?? 0));
  const recentExplicitWritten = sum(recentExplicitStores.map((item) => numeric(item.written) ?? 0));
  const recentExplicitRejected = sum(recentExplicitStores.map((item) => numeric(item.rejected) ?? 0));
  const recentExplicitDuplicates = sum(recentExplicitStores.map((item) => numeric(item.duplicateSuppressed) ?? 0));
  const latestScrub = scrubs.at(-1) ?? {};
  return {
    windowSize,
    promptEvents: prompts.length,
    recallRunEvents: recallRuns.length,
    recallSkipEvents: recallSkips.length,
    recallRunRate: ratio(recallRuns.length, recallRuns.length + recallSkips.length),
    userFacingRecallRunEvents: userFacingRecallRuns.length,
    userFacingRecallRunRate: ratio(userFacingRecallRuns.length, userFacingRecallRuns.length + recallSkips.length),
    auditForcedRecallEvents,
    forcedRecallEvents,
    periodicRecallEvents,
    forcedOrPeriodicRecallEvents: forcedRecallEvents + periodicRecallEvents,
    unanchoredRecallEvents,
    signalRecallEvents,
    domainRecallEvents,
    totalRecallMatches: sum(recallMatchCounts),
    averageRecallMatches: recallMatchCounts.length ? round(sum(recallMatchCounts) / recallMatchCounts.length) : 0,
    zeroMatchRecallEvents: recallMatchCounts.filter((value) => value === 0).length,
    explicitStoreEvents: explicitStores.length,
    explicitStoreWritten: explicitWritten,
    explicitStoreRejected: explicitRejected,
    explicitStoreDuplicateSuppressed: explicitDuplicates,
    explicitStoreWriteRate: ratio(explicitWritten, explicitWritten + explicitRejected + explicitDuplicates),
    recentExplicitStoreEvents: recentExplicitStores.length,
    recentExplicitStoreWritten: recentExplicitWritten,
    recentExplicitStoreRejected: recentExplicitRejected,
    recentExplicitStoreDuplicateSuppressed: recentExplicitDuplicates,
    recentExplicitStoreWriteRate: ratio(recentExplicitWritten, recentExplicitWritten + recentExplicitRejected + recentExplicitDuplicates),
    stopEvents: stops.length,
    stopCandidates,
    stopWritten,
    stopWriteRate: ratio(stopWritten, stopCandidates),
    scrubEvents: scrubs.length,
    latestScrubNoiseQuarantined: numeric(latestScrub.memoryNoiseQuarantined) ?? 0,
    latestScrubRejected: numeric(latestScrub.memoryRejected) ?? 0,
    latestScrubDuplicatesRemoved: numeric(latestScrub.memoryDuplicatesRemoved) ?? 0,
    metricsOnly: true,
    rawEventTextPrinted: false,
  };
}

function buildDogfoodMonitor({ storeHealth, contextQuality, doctor }) {
  const eventMetrics = storeHealth.eventMetrics ?? {};
  const scenarioReports = Array.isArray(contextQuality.scenarios) ? contextQuality.scenarios : [];
  const failedScenarios = Array.isArray(contextQuality.failedScenarios) ? contextQuality.failedScenarios : [];
  const quietPromptScenario = scenarioReports.find((scenario) => scenario.id === "unrelated-default-noise");
  const taskScenarios = scenarioReports.filter((scenario) => scenario.id !== "unrelated-default-noise");
  const taskScenarioCount = taskScenarios.length;
  const taskScenarioPassCount = taskScenarios.filter((scenario) => scenario.ok === true).length;
  const taskLookupRelevantCount = taskScenarios.filter((scenario) => {
    const expected = Object.values(scenario.expectedMatched ?? {});
    return scenario.ok === true
      && Number(scenario.itemCount ?? 0) > 0
      && Number(scenario.itemCount ?? 0) <= Number(scenario.maxContextItems ?? 5)
      && expected.length > 0
      && expected.every(Boolean);
  }).length;
  const directLookupPassRate = ratio(taskLookupRelevantCount, taskScenarioCount);
  const quietLookupEmpty = quietPromptScenario?.ok === true && Number(quietPromptScenario?.itemCount ?? 0) === 0;
  const severeNoiseClean =
    storeHealth.severeNoise.commandJsonMemoryCount === 0
    && storeHealth.severeNoise.functionCallMemoryCount === 0
    && storeHealth.severeNoise.goalContextMemoryCount === 0
    && storeHealth.severeNoise.subagentNotificationMemoryCount === 0
    && storeHealth.severeNoise.runtimeWarningMemoryCount === 0;
  const relevance = buildRelevanceHealth({
    eventMetrics,
    storeHealth,
    contextQuality,
    doctor,
    failedScenarios,
    quietLookupEmpty,
    directLookupPassRate,
  });
  return {
    mode: "metrics-only-live-dogfood-monitor",
    status: contextQuality.ok === true && severeNoiseClean
      ? "READY_TO_MONITOR_CONTROLLED_DOGFOOD"
      : "BLOCKED_DOGFOOD_MONITOR",
    monitoringRequiredBeforeRewire: true,
    monitoringRequiredAfterRewire: true,
    autoRecallRewireAllowedByThisReport: false,
    rewireBlockers: relevance.rewireBlockers,
    metricsOnly: true,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPromptIncluded: false,
    noise: {
      severeNoiseClean,
      canaryOrBenchmarkMemoryCount: storeHealth.severeNoise.canaryOrBenchmarkMemoryCount,
      randomCanaryBenchmarkInjectionRisk: relevance.randomCanaryBenchmarkInjectionRisk,
      latestScrubNoiseQuarantined: eventMetrics.latestScrubNoiseQuarantined ?? 0,
      latestScrubRejected: eventMetrics.latestScrubRejected ?? 0,
    },
    retrieval: {
      recallRunEvents: eventMetrics.recallRunEvents ?? 0,
      recallSkipEvents: eventMetrics.recallSkipEvents ?? 0,
      recallRunRate: eventMetrics.recallRunRate ?? 0,
      userFacingRecallRunEvents: eventMetrics.userFacingRecallRunEvents ?? 0,
      userFacingRecallRunRate: eventMetrics.userFacingRecallRunRate ?? 0,
      averageRecallMatches: eventMetrics.averageRecallMatches ?? 0,
      zeroMatchRecallEvents: eventMetrics.zeroMatchRecallEvents ?? 0,
      auditForcedRecallEvents: eventMetrics.auditForcedRecallEvents ?? 0,
      forcedRecallEvents: eventMetrics.forcedRecallEvents ?? 0,
      periodicRecallEvents: eventMetrics.periodicRecallEvents ?? 0,
      forcedOrPeriodicRecallEvents: eventMetrics.forcedOrPeriodicRecallEvents ?? 0,
      unanchoredRecallEvents: eventMetrics.unanchoredRecallEvents ?? 0,
      signalRecallEvents: eventMetrics.signalRecallEvents ?? 0,
      domainRecallEvents: eventMetrics.domainRecallEvents ?? 0,
    },
    writes: {
      explicitStoreEvents: eventMetrics.explicitStoreEvents ?? 0,
      explicitStoreWritten: eventMetrics.explicitStoreWritten ?? 0,
      explicitStoreRejected: eventMetrics.explicitStoreRejected ?? 0,
      explicitStoreDuplicateSuppressed: eventMetrics.explicitStoreDuplicateSuppressed ?? 0,
      explicitStoreWriteRate: eventMetrics.explicitStoreWriteRate ?? 0,
      recentExplicitStoreEvents: eventMetrics.recentExplicitStoreEvents ?? 0,
      recentExplicitStoreWritten: eventMetrics.recentExplicitStoreWritten ?? 0,
      recentExplicitStoreRejected: eventMetrics.recentExplicitStoreRejected ?? 0,
      recentExplicitStoreDuplicateSuppressed: eventMetrics.recentExplicitStoreDuplicateSuppressed ?? 0,
      recentExplicitStoreWriteRate: eventMetrics.recentExplicitStoreWriteRate ?? 0,
      stopEvents: eventMetrics.stopEvents ?? 0,
      stopCandidates: eventMetrics.stopCandidates ?? 0,
      stopWritten: eventMetrics.stopWritten ?? 0,
      stopWriteRate: eventMetrics.stopWriteRate ?? 0,
    },
    usefulness: {
      contextQualityOk: contextQuality.ok === true,
      failedScenarios,
      quietPromptHasNoContext: quietPromptScenario?.ok === true,
      taskScenarioCount,
      taskScenarioPassCount,
      taskScenarioPassRate: ratio(taskScenarioPassCount, taskScenarioCount),
    },
    directLookup: {
      mode: "context-quality-hash-only",
      contextHashesOnly: true,
      printsRawContext: false,
      taskLookupScenarios: taskScenarioCount,
      taskLookupRelevantCount,
      taskLookupPassRate: directLookupPassRate,
      quietLookupEmpty,
      confusingLookupCount: failedScenarios.length,
      directLookupUsefulnessOk: directLookupPassRate === 1 && quietLookupEmpty === true && failedScenarios.length === 0,
    },
    relevance,
  };
}

function buildRelevanceHealth({
  eventMetrics,
  storeHealth,
  contextQuality,
  doctor,
  failedScenarios,
  quietLookupEmpty,
  directLookupPassRate,
}) {
  const activeRecallPolicy = String(doctor?.recallPolicy ?? "");
  const unanchoredRecallEvents = Number(eventMetrics.unanchoredRecallEvents ?? 0);
  const canaryOrBenchmarkMemoryCount = Number(storeHealth.severeNoise.canaryOrBenchmarkMemoryCount ?? 0);
  const randomCanaryBenchmarkInjectionRisk = unanchoredRecallEvents > 0 && canaryOrBenchmarkMemoryCount > 0;
  const directLookupUseful = directLookupPassRate === 1 && quietLookupEmpty === true && failedScenarios.length === 0;
  const supportedRecallPolicy = ["periodic-or-signal", "signal-only", "never"].includes(activeRecallPolicy);
  const relevanceReadyForAutoInjection =
    supportedRecallPolicy
    && contextQuality.ok === true
    && directLookupUseful
    && unanchoredRecallEvents === 0
    && randomCanaryBenchmarkInjectionRisk === false;
  const rewireBlockers = [
    supportedRecallPolicy ? null : "recall-policy-not-supported",
    directLookupUseful ? null : "direct-lookup-not-useful",
    contextQuality.ok === true ? null : "context-quality-not-clean",
    unanchoredRecallEvents === 0 ? null : "unanchored-forced-or-periodic-recall-observed",
    randomCanaryBenchmarkInjectionRisk ? "benchmark-canary-memory-random-injection-risk" : null,
  ].filter(Boolean);

  return {
    status: relevanceReadyForAutoInjection
      ? "READY_FOR_RELEVANCE_GATED_AUTO_RECALL"
      : "BLOCKED_RELEVANCE_GATED_AUTO_RECALL",
    activeRecallPolicy,
    requiredRecallPolicy: "periodic-or-signal-with-anchored-relevance",
    auditForcedRecallEvents: Number(eventMetrics.auditForcedRecallEvents ?? 0),
    forcedRecallEvents: Number(eventMetrics.forcedRecallEvents ?? 0),
    periodicRecallEvents: Number(eventMetrics.periodicRecallEvents ?? 0),
    unanchoredRecallEvents,
    signalRecallEvents: Number(eventMetrics.signalRecallEvents ?? 0),
    domainRecallEvents: Number(eventMetrics.domainRecallEvents ?? 0),
    canaryOrBenchmarkMemoryCount,
    randomCanaryBenchmarkInjectionRisk,
    directLookupUseful,
    quietLookupEmpty,
    contextQualityOk: contextQuality.ok === true,
    relevanceReadyForAutoInjection,
    autoInjectionAllowed: false,
    rewireBlockers,
    policy:
      "Automatic prompt injection may run on a periodic-or-signal policy, but periodic or forced recalls must use a meaningful prompt/task anchor. Benchmark and canary memories are allowed only for matching benchmark/canary tasks.",
  };
}

function countNoise(texts) {
  const counters = {
    commandJsonMemoryCount: 0,
    functionCallMemoryCount: 0,
    goalContextMemoryCount: 0,
    subagentNotificationMemoryCount: 0,
    runtimeWarningMemoryCount: 0,
    canaryOrBenchmarkMemoryCount: 0,
  };
  for (const text of texts) {
    if (/^\s*(?:Fact|Procedure|Fix):\s*\{"cmd":/i.test(text)) counters.commandJsonMemoryCount += 1;
    if (/"type"\s*:\s*"function_call|"tool_uses"\s*:/i.test(text)) counters.functionCallMemoryCount += 1;
    if (/<goal_context>/i.test(text)) counters.goalContextMemoryCount += 1;
    if (/<subagent_notification>/i.test(text)) counters.subagentNotificationMemoryCount += 1;
    if (/Warning: The maximum number of unified exec processes|apply_patch was requested via exec_command/i.test(text)) counters.runtimeWarningMemoryCount += 1;
    if (/\b(canary|benchmark|bm25|shard|workorder|release gate)\b/i.test(text)) counters.canaryOrBenchmarkMemoryCount += 1;
  }
  return counters;
}

function inspectPublicSurface() {
  const trackedFiles = gitLsFiles();
  const reviewFiles = trackedFiles.filter((file) => file.startsWith("reviews/"));
  const reviewMarkdown = reviewFiles.filter((file) => file.endsWith(".md"));
  const docsMarkdown = trackedFiles.filter((file) => file.startsWith("docs/") && file.endsWith(".md"));
  const exportIgnoredFiles = gitExportIgnoredFiles(trackedFiles);
  const exportIgnoredReviewFiles = reviewFiles.filter((file) => exportIgnoredFiles.has(file));
  const exportIgnoredReviewMarkdown = reviewMarkdown.filter((file) => exportIgnoredFiles.has(file));
  const publicEvidenceIndexPath = join(root, "docs/PUBLIC_EVIDENCE_INDEX.md");
  const publicEvidenceIndexText = existsSync(publicEvidenceIndexPath)
    ? readFileSync(publicEvidenceIndexPath, "utf8")
    : "";
  const publicEvidenceIndexSafe = publicEvidenceIndexText.length > 0
    && !secretPattern().test(publicEvidenceIndexText)
    && !/\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/.test(publicEvidenceIndexText)
    && /reviews\/.*export-ignore/i.test(publicEvidenceIndexText)
    && /compact product docs/i.test(publicEvidenceIndexText);
  const publicReviewExportedFileCount = reviewFiles.length - exportIgnoredReviewFiles.length;
  const publicReviewExportedMarkdownCount = reviewMarkdown.length - exportIgnoredReviewMarkdown.length;
  const publicSurfaceCollapsed = reviewFiles.length > 0
    && publicReviewExportedFileCount === 0
    && publicEvidenceIndexSafe;
  const thresholdExceeded = reviewMarkdown.length > 50 || reviewFiles.length > 120;
  return {
    trackedMarkdownCount: trackedFiles.filter((file) => file.endsWith(".md")).length,
    trackedDocsMarkdownCount: docsMarkdown.length,
    trackedReviewFileCount: reviewFiles.length,
    trackedReviewMarkdownCount: reviewMarkdown.length,
    reviewExportIgnored: exportIgnoredReviewFiles.length === reviewFiles.length && reviewFiles.length > 0,
    reviewExportIgnoredFileCount: exportIgnoredReviewFiles.length,
    reviewExportIgnoredMarkdownCount: exportIgnoredReviewMarkdown.length,
    publicReviewExportedFileCount,
    publicReviewExportedMarkdownCount,
    publicEvidenceIndexPresent: publicEvidenceIndexText.length > 0,
    publicEvidenceIndexSafe,
    publicSurfaceCollapsed,
    publicSurfaceNeedsCollapse: thresholdExceeded && !publicSurfaceCollapsed,
  };
}

function gitExportIgnoredFiles(files) {
  if (!files.length) return new Set();
  const result = spawnSync("git", ["check-attr", "--stdin", "export-ignore"], {
    cwd: root,
    input: `${files.join("\n")}\n`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) return new Set();
  const ignored = new Set();
  for (const line of result.stdout.split("\n").filter(Boolean)) {
    const marker = ": export-ignore: ";
    const index = line.lastIndexOf(marker);
    if (index < 0) continue;
    if (line.slice(index + marker.length).trim() === "set") {
      ignored.add(line.slice(0, index));
    }
  }
  return ignored;
}

function gitLsFiles() {
  const result = spawnSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return [];
  return result.stdout.split("\n").filter(Boolean);
}

function runJson(command, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    return { ok: false, label, exitStatus: result.status };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { ok: false, label, parseError: true };
  }
}

function readOptional(path) {
  try {
    return { present: true, text: readFileSync(path, "utf8"), bytes: statSync(path).size };
  } catch {
    return { present: false, text: "", bytes: 0 };
  }
}

function readJsonOrNull(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function readTomlBool(text, key) {
  const match = String(text).match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*$`, "m"));
  if (!match) return null;
  return match[1] === "true";
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return round(Number(numerator) / Number(denominator));
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function assertSafePublicText(text) {
  assert.doesNotMatch(text, secretPattern(), "reset-health output contains key-shaped text");
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, "reset-health output contains private path");
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
}
