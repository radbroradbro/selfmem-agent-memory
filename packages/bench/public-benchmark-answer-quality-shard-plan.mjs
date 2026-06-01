import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const targetPath = resolveInputPath(args.target ?? "reviews/overnight-20260522/public-longmemeval-full-run-target.json");
const materializeReportPath = resolveInputPath(
  args.materializeReport ?? "reviews/overnight-20260522/public-longmemeval-full-materialize-run.json",
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const shardSize = positiveInt(args.shardSize ?? 25, "shard size");
const claimScope = String(args.claimScope ?? process.env.RECALLWEAVE_ANSWER_QUALITY_CLAIM_SCOPE ?? "full-sota").trim();
const strategies = splitList(args.strategies ?? defaultStrategies(claimScope).join(","));
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 300_000_000, "max memory bytes");
const resultPrefix = claimScope === "full-sota" ? "answer-quality" : `answer-quality-${claimScope}`;
const benchmarkSupermemoryDisableEnv = [
  "RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1",
  "SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1",
];

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
const knownStrategies = new Set([
  "bm25-lite",
  "full-hybrid-rerank",
  "query-expanded-full-hybrid-rerank",
  "wiki-title-amplified-hybrid",
  "wiki-subtopic-amplified-hybrid",
  "wiki-summary-session-hybrid",
  "cloud-voyage4-voyage",
  "cloud-voyage4-voyage-lite-rerank",
  "cloud-voyage4-lite-voyage-lite",
  "cloud-gemini-embed-rerank-proxy",
  "cloud-gemini-voyage-rerank",
  "cloud-gemini2-embed-rerank-proxy",
  "cloud-gemini2-voyage-rerank",
  "cloud-nvidia-retriever-500m",
  "cloud-nvidia-nemotron-1b",
  "cloud-nvidia-nemotron-vl-1b",
  "cloud-nvidia-e5-mistral",
  "cloud-nvidia-code",
  "cloud-nvidia-nv-embed-v1-mistral-rerank",
  "cloud-nvidia-embedcode-7b-mistral-rerank",
  "local-apple-qwen3-0_6b",
  "local-apple-qwen3-0_6b-local-rerank",
  "local-apple-qwen3-4b",
  "local-apple-qwen3-4b-local-rerank",
]);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(
  ["full-sota", "local-full", "model-challenger"].includes(claimScope),
  "--claim-scope must be full-sota, local-full, or model-challenger",
);
assert.ok(existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `target empty: ${displayPath(targetPath)}`);
assert.ok(existsSync(materializeReportPath), `materialize report missing: ${displayPath(materializeReportPath)}`);
assert.ok(statSync(materializeReportPath).size > 0, `materialize report empty: ${displayPath(materializeReportPath)}`);
for (const strategy of strategies) assert.ok(knownStrategies.has(strategy), `unknown strategy: ${strategy}`);

