import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ?? process.env.RECALLWEAVE_SOTA_LADDER_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ?? process.env.RECALLWEAVE_SOTA_LADDER_MARKDOWN ?? null;
const strict = Boolean(args.strict);
const sourceLockedTargetPath =
  args.target ??
  args.targetFile ??
  process.env.RECALLWEAVE_MEMORYBENCH_TARGET ??
  "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json";
const reportedTargetsPath =
  args.reportedTargets ??
  process.env.RECALLWEAVE_REPORTED_TARGETS_INPUT ??
  "reviews/overnight-20260522/reported-memory-targets-20260525.json";

const evidenceFiles = {
  sourceLockedTarget: sourceLockedTargetPath,
  expandedHybridGate: "reviews/overnight-20260522/public-longmemeval-expanded-hybrid-gate.json",
  expandedAutoresearch: "reviews/overnight-20260522/public-longmemeval-expanded-autoresearch-loop.json",
  metadataAwareAutoresearch: "reviews/overnight-20260522/public-longmemeval-metadata-aware-autoresearch-20260525.json",
  voyageLatencyCanary: "reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider.json",
  localApple4bWarm: "reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-provider-900tok-warm.json",
  queryExpansionPreflight: "reviews/overnight-20260522/query-expansion-preflight-20260525.json",
  queryExpansionLocalQwen36Preflight: "reviews/overnight-20260522/query-expansion-local-qwen36-preflight-20260525.json",
  liveLocalAnswerQuality: "reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json",
  liveProviderAnswerQuality: "reviews/overnight-20260522/end-to-end-memory-score-live-provider-20260525.json",
  combinedAnswerQuality: "reviews/overnight-20260522/end-to-end-memory-score-combined-20260525.json",
  providerPreflightVoyageNvidia: "reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-voyage-nvidia-20260525.json",
  voyageProviderRateLimit: "reviews/overnight-20260522/voyage-provider-rate-limit-20260525.json",
  endToEndMemoryScoreGate: "reviews/overnight-20260522/end-to-end-memory-score-gate-20260525.json",
  readinessNote: "reviews/overnight-20260522/benchmark-sota-readiness-20260525.md",
};

const loaded = Object.fromEntries(Object.entries(evidenceFiles).map(([key, file]) => [key, loadEvidence(file)]));
const reportedTargetsEvidence = runJson([
  "packages/bench/public-benchmark-reported-targets.mjs",
  "--input",
  reportedTargetsPath,
]);
const rows = collectRows(loaded);
const allStrategies = [...new Set(rows.map((row) => row.strategy).filter(Boolean))].sort();

