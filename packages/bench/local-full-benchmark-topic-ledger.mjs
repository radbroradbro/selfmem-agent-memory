import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const performancePath = resolveInputPath(
  args.performance ??
    preferReviewFile(
      "local-full-shard-performance-report-after-shard-018-20260529.json",
      "local-full-shard-performance-report-after-shard-017-20260529.json",
      "local-full-shard-performance-report-after-shard-016-20260529.json",
      "local-full-shard-performance-report-after-shard-015-20260529.json",
      "local-full-shard-performance-report-after-shard-014-20260528.json",
      "local-full-shard-performance-report-after-shard-013-20260528.json",
      "local-full-shard-performance-report-after-shard-012-20260528.json",
      "local-full-shard-performance-report-after-shard-011-20260528.json",
      "local-full-shard-performance-report-after-shard-010-20260528.json",
      "local-full-shard-performance-report-20260527.json",
    ),
);
const intakePath = resolveInputPath(
  args.intake ??
    preferReviewFile(
      "answer-quality-local-full-shard-intake-after-shard-018-20260529.json",
      "answer-quality-local-full-shard-intake-after-shard-017-20260529.json",
      "answer-quality-local-full-shard-intake-after-shard-016-20260529.json",
      "answer-quality-local-full-shard-intake-after-shard-015-20260529.json",
      "answer-quality-local-full-shard-intake-after-shard-014-20260528.json",
      "answer-quality-local-full-shard-intake-after-shard-013-20260528.json",
      "answer-quality-local-full-shard-intake-after-shard-012-20260528.json",
      "answer-quality-local-full-shard-intake-after-shard-011-20260528.json",
      "answer-quality-local-full-shard-intake-after-shard-010-20260528.json",
      "answer-quality-local-full-shard-intake-after-shard-008-20260527.json",
    ),
);
const wikiFixturePath = resolveInputPath(
  args.wikiFixture ?? `${reviewDir}/public-longmemeval-wiki-amplification-fixture-20260526.json`,
);
const hostedBaselinePath = resolveInputPath(args.hostedBaseline ?? `${reviewDir}/hosted-baseline-live-budgeted-run.json`);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const wikiOutputPath = args.wikiOutput ? resolveInputPath(args.wikiOutput) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown", "wiki"].includes(format), "--format must be json, markdown, or wiki");

const performanceState = loadRequiredJson(performancePath, "local-full performance report");
const intakeState = loadRequiredJson(intakePath, "local-full shard intake");
const wikiFixtureState = loadOptionalJson(wikiFixturePath, "wiki amplification fixture");
const hostedBaselineState = loadOptionalJson(hostedBaselinePath, "hosted baseline report");
const performance = performanceState.json;
const intake = intakeState.json;
const wikiFixture = wikiFixtureState.json;
const hostedBaseline = hostedBaselineState.json;
const strategyByName = new Map(arrayOf(performance.strategySummaries).map((strategy) => [strategy.strategy, strategy]));
const bm25 = strategyByName.get("bm25-lite") ?? null;
const fullHybrid = strategyByName.get("full-hybrid-rerank") ?? null;
const queryExpanded = strategyByName.get("query-expanded-full-hybrid-rerank") ?? null;
const localApple = strategyByName.get("local-apple-qwen3-0_6b") ?? null;
const localRerank = strategyByName.get("local-apple-qwen3-0_6b-local-rerank") ?? null;
const best = performance.bestAnswerQuality ?? bestBy(arrayOf(performance.strategySummaries), (strategy) => Number(strategy.answerQuality ?? 0));
const coverage = performance.coverage ?? {};
const wikiPromotion = wikiFixture?.hybridPromotion ?? wikiFixture?.promotion ?? null;
const hosted = hostedBaseline?.evidence?.hosted ?? null;
const recallWeaveHostedComparison = hostedBaseline?.evidence?.recallWeave ?? null;