const targetRaw = readFileSync(targetPath, "utf8");
const materializeRaw = readFileSync(materializeReportPath, "utf8");
assertSafePublicText(targetRaw, "target");
assertSafePublicText(materializeRaw, "materialize report");
const target = JSON.parse(targetRaw);
const materialize = JSON.parse(materializeRaw);
const memoryMethod = String(materialize.selection?.memoryMethod ?? materialize.target?.memoryMethod ?? "session-v1");
const scoringPolicy = scoringPolicyForClaimScope(claimScope);
const targetHash = `sha256:${sha256(targetRaw)}`;
const materializeHash = `sha256:${sha256(materializeRaw)}`;
const queryCount = Number(materialize.selection?.queryCount ?? materialize.selection?.selectedCount ?? materialize.sourceRetention?.selectedRawRowsCount ?? 0);
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? materialize.target?.contextTokenBudget ?? target.benchmark?.contextTokenBudget ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? materialize.target?.limit ?? target.benchmark?.limit ?? 5, "limit");
const shards = buildShards(queryCount, shardSize, { targetHash });
const coverage = strategyCoverage(strategies);
const providerHybridContract = buildProviderHybridContract(strategies, coverage, claimScope);
const executionLanes = buildExecutionLanes(strategies, claimScope);
const privateOutputRoles = new Map((materialize.privateOutputs?.files ?? []).map((file) => [file.role, file]));
const checks = {
  targetIsLongMemEvalRunOnly: target.fixtureOnly === false && target.benchmark?.family === "longmemeval" && target.claimTier === "run-only",
  materializeReportMode: materialize.mode === "public-benchmark-materialize-run",
  materializeTargetHashMatches: materialize.target?.targetFileHash === targetHash,
  fullQueryCountPresent: queryCount >= 500,
  rawSourcesRetainedPrivate: materialize.rawSourcesRetainedPrivate === true,
  rawDatasetRetainedPrivate: materialize.sourceRetention?.rawDatasetRetainedPrivate === true,
  selectedRawRowsRetainedPrivate: materialize.sourceRetention?.selectedRawRowsRetainedPrivate === true,
  sourceManifestRetainedPrivate: materialize.sourceRetention?.sourceManifestRetainedPrivate === true,
  rawTextPubliclyExcluded: materialize.sourceRetention?.rawTextPubliclyIncluded === false,
  privateOutputPathExcluded: materialize.sourceRetention?.privateOutputPathIncluded === false,
  querySetPrivateOutputPresent: privateOutputRoles.get("queryset")?.rawTextPrivate === true,
  memoriesPrivateOutputPresent: privateOutputRoles.get("memories")?.rawTextPrivate === true,
  answerLabelsPrivateOutputPresent: privateOutputRoles.get("answer-labels")?.rawTextPrivate === true,
  rawDatasetPrivateOutputPresent: privateOutputRoles.get("raw-dataset")?.rawTextPrivate === true,
  selectedRawRowsPrivateOutputPresent: privateOutputRoles.get("selected-raw-rows")?.rawTextPrivate === true,
  sourceManifestPrivateOutputPresent: privateOutputRoles.has("source-manifest"),
  answerModelPresent: typeof target.benchmark?.answerModel === "string" && target.benchmark.answerModel.length > 0,
  judgeModelPresent: typeof target.benchmark?.judgeModel === "string" && target.benchmark.judgeModel.length > 0,
  bm25ControlPresent: coverage.hasBm25Lite,
  fullHybridControlPresent: coverage.hasFullHybridRerank,
  queryExpansionPresent: coverage.hasQueryExpansion,
  voyageProviderPresent: coverage.hasVoyageProvider,
  nvidiaOrGeminiProviderPresent: coverage.hasNvidiaOrGeminiProvider,
  localApplePresent: coverage.hasLocalApple,
  localRerankPresent: coverage.hasLocalRerank,
  shardCoverageComplete: shards.length > 0 && shards[0].startIndex === 0 && shards.at(-1).endIndexExclusive === queryCount,
};
const requiredChecks = requiredChecksForClaimScope(claimScope);
const blockers = requiredChecks.filter((key) => checks[key] !== true).map((key) => kebab(key));
const ready = blockers.length === 0;

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "public-benchmark-answer-quality-shard-plan",
  status: ready ? "READY_FULL_ANSWER_QUALITY_SHARD_RUN" : "BLOCKED_FULL_ANSWER_QUALITY_SHARD_RUN",
  claimScope,
  scoringPolicy,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  readyForAnswerQualityShardRun: ready,
  readyForEndToEndMemoryScoreGate: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  generatedAt: new Date().toISOString(),
  target: {
    path: displayPath(targetPath),
    hash: targetHash,
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
    claimTier: target.claimTier ?? null,
    answerModel: target.benchmark?.answerModel ?? null,
    judgeModel: target.benchmark?.judgeModel ?? null,
    answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
  },
  materializeReport: {
    path: displayPath(materializeReportPath),
    hash: materializeHash,
    targetFileHash: materialize.target?.targetFileHash ?? null,
    querySetHash: materialize.selection?.querySetHash ?? null,
    collectorCompatibleQuerySetHash: materialize.selection?.collectorCompatibleQuerySetHash ?? null,
    answerLabelsHash: materialize.selection?.answerLabelsHash ?? null,
    materializerHash: materialize.selection?.materializerHash ?? null,
    selectedRawRowsCount: materialize.sourceRetention?.selectedRawRowsCount ?? null,
    rawDatasetHash: materialize.sourceRetention?.rawDatasetHash ?? null,
    selectedRawRowsHash: materialize.sourceRetention?.selectedRawRowsHash ?? null,
    sourceManifestHash: materialize.sourceRetention?.sourceManifestHash ?? null,
    privateOutputRoles: [...privateOutputRoles.keys()].sort(),
  },
  strategyCoverage: coverage,
  providerHybridContract,
  coverageRequirements: Object.fromEntries(requiredChecks.map((key) => [key, true])),
  runPlan: {
    claimScope,
    scoringPolicy,
    supermemorySearchPolicy: "disabled-for-benchmark-methodology",
    supermemorySearchDisabledEnv: benchmarkSupermemoryDisableEnv,
    queryCount,
    shardSize,
    shardCount: shards.length,
    contextTokenBudget,
    limit,
    maxMemoryBytes,
    strategies,
    privateInputDirectoryLabel: "<private-output-dir>",
    privateShardDirectoryLabel: "<private-output-dir>/shards/{shardId}",
    publicOutputDirectoryLabel: "<public-review-dir>",
    materializeCommand: materializeCommand(),
    shardMaterializeTemplate: shardMaterializeTemplate(),
    responseArmExportTemplate: responseArmExportTemplate(),
    preflightTemplate: preflightTemplate(),
    answerQualityTemplate: answerQualityTemplate(),
    combineCommand: combineCommand(shards),
    resultGateCommand: resultGateCommand(),
    reviewerIntakeCommand: reviewerIntakeCommand(),
  },
  executionLanes,
  shards,
  checks,
  blockers,
  nextActions: ready
    ? [
        "Run shard-scoped materialization before each response arm export so provider and local arms load only the shard-local private corpus.",
        "Run response arm exports shard-by-shard with explicit provider-call consent; add query expansion only as a labeled ablation.",
        "Run shard-aware answer-quality preflight for each shard before model-scored answer quality.",
        answerQualityScoringAction(claimScope),
        "Combine the full query-shard result set, then run the memory-score gate and reviewer intake on the combined metrics-only packet.",
        resultClaimAction(claimScope),
      ]
    : [
        "Regenerate the full LongMemEval-S materialization and preserve the private raw-source outputs outside the repository.",
        missingLaneAction(claimScope),
        "Re-run this shard plan with --require-ready before starting the full answer-quality run.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "answer-quality shard plan");
assertSafePublicText(markdownText, "answer-quality shard plan markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function buildShards(totalQueryCount, requestedShardSize, options) {
  const items = [];
  for (let startIndex = 0; startIndex < totalQueryCount; startIndex += requestedShardSize) {
    const endIndexExclusive = Math.min(totalQueryCount, startIndex + requestedShardSize);
    const ordinal = String(items.length + 1).padStart(3, "0");
    const id = `shard-${ordinal}`;
    items.push({
      id,
      startIndex,
      endIndexExclusive,
      queryCount: endIndexExclusive - startIndex,
      rangeHash: `sha256:${sha256(JSON.stringify({ targetHash: options.targetHash, startIndex, endIndexExclusive, totalQueryCount }))}`,
      privateShardDirectoryLabel: `<private-output-dir>/shards/${id}`,
      materializedDirectoryLabel: `<private-output-dir>/shards/${id}/materialized`,
      armOutputDirectoryLabel: `<private-output-dir>/shards/${id}/arms`,
      answerQualityOutputLabel: `<public-review-dir>/${resultPrefix}-${id}.json`,
      answerQualityMarkdownLabel: `<public-review-dir>/${resultPrefix}-${id}.md`,
    });
  }
  return items;
}

function strategyCoverage(items) {
  return {
    hasBm25Lite: items.includes("bm25-lite"),
    hasFullHybridRerank: items.includes("full-hybrid-rerank"),
    hasQueryExpansion: items.includes("query-expanded-full-hybrid-rerank"),
    hasWikiAmplification: items.some((item) => item.startsWith("wiki-")),
    hasVoyageProvider: items.some((item) => item.startsWith("cloud-voyage")),
    hasNvidiaOrGeminiProvider: items.some((item) => item.startsWith("cloud-nvidia") || item.startsWith("cloud-gemini")),
    hasLocalApple: items.some((item) =>
      ["local-apple-qwen3-0_6b", "local-apple-qwen3-0_6b-local-rerank", "local-apple-qwen3-4b", "local-apple-qwen3-4b-local-rerank"].includes(item),
    ),
    hasLocalRerank: items.some((item) => item.endsWith("-local-rerank")),
    strategyCount: items.length,
  };
}

function buildProviderHybridContract(items, coverageValue, scope) {
  const cloudProviderStrategies = items.filter(isCloudProviderStrategy).sort();
  const providerChallengerPresent = coverageValue.hasVoyageProvider || coverageValue.hasNvidiaOrGeminiProvider;
  return {
    bm25LexicalFloorRequired: true,
    fullHybridControlRequired: true,
    sameShardControlsRequired: true,
    providerChallengersAreHybridContextArms: true,
    providerOnlyDenseClaimsAllowed: false,
    providerChallengerPresent,
    providerChallengerControlsPresent: !providerChallengerPresent || (coverageValue.hasBm25Lite && coverageValue.hasFullHybridRerank),
    cloudProviderStrategies,
    localAppleIsSeparateLocalProviderLane: coverageValue.hasLocalApple,
    acceptedLaneMustScoreControlsAndProvidersTogether: scope === "full-sota" || scope === "model-challenger",
  };
}

function isCloudProviderStrategy(strategy) {
  return strategy.startsWith("cloud-voyage") || strategy.startsWith("cloud-gemini") || strategy.startsWith("cloud-nvidia");
}

function buildExecutionLanes(items, scope) {
  const laneDefinitions = [
    {
      id: "deterministic-control-proxy",
      label: "Deterministic control/proxy lane",
      strategies: ["bm25-lite", "full-hybrid-rerank"],
      operatorUse: "Run-path and shard-integrity proof only. This does not score local or provider model quality.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "Query expansion is excluded by default and may be added only as a labeled ablation lane.",
      queryExpansionEvidenceRequirement: "not-required",
      queryExpansionDiagnosticFallbackAllowed: true,
      queryExpansionSotaEligible: false,
    },
    {
      id: "local-apple-no-spend",
      label: "Local Apple no-spend lane",
      strategies: [
        "bm25-lite",
        "full-hybrid-rerank",
        "local-apple-qwen3-0_6b",
        "local-apple-qwen3-0_6b-local-rerank",
      ],
      operatorUse: "Use first when validating the no-spend local method before cloud challenger spend.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "Query expansion is off by default; score it only as a same-shard ablation when explicitly requested.",
      queryExpansionEvidenceRequirement: "not-required",
      queryExpansionDiagnosticFallbackAllowed: true,
      queryExpansionSotaEligible: false,
    },
    {
      id: "local-apple-scaled-challenger",
      label: "Scaled local Apple challenger lane",
      strategies: [
        "bm25-lite",
        "full-hybrid-rerank",
        "local-apple-qwen3-4b",
        "local-apple-qwen3-4b-local-rerank",
      ],
      operatorUse: "Use as an overnight/local methodology challenger when the 4B runtime is stable; do not merge it into the 0.6B accepted lane.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "Query expansion is off by default; score it only as a same-shard ablation when explicitly requested.",
      queryExpansionEvidenceRequirement: "not-required",
      queryExpansionDiagnosticFallbackAllowed: true,
      queryExpansionSotaEligible: false,
    },
    {
      id: "voyage-minimum-challenger",
      label: "Voyage minimum challenger lane",
      strategies: ["bm25-lite", "full-hybrid-rerank", "cloud-voyage4-lite-voyage-lite"],
      operatorUse: "Use when Voyage quota is available to unblock the same-data Voyage answer-quality comparison.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "No separate query-expansion claim unless a query-expansion arm is included and scored.",
      queryExpansionEvidenceRequirement: "not-required",
      queryExpansionDiagnosticFallbackAllowed: false,
      queryExpansionSotaEligible: false,
    },
    {
      id: "gemini2-minimum-challenger",
      label: "Gemini Embedding 2 minimum challenger lane",
      strategies: ["bm25-lite", "full-hybrid-rerank", "cloud-gemini2-embed-rerank-proxy"],
      operatorUse: "Use with direct Gemini API credentials to test Gemini Embedding 2 without spending Voyage rerank quota.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "No separate query-expansion claim unless a query-expansion arm is included and scored.",
      queryExpansionEvidenceRequirement: "not-required",
      queryExpansionDiagnosticFallbackAllowed: false,
      queryExpansionSotaEligible: false,
    },
    {
      id: "nvidia-minimum-challenger",
      label: "NVIDIA minimum challenger lane",
      strategies: ["bm25-lite", "full-hybrid-rerank", "cloud-nvidia-nv-embed-v1-mistral-rerank"],
      operatorUse: "Use for an NVIDIA challenger comparison without spending Voyage quota.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "No separate query-expansion claim unless a query-expansion arm is included and scored.",
      queryExpansionEvidenceRequirement: "not-required",
      queryExpansionDiagnosticFallbackAllowed: false,
      queryExpansionSotaEligible: false,
    },
    ...(scope === "local-full"
      ? [
          {
            id: "local-full-accepted-shards",
            label: "Full local answer-quality shard-intake lane",
            strategies: items,
            operatorUse:
              "Use this lane for the full 500-query local method benchmark before spending on cloud challengers.",
            acceptedByFullShardIntake: true,
            canReachFullSotaGateAfterShardIntake: false,
            queryExpansionPolicy:
              "Local Apple and local rerank arms must be present on the same shards; query expansion is optional and must be labeled as an ablation.",
            queryExpansionEvidenceRequirement: "not-required",
            queryExpansionDiagnosticFallbackAllowed: false,
            queryExpansionSotaEligible: false,
          },
        ]
      : scope === "model-challenger"
        ? [
            {
              id: "model-challenger-accepted-shards",
              label: "Full model-challenger shard-intake lane",
              strategies: items,
              operatorUse:
                "Use this lane for a full same-data challenger-model run; it cannot support public SOTA claims against exact-target reports.",
              acceptedByFullShardIntake: true,
              canReachFullSotaGateAfterShardIntake: false,
              queryExpansionPolicy:
                "Cloud provider challengers must be present on the same shards; query expansion is optional and must be labeled as an ablation.",
              queryExpansionEvidenceRequirement: "not-required",
              queryExpansionDiagnosticFallbackAllowed: false,
              queryExpansionSotaEligible: false,
            },
          ]
      : [
          {
            id: "full-sota-accepted-shards",
            label: "Full SOTA shard-intake lane",
            strategies: items,
            operatorUse: "Only this lane has the complete strategy set expected by shard intake and combine.",
            acceptedByFullShardIntake: true,
            canReachFullSotaGateAfterShardIntake: true,
            queryExpansionPolicy:
              "Local rerank, local Apple, and provider challengers must all be present on the same shards; query expansion is optional and must be labeled as an ablation.",
            queryExpansionEvidenceRequirement: "not-required",
            queryExpansionDiagnosticFallbackAllowed: false,
            queryExpansionSotaEligible: true,
          },
        ]),
  ];

  return laneDefinitions.map((lane) => {
    const missingStrategies = lane.strategies.filter((strategy) => !items.includes(strategy));
    return {
      id: lane.id,
      label: lane.label,
      operatorUse: lane.operatorUse,
      strategies: lane.strategies,
      strategyCount: lane.strategies.length,
      missingStrategies,
      coverageReady: missingStrategies.length === 0,
      providerRequirements: unique(lane.strategies.flatMap(requiredProvidersForStrategy)),
      consentRequirements: [
        "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
        "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
        "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
      ],
      answerQualityEndpoint: {
        baseUrlEnv: "RECALLWEAVE_MEMORYBENCH_BASE_URL",
        apiKeyEnv: "RECALLWEAVE_MEMORYBENCH_API_KEY",
        answerModel: scoringPolicy.answerModelTemplate,
        judgeModel: scoringPolicy.judgeModelTemplate,
        targetAnswerModel: target.benchmark?.answerModel ?? null,
        targetJudgeModel: target.benchmark?.judgeModel ?? null,
        requiredAnswerModel: scoringPolicy.exactTargetModelsRequired ? target.benchmark?.answerModel ?? null : null,
        requiredJudgeModel: scoringPolicy.exactTargetModelsRequired ? target.benchmark?.judgeModel ?? null : null,
        modelMatchPolicy: scoringPolicy.modelMatchPolicy,
        exactTargetModelsRequired: scoringPolicy.exactTargetModelsRequired,
        localDiagnosticModelAllowed: scoringPolicy.localDiagnosticModelAllowed,
        challengerModelAllowed: scoringPolicy.challengerModelAllowed,
      },
      acceptedByFullShardIntake: lane.acceptedByFullShardIntake,
      canReachFullSotaGateAfterShardIntake: lane.canReachFullSotaGateAfterShardIntake,
      countsAsFullMemorySotaEvidence: false,
      publicBenchmarkClaimsAllowed: false,
      queryExpansionPolicy: lane.queryExpansionPolicy,
      queryExpansionEvidenceRequirement: lane.queryExpansionEvidenceRequirement,
      queryExpansionDiagnosticFallbackAllowed: lane.queryExpansionDiagnosticFallbackAllowed,
      queryExpansionSotaEligible: lane.queryExpansionSotaEligible,
      shardIntakeCompatibility: lane.acceptedByFullShardIntake
        ? lane.canReachFullSotaGateAfterShardIntake
          ? "accepted only after every planned shard returns with this complete strategy set"
          : `accepted for this ${scope} benchmark plan only; full-SOTA intake still requires the exact-target provider comparison plan`
        : "diagnostic subset only; full-shard intake rejects it as strategy-set mismatch",
    };
  });
}

function requiredChecksForClaimScope(scope) {
  const base = [
    "targetIsLongMemEvalRunOnly",
    "materializeReportMode",
    "materializeTargetHashMatches",
    "fullQueryCountPresent",
    "rawSourcesRetainedPrivate",
    "rawDatasetRetainedPrivate",
    "selectedRawRowsRetainedPrivate",
    "sourceManifestRetainedPrivate",
    "rawTextPubliclyExcluded",
    "privateOutputPathExcluded",
    "querySetPrivateOutputPresent",
    "memoriesPrivateOutputPresent",
    "answerLabelsPrivateOutputPresent",
    "rawDatasetPrivateOutputPresent",
    "selectedRawRowsPrivateOutputPresent",
    "sourceManifestPrivateOutputPresent",
    "answerModelPresent",
    "judgeModelPresent",
    "bm25ControlPresent",
    "fullHybridControlPresent",
    "localApplePresent",
    "localRerankPresent",
    "shardCoverageComplete",
  ];
  if (scope === "local-full") return base;
  if (scope === "model-challenger") {
    return base.filter((key) => key !== "localApplePresent" && key !== "localRerankPresent").concat([
      "voyageProviderPresent",
      "nvidiaOrGeminiProviderPresent",
    ]);
  }
  return [...base, "voyageProviderPresent", "nvidiaOrGeminiProviderPresent"];
}

function requiredProvidersForStrategy(strategy) {
  if (
    strategy === "cloud-voyage4-voyage" ||
    strategy === "cloud-voyage4-voyage-lite-rerank" ||
    strategy === "cloud-voyage4-lite-voyage-lite"
  ) return ["voyage"];
  if (strategy === "cloud-gemini-embed-rerank-proxy" || strategy === "cloud-gemini2-embed-rerank-proxy") return ["gemini"];
  if (strategy === "cloud-gemini-voyage-rerank" || strategy === "cloud-gemini2-voyage-rerank") return ["gemini", "voyage"];
  if (strategy.startsWith("cloud-nvidia-")) return ["nvidia"];
  if (strategy === "local-apple-qwen3-0_6b" || strategy === "local-apple-qwen3-4b") return ["local-apple"];
  if (strategy === "local-apple-qwen3-0_6b-local-rerank" || strategy === "local-apple-qwen3-4b-local-rerank") return ["local-apple", "local-rerank"];
  return [];
}

function unique(items) {
  return [...new Set(items)].sort();
}

function materializeCommand() {
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live",
    `--target ${displayPath(targetPath)}`,
    `--memory-method ${memoryMethod}`,
    "--private-output-dir <private-output-dir>",
    "--output <public-review-dir>/public-longmemeval-full-materialize-run.json",
    "--markdown-output <public-review-dir>/public-longmemeval-full-materialize-run-evidence.md",
  ].join(" ");
}

