import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const shardResultPath = resolveInputPath(
  args.shardResult ?? `${reviewDir}/answer-quality-local-full-shard-005-20260527.json`,
);
const armExportPath = resolveInputPath(
  args.armExport ?? `${reviewDir}/answer-quality-local-full-shard-005-arm-export-20260527.json`,
);
const legacyPlanPath = resolveInputPath(
  args.legacyPlan ?? `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`,
);
const wikiPlanPath = resolveInputPath(
  args.wikiPlan ?? `${reviewDir}/answer-quality-local-wiki-shard-plan-20260527.json`,
);
const performancePath = resolveInputPath(
  args.performance ??
    preferReviewFile(
      "local-full-shard-performance-report-after-shard-016-20260529.json",
      "local-full-shard-performance-report-after-shard-015-20260529.json",
      "local-full-shard-performance-report-after-shard-014-20260528.json",
      "local-full-shard-performance-report-after-shard-013-20260528.json",
      "local-full-shard-performance-report-after-shard-012-20260528.json",
      "local-full-shard-performance-report-after-shard-011-20260528.json",
      "local-full-shard-performance-report-after-shard-010-20260528.json",
      "local-full-shard-performance-report-after-shard-009-common-arm-20260528.json",
      "local-full-shard-performance-report-after-shard-009-20260528.json",
      "local-full-shard-performance-report-20260527.json",
    ),
);
const commonShardPaths = coercePathList(
  args.commonShardResults ??
    [
      `${reviewDir}/answer-quality-local-full-shard-001-20260526.json`,
      `${reviewDir}/answer-quality-local-full-shard-002-recovery-20260526.json`,
      `${reviewDir}/answer-quality-local-full-shard-003-20260527.json`,
      `${reviewDir}/answer-quality-local-full-shard-004-20260527.json`,
      `${reviewDir}/answer-quality-local-full-shard-005-common-arm-projection-20260527.json`,
      `${reviewDir}/answer-quality-local-full-shard-006-20260527.json`,
      `${reviewDir}/answer-quality-local-full-shard-007-20260527.json`,
      `${reviewDir}/answer-quality-local-full-shard-008-20260527.json`,
      `${reviewDir}/answer-quality-local-full-shard-009-20260528.json`,
      `${reviewDir}/answer-quality-local-full-shard-010-20260528.json`,
      `${reviewDir}/answer-quality-local-full-shard-011-20260528.json`,
      `${reviewDir}/answer-quality-local-full-shard-012-20260528.json`,
      `${reviewDir}/answer-quality-local-full-shard-013-20260528.json`,
      `${reviewDir}/answer-quality-local-full-shard-014-20260528.json`,
      `${reviewDir}/answer-quality-local-full-shard-015-20260529.json`,
      `${reviewDir}/answer-quality-local-full-shard-016-20260529.json`,
    ].join(","),
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const shardState = loadRequiredJson(shardResultPath, "wiki method shard result");
const armExportState = loadOptionalJson(armExportPath, "wiki method arm export");
const legacyPlanState = loadOptionalJson(legacyPlanPath, "legacy local-full shard plan");
const wikiPlanState = loadOptionalJson(wikiPlanPath, "local wiki shard plan");
const performanceState = loadOptionalJson(performancePath, "local-full performance report");
const commonShardStates = commonShardPaths.map((path) => loadOptionalJson(resolveInputPath(path), "common arm shard result"));
const shard = shardState.json;
const armExport = armExportState.json;
const legacyPlan = legacyPlanState.json;
const wikiPlan = wikiPlanState.json;
const performance = performanceState.json;

assert.equal(shard.mode, "public-benchmark-answer-quality", "shard result must be an answer-quality report");
assert.equal(shard.publicSafe, true, "shard result must be public safe");
assert.equal(shard.metricsOnly, true, "shard result must be metrics only");

const strategies = Object.fromEntries(arrayOf(shard.strategies).map((item) => [item.strategy, strategyScore(item)]));
const bm25 = strategies["bm25-lite"] ?? null;
const best = bestBy(Object.values(strategies), (item) => Number(item.answerQuality ?? 0));
const legacyStrategies = arrayOf(legacyPlan?.runPlan?.strategies);
const wikiStrategies = arrayOf(wikiPlan?.runPlan?.strategies);
const shardStrategies = Object.keys(strategies);
const oldIntakeCompatible =
  legacyStrategies.length > 0 &&
  legacyStrategies.length === shardStrategies.length &&
  stableList(legacyStrategies).join("\n") === stableList(shardStrategies).join("\n");

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-wiki-method-report",
  status: "WIKI_METHOD_SHARD_EVALUATED",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  callsLocalEndpoint: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsPrivatePaths: false,
  countsAsLocalFullBenchmarkEvidence: true,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  sourceEvidence: {
    shardResult: evidenceRef(shardState),
    armExport: armExportState.present ? evidenceRef(armExportState) : null,
    legacyPlan: legacyPlanState.present ? evidenceRef(legacyPlanState) : null,
    wikiPlan: wikiPlanState.present ? evidenceRef(wikiPlanState) : null,
    priorPerformance: performanceState.present ? evidenceRef(performanceState) : null,
    commonShardResults: commonShardStates.filter((state) => state.present).map(evidenceRef),
  },
  shard: {
    startIndex: shard.input?.scoredQueryStart ?? shard.input?.queryShard?.startIndex ?? null,
    endIndexExclusive: shard.input?.scoredQueryEndExclusive ?? shard.input?.queryShard?.endIndexExclusive ?? null,
    scoredQueryCount: shard.input?.scoredQueryCount ?? null,
    totalQueryCount: shard.input?.totalQueryCount ?? null,
    querySetHash: shard.input?.querySetHash ?? null,
    selectedQueryIdHash: shard.input?.queryShard?.selectedQueryIdHash ?? null,
  },
  provider: {
    answerModel: shard.provider?.answerModel ?? null,
    judgeModel: shard.provider?.judgeModel ?? null,
    endpointIsLocal: shard.provider?.endpointIsLocal === true,
    localDiagnosticScoring: shard.scoringPolicy?.localDiagnosticModelAllowed === true,
    disableJsonResponseFormat: shard.provider?.disableJsonResponseFormat === true,
    callsMade: Number(shard.provider?.callsMade ?? 0),
  },
  methodIsolation: {
    hostedSupermemorySearchDisabled: armExport?.env?.supermemorySearchDisabled === true,
    hostedSupermemorySearchPolicy: armExport?.env?.supermemorySearchPolicy ?? null,
    compatibleWithLegacyShardIntake: oldIntakeCompatible,
    compatibilityReason: oldIntakeCompatible
      ? "expanded shard strategy set matches the legacy local-full plan"
      : "expanded wiki-method shard has a different strategy set than earlier local-full shards",
  },
  strategies,
  comparisons: {
    bestStrategy: best?.strategy ?? null,
    bestAnswerQuality: best?.answerQuality ?? null,
    bm25: compare("bm25-lite"),
    fullHybrid: compare("full-hybrid-rerank"),
    queryExpanded: compare("query-expanded-full-hybrid-rerank"),
    wikiTitle: compare("wiki-title-amplified-hybrid"),
    wikiSubtopic: compare("wiki-subtopic-amplified-hybrid"),
    wikiSummarySession: compare("wiki-summary-session-hybrid"),
    localApple: compare("local-apple-qwen3-0_6b"),
    localAppleLocalRerank: compare("local-apple-qwen3-0_6b-local-rerank"),
  },
  decisions: buildDecisions(),
  priorLocalFullContext: summarizePriorPerformance(performance),
  observedArmSnapshot: summarizeArmCoverage(commonShardStates.filter((state) => state.present).map((state) => state.json)),
  nextActions: buildNextActions(),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local wiki method report json");
assertSafePublicText(markdownText, "local wiki method report markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function strategyScore(strategy) {
  return {
    strategy: strategy.strategy,
    scoredQueryCount: Number(strategy.scoredQueryCount ?? 0),
    answerQuality: Number(strategy.metrics?.answerQuality ?? 0),
    quality: Number(strategy.metrics?.quality ?? 0),
    judgeCorrectRate: Number(strategy.metrics?.judgeCorrectRate ?? 0),
    answerLatencyP50Ms: Number(strategy.metrics?.answerLatencyP50Ms ?? 0),
    contextTokensAvg: Number(strategy.metrics?.contextTokensAvg ?? 0),
  };
}

function compare(strategy) {
  const current = strategies[strategy] ?? null;
  if (!current) return null;
  const bm25Quality = Number(bm25?.answerQuality ?? Number.NaN);
  return {
    strategy,
    answerQuality: current.answerQuality,
    judgeCorrectRate: current.judgeCorrectRate,
    answerLatencyP50Ms: current.answerLatencyP50Ms,
    contextTokensAvg: current.contextTokensAvg,
    deltaVsBm25: Number.isFinite(bm25Quality) ? round(current.answerQuality - bm25Quality) : null,
    winsVsBm25: Number.isFinite(bm25Quality) ? current.answerQuality > bm25Quality : null,
  };
}

function buildDecisions() {
  const title = compare("wiki-title-amplified-hybrid");
  const subtopic = compare("wiki-subtopic-amplified-hybrid");
  const summary = compare("wiki-summary-session-hybrid");
  const localRerank = compare("local-apple-qwen3-0_6b-local-rerank");
  const fullHybrid = compare("full-hybrid-rerank");
  const queryExpanded = compare("query-expanded-full-hybrid-rerank");
  return [
    {
      id: "wiki-title-amplification",
      status: title?.winsVsBm25 ? "positive-signal" : "negative-signal",
      evidence: title ? `score ${title.answerQuality}; delta vs BM25 ${title.deltaVsBm25}` : "missing strategy row",
      decision: "Do not promote title amplification from the current evidence.",
    },
    {
      id: "wiki-subtopic-amplification",
      status: subtopic?.winsVsBm25 ? "positive-signal" : "not-yet-positive",
      evidence: subtopic ? `score ${subtopic.answerQuality}; delta vs BM25 ${subtopic.deltaVsBm25}` : "missing strategy row",
      decision: "Keep subtopic amplification as an experimental arm, not a default.",
    },
    {
      id: "wiki-summary-session",
      status: summary?.winsVsBm25 ? "positive-signal" : "negative-signal",
      evidence: summary ? `score ${summary.answerQuality}; delta vs BM25 ${summary.deltaVsBm25}` : "missing strategy row",
      decision: "Do not promote summary-session wiki retrieval on this shard.",
    },
    {
      id: "local-rerank",
      status: localRerank?.winsVsBm25 ? "positive-signal" : "not-yet-positive",
      evidence: localRerank ? `score ${localRerank.answerQuality}; delta vs BM25 ${localRerank.deltaVsBm25}` : "missing strategy row",
      decision: "Keep local rerank as the next method-refinement candidate.",
    },
    {
      id: "full-hybrid-and-query-expansion",
      status: fullHybrid?.winsVsBm25 || queryExpanded?.winsVsBm25 ? "mixed-or-positive" : "not-promoted",
      evidence: `full-hybrid delta ${fullHybrid?.deltaVsBm25 ?? "n/a"}; query-expanded delta ${queryExpanded?.deltaVsBm25 ?? "n/a"}`,
      decision: "Do not promote query expansion; continue measuring full hybrid against BM25 shard by shard.",
    },
  ];
}

function buildNextActions() {
  const title = compare("wiki-title-amplified-hybrid");
  const subtopic = compare("wiki-subtopic-amplified-hybrid");
  const localRerank = compare("local-apple-qwen3-0_6b-local-rerank");
  return [
    title?.winsVsBm25
      ? `Review wiki-title amplification on the next shard; it beat BM25 by ${title.deltaVsBm25} here.`
      : title
        ? `Do not promote wiki-title amplification; it trailed BM25 by ${Math.abs(Number(title.deltaVsBm25 ?? 0))} on this shard.`
        : "Do not promote wiki-title amplification; this shard did not include a wiki-title arm.",
    subtopic?.winsVsBm25
      ? `Review wiki-subtopic amplification on the next shard; it beat BM25 by ${subtopic.deltaVsBm25} here.`
      : subtopic
        ? `Keep wiki-subtopic amplification experimental; it did not beat BM25 on this shard.`
        : "Keep wiki-subtopic amplification experimental; this shard did not include a wiki-subtopic arm.",
    localRerank?.winsVsBm25
      ? `Keep the local rerank arm in the next expanded shard; it beat BM25 by ${localRerank.deltaVsBm25} here.`
      : localRerank
        ? `Keep local rerank measured, but do not promote it from this shard; it trailed BM25 by ${Math.abs(Number(localRerank.deltaVsBm25 ?? 0))}.`
        : "Keep local rerank measured in the next shard; this shard did not include the local rerank arm.",
    "If aggregating old and new shards, use a common-arm report or rerun earlier shards with the expanded strategy set.",
  ];
}

function summarizePriorPerformance(value) {
  if (!value) return null;
  return {
    status: value.status ?? null,
    acceptedShards: Number(value.coverage?.acceptedShardCount ?? 0),
    acceptedQueries: Number(value.coverage?.acceptedQueryCount ?? 0),
    queryCount: Number(value.coverage?.queryCount ?? 0),
    bestStrategy: value.bestAnswerQuality?.strategy ?? null,
    bestAnswerQuality: Number(value.bestAnswerQuality?.answerQuality ?? 0),
  };
}

function summarizeArmCoverage(results) {
  const rows = new Map();
  for (const result of results) {
    for (const strategy of arrayOf(result.strategies)) {
      const current = rows.get(strategy.strategy) ?? {
        strategy: strategy.strategy,
        scorePoints: 0,
        scoredQueryCount: 0,
        shardCount: 0,
      };
      const scoredQueryCount = Number(strategy.scoredQueryCount ?? 0);
      current.scorePoints += (Number(strategy.metrics?.answerQuality ?? 0) / 100) * scoredQueryCount;
      current.scoredQueryCount += scoredQueryCount;
      current.shardCount += 1;
      rows.set(strategy.strategy, current);
    }
  }
  return [...rows.values()]
    .map((row) => ({
      strategy: row.strategy,
      answerQuality: row.scoredQueryCount > 0 ? round((100 * row.scorePoints) / row.scoredQueryCount) : 0,
      scoredQueryCount: row.scoredQueryCount,
      shardCount: row.shardCount,
    }))
    .sort((left, right) => Number(right.answerQuality) - Number(left.answerQuality));
}

function renderMarkdown(value) {
  return [
    "# Local Wiki Method Report",
    "",
    `- Status: ${value.status}`,
    `- Shard: ${value.shard.startIndex}-${value.shard.endIndexExclusive} of ${value.shard.totalQueryCount}`,
    `- Scored queries: ${value.shard.scoredQueryCount}`,
    `- Best strategy: ${value.comparisons.bestStrategy}`,
    `- Best answer quality: ${value.comparisons.bestAnswerQuality}`,
    `- Hosted Supermemory search disabled: ${value.methodIsolation.hostedSupermemorySearchDisabled}`,
    `- Compatible with legacy shard intake: ${value.methodIsolation.compatibleWithLegacyShardIntake}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    "",
    "## Strategy Scores",
    "",
    ...Object.values(value.strategies).map(
      (strategy) =>
        `- ${strategy.strategy}: answerQuality=${strategy.answerQuality}, correctRate=${strategy.judgeCorrectRate}, p50=${strategy.answerLatencyP50Ms}ms, deltaVsBm25=${compare(strategy.strategy)?.deltaVsBm25 ?? "n/a"}`,
    ),
    "",
    "## Observed Arm Snapshot",
    "",
    ...value.observedArmSnapshot.map(
      (strategy) =>
        `- ${strategy.strategy}: answerQuality=${strategy.answerQuality}, scoredQueries=${strategy.scoredQueryCount}, shards=${strategy.shardCount}`,
    ),
    "",
    "## Decisions",
    "",
    ...value.decisions.flatMap((decision) => [
      `### ${decision.id}`,
      "",
      `- Status: ${decision.status}`,
      `- Evidence: ${decision.evidence}`,
      `- Decision: ${decision.decision}`,
      "",
    ]),
    "## Next Actions",
    "",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function evidenceRef(state) {
  return {
    path: state.path,
    hash: state.hash,
  };
}

function loadRequiredJson(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  return loadJson(path, label);
}

function loadOptionalJson(path, label) {
  if (!existsSync(path) || statSync(path).size === 0) {
    return { path: displayPath(path), hash: null, present: false, json: null };
  }
  return loadJson(path, label);
}

function loadJson(path, label) {
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return {
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    present: true,
    json: JSON.parse(raw),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function resolveInputPath(pathLike) {
  const value = String(pathLike);
  return isAbsolute(value) ? value : resolve(root, value);
}

function preferReviewFile(...names) {
  for (const name of names) {
    const path = `${reviewDir}/${name}`;
    if (existsSync(resolveInputPath(path))) return path;
  }
  return `${reviewDir}/${names.at(-1)}`;
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : "external-file";
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function coercePathList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stableList(values) {
  return [...values].map(String).sort();
}

function bestBy(items, score) {
  return items.reduce((bestItem, item) => (bestItem == null || score(item) > score(bestItem) ? item : bestItem), null);
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10000) / 10000 : null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
  assert.equal(secretPattern.test(text), false, `${label} contains secret-shaped text`);
  assert.equal(privatePathPattern.test(text), false, `${label} contains absolute private path`);
  assert.equal(privateTagPattern.test(text), false, `${label} contains private tag`);
}
