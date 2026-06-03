import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const inputPaths = splitList(args.input ?? args.inputs ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_SHARD_REPORTS ?? "").map(resolveInputPath);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireComplete = Boolean(args.requireComplete) || process.env.RECALLWEAVE_PUBLIC_BENCHMARK_REQUIRE_COMPLETE === "1";
const requiredStrategies = splitList(args.requiredStrategies ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_REQUIRED_STRATEGIES ?? "");
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(inputPaths.length > 0, "at least one shard report is required");

const reports = inputPaths.map(loadReport);
const reportContracts = reports.map((item) => item.json);
assertShardReportContracts(reportContracts);

const queryCount = totalQueryCountForReports(reportContracts);
const querySetHash = reportContracts[0].input?.querySetHash ?? reportContracts[0].input?.collectorCompatibleQuerySetHash ?? null;
const strategies = combineStrategies(reportContracts, queryCount);
const failedStrategies = combineFailures(reportContracts);
const blockers = [
  ...requiredStrategies.filter((strategy) => !strategies.some((item) => item.strategy === strategy)).map((strategy) => `missing-required-strategy:${strategy}`),
  ...strategies.filter((item) => requireComplete && !item.coverage.complete).map((item) => `incomplete-strategy-coverage:${item.strategy}`),
  queryCount <= 0 ? "query-count-missing" : null,
].filter(Boolean);
const status = blockers.length
  ? "BLOCKED_STRATEGY_SHARD_COMBINE"
  : failedStrategies.length
    ? "COMBINED_WITH_ARM_FAILURES"
    : "COMBINED";

