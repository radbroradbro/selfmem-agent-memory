import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const resultPath = args.result ? resolve(root, args.result) : null;
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const baselineMethod = String(args.baselineMethod ?? "session-v1");
const minDelta = Number(args.minDelta ?? 1);
const maxWinnerArmFailures = Number(args.maxWinnerArmFailures ?? 0);
const maxTotalFailureRate = Number(args.maxTotalFailureRate ?? 0.01);
const requirePairedBootstrap = Boolean(args.requirePairedBootstrap);
const minPairedMeanDelta = Number(args.minPairedMeanDelta ?? minDelta);
const minPairedBootstrapLowerBound = Number(args.minPairedBootstrapLowerBound ?? 0);
const pairedBootstrapSamples = positiveInt(args.pairedBootstrapSamples ?? 1000, "--paired-bootstrap-samples");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(Number.isFinite(minDelta), "--min-delta must be numeric");
assert.ok(Number.isFinite(maxWinnerArmFailures) && maxWinnerArmFailures >= 0, "--max-winner-arm-failures must be a non-negative number");
assert.ok(Number.isFinite(maxTotalFailureRate) && maxTotalFailureRate >= 0, "--max-total-failure-rate must be a non-negative number");
assert.ok(Number.isFinite(minPairedMeanDelta), "--min-paired-mean-delta must be numeric");
assert.ok(Number.isFinite(minPairedBootstrapLowerBound), "--min-paired-bootstrap-lower-bound must be numeric");

const loaded = loadResult();
const report = buildGateReport({ loaded });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "answer-quality method-ladder result gate");
assertSafePublicText(markdownText, "answer-quality method-ladder result gate markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_ANSWER_QUALITY_METHOD_LADDER_CHALLENGER") process.exit(1);

function loadResult() {
  if (!resultPath || !existsSync(resultPath)) {
    return {
      source: "missing-result",
      exists: false,
      hash: null,
      json: null,
    };
  }
  assert.ok(statSync(resultPath).size > 0, "result file is empty");
  const text = readFileSync(resultPath, "utf8");
  assertSafePublicText(text, "method-ladder result");
  return {
    source: "result-file",
    exists: true,
    hash: `sha256:${sha256(text)}`,
    json: JSON.parse(text),
  };
}

