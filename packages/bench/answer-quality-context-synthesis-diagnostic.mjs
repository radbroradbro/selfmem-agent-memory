import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const answerQualityPath = resolveInputPath(args.answerQuality ?? args.answerQualityResult);
const retrievalAutopsyPath = resolveInputPath(args.retrievalAutopsy ?? args.retrieval);
const resultGatePath = resolveInputPath(args.resultGate ?? args.gate);
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const baselineMethod = String(args.baselineMethod ?? "session-v1");
const challengerMethod = String(args.challengerMethod ?? "contextual-source-chunk-v1");
const strategy = String(args.strategy ?? "bm25-lite");
const requireReady = Boolean(args.requireReady);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
const answerQuality = loadPublicJson(answerQualityPath, "answer-quality result");
const retrievalAutopsy = loadPublicJson(retrievalAutopsyPath, "retrieval autopsy");
const resultGate = resultGatePath ? loadPublicJson(resultGatePath, "method result gate") : null;

const report = buildReport();
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "context synthesis diagnostic");
assertSafePublicText(markdownText, "context synthesis diagnostic markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_FOR_CONTEXT_SYNTHESIS_FIX_LOOP") process.exit(1);

function buildReport() {
  assert.equal(answerQuality.mode, "answer-quality-memory-method-ladder", "answer-quality result must be a method ladder");
  assert.equal(retrievalAutopsy.mode, "answer-quality-method-ladder-retrieval-autopsy", "retrieval input must be retrieval autopsy");
  const baselineQuality = methodQuality(answerQuality, baselineMethod, strategy);
  const challengerQuality = methodQuality(answerQuality, challengerMethod, strategy);
  const baselineRetrieval = methodRetrieval(retrievalAutopsy, baselineMethod, strategy);
  const challengerRetrieval = methodRetrieval(retrievalAutopsy, challengerMethod, strategy);
  const pairedQueries = pairQueries({ baselineQuality, challengerQuality, baselineRetrieval, challengerRetrieval });
  const classes = summarizeClasses(pairedQueries);
  const conversion = {
    baselineHitToCorrectRate: hitToCorrectRate(pairedQueries, "baseline"),
    challengerHitToCorrectRate: hitToCorrectRate(pairedQueries, "challenger"),
    challengerOnlyHitConvertedCount: pairedQueries.filter((item) => item.retrievalOutcome === "challenger-only-hit" && item.challenger.correct).length,
    challengerOnlyHitCount: pairedQueries.filter((item) => item.retrievalOutcome === "challenger-only-hit").length,
    bothHitBothWrongCount: pairedQueries.filter((item) => item.retrievalOutcome === "both-hit" && !item.baseline.correct && !item.challenger.correct).length,
    bothHitCount: pairedQueries.filter((item) => item.retrievalOutcome === "both-hit").length,
  };
  const repeatedWrongAnswerHashes = repeatedWrongHashes(pairedQueries);
  const answerQualityDelta = round(Number(challengerQuality.answerQuality ?? 0) - Number(baselineQuality.answerQuality ?? 0), 6);
  const retrievalHitRateLift = round(Number(challengerRetrieval.hitRate ?? 0) - Number(baselineRetrieval.hitRate ?? 0), 6);
  const resultGateBlocks = resultGate?.blockers ?? [];
  const status = retrievalHitRateLift > 0 && answerQualityDelta <= 0
    ? "READY_FOR_CONTEXT_SYNTHESIS_FIX_LOOP"
    : "BLOCKED_CONTEXT_SYNTHESIS_DIAGNOSIS_INCONCLUSIVE";
  const blockers = [
    retrievalHitRateLift <= 0 ? "retrieval-lift-not-positive" : null,
    answerQualityDelta > 0 ? "answer-quality-already-improved" : null,
    pairedQueries.length === 0 ? "no-paired-query-fingerprints" : null,
  ].filter(Boolean);
  return {
    schemaVersion: 1,
    ok: true,
    mode: "answer-quality-context-synthesis-diagnostic",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    readsPrivateMaterializedInputs: false,
    publicBenchmarkClaimsAllowed: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPrivateOutputPathIncluded: false,
    benchmark: answerQuality.benchmark ?? retrievalAutopsy.benchmark ?? "longmemeval",
    queryShard: {
      answerQuality: answerQuality.queryShard ?? null,
      retrievalAutopsy: retrievalAutopsy.queryShard ?? null,
      sameRawQuerySelectionAcrossMethods:
        answerQuality.queryShard?.sameRawQuerySelectionAcrossMethods === true
        && retrievalAutopsy.queryShard?.sameRawQuerySelectionAcrossMethods === true,
      selectedQuestionIdsHash: answerQuality.queryShard?.selectedQuestionIdsHash ?? retrievalAutopsy.target?.selectedQuestionIdsHash ?? null,
    },
    methods: {
      baseline: baselineMethod,
      challenger: challengerMethod,
      strategy,
    },
    evidence: {
      answerQualityPath: relativeEvidencePath(answerQualityPath),
      answerQualityHash: `sha256:${fileHash(answerQualityPath)}`,
      retrievalAutopsyPath: relativeEvidencePath(retrievalAutopsyPath),
      retrievalAutopsyHash: `sha256:${fileHash(retrievalAutopsyPath)}`,
      resultGatePath: resultGatePath ? relativeEvidencePath(resultGatePath) : null,
      resultGateHash: resultGatePath ? `sha256:${fileHash(resultGatePath)}` : null,
      resultGateStatus: resultGate?.status ?? null,
      resultGateBlockers: resultGateBlocks,
    },
    status,
    blockers,
    reason:
      status === "READY_FOR_CONTEXT_SYNTHESIS_FIX_LOOP"
        ? "Retrieval support improved for the challenger, but answer-quality did not improve; the next bounded loop should repair context packaging or answer synthesis before expanding benchmark scope."
        : "The public artifacts do not yet prove the retrieval-improved / synthesis-failed split.",
    comparison: {
      retrievalHitRateLift,
      answerQualityDelta,
      baseline: {
        answerQuality: baselineQuality.answerQuality,
        correctRate: baselineQuality.judgeCorrectRate,
        hitRate: baselineRetrieval.hitRate,
        hitQueryCount: baselineRetrieval.hitQueryCount,
        missQueryCount: baselineRetrieval.missQueryCount,
        contextTokensAvg: baselineQuality.contextTokensAvg,
      },
      challenger: {
        answerQuality: challengerQuality.answerQuality,
        correctRate: challengerQuality.judgeCorrectRate,
        hitRate: challengerRetrieval.hitRate,
        hitQueryCount: challengerRetrieval.hitQueryCount,
        missQueryCount: challengerRetrieval.missQueryCount,
        contextTokensAvg: challengerQuality.contextTokensAvg,
      },
      conversion,
      repeatedWrongAnswerHashes,
    },
    failureClasses: classes,
    pairedQueries,
    nextActions:
      status === "READY_FOR_CONTEXT_SYNTHESIS_FIX_LOOP"
        ? [
            "Run a bounded fix loop on answer prompt packaging and context selection for the challenger-only-hit query before a larger scorer run.",
            "Prioritize support conversion: retrieved expected support should produce a non-unknown candidate answer and a positive judge score.",
            "After a concrete context/synthesis change, rerun the same q150-q155 method ladder and result gate; do not claim method promotion from retrieval lift alone.",
          ]
        : [
            "Gather paired public retrieval and answer-quality artifacts before deciding the next layer.",
          ],
    countsAsRetrievalLayerEvidence: true,
    countsAsAnswerQualityEvidence: true,
    countsAsFullMemorySotaEvidence: false,
    countsAsProductionRolloutEvidence: false,
  };
}

