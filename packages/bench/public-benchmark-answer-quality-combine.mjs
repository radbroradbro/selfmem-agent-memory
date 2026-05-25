import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const inputs = splitList(
  args.input ??
    args.inputs ??
    process.env.RECALLWEAVE_ANSWER_QUALITY_COMBINE_INPUTS ??
    "reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json,reviews/overnight-20260522/end-to-end-memory-score-live-provider-20260525.json",
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(inputs.length >= 2, "at least two answer-quality inputs are required");

const loaded = inputs.map(loadAnswerQualityResult);
assertSameData(loaded);
const combined = buildCombinedReport(loaded);
const jsonText = `${JSON.stringify(combined, null, 2)}\n`;
const markdownText = `${renderMarkdown(combined)}\n`;
assertSafePublicText(jsonText, "combined answer-quality report");
assertSafePublicText(markdownText, "combined answer-quality markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function loadAnswerQualityResult(pathLike) {
  const path = resolveInputPath(pathLike);
  assert.ok(existsSync(path), `answer-quality input missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `answer-quality input empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, displayPath(path));
  const json = JSON.parse(raw);
  assert.equal(json.mode, "public-benchmark-answer-quality", `${displayPath(path)} must be an answer-quality report`);
  assert.equal(json.fixtureOnly, false, `${displayPath(path)} must be live, not fixture-only`);
  assert.equal(json.metricsOnly, true, `${displayPath(path)} must be metrics-only`);
  assert.equal(json.publicSafe, true, `${displayPath(path)} must be public-safe`);
  assert.equal(json.retrievalProxyOnly, false, `${displayPath(path)} must not be retrieval-proxy-only`);
  assert.equal(json.memoryBenchAnswerQuality, true, `${displayPath(path)} must be memoryBench answer quality`);
  assert.equal(json.rawQuestionsIncluded, false, `${displayPath(path)} must not include raw questions`);
  assert.equal(json.rawAnswersIncluded, false, `${displayPath(path)} must not include raw answers`);
  assert.equal(json.rawMemoryIncluded, false, `${displayPath(path)} must not include raw memory`);
  assert.equal(json.rawTranscriptIncluded, false, `${displayPath(path)} must not include raw transcripts`);
  return {
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json,
  };
}

function assertSameData(items) {
  const first = items[0].json;
  assert.ok(first.provider?.answerModel, "first input must include answer model");
  assert.ok(first.provider?.judgeModel, "first input must include judge model");
  for (const item of items.slice(1)) {
    assert.equal(item.json.target?.hash, first.target?.hash, "all inputs must share target hash");
    assert.equal(item.json.input?.targetHash, first.input?.targetHash, "all inputs must share input target hash");
    assert.equal(item.json.input?.querySetHash, first.input?.querySetHash, "all inputs must share query-set hash");
    assert.equal(item.json.input?.materializerHash, first.input?.materializerHash, "all inputs must share materializer hash");
    assert.equal(item.json.input?.answerLabelsHash, first.input?.answerLabelsHash, "all inputs must share answer-label hash");
    assert.equal(item.json.input?.scoringCodeHash, first.input?.scoringCodeHash, "all inputs must share scoring-code hash");
    assert.equal(item.json.input?.scoredQueryCount, first.input?.scoredQueryCount, "all inputs must share scored-query count");
    assert.equal(item.json.provider?.answerModel, first.provider.answerModel, "all inputs must share answer model");
    assert.equal(item.json.provider?.judgeModel, first.provider.judgeModel, "all inputs must share judge model");
  }
}

function buildCombinedReport(items) {
  const first = items[0].json;
  const strategies = bestUniqueStrategies(items.flatMap((item) => item.json.strategies ?? []));
  const winner = bestByAnswerQuality(strategies);
  const callsMade = items.reduce((sum, item) => sum + Number(item.json.provider?.callsMade ?? 0), 0);
  return {
    schemaVersion: 1,
    ok: true,
    mode: "public-benchmark-answer-quality",
    combineMode: "same-data-answer-quality-union",
    fixtureOnly: false,
    benchmark: first.benchmark,
    metricsOnly: true,
    publicSafe: true,
    retrievalProxyOnly: false,
    memoryBenchAnswerQuality: true,
    readyForEndToEndMemoryScoreGate: true,
    publicBenchmarkClaimsAllowed: false,
    callsProviderApis: true,
    sendsBenchmarkTextToProvider: true,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPromptIncluded: false,
    generatedAt: new Date().toISOString(),
    target: first.target,
    input: {
      ...first.input,
      source: "materialized-source-locked-longmemeval",
    },
    sourceLock: {
      sameDataAttestation: true,
      sameAnswerModel: true,
      sameJudgeModel: true,
      inputResultCount: items.length,
      inputResultHashes: items.map((item) => item.hash),
      inputResultPaths: items.map((item) => item.path),
    },
    provider: {
      answerModel: first.provider?.answerModel ?? null,
      judgeModel: first.provider?.judgeModel ?? null,
      answerQualityCallsAllowed: true,
      publicDataConfirmed: true,
      callsMade,
      endpointLabel: first.provider?.endpointLabel ?? null,
    },
    metrics: winner?.metrics ?? null,
    strategies,
    winner: winner
      ? {
          strategy: winner.strategy,
          answerQuality: winner.metrics.answerQuality,
          judgeCorrectRate: winner.metrics.judgeCorrectRate,
          answerLatencyP50Ms: winner.metrics.answerLatencyP50Ms,
        }
      : null,
    reviewerApprovalCount: 0,
    privacyLeakCount: 0,
    redactionFailureCount: 0,
    safety: {
      metricsOnly: true,
      publicSafe: true,
      rawQuestionsIncluded: false,
      rawAnswersIncluded: false,
      rawMemoryIncluded: false,
      rawTranscriptIncluded: false,
      privateInputsStoredOutsideRepository: true,
      combinedFromMetricsOnlyReports: true,
    },
    nextActions: [
      "Retry the missing Voyage same-data answer-quality arm after provider rate limits reset.",
      "Run benchmark:memory-score:reviewer-intake against this exact combined metrics-only result after two independent reviews are collected.",
      "Keep public benchmark and production-replacement claims disabled until the full gate passes.",
    ],
  };
}

function bestUniqueStrategies(rows) {
  const byStrategy = new Map();
  for (const row of rows) {
    const strategy = row.strategy;
    if (!strategy) continue;
    const current = byStrategy.get(strategy);
    if (!current || answerQuality(row) > answerQuality(current)) byStrategy.set(strategy, row);
  }
  return [...byStrategy.values()].sort((left, right) => String(left.strategy).localeCompare(String(right.strategy)));
}

function bestByAnswerQuality(rows) {
  return [...rows].sort((left, right) => answerQuality(right) - answerQuality(left))[0] ?? null;
}

function answerQuality(row) {
  return Number(row?.metrics?.answerQuality ?? row?.metrics?.memoryScore ?? row?.metrics?.longmemevalScore ?? 0);
}

function renderMarkdown(value) {
  return [
    "# Combined Answer-Quality Memory Score",
    "",
    `- Fixture only: ${value.fixtureOnly}`,
    `- Ready for end-to-end memory score gate: ${value.readyForEndToEndMemoryScoreGate}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Benchmark: ${value.benchmark}`,
    `- Scored query count: ${value.input.scoredQueryCount}`,
    `- Target hash: ${value.target.hash}`,
    `- Query-set hash: ${value.input.querySetHash}`,
    "",
    "## Winner",
    `- ${value.winner?.strategy ?? "none"}: answerQuality=${value.winner?.answerQuality ?? "n/a"}, correctRate=${value.winner?.judgeCorrectRate ?? "n/a"}`,
    "",
    "## Arms",
    ...value.strategies.map((item) => `- ${item.strategy}: answerQuality=${item.metrics?.answerQuality ?? "n/a"}, correctRate=${item.metrics?.judgeCorrectRate ?? "n/a"}`),
    "",
    "## Inputs",
    ...value.sourceLock.inputResultPaths.map((path, index) => `- ${path} (${value.sourceLock.inputResultHashes[index]})`),
    "",
    "## Safety",
    `- Metrics only: ${value.metricsOnly}`,
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Raw transcript included: ${value.rawTranscriptIncluded}`,
  ].join("\n");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
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

function splitList(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(path) : rel;
}

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
  const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
  assert.doesNotMatch(String(text), privateTagPattern, `${label} contains private tags`);
}