function shardMaterializeTemplate() {
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live",
    `--target ${displayPath(targetPath)}`,
    `--memory-method ${memoryMethod}`,
    `--context-token-budget ${contextTokenBudget}`,
    `--limit ${limit}`,
    "--query-offset {startIndex}",
    "--max-queries {queryCount}",
    "--private-output-dir <private-output-dir>/shards/{shardId}/materialized",
    `--output <public-review-dir>/public-longmemeval-${claimScope}-materialize-{shardId}.json`,
    `--markdown-output <public-review-dir>/public-longmemeval-${claimScope}-materialize-{shardId}.md`,
  ].join(" ");
}

function responseArmExportTemplate() {
  const providerEnv = claimScope === "local-full"
    ? []
    : [
        "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=<1-when-provider-arms-run>",
        "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=<1-when-provider-arms-run>",
      ];
  const localAppleEnv = coverage.hasLocalApple
    ? [
        "SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-base-url>",
        "SELFMEM_LOCAL_EMBED_MODEL=<local-embedding-model>",
        "SELFMEM_LOCAL_EMBED_MAX_TOKENS=<safe-local-embedding-max-token-limit>",
        "SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS=<safe-local-embedding-batch-token-limit>",
        "SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT=<safe-local-dense-candidate-limit>",
        "SELFMEM_LOCAL_EMBED_DURABILITY_REPORT=reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json",
        "RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY=1",
      ]
    : [];
  const localRerankEnv = coverage.hasLocalRerank
    ? [
        "SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-base-url>",
        "SELFMEM_LOCAL_RERANK_MODEL=<local-rerank-model>",
        "SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT=<local-rerank-candidate-limit>",
      ]
    : [];
  const queryExpansionEnv = [
    "SELFMEM_QUERY_EXPANSION_BASE_URL=<local-query-expansion-base-url-if-used>",
    "SELFMEM_QUERY_EXPANSION_MODEL=<query-expansion-model-if-used>",
    "RECALLWEAVE_QUERY_EXPANSION_CALLS=<1-when-cloud-query-expansion-runs>",
    "RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=<1-when-cloud-query-expansion-runs>",
  ];
  return [
    `RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=${claimScope}`,
    "RECALLWEAVE_BASELINE_LIVE=1",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
    ...benchmarkSupermemoryDisableEnv,
    ...providerEnv,
    ...localAppleEnv,
    ...localRerankEnv,
    ...(coverage.hasQueryExpansion ? queryExpansionEnv : []),
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --live --execute",
    `--target ${displayPath(targetPath)}`,
    "--queryset <private-output-dir>/shards/{shardId}/materialized/longmemeval-queryset.private.json",
    "--memories <private-output-dir>/shards/{shardId}/materialized/longmemeval-memories.private.jsonl",
    "--private-output-dir <private-output-dir>/shards/{shardId}/arms",
    `--strategies ${strategies.join(",")}`,
    `--context-token-budget ${contextTokenBudget}`,
    `--limit ${limit}`,
    `--max-memory-bytes ${maxMemoryBytes}`,
    "--query-offset 0",
    "--max-queries {queryCount}",
    ...(coverage.hasLocalApple
      ? [
          "--require-local-embedding-durability",
          "--local-embedding-durability-report reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json",
        ]
      : []),
  ].join(" ");
}