const requiredArms = [
  { id: "bm25-lite", role: "lexical floor", status: hasMemoryStrategy(rows, "bm25-lite") ? "present" : retrievalStatus(rows, ["bm25-lite"]) },
  {
    id: "dense-or-vector-only",
    role: "semantic control",
    status: hasAnyMemoryStrategy(rows, ["dense-proxy", "local-apple-qwen3-0_6b", "local-apple-qwen3-4b"])
      ? "present"
      : retrievalStatus(rows, ["dense-proxy", "local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]),
  },
  { id: "full-hybrid-rerank", role: "intended local hybrid control", status: hasMemoryStrategy(rows, "full-hybrid-rerank") ? "present" : retrievalStatus(rows, ["full-hybrid-rerank"]) },
  {
    id: "provider-voyage4-rerank",
    role: "cloud quality challenger",
    status: hasAnyMemoryStrategy(rows, ["cloud-voyage4-voyage", "cloud-voyage4-voyage-lite-rerank", "cloud-voyage4-lite-voyage-lite"])
      ? "present"
      : retrievalStatus(rows, ["cloud-voyage4-voyage", "cloud-voyage4-voyage-lite-rerank", "cloud-voyage4-lite-voyage-lite"], "retrieval-proxy-present-answer-quality-missing"),
  },
  {
    id: "provider-nvidia-or-gemini",
    role: "non-Voyage provider challenger",
    status: hasAnyMemoryStrategy(rows, [
      "cloud-nvidia-retriever-500m",
      "cloud-nvidia-nemotron-1b",
      "cloud-nvidia-e5-mistral",
      "cloud-gemini-embed-rerank-proxy",
      "cloud-gemini-voyage-rerank",
      "cloud-gemini2-embed-rerank-proxy",
      "cloud-gemini2-voyage-rerank",
    ])
      ? "present"
      : retrievalStatus(
          rows,
          [
            "cloud-nvidia-retriever-500m",
            "cloud-nvidia-nemotron-1b",
            "cloud-nvidia-e5-mistral",
            "cloud-gemini-embed-rerank-proxy",
            "cloud-gemini-voyage-rerank",
            "cloud-gemini2-embed-rerank-proxy",
            "cloud-gemini2-voyage-rerank",
          ],
          "retrieval-proxy-present-answer-quality-missing",
        ),
  },
  {
    id: "local-apple-embedding",
    role: "zero-spend local challenger",
    status: hasAnyMemoryStrategy(rows, ["local-apple-qwen3-0_6b", "local-apple-qwen3-4b"])
      ? "present"
      : retrievalStatus(rows, ["local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]),
  },
  {
    id: "local-apple-reranker-sidecar",
    role: "local rerank method challenger",
    status: hasAnyMemoryStrategy(rows, ["local-apple-qwen3-0_6b-local-rerank", "local-apple-qwen3-4b-local-rerank"])
      ? "present"
      : retrievalStatus(rows, ["local-apple-qwen3-0_6b-local-rerank", "local-apple-qwen3-4b-local-rerank"]),
  },
  {
    id: "llm-query-expansion",
    role: "query expansion challenger",
    status: hasMemoryStrategy(rows, "query-expanded-full-hybrid-rerank")
      ? "present"
      : hasStrategy(rows, "query-expanded-full-hybrid-rerank")
        ? "deterministic-proxy-present-live-llm-missing"
      : "missing-live-result",
  },
];

const componentEvidence = [
  ...arrayOf(reportedTargetsEvidence.componentTargets).map((target) => ({
    id: target.id,
    role: target.componentType,
    modelName: target.modelName,
    benchmark: target.benchmark,
    metricName: target.metricName,
    score: target.score,
    scoreUnit: target.scoreUnit,
    claimUse: target.claimUse,
    source: target.sourceUrl,
    checkedAt: target.retrievedAt,
    finding: target.caveat,
  })),
  {
    id: "query-expansion-retrieval-pipeline",
    role: "query expansion method selector",
    claimUse: "method-selection-only",
    source: "https://arxiv.org/abs/2602.16989",
    finding: "A 2026 retrieval pipeline used LLM-based query expansion before sparse retrieval, dense ranking, and Qwen3 reranking under limited compute.",
  },
];
const benchmarkHarnessEvidence = arrayOf(reportedTargetsEvidence.benchmarkHarnessTargets).map((target) => ({
  id: target.id,
  role: "same-data full-memory benchmark route",
  harnessName: target.harnessName,
  benchmarkFamilies: target.benchmarkFamilies,
  supportedProviders: target.supportedProviders,
  phases: target.phases,
  claimUse: target.claimUse,
  source: target.sourceUrl,
  checkedAt: target.retrievedAt,
  finding: target.caveat,
}));

const queryExpansionPolicy = {
  allowedInLocalBenchmark: true,
  preferredLocalCandidates: [
    {
      id: "small-current-local-llm",
      examples: ["Qwen 3.6 local family", "Gemma 4 local family", "other May-2026 small instruction model"],
      role: "Generate bounded query rewrites before retrieval.",
      requirement: "Must run through an env-only local OpenAI-compatible endpoint and be reported separately from embedding/rerank latency.",
    },
  ],
  cloudExceptionAllowed: true,
  cloudExceptionCandidates: [
    {
      id: "nvidia-query-expansion",
      role: "Use one cloud query-expansion call when local context/quality is the limiting factor.",
      requirement: "Report it as a mixed local-plus-cloud arm, not as a pure local result.",
    },
  ],
  publicClaimRule:
    "Query expansion can improve the method, but it does not count as local-only unless the expansion model runs locally; mixed arms must label the cloud substep.",
};

const reportedMemoryTargets = arrayOf(reportedTargetsEvidence.memoryTargets);
const primaryReportedTarget = reportedTargetsEvidence.primaryReportedMemoryTarget ?? null;
const bestEndToEndMemoryRow = bestEndToEndMemoryScoreRow(rows);
const reportedTargetComparison = compareReportedTarget(bestEndToEndMemoryRow, primaryReportedTarget);
const fullBenchmarkPolicy = buildFullBenchmarkPolicy(loaded);

const checks = {
  sourceLockedTargetPresent: loaded.sourceLockedTarget.exists,
  componentEvidencePresent: componentEvidence.length >= 3,
  sameDataControlRowsPresent: requiredArms.filter((arm) => ["bm25-lite", "dense-or-vector-only", "full-hybrid-rerank"].includes(arm.id)).every((arm) => arm.status === "present"),
  voyageProviderCanaryPresent: requiredArms.find((arm) => arm.id === "provider-voyage4-rerank")?.status === "present",
  nvidiaOrGeminiLiveCanaryPresent: requiredArms.find((arm) => arm.id === "provider-nvidia-or-gemini")?.status === "present",
  localAppleEmbeddingCanaryPresent: requiredArms.find((arm) => arm.id === "local-apple-embedding")?.status === "present",
  localAppleRerankerCanaryPresent: requiredArms.find((arm) => arm.id === "local-apple-reranker-sidecar")?.status === "present",
  llmQueryExpansionLiveCanaryPresent: requiredArms.find((arm) => arm.id === "llm-query-expansion")?.status === "present",
  queryExpansionProxyPresent: requiredArms.find((arm) => arm.id === "llm-query-expansion")?.status === "deterministic-proxy-present-live-llm-missing",
  queryExpansionPreflightPresent: loaded.queryExpansionPreflight.exists,
  queryExpansionPreflightSafe:
    loaded.queryExpansionPreflight.json?.mode === "public-benchmark-query-expansion-preflight" &&
    loaded.queryExpansionPreflight.json?.publicSafe === true &&
    loaded.queryExpansionPreflight.json?.callsProviderApis === false &&
    loaded.queryExpansionPreflight.json?.sendsBenchmarkTextToProvider === false,
  queryExpansionCanBeBenchmarked: loaded.queryExpansionPreflight.json?.readiness?.queryExpansionCanBeBenchmarked === true,
  endToEndMemoryScoreGatePresent: loaded.endToEndMemoryScoreGate.exists,
  endToEndMemoryScoreGateReady: loaded.endToEndMemoryScoreGate.json?.countsAsEndToEndMemoryBenchmark === true,
  liveLocalAnswerQualityPresent: loaded.liveLocalAnswerQuality.json?.memoryBenchAnswerQuality === true && loaded.liveLocalAnswerQuality.json?.fixtureOnly === false,
  liveProviderAnswerQualityPresent:
    loaded.liveProviderAnswerQuality.json?.memoryBenchAnswerQuality === true && loaded.liveProviderAnswerQuality.json?.fixtureOnly === false,
  voyageProviderRateLimited:
    loaded.voyageProviderRateLimit.json?.mode === "provider-benchmark-blocker" &&
    loaded.voyageProviderRateLimit.json?.status === "BLOCKED_VOYAGE_RATE_LIMIT",
  reviewerApprovalsPresent: Number(loaded.endToEndMemoryScoreGate.json?.reviewerApproval?.reviewerApprovalCount ?? 0) >= 2,
  endToEndMemoryScorePresent:
    rows.some((row) => row.memoryBenchAnswerQuality === true && row.retrievalProxyOnly === false) ||
    loaded.endToEndMemoryScoreGate.json?.countsAsEndToEndMemoryBenchmark === true,
  bestEndToEndScoreMeetsReportedTarget: reportedTargetComparison.meetsPrimaryReportedTarget === true,
  publicClaimsAllowedByInputs: rows.some((row) => row.publicBenchmarkClaimsAllowed === true),
  reportedMemoryTargetsPresent: reportedMemoryTargets.length >= 2,
  reportedMemoryTargetsSourceLocked: reportedTargetsEvidence.status === "READY_REPORTED_TARGETS",
  benchmarkHarnessTargetsSourceLocked: reportedTargetsEvidence.checks?.requiredBenchmarkHarnessTargetIdsCovered === true,
  fullOrOfficiallyComparableMemoryBenchmarkPresent: fullBenchmarkPolicy.fullOrOfficiallyComparableRunPresent,
  readinessNotePresent: loaded.readinessNote.exists,
};

const blockers = [
  !checks.reportedMemoryTargetsSourceLocked ? "reported-memory-targets-not-source-locked" : null,
  !checks.benchmarkHarnessTargetsSourceLocked ? "benchmark-harness-targets-not-source-locked" : null,
  !checks.endToEndMemoryScorePresent ? "missing-end-to-end-memory-benchmark-score" : null,
  !checks.publicClaimsAllowedByInputs ? "all-current-result-files-keep-public-claims-disabled" : null,
  !checks.voyageProviderCanaryPresent ? "missing-voyage-answer-quality-same-data-result" : null,
  !checks.nvidiaOrGeminiLiveCanaryPresent ? "missing-nvidia-or-gemini-live-same-data-result" : null,
  checks.endToEndMemoryScorePresent && !checks.bestEndToEndScoreMeetsReportedTarget
    ? "best-end-to-end-score-below-reported-supermemory-target"
    : null,
  !checks.reviewerApprovalsPresent ? "missing-two-independent-memory-score-reviewer-approvals" : null,
  !checks.queryExpansionPreflightPresent ? "missing-query-expansion-preflight" : null,
  !checks.queryExpansionPreflightSafe ? "query-expansion-preflight-not-safe" : null,
  !checks.sameDataControlRowsPresent ? "missing-same-data-control-row" : null,
  !checks.fullOrOfficiallyComparableMemoryBenchmarkPresent ? "missing-full-or-officially-comparable-memory-benchmark-run" : null,
  !checks.sourceLockedTargetPresent ? "missing-source-locked-target" : null,
  ...arrayOf(loaded.endToEndMemoryScoreGate.json?.blockers).map((item) => `end-to-end-gate:${item}`),
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "public-benchmark-sota-ladder",
  status: blockers.length === 0 ? "READY_FOR_REVIEWED_MEMORY_CLAIM" : "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE",
  metricsOnly: true,
  publicSafe: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  printsCredentials: false,
  publicBenchmarkClaimsAllowed: blockers.length === 0,
  componentBenchmarksAreModelSelectionOnly: true,
  mtebCanSelectModelsButCannotProveMemoryQuality: true,
  generatedAt: new Date().toISOString(),
  evidenceFiles: Object.fromEntries(
    Object.entries(loaded).map(([key, value]) => [
      key,
      {
        path: value.path,
        exists: value.exists,
        hash: value.hash,
        mode: value.json?.mode ?? null,
        fixtureOnly: value.json?.fixtureOnly ?? null,
        retrievalProxyOnly: value.json?.retrievalProxyOnly ?? null,
        memoryBenchAnswerQuality: value.json?.memoryBenchAnswerQuality ?? null,
        publicBenchmarkClaimsAllowed: value.json?.publicBenchmarkClaimsAllowed ?? null,
      },
    ]),
  ),
  reportedTargetsEvidence: {
    path: reportedTargetsPath,
    status: reportedTargetsEvidence.status,
    sourceEvidenceCheckedAt: reportedTargetsEvidence.sourceEvidenceCheckedAt,
    primaryReportedMemoryTarget: reportedTargetsEvidence.primaryReportedMemoryTarget?.id ?? null,
    memoryTargetCount: reportedTargetsEvidence.checks?.memoryTargetCount ?? 0,
    componentTargetCount: reportedTargetsEvidence.checks?.componentTargetCount ?? 0,
    benchmarkHarnessTargetCount: reportedTargetsEvidence.checks?.benchmarkHarnessTargetCount ?? 0,
    blockers: reportedTargetsEvidence.blockers ?? [],
  },
  componentEvidence,
  benchmarkHarnessEvidence,
  queryExpansionPolicy,
  fullBenchmarkPolicy,
  reportedMemoryTargets,
  reportedTargetComparison,
  requiredFullMemoryArms: requiredArms,
  observedStrategies: allStrategies,
  bestObservedRows: summarizeBestRows(rows),
  checks,
  blockers,
  nextActions: nextActions(blockers),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "sota ladder report");
assertSafePublicText(markdownText, "sota ladder markdown report");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(args.format === "markdown" ? markdownText : jsonText);
if (strict && blockers.length > 0) process.exit(1);

function collectRows(loadedEvidence) {
  const rowsOut = [];
  for (const [sourceKey, evidence] of Object.entries(loadedEvidence)) {
    const json = evidence.json;
    if (!json || typeof json !== "object") continue;
    for (const row of json.strategies ?? json.arms ?? []) {
      rowsOut.push({
        sourceKey,
        sourcePath: evidence.path,
        strategy: row.strategy ?? row.armId ?? null,
        metrics: row.metrics ?? null,
        answerModel: extractActualAnswerModel(json),
        judgeModel: extractActualJudgeModel(json),
        fixtureOnly: Boolean(json.fixtureOnly),
        retrievalProxyOnly: Boolean(json.retrievalProxyOnly),
        memoryBenchAnswerQuality: Boolean(json.memoryBenchAnswerQuality),
        publicBenchmarkClaimsAllowed: Boolean(json.publicBenchmarkClaimsAllowed),
      });
    }
  }
  return rowsOut;
}

function summarizeBestRows(rowsIn) {
  const scored = rowsIn.filter((row) => Number.isFinite(Number(row.metrics?.quality ?? row.metrics?.answerQuality)));
  const bestByStrategy = new Map();
  for (const row of scored) {
    const current = bestByStrategy.get(row.strategy);
    const quality = metricQuality(row);
    const latency = metricLatency(row);
    const currentQuality = current ? metricQuality(current) : Number.NEGATIVE_INFINITY;
    const currentLatency = current ? metricLatency(current) : Number.POSITIVE_INFINITY;
    if (!current || quality > currentQuality || (quality === currentQuality && latency < currentLatency)) {
      bestByStrategy.set(row.strategy, row);
    }
  }
  return [...bestByStrategy.values()]
    .sort((a, b) => metricQuality(b) - metricQuality(a) || metricLatency(a) - metricLatency(b))
    .slice(0, 12)
    .map((row) => ({
      strategy: row.strategy,
      sourcePath: row.sourcePath,
      quality: metricQuality(row),
      answerQuality: row.metrics.answerQuality ?? null,
      pAt1: row.metrics.pAt1,
      recallAt5: row.metrics.recallAt5,
      ndcgAt10: row.metrics.ndcgAt10,
      latencyP50Ms: metricLatency(row),
      retrievalProxyOnly: row.retrievalProxyOnly,
      memoryBenchAnswerQuality: row.memoryBenchAnswerQuality,
      publicBenchmarkClaimsAllowed: row.publicBenchmarkClaimsAllowed,
    }));
}

function bestEndToEndMemoryScoreRow(rowsIn) {
  const candidates = rowsIn.filter((row) => row.memoryBenchAnswerQuality === true && row.retrievalProxyOnly === false);
  return candidates.sort((a, b) => metricQuality(b) - metricQuality(a) || metricLatency(a) - metricLatency(b))[0] ?? null;
}

function compareReportedTarget(row, target) {
  const score = row ? metricQuality(row) : null;
  const targetScore = target ? Number(target.score) : null;
  const meetsPrimaryReportedTarget =
    score != null && targetScore != null && Number.isFinite(score) && Number.isFinite(targetScore) && score >= targetScore;
  return {
    primaryTarget: target
      ? {
          id: target.id,
          benchmark: target.benchmark,
          score: target.score,
          scoreUnit: target.scoreUnit,
          judge: target.judge ?? target.judgeModel,
          source: target.source ?? target.sourceUrl,
          caveat: target.caveat,
        }
      : null,
    bestObserved: row
      ? {
          strategy: row.strategy,
          sourcePath: row.sourcePath,
          score,
          scoreUnit: "answer-quality percent",
          answerModel: row.answerModel ?? null,
          judgeModel: row.judgeModel ?? null,
          memoryBenchAnswerQuality: row.memoryBenchAnswerQuality,
          retrievalProxyOnly: row.retrievalProxyOnly,
          publicBenchmarkClaimsAllowed: row.publicBenchmarkClaimsAllowed,
        }
      : null,
    scoreDelta: score != null && targetScore != null ? Number((score - targetScore).toFixed(4)) : null,
    sameJudgeModelAsPrimaryTarget:
      row?.judgeModel != null && target?.judge != null && normalizeModel(row.judgeModel) === normalizeModel(target.judge),
    meetsPrimaryReportedTarget,
    matchingBenchmarkSemanticsRequired: true,
    comparisonRule:
      "Direct Supermemory usage is optional when quota-blocked, but RecallWeave cannot claim SOTA unless a same-benchmark, same-scoring full-memory result meets or beats the selected reported Supermemory target.",
  };
}

function extractActualAnswerModel(result) {
  return firstString(
    result?.provider?.answerModel,
    result?.input?.answerModel,
    result?.answerModel,
    result?.models?.answerModel,
    result?.model?.answerModel,
  );
}

function extractActualJudgeModel(result) {
  return firstString(
    result?.provider?.judgeModel,
    result?.input?.judgeModel,
    result?.judgeModel,
    result?.models?.judgeModel,
    result?.model?.judgeModel,
  );
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function normalizeModel(value) {
  return String(value ?? "").trim().toLowerCase();
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function buildFullBenchmarkPolicy(loadedEvidence) {
  const sourceTarget = loadedEvidence.sourceLockedTarget.json;
  const targetClaimTier = sourceTarget?.claimTier ?? null;
  const benchmarkFamily = sourceTarget?.benchmark?.family ?? sourceTarget?.benchmark?.name ?? null;
  const datasetSlice = sourceTarget?.benchmark?.split ?? null;
  const reports = [
    loadedEvidence.combinedAnswerQuality.json,
    loadedEvidence.liveLocalAnswerQuality.json,
    loadedEvidence.liveProviderAnswerQuality.json,
  ].filter(Boolean);
  const currentAnswerQualityQueryCount = reports.reduce(
    (max, reportItem) => Math.max(max, Number(reportItem.input?.scoredQueryCount ?? reportItem.input?.queryCount ?? 0)),
    0,
  );
  const minimumFullQueryCount = String(benchmarkFamily ?? "").toLowerCase().includes("longmemeval") ? 500 : null;
  const fullQueryCountPresent = minimumFullQueryCount == null ? false : currentAnswerQualityQueryCount >= minimumFullQueryCount;
  const officiallyComparableClaimTier = ["public-benchmark", "full-benchmark", "officially-comparable", "broad-sota"].includes(
    String(targetClaimTier ?? ""),
  );
  return {
    requirement: "Broad SOTA or production-replacement wording requires a full benchmark run or an explicitly official comparable target, not only a 30-query canary.",
    benchmarkFamily,
    datasetSlice,
    targetClaimTier,
    currentAnswerQualityQueryCount,
    minimumFullQueryCount,
    fullQueryCountPresent,
    officiallyComparableClaimTier,
    fullOrOfficiallyComparableRunPresent: fullQueryCountPresent || officiallyComparableClaimTier,
    currentCanaryOnly: !fullQueryCountPresent && !officiallyComparableClaimTier,
  };
}

function metricQuality(row) {
  return Number(row.metrics?.answerQuality ?? row.metrics?.quality ?? 0);
}

function metricLatency(row) {
  return Number(row.metrics?.answerLatencyP50Ms ?? row.metrics?.latencyP50Ms ?? Number.POSITIVE_INFINITY);
}

function nextActions(blockersIn) {
  if (blockersIn.length === 0) {
    return [
      "Package the metrics-only result and send it to independent reviewers.",
      "Run the UI, docs, and release-note checks against the reviewed result before launch.",
    ];
  }
  return [
    "Use MTEB and model-card evidence only to choose embedding and reranker candidates.",
    "Run the full LongMemEval-S or officially comparable MemoryBench target before broad SOTA or production-replacement wording.",
    "Run the missing provider answer-quality challengers on the same source-locked target before any SOTA or production replacement claim.",
    "Add Voyage and NVIDIA or Gemini answer-quality arms to the same end-to-end memory score packet.",
    "Keep the local query-expansion and local-rerank arms, but label them as local-only evidence until provider challengers and reviewers pass.",
    "Promote no method until an end-to-end memory score beats the reported target under matching metric definitions.",
    "Send the exact metrics-only packet to Gemini/Claude or NVIDIA/DeepSeek-style reviewers before release wording changes.",
  ];
}

function renderMarkdown(value) {
  const lines = [
    "# Public Benchmark SOTA Ladder",
    "",
    `- Status: ${value.status}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- MTEB/component evidence is model-selection only: ${value.componentBenchmarksAreModelSelectionOnly}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Required Full Memory Arms",
    ...value.requiredFullMemoryArms.map((arm) => `- ${arm.id}: ${arm.status} (${arm.role})`),
    "",
    "## Benchmark Harness Evidence",
    ...value.benchmarkHarnessEvidence.map(
      (target) =>
        `- ${target.id}: ${target.harnessName}; families=${target.benchmarkFamilies.join(", ")}; providers=${target.supportedProviders.join(", ")}; use=${target.claimUse}`,
    ),
    "",
    "## Reported Target Comparison",
    `- Primary reported target: ${value.reportedTargetComparison.primaryTarget?.id ?? "n/a"} (${value.reportedTargetComparison.primaryTarget?.score ?? "n/a"} ${value.reportedTargetComparison.primaryTarget?.scoreUnit ?? ""})`,
    `- Best end-to-end RecallWeave row: ${value.reportedTargetComparison.bestObserved?.strategy ?? "n/a"} (${value.reportedTargetComparison.bestObserved?.score ?? "n/a"})`,
    `- Best row judge model: ${value.reportedTargetComparison.bestObserved?.judgeModel ?? "n/a"}`,
    `- Same judge as primary target: ${value.reportedTargetComparison.sameJudgeModelAsPrimaryTarget}`,
    `- Meets reported target: ${value.reportedTargetComparison.meetsPrimaryReportedTarget}`,
    "",
    "## Full Benchmark Policy",
    `- Current answer-quality query count: ${value.fullBenchmarkPolicy.currentAnswerQualityQueryCount}`,
    `- Minimum full query count: ${value.fullBenchmarkPolicy.minimumFullQueryCount ?? "n/a"}`,
    `- Officially comparable target tier: ${value.fullBenchmarkPolicy.officiallyComparableClaimTier}`,
    `- Full or officially comparable run present: ${value.fullBenchmarkPolicy.fullOrOfficiallyComparableRunPresent}`,
    "",
    "## Best Observed Rows",
    ...value.bestObservedRows.map(
      (row) =>
        `- ${row.strategy}: quality ${row.quality}, answerQuality ${row.answerQuality ?? "n/a"}, P@1 ${row.pAt1 ?? "n/a"}, nDCG@10 ${row.ndcgAt10 ?? "n/a"}, p50 ${row.latencyP50Ms} ms, retrievalProxyOnly=${row.retrievalProxyOnly}, memoryBenchAnswerQuality=${row.memoryBenchAnswerQuality}`,
    ),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function hasStrategy(rowsIn, strategy) {
  return rowsIn.some((row) => row.strategy === strategy);
}

function hasMemoryStrategy(rowsIn, strategy) {
  return rowsIn.some((row) => row.strategy === strategy && row.memoryBenchAnswerQuality === true && row.retrievalProxyOnly === false);
}

function hasAnyStrategy(rowsIn, strategies) {
  const wanted = new Set(strategies);
  return rowsIn.some((row) => wanted.has(row.strategy));
}

function hasAnyMemoryStrategy(rowsIn, strategies) {
  const wanted = new Set(strategies);
  return rowsIn.some((row) => wanted.has(row.strategy) && row.memoryBenchAnswerQuality === true && row.retrievalProxyOnly === false);
}

function retrievalStatus(rowsIn, strategies, presentStatus = "retrieval-proxy-present-answer-quality-missing") {
  return hasAnyStrategy(rowsIn, strategies) ? presentStatus : "missing-live-result";
}

function loadEvidence(file) {
  const path = file;
  const abs = resolve(root, file);
  if (!existsSync(abs)) return { path, exists: false, hash: null, json: null };
  const text = readFileSync(abs, "utf8");
  assertSafePublicText(text, file);
  let json = null;
  if (file.endsWith(".json")) json = JSON.parse(text);
  return { path, exists: true, hash: `sha256:${sha256(text)}`, json };
}

function runJson(nodeArgs) {
  const result = spawnSync("node", nodeArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `command failed: ${nodeArgs.join(" ")}\n${result.stderr}`);
  assertSafePublicText(result.stdout, nodeArgs.join(" "));
  return JSON.parse(result.stdout);
}

function writeOutput(path, text) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  assert.ok(!secretPattern.test(text), `${label} appears to contain a credential`);
}
