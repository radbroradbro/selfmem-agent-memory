import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const resultPath = args.result ? resolve(root, args.result) : null;
const targetPath = resolve(root, args.target ?? "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const fixtureProxySmoke = Boolean(args.fixtureProxySmoke);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "target");
const target = JSON.parse(targetRaw);
const loaded = loadResult();
const report = buildGateReport({ loaded, target, targetRaw });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "query expansion result gate");
assertSafePublicText(markdownText, "query expansion result gate markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_QUERY_EXPANSION_RETRIEVAL_PROXY_RESULT") process.exit(1);

function loadResult() {
  if (fixtureProxySmoke) {
    const result = spawnSync(
      "node",
      [
        "packages/bench/public-benchmark-strategy-compare.mjs",
        "--fixture",
        "--strategies",
        "bm25-lite,full-hybrid-rerank,query-expanded-full-hybrid-rerank",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(result.status, 0, `fixture strategy compare failed\n${result.stderr}\n${result.stdout}`);
    assertSafePublicText(result.stdout, "fixture query expansion result");
    return {
      source: "generated-fixture-proxy-smoke",
      path: null,
      exists: true,
      json: JSON.parse(result.stdout),
      hash: `sha256:${sha256(result.stdout)}`,
    };
  }
  if (!resultPath || !existsSync(resultPath)) {
    return {
      source: "missing-result",
      path: resultPath ? displayPath(resultPath) : null,
      exists: false,
      json: null,
      hash: null,
    };
  }
  assert.ok(statSync(resultPath).size > 0, `result empty: ${displayPath(resultPath)}`);
  const text = readFileSync(resultPath, "utf8");
  assertSafePublicText(text, displayPath(resultPath));
  return {
    source: "result-file",
    path: displayPath(resultPath),
    exists: true,
    json: JSON.parse(text),
    hash: `sha256:${sha256(text)}`,
  };
}

function buildGateReport({ loaded, target, targetRaw }) {
  const result = loaded.json;
  const strategies = Array.isArray(result?.strategies) ? result.strategies : [];
  const strategyNames = strategies.map((item) => item.strategy).filter(Boolean);
  const queryArm = strategies.find((item) => item.strategy === "query-expanded-full-hybrid-rerank") ?? null;
  const provider = queryArm?.provider ?? {};
  const checks = {
    resultExists: loaded.exists,
    modeRecognized: result?.mode === "public-benchmark-strategy-compare",
    metricsOnly: result?.metricsOnly === true,
    publicSafe: result?.publicSafe === true,
    fixtureOnlyFalse: result?.fixtureOnly === false,
    retrievalProxyOnly: result?.retrievalProxyOnly === true,
    memoryBenchAnswerQualityFalse: result?.memoryBenchAnswerQuality === false,
    publicClaimsDisabled: result?.publicBenchmarkClaimsAllowed === false,
    rawQuestionsExcluded: result?.rawQuestionsIncluded === false,
    rawAnswersExcluded: result?.rawAnswersIncluded === false,
    rawMemoryExcluded: result?.rawMemoryIncluded === false,
    rawTranscriptExcluded: result?.rawTranscriptIncluded === false,
    sourceLockedTarget: result?.input?.source === "materialized-source-locked-longmemeval",
    benchmarkMatchesTarget: result?.benchmark === (target.benchmark?.family ?? target.benchmark?.name),
    querySetHashPresent: typeof result?.input?.querySetHash === "string" && result.input.querySetHash.startsWith("sha256:"),
    materializerHashPresent: typeof result?.input?.materializerHash === "string" && result.input.materializerHash.startsWith("sha256:"),
    bm25ControlPresent: strategyNames.includes("bm25-lite"),
    fullHybridControlPresent: strategyNames.includes("full-hybrid-rerank"),
    queryExpansionArmPresent: Boolean(queryArm),
    queryExpansionCallsPresent: Number(provider.queryExpansionCalls ?? 0) > 0,
    queryExpansionFallbacksAbsent: Number(provider.queryExpansionFallbacks ?? 0) === 0,
    queryExpansionModeLabeled: ["pure-local", "mixed-local-cloud"].includes(String(provider.queryExpansionMode ?? "")),
    queryExpansionProviderLive: provider.queryExpansionProvider && provider.queryExpansionProvider !== "local-deterministic",
    queryExpansionOnlyCurrentQuerySent: provider.queryExpansionOnlyCurrentQuerySent === true,
    queryExpansionStoredMemoriesNotSent: provider.queryExpansionStoredMemoriesSent === false,
    queryExpansionRewriteCountPresent: Number(provider.queryExpansionRewritesReturned ?? 0) > 0,
    privacyLeakCountersClear: strategies.every((item) => Number(item.privacyLeakCount ?? 0) === 0 && Number(item.redactionFailureCount ?? 0) === 0),
  };

  const blockers = [
    !checks.resultExists ? "missing-query-expansion-result-file" : null,
    !checks.modeRecognized ? "result-not-strategy-compare-report" : null,
    !checks.metricsOnly ? "result-not-metrics-only" : null,
    !checks.publicSafe ? "result-not-public-safe" : null,
    !checks.fixtureOnlyFalse ? "fixture-result-cannot-count-as-live-query-expansion" : null,
    !checks.retrievalProxyOnly ? "result-not-retrieval-proxy-report" : null,
    !checks.memoryBenchAnswerQualityFalse ? "unexpected-answer-quality-flag-for-retrieval-proxy-gate" : null,
    !checks.publicClaimsDisabled ? "public-claims-enabled-before-full-memory-review" : null,
    !checks.rawQuestionsExcluded ? "raw-questions-included" : null,
    !checks.rawAnswersExcluded ? "raw-answers-included" : null,
    !checks.rawMemoryExcluded ? "raw-memory-included" : null,
    !checks.rawTranscriptExcluded ? "raw-transcript-included" : null,
    !checks.sourceLockedTarget ? "result-not-bound-to-source-locked-target" : null,
    !checks.benchmarkMatchesTarget ? "benchmark-does-not-match-target" : null,
    !checks.querySetHashPresent ? "missing-query-set-hash" : null,
    !checks.materializerHashPresent ? "missing-materializer-hash" : null,
    !checks.bm25ControlPresent ? "missing-bm25-control" : null,
    !checks.fullHybridControlPresent ? "missing-full-hybrid-control" : null,
    !checks.queryExpansionArmPresent ? "missing-query-expansion-arm" : null,
    !checks.queryExpansionCallsPresent ? "query-expansion-live-calls-missing" : null,
    !checks.queryExpansionFallbacksAbsent ? "query-expansion-used-deterministic-fallback" : null,
    !checks.queryExpansionModeLabeled ? "query-expansion-mode-not-labeled" : null,
    !checks.queryExpansionProviderLive ? "query-expansion-provider-not-live" : null,
    !checks.queryExpansionOnlyCurrentQuerySent ? "query-expansion-current-query-boundary-not-proven" : null,
    !checks.queryExpansionStoredMemoriesNotSent ? "query-expansion-sent-stored-memories" : null,
    !checks.queryExpansionRewriteCountPresent ? "query-expansion-rewrite-count-missing" : null,
    !checks.privacyLeakCountersClear ? "privacy-or-redaction-counter-nonzero" : null,
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    ok: true,
    mode: "query-expansion-result-gate",
    status: blockers.length === 0 ? "READY_QUERY_EXPANSION_RETRIEVAL_PROXY_RESULT" : "BLOCKED_QUERY_EXPANSION_RESULT",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    publicBenchmarkClaimsAllowed: false,
    countsAsLiveQueryExpansionBenchmark: blockers.length === 0,
    countsAsFullMemorySotaEvidence: false,
    reason:
      blockers.length === 0
        ? "Same-data retrieval-proxy result proves the live query-expansion arm ran; full memory/SOTA claims still require answer-quality scoring and review."
        : "Result is missing or insufficient for a live query-expansion benchmark row.",
    target: {
      path: displayPath(targetPath),
      hash: `sha256:${sha256(targetRaw)}`,
      benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
      claimTier: target.claimTier ?? null,
      scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
      answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    },
    result: {
      source: loaded.source,
      path: loaded.path,
      hash: loaded.hash,
      fixtureOnly: Boolean(result?.fixtureOnly),
      mode: result?.mode ?? null,
      benchmark: result?.benchmark ?? null,
      querySetHash: result?.input?.querySetHash ?? null,
      materializerHash: result?.input?.materializerHash ?? null,
      queryCount: result?.input?.queryCount ?? null,
      strategies: strategyNames,
      queryExpansionProvider: provider.queryExpansionProvider ?? null,
      queryExpansionMode: provider.queryExpansionMode ?? null,
      queryExpansionCalls: provider.queryExpansionCalls ?? 0,
      queryExpansionFallbacks: provider.queryExpansionFallbacks ?? 0,
      queryExpansionRewritesReturned: provider.queryExpansionRewritesReturned ?? 0,
    },
    checks,
    blockers,
    nextActions: blockers.length
      ? [
          "Run the same-data strategy comparison with a configured local or approved mixed-cloud query-expansion endpoint.",
          "Include bm25-lite, full-hybrid-rerank, and query-expanded-full-hybrid-rerank on the source-locked target.",
          "Re-run this gate with --require-ready before counting the query-expansion row in the SOTA ladder.",
        ]
      : [
          "Attach this gate report to the SOTA ladder packet.",
          "Continue to end-to-end answer-quality scoring and independent review before any public claim.",
        ],
  };
}

function renderMarkdown(value) {
  return [
    "# Query Expansion Result Gate",
    "",
    `- Status: ${value.status}`,
    `- Counts as live query-expansion benchmark: ${value.countsAsLiveQueryExpansionBenchmark}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Target: ${value.target.path}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Result",
    `- Source: ${value.result.source}`,
    `- Fixture only: ${value.result.fixtureOnly}`,
    `- Query expansion mode: ${value.result.queryExpansionMode ?? "none"}`,
    `- Query expansion provider: ${value.result.queryExpansionProvider ?? "none"}`,
    `- Query expansion calls: ${value.result.queryExpansionCalls}`,
    `- Query expansion fallbacks: ${value.result.queryExpansionFallbacks}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
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

function displayPath(path) {
  return String(path).replace(root, "").replace(/^\/+/, "") || ".";
}

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
}
