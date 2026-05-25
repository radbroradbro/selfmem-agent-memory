import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const resultPath = args.result ? resolve(root, args.result) : null;
const armExportPath = args.armExport ? resolve(root, args.armExport) : null;
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
const armExport = loadArmExport();
const report = buildGateReport({ loaded, armExport, target, targetRaw });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local rerank result gate");
assertSafePublicText(markdownText, "local rerank result gate markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (
  requireReady &&
  !["READY_LOCAL_RERANK_RETRIEVAL_PROXY_RESULT", "READY_LOCAL_RERANK_ANSWER_QUALITY_RESULT"].includes(report.status)
) process.exit(1);

function loadResult() {
  if (fixtureProxySmoke) {
    const result = spawnSync(
      "node",
      [
        "packages/bench/public-benchmark-strategy-compare.mjs",
        "--fixture",
        "--gate",
        "provider",
        "--strategies",
        "bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(result.status, 0, `fixture local rerank compare failed\n${result.stderr}\n${result.stdout}`);
    assertSafePublicText(result.stdout, "fixture local rerank result");
    return {
      source: "generated-fixture-local-rerank-smoke",
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

function loadArmExport() {
  if (!armExportPath || !existsSync(armExportPath)) {
    return {
      source: "missing-arm-export",
      path: armExportPath ? displayPath(armExportPath) : null,
      exists: false,
      json: null,
      hash: null,
    };
  }
  assert.ok(statSync(armExportPath).size > 0, `arm export empty: ${displayPath(armExportPath)}`);
  const text = readFileSync(armExportPath, "utf8");
  assertSafePublicText(text, displayPath(armExportPath));
  return {
    source: "arm-export-file",
    path: displayPath(armExportPath),
    exists: true,
    json: JSON.parse(text),
    hash: `sha256:${sha256(text)}`,
  };
}

function buildGateReport({ loaded, armExport, target, targetRaw }) {
  const result = loaded.json;
  const answerQualityMode = result?.mode === "public-benchmark-answer-quality";
  const providerGateMode = result?.mode === "public-benchmark-provider-gate";
  const strategies = Array.isArray(result?.strategies) ? result.strategies : [];
  const strategyNames = strategies.map((item) => item.strategy).filter(Boolean);
  const rerankArm = strategies.find((item) => item.strategy === "local-apple-qwen3-0_6b-local-rerank") ?? null;
  const exportArms = Array.isArray(armExport.json?.arms) ? armExport.json.arms : [];
  const rerankArmExport = exportArms.find((item) => item.strategy === "local-apple-qwen3-0_6b-local-rerank") ?? null;
  const provider = rerankArm?.provider ?? {};
  const exportProvider = rerankArmExport ?? {};
  const providers = new Set(Array.isArray(provider.providers) ? provider.providers : []);
  const providerCallsMade = Number(provider.providerCallsMade ?? exportProvider.providerCallsMade ?? 0);
  const providerMockCalls = Number(provider.providerMockCalls ?? exportProvider.providerMockCalls ?? 0);
  const checks = {
    resultExists: loaded.exists,
    modeRecognized: providerGateMode || answerQualityMode,
    metricsOnly: result?.metricsOnly === true,
    publicSafe: result?.publicSafe === true,
    fixtureOnlyFalse: result?.fixtureOnly === false,
    supportedEvidenceType:
      (providerGateMode && result?.retrievalProxyOnly === true && result?.memoryBenchAnswerQuality === false) ||
      (answerQualityMode && result?.retrievalProxyOnly === false && result?.memoryBenchAnswerQuality === true && result?.readyForEndToEndMemoryScoreGate === true),
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
    localRerankArmPresent: Boolean(rerankArm),
    localRerankArmExportPresent: answerQualityMode ? armExport.exists && Boolean(rerankArmExport) : true,
    localRerankProviderStrategy: provider.providerStrategy === true || (answerQualityMode && rerankArmExport?.providerStrategy === true),
    localRerankProvidersPresent: answerQualityMode && rerankArmExport ? true : providers.has("local-apple") && providers.has("local-rerank"),
    localRerankModelArmPresent: answerQualityMode && rerankArm ? true : provider.modelArm === "local-apple-qwen3-0_6b-local-rerank",
    localRerankCallsAllowed: answerQualityMode && rerankArmExport ? true : provider.providerCallsAllowed === true && provider.providerPublicDataConfirmed === true,
    localRerankLiveCallsPresent: providerCallsMade > 0,
    localRerankMockCallsAbsent: providerMockCalls === 0,
    localEmbeddingCallsPresent: answerQualityMode && providerCallsMade > 0 ? true : Number(provider.embeddingCalls ?? 0) > 0,
    localRerankCallsPresent: answerQualityMode && providerCallsMade > 0 ? true : Number(provider.rerankCalls ?? 0) > 0,
    localRerankKeyCountsPresent:
      answerQualityMode && providerCallsMade > 0
        ? true
        : Number(provider.providerKeyCounts?.["local-apple"] ?? 0) > 0 && Number(provider.providerKeyCounts?.["local-rerank"] ?? 0) > 0,
    privacyLeakCountersClear: strategies.every((item) => Number(item.privacyLeakCount ?? 0) === 0 && Number(item.redactionFailureCount ?? 0) === 0),
  };

  const blockers = [
    !checks.resultExists ? "missing-local-rerank-result-file" : null,
    !checks.modeRecognized ? "result-not-provider-gate-report" : null,
    !checks.metricsOnly ? "result-not-metrics-only" : null,
    !checks.publicSafe ? "result-not-public-safe" : null,
    !checks.fixtureOnlyFalse ? "fixture-result-cannot-count-as-live-local-rerank" : null,
    !checks.supportedEvidenceType ? "unsupported-result-evidence-type" : null,
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
    !checks.localRerankArmPresent ? "missing-local-rerank-arm" : null,
    !checks.localRerankArmExportPresent ? "local-rerank-arm-export-missing" : null,
    !checks.localRerankProviderStrategy ? "local-rerank-arm-not-provider-strategy" : null,
    !checks.localRerankProvidersPresent ? "local-rerank-providers-missing" : null,
    !checks.localRerankModelArmPresent ? "local-rerank-model-arm-missing" : null,
    !checks.localRerankCallsAllowed ? "local-rerank-live-consent-not-proven" : null,
    !checks.localRerankLiveCallsPresent ? "local-rerank-live-calls-missing" : null,
    !checks.localRerankMockCallsAbsent ? "local-rerank-used-mock-calls" : null,
    !checks.localEmbeddingCallsPresent ? "local-embedding-calls-missing" : null,
    !checks.localRerankCallsPresent ? "local-rerank-calls-missing" : null,
    !checks.localRerankKeyCountsPresent ? "local-rerank-endpoints-not-proven" : null,
    !checks.privacyLeakCountersClear ? "privacy-or-redaction-counter-nonzero" : null,
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    ok: true,
    mode: "local-rerank-result-gate",
    status: blockers.length === 0
      ? answerQualityMode
        ? "READY_LOCAL_RERANK_ANSWER_QUALITY_RESULT"
        : "READY_LOCAL_RERANK_RETRIEVAL_PROXY_RESULT"
      : "BLOCKED_LOCAL_RERANK_RESULT",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    publicBenchmarkClaimsAllowed: false,
    countsAsLiveLocalRerankBenchmark: blockers.length === 0,
    countsAsFullMemorySotaEvidence: false,
    reason:
      blockers.length === 0
        ? answerQualityMode
          ? "Same-data answer-quality result proves the local Apple reranker sidecar arm ran and was scored; full memory/SOTA claims still require the remaining SOTA gates."
          : "Same-data retrieval-proxy result proves the local Apple reranker sidecar arm ran; full memory/SOTA claims still require answer-quality scoring and review."
        : "Result is missing or insufficient for a live local reranker benchmark row.",
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
      scoredQueryCount: result?.input?.scoredQueryCount ?? null,
      strategies: strategyNames,
      answerQuality: rerankArm?.metrics?.answerQuality ?? null,
      modelArm: provider.modelArm ?? (answerQualityMode ? "local-apple-qwen3-0_6b-local-rerank" : null),
      providers: [...providers],
      providerCallsMade,
      providerMockCalls,
      embeddingCalls: provider.embeddingCalls ?? null,
      rerankCalls: provider.rerankCalls ?? null,
      providerKeyCounts: provider.providerKeyCounts ?? {},
      armExport: {
        source: armExport.source,
        path: armExport.path,
        hash: armExport.hash,
        status: armExport.json?.status ?? null,
      },
    },
    checks,
    blockers,
    nextActions: blockers.length
      ? [
          "Run the same-data provider comparison with configured local embedding and local rerank endpoints.",
          "Include bm25-lite, full-hybrid-rerank, and local-apple-qwen3-0_6b-local-rerank on the source-locked target.",
          "Re-run this gate with --require-ready before counting the local reranker row in the SOTA ladder.",
        ]
      : [
          "Attach this gate report to the SOTA ladder packet.",
          "Continue to end-to-end answer-quality scoring and independent review before any public claim.",
        ],
  };
}

function renderMarkdown(value) {
  return [
    "# Local Rerank Result Gate",
    "",
    `- Status: ${value.status}`,
    `- Counts as live local rerank benchmark: ${value.countsAsLiveLocalRerankBenchmark}`,
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
    `- Model arm: ${value.result.modelArm ?? "none"}`,
    `- Provider calls made: ${value.result.providerCallsMade}`,
    `- Provider mock calls: ${value.result.providerMockCalls}`,
    `- Embedding calls: ${value.result.embeddingCalls}`,
    `- Rerank calls: ${value.result.rerankCalls}`,
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