function buildGateReport({ loaded }) {
  const result = loaded.json;
  const rows = Array.isArray(result?.answerQualityReports) ? result.answerQualityReports.map(normalizeMethodRow) : [];
  const baseline = rows.find((item) => item.method === baselineMethod) ?? null;
  const challengers = rows.filter((item) => item.method !== baselineMethod);
  const bestOverall = bestByScore(rows);
  const bestChallenger = bestByScore(challengers);
  const winningArm = bestChallenger ? armByName(bestChallenger, bestChallenger.winnerStrategy) : null;
  const baselineScore = Number(baseline?.answerQuality ?? NaN);
  const challengerScore = Number(bestChallenger?.answerQuality ?? NaN);
  const deltaVsBaseline = Number.isFinite(baselineScore) && Number.isFinite(challengerScore)
    ? round(challengerScore - baselineScore)
    : null;
  const totalCalls = rows.reduce((sum, item) => sum + Number(item.callsMade ?? 0), 0);
  const totalFailures = rows.reduce((sum, item) => sum + item.answerFailures + item.judgeFailures, 0);
  const totalAttempts = totalCalls + totalFailures;
  const totalFailureRate = totalAttempts > 0 ? round(totalFailures / totalAttempts, 6) : null;
  const winnerArmFailures = Number(winningArm?.answerFailures ?? 0) + Number(winningArm?.judgeFailures ?? 0);
  const pairedBootstrap = buildPairedBootstrapComparison({
    baseline,
    challenger: bestChallenger,
    samples: pairedBootstrapSamples,
  });

  const checks = {
    resultExists: loaded.exists,
    modeRecognized: result?.mode === "answer-quality-memory-method-ladder",
    metricsOnly: result?.metricsOnly === true,
    publicSafe: result?.publicSafe === true,
    fixtureOnlyFalse: result?.fixtureOnly === false,
    executeRequested: result?.executeRequested === true,
    answerQualityMode: result?.memoryBenchAnswerQuality === true && result?.retrievalProxyOnly === false,
    publicClaimsDisabled: result?.publicBenchmarkClaimsAllowed === false,
    rawQuestionsExcluded: result?.rawQuestionsIncluded === false,
    rawAnswersExcluded: result?.rawAnswersIncluded === false,
    rawMemoryExcluded: result?.rawMemoryIncluded === false,
    rawTranscriptExcluded: result?.rawTranscriptIncluded === false,
    sameRawQuerySelection: result?.queryShard?.sameRawQuerySelectionAcrossMethods === true,
    querySelectionHashPresent: typeof result?.queryShard?.selectedQuestionIdsHash === "string" && result.queryShard.selectedQuestionIdsHash.startsWith("sha256:"),
    baselinePresent: Boolean(baseline),
    challengerPresent: Boolean(bestChallenger),
    challengerBeatsBaseline: Number.isFinite(Number(deltaVsBaseline)) && Number(deltaVsBaseline) >= minDelta,
    bestOverallIsChallenger: Boolean(bestOverall && bestChallenger && bestOverall.method === bestChallenger.method),
    winnerArmFailureLimit: winnerArmFailures <= maxWinnerArmFailures,
    totalFailureRateLimit: totalFailureRate != null && totalFailureRate <= maxTotalFailureRate,
    privacyLeakCountersClear: rows.every((item) => item.privacyLeakCount === 0 && item.redactionFailureCount === 0),
    pairedBootstrapAvailable: !requirePairedBootstrap || pairedBootstrap.available,
    pairedBootstrapMeanDelta: !requirePairedBootstrap || Number(pairedBootstrap.meanDelta ?? -Infinity) >= minPairedMeanDelta,
    pairedBootstrapLowerBound: !requirePairedBootstrap || Number(pairedBootstrap.lowerBound95 ?? -Infinity) >= minPairedBootstrapLowerBound,
  };

  const blockers = [
    !checks.resultExists ? "missing-method-ladder-result" : null,
    !checks.modeRecognized ? "result-not-answer-quality-method-ladder" : null,
    !checks.metricsOnly ? "result-not-metrics-only" : null,
    !checks.publicSafe ? "result-not-public-safe" : null,
    !checks.fixtureOnlyFalse ? "fixture-result-cannot-count-as-live-method-ladder" : null,
    !checks.executeRequested ? "answer-quality-execution-not-requested" : null,
    !checks.answerQualityMode ? "result-not-answer-quality-scored" : null,
    !checks.publicClaimsDisabled ? "public-claims-enabled-before-full-memory-review" : null,
    !checks.rawQuestionsExcluded ? "raw-questions-included" : null,
    !checks.rawAnswersExcluded ? "raw-answers-included" : null,
    !checks.rawMemoryExcluded ? "raw-memory-included" : null,
    !checks.rawTranscriptExcluded ? "raw-transcript-included" : null,
    !checks.sameRawQuerySelection ? "methods-not-scored-on-same-query-selection" : null,
    !checks.querySelectionHashPresent ? "missing-query-selection-hash" : null,
    !checks.baselinePresent ? "baseline-method-missing" : null,
    !checks.challengerPresent ? "challenger-method-missing" : null,
    !checks.challengerBeatsBaseline ? "best-challenger-does-not-clear-baseline-delta" : null,
    !checks.bestOverallIsChallenger ? "best-overall-method-is-still-baseline" : null,
    !checks.winnerArmFailureLimit ? "winning-arm-has-too-many-call-failures" : null,
    !checks.totalFailureRateLimit ? "total-call-failure-rate-too-high" : null,
    !checks.privacyLeakCountersClear ? "privacy-or-redaction-counter-nonzero" : null,
    !checks.pairedBootstrapAvailable ? "paired-bootstrap-fingerprints-missing" : null,
    !checks.pairedBootstrapMeanDelta ? "paired-bootstrap-mean-delta-below-threshold" : null,
    !checks.pairedBootstrapLowerBound ? "paired-bootstrap-lower-bound-below-threshold" : null,
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    ok: true,
    mode: "answer-quality-method-ladder-result-gate",
    status: blockers.length === 0
      ? "READY_ANSWER_QUALITY_METHOD_LADDER_CHALLENGER"
      : "BLOCKED_ANSWER_QUALITY_METHOD_LADDER_RESULT",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    publicBenchmarkClaimsAllowed: false,
    countsAsMethodLadderEvidence: blockers.length === 0,
    countsAsFullMemorySotaEvidence: false,
    reason:
      blockers.length === 0
        ? "Same-shard answer-quality method ladder shows a non-session challenger beating the session baseline under failure-accounted scoring; full memory/SOTA claims still require the remaining gates."
        : "Method-ladder result is missing, unsafe, unscored, not same-shard, or does not prove a challenger over the session baseline.",
    thresholds: {
      baselineMethod,
      minDelta,
      maxWinnerArmFailures,
      maxTotalFailureRate,
      requirePairedBootstrap,
      minPairedMeanDelta,
      minPairedBootstrapLowerBound,
      pairedBootstrapSamples,
    },
    result: {
      source: loaded.source,
      hash: loaded.hash,
      fixtureOnly: Boolean(result?.fixtureOnly),
      mode: result?.mode ?? null,
      benchmark: result?.benchmark ?? null,
      claimScope: result?.claimScope ?? null,
      modelMatchPolicy: result?.modelMatchPolicy ?? null,
      queryShard: result?.queryShard ?? null,
      continueOnCallError: result?.continueOnCallError ?? null,
      methodCount: rows.length,
      totalCalls,
      totalFailures,
      totalFailureRate,
    },
    baseline,
    bestChallenger,
    bestOverall,
    comparison: {
      deltaVsBaseline,
      winnerArmFailures,
      winningArm: winningArm
        ? {
            strategy: winningArm.strategy,
            answerQuality: winningArm.answerQuality,
            judgeCorrectRate: winningArm.judgeCorrectRate,
            answerFailures: winningArm.answerFailures,
            judgeFailures: winningArm.judgeFailures,
          }
        : null,
      pairedBootstrap,
    },
    rows,
    checks,
    blockers,
    nextActions: blockers.length
      ? [
          "Re-run the method ladder with the same raw query selection, answer-quality execution enabled, and failure accounting enabled.",
          "Keep session-v1 as the baseline and require the challenger winner to beat it before promoting any materializer.",
          "Do not attach this result to public SOTA claims until the standard full-memory gates pass.",
        ]
      : [
          `Use ${bestChallenger.method} with ${bestChallenger.winnerStrategy} as the next larger-slice challenger.`,
          "Carry session-v1, BM25, and full-hybrid controls forward so the next slice can confirm or reject this lift.",
          "Attach this gate report to the SOTA ladder packet as method-selection evidence only.",
        ],
  };
}