function answerQualityTemplate() {
  const armArgs = strategies.map((strategy) => `--arm ${strategy}=<private-output-dir>/shards/{shardId}/arms/${strategy}-responses.private.json`);
  return [
    `RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=${claimScope}`,
    `RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=${scoringPolicy.modelMatchPolicy}`,
    ...benchmarkSupermemoryDisableEnv,
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
    "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>",
    "RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>",
    `RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=${scoringPolicy.answerModelTemplate}`,
    `RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=${scoringPolicy.judgeModelTemplate}`,
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live",
    `--claim-scope ${claimScope}`,
    `--model-match-policy ${scoringPolicy.modelMatchPolicy}`,
    `--target ${displayPath(targetPath)}`,
    "--queryset <private-output-dir>/shards/{shardId}/materialized/longmemeval-queryset.private.json",
    "--memories <private-output-dir>/shards/{shardId}/materialized/longmemeval-memories.private.jsonl",
    "--answer-labels <private-output-dir>/shards/{shardId}/materialized/longmemeval-answer-labels.private.json",
    "--query-offset 0",
    "--max-queries {queryCount}",
    ...armArgs,
    `--output <public-review-dir>/${resultPrefix}-{shardId}.json`,
    `--markdown-output <public-review-dir>/${resultPrefix}-{shardId}.md`,
  ].join(" ");
}

