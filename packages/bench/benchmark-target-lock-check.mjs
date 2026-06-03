import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(root, args.input ?? "configs/benchmark-target-lock.json");
const reportedTargetsPath = resolve(root, args.reportedTargets ?? "reviews/overnight-20260522/reported-memory-targets-20260525.json");
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(inputPath), `target lock missing: ${displayPath(inputPath)}`);
assert.ok(existsSync(reportedTargetsPath), `reported targets missing: ${displayPath(reportedTargetsPath)}`);

const lockRaw = readFileSync(inputPath, "utf8");
const reportedRaw = readFileSync(reportedTargetsPath, "utf8");
assertSafePublicText(lockRaw, "benchmark target lock");
assertSafePublicText(reportedRaw, "reported targets");
const lock = JSON.parse(lockRaw);
const reportedTargets = JSON.parse(reportedRaw);
const primary = Array.isArray(reportedTargets.memoryTargets)
  ? reportedTargets.memoryTargets.find((item) => item.id === lock.primaryReportedMemoryTargetId)
  : null;
const report = buildReport({ lock, primary, lockRaw, reportedRaw });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "target lock report");
assertSafePublicText(markdownText, "target lock markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_BENCHMARK_TARGET_LOCK") process.exit(1);

function buildReport({ lock, primary, lockRaw, reportedRaw }) {
  const blockers = [
    lock.schemaVersion !== 1 ? "unsupported-schema-version" : null,
    lock.mode !== "benchmark-target-lock" ? "unexpected-mode" : null,
    lock.publicSafe !== true ? "target-lock-not-public-safe" : null,
    lock.metricsOnly !== true ? "target-lock-not-metrics-only" : null,
    lock.rawQuestionsIncluded !== false ? "raw-questions-flag-not-false" : null,
    lock.rawAnswersIncluded !== false ? "raw-answers-flag-not-false" : null,
    lock.rawMemoryIncluded !== false ? "raw-memory-flag-not-false" : null,
    !primary ? "primary-reported-target-not-found" : null,
    primary && primary.score !== lock.primaryReportedMemoryTarget?.score ? "primary-score-mismatch" : null,
    primary && primary.judgeModel !== lock.primaryReportedMemoryTarget?.judgeModel ? "primary-judge-model-mismatch" : null,
    primary && primary.benchmark !== lock.primaryReportedMemoryTarget?.benchmark ? "primary-benchmark-mismatch" : null,
    primary && primary.sourceUrl !== lock.primaryReportedMemoryTarget?.sourceUrl ? "primary-source-url-mismatch" : null,
    lock.comparisonContract?.reportedTargetsAreSourceLocksNotProofOfWin !== true ? "reported-target-boundary-missing" : null,
    lock.comparisonContract?.fullRunRequiredForPublicClaim !== true ? "full-run-public-claim-rule-missing" : null,
    lock.comparisonContract?.failureAccountedScoreRequired !== true ? "failure-accounted-score-rule-missing" : null,
    !arrayIncludes(lock.currentRecallWeaveClaimBoundary?.mayNotClaim, "RecallWeave beats Supermemory") ? "supermemory-win-ban-missing" : null,
    !arrayIncludes(lock.nextEvidenceRequired, "500Q full-run answer-quality result") ? "full-run-next-evidence-missing" : null,
  ].filter(Boolean);
  return {
    schemaVersion: 1,
    ok: blockers.length === 0,
    mode: "benchmark-target-lock-check",
    status: blockers.length === 0 ? "READY_BENCHMARK_TARGET_LOCK" : "BLOCKED_BENCHMARK_TARGET_LOCK",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    input: {
      path: displayPath(inputPath),
      hash: `sha256:${sha256(lockRaw)}`,
    },
    reportedTargets: {
      path: displayPath(reportedTargetsPath),
      hash: `sha256:${sha256(reportedRaw)}`,
      sourceEvidenceCheckedAt: reportedTargets.sourceEvidenceCheckedAt ?? null,
    },
    primaryReportedMemoryTarget: primary
      ? {
          id: primary.id,
          systemName: primary.systemName,
          benchmark: primary.benchmark,
          metricName: primary.metricName,
          score: primary.score,
          scoreUnit: primary.scoreUnit,
          judgeModel: primary.judgeModel,
          targetUse: primary.targetUse,
        }
      : null,
    comparisonContract: lock.comparisonContract ?? null,
    currentRecallWeaveClaimBoundary: lock.currentRecallWeaveClaimBoundary ?? null,
    blockers,
    nextActions: blockers.length
      ? ["Fix the target lock before using any reported Supermemory score as a comparison target."]
      : [
          "Use this target lock as the public-claim boundary for full-memory comparisons.",
          "Keep method-ladder and provider canary claims below this target until full-run target-matched gates pass.",
        ],
  };
}

function renderMarkdown(value) {
  return [
    "# Benchmark Target Lock",
    "",
    `- Status: ${value.status}`,
    `- Primary target: ${value.primaryReportedMemoryTarget?.id ?? "n/a"}`,
    `- Target score: ${value.primaryReportedMemoryTarget?.score ?? "n/a"} ${value.primaryReportedMemoryTarget?.scoreUnit ?? ""}`.trim(),
    `- Judge model: ${value.primaryReportedMemoryTarget?.judgeModel ?? "n/a"}`,
    `- Source evidence checked at: ${value.reportedTargets.sourceEvidenceCheckedAt ?? "n/a"}`,
    `- Blockers: ${value.blockers.length ? value.blockers.join(", ") : "none"}`,
    "",
    "## Claim Boundary",
    "",
    ...(value.currentRecallWeaveClaimBoundary?.mayClaim ?? []).map((item) => `- May claim: ${item}`),
    ...(value.currentRecallWeaveClaimBoundary?.mayNotClaim ?? []).map((item) => `- May not claim: ${item}`),
  ].join("\n");
}

function arrayIncludes(values, expected) {
  return Array.isArray(values) && values.some((value) => String(value).includes(expected));
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = values[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern =
    /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
  assert.doesNotMatch(text, secretPattern, `${label} contains credential-shaped text`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
}

function writeOutput(path, text) {
  writeFileSync(path, text);
}

function displayPath(path) {
  if (!path.startsWith(root)) return path;
  const offset = root.endsWith("/") ? root.length : root.length + 1;
  return path.slice(offset);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}