function normalizeMethodRow(item) {
  const strategies = Array.isArray(item.strategies) ? item.strategies.map((strategy) => ({
    strategy: strategy.strategy ?? null,
    answerQuality: nullableNumber(strategy.answerQuality),
    judgeCorrectRate: nullableNumber(strategy.judgeCorrectRate),
    answerLatencyP50Ms: nullableNumber(strategy.answerLatencyP50Ms),
    answerFailures: Number(strategy.answerFailures ?? 0),
    judgeFailures: Number(strategy.judgeFailures ?? 0),
    resultFingerprints: normalizeResultFingerprints(strategy.resultFingerprints),
  })) : [];
  return {
    method: item.method ?? null,
    winnerStrategy: item.winner?.strategy ?? null,
    answerQuality: nullableNumber(item.winner?.answerQuality),
    judgeCorrectRate: nullableNumber(item.winner?.judgeCorrectRate),
    callsMade: Number(item.callsMade ?? 0),
    answerFailures: strategies.reduce((sum, strategy) => sum + strategy.answerFailures, 0),
    judgeFailures: strategies.reduce((sum, strategy) => sum + strategy.judgeFailures, 0),
    privacyLeakCount: Number(item.privacyLeakCount ?? 0),
    redactionFailureCount: Number(item.redactionFailureCount ?? 0),
    strategies,
  };
}

function bestByScore(rows) {
  return [...rows]
    .filter((item) => item.method && Number.isFinite(Number(item.answerQuality)))
    .sort((left, right) => Number(right.answerQuality) - Number(left.answerQuality))[0] ?? null;
}

function armByName(row, strategyName) {
  return row?.strategies?.find((item) => item.strategy === strategyName) ?? null;
}