function preflightTemplate() {
  const armArgs = strategies.map((strategy) => `--arm ${strategy}=<private-output-dir>/shards/{shardId}/arms/${strategy}-responses.private.json`);
  return [
    `RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=${claimScope}`,
    `RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=${scoringPolicy.modelMatchPolicy}`,
    ...benchmarkSupermemoryDisableEnv,
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
    "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>",
    "RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>",
    `RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=${scoringPolicy.answerModelTemplate}`,
    `RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=${scoringPolicy.judgeModelTemplate}`,
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready",
    `--claim-scope ${claimScope}`,
    `--model-match-policy ${scoringPolicy.modelMatchPolicy}`,
    `--target ${displayPath(targetPath)}`,
    "--queryset <private-output-dir>/shards/{shardId}/materialized/longmemeval-queryset.private.json",
    "--memories <private-output-dir>/shards/{shardId}/materialized/longmemeval-memories.private.jsonl",
    "--answer-labels <private-output-dir>/shards/{shardId}/materialized/longmemeval-answer-labels.private.json",
    "--query-offset 0",
    "--max-queries {queryCount}",
    ...armArgs,
    `--output <public-review-dir>/${resultPrefix}-preflight-{shardId}.json`,
    `--markdown-output <public-review-dir>/${resultPrefix}-preflight-{shardId}.md`,
  ].join(" ");
}

