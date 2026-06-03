import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const strict = Boolean(args.strict);
const format = String(args.format ?? "json").toLowerCase();
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());
const defaultEvidencePath = join(root, reviewDir, "codex-memory-dogfood-evidence-current.json");
const evidencePath = args.evidence ? resolve(String(args.evidence)) : defaultEvidencePath;
const outputPath = args.output ? resolve(String(args.output)) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(String(args.markdownOutput ?? args.markdown)) : null;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(evidencePath), `dogfood evidence missing: ${safePath(evidencePath)}`);
assert.ok(statSync(evidencePath).size > 0, `dogfood evidence is empty: ${safePath(evidencePath)}`);

const evidenceText = readFileSync(evidencePath, "utf8");
assertSafePublicText(evidenceText, "dogfood graduation evidence");
const evidence = JSON.parse(evidenceText);
const health = runJson(["node", "packages/bench/codex-memory-reset-health.mjs", "--strict"], "codex memory reset health");
const report = buildReport({ evidence, evidenceText, health });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "dogfood graduation review");
assertSafePublicText(markdownText, "dogfood graduation review markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
if (strict) {
  assert.equal(report.ok, true, jsonText);
  assert.deepEqual(report.blockers, [], jsonText);
}
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function buildReport({ evidence, evidenceText, health }) {
  const gate = evidence.graduationGate ?? {};
  const signals = evidence.monitoredSignals ?? {};
  const claimBoundary = evidence.claimBoundary ?? {};
  const sourceBridgeHashes = asStringArray(evidence.sourceBridgeHashes);
  const currentBridgeSourceHash = String(health.bridge?.sourceHash ?? "");
  const checks = [
    evidence.mode === "codex-memory-dogfood-evidence-check" ? null : "unexpected-evidence-mode",
    evidence.ok === true ? null : "dogfood-evidence-not-ok",
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
    Array.isArray(evidence.failedIterationIndexes) && evidence.failedIterationIndexes.length === 0
      ? null
      : "monitor-iteration-failed",
    Array.isArray(evidence.confusingIterationIndexes) && evidence.confusingIterationIndexes.length === 0
      ? null
      : "monitor-iteration-confusing",
    claimBoundary.publicLaunchAllowed === false ? null : "claim-boundary-public-launch-allowed",
    claimBoundary.countsAsBenchmarkEvidence === false ? null : "claim-boundary-counts-as-benchmark",
    health.ok === true ? null : "current-memory-health-not-ok",
    health.status === "READY_FOR_REWIRED_CONTROLLED_DOGFOOD" ? null : "current-memory-health-not-rewired-ready",
    health.release?.blockedByDogfoodMode === true ? null : "dogfood-release-boundary-missing",
    health.release?.blockers?.includes("codex-memory-controlled-dogfood-active") ? null : "controlled-dogfood-blocker-not-visible",
    currentBridgeSourceHash && sourceBridgeHashes.length === 1 && sourceBridgeHashes[0] === currentBridgeSourceHash
      ? null
      : "source-bridge-hash-stale",
  ].filter(Boolean);
  const pass = checks.length === 0;
  return {
    schemaVersion: 1,
    mode: "codex-memory-dogfood-graduation-review",
    ok: pass,
    status: pass ? "PASS_CONTROLLED_DOGFOOD_GRADUATION_REVIEW" : "BLOCKED_CONTROLLED_DOGFOOD_GRADUATION_REVIEW",
    generatedAt: new Date().toISOString(),
    metricsOnly: true,
    publicSafe: true,
    callsProviderApis: false,
    callsHostedSupermemory: false,
    writesRealFiles: Boolean(outputPath || markdownOutputPath),
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPromptIncluded: false,
    rawContextIncluded: false,
    evidence: {
      path: safePath(evidencePath),
      hash: `sha256:${sha256(evidenceText)}`,
      mode: String(evidence.mode ?? ""),
      phase: String(evidence.phase ?? ""),
      watch: evidence.watch === true,
      iterationCount: Number(evidence.iterationCount ?? 0),
      sourceMonitorStatus: String(evidence.sourceMonitorStatus ?? ""),
      sourceBridgeHashMatchesCurrent: evidence.sourceBridgeHashMatchesCurrent === true,
    },
    currentHealth: {
      status: String(health.status ?? ""),
      phase: String(health.phase ?? ""),
      blockerVisible: health.release?.blockers?.includes("codex-memory-controlled-dogfood-active") === true,
      sourceBridgeHash: currentBridgeSourceHash,
    },
    graduationGate: {
      readyForDogfoodGraduationReview: gate.readyForDogfoodGraduationReview === true,
      minCleanIterations: Number(gate.minCleanIterations ?? 0),
      observedIterations: Number(gate.observedIterations ?? 0),
      cleanIterations: Number(gate.cleanIterations ?? 0),
      elapsedMs: Number(gate.elapsedMs ?? 0),
      allIterationsClean: gate.allIterationsClean === true,
      blockers: Array.isArray(gate.blockers) ? gate.blockers.map(String) : [],
    },
    monitoredSignals: {
      quietPromptClean: signals.quietPromptClean === true,
      directLookupUseful: signals.directLookupUseful === true,
      directLookupQuietEmpty: signals.directLookupQuietEmpty === true,
      relevanceGated: signals.relevanceGated === true,
      forcedOrPeriodicRecallAnchored: signals.forcedOrPeriodicRecallAnchored === true,
      randomCanaryBenchmarkInjectionRisk: signals.randomCanaryBenchmarkInjectionRisk === true,
      severeNoiseClean: signals.severeNoiseClean === true,
      explicitWritesObserved: signals.explicitWritesObserved === true,
    },
    verdict: {
      controlledDogfoodGraduationReviewPassed: pass,
      memoryNoiseStepResolved: pass,
      relevanceRetrievalAndWriteLogicAccepted: pass,
      controlledCodexLaneCanContinue: pass,
      continuePeriodicMonitoringRequired: true,
      ownerApprovalRequired: true,
      publicLaunchAllowed: false,
      countsAsBenchmarkEvidence: false,
      broaderRolloutAllowed: false,
      productionDefaultAllowed: false,
    },
    blockers: checks,
    nextActions: pass
      ? [
          "Keep the rewired Codex lane under periodic dogfood monitoring.",
          "Do not broaden rollout, publish benchmark claims, or remove owner approval gates from this review.",
          "Continue the full-memory SOTA and strict-real canary blockers separately.",
        ]
      : [
          "Repair the dogfood evidence, rerun watched rewired intervals, and rerun this graduation review.",
        ],
  };
}

function renderMarkdown(report) {
  return [
    "# Codex Memory Dogfood Graduation Review",
    "",
    `- Status: ${report.status}`,
    `- Controlled dogfood review passed: ${report.verdict.controlledDogfoodGraduationReviewPassed}`,
    `- Memory noise step resolved: ${report.verdict.memoryNoiseStepResolved}`,
    `- Relevance, retrieval, and write logic accepted: ${report.verdict.relevanceRetrievalAndWriteLogicAccepted}`,
    `- Public launch allowed: ${report.verdict.publicLaunchAllowed}`,
    `- Counts as benchmark evidence: ${report.verdict.countsAsBenchmarkEvidence}`,
    `- Broader rollout allowed: ${report.verdict.broaderRolloutAllowed}`,
    `- Owner approval required: ${report.verdict.ownerApprovalRequired}`,
    "",
    "## Evidence",
    "",
    `- Evidence path: ${report.evidence.path}`,
    `- Evidence hash: ${report.evidence.hash}`,
    `- Current health: ${report.currentHealth.status}`,
    `- Iterations: ${report.graduationGate.cleanIterations}/${report.graduationGate.minCleanIterations}`,
    `- Bridge hash current: ${report.evidence.sourceBridgeHashMatchesCurrent}`,
    "",
    "## Signals",
    "",
    `- Quiet prompts clean: ${report.monitoredSignals.quietPromptClean}`,
    `- Direct lookup useful: ${report.monitoredSignals.directLookupUseful}`,
    `- Direct lookup quiet empty: ${report.monitoredSignals.directLookupQuietEmpty}`,
    `- Relevance gated: ${report.monitoredSignals.relevanceGated}`,
    `- Forced or periodic recall anchored: ${report.monitoredSignals.forcedOrPeriodicRecallAnchored}`,
    `- Random benchmark/canary injection risk: ${report.monitoredSignals.randomCanaryBenchmarkInjectionRisk}`,
    `- Severe noise clean: ${report.monitoredSignals.severeNoiseClean}`,
    `- Explicit writes observed: ${report.monitoredSignals.explicitWritesObserved}`,
    "",
    "## Blockers",
    "",
    ...(report.blockers.length ? report.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function runJson(command, label) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `${label} failed\n${result.stderr}\n${result.stdout}`);
  return JSON.parse(result.stdout);
}

function safePath(path) {
  const relativePath = relative(root, path);
  return relativePath && !relativePath.startsWith("..") ? relativePath : "<external-dogfood-evidence>";
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "")).filter(Boolean);
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern(), `${label} contains key-shaped text`);
  assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\/, `${label} contains a private path`);
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