function methodQuality(report, method, targetStrategy) {
  const methodReport = (report.answerQualityReports ?? []).find((item) => item.method === method);
  assert.ok(methodReport, `missing answer-quality method: ${method}`);
  const arm = (methodReport.strategies ?? []).find((item) => item.strategy === targetStrategy);
  assert.ok(arm, `missing answer-quality strategy ${targetStrategy} for ${method}`);
  return {
    method,
    strategy: targetStrategy,
    answerQuality: methodReport.metrics?.answerQuality ?? arm.answerQuality ?? null,
    judgeCorrectRate: methodReport.metrics?.judgeCorrectRate ?? arm.judgeCorrectRate ?? null,
    contextTokensAvg: methodReport.metrics?.contextTokensAvg ?? null,
    answerFailures: arm.answerFailures ?? 0,
    judgeFailures: arm.judgeFailures ?? 0,
    fingerprints: (arm.resultFingerprints ?? []).map((item) => ({
      queryIdHash: normalizeHashId(item.queryIdHash),
      queryHash: normalizeHashId(item.queryHash),
      candidateAnswerHash: item.candidateAnswerHash ?? null,
      judgeDecisionHash: item.judgeDecisionHash ?? null,
      contextResultCount: Number(item.contextResultCount ?? 0),
      responseTotal: Number(item.responseTotal ?? 0),
      contextTokens: Number(item.contextTokens ?? 0),
      score: Number(item.score ?? 0),
      correct: item.correct === true,
    })),
  };
}

