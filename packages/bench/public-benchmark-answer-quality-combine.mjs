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
const requestedCombineMode = args.combineMode ? String(args.combineMode) : null;
const fingerprintPolicy = String(args.fingerprints ?? args.fingerprintPolicy ?? "digest").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(!requestedCombineMode || ["same-data", "shards"].includes(requestedCombineMode), "--combine-mode must be same-data or shards");
assert.ok(["digest", "include", "omit"].includes(fingerprintPolicy), "--fingerprints must be digest, include, or omit");
assert.ok(inputs.length >= 2, "at least two answer-quality inputs are required");

const loaded = inputs.map(loadAnswerQualityResult);
const combineMode = requestedCombineMode ?? autoCombineMode(loaded);
if (combineMode === "same-data") assertSameData(loaded);
else assertShardData(loaded);
const combined = applyFingerprintPolicy(
  combineMode === "same-data" ? buildCombinedReport(loaded) : buildShardCombinedReport(loaded),
  fingerprintPolicy,
);
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

function autoCombineMode(items) {
  const ranges = items.map((item) => shardRange(item.json));
  const first = ranges[0];
  const sameRange = ranges.every(
    (range) => range.startIndex === first.startIndex && range.endIndexExclusive === first.endIndexExclusive && range.totalQueryCount === first.totalQueryCount,
  );
  return sameRange ? "same-data" : "shards";
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

function assertShardData(items) {
  assertSameTargetAndModels(items);
  const first = items[0].json;
  const firstStrategies = strategyNames(first);
  assert.ok(firstStrategies.length > 0, "first shard must include strategies");
  const ranges = items.map((item) => ({ ...shardRange(item.json), path: item.path }));
  for (const item of items) {
    const names = strategyNames(item.json);
    assert.deepEqual(names, firstStrategies, "all query shards must include the same strategy set");
    const range = shardRange(item.json);
    assert.equal(range.scoredQueryCount, range.endIndexExclusive - range.startIndex, "shard scored-query count must match shard range");
  }
  const sorted = [...ranges].sort((left, right) => left.startIndex - right.startIndex || left.endIndexExclusive - right.endIndexExclusive);
  let expectedStart = 0;
  for (const range of sorted) {
    assert.equal(range.startIndex, expectedStart, `query shard coverage gap or overlap before ${range.path}`);
    expectedStart = range.endIndexExclusive;
  }
  assert.equal(expectedStart, sorted[0].totalQueryCount, "query shard coverage must reach total query count");
  const shardHashes = new Set(ranges.map((range) => range.selectedQueryIdHash).filter(Boolean));
  assert.equal(shardHashes.size, ranges.length, "query shards must have unique selected-query hashes");
}

function assertSameTargetAndModels(items) {
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
      endpointIsLocal: items.every((item) => item.json.provider?.endpointIsLocal === true),
    },
    scoringPolicy: combineScoringPolicy(items),
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

function buildShardCombinedReport(items) {
  const first = items[0].json;
  const ranges = items.map((item) => ({ ...shardRange(item.json), path: item.path, hash: item.hash }));
  const sortedItems = [...items].sort((left, right) => shardRange(left.json).startIndex - shardRange(right.json).startIndex);
  const strategies = strategyNames(first).map((strategy) => mergeShardStrategy(strategy, sortedItems));
  const winner = bestByAnswerQuality(strategies);
  const callsMade = items.reduce((sum, item) => sum + Number(item.json.provider?.callsMade ?? 0), 0);
  const coverage = {
    complete: true,
    inputShardCount: items.length,
    totalQueryCount: ranges[0].totalQueryCount,
    scoredQueryCount: ranges.reduce((sum, range) => sum + range.scoredQueryCount, 0),
    ranges: ranges
      .sort((left, right) => left.startIndex - right.startIndex)
      .map((range) => ({
        startIndex: range.startIndex,
        endIndexExclusive: range.endIndexExclusive,
        scoredQueryCount: range.scoredQueryCount,
        selectedQueryIdHash: range.selectedQueryIdHash,
      })),
  };
  return {
    schemaVersion: 1,
    ok: true,
    mode: "public-benchmark-answer-quality",
    combineMode: "query-shard-answer-quality-union",
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
      queryCount: coverage.totalQueryCount,
      totalQueryCount: coverage.totalQueryCount,
      scoredQueryCount: coverage.scoredQueryCount,
      queryOffset: 0,
      queryLimit: coverage.totalQueryCount,
      scoredQueryStart: 0,
      scoredQueryEndExclusive: coverage.totalQueryCount,
      queryShard: {
        combined: true,
        completeDataset: true,
        ...coverage,
      },
    },
    sourceLock: {
      sameDataAttestation: true,
      sameAnswerModel: true,
      sameJudgeModel: true,
      inputResultCount: items.length,
      inputResultHashes: items.map((item) => item.hash),
      inputResultPaths: items.map((item) => item.path),
      queryShardCoverage: coverage,
    },
    provider: {
      answerModel: first.provider?.answerModel ?? null,
      judgeModel: first.provider?.judgeModel ?? null,
      answerQualityCallsAllowed: true,
      publicDataConfirmed: true,
      callsMade,
      endpointLabel: first.provider?.endpointLabel ?? null,
      endpointIsLocal: items.every((item) => item.json.provider?.endpointIsLocal === true),
    },
    scoringPolicy: combineScoringPolicy(items),
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
    privacyLeakCount: strategies.reduce((sum, strategy) => sum + Number(strategy.privacyLeakCount ?? 0), 0),
    redactionFailureCount: strategies.reduce((sum, strategy) => sum + Number(strategy.redactionFailureCount ?? 0), 0),
    safety: {
      metricsOnly: true,
      publicSafe: true,
      rawQuestionsIncluded: false,
      rawAnswersIncluded: false,
      rawMemoryIncluded: false,
      rawTranscriptIncluded: false,
      privateInputsStoredOutsideRepository: true,
      combinedFromMetricsOnlyReports: true,
      combinedFromQueryShards: true,
    },
    nextActions: [
      "Run benchmark:memory-score:result-gate with this full-coverage query-shard union.",
      "Run benchmark:sota-ladder against the same target before public benchmark wording changes.",
      "Send the exact metrics-only full-shard packet to independent reviewers before owner or production approval.",
    ],
  };
}

