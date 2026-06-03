import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const inputPaths = parseInputPaths(args.input);
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(inputPaths.length >= 2, "--input must include at least two comma-separated method-ladder reports");

const loadedReports = inputPaths.map(loadReport).sort((left, right) => shardStart(left.json) - shardStart(right.json));
const combined = combineReports(loadedReports);
const jsonText = `${JSON.stringify(combined, null, 2)}\n`;
const markdownText = `${renderMarkdown(combined)}\n`;
assertSafePublicText(jsonText, "combined answer-quality method-ladder report");
assertSafePublicText(markdownText, "combined answer-quality method-ladder markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function loadReport(path) {
  const absolutePath = resolve(root, path);
  assert.ok(existsSync(absolutePath), `input report does not exist: ${path}`);
  assert.ok(statSync(absolutePath).size > 0, `input report is empty: ${path}`);
  const text = readFileSync(absolutePath, "utf8");
  assertSafePublicText(text, `input report ${path}`);
  const json = JSON.parse(text);
  assertReportShape(json, path);
  return {
    path: relative(root, absolutePath),
    hash: `sha256:${sha256(text)}`,
    json,
  };
}

function assertReportShape(report, path) {
  assert.equal(report?.mode, "answer-quality-memory-method-ladder", `${path} is not a method-ladder answer-quality report`);
  assert.equal(report?.ok, true, `${path} is not ok`);
  assert.equal(report?.publicSafe, true, `${path} is not public safe`);
  assert.equal(report?.metricsOnly, true, `${path} is not metrics-only`);
  assert.equal(report?.fixtureOnly, false, `${path} is fixture-only`);
  assert.equal(report?.executeRequested, true, `${path} did not request answer-quality execution`);
  assert.equal(report?.memoryBenchAnswerQuality, true, `${path} is not answer-quality scored`);
  assert.equal(report?.retrievalProxyOnly, false, `${path} is retrieval-proxy-only`);
  assert.equal(report?.publicBenchmarkClaimsAllowed, false, `${path} enables public benchmark claims`);
  assert.equal(report?.rawQuestionsIncluded, false, `${path} includes raw questions`);
  assert.equal(report?.rawAnswersIncluded, false, `${path} includes raw answers`);
  assert.equal(report?.rawMemoryIncluded, false, `${path} includes raw memory`);
  assert.equal(report?.rawTranscriptIncluded, false, `${path} includes raw transcripts`);
  assert.equal(report?.rawPrivateOutputPathIncluded, false, `${path} includes a raw private output path`);
  assert.equal(report?.printsCredentials, false, `${path} prints credentials`);
  assert.equal(report?.queryShard?.sameRawQuerySelectionAcrossMethods, true, `${path} is not same-query across methods`);
  assert.ok(typeof report?.queryShard?.selectedQuestionIdsHash === "string", `${path} is missing selected question hash`);
  assert.ok(Array.isArray(report?.answerQualityReports) && report.answerQualityReports.length >= 2, `${path} has too few method rows`);
  assert.ok(Number.isInteger(shardStart(report)) && Number.isInteger(shardEnd(report)), `${path} has invalid shard bounds`);
  assert.ok(shardEnd(report) > shardStart(report), `${path} has an empty shard`);
}

