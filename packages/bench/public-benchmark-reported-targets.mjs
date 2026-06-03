import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format ?? "json").toLowerCase();
const minimumSourceEvidenceCheckedAt = "2026-05-26";
const requiredComponentTargetIds = [
  "qwen3-embedding-0_6b-mteb-english-v2",
  "qwen3-embedding-4b-mteb-english-v2",
  "qwen3-embedding-8b-mteb-english-v2",
  "qwen3-reranker-0_6b-mteb-r",
  "qwen3-reranker-4b-mteb-r",
  "qwen3-reranker-8b-mteb-r",
  "embeddinggemma-local-model-card",
  "voyage-4-rerank-2-5-model-card",
  "gemini-embedding-2-model-card",
  "nvidia-retrieval-nim-model-card",
];
const requiredBenchmarkHarnessTargetIds = ["memorybench-supermemory-unified-suite"];
const inputPath = resolveInputPath(
  args.input ?? process.env.RECALLWEAVE_REPORTED_TARGETS_INPUT ?? "reviews/overnight-20260522/reported-memory-targets-20260525.json",
);
const outputPath = args.output ?? process.env.RECALLWEAVE_REPORTED_TARGETS_OUTPUT ?? null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ?? process.env.RECALLWEAVE_REPORTED_TARGETS_MARKDOWN ?? null;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(inputPath), `reported targets input missing: ${displayPath(inputPath)}`);

const raw = readFileSync(inputPath, "utf8");
assertSafePublicText(raw, displayPath(inputPath));
const input = JSON.parse(raw);
const memoryTargets = arrayOf(input.memoryTargets).map(normalizeMemoryTarget);
const componentTargets = arrayOf(input.componentTargets).map(normalizeComponentTarget);
const benchmarkHarnessTargets = arrayOf(input.benchmarkHarnessTargets).map(normalizeBenchmarkHarnessTarget);
const missingRequiredComponentTargetIds = requiredComponentTargetIds.filter((id) => !componentTargets.some((target) => target.id === id));
const missingRequiredBenchmarkHarnessTargetIds = requiredBenchmarkHarnessTargetIds.filter(
  (id) => !benchmarkHarnessTargets.some((target) => target.id === id),
);
const blockers = [
  input.schemaVersion !== 1 ? "unsupported-schema-version" : null,
  !requiredDate(input.sourceEvidenceCheckedAt) ? "missing-source-evidence-checked-at" : null,
  requiredDate(input.sourceEvidenceCheckedAt) && input.sourceEvidenceCheckedAt < minimumSourceEvidenceCheckedAt
    ? "stale-source-evidence-checked-at"
    : null,
  !memoryTargets.length ? "missing-memory-system-targets" : null,
  memoryTargets.some((target) => target.failedChecks.length > 0) ? "memory-target-validation-failed" : null,
  componentTargets.some((target) => target.failedChecks.length > 0) ? "component-target-validation-failed" : null,
  benchmarkHarnessTargets.some((target) => target.failedChecks.length > 0) ? "benchmark-harness-target-validation-failed" : null,
  missingRequiredComponentTargetIds.length ? "missing-required-component-target-source-lock" : null,
  missingRequiredBenchmarkHarnessTargetIds.length ? "missing-required-benchmark-harness-source-lock" : null,
  !memoryTargets.some((target) => target.eligibleAsPrimaryReportedTarget) ? "missing-primary-eligible-reported-target" : null,
].filter(Boolean);
const primaryReportedMemoryTarget =
  memoryTargets
    .filter((target) => target.eligibleAsPrimaryReportedTarget)
    .sort((a, b) => Number(b.score) - Number(a.score) || a.id.localeCompare(b.id))[0] ?? null;