function mergeShardStrategy(strategy, sortedItems) {
  const rows = sortedItems.map((item) => {
    const row = (item.json.strategies ?? []).find((candidate) => candidate.strategy === strategy);
    assert.ok(row, `missing strategy ${strategy} in ${item.path}`);
    return row;
  });
  const fingerprints = rows.flatMap((row) => row.resultFingerprints ?? []);
  assert.ok(fingerprints.length > 0, `${strategy} has no result fingerprints`);
  const ids = new Set();
  const scores = [];
  const correct = [];
  const latencies = [];
  const contextTokens = [];
  for (const fingerprint of fingerprints) {
    assert.ok(fingerprint.queryIdHash, `${strategy} fingerprint missing query hash`);
    assert.ok(!ids.has(fingerprint.queryIdHash), `${strategy} has duplicate query hash across shards`);
    ids.add(fingerprint.queryIdHash);
    assert.ok(Number.isFinite(Number(fingerprint.score)), `${strategy} fingerprint missing score`);
    assert.ok(Number.isFinite(Number(fingerprint.elapsedMs)), `${strategy} fingerprint missing elapsedMs`);
    assert.ok(Number.isFinite(Number(fingerprint.contextTokens)), `${strategy} fingerprint missing contextTokens`);
    scores.push(Number(fingerprint.score));
    correct.push(fingerprint.correct ? 1 : 0);
    latencies.push(Number(fingerprint.elapsedMs));
    contextTokens.push(Number(fingerprint.contextTokens));
  }
  const sortedLatencies = latencies.sort((left, right) => left - right);
  return {
    strategy,
    metrics: {
      answerQuality: round(average(scores)),
      memoryScore: round(average(scores)),
      longmemevalScore: round(average(scores)),
      quality: round(average(scores) / 100),
      judgeCorrectRate: round(average(correct)),
      answerLatencyP50Ms: percentile(sortedLatencies, 0.5),
      answerLatencyP95Ms: percentile(sortedLatencies, 0.95),
      contextTokensAvg: Math.round(average(contextTokens)),
    },
    provider: mergeProviders(rows.map((row) => row.provider ?? {})),
    privacyLeakCount: rows.reduce((sum, row) => sum + Number(row.privacyLeakCount ?? 0), 0),
    redactionFailureCount: rows.reduce((sum, row) => sum + Number(row.redactionFailureCount ?? 0), 0),
    scoredQueryCount: fingerprints.length,
    resultFingerprints: fingerprints,
  };
}

function mergeProviders(providers) {
  return {
    answerCalls: providers.reduce((sum, provider) => sum + Number(provider.answerCalls ?? 0), 0),
    judgeCalls: providers.reduce((sum, provider) => sum + Number(provider.judgeCalls ?? 0), 0),
    answerFailures: providers.reduce((sum, provider) => sum + Number(provider.answerFailures ?? 0), 0),
    judgeFailures: providers.reduce((sum, provider) => sum + Number(provider.judgeFailures ?? 0), 0),
    callTimeoutMs: providers.find((provider) => provider.callTimeoutMs != null)?.callTimeoutMs ?? null,
    continueOnCallError: providers.some((provider) => provider.continueOnCallError === true),
    fixtureJudge: false,
  };
}

