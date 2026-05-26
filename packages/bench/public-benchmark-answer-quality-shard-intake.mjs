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
const requireReady = Boolean(args.requireReady);
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
assert.equal(plan.mode, "public-benchmark-answer-quality-shard-plan", "plan must be a shard plan");

const loaded = inputs.map(loadShardResult);
const evaluated = evaluateShards({ plan, loaded });
const ready = evaluated.blockers.length === 0;
const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "public-benchmark-answer-quality-shard-intake",
  status: ready ? "READY_TO_COMBINE_FULL_ANSWER_QUALITY_SHARDS" : "BLOCKED_FULL_ANSWER_QUALITY_SHARDS",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  readyForShardCombine: ready,
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
    querySetHash: plan.materializeReport?.collectorCompatibleQuerySetHash ?? null,
    materializerHash: plan.materializeReport?.materializerHash ?? null,
    queryCount: plan.runPlan?.queryCount ?? null,
    shardSize: plan.runPlan?.shardSize ?? null,
    shardCount: plan.runPlan?.shardCount ?? null,
    strategies: plan.runPlan?.strategies ?? [],
  },
  intake: {
    inputCount: inputs.length,
    shardResultsPresent: loaded.length,
    acceptedShardCount: evaluated.acceptedShards.length,
    missingShardCount: evaluated.missingShards.length,
    duplicateShardCount: evaluated.duplicateShards.length,
    rejectedShardCount: evaluated.rejectedShards.length,
    completeCoverage: evaluated.completeCoverage,
    sameTarget: evaluated.sameTarget,
    sameSourceLock: evaluated.sameSourceLock,
    sameModels: evaluated.sameModels,
    sameStrategySet: evaluated.sameStrategySet,
  },
  acceptedShards: evaluated.acceptedShards,
  missingShards: evaluated.missingShards,
  duplicateShards: evaluated.duplicateShards,
  rejectedShards: evaluated.rejectedShards,
  blockers: evaluated.blockers,
  combineCommand: combineCommand(evaluated.acceptedShards),
  nextActions: ready
    ? [
        "Run benchmark:answer-quality:combine with the accepted shard result list.",
        "Run benchmark:memory-score:result-gate on the combined metrics-only packet with reviewer approval intake attached.",
        "Keep public benchmark and production-replacement claims blocked until the full gate, UI evidence, docs, owner approval, and real canary all pass.",
      ]
    : [
        "Run the missing shard answer-quality jobs from the checked-in shard plan.",
        "Re-run this intake with all shard outputs before combining.",
        "Do not hand-build a combine input list unless this intake reports complete coverage.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "shard intake report");
assertSafePublicText(markdownText, "shard intake markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function inputPaths() {
  const explicit = normalizeList([args.input, args.inputs].flatMap(coerceArray));
  const directory = args.directory ?? args.dir ?? null;
  if (!directory) return explicit;
  const dir = resolveInputPath(directory);
  assert.ok(existsSync(dir), `shard result directory missing: ${displayPath(dir)}`);
  const discovered = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(dir, name));
  return [...explicit, ...discovered].sort();
}

function loadShardResult(pathLike) {
  const path = resolveInputPath(pathLike);
  assert.ok(existsSync(path), `shard result missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `shard result empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, displayPath(path));
  const json = JSON.parse(raw);
  return {
    path: displayPath(path),
    fileName: basename(path),
    hash: `sha256:${sha256(raw)}`,
    json,
  };
}