const report = {
  schemaVersion: 1,
  ok: blockers.length === 0,
  mode: "public-benchmark-reported-targets",
  status: blockers.length === 0 ? "READY_REPORTED_TARGETS" : "BLOCKED_REPORTED_TARGETS",
  generatedAt: new Date().toISOString(),
  sourceEvidenceCheckedAt: input.sourceEvidenceCheckedAt ?? null,
  publicSafe: true,
  metricsOnly: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  printsCredentials: false,
  input: {
    path: displayPath(inputPath),
    hash: `sha256:${sha256(raw)}`,
  },
  checks: {
    memoryTargetCount: memoryTargets.length,
    componentTargetCount: componentTargets.length,
    benchmarkHarnessTargetCount: benchmarkHarnessTargets.length,
    sourceEvidenceCheckedAtCurrent:
      requiredDate(input.sourceEvidenceCheckedAt) && input.sourceEvidenceCheckedAt >= minimumSourceEvidenceCheckedAt,
    eligiblePrimaryMemoryTargetCount: memoryTargets.filter((target) => target.eligibleAsPrimaryReportedTarget).length,
    componentTargetsAreModelSelectionOnly: componentTargets.every((target) => target.failedChecks.length === 0),
    requiredComponentTargetIdsCovered: missingRequiredComponentTargetIds.length === 0,
    requiredBenchmarkHarnessTargetIdsCovered: missingRequiredBenchmarkHarnessTargetIds.length === 0,
    benchmarkHarnessTargetsAreSourceOnly: benchmarkHarnessTargets.every((target) => target.failedChecks.length === 0),
    everyMemoryTargetHasSourceLock: memoryTargets.every((target) => target.failedChecks.length === 0),
    primaryReportedMemoryTargetSelected: Boolean(primaryReportedMemoryTarget),
  },
  requiredCoverage: {
    minimumSourceEvidenceCheckedAt,
    requiredComponentTargetIds,
    missingRequiredComponentTargetIds,
    requiredBenchmarkHarnessTargetIds,
    missingRequiredBenchmarkHarnessTargetIds,
  },
  primaryReportedMemoryTarget: primaryReportedMemoryTarget ? stripValidation(primaryReportedMemoryTarget) : null,
  memoryTargets: memoryTargets.map(stripValidation),
  componentTargets: componentTargets.map(stripValidation),
  benchmarkHarnessTargets: benchmarkHarnessTargets.map(stripValidation),
  targetSelectionRule:
    "Use the highest eligible reported production/research memory-system target as the comparison target. Exclude component-only and experimental ceiling rows from primary SOTA comparison.",
  comparisonRule:
    "Reported scores can substitute for direct hosted usage when quota is blocked, but only as source-locked targets. RecallWeave still needs matching benchmark, scorer, answer model, judge model, and full-memory answer-quality evidence before a win counts.",
  blockers,
  nextActions: nextActions(blockers),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "reported target report");