function methodRetrieval(report, method, targetStrategy) {
  const methodReport = (report.methodReports ?? []).find((item) => item.method === method);
  assert.ok(methodReport, `missing retrieval method: ${method}`);
  const arm = (methodReport.arms ?? []).find((item) => item.strategy === targetStrategy);
  assert.ok(arm, `missing retrieval strategy ${targetStrategy} for ${method}`);
  return {
    method,
    strategy: targetStrategy,
    hitRate: Number(arm.hitRate ?? 0),
    hitQueryCount: Number(arm.hitQueryCount ?? 0),
    missQueryCount: Number(arm.missQueryCount ?? 0),
    expectedRefCount: Number(arm.expectedRefCount ?? 0),
    averageResponseResultCount: Number(arm.averageResponseResultCount ?? 0),
    outcomes: (arm.queryOutcomes ?? []).map((item) => ({
      queryIdHash: normalizeHashId(item.queryIdHash),
      queryHash: normalizeHashId(item.queryHash),
      expectedRefCount: Number(item.expectedRefCount ?? 0),
      responseResultCount: Number(item.responseResultCount ?? 0),
      responseTotal: Number(item.responseTotal ?? 0),
      responseTotalBeforeBudget: Number(item.responseTotalBeforeBudget ?? 0),
      firstHitRank: item.firstHitRank == null ? null : Number(item.firstHitRank),
      hit: item.hit === true,
      hitCount: Number(item.hitCount ?? 0),
      rankBucket: item.rankBucket ?? null,
    })),
  };
}

function pairQueries({ baselineQuality, challengerQuality, baselineRetrieval, challengerRetrieval }) {
  const baselineQualityByQuery = byQuery(baselineQuality.fingerprints);
  const challengerQualityByQuery = byQuery(challengerQuality.fingerprints);
  const baselineRetrievalByQuery = byQuery(baselineRetrieval.outcomes);
  const challengerRetrievalByQuery = byQuery(challengerRetrieval.outcomes);
  const queryIds = [...new Set([
    ...baselineQualityByQuery.keys(),
    ...challengerQualityByQuery.keys(),
    ...baselineRetrievalByQuery.keys(),
    ...challengerRetrievalByQuery.keys(),
  ])].sort();
  return queryIds.map((queryIdHash) => {
    const bq = baselineQualityByQuery.get(queryIdHash) ?? emptyQuality(queryIdHash);
    const cq = challengerQualityByQuery.get(queryIdHash) ?? emptyQuality(queryIdHash);
    const br = baselineRetrievalByQuery.get(queryIdHash) ?? emptyRetrieval(queryIdHash);
    const cr = challengerRetrievalByQuery.get(queryIdHash) ?? emptyRetrieval(queryIdHash);
    const retrievalOutcome = pairedRetrievalOutcome(br, cr);
    const scoreDelta = round(cq.score - bq.score, 6);
    const sameCandidateAnswerHash = Boolean(bq.candidateAnswerHash && bq.candidateAnswerHash === cq.candidateAnswerHash);
    const failureClass = classifyQuery({ bq, cq, br, cr, retrievalOutcome, sameCandidateAnswerHash });
    return {
      queryIdHash,
      queryHash: bq.queryHash ?? cq.queryHash ?? br.queryHash ?? cr.queryHash ?? null,
      retrievalOutcome,
      failureClass,
      scoreDelta,
      sameCandidateAnswerHash,
      baseline: publicQuerySide(bq, br),
      challenger: publicQuerySide(cq, cr),
    };
  });
}

function classifyQuery({ bq, cq, br, cr, retrievalOutcome, sameCandidateAnswerHash }) {
  if (bq.correct || cq.correct) return "converted-to-correct";
  if (retrievalOutcome === "both-miss") return "retrieval-absence";
  if (retrievalOutcome === "challenger-only-hit" && !cq.correct) return "challenger-retrieved-support-but-answer-still-failed";
  if (retrievalOutcome === "both-hit" && !bq.correct && !cq.correct && sameCandidateAnswerHash) {
    return "same-failed-answer-despite-retrieved-support";
  }
  if (retrievalOutcome === "both-hit" && !bq.correct && !cq.correct) return "retrieved-support-not-converted";
  if (retrievalOutcome === "baseline-only-hit" && !bq.correct) return "baseline-support-not-converted";
  if (cr.hit && cr.hitCount / Math.max(1, cr.expectedRefCount) < 0.1) return "low-support-coverage";
  return "unclassified";
}

