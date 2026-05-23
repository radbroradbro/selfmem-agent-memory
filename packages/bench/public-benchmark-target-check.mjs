import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.target;
const strict = Boolean(args.strict);
const format = String(args.format ?? "json").toLowerCase();
const targetPath = resolveInputPath(
  args.target ??
    args.targetFile ??
    process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ??
    (fixtureRequested ? "packages/bench/fixtures/public-benchmark-target.fixture.json" : null),
);
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET_REPORT_JSON ?? null;

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const claimTiers = new Set(["fixture", "canary-trend", "canary-trending-win", "public-benchmark", "broad-sota"]);
const memoryBenchmarks = new Set(["memorybench", "longmemeval", "longmemeval-v2", "locomo", "convomem", "beam"]);
const componentBenchmarks = new Set(["mteb", "mmteb", "beir", "miracl", "ms marco", "ms-marco", "reranker"]);
const sha256Pattern = /^sha256:[a-f0-9]{64}$/i;
const placeholderPattern = /^(?:todo|tbd|unknown|changeme|placeholder|example|sample|dummy|none|null|n\/a)$/i;

assert.ok(targetPath, "public benchmark target is required. Pass --target or RECALLWEAVE_PUBLIC_BENCHMARK_TARGET");
assert.ok(existsSync(targetPath), `public benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `public benchmark target empty: ${displayPath(targetPath)}`);

const raw = readFileSync(targetPath, "utf8");
assertSafePublicText(raw, displayPath(targetPath));
const target = JSON.parse(raw);
const fixtureOnly = fixtureRequested || target.fixtureOnly === true || displayPath(targetPath).includes("/fixtures/");
const contract = inspectTarget(target, fixtureOnly);
const failedChecks = failedTargetChecks(contract);
const ok = failedChecks.length === 0;
const publicBenchmarkClaimsAllowed = false;
const targetReadyForCanary =
  ok &&
  !fixtureOnly &&
  contract.benchmarkType === "memory" &&
  contract.sameDataReady &&
  contract.reportedTargetReady &&
  contract.componentEvidenceOnly &&
  ["canary-trend", "public-benchmark", "broad-sota"].includes(contract.claimTier);

const report = {
  ok,
  mode: "public-benchmark-target-check",
  schemaVersion: 1,
  fixtureOnly,
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  publicSafe: true,
  rawQuestionIdsIncluded: false,
  rawLabelsIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  publicBenchmarkClaimsAllowed,
  targetReadyForCanary,
  targetSummary: {
    targetIdHash: shortHash(target.targetId ?? target.id ?? "missing-target-id"),
    benchmarkName: safeText(target.benchmark?.name ?? target.benchmarkName ?? ""),
    benchmarkType: contract.benchmarkType,
    claimTier: contract.claimTier,
    benchmarkFamily: contract.benchmarkFamily,
    sourceUrlHost: urlHost(target.benchmark?.sourceUrl ?? target.sourceUrl ?? ""),
    checkedAt: safeText(target.benchmark?.checkedAt ?? target.checkedAt ?? ""),
    questionIdCount: contract.questionIdCount,
    componentEvidenceCount: contract.componentEvidenceCount,
    metricCount: contract.metricCount,
  },
  hashes: {
    targetFileHash: `sha256:${stableHash(raw)}`,
    datasetRevisionHash: target.benchmark?.datasetRevision ? `sha256:${shortHash(target.benchmark.datasetRevision)}` : null,
    splitHash: target.benchmark?.split ? `sha256:${shortHash(target.benchmark.split)}` : null,
    questionIdsHash: contract.questionIdsHash,
    answerLabelsHash: normalizeHash(target.benchmark?.answerLabelsHash),
    scoringCodeHash: normalizeHash(target.benchmark?.scoringCodeHash),
  },
  contract,
  failedChecks,
  nextActions: nextActions({ ok, fixtureOnly, contract, failedChecks }),
  safety: {
    printsCredentialValues: false,
    includesRawQuestionIds: false,
    includesRawLabels: false,
    includesRawMemoryText: false,
    includesRawTranscriptText: false,
    requiresSameData: true,
    componentBenchmarksAreModelSelectionOnly: true,
    publicClaimsRequireResultsElsewhere: true,
  },
};

const serialized = format === "markdown" ? `${renderMarkdown(report)}\n` : `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "public benchmark target report");
if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);
if (strict && !targetReadyForCanary) process.exit(1);