function combineCommand(shardRows) {
  const inputs = shardRows.map((shard) => `<public-review-dir>/${resultPrefix}-${shard.id}.json`).join(",");
  const combinedName = claimScope === "full-sota" ? "end-to-end-memory-score-full-combined" : `end-to-end-memory-score-${claimScope}-combined`;
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:combine --",
    `--input ${inputs}`,
    "--combine-mode shards",
    `--output <public-review-dir>/${combinedName}.json`,
    `--markdown-output <public-review-dir>/${combinedName}.md`,
  ].join(" ");
}

function resultGateCommand() {
  const combinedName = claimScope === "full-sota" ? "end-to-end-memory-score-full-combined" : `end-to-end-memory-score-${claimScope}-combined`;
  const reviewerName = claimScope === "full-sota" ? "memory-score-reviewer-intake-full" : `memory-score-reviewer-intake-${claimScope}`;
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate --",
    `--claim-scope ${claimScope}`,
    `--target ${displayPath(targetPath)}`,
    `--result <public-review-dir>/${combinedName}.json`,
    `--reviewer-approval-report <public-review-dir>/${reviewerName}.json`,
    "--require-ready",
  ].join(" ");
}

function reviewerIntakeCommand() {
  const combinedName = claimScope === "full-sota" ? "end-to-end-memory-score-full-combined" : `end-to-end-memory-score-${claimScope}-combined`;
  const reviewerName = claimScope === "full-sota" ? "memory-score-reviewer-intake-full" : `memory-score-reviewer-intake-${claimScope}`;
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:reviewer-intake --",
    `--result <public-review-dir>/${combinedName}.json`,
    "--reviewer <reviewer-a-json>",
    "--reviewer <reviewer-b-json>",
    `--output <public-review-dir>/${reviewerName}.json`,
  ].join(" ");
}