function combineReports(reports) {
  const first = reports[0].json;
  for (const report of reports.slice(1)) {
    assert.equal(report.json.benchmark, first.benchmark, "input reports must share a benchmark");
    assert.equal(report.json.claimScope, first.claimScope, "input reports must share claim scope");
    assert.equal(report.json.modelMatchPolicy, first.modelMatchPolicy, "input reports must share model match policy");
    assert.equal(report.json.contextTokenBudget, first.contextTokenBudget, "input reports must share context token budget");
    assert.equal(report.json.limit, first.limit, "input reports must share retrieval limit");
    assert.equal(report.json.continueOnCallError, first.continueOnCallError, "input reports must share call-error policy");
  }

  assertContiguous(reports);
  const commonMethods = commonOrderedValues(
    methodsFromReport(first),
    reports.map((report) => new Set(methodsFromReport(report.json))),
  );
  assert.ok(commonMethods.length >= 2, "combined method ladder must retain at least two methods present in every shard");

  const commonStrategiesByMethod = Object.fromEntries(commonMethods.map((method) => {
    const firstRow = rowForMethod(first, method);
    const strategies = commonOrderedValues(
      strategiesFromRow(firstRow),
      reports.map((report) => new Set(strategiesFromRow(rowForMethod(report.json, method)))),
    );
    assert.ok(strategies.length > 0, `method ${method} has no strategy present in every shard`);
    return [method, strategies];
  }));

  const answerQualityReports = commonMethods.map((method) => {
    const rows = reports.map((report) => rowForMethod(report.json, method));
    const strategies = commonStrategiesByMethod[method].map((strategy) => {
      const sourceArms = rows.map((row) => strategyForRow(row, strategy));
      return combineStrategyArms(strategy, sourceArms);
    });
    const winner = [...strategies]
      .sort((left, right) => Number(right.answerQuality) - Number(left.answerQuality) || left.strategy.localeCompare(right.strategy))[0];
    const callsMade = rows.reduce((sum, row) => sum + Number(row.callsMade ?? 0), 0);
    const row = {
      method,
      reportHash: null,
      readyForEndToEndMemoryScoreGate: rows.every((item) => item.readyForEndToEndMemoryScoreGate !== false),
      claimScope: first.claimScope,
      modelMatchPolicy: first.modelMatchPolicy,
      countsAsLocalFullBenchmarkEvidence: false,
      countsAsModelChallengerBenchmarkEvidence: first.claimScope === "model-challenger",
      callsMade,
      endpointLabel: sameValue(rows.map((item) => item.endpointLabel)) ?? first.readiness?.endpointLabel ?? null,
      winner: stripStrategyForWinner(winner),
      metrics: metricsFromWinner(winner),
      strategies,
      privacyLeakCount: rows.reduce((sum, item) => sum + Number(item.privacyLeakCount ?? 0), 0),
      redactionFailureCount: rows.reduce((sum, item) => sum + Number(item.redactionFailureCount ?? 0), 0),
    };
    row.reportHash = `sha256:${sha256(JSON.stringify({ method: row.method, callsMade: row.callsMade, winner: row.winner, strategies: row.strategies }))}`;
    return row;
  });

  const winner = [...answerQualityReports]
    .sort((left, right) => Number(right.winner?.answerQuality) - Number(left.winner?.answerQuality) || left.method.localeCompare(right.method))[0];
  const combinedStart = shardStart(reports[0].json);
  const combinedEnd = shardEnd(reports.at(-1).json);
  const selectedQuestionIdsHash = `sha256:${sha256(reports.map((report) => report.json.queryShard.selectedQuestionIdsHash).join("\n"))}`;

  return {
    schemaVersion: 1,
    ok: true,
    mode: "answer-quality-memory-method-ladder",
    combineMode: "contiguous-query-shard-answer-quality-union",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    retrievalProxyOnly: false,
    memoryBenchAnswerQuality: true,
    publicBenchmarkClaimsAllowed: false,
    rawQuestionIdsIncluded: false,
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPrivateOutputPathIncluded: false,
    printsCredentials: false,
    benchmark: first.benchmark,
    fixtureOnly: false,
    executeRequested: true,
    readyForExecution: reports.every((report) => report.json.readyForExecution === true),
    readiness: {
      ready: reports.every((report) => report.json.readiness?.ready === true),
      blockers: [],
      callsAllowed: reports.every((report) => report.json.readiness?.callsAllowed === true),
      publicDataConfirmed: reports.every((report) => report.json.readiness?.publicDataConfirmed === true),
      noRawOutputGuard: reports.every((report) => report.json.readiness?.noRawOutputGuard === true),
      endpointLabel: sameValue(reports.map((report) => report.json.readiness?.endpointLabel)) ?? null,
    },
    claimBoundary: "combined contiguous same-data answer-quality method diagnostic; not production or SOTA evidence without the normal gates",
    claimScope: first.claimScope,
    modelMatchPolicy: first.modelMatchPolicy,
    queryShard: {
      startIndex: combinedStart,
      endIndexExclusive: combinedEnd,
      requestedLimit: reports.reduce((sum, report) => sum + Number(report.json.queryShard?.requestedLimit ?? queryCount(report.json)), 0),
      sameRawQuerySelectionAcrossMethods: true,
      selectedQuestionIdsHash,
      sourceShardCount: reports.length,
      sourceShardSelectedQuestionIdsHashes: reports.map((report) => report.json.queryShard.selectedQuestionIdsHash),
    },
    contextTokenBudget: first.contextTokenBudget,
    limit: first.limit,
    continueOnCallError: first.continueOnCallError,
    methods: commonMethods,
    strategies: commonOrderedValues(first.strategies ?? [], reports.map((report) => new Set(report.json.strategies ?? []))),
    droppedMethods: methodsFromReport(first).filter((method) => !commonMethods.includes(method)),
    sourceReports: reports.map((report) => ({
      path: report.path,
      hash: report.hash,
      queryShard: report.json.queryShard,
      methods: methodsFromReport(report.json),
    })),
    winner: {
      method: winner.method,
      reportHash: winner.reportHash,
      readyForEndToEndMemoryScoreGate: winner.readyForEndToEndMemoryScoreGate,
      claimScope: winner.claimScope,
      modelMatchPolicy: winner.modelMatchPolicy,
      countsAsLocalFullBenchmarkEvidence: winner.countsAsLocalFullBenchmarkEvidence,
      countsAsModelChallengerBenchmarkEvidence: winner.countsAsModelChallengerBenchmarkEvidence,
      callsMade: winner.callsMade,
      endpointLabel: winner.endpointLabel,
      winner: winner.winner,
      metrics: winner.metrics,
      strategies: winner.strategies,
    },
    answerQualityReports,
  };
}