function inspectTarget(target, fixtureOnly) {
  const benchmark = target.benchmark && typeof target.benchmark === "object" ? target.benchmark : {};
  const reportedTarget = target.reportedTarget && typeof target.reportedTarget === "object" ? target.reportedTarget : {};
  const comparability = target.comparability && typeof target.comparability === "object" ? target.comparability : {};
  const components = Array.isArray(target.componentEvidence) ? target.componentEvidence : [];
  const benchmarkName = String(benchmark.name ?? target.benchmarkName ?? "").trim();
  const benchmarkFamily = normalizeBenchmarkName(benchmark.family ?? benchmarkName);
  const benchmarkType = String(target.benchmarkType ?? "").trim().toLowerCase();
  const claimTier = normalizeClaimTier(target.claimTier ?? (fixtureOnly ? "fixture" : ""));
  const questionIds = Array.isArray(benchmark.questionIds) ? benchmark.questionIds.filter((item) => String(item).trim()) : [];
  const metrics = Array.isArray(benchmark.metrics) ? benchmark.metrics.filter((item) => String(item).trim()) : [];
  const componentEvidenceOnly = components.every((item) => {
    const claimUse = String(item?.claimUse ?? item?.claimUsage ?? "").trim().toLowerCase();
    return claimUse === "model-selection-only" || claimUse === "component-evidence-only";
  });
  const componentBenchmarkOnly = benchmarkType === "component" || componentBenchmarks.has(benchmarkFamily);
  const memoryBenchmark = benchmarkType === "memory" && memoryBenchmarks.has(benchmarkFamily);
  const sameJudgeModel = sameComparableText(benchmark.judgeModel, reportedTarget.judgeModel);
  const sameAnswerModel = sameComparableText(benchmark.answerModel, reportedTarget.answerModel);
  const sameDataReady =
    memoryBenchmark &&
    requiredUrl(benchmark.sourceUrl) &&
    requiredDate(benchmark.checkedAt) &&
    requiredNonPlaceholderString(benchmark.datasetRevision) &&
    requiredNonPlaceholderString(benchmark.split) &&
    (questionIds.length > 0 || requiredString(benchmark.questionIdPolicy)) &&
    requiredNonPlaceholderString(benchmark.answerLabelsRef) &&
    requiredSha256(benchmark.answerLabelsHash) &&
    requiredNonPlaceholderString(benchmark.judgeModel) &&
    requiredNonPlaceholderString(benchmark.answerModel) &&
    requiredNonPlaceholderString(benchmark.judgeRule) &&
    requiredNonPlaceholderString(benchmark.scoringScriptRef) &&
    requiredSha256(benchmark.scoringCodeHash) &&
    sameJudgeModel &&
    sameAnswerModel &&
    metrics.length > 0;
  const reportedTargetReady =
    requiredNonPlaceholderString(reportedTarget.sourceName) &&
    requiredUrl(reportedTarget.sourceUrl) &&
    requiredDate(reportedTarget.checkedAt) &&
    requiredNonPlaceholderString(reportedTarget.metricName) &&
    Number.isFinite(Number(reportedTarget.score)) &&
    requiredNonPlaceholderString(reportedTarget.judgeModel) &&
    requiredNonPlaceholderString(reportedTarget.answerModel) &&
    (Number.isFinite(Number(reportedTarget.tokenBudget)) || reportedTarget.tokenBudgetReported === false) &&
    requiredNonPlaceholderString(reportedTarget.caveat);
  return {
    benchmarkType,
    claimTier,
    benchmarkFamily,
    memoryBenchmark,
    componentBenchmarkOnly,
    sameDataReady,
    reportedTargetReady,
    componentEvidenceOnly,
    metricDefinitionsMatch: comparability.metricDefinitionsMatch === true,
    sameDatasetSource: comparability.sameDatasetSource === true,
    sameDatasetRevision: comparability.sameDatasetRevision === true,
    sameSplit: comparability.sameSplit === true,
    sameLabels: comparability.sameLabels === true,
    sameJudgeModel,
    sameAnswerModel,
    sameJudgeRule: comparability.sameJudgeRule === true,
    sameScoringCode: comparability.sameScoringCode === true,
    questionIdCount: questionIds.length,
    questionIdsHash: questionIds.length > 0 ? `sha256:${shortHash(questionIds.join("\n"))}` : null,
    metricCount: metrics.length,
    componentEvidenceCount: components.length,
    fullComparableBenchmarkCount: Number(target.fullComparableBenchmarkCount ?? 0),
  };
}