const ledger = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-benchmark-topic-ledger",
  status: coverage.completeCoverage ? "COMPLETE_LOCAL_FULL_TOPIC_LEDGER" : "PARTIAL_LOCAL_FULL_TOPIC_LEDGER",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath || wikiOutputPath),
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
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  sourceEvidence: {
    performance: evidenceRef(performanceState),
    intake: evidenceRef(intakeState),
    wikiFixture: wikiFixtureState.present ? evidenceRef(wikiFixtureState) : null,
    hostedBaseline: hostedBaselineState.present ? evidenceRef(hostedBaselineState) : null,
  },
  coverage: {
    acceptedShards: Number(coverage.acceptedShardCount ?? 0),
    shardCount: Number(coverage.shardCount ?? 0),
    acceptedQueries: Number(coverage.acceptedQueryCount ?? 0),
    queryCount: Number(coverage.queryCount ?? 0),
    coveragePercent: Number(coverage.coveragePercent ?? 0),
    nextPendingShardId: coverage.nextPendingShardId ?? null,
    nextPendingShardRange: coverage.nextPendingShardRange ?? null,
    blockers: arrayOf(performance.blockers),
  },
  currentScores: {
    bestStrategy: strategyScore(best),
    bm25: strategyScore(bm25),
    fullHybrid: strategyScore(fullHybrid),
    queryExpanded: strategyScore(queryExpanded),
    localApple: strategyScore(localApple),
    localAppleLocalRerank: strategyScore(localRerank),
  },
  topicLedger: buildTopics(),
  storagePolicy: {
    publicWikiStores: [
      "strategy names",
      "metric aggregates",
      "query shard ranges",
      "hashes",
      "method decisions",
      "blocker classes",
    ],
    privateIndexStores: [
      "raw benchmark questions",
      "raw answer labels",
      "raw memory/session text",
      "retrieved candidate chunks",
      "local vector index payloads",
    ],
    rule: "Use public wiki pages for method recall and private local indexes for raw evidence review.",
  },
  promotionPolicy: {
    defaultPersonalPath: "cloud-voyage-provider-lane",
    methodRefinementPath: "local-apple-full-shard-lane",
    bm25Role: "lexical-floor-control",
    queryExpansionRole: "experimental-negative-until-same-data-win",
    wikiAmplificationRole: "experimental-unproven-until-accepted-shard-win",
  },
  nextActions: [
    coverage.nextPendingShardId
      ? `Run ${coverage.nextPendingShardId} with hosted Supermemory search disabled and regenerate this ledger.`
      : "Run combine and memory-score gates after complete local-full coverage.",
    "Run a local-wiki shard plan before promoting title or subtopic amplification beyond fixture status.",
    "Keep raw LongMemEval material outside repo-facing wiki artifacts; index it only in local private storage.",
  ],
};

const jsonText = `${JSON.stringify(ledger, null, 2)}\n`;
const markdownText = `${renderMarkdown(ledger)}\n`;
const wikiText = `${renderWikiPage(ledger)}\n`;
assertSafePublicText(jsonText, "benchmark topic ledger json");
assertSafePublicText(markdownText, "benchmark topic ledger markdown");
assertSafePublicText(wikiText, "benchmark topic ledger wiki page");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
if (wikiOutputPath) writeOutput(wikiOutputPath, wikiText);
if (format === "markdown") process.stdout.write(markdownText);
else if (format === "wiki") process.stdout.write(wikiText);
else process.stdout.write(jsonText);

