import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const inputPath = resolveInputPath(args.input ?? `${reviewDir}/answer-quality-local-full-shard-005-20260527.json`);
const planPath = resolveInputPath(args.plan ?? `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const sourceState = loadRequiredJson(inputPath, "superset shard result");
const planState = loadRequiredJson(planPath, "local-full shard plan");
const source = sourceState.json;
const plan = planState.json;
const requiredStrategies = arrayOf(plan.runPlan?.strategies);
const sourceStrategies = arrayOf(source.strategies);
const sourceStrategyMap = new Map(sourceStrategies.map((item) => [item.strategy, item]));
const projectedStrategies = requiredStrategies.map((strategy) => {
  const row = sourceStrategyMap.get(strategy);
  assert.ok(row, `source shard is missing required strategy: ${strategy}`);
  return row;
});
const droppedStrategies = sourceStrategies
  .map((item) => item.strategy)
  .filter((strategy) => !requiredStrategies.includes(strategy));
const winner = bestBy(projectedStrategies, (item) => Number(item.metrics?.answerQuality ?? 0));

assert.equal(source.mode, "public-benchmark-answer-quality", "source must be an answer-quality report");
assert.equal(source.fixtureOnly, false, "source must be a non-fixture result");
assert.equal(source.metricsOnly, true, "source must be metrics only");
assert.equal(source.publicSafe, true, "source must be public safe");
assert.equal(source.rawQuestionsIncluded, false, "source must not include raw questions");
assert.equal(source.rawAnswersIncluded, false, "source must not include raw answers");
assert.equal(source.rawMemoryIncluded, false, "source must not include raw memories");
assert.equal(source.rawTranscriptIncluded, false, "source must not include raw transcript text");
assert.equal(source.target?.hash, plan.target?.hash, "source target hash must match plan");
assert.equal(source.input?.targetHash, plan.target?.hash, "source input target hash must match plan");
assert.equal(source.input?.querySetHash, plan.materializeReport?.collectorCompatibleQuerySetHash, "source queryset hash must match plan");
assert.equal(source.input?.materializerHash, plan.materializeReport?.materializerHash, "source materializer hash must match plan");
assert.equal(Number(source.input?.totalQueryCount ?? 0), Number(plan.runPlan?.queryCount ?? 0), "source total query count must match plan");
assert.equal(Number(source.input?.queryCount ?? 0), Number(plan.runPlan?.queryCount ?? 0), "source query count must match plan");
assert.ok(droppedStrategies.length > 0, "source should be a superset result with at least one dropped strategy");

const projected = {
  ...source,
  generatedAt: new Date().toISOString(),
  projection: {
    mode: "local-full-shard-common-arm-projection",
    sourceFileName: basename(inputPath),
    sourceHash: sourceState.hash,
    planFileName: basename(planPath),
    planHash: planState.hash,
    exactStrategySetProjected: true,
    sourceWasStrategySuperset: sourceStrategies.length > requiredStrategies.length,
    requiredStrategies,
    sourceStrategyCount: sourceStrategies.length,
    projectedStrategyCount: projectedStrategies.length,
    droppedStrategies,
    droppedStrategiesCountAsEvidence: false,
    countsAsLocalFullBenchmarkEvidence: true,
    countsAsFullMemorySotaEvidence: false,
    publicBenchmarkClaimsAllowed: false,
  },
  strategies: projectedStrategies,
  metrics: winner?.metrics ?? null,
  winner: winner
    ? {
        strategy: winner.strategy,
        answerQuality: Number(winner.metrics?.answerQuality ?? 0),
        judgeCorrectRate: Number(winner.metrics?.judgeCorrectRate ?? 0),
        answerLatencyP50Ms: Number(winner.metrics?.answerLatencyP50Ms ?? 0),
      }
    : null,
  nextActions: [
    "Use this projected result only for strict local-full common-arm shard intake.",
    "Keep the original expanded wiki-method shard as diagnostic evidence; do not count dropped wiki arms in local-full aggregation.",
    "Do not use this projection for public SOTA or production-memory claims.",
  ],
};

const jsonText = `${JSON.stringify(projected, null, 2)}\n`;
const markdownText = `${renderMarkdown(projected)}\n`;
assertSafePublicText(jsonText, "local-full common-arm projection json");
assertSafePublicText(markdownText, "local-full common-arm projection markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function renderMarkdown(report) {
  const shard = report.input?.queryShard ?? {};
  return [
    "# Local-Full Common-Arm Projection",
    "",
    `- Source: ${report.projection.sourceFileName}`,
    `- Source strategy count: ${report.projection.sourceStrategyCount}`,
    `- Projected strategy count: ${report.projection.projectedStrategyCount}`,
    `- Dropped strategies count as evidence: ${report.projection.droppedStrategiesCountAsEvidence}`,
    `- Shard: ${shard.startIndex}-${shard.endIndexExclusive} of ${shard.totalQueryCount}`,
    `- Winner: ${report.winner?.strategy ?? "none"}`,
    `- Answer quality: ${report.winner?.answerQuality ?? "n/a"}`,
    `- Counts as local-full benchmark evidence: ${report.projection.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${report.projection.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${report.projection.publicBenchmarkClaimsAllowed}`,
    "",
    "## Required Strategies",
    ...report.projection.requiredStrategies.map((strategy) => `- ${strategy}`),
    "",
    "## Dropped Diagnostic Strategies",
    ...(report.projection.droppedStrategies.length ? report.projection.droppedStrategies.map((strategy) => `- ${strategy}`) : ["- none"]),
  ].join("\n");
}

function loadRequiredJson(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return {
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json: JSON.parse(raw),
  };
}

function bestBy(items, score) {
  return [...items].sort((left, right) => score(right) - score(left))[0] ?? null;
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function resolveInputPath(path) {
  const value = String(path);
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(path) {
  return relative(root, path) || ".";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-like secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, privateTagPattern, `${label} contains private-tagged text`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