function answerQualityScoringAction(scope) {
  if (scope === "model-challenger") {
    return "Run answer-quality scoring for each shard with the declared challenger answer and judge models.";
  }
  if (scope === "local-full") {
    return "Run answer-quality scoring for each shard with the declared local diagnostic answer and judge models.";
  }
  return "Run answer-quality scoring for each shard with the exact target answer and judge models.";
}

function resultClaimAction(scope) {
  if (scope === "model-challenger") {
    return "Treat the completed result as challenger-model benchmark evidence only; public SOTA and production-replacement claims still require exact-target full-SOTA gates.";
  }
  if (scope === "local-full") {
    return "Treat the completed result as a full local benchmark result only; SOTA and public superiority claims still need the full provider/comparison lane.";
  }
  return "Treat the completed result as SOTA-candidate evidence only after result gate, reviewer intake, UI/docs, owner approval, and real canary also pass.";
}

function missingLaneAction(scope) {
  if (scope === "model-challenger") {
    return "Include BM25, full-hybrid, Voyage lite/lite, NVIDIA, and Gemini challenger arms without requiring local Apple sidecars. Add query expansion only as a labeled ablation.";
  }
  if (scope === "local-full") {
    return "Include BM25, full-hybrid, local Apple, and local rerank arms. Add query expansion only as a labeled ablation.";
  }
  return "Include BM25, full-hybrid, Voyage lite/lite, NVIDIA or Gemini, local Apple, and local rerank arms. Add query expansion only as a labeled ablation.";
}

function scoringPolicyForClaimScope(scope) {
  const exactTargetModelsRequired = scope === "full-sota";
  const localDiagnosticModelAllowed = scope === "local-full";
  const challengerModelAllowed = scope === "model-challenger";
  return {
    modelMatchPolicy: exactTargetModelsRequired
      ? "exact-target-required"
      : challengerModelAllowed
        ? "challenger-model-allowed"
        : "local-diagnostic-allowed",
    exactTargetModelsRequired,
    localDiagnosticModelAllowed,
    challengerModelAllowed,
    answerModelTemplate: exactTargetModelsRequired
      ? target.benchmark?.answerModel ?? "<target-answer-model>"
      : challengerModelAllowed
        ? "<challenger-answer-model>"
        : "<local-answer-model>",
    judgeModelTemplate: exactTargetModelsRequired
      ? target.benchmark?.judgeModel ?? "<target-judge-model>"
      : challengerModelAllowed
        ? "<challenger-judge-model>"
        : "<local-judge-model>",
    countsAsFullMemorySotaEvidence: false,
    publicBenchmarkClaimsAllowed: false,
  };
}