function evaluateShards({ plan: planValue, loaded: loadedItems }) {
  const expected = new Map((planValue.shards ?? []).map((shard) => [rangeKey(shard), shard]));
  const strategySetHash = `sha256:${sha256(JSON.stringify([...(planValue.runPlan?.strategies ?? [])].sort()))}`;
  const accepted = [];
  const rejected = [];
  const seen = new Set();
  const duplicateShards = [];
  let sameTarget = true;
  let sameSourceLock = true;
  let sameModels = true;
  let sameStrategySet = true;

  for (const item of loadedItems) {
    const result = item.json;
    const range = shardRange(result);
    const key = range ? rangeKey(range) : null;
    const failures = shardFailures({ item, result, range, expected, planValue, strategySetHash });
    if (key && seen.has(key)) {
      duplicateShards.push({ range: key, fileName: item.fileName, hash: item.hash });
      failures.push("duplicate-shard-range");
    }
    if (key) seen.add(key);
    if (result.target?.hash !== planValue.target?.hash) sameTarget = false;
    if (
      result.input?.querySetHash !== planValue.materializeReport?.collectorCompatibleQuerySetHash ||
      result.input?.materializerHash !== planValue.materializeReport?.materializerHash ||
      Number(result.input?.totalQueryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ||
      Number(result.input?.queryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0)
    ) {
      sameSourceLock = false;
    }
    if (result.provider?.answerModel !== planValue.target?.answerModel || result.provider?.judgeModel !== planValue.target?.judgeModel) sameModels = false;
    if (strategyNamesHash(result) !== strategySetHash) sameStrategySet = false;
    const row = {
      shardId: expected.get(key)?.id ?? null,
      range: key,
      startIndex: range?.startIndex ?? null,
      endIndexExclusive: range?.endIndexExclusive ?? null,
      scoredQueryCount: range?.scoredQueryCount ?? null,
      fileName: item.fileName,
      hash: item.hash,
    };
    if (failures.length) rejected.push({ ...row, failures });
    else accepted.push(row);
  }

  const acceptedRanges = new Set(accepted.map((item) => item.range));
  const missing = [...expected.entries()]
    .filter(([key]) => !acceptedRanges.has(key))
    .map(([, shard]) => ({
      shardId: shard.id,
      startIndex: shard.startIndex,
      endIndexExclusive: shard.endIndexExclusive,
      queryCount: shard.queryCount,
      rangeHash: shard.rangeHash,
    }));
  const sortedAccepted = [...accepted].sort((left, right) => left.startIndex - right.startIndex);
  const completeCoverage =
    missing.length === 0 &&
    rejected.length === 0 &&
    sortedAccepted.length === expected.size &&
    sortedAccepted[0]?.startIndex === 0 &&
    sortedAccepted.at(-1)?.endIndexExclusive === Number(planValue.runPlan?.queryCount ?? 0);
  const blockers = [
    loadedItems.length === 0 ? "shard-results-missing" : null,
    missing.length > 0 ? "answer-quality-shards-missing" : null,
    duplicateShards.length > 0 ? "duplicate-shard-ranges" : null,
    rejected.length > 0 ? "answer-quality-shards-rejected" : null,
    !sameTarget ? "shard-target-hash-mismatch" : null,
    !sameSourceLock ? "shard-source-lock-mismatch" : null,
    !sameModels ? "shard-answer-or-judge-model-mismatch" : null,
    !sameStrategySet ? "shard-strategy-set-mismatch" : null,
    !completeCoverage ? "full-shard-coverage-incomplete" : null,
  ].filter(Boolean);

  return {
    acceptedShards: sortedAccepted,
    missingShards: missing,
    duplicateShards,
    rejectedShards: rejected,
    completeCoverage,
    sameTarget,
    sameSourceLock,
    sameModels,
    sameStrategySet,
    blockers,
  };
}

function shardFailures({ item, result, range, expected, planValue, strategySetHash }) {
  const failures = [
    result.mode !== "public-benchmark-answer-quality" ? "not-answer-quality-report" : null,
    result.fixtureOnly !== false ? "fixture-result" : null,
    result.metricsOnly !== true ? "not-metrics-only" : null,
    result.publicSafe !== true ? "not-public-safe" : null,
    result.retrievalProxyOnly !== false ? "retrieval-proxy-only" : null,
    result.memoryBenchAnswerQuality !== true ? "memorybench-answer-quality-not-proven" : null,
    result.rawQuestionsIncluded !== false ? "raw-questions-included" : null,
    result.rawAnswersIncluded !== false ? "raw-answers-included" : null,
    result.rawMemoryIncluded !== false ? "raw-memory-included" : null,
    result.rawTranscriptIncluded !== false ? "raw-transcript-included" : null,
    result.target?.hash !== planValue.target?.hash ? "target-hash-mismatch" : null,
    result.input?.targetHash !== planValue.target?.hash ? "input-target-hash-mismatch" : null,
    result.input?.answerLabelsHash !== planValue.target?.answerLabelsHash ? "answer-labels-hash-mismatch" : null,
    result.input?.scoringCodeHash !== planValue.target?.scoringCodeHash ? "scoring-code-hash-mismatch" : null,
    result.input?.querySetHash !== planValue.materializeReport?.collectorCompatibleQuerySetHash ? "query-set-hash-mismatch" : null,
    result.input?.materializerHash !== planValue.materializeReport?.materializerHash ? "materializer-hash-mismatch" : null,
    Number(result.input?.totalQueryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "total-query-count-mismatch" : null,
    Number(result.input?.queryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "input-query-count-mismatch" : null,
    result.provider?.answerModel !== planValue.target?.answerModel ? "answer-model-mismatch" : null,
    result.provider?.judgeModel !== planValue.target?.judgeModel ? "judge-model-mismatch" : null,
    Number(result.privacyLeakCount ?? 0) !== 0 ? "privacy-leak-count-nonzero" : null,
    Number(result.redactionFailureCount ?? 0) !== 0 ? "redaction-failure-count-nonzero" : null,
    !range ? "query-shard-range-missing" : null,
    range && !expected.has(rangeKey(range)) ? "query-shard-range-not-in-plan" : null,
    range && Number(range.totalQueryCount) !== Number(planValue.runPlan?.queryCount ?? 0) ? "range-total-query-count-mismatch" : null,
    range && range.scoredQueryCount !== range.endIndexExclusive - range.startIndex ? "scored-query-count-mismatch" : null,
    range && expected.has(rangeKey(range)) && range.selectedQueryIdHash !== expected.get(rangeKey(range))?.rangeHash
      ? "shard-range-hash-mismatch"
      : null,
    strategyNamesHash(result) !== strategySetHash ? "strategy-set-mismatch" : null,
    (result.strategies ?? []).some((row) => Number(row.privacyLeakCount ?? 0) !== 0 || Number(row.redactionFailureCount ?? 0) !== 0)
      ? "strategy-privacy-or-redaction-count-nonzero"
      : null,
  ].filter(Boolean);
  assert.doesNotMatch(JSON.stringify({ fileName: item.fileName, failures }), privatePathPattern);
  return failures;
}

function shardRange(result) {
  const shard = result.input?.queryShard ?? {};
  const startIndex = intOrNull(result.input?.scoredQueryStart ?? shard.startIndex ?? result.input?.queryOffset);
  const endIndexExclusive = intOrNull(result.input?.scoredQueryEndExclusive ?? shard.endIndexExclusive);
  const totalQueryCount = intOrNull(result.input?.totalQueryCount ?? shard.totalQueryCount ?? result.input?.queryCount);
  const scoredQueryCount = intOrNull(result.input?.scoredQueryCount ?? shard.scoredQueryCount);
  if ([startIndex, endIndexExclusive, totalQueryCount, scoredQueryCount].some((value) => value == null)) return null;
  return {
    startIndex,
    endIndexExclusive,
    totalQueryCount,
    scoredQueryCount,
    selectedQueryIdHash: shard.selectedQueryIdHash ?? null,
  };
}

function strategyNamesHash(result) {
  return `sha256:${sha256(JSON.stringify((result.strategies ?? []).map((item) => item.strategy).filter(Boolean).sort()))}`;
}

function strategyNames(result) {
  return (result.strategies ?? []).map((item) => item.strategy).filter(Boolean);
}

function rangeKey(value) {
  return `${value.startIndex}-${value.endIndexExclusive}`;
}

function combineCommand(accepted) {
  if (!accepted.length) return null;
  const inputsValue = accepted.map((item) => `<public-review-dir>/${item.fileName}`).join(",");
  const claimScope = String(plan.runPlan?.claimScope ?? "full-sota");
  const combinedName = claimScope === "full-sota" ? "end-to-end-memory-score-full-combined" : `end-to-end-memory-score-${claimScope}-combined`;
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:combine --",
    `--input ${inputsValue}`,
    "--combine-mode shards",
    `--output <public-review-dir>/${combinedName}.json`,
    `--markdown-output <public-review-dir>/${combinedName}.md`,
  ].join(" ");
}

function renderMarkdown(value) {
  return [
    "# Full Answer-Quality Shard Intake",
    "",
    `- Status: ${value.status}`,
    `- Ready for shard combine: ${value.readyForShardCombine}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Plan shard count: ${value.plan.shardCount}`,
    `- Accepted shards: ${value.intake.acceptedShardCount}`,
    `- Missing shards: ${value.intake.missingShardCount}`,
    `- Rejected shards: ${value.intake.rejectedShardCount}`,
    `- Complete coverage: ${value.intake.completeCoverage}`,
    "",
    "## Accepted Shards",
    ...(value.acceptedShards.length
      ? value.acceptedShards.map((item) => `- ${item.shardId}: ${item.startIndex}-${item.endIndexExclusive} (${item.fileName})`)
      : ["- none"]),
    "",
    "## Missing Shards",
    ...(value.missingShards.length ? value.missingShards.map((item) => `- ${item.shardId}: ${item.startIndex}-${item.endIndexExclusive}`) : ["- none"]),
    "",
    "## Rejected Shards",
    ...(value.rejectedShards.length ? value.rejectedShards.map((item) => `- ${item.fileName}: ${item.failures.join(", ")}`) : ["- none"]),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
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
