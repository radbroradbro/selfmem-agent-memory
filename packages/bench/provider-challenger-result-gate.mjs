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
assertSafePublicText(jsonText, "provider challenger result gate");
assertSafePublicText(markdownText, "provider challenger result gate markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (
  requireReady &&
  !["READY_PROVIDER_CHALLENGER_RETRIEVAL_PROXY_RESULT", "READY_PROVIDER_CHALLENGER_ANSWER_QUALITY_RESULT"].includes(report.status)
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
        "bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(result.status, 0, `fixture provider compare failed\n${result.stderr}\n${result.stdout}`);
    assertSafePublicText(result.stdout, "fixture provider challenger result");
    return {
      source: "generated-fixture-provider-challenger-smoke",
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
  const answerQualityMode = result?.mode === "public-benchmark-answer-quality";
  const providerGateMode = result?.mode === "public-benchmark-provider-gate";
  const strategies = Array.isArray(result?.strategies) ? result.strategies : [];
  const strategyNames = strategies.map((item) => item.strategy).filter(Boolean);
  const providerArms = strategies.filter((item) => isRequiredProviderArm(item.strategy));
  const voyageArm = strategies.find((item) => item.strategy === "cloud-voyage4-voyage" || item.strategy === "cloud-voyage4-voyage-lite-rerank" || item.strategy === "cloud-voyage4-lite-voyage-lite");
  const nonVoyageArm = strategies.find((item) => item.strategy === "cloud-gemini-voyage-rerank" || String(item.strategy ?? "").startsWith("cloud-nvidia-"));
  const localAppleArm = strategies.find((item) => item.strategy === "local-apple-qwen3-0_6b" || item.strategy === "local-apple-qwen3-4b");
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
    voyageProviderArmPresent: Boolean(voyageArm),
    nvidiaOrGeminiProviderArmPresent: Boolean(nonVoyageArm),
    localAppleProviderArmPresent: Boolean(localAppleArm),
    providerArmsPresent: answerQualityMode ? Boolean(nonVoyageArm || localAppleArm || voyageArm) : providerArms.length >= 3,
    providerArmsAreProviderStrategies: answerQualityMode ? true : providerArms.every((item) => item.provider?.providerStrategy === true),
    providerConsentProven:
      answerQualityMode
        ? result?.provider?.answerQualityCallsAllowed === true && result?.provider?.publicDataConfirmed === true
        : providerArms.every((item) => item.provider?.providerCallsAllowed === true && item.provider?.providerPublicDataConfirmed === true),
    liveProviderCallsPresent:
      answerQualityMode
        ? Number(result?.provider?.callsMade ?? 0) > 0 && providerArms.every((item) => Number(item.metrics?.answerQuality ?? NaN) >= 0)
        : providerArms.every((item) => Number(item.provider?.providerCallsMade ?? 0) > 0),
    providerMockCallsAbsent: answerQualityMode ? true : providerArms.every((item) => Number(item.provider?.providerMockCalls ?? 0) === 0),
    keyCountsPresent: answerQualityMode ? true : providerArms.every((item) => Number(item.provider?.keyCountAvailable ?? 0) > 0),
    privacyLeakCountersClear: strategies.every((item) => Number(item.privacyLeakCount ?? 0) === 0 && Number(item.redactionFailureCount ?? 0) === 0),
  };

  const blockers = [
    !checks.resultExists ? "missing-provider-result-file" : null,
    !checks.modeRecognized ? "result-not-provider-gate-report" : null,
    !checks.metricsOnly ? "result-not-metrics-only" : null,
    !checks.publicSafe ? "result-not-public-safe" : null,
    !checks.fixtureOnlyFalse ? "fixture-result-cannot-count-as-live-provider-ladder" : null,
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
    !checks.voyageProviderArmPresent ? "missing-voyage-provider-arm" : null,
    !checks.nvidiaOrGeminiProviderArmPresent ? "missing-nvidia-or-gemini-provider-arm" : null,
    !checks.localAppleProviderArmPresent ? "missing-local-apple-provider-arm" : null,
    !checks.providerArmsPresent ? "missing-provider-challenger-arms" : null,
    !checks.providerArmsAreProviderStrategies ? "provider-arm-not-provider-strategy" : null,
    !checks.providerConsentProven ? "provider-live-consent-not-proven" : null,
    !checks.liveProviderCallsPresent ? "provider-live-calls-missing" : null,
    !checks.providerMockCallsAbsent ? "provider-used-mock-calls" : null,
    !checks.keyCountsPresent ? "provider-key-or-endpoint-counts-missing" : null,
    !checks.privacyLeakCountersClear ? "privacy-or-redaction-counter-nonzero" : null,
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    ok: true,
    mode: "provider-challenger-result-gate",
    status: blockers.length === 0
      ? answerQualityMode
        ? "READY_PROVIDER_CHALLENGER_ANSWER_QUALITY_RESULT"
        : "READY_PROVIDER_CHALLENGER_RETRIEVAL_PROXY_RESULT"
      : "BLOCKED_PROVIDER_CHALLENGER_RESULT",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    publicBenchmarkClaimsAllowed: false,
    countsAsLiveProviderChallengerBenchmark: blockers.length === 0,
    countsAsFullMemorySotaEvidence: false,
    reason:
      blockers.length === 0
        ? answerQualityMode
          ? "Same-data answer-quality result proves the provider challenger ladder ran and was scored; full memory/SOTA claims still require the remaining SOTA gates."
          : "Same-data retrieval-proxy result proves the provider challenger ladder ran; full memory/SOTA claims still require answer-quality scoring and review."
        : "Result is missing or insufficient for a live provider challenger benchmark row.",
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
      providerArms: providerArms.map((item) => ({
        strategy: item.strategy,
        providers: item.provider?.providers ?? providersForStrategyName(item.strategy),
        providerCallsMade: answerQualityMode ? null : item.provider?.providerCallsMade ?? 0,
        providerMockCalls: answerQualityMode ? null : item.provider?.providerMockCalls ?? 0,
        keyCountAvailable: answerQualityMode ? null : item.provider?.keyCountAvailable ?? 0,
        answerQuality: item.metrics?.answerQuality ?? null,
      })),
      providerCallsMade: result?.provider?.callsMade ?? null,
    },
    checks,
    blockers,
    nextActions: blockers.length
      ? [
          "Run the same-data provider comparison with configured Voyage, NVIDIA or Gemini, and local Apple endpoints.",
          "Include bm25-lite, full-hybrid-rerank, Voyage, NVIDIA or Gemini, and local Apple arms on the source-locked target.",
          "Re-run this gate with --require-ready before counting provider challenger rows in the SOTA ladder.",
        ]
      : [
          "Attach this gate report to the SOTA ladder packet.",
          "Continue to end-to-end answer-quality scoring and independent review before any public claim.",
        ],
  };
}