function buildTopics() {
  const fullHybridDelta = deltaVsBm25(fullHybrid);
  const queryExpansionDelta = deltaVsBm25(queryExpanded);
  const localRerankDelta = deltaVsBm25(localRerank);
  const localRerankDeltaVsBase =
    localRerank && localApple ? round(Number(localRerank.answerQuality ?? 0) - Number(localApple.answerQuality ?? 0)) : null;
  const wikiFixtureOnly = wikiFixture?.fixtureOnly !== false || wikiFixture?.memoryBenchAnswerQuality !== true;
  const hostedQuality = Number(hosted?.metrics?.quality ?? Number.NaN);
  const recallWeaveQuality = Number(recallWeaveHostedComparison?.metrics?.quality ?? Number.NaN);

  return [
    {
      id: "local-full-coverage",
      title: "Local-full coverage is still partial",
      status: coverage.completeCoverage ? "complete" : "blocked",
      evidence: `${coverage.acceptedQueryCount ?? 0}/${coverage.queryCount ?? 0} questions accepted across ${coverage.acceptedShardCount ?? 0}/${coverage.shardCount ?? 0} shards.`,
      decision: "Do not claim local-full or SOTA completion until all planned shards are accepted and combined.",
      nextAction: coverage.nextPendingShardId
        ? `Run ${coverage.nextPendingShardId} (${coverage.nextPendingShardRange ?? "next range"}).`
        : "Run combine and memory-score gates.",
    },
    {
      id: "bm25-control",
      title: "BM25 remains the lexical floor",
      status: bm25 ? "active-control" : "missing-control",
      evidence: bm25
        ? `bm25-lite score ${bm25.answerQuality}; p50 ${bm25.answerLatencyP50Ms} ms.`
        : "No bm25-lite row was found in the current performance report.",
      decision: "Keep BM25 in every fair comparison and use it as the fallback/control arm.",
      nextAction: "Compare every promoted retrieval method against BM25 on the same accepted shard set.",
    },
    {
      id: "local-rerank-positive",
      title: "Local Apple rerank is the current local winner",
      status: localRerankDelta != null && localRerankDelta > 0 ? "positive-signal" : "not-positive",
      evidence:
        localRerank && bm25
          ? `local-apple-qwen3-0_6b-local-rerank score ${localRerank.answerQuality}; delta vs BM25 ${localRerankDelta}; delta vs base ${localRerankDeltaVsBase}.`
          : "Local rerank or BM25 row missing.",
      decision: "Treat local rerank as the current method-refinement candidate, not as a public benchmark claim.",
      nextAction: coverage.nextPendingShardId
        ? `Keep local rerank in ${coverage.nextPendingShardId} and watch whether the gain survives beyond ${coverage.coveragePercent ?? "current"}% coverage.`
        : "Keep local rerank through final combine and memory-score gates.",
    },
    {
      id: "full-hybrid-regressed",
      title: "Plain full-hybrid is not promoted on current answer-quality evidence",
      status: fullHybridDelta != null && fullHybridDelta > 0 ? "positive-signal" : "not-promoted",
      evidence:
        fullHybrid && bm25
          ? `full-hybrid-rerank score ${fullHybrid.answerQuality}; delta vs BM25 ${fullHybridDelta}.`
          : "Full-hybrid or BM25 row missing.",
      decision: "Do not treat deterministic full-hybrid as superior on the current accepted-shard aggregation.",
      nextAction: "Use per-shard diagnostics to identify whether dense or rerank ordering is hurting specific categories.",
    },
    {
      id: "query-expansion-negative",
      title: "Query expansion remains negative",
      status: queryExpansionDelta != null && queryExpansionDelta > 0 ? "positive-signal" : "negative-signal",
      evidence:
        queryExpanded && bm25
          ? `query-expanded-full-hybrid-rerank score ${queryExpanded.answerQuality}; delta vs BM25 ${queryExpansionDelta}.`
          : "Query-expanded or BM25 row missing.",
      decision: "Keep query expansion experimental and disabled as a default method until a same-data accepted shard win appears.",
      nextAction: "Audit rewrite quality, fallback frequency, and category sensitivity before spending more full-shard cycles.",
    },
    {
      id: "wiki-amplification-unproven",
      title: "Wiki title and subtopic amplification are wired but unproven",
      status: wikiFixtureOnly ? "fixture-only" : "needs-real-shard-check",
      evidence: wikiFixture
        ? `wiki fixture query count ${wikiFixture.input?.queryCount ?? "n/a"}; winner ${wikiFixture.winner?.strategy ?? "n/a"}; quality delta vs BM25 ${wikiPromotion?.qualityDeltaVsBm25 ?? "n/a"}.`
        : "No wiki amplification fixture was found.",
      decision: "Do not promote title or subtopic boost from a fixture tie.",
      nextAction: "Run a local-wiki shard plan or retrieval-proxy stress slice that includes wiki-title and wiki-subtopic arms.",
    },
    {
      id: "hosted-supermemory-boundary",
      title: "Hosted Supermemory comparison is separate from local-full methodology",
      status: hostedBaseline ? "canary-boundary-recorded" : "not-recorded",
      evidence:
        Number.isFinite(hostedQuality) && Number.isFinite(recallWeaveQuality)
          ? `hosted canary quality ${hostedQuality}; RecallWeave canary quality ${recallWeaveQuality}; query count ${hosted?.queryCount ?? "n/a"}.`
          : "No same-run hosted canary metrics were loaded.",
      decision: "Do not compare local-full partial shards to Supermemory reported SOTA or free-tier canaries as if they are the same benchmark.",
      nextAction: "Use hosted Supermemory only in explicit hosted-baseline runs; keep it disabled for method refinement shards.",
    },
  ];
}

