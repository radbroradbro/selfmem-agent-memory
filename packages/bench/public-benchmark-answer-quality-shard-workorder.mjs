import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const planPath = resolveInputPath(args.plan ?? "reviews/overnight-20260522/answer-quality-full-shard-plan-20260525.json");
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const maxWorkorders = positiveInt(args.maxWorkorders ?? args.max ?? Number.MAX_SAFE_INTEGER, "max workorders");
const inputs = inputPaths();

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(planPath), `shard plan missing: ${displayPath(planPath)}`);
assert.ok(statSync(planPath).size > 0, `shard plan empty: ${displayPath(planPath)}`);
const planRaw = readFileSync(planPath, "utf8");
assertSafePublicText(planRaw, "shard plan");
const plan = JSON.parse(planRaw);
assert.equal(plan.mode, "public-benchmark-answer-quality-shard-plan", "plan must be a full answer-quality shard plan");

const loaded = inputs.map(loadCandidateResult);
const evaluated = evaluateExistingShardResults({ plan, loaded });
const pendingShards = (plan.shards ?? []).filter((shard) => !evaluated.acceptedByShardId.has(shard.id));
const selectedPendingShards = pendingShards.slice(0, maxWorkorders);
const allExpectedPublicInputs = (plan.shards ?? []).map((shard) => `<public-review-dir>/answer-quality-${shard.id}.json`);
const readyForShardIntake = pendingShards.length === 0 && evaluated.rejectedResults.length === 0 && evaluated.duplicateResults.length === 0;

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "public-benchmark-answer-quality-shard-workorder",
  status: readyForShardIntake ? "READY_TO_RUN_FULL_ANSWER_QUALITY_SHARD_INTAKE" : "PENDING_FULL_ANSWER_QUALITY_SHARD_RUNS",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  readyForShardIntake,
  readyForShardCombine: false,
  readyForEndToEndMemoryScoreGate: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  generatedAt: new Date().toISOString(),
  plan: {
    path: displayPath(planPath),
    hash: `sha256:${sha256(planRaw)}`,
    targetHash: plan.target?.hash ?? null,
    queryCount: plan.runPlan?.queryCount ?? null,
    shardSize: plan.runPlan?.shardSize ?? null,
    shardCount: plan.runPlan?.shardCount ?? null,
    strategies: plan.runPlan?.strategies ?? [],
  },
  progress: {
    inputCount: inputs.length,
    acceptedShardCount: evaluated.acceptedResults.length,
    pendingShardCount: pendingShards.length,
    rejectedResultCount: evaluated.rejectedResults.length,
    duplicateResultCount: evaluated.duplicateResults.length,
    workorderCount: selectedPendingShards.length,
  },
  acceptedShards: evaluated.acceptedResults,
  pendingShards: pendingShards.map(publicShardRow),
  rejectedResults: evaluated.rejectedResults,
  duplicateResults: evaluated.duplicateResults,
  workorders: selectedPendingShards.map((shard) => buildWorkorder(plan, shard)),
  gatedCommands: {
    shardIntake: [
      "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:shard-intake",
      `--input ${allExpectedPublicInputs.join(",")}`,
      "--output <public-review-dir>/answer-quality-full-shard-intake.json",
      "--markdown-output <public-review-dir>/answer-quality-full-shard-intake.md",
      "--require-ready",
    ].join(" "),
    combineAfterIntakePasses: plan.runPlan?.combineCommand ?? null,
    resultGateAfterCombine: plan.runPlan?.resultGateCommand ?? null,
    reviewerIntakeAfterCombine: plan.runPlan?.reviewerIntakeCommand ?? null,
  },
  blockers: [
    pendingShards.length > 0 ? "answer-quality-shard-runs-pending" : null,
    evaluated.rejectedResults.length > 0 ? "answer-quality-shard-results-rejected" : null,
    evaluated.duplicateResults.length > 0 ? "answer-quality-shard-results-duplicated" : null,
  ].filter(Boolean),
  nextActions: readyForShardIntake
    ? [
        "Run benchmark:answer-quality:shard-intake with --require-ready against the accepted public shard-result JSONs.",
        "Run benchmark:answer-quality:combine only after shard intake reports READY_TO_COMBINE_FULL_ANSWER_QUALITY_SHARDS.",
        "Keep SOTA, public benchmark, and production-replacement claims blocked until result gate, reviewer intake, UI/docs, owner approval, and real canary all pass.",
      ]
    : [
        "Run the listed response-arm export and answer-quality commands for the pending shards.",
        "Re-run this workorder with the returned public shard-result JSONs to track progress.",
        "Do not run combine until benchmark:answer-quality:shard-intake passes with complete coverage.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "shard workorder report");
assertSafePublicText(markdownText, "shard workorder markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inputPaths() {
  const explicit = normalizeList([args.input, args.inputs].flatMap(coerceArray));
  const directory = args.directory ?? args.dir ?? null;
  if (!directory) return explicit;
  const dir = resolveInputPath(directory);
  assert.ok(existsSync(dir), `shard result directory missing: ${displayPath(dir)}`);
  const discovered = readdirSync(dir)
    .filter((name) => /^answer-quality-shard-\d{3}\.json$/u.test(name))
    .map((name) => join(dir, name));
  return [...explicit, ...discovered].sort();
}

function loadCandidateResult(pathLike) {
  const path = resolveInputPath(pathLike);
  assert.ok(existsSync(path), `shard result missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `shard result empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, displayPath(path));
  return {
    fileName: basename(path),
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json: JSON.parse(raw),
  };
}

function evaluateExistingShardResults({ plan: planValue, loaded: loadedItems }) {
  const expected = new Map((planValue.shards ?? []).map((shard) => [rangeKey(shard), shard]));
  const acceptedByShardId = new Map();
  const acceptedResults = [];
  const rejectedResults = [];
  const duplicateResults = [];
  const seenRanges = new Set();
  for (const item of loadedItems) {
    const range = shardRange(item.json);
    const key = range ? rangeKey(range) : null;
    const expectedShard = key ? expected.get(key) : null;
    const failures = candidateFailures({ item, range, expectedShard, planValue });
    if (key && seenRanges.has(key)) {
      duplicateResults.push({ range: key, fileName: item.fileName, hash: item.hash });
      failures.push("duplicate-shard-range");
    }
    if (key) seenRanges.add(key);
    const row = {
      shardId: expectedShard?.id ?? null,
      range: key,
      startIndex: range?.startIndex ?? null,
      endIndexExclusive: range?.endIndexExclusive ?? null,
      scoredQueryCount: range?.scoredQueryCount ?? null,
      fileName: item.fileName,
      hash: item.hash,
    };
    if (failures.length) rejectedResults.push({ ...row, failures });
    else {
      acceptedResults.push(row);
      acceptedByShardId.set(expectedShard.id, row);
    }
  }
  acceptedResults.sort((left, right) => left.startIndex - right.startIndex);
  return { acceptedByShardId, acceptedResults, rejectedResults, duplicateResults };
}

function candidateFailures({ item, range, expectedShard, planValue }) {
  return [
    item.json.mode !== "public-benchmark-answer-quality" ? "not-answer-quality-report" : null,
    item.json.fixtureOnly !== false ? "fixture-result" : null,
    item.json.metricsOnly !== true ? "not-metrics-only" : null,
    item.json.publicSafe !== true ? "not-public-safe" : null,
    item.json.retrievalProxyOnly !== false ? "retrieval-proxy-only" : null,
    item.json.memoryBenchAnswerQuality !== true ? "memorybench-answer-quality-not-proven" : null,
    item.json.publicBenchmarkClaimsAllowed !== false ? "public-claims-enabled" : null,
    item.json.rawQuestionsIncluded !== false ? "raw-questions-included" : null,
    item.json.rawAnswersIncluded !== false ? "raw-answers-included" : null,
    item.json.rawMemoryIncluded !== false ? "raw-memory-included" : null,
    item.json.rawTranscriptIncluded !== false ? "raw-transcript-included" : null,
    item.json.target?.hash !== planValue.target?.hash ? "target-hash-mismatch" : null,
    item.json.input?.targetHash !== planValue.target?.hash ? "input-target-hash-mismatch" : null,
    item.json.input?.answerLabelsHash !== planValue.target?.answerLabelsHash ? "answer-labels-hash-mismatch" : null,
    item.json.input?.scoringCodeHash !== planValue.target?.scoringCodeHash ? "scoring-code-hash-mismatch" : null,
    item.json.input?.querySetHash !== planValue.materializeReport?.collectorCompatibleQuerySetHash ? "query-set-hash-mismatch" : null,
    item.json.input?.materializerHash !== planValue.materializeReport?.materializerHash ? "materializer-hash-mismatch" : null,
    Number(item.json.input?.totalQueryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "total-query-count-mismatch" : null,
    Number(item.json.input?.queryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "input-query-count-mismatch" : null,
    item.json.provider?.answerModel !== planValue.target?.answerModel ? "answer-model-mismatch" : null,
    item.json.provider?.judgeModel !== planValue.target?.judgeModel ? "judge-model-mismatch" : null,
    Number(item.json.privacyLeakCount ?? 0) !== 0 ? "privacy-leak-count-nonzero" : null,
    Number(item.json.redactionFailureCount ?? 0) !== 0 ? "redaction-failure-count-nonzero" : null,
    !range ? "query-shard-range-missing" : null,
    range && !expectedShard ? "query-shard-range-not-in-plan" : null,
    range && Number(range.totalQueryCount) !== Number(planValue.runPlan?.queryCount ?? 0) ? "range-total-query-count-mismatch" : null,
    range && expectedShard && range.scoredQueryCount !== expectedShard.queryCount ? "scored-query-count-mismatch" : null,
    range && range.scoredQueryCount !== range.endIndexExclusive - range.startIndex ? "range-count-mismatch" : null,
    expectedShard && item.json.input?.queryShard?.selectedQueryIdHash !== expectedShard.rangeHash ? "shard-range-hash-mismatch" : null,
    strategyNamesHash(item.json) !== planStrategyHash(planValue) ? "strategy-set-mismatch" : null,
  ].filter(Boolean);
}

function buildWorkorder(planValue, shard) {
  return {
    shardId: shard.id,
    startIndex: shard.startIndex,
    endIndexExclusive: shard.endIndexExclusive,
    queryCount: shard.queryCount,
    expectedPublicResult: `<public-review-dir>/answer-quality-${shard.id}.json`,
    expectedPublicMarkdown: `<public-review-dir>/answer-quality-${shard.id}.md`,
    expectedPrivateArmDirectory: `<private-output-dir>/arms/${shard.id}`,
    commands: {
      responseArmExport: replaceShardTokens(planValue.runPlan?.responseArmExportTemplate ?? "", shard),
      answerQuality: replaceShardTokens(planValue.runPlan?.answerQualityTemplate ?? "", shard),
    },
  };
}

function replaceShardTokens(template, shard) {
  return String(template)
    .replaceAll("{shardId}", shard.id)
    .replaceAll("{startIndex}", String(shard.startIndex))
    .replaceAll("{queryCount}", String(shard.queryCount));
}

function publicShardRow(shard) {
  return {
    shardId: shard.id,
    startIndex: shard.startIndex,
    endIndexExclusive: shard.endIndexExclusive,
    queryCount: shard.queryCount,
    rangeHash: shard.rangeHash,
  };
}

function shardRange(result) {
  const shard = result.input?.queryShard ?? {};
  const startIndex = intOrNull(result.input?.scoredQueryStart ?? shard.startIndex ?? result.input?.queryOffset);
  const endIndexExclusive = intOrNull(result.input?.scoredQueryEndExclusive ?? shard.endIndexExclusive);
  const totalQueryCount = intOrNull(result.input?.totalQueryCount ?? shard.totalQueryCount ?? result.input?.queryCount);
  const scoredQueryCount = intOrNull(result.input?.scoredQueryCount ?? shard.scoredQueryCount);
  if ([startIndex, endIndexExclusive, totalQueryCount, scoredQueryCount].some((value) => value == null)) return null;
  return { startIndex, endIndexExclusive, totalQueryCount, scoredQueryCount };
}

function strategyNamesHash(result) {
  return `sha256:${sha256(JSON.stringify((result.strategies ?? []).map((item) => item.strategy).filter(Boolean).sort()))}`;
}

function planStrategyHash(planValue) {
  return `sha256:${sha256(JSON.stringify([...(planValue.runPlan?.strategies ?? [])].sort()))}`;
}

function rangeKey(value) {
  return `${value.startIndex}-${value.endIndexExclusive}`;
}

function renderMarkdown(value) {
  return [
    "# Full Answer-Quality Shard Workorder",
    "",
    `- Status: ${value.status}`,
    `- Ready for shard intake: ${value.readyForShardIntake}`,
    `- Ready for shard combine: ${value.readyForShardCombine}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Accepted shards: ${value.progress.acceptedShardCount}`,
    `- Pending shards: ${value.progress.pendingShardCount}`,
    `- Rejected results: ${value.progress.rejectedResultCount}`,
    `- Workorders emitted: ${value.progress.workorderCount}`,
    "",
    "## Workorders",
    ...(value.workorders.length
      ? value.workorders.map((item) => `- ${item.shardId}: ${item.startIndex}-${item.endIndexExclusive}`)
      : ["- none"]),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Gated Commands",
    `- Intake: ${value.gatedCommands.shardIntake}`,
    `- Combine after intake passes: ${value.gatedCommands.combineAfterIntakePasses ?? "none"}`,
    `- Result gate after combine: ${value.gatedCommands.resultGateAfterCombine ?? "none"}`,
    `- Reviewer intake after combine: ${value.gatedCommands.reviewerIntakeAfterCombine ?? "none"}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function assertSafePublicText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privatePathPattern, `${label} contains a private local path`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
  assertNoPattern(text, /\b(q|answer|content|memory|text|raw|prompt)"\s*:/, `${label} contains raw text-like fields`);
}

function assertNoPattern(text, pattern, message) {
  pattern.lastIndex = 0;
  if (pattern.test(String(text))) throw new Error(message);
}

function normalizeList(values) {
  return values
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function coerceArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function intOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
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
    const value = !next || next.startsWith("--") ? true : next;
    if (parsed[key] == null) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
    if (value !== true) index += 1;
  }
  return parsed;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value ?? "") : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