function applyFingerprintPolicy(report, policy) {
  if (policy === "include") {
    return {
      ...report,
      artifactProfile: {
        ...(report.artifactProfile ?? {}),
        fingerprintPolicy: "include",
        fullResultFingerprintsIncluded: true,
        publicSummaryPreferred: false,
      },
      safety: {
        ...(report.safety ?? {}),
        fullResultFingerprintsIncluded: true,
      },
    };
  }
  const strategies = (report.strategies ?? []).map((strategy) => compactStrategyFingerprints(strategy, policy));
  return {
    ...report,
    strategies,
    artifactProfile: {
      ...(report.artifactProfile ?? {}),
      fingerprintPolicy: policy,
      fullResultFingerprintsIncluded: false,
      publicSummaryPreferred: true,
    },
    safety: {
      ...(report.safety ?? {}),
      fullResultFingerprintsIncluded: false,
      resultFingerprintsRetainedAsDigest: policy === "digest",
    },
  };
}

function compactStrategyFingerprints(strategy, policy) {
  const fingerprints = Array.isArray(strategy.resultFingerprints) ? strategy.resultFingerprints : [];
  if (!fingerprints.length) {
    const { resultFingerprints: _unused, ...rest } = strategy;
    return rest;
  }
  const { resultFingerprints: _unused, ...rest } = strategy;
  if (policy === "omit") {
    return {
      ...rest,
      resultFingerprintCount: fingerprints.length,
    };
  }
  return {
    ...rest,
    resultFingerprintDigest: {
      count: fingerprints.length,
      hash: `sha256:${sha256(JSON.stringify(fingerprints))}`,
      fields: ["queryIdHash", "score", "correct", "elapsedMs", "contextTokens"],
      policy: "digest-only",
    },
  };
}

function combineScoringPolicy(items) {
  const first = items[0].json;
  const policies = items.map((item) => item.json.scoringPolicy ?? {});
  const claimScope = first.claimScope ?? first.scoringPolicy?.claimScope ?? "full-sota";
  const modelMatchPolicy = first.scoringPolicy?.modelMatchPolicy ?? defaultModelMatchPolicy(claimScope);
  return {
    claimScope,
    modelMatchPolicy,
    exactTargetModelsRequired: policies.every((policy) => policy.exactTargetModelsRequired === true),
    localDiagnosticModelAllowed: policies.some((policy) => policy.localDiagnosticModelAllowed === true),
    challengerModelAllowed: policies.some((policy) => policy.challengerModelAllowed === true),
    localDiagnosticEndpointSatisfied: items.every(
      (item) => item.json.scoringPolicy?.localDiagnosticEndpointSatisfied === true || item.json.provider?.endpointIsLocal === true,
    ),
    modelMismatchAllowed: policies.some((policy) => policy.modelMismatchAllowed === true),
    countsAsFullMemorySotaEvidence: false,
    countsAsLocalFullBenchmarkEvidence:
      claimScope === "local-full" &&
      items.every((item) => item.json.scoringPolicy?.localDiagnosticEndpointSatisfied === true || item.json.provider?.endpointIsLocal === true),
  };
}

function defaultModelMatchPolicy(scope) {
  if (scope === "local-full") return "local-diagnostic-allowed";
  if (scope === "model-challenger") return "challenger-model-allowed";
  return "exact-target-required";
}

function shardRange(json) {
  const input = json.input ?? {};
  const shard = input.queryShard ?? {};
  const totalQueryCount = requiredInt(input.totalQueryCount ?? shard.totalQueryCount ?? input.queryCount, "total query count");
  const scoredQueryCount = requiredInt(input.scoredQueryCount ?? shard.scoredQueryCount, "scored query count");
  const startIndex = requiredInt(input.scoredQueryStart ?? shard.startIndex ?? input.queryOffset ?? 0, "query shard start");
  const endIndexExclusive = requiredInt(
    input.scoredQueryEndExclusive ?? shard.endIndexExclusive ?? startIndex + scoredQueryCount,
    "query shard end",
  );
  assert.ok(startIndex >= 0, "query shard start must be non-negative");
  assert.ok(endIndexExclusive > startIndex, "query shard end must be greater than start");
  assert.ok(endIndexExclusive <= totalQueryCount, "query shard end must not exceed total query count");
  return {
    startIndex,
    endIndexExclusive,
    totalQueryCount,
    scoredQueryCount,
    selectedQueryIdHash: shard.selectedQueryIdHash ?? null,
  };
}

function strategyNames(json) {
  return (json.strategies ?? []).map((row) => row.strategy).filter(Boolean).sort((left, right) => left.localeCompare(right));
}

function requiredInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number), `${label} must be an integer`);
  return number;
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

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1);
  return Math.round(values[index]);
}

function round(value) {
  return Number(Number(value).toFixed(4));
}

function renderMarkdown(value) {
  return [
    "# Combined Answer-Quality Memory Score",
    "",
    `- Fixture only: ${value.fixtureOnly}`,
    `- Ready for end-to-end memory score gate: ${value.readyForEndToEndMemoryScoreGate}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Benchmark: ${value.benchmark}`,
    `- Combine mode: ${value.combineMode}`,
    `- Scored query count: ${value.input.scoredQueryCount}`,
    `- Query coverage: ${value.input.scoredQueryStart ?? 0}-${value.input.scoredQueryEndExclusive ?? value.input.scoredQueryCount} of ${value.input.totalQueryCount ?? value.input.queryCount}`,
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