function buildPairedBootstrapComparison({ baseline, challenger, samples }) {
  const baselineArm = armByName(baseline, baseline?.winnerStrategy);
  const challengerArm = armByName(challenger, challenger?.winnerStrategy);
  const baselineFingerprints = Array.isArray(baselineArm?.resultFingerprints) ? baselineArm.resultFingerprints : [];
  const challengerFingerprints = Array.isArray(challengerArm?.resultFingerprints) ? challengerArm.resultFingerprints : [];
  const challengerByQuery = new Map(challengerFingerprints.map((item) => [item.queryIdHash, item]));
  const deltas = [];
  for (const baselineItem of baselineFingerprints) {
    const challengerItem = challengerByQuery.get(baselineItem.queryIdHash);
    if (!challengerItem) continue;
    if (!Number.isFinite(baselineItem.score) || !Number.isFinite(challengerItem.score)) continue;
    deltas.push(round(challengerItem.score - baselineItem.score));
  }
  if (deltas.length === 0) {
    return {
      required: requirePairedBootstrap,
      available: false,
      baselineFingerprintCount: baselineFingerprints.length,
      challengerFingerprintCount: challengerFingerprints.length,
      commonQueryCount: 0,
      meanDelta: null,
      lowerBound95: null,
      upperBound95: null,
    };
  }
  const means = [];
  const random = deterministicRandom(`${baseline?.method ?? "baseline"}:${challenger?.method ?? "challenger"}:${deltas.join(",")}`);
  for (let sample = 0; sample < samples; sample += 1) {
    let sum = 0;
    for (let index = 0; index < deltas.length; index += 1) {
      sum += deltas[Math.floor(random() * deltas.length)];
    }
    means.push(sum / deltas.length);
  }
  means.sort((left, right) => left - right);
  return {
    required: requirePairedBootstrap,
    available: true,
    baselineFingerprintCount: baselineFingerprints.length,
    challengerFingerprintCount: challengerFingerprints.length,
    commonQueryCount: deltas.length,
    meanDelta: round(average(deltas)),
    lowerBound95: round(means[Math.floor(0.025 * (means.length - 1))]),
    upperBound95: round(means[Math.ceil(0.975 * (means.length - 1))]),
    minMeanDelta: minPairedMeanDelta,
    minLowerBound: minPairedBootstrapLowerBound,
  };
}

function normalizeResultFingerprints(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      queryIdHash: typeof item?.queryIdHash === "string" ? item.queryIdHash : null,
      score: nullableNumber(item?.score),
      correct: typeof item?.correct === "boolean" ? item.correct : null,
    }))
    .filter((item) => item.queryIdHash && Number.isFinite(item.score));
}

function deterministicRandom(seedText) {
  let seed = Number.parseInt(sha256(seedText).slice(0, 8), 16) || 1;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function renderMarkdown(value) {
  const lines = [
    "# Answer-Quality Method-Ladder Result Gate",
    "",
    `- Status: ${value.status}`,
    `- Counts as method-ladder evidence: ${value.countsAsMethodLadderEvidence}`,
    `- Counts as full-memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Baseline: ${value.thresholds.baselineMethod}`,
    `- Minimum challenger delta: ${value.thresholds.minDelta}`,
    `- Total failure rate: ${value.result.totalFailureRate}`,
    `- Reason: ${value.reason}`,
    "",
    "## Comparison",
    "",
    "| Role | Method | Winner | Answer quality | Correct rate |",
    "| --- | --- | --- | ---: | ---: |",
    rowLine("Baseline", value.baseline),
    rowLine("Best challenger", value.bestChallenger),
    rowLine("Best overall", value.bestOverall),
    "",
    `- Delta vs baseline: ${value.comparison.deltaVsBaseline}`,
    `- Winning arm failures: ${value.comparison.winnerArmFailures}`,
    `- Paired bootstrap available: ${value.comparison.pairedBootstrap.available}`,
    `- Paired bootstrap mean delta: ${value.comparison.pairedBootstrap.meanDelta}`,
    `- Paired bootstrap 95% lower bound: ${value.comparison.pairedBootstrap.lowerBound95}`,
    "",
    "## Method Rows",
    "",
    "| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...value.rows.map((item) => `| ${item.method} | ${item.winnerStrategy} | ${item.answerQuality} | ${item.callsMade} | ${item.answerFailures} | ${item.judgeFailures} |`),
    "",
    "## Blockers",
    "",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    "",
    ...value.nextActions.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function rowLine(label, row) {
  if (!row) return `| ${label} | missing | missing | n/a | n/a |`;
  return `| ${label} | ${row.method} | ${row.winnerStrategy} | ${row.answerQuality} | ${row.judgeCorrectRate} |`;
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function assertSafePublicText(value, label) {
  assert.doesNotMatch(value, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(value, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(value, privateTagPattern, `${label} contains private tags`);
}

function writeOutput(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, { encoding: "utf8", mode: 0o600 });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}