assertSafePublicText(markdownText, "reported target markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function normalizeMemoryTarget(target) {
  const normalized = {
    id: safeString(target.id),
    systemName: safeString(target.systemName),
    sourceName: safeString(target.sourceName),
    sourceUrl: safeString(target.sourceUrl ?? target.source),
    retrievedAt: safeString(target.retrievedAt ?? target.checkedAt),
    benchmark: safeString(target.benchmark),
    benchmarkFamily: safeString(target.benchmarkFamily ?? target.benchmark),
    metricName: safeString(target.metricName),
    score: Number(target.score),
    scoreUnit: safeString(target.scoreUnit),
    judge: safeString(target.judge ?? target.judgeModel),
    judgeModel: safeString(target.judgeModel ?? target.judge),
    answerModel: safeString(target.answerModel),
    answerModelReported: target.answerModelReported === true,
    targetUse: safeString(target.targetUse),
    claimUse: safeString(target.claimUse ?? target.targetUse),
    evidenceType: safeString(target.evidenceType),
    caveat: safeString(target.caveat),
    comparableWhen: arrayOf(target.comparableWhen).map(safeString).filter(Boolean),
  };
  const failedChecks = [
    !requiredId(normalized.id) ? "id" : null,
    !requiredString(normalized.systemName) ? "system-name" : null,
    !requiredString(normalized.sourceName) ? "source-name" : null,
    !requiredUrl(normalized.sourceUrl) ? "source-url" : null,
    !requiredDate(normalized.retrievedAt) ? "retrieved-at" : null,
    !requiredString(normalized.benchmark) ? "benchmark" : null,
    !requiredString(normalized.metricName) ? "metric-name" : null,
    !Number.isFinite(normalized.score) ? "score" : null,
    !requiredString(normalized.scoreUnit) ? "score-unit" : null,
    !requiredString(normalized.judgeModel) ? "judge-model" : null,
    normalized.answerModelReported && !requiredString(normalized.answerModel) ? "answer-model" : null,
    !requiredString(normalized.targetUse) ? "target-use" : null,
    !requiredString(normalized.evidenceType) ? "evidence-type" : null,
    !requiredString(normalized.caveat) ? "caveat" : null,
    normalized.comparableWhen.length < 4 ? "comparability-conditions" : null,
  ].filter(Boolean);
  const eligibleAsPrimaryReportedTarget =
    failedChecks.length === 0 &&
    /reported-memory-system-target/.test(normalized.targetUse) &&
    !/experimental|ceiling|component/i.test(`${normalized.targetUse} ${normalized.claimUse}`);
  return { ...normalized, eligibleAsPrimaryReportedTarget, failedChecks };
}

function normalizeComponentTarget(target) {
  const normalized = {
    id: safeString(target.id),
    componentType: safeString(target.componentType),
    modelName: safeString(target.modelName),
    benchmark: safeString(target.benchmark),
    metricName: safeString(target.metricName),
    score: target.score === null || target.score === undefined ? null : Number(target.score),
    scoreUnit: safeString(target.scoreUnit),
    sourceName: safeString(target.sourceName),
    sourceUrl: safeString(target.sourceUrl ?? target.source),
    retrievedAt: safeString(target.retrievedAt ?? target.checkedAt),
    claimUse: safeString(target.claimUse),
    caveat: safeString(target.caveat),
  };
  const failedChecks = [
    !requiredId(normalized.id) ? "id" : null,
    !requiredString(normalized.componentType) ? "component-type" : null,
    !requiredString(normalized.modelName) ? "model-name" : null,
    !requiredString(normalized.benchmark) ? "benchmark" : null,
    !requiredString(normalized.metricName) ? "metric-name" : null,
    normalized.score !== null && !Number.isFinite(normalized.score) ? "score" : null,
    !requiredString(normalized.sourceName) ? "source-name" : null,
    !requiredUrl(normalized.sourceUrl) ? "source-url" : null,
    !requiredDate(normalized.retrievedAt) ? "retrieved-at" : null,
    !["model-selection-only", "component-evidence-only"].includes(normalized.claimUse) ? "model-selection-only-claim-use" : null,
    !requiredString(normalized.caveat) ? "caveat" : null,
  ].filter(Boolean);
  return { ...normalized, failedChecks };
}

function normalizeBenchmarkHarnessTarget(target) {
  const normalized = {
    id: safeString(target.id),
    harnessName: safeString(target.harnessName),
    sourceName: safeString(target.sourceName),
    sourceUrl: safeString(target.sourceUrl ?? target.source),
    retrievedAt: safeString(target.retrievedAt ?? target.checkedAt),
    benchmarkFamilies: arrayOf(target.benchmarkFamilies).map(safeString).filter(Boolean),
    supportedProviders: arrayOf(target.supportedProviders).map(safeString).filter(Boolean),
    phases: arrayOf(target.phases).map(safeString).filter(Boolean),
    claimUse: safeString(target.claimUse),
    caveat: safeString(target.caveat),
  };
  const failedChecks = [
    !requiredId(normalized.id) ? "id" : null,
    !requiredString(normalized.harnessName) ? "harness-name" : null,
    !requiredString(normalized.sourceName) ? "source-name" : null,
    !requiredUrl(normalized.sourceUrl) ? "source-url" : null,
    !requiredDate(normalized.retrievedAt) ? "retrieved-at" : null,
    normalized.benchmarkFamilies.length < 2 ? "benchmark-families" : null,
    normalized.supportedProviders.length < 2 ? "supported-providers" : null,
    normalized.phases.length < 4 ? "harness-phases" : null,
    normalized.claimUse !== "benchmark-harness-source-only" ? "benchmark-harness-source-only-claim-use" : null,
    !requiredString(normalized.caveat) ? "caveat" : null,
  ].filter(Boolean);
  return { ...normalized, failedChecks };
}