function strategyScore(strategy) {
  if (!strategy) return null;
  return {
    strategy: strategy.strategy,
    scoredQueryCount: Number(strategy.scoredQueryCount ?? 0),
    answerQuality: Number(strategy.answerQuality ?? 0),
    quality: Number(strategy.quality ?? 0),
    judgeCorrectRate: Number(strategy.judgeCorrectRate ?? 0),
    answerLatencyP50Ms: Number(strategy.answerLatencyP50Ms ?? 0),
    deltaVsBm25: deltaVsBm25(strategy),
  };
}

function deltaVsBm25(strategy) {
  if (!strategy || !bm25) return null;
  return round(Number(strategy.answerQuality ?? 0) - Number(bm25.answerQuality ?? 0));
}

function renderMarkdown(value) {
  return [
    "# Local-Full Benchmark Topic Ledger",
    "",
    `- Status: ${value.status}`,
    `- Accepted questions: ${value.coverage.acceptedQueries}/${value.coverage.queryCount}`,
    `- Coverage: ${value.coverage.coveragePercent}%`,
    `- Next pending shard: ${value.coverage.nextPendingShardId ?? "n/a"} (${value.coverage.nextPendingShardRange ?? "n/a"})`,
    `- Best strategy: ${value.currentScores.bestStrategy?.strategy ?? "n/a"}`,
    `- Best answer quality: ${value.currentScores.bestStrategy?.answerQuality ?? "n/a"}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    "",
    "## Topics",
    "",
    ...value.topicLedger.flatMap((topic) => [
      `### ${topic.title}`,
      "",
      `- Status: ${topic.status}`,
      `- Evidence: ${topic.evidence}`,
      `- Decision: ${topic.decision}`,
      `- Next action: ${topic.nextAction}`,
      "",
    ]),
    "## Storage Policy",
    "",
    `- Rule: ${value.storagePolicy.rule}`,
    `- Public wiki stores: ${value.storagePolicy.publicWikiStores.join(", ")}`,
    `- Private index stores: ${value.storagePolicy.privateIndexStores.join(", ")}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((action) => `- ${action}`),
  ].join("\n");
}

function renderWikiPage(value) {
  return [
    "---",
    'title: "LongMemEval Benchmark Topics"',
    'type: "methodology"',
    'category: "benchmark"',
    'tags: ["longmemeval", "benchmark", "local-full", "wiki"]',
    "aliases: []",
    "sources:",
    `  - ${JSON.stringify(value.sourceEvidence.performance.path)}`,
    `  - ${JSON.stringify(value.sourceEvidence.intake.path)}`,
    "confidence: 0.7",
    "version: 1",
    "provenance:",
    "  extracted: []",
    "  inferred:",
    '    - "Derived from public-safe local-full benchmark metrics."',
    "  ambiguous:",
    '    - "Topic categories are method-level summaries, not raw benchmark question categories."',
    "reviewed: false",
    "---",
    "",
    "# LongMemEval Benchmark Topics",
    "",
    `Accepted questions: ${value.coverage.acceptedQueries}/${value.coverage.queryCount}.`,
    `Current best local strategy: ${value.currentScores.bestStrategy?.strategy ?? "n/a"} (${value.currentScores.bestStrategy?.answerQuality ?? "n/a"}).`,
    "",
    "## Topic Ledger",
    "",
    ...value.topicLedger.flatMap((topic) => [
      `### ${topic.title}`,
      "",
      `- Status: ${topic.status}`,
      `- Evidence: ${topic.evidence}`,
      `- Decision: ${topic.decision}`,
      `- Next action: ${topic.nextAction}`,
      "",
    ]),
    "## Storage Policy",
    "",
    value.storagePolicy.rule,
    "",
    "Public wiki stores method notes, aggregate scores, hashes, shard ranges, and blocker classes. Raw benchmark questions, answer labels, session text, candidate chunks, and vector payloads stay in local private indexes.",
    "",
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
    const candidate = `${reviewDir}/${name}`;
    if (existsSync(resolveInputPath(candidate))) return candidate;
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