function summarizeClasses(pairedQueries) {
  const counts = new Map();
  for (const item of pairedQueries) counts.set(item.failureClass, Number(counts.get(item.failureClass) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort());
}

function hitToCorrectRate(pairedQueries, side) {
  const hits = pairedQueries.filter((item) => item[side].hit);
  if (!hits.length) return null;
  return round(hits.filter((item) => item[side].correct).length / hits.length, 6);
}

function repeatedWrongHashes(pairedQueries) {
  const counts = new Map();
  for (const item of pairedQueries) {
    for (const side of ["baseline", "challenger"]) {
      const value = item[side];
      if (value.correct || !value.candidateAnswerHash) continue;
      counts.set(value.candidateAnswerHash, Number(counts.get(value.candidateAnswerHash) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1])
    .map(([hash, count]) => ({ candidateAnswerHash: hash, wrongUseCount: count }));
}

function publicQuerySide(quality, retrieval) {
  return {
    hit: retrieval.hit === true,
    firstHitRank: retrieval.firstHitRank,
    hitCount: retrieval.hitCount,
    expectedRefCount: retrieval.expectedRefCount,
    supportCoverage: round(Number(retrieval.hitCount ?? 0) / Math.max(1, Number(retrieval.expectedRefCount ?? 0)), 6),
    responseResultCount: retrieval.responseResultCount,
    responseTotalBeforeBudget: retrieval.responseTotalBeforeBudget,
    score: quality.score,
    correct: quality.correct,
    contextResultCount: quality.contextResultCount,
    contextTokens: quality.contextTokens,
    candidateAnswerHash: quality.candidateAnswerHash,
    judgeDecisionHash: quality.judgeDecisionHash,
  };
}

function pairedRetrievalOutcome(baseline, challenger) {
  if (baseline.hit && challenger.hit) return "both-hit";
  if (baseline.hit && !challenger.hit) return "baseline-only-hit";
  if (!baseline.hit && challenger.hit) return "challenger-only-hit";
  return "both-miss";
}

function byQuery(items) {
  return new Map(items.map((item) => [normalizeHashId(item.queryIdHash), item]));
}

function emptyQuality(queryIdHash) {
  return {
    queryIdHash,
    queryHash: null,
    candidateAnswerHash: null,
    judgeDecisionHash: null,
    contextResultCount: 0,
    responseTotal: 0,
    contextTokens: 0,
    score: 0,
    correct: false,
  };
}

function emptyRetrieval(queryIdHash) {
  return {
    queryIdHash,
    queryHash: null,
    expectedRefCount: 0,
    responseResultCount: 0,
    responseTotal: 0,
    responseTotalBeforeBudget: 0,
    firstHitRank: null,
    hit: false,
    hitCount: 0,
    rankBucket: "miss",
  };
}

function renderMarkdown(value) {
  const conversion = value.comparison.conversion;
  const lines = [
    "# Answer-quality context synthesis diagnostic",
    "",
    `Status: ${value.status}`,
    `Methods: ${value.methods.baseline} vs ${value.methods.challenger} (${value.methods.strategy})`,
    `Retrieval hit-rate lift: ${value.comparison.retrievalHitRateLift}`,
    `Answer-quality delta: ${value.comparison.answerQualityDelta}`,
    "",
    "## Conversion",
    `- Baseline hit-to-correct rate: ${conversion.baselineHitToCorrectRate}`,
    `- Challenger hit-to-correct rate: ${conversion.challengerHitToCorrectRate}`,
    `- Challenger-only hits converted: ${conversion.challengerOnlyHitConvertedCount}/${conversion.challengerOnlyHitCount}`,
    `- Both-hit but both wrong: ${conversion.bothHitBothWrongCount}/${conversion.bothHitCount}`,
    "",
    "## Failure Classes",
    ...Object.entries(value.failureClasses).map(([key, count]) => `- ${key}: ${count}`),
    "",
    "## Repeated Wrong Answer Hashes",
    ...(value.comparison.repeatedWrongAnswerHashes.length
      ? value.comparison.repeatedWrongAnswerHashes.map((item) => `- ${item.candidateAnswerHash}: ${item.wrongUseCount}`)
      : ["- none"]),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function loadPublicJson(path, label) {
  assert.ok(path, `${label} path is required`);
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, label);
  return JSON.parse(text);
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, privateTagPattern, `${label} contains private tags`);
  assert.doesNotMatch(text, /\b(question|answer|content|memory|transcript|prompt|rawText)"\s*:/i, `${label} contains raw text fields`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      parsed[camelCaseFlag(arg.slice(2, eq))] = arg.slice(eq + 1);
      continue;
    }
    const key = camelCaseFlag(arg.slice(2));
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function resolveInputPath(input) {
  if (!input) return null;
  const value = String(input);
  return value.startsWith("/") ? value : resolve(root, value);
}

function relativeEvidencePath(path) {
  const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(normalizedRoot) ? path.slice(normalizedRoot.length) : basename(path);
}

function normalizeHashId(value) {
  return String(value ?? "").replace(/^sha256:/, "");
}

function camelCaseFlag(value) {
  return String(value).replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function displayPath(path) {
  return basename(String(path ?? ""));
}