function combineStrategyArms(strategy, arms) {
  const resultFingerprints = arms.flatMap((arm) => normalizeFingerprints(arm.resultFingerprints));
  assertNoDuplicateQueryIds(strategy, resultFingerprints);
  const scoreValues = resultFingerprints.map((item) => Number(item.score)).filter(Number.isFinite);
  const correctValues = resultFingerprints.map((item) => item.correct).filter((item) => typeof item === "boolean");
  const elapsedValues = resultFingerprints.map((item) => Number(item.elapsedMs)).filter(Number.isFinite);
  const contextTokenValues = resultFingerprints.map((item) => Number(item.contextTokens)).filter(Number.isFinite);
  const answerFailures = arms.reduce((sum, arm) => sum + Number(arm.answerFailures ?? 0), 0);
  const judgeFailures = arms.reduce((sum, arm) => sum + Number(arm.judgeFailures ?? 0), 0);
  return {
    strategy,
    answerQuality: round(average(scoreValues)),
    judgeCorrectRate: correctValues.length ? round(correctValues.filter(Boolean).length / correctValues.length) : null,
    answerLatencyP50Ms: percentile(elapsedValues, 0.5),
    answerLatencyP95Ms: percentile(elapsedValues, 0.95),
    contextTokensAvg: contextTokenValues.length ? Math.round(average(contextTokenValues)) : null,
    answerFailures,
    judgeFailures,
    resultFingerprints,
  };
}

function normalizeFingerprints(items) {
  assert.ok(Array.isArray(items), "strategy is missing result fingerprints");
  return items.map((item) => {
    assert.ok(typeof item?.queryIdHash === "string", "fingerprint is missing query id hash");
    assert.ok(Number.isFinite(Number(item?.score)), "fingerprint is missing numeric score");
    return {
      queryIdHash: item.queryIdHash,
      queryHash: typeof item.queryHash === "string" ? item.queryHash : null,
      candidateAnswerHash: typeof item.candidateAnswerHash === "string" ? item.candidateAnswerHash : null,
      judgeDecisionHash: typeof item.judgeDecisionHash === "string" ? item.judgeDecisionHash : null,
      contextResultCount: nullableNumber(item.contextResultCount),
      responseTotal: nullableNumber(item.responseTotal),
      elapsedMs: nullableNumber(item.elapsedMs),
      contextTokens: nullableNumber(item.contextTokens),
      score: nullableNumber(item.score),
      correct: typeof item.correct === "boolean" ? item.correct : null,
    };
  });
}

function stripStrategyForWinner(strategy) {
  return {
    strategy: strategy.strategy,
    answerQuality: strategy.answerQuality,
    judgeCorrectRate: strategy.judgeCorrectRate,
    answerLatencyP50Ms: strategy.answerLatencyP50Ms,
  };
}