function failedTargetChecks(contract) {
  const checks = [];
  if (!claimTiers.has(contract.claimTier)) checks.push("known-claim-tier");
  if (!["memory", "component"].includes(contract.benchmarkType)) checks.push("known-benchmark-type");
  if (contract.componentBenchmarkOnly) checks.push("component-benchmark-not-memory-claim");
  if (!contract.memoryBenchmark) checks.push("memory-benchmark-family");
  if (!contract.sameDataReady) checks.push("same-data-fields");
  if (!contract.reportedTargetReady) checks.push("reported-target-fields");
  if (!contract.componentEvidenceOnly) checks.push("component-evidence-model-selection-only");
  if (!contract.metricDefinitionsMatch) checks.push("metric-definitions-match");
  if (!contract.sameDatasetSource) checks.push("same-dataset-source");
  if (!contract.sameDatasetRevision) checks.push("same-dataset-revision");
  if (!contract.sameSplit) checks.push("same-split");
  if (!contract.sameLabels) checks.push("same-labels");
  if (!contract.sameJudgeModel) checks.push("same-judge-model");
  if (!contract.sameAnswerModel) checks.push("same-answer-model");
  if (!contract.sameJudgeRule) checks.push("same-judge-rule");
  if (!contract.sameScoringCode) checks.push("same-scoring-code");
  if (contract.claimTier === "broad-sota" && contract.fullComparableBenchmarkCount < 2) checks.push("broad-sota-needs-multiple-full-runs");
  return checks;
}

function nextActions({ ok, fixtureOnly, contract, failedChecks }) {
  if (!ok) {
    return [
      `Fix failed checks: ${failedChecks.join(", ")}.`,
      "Use a memory-system benchmark target, not an embedding-only or reranker-only leaderboard row.",
      "Declare source URL, checked date, dataset revision, split, labels, judge model, answer model, judge rule, and scoring script before running RecallWeave.",
    ];
  }
  if (fixtureOnly) {
    return [
      "Fixture target is structurally valid. Replace it with a real source-locked MemoryBench, LongMemEval, LoCoMo, ConvoMem, BEAM, or LongMemEval-V2 target before claiming any score.",
      "Run the RecallWeave arm on the same data, revision, split, labels, judge model, answer model, judge rule, and scoring script.",
      "Keep MTEB/MMTEB/BEIR/MIRACL/MS MARCO evidence separate as model-arm selection evidence.",
    ];
  }
  if (contract.claimTier === "canary-trend") {
    return [
      "Run the source-locked canary slice and attach metrics-only results.",
      "Describe any win as a canary trend, not broad SOTA.",
      "Expand to the full comparable benchmark only after reviewer approval.",
    ];
  }
  return [
    "Attach the full comparable run, reviewer approval, privacy scan, scoring-code hash, and result packet before public benchmark language.",
  ];
}

function renderMarkdown(report) {
  return [
    "# Public Benchmark Target Check",
    "",
    `- OK: ${report.ok}`,
    `- Fixture only: ${report.fixtureOnly}`,
    `- Benchmark: ${report.targetSummary.benchmarkName}`,
    `- Benchmark type: ${report.targetSummary.benchmarkType}`,
    `- Claim tier: ${report.targetSummary.claimTier}`,
    `- Target ready for canary: ${report.targetReadyForCanary}`,
    `- Public benchmark claims allowed: ${report.publicBenchmarkClaimsAllowed}`,
    `- Failed checks: ${report.failedChecks.length === 0 ? "none" : report.failedChecks.join(", ")}`,
    "",
    "## Next Actions",
    "",
    ...report.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function normalizeBenchmarkName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^longmemeval-s$/, "longmemeval")
    .replace(/^longmemeval-v1$/, "longmemeval")
    .replace(/^ms-marco$/, "ms-marco");
}

function normalizeHash(value) {
  if (!requiredString(value)) return null;
  const text = String(value).trim();
  return text.startsWith("sha256:") ? text : `sha256:${shortHash(text)}`;
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requiredNonPlaceholderString(value) {
  return requiredString(value) && !placeholderPattern.test(String(value).trim()) && !String(value).toLowerCase().startsWith("fixture");
}

function requiredSha256(value) {
  return requiredString(value) && sha256Pattern.test(String(value).trim());
}

function requiredDate(value) {
  return requiredString(value) && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim()) && !Number.isNaN(Date.parse(String(value)));
}

function requiredUrl(value) {
  if (!requiredString(value)) return false;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && Boolean(url.host);
  } catch {
    return false;
  }
}

function sameComparableText(left, right) {
  if (!requiredNonPlaceholderString(left) || !requiredNonPlaceholderString(right)) return false;
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

function normalizeClaimTier(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "canary-trending-win" ? "canary-trend" : normalized;
}

function urlHost(value) {
  try {
    return new URL(String(value)).host;
  } catch {
    return "";
  }
}

function safeText(value) {
  return String(value ?? "").replace(privatePathPattern, "[redacted-path]").replace(secretPattern, "[redacted-secret]");
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  if (!rel.startsWith("../") && rel !== "..") return rel;
  return `external:${basename(value)}`;
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path or raw runtime file name`);
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = toCamel(item.slice(2));
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