function defaultStrategies(scope) {
  const local = [
    "bm25-lite",
    "full-hybrid-rerank",
    "local-apple-qwen3-0_6b",
    "local-apple-qwen3-0_6b-local-rerank",
  ];
  if (scope === "local-full") return local;
  if (scope === "model-challenger") {
    return [
      ...local.slice(0, 2),
      "cloud-gemini2-embed-rerank-proxy",
      "cloud-voyage4-lite-voyage-lite",
      "cloud-nvidia-nv-embed-v1-mistral-rerank",
    ];
  }
  return [
    ...local.slice(0, 2),
    "cloud-gemini2-embed-rerank-proxy",
    "cloud-voyage4-lite-voyage-lite",
    "cloud-nvidia-nv-embed-v1-mistral-rerank",
    ...local.slice(2),
  ];
}

function renderMarkdown(value) {
  return [
    "# Full Answer-Quality Shard Plan",
    "",
    `- Status: ${value.status}`,
    `- Claim scope: ${value.claimScope}`,
    `- Model match policy: ${value.scoringPolicy.modelMatchPolicy}`,
    `- Ready for answer-quality shard run: ${value.readyForAnswerQualityShardRun}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Target: ${value.target.path}`,
    `- Query count: ${value.runPlan.queryCount}`,
    `- Shard size: ${value.runPlan.shardSize}`,
    `- Shard count: ${value.runPlan.shardCount}`,
    `- Max memory bytes: ${value.runPlan.maxMemoryBytes}`,
    `- Strategies: ${value.runPlan.strategies.join(", ")}`,
    `- Raw sources retained privately: ${value.checks.rawSourcesRetainedPrivate}`,
    "",
    "## Strategy Coverage",
    `- BM25 control: ${value.strategyCoverage.hasBm25Lite}`,
    `- Full hybrid control: ${value.strategyCoverage.hasFullHybridRerank}`,
    `- Query expansion: ${value.strategyCoverage.hasQueryExpansion}`,
    `- Voyage provider: ${value.strategyCoverage.hasVoyageProvider}`,
    `- NVIDIA or Gemini provider: ${value.strategyCoverage.hasNvidiaOrGeminiProvider}`,
    `- Local Apple: ${value.strategyCoverage.hasLocalApple}`,
    `- Local rerank: ${value.strategyCoverage.hasLocalRerank}`,
    "",
    "## Provider Hybrid Contract",
    `- BM25 lexical floor required: ${value.providerHybridContract.bm25LexicalFloorRequired}`,
    `- Full hybrid control required: ${value.providerHybridContract.fullHybridControlRequired}`,
    `- Same-shard controls required: ${value.providerHybridContract.sameShardControlsRequired}`,
    `- Provider challengers are hybrid context arms: ${value.providerHybridContract.providerChallengersAreHybridContextArms}`,
    `- Provider-only dense claims allowed: ${value.providerHybridContract.providerOnlyDenseClaimsAllowed}`,
    `- Provider challenger controls present: ${value.providerHybridContract.providerChallengerControlsPresent}`,
    `- Cloud provider strategies: ${value.providerHybridContract.cloudProviderStrategies.join(", ") || "none"}`,
    "",
    "## Execution Lanes",
    ...value.executionLanes.flatMap((lane) => [
      `- ${lane.id}: ${lane.coverageReady ? "ready" : "missing"}; intake-compatible=${lane.acceptedByFullShardIntake}; providers=${lane.providerRequirements.join(", ") || "none"}`,
      `  - ${lane.operatorUse}`,
      `  - query-expansion=${lane.queryExpansionEvidenceRequirement}`,
      `  - ${lane.shardIntakeCompatibility}`,
    ]),
    "",
    "## Shards",
    ...value.shards.map((shard) => `- ${shard.id}: ${shard.startIndex}-${shard.endIndexExclusive} (${shard.queryCount})`),
    "",
    "## Commands",
    "```bash",
    value.runPlan.shardMaterializeTemplate,
    value.runPlan.responseArmExportTemplate,
    value.runPlan.preflightTemplate,
    value.runPlan.answerQualityTemplate,
    value.runPlan.combineCommand,
    value.runPlan.resultGateCommand,
    "```",
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function assertSafePublicText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privatePathPattern, `${label} contains a private local path`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
  assertNoPattern(text, /\b(q|answer|content|memory|text|raw|prompt)"\s*:/, `${label} contains raw text-like fields`);
}

function assertNoPattern(text, pattern, message) {
  pattern.lastIndex = 0;
  if (pattern.test(String(text))) throw new Error(message);
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (parsed[key] == null) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
    if (value !== true) index += 1;
  }
  return parsed;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value ?? "") : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function kebab(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