function metricsFromWinner(strategy) {
  return {
    answerQuality: strategy.answerQuality,
    memoryScore: strategy.answerQuality,
    longmemevalScore: strategy.answerQuality,
    quality: round(Number(strategy.answerQuality) / 100),
    judgeCorrectRate: strategy.judgeCorrectRate,
    answerLatencyP50Ms: strategy.answerLatencyP50Ms,
    answerLatencyP95Ms: strategy.answerLatencyP95Ms,
    contextTokensAvg: strategy.contextTokensAvg,
  };
}

function assertContiguous(reports) {
  for (let index = 1; index < reports.length; index += 1) {
    const previousEnd = shardEnd(reports[index - 1].json);
    const currentStart = shardStart(reports[index].json);
    assert.equal(currentStart, previousEnd, `input shards must be contiguous; expected start ${previousEnd}, got ${currentStart}`);
  }
}

function assertNoDuplicateQueryIds(strategy, fingerprints) {
  const seen = new Set();
  for (const fingerprint of fingerprints) {
    assert.ok(!seen.has(fingerprint.queryIdHash), `duplicate query id in combined strategy ${strategy}: ${fingerprint.queryIdHash}`);
    seen.add(fingerprint.queryIdHash);
  }
}

function methodsFromReport(report) {
  const reportMethods = Array.isArray(report.methods) ? report.methods : [];
  const rowMethods = report.answerQualityReports.map((item) => item.method);
  return reportMethods.length ? reportMethods.filter((method) => rowMethods.includes(method)) : rowMethods;
}

function strategiesFromRow(row) {
  return Array.isArray(row?.strategies) ? row.strategies.map((item) => item.strategy).filter(Boolean) : [];
}

function commonOrderedValues(firstValues, sets) {
  return firstValues.filter((value) => sets.every((set) => set.has(value)));
}

function rowForMethod(report, method) {
  const row = report.answerQualityReports.find((item) => item.method === method);
  assert.ok(row, `report is missing method ${method}`);
  return row;
}

function strategyForRow(row, strategy) {
  const arm = row.strategies.find((item) => item.strategy === strategy);
  assert.ok(arm, `method ${row.method} is missing strategy ${strategy}`);
  return arm;
}

function queryCount(report) {
  return shardEnd(report) - shardStart(report);
}

function shardStart(report) {
  return Number(report?.queryShard?.startIndex);
}

function shardEnd(report) {
  return Number(report?.queryShard?.endIndexExclusive);
}

function sameValue(values) {
  const present = values.filter((value) => value != null);
  if (!present.length) return null;
  return present.every((value) => value === present[0]) ? present[0] : null;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
}

function percentile(values, quantile) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * quantile)));
  return sorted[index];
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function renderMarkdown(value) {
  const lines = [
    "# Combined Answer-Quality Method Ladder",
    "",
    `- Mode: ${value.combineMode}`,
    `- Query range: ${value.queryShard.startIndex}-${value.queryShard.endIndexExclusive}`,
    `- Source shard count: ${value.queryShard.sourceShardCount}`,
    `- Methods retained: ${value.methods.join(", ")}`,
    `- Methods dropped without full coverage: ${value.droppedMethods.join(", ") || "none"}`,
    `- Winner: ${value.winner.method}:${value.winner.winner.strategy}:${value.winner.winner.answerQuality}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    "",
    "## Source Shards",
    "",
    "| Path | Range | Hash |",
    "| --- | ---: | --- |",
    ...value.sourceReports.map((item) => `| ${item.path} | ${item.queryShard.startIndex}-${item.queryShard.endIndexExclusive} | ${item.hash} |`),
    "",
    "## Method Rows",
    "",
    "| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...value.answerQualityReports.map((row) => {
      const answerFailures = row.strategies.reduce((sum, item) => sum + Number(item.answerFailures ?? 0), 0);
      const judgeFailures = row.strategies.reduce((sum, item) => sum + Number(item.judgeFailures ?? 0), 0);
      return `| ${row.method} | ${row.winner.strategy} | ${row.winner.answerQuality} | ${row.callsMade} | ${answerFailures} | ${judgeFailures} |`;
    }),
  ];
  return lines.join("\n");
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

function parseInputPaths(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