const report = {
  schemaVersion: 1,
  ok: blockers.length === 0,
  status,
  mode: "public-benchmark-strategy-shard-combine",
  benchmark: reportContracts[0].benchmark,
  gate: reportContracts[0].gate,
  fixtureOnly: reportContracts[0].fixtureOnly,
  metricsOnly: true,
  retrievalProxyOnly: true,
  memoryBenchAnswerQuality: false,
  publicBenchmarkClaimsAllowed: false,
  publicSafe: true,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  generatedAt: new Date().toISOString(),
  input: {
    reportCount: reports.length,
    reports: reports.map((item) => ({
      path: displayPath(item.path),
      hash: item.hash,
      status: item.json.status,
      queryOffset: item.json.input?.requestedQuerySelection?.queryOffset ?? 0,
      maxQueries: item.json.input?.requestedQuerySelection?.maxQueries ?? null,
      selectedQueryCount: item.json.input?.selectedQueryCount ?? null,
    })),
    querySetHash,
    queryCount,
    expectedResultRefCount: reportContracts[0].input?.expectedResultRefCount ?? null,
    requireComplete,
    requiredStrategies,
  },
  strategies,
  failedStrategies,
  winner: bestStrategy(strategies.filter((item) => item.coverage.complete || !requireComplete)),
  coverage: coverageSummary(strategies, queryCount),
  blockers,
  safety: {
    publicSafe: true,
    metricsOnly: true,
    printsCredentials: false,
  },
  nextActions: [
    "Use this combined report as retrieval-proxy system evidence only; it is not answer-quality or SOTA evidence.",
    "Shard provider waves when a full single-process arm is too slow, then combine only same-target reports with matching query-set hashes.",
    "Run answer-quality scoring after retrieval arms cover the selected target and private response files pass intake.",
  ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "strategy shard combine report");
assertSafePublicText(markdownText, "strategy shard combine markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function loadReport(path) {
  assert.ok(existsSync(path), `shard report missing: ${displayPath(path)}`);
  assert.ok(statSync(path).isFile(), `shard report must be a file: ${displayPath(path)}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, displayPath(path));
  const json = JSON.parse(text);
  return { path, hash: `sha256:${sha256(text)}`, json };
}

function assertShardReportContracts(items) {
  const first = items[0];
  for (const item of items) {
    assert.equal(item.metricsOnly, true, "shard report must be metrics-only");
    assert.equal(item.retrievalProxyOnly, true, "shard report must be retrieval-proxy only");
    assert.equal(item.memoryBenchAnswerQuality, false, "shard report must not be answer-quality evidence");
    assert.equal(item.publicBenchmarkClaimsAllowed, false, "shard report must not allow public benchmark claims");
    assert.equal(item.publicSafe, true, "shard report must be public-safe");
    assert.equal(item.rawQuestionsIncluded, false, "shard report must not include raw questions");
    assert.equal(item.rawAnswersIncluded, false, "shard report must not include raw answers");
    assert.equal(item.rawMemoryIncluded, false, "shard report must not include raw memory");
    assert.equal(item.rawTranscriptIncluded, false, "shard report must not include raw transcript");
    assert.equal(item.rawPrivateOutputPathIncluded, false, "shard report must not include private output paths");
    assert.equal(item.benchmark, first.benchmark, "all shard reports must use the same benchmark");
    assert.equal(item.gate, first.gate, "all shard reports must use the same gate");
    assert.equal(item.fixtureOnly, first.fixtureOnly, "all shard reports must use the same fixture/live mode");
    assert.equal(item.input?.queryCount, first.input?.queryCount, "all shard reports must use the same target query count");
    assert.equal(
      item.input?.querySetHash ?? item.input?.collectorCompatibleQuerySetHash,
      first.input?.querySetHash ?? first.input?.collectorCompatibleQuerySetHash,
      "all shard reports must use the same query-set hash",
    );
  }
}

function combineStrategies(items, totalQueryCount) {
  const byStrategy = new Map();
  for (const report of items) {
    for (const strategy of arrayOf(report.strategies)) {
      const state = byStrategy.get(strategy.strategy) ?? emptyStrategyState(strategy.strategy);
      state.reportCount += 1;
      state.providerArms.add(strategy.provider?.modelArm ?? "none");
      state.rankingStrategies.add(strategy.rankingStrategy ?? "unknown");
      state.contextBudgets.add(JSON.stringify(strategy.contextBudget ?? null));
      state.responseHashes.push(strategy.responsesHash);
      state.resultHashes.push(strategy.resultHash);
      const shard = strategy.queryShard ?? {};
      const start = Number(shard.startIndex ?? report.input?.requestedQuerySelection?.queryOffset ?? 0);
      const count = Number(shard.responseCount ?? report.input?.selectedQueryCount ?? arrayOf(strategy.resultFingerprints).length);
      for (let index = 0; index < count; index += 1) state.coveredIndexes.add(start + index);
      for (const fingerprint of arrayOf(strategy.resultFingerprints)) {
        state.fingerprints.push(fingerprint);
      }
      state.metricRows.push({
        queryCount: count,
        latencyP50Ms: strategy.metrics?.latencyP50Ms,
        latencyP95Ms: strategy.metrics?.latencyP95Ms,
      });
      byStrategy.set(strategy.strategy, state);
    }
  }
  return [...byStrategy.values()]
    .map((state) => strategySummary(state, totalQueryCount))
    .sort((left, right) => left.strategy.localeCompare(right.strategy));
}

function emptyStrategyState(strategy) {
  return {
    strategy,
    reportCount: 0,
    providerArms: new Set(),
    rankingStrategies: new Set(),
    contextBudgets: new Set(),
    responseHashes: [],
    resultHashes: [],
    coveredIndexes: new Set(),
    fingerprints: [],
    metricRows: [],
  };
}

function strategySummary(state, totalQueryCount) {
  const metrics = aggregateFingerprints(state.fingerprints, state.metricRows);
  const coveredIndexes = [...state.coveredIndexes].filter((index) => index >= 0 && index < totalQueryCount).sort((a, b) => a - b);
  return {
    strategy: state.strategy,
    reportCount: state.reportCount,
    providerArms: [...state.providerArms].sort(),
    rankingStrategies: [...state.rankingStrategies].sort(),
    combinedResponsesHash: `sha256:${sha256(state.responseHashes.filter(Boolean).sort().join("\n"))}`,
    combinedResultHash: `sha256:${sha256(state.resultHashes.filter(Boolean).sort().join("\n"))}`,
    metrics,
    coverage: {
      complete: totalQueryCount > 0 && coveredIndexes.length === totalQueryCount,
      coveredQueryCount: coveredIndexes.length,
      totalQueryCount,
      coveragePercent: totalQueryCount > 0 ? round((coveredIndexes.length / totalQueryCount) * 100) : 0,
      firstCoveredIndex: coveredIndexes[0] ?? null,
      lastCoveredIndex: coveredIndexes.at(-1) ?? null,
      missingQueryCount: Math.max(0, totalQueryCount - coveredIndexes.length),
      duplicateFingerprintCount: Math.max(0, state.fingerprints.length - coveredIndexes.length),
    },
    fingerprintCount: state.fingerprints.length,
  };
}

function aggregateFingerprints(fingerprints, metricRows = []) {
  const rows = arrayOf(fingerprints);
  const latencies = rows
    .filter((item) => item.latencyMs !== null && item.latencyMs !== undefined)
    .map((item) => Number(item.latencyMs))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const pAt1 = average(rows.map((item) => item.pAt1));
  const recallAt5 = average(rows.map((item) => item.recallAt5));
  const recallAt10 = average(rows.map((item) => item.recallAt10));
  const ndcgAt10 = average(rows.map((item) => item.ndcgAt10));
  return {
    quality: round((pAt1 + recallAt5 + recallAt10 + ndcgAt10) / 4),
    pAt1,
    recallAt5,
    recallAt10,
    ndcgAt10,
    latencyP50Ms: latencies.length ? percentile(latencies, 0.5) : weightedShardMetric(metricRows, "latencyP50Ms"),
    latencyP95Ms: latencies.length ? percentile(latencies, 0.95) : weightedShardMetric(metricRows, "latencyP95Ms"),
  };
}

function weightedShardMetric(rows, field) {
  const clean = arrayOf(rows)
    .map((row) => ({ value: Number(row?.[field]), weight: Math.max(1, Number(row?.queryCount ?? 1)) }))
    .filter((row) => Number.isFinite(row.value));
  const weight = clean.reduce((sum, row) => sum + row.weight, 0);
  return weight > 0 ? round(clean.reduce((sum, row) => sum + row.value * row.weight, 0) / weight) : 0;
}

function combineFailures(items) {
  const failures = [];
  for (const report of items) {
    for (const failure of arrayOf(report.failedStrategies)) {
      failures.push({
        strategy: failure.strategy ?? null,
        failureClass: failure.failureClass ?? "unknown",
        failureHash: failure.failureHash ?? null,
        failureSummary: failure.failureSummary ?? null,
        retryableProviderLimit: Boolean(failure.retryableProviderLimit),
        queryOffset: report.input?.requestedQuerySelection?.queryOffset ?? 0,
        maxQueries: report.input?.requestedQuerySelection?.maxQueries ?? null,
      });
    }
  }
  return failures;
}

function totalQueryCountForReports(items) {
  for (const report of items) {
    for (const strategy of arrayOf(report.strategies)) {
      const total = Number(strategy.queryShard?.totalQueryCount ?? 0);
      if (Number.isInteger(total) && total > 0) return total;
    }
  }
  return Number(items[0]?.input?.queryCount ?? 0);
}

function coverageSummary(strategies, totalQueryCount) {
  return {
    queryCount: totalQueryCount,
    completeStrategyCount: strategies.filter((item) => item.coverage.complete).length,
    incompleteStrategyCount: strategies.filter((item) => !item.coverage.complete).length,
    bestCoveragePercent: strategies.reduce((best, item) => Math.max(best, Number(item.coverage.coveragePercent ?? 0)), 0),
  };
}

function bestStrategy(items) {
  const sorted = [...items].sort((left, right) => {
    const qualityDelta = Number(right.metrics?.quality ?? 0) - Number(left.metrics?.quality ?? 0);
    if (qualityDelta !== 0) return qualityDelta;
    return Number(left.metrics?.latencyP50Ms ?? Infinity) - Number(right.metrics?.latencyP50Ms ?? Infinity);
  });
  const best = sorted[0] ?? null;
  return best
    ? {
        strategy: best.strategy,
        quality: best.metrics.quality,
        pAt1: best.metrics.pAt1,
        recallAt5: best.metrics.recallAt5,
        recallAt10: best.metrics.recallAt10,
        ndcgAt10: best.metrics.ndcgAt10,
        latencyP50Ms: best.metrics.latencyP50Ms,
        coveragePercent: best.coverage.coveragePercent,
      }
    : null;
}

function renderMarkdown(value) {
  const lines = [
    "# Public Benchmark Strategy Shard Combine",
    "",
    `- OK: ${value.ok}`,
    `- Status: ${value.status}`,
    `- Gate: ${value.gate}`,
    `- Benchmark: ${value.benchmark}`,
    `- Report count: ${value.input.reportCount}`,
    `- Query count: ${value.input.queryCount}`,
    `- Require complete: ${value.input.requireComplete}`,
    `- Winner: ${value.winner?.strategy ?? "none"}`,
    `- Best coverage: ${value.coverage.bestCoveragePercent}%`,
    "",
    "## Strategies",
    "",
    "| Strategy | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 ms | Coverage |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...value.strategies.map((item) =>
      `| ${item.strategy} | ${item.metrics.quality} | ${item.metrics.pAt1} | ${item.metrics.recallAt5} | ${item.metrics.recallAt10} | ${item.metrics.ndcgAt10} | ${item.metrics.latencyP50Ms} | ${item.coverage.coveragePercent}% |`,
    ),
    "",
  ];
  if (value.failedStrategies.length) {
    lines.push(
      "## Failed Arms",
      "",
      "| Strategy | Query offset | Max queries | Failure class | Summary |",
      "| --- | ---: | ---: | --- | --- |",
      ...value.failedStrategies.map((item) =>
        `| ${item.strategy ?? "unknown"} | ${item.queryOffset} | ${item.maxQueries ?? "all"} | ${item.failureClass} | ${String(item.failureSummary ?? "n/a").replaceAll("|", "/")} |`,
      ),
      "",
    );
  }
  if (value.blockers.length) {
    lines.push("## Blockers", "", ...value.blockers.map((item) => `- ${item}`), "");
  }
  lines.push(
    "## Safety",
    "",
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Raw transcript included: ${value.rawTranscriptIncluded}`,
    `- Private output path included: ${value.rawPrivateOutputPathIncluded}`,
  );
  return lines.join("\n");
}

function average(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : 0;
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * quantile)));
  return round(values[index]);
}

function round(value) {
  return Number(Number(value).toFixed(4));
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  assertSafePublicText(text, "public output");
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private path or raw memory filename`);
  assert.doesNotMatch(String(text), privateTagPattern, `${label} contains private tags`);
}

function resolveInputPath(value) {
  assert.ok(value, "path is required");
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, resolve(value)).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
}

function splitList(value) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
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