function isRequiredProviderArm(strategy) {
  return (
    strategy === "cloud-voyage4-voyage" ||
    strategy === "cloud-voyage4-voyage-lite-rerank" ||
    strategy === "cloud-voyage4-lite-voyage-lite" ||
    strategy === "cloud-gemini-voyage-rerank" ||
    String(strategy ?? "").startsWith("cloud-nvidia-") ||
    strategy === "local-apple-qwen3-0_6b" ||
    strategy === "local-apple-qwen3-4b"
  );
}

function providersForStrategyName(strategy) {
  if (String(strategy ?? "").startsWith("cloud-nvidia-")) return ["nvidia"];
  if (strategy === "cloud-gemini-voyage-rerank") return ["gemini", "voyage"];
  if (String(strategy ?? "").startsWith("cloud-voyage")) return ["voyage"];
  if (String(strategy ?? "").startsWith("local-apple-")) return ["local-apple"];
  return [];
}

function renderMarkdown(value) {
  return [
    "# Provider Challenger Result Gate",
    "",
    `- Status: ${value.status}`,
    `- Counts as live provider challenger benchmark: ${value.countsAsLiveProviderChallengerBenchmark}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Target: ${value.target.path}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Provider Arms",
    ...value.result.providerArms.map((item) =>
      item.answerQuality == null
        ? `- ${item.strategy}: providers=${item.providers.join(",") || "none"}, liveCalls=${item.providerCallsMade}, mockCalls=${item.providerMockCalls}, keyCount=${item.keyCountAvailable}`
        : `- ${item.strategy}: providers=${item.providers.join(",") || "none"}, answerQuality=${item.answerQuality}`,
    ),
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