function stripValidation(target) {
  const { failedChecks, ...rest } = target;
  return rest;
}

function nextActions(blockers) {
  if (!blockers.length) {
    return [
      "Use the primary reported memory target as the SOTA comparison row in the ladder.",
      "Keep component targets in the model-selection lane only.",
      "Use benchmark harness targets only to choose a same-data full-memory evaluation route.",
      "Refresh this source-lock artifact whenever the public source rows or model matrix changes.",
    ];
  }
  return [
    "Fix the reported target source-lock fields before comparing RecallWeave to reported memory-system scores.",
    "Do not fall back to component benchmark scores for full memory-system claims.",
    "Do not treat benchmark harness availability as a score; it only source-locks the full evaluation route.",
    "Do not claim a win against a reported target until the source-lock report and SOTA ladder both pass.",
  ];
}

function renderMarkdown(value) {
  return [
    "# Reported Memory Targets",
    "",
    `- Status: ${value.status}`,
    `- Source evidence checked at: ${value.sourceEvidenceCheckedAt ?? "n/a"}`,
    `- Primary target: ${value.primaryReportedMemoryTarget?.id ?? "n/a"}`,
    `- Public safe: ${value.publicSafe}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Memory Targets",
    ...value.memoryTargets.map(
      (target) =>
        `- ${target.id}: ${target.score} ${target.scoreUnit} on ${target.benchmark}; judge=${target.judgeModel}; use=${target.targetUse}; source=${target.sourceUrl}`,
    ),
    "",
    "## Component Targets",
    ...value.componentTargets.map(
      (target) =>
        `- ${target.id}: ${target.modelName}, ${target.benchmark} ${target.metricName} ${target.score ?? "n/a"}; use=${target.claimUse}`,
    ),
    "",
    "## Benchmark Harness Targets",
    ...value.benchmarkHarnessTargets.map(
      (target) =>
        `- ${target.id}: ${target.harnessName}; families=${target.benchmarkFamilies.join(", ")}; providers=${target.supportedProviders.join(", ")}; use=${target.claimUse}`,
    ),
    "",
    "## Required Coverage",
    `- Minimum source evidence date: ${value.requiredCoverage.minimumSourceEvidenceCheckedAt}`,
    `- Missing component source locks: ${value.requiredCoverage.missingRequiredComponentTargetIds.join(", ") || "none"}`,
    `- Missing benchmark harness source locks: ${value.requiredCoverage.missingRequiredBenchmarkHarnessTargetIds.join(", ") || "none"}`,
    "",
    "## Rule",
    value.comparisonRule,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function requiredId(value) {
  return /^[a-z0-9][a-z0-9_-]{2,}$/i.test(String(value ?? ""));
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0 && !/^(?:todo|tbd|unknown|placeholder|n\/a)$/i.test(value.trim());
}

function requiredUrl(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function requiredDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function writeOutput(path, text) {
  const resolved = resolveInputPath(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
}

function resolveInputPath(value) {
  assert.ok(value, "path is required");
  return isAbsolute(String(value)) ? String(value) : resolve(root, String(value));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern =
    /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
  assert.ok(!secretPattern.test(text), `${label} appears to contain a credential`);
  assert.ok(!privatePathPattern.test(text), `${label} appears to contain a private path`);
}
