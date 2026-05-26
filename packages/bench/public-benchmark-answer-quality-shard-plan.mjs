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
const strategies = splitList(args.strategies ?? defaultStrategies().join(","));
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 300_000_000, "max memory bytes");

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
const knownStrategies = new Set([
  "bm25-lite",
  "full-hybrid-rerank",
  "query-expanded-full-hybrid-rerank",
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
  "local-apple-qwen3-0_6b",
  "local-apple-qwen3-0_6b-local-rerank",
  "local-apple-qwen3-4b",
]);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
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
const targetHash = `sha256:${sha256(targetRaw)}`;
const materializeHash = `sha256:${sha256(materializeRaw)}`;
const queryCount = Number(materialize.selection?.queryCount ?? materialize.selection?.selectedCount ?? materialize.sourceRetention?.selectedRawRowsCount ?? 0);
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? materialize.target?.contextTokenBudget ?? target.benchmark?.contextTokenBudget ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? materialize.target?.limit ?? target.benchmark?.limit ?? 5, "limit");
const shards = buildShards(queryCount, shardSize, { targetHash });
const coverage = strategyCoverage(strategies);
const executionLanes = buildExecutionLanes(strategies);
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
const blockers = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([key]) => kebab(key));
const ready = blockers.length === 0;

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "public-benchmark-answer-quality-shard-plan",
  status: ready ? "READY_FULL_ANSWER_QUALITY_SHARD_RUN" : "BLOCKED_FULL_ANSWER_QUALITY_SHARD_RUN",
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
  runPlan: {
    queryCount,
    shardSize,
    shardCount: shards.length,
    contextTokenBudget,
    limit,
    maxMemoryBytes,
    strategies,
    privateInputDirectoryLabel: "<private-output-dir>",
    publicOutputDirectoryLabel: "<public-review-dir>",
    materializeCommand: materializeCommand(),
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
        "Run response arm exports shard-by-shard with explicit provider and query-expansion consent.",
        "Run shard-aware answer-quality preflight for each shard before model-scored answer quality.",
        "Run answer-quality scoring for each shard with the target answer and judge models.",
        "Combine the full query-shard result set, then run the memory-score gate and reviewer intake on the combined metrics-only packet.",
      ]
    : [
        "Regenerate the full LongMemEval-S materialization and preserve the private raw-source outputs outside the repository.",
        "Include BM25, full-hybrid, query expansion, Voyage, NVIDIA or Gemini, local Apple, and local rerank arms.",
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
      armOutputDirectoryLabel: `<private-output-dir>/arms/${id}`,
      answerQualityOutputLabel: `<public-review-dir>/answer-quality-${id}.json`,
      answerQualityMarkdownLabel: `<public-review-dir>/answer-quality-${id}.md`,
    });
  }
  return items;
}

function strategyCoverage(items) {
  return {
    hasBm25Lite: items.includes("bm25-lite"),
    hasFullHybridRerank: items.includes("full-hybrid-rerank"),
    hasQueryExpansion: items.includes("query-expanded-full-hybrid-rerank"),
    hasVoyageProvider: items.some((item) => item.startsWith("cloud-voyage")),
    hasNvidiaOrGeminiProvider: items.some((item) => item.startsWith("cloud-nvidia") || item.startsWith("cloud-gemini")),
    hasLocalApple: items.some((item) => item === "local-apple-qwen3-0_6b" || item === "local-apple-qwen3-4b"),
    hasLocalRerank: items.some((item) => item.endsWith("-local-rerank")),
    strategyCount: items.length,
  };
}

function buildExecutionLanes(items) {
  const laneDefinitions = [
    {
      id: "deterministic-control-proxy",
      label: "Deterministic control/proxy lane",
      strategies: ["bm25-lite", "full-hybrid-rerank", "query-expanded-full-hybrid-rerank"],
      operatorUse: "Run-path and shard-integrity proof only. This does not score local or provider model quality.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "Deterministic fallback only; does not count as large-model query-expansion evidence.",
    },
    {
      id: "local-apple-no-spend",
      label: "Local Apple no-spend lane",
      strategies: [
        "bm25-lite",
        "full-hybrid-rerank",
        "query-expanded-full-hybrid-rerank",
        "local-apple-qwen3-0_6b",
        "local-apple-qwen3-0_6b-local-rerank",
      ],
      operatorUse: "Use first when validating the no-spend local method before cloud challenger spend.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "Local or deterministic query expansion must be reported separately from cloud expansion.",
    },
    {
      id: "voyage-minimum-challenger",
      label: "Voyage minimum challenger lane",
      strategies: ["bm25-lite", "full-hybrid-rerank", "cloud-voyage4-voyage-lite-rerank"],
      operatorUse: "Use when Voyage quota is available to unblock the same-data Voyage answer-quality comparison.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "No separate query-expansion claim unless a query-expansion arm is included and scored.",
    },
    {
      id: "nvidia-minimum-challenger",
      label: "NVIDIA minimum challenger lane",
      strategies: ["bm25-lite", "full-hybrid-rerank", "cloud-nvidia-nemotron-1b"],
      operatorUse: "Use for an NVIDIA challenger comparison without spending Voyage quota.",
      acceptedByFullShardIntake: false,
      canReachFullSotaGateAfterShardIntake: false,
      queryExpansionPolicy: "No separate query-expansion claim unless a query-expansion arm is included and scored.",
    },
    {
      id: "full-sota-accepted-shards",
      label: "Full SOTA shard-intake lane",
      strategies: items,
      operatorUse: "Only this lane has the complete strategy set expected by shard intake and combine.",
      acceptedByFullShardIntake: true,
      canReachFullSotaGateAfterShardIntake: true,
      queryExpansionPolicy: "Query expansion, local rerank, local Apple, and provider challengers must all be present on the same shards.",
    },
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
        answerModel: target.benchmark?.answerModel ?? null,
        judgeModel: target.benchmark?.judgeModel ?? null,
      },
      acceptedByFullShardIntake: lane.acceptedByFullShardIntake,
      canReachFullSotaGateAfterShardIntake: lane.canReachFullSotaGateAfterShardIntake,
      countsAsFullMemorySotaEvidence: false,
      publicBenchmarkClaimsAllowed: false,
      queryExpansionPolicy: lane.queryExpansionPolicy,
      shardIntakeCompatibility: lane.acceptedByFullShardIntake
        ? "accepted only after every planned shard returns with this complete strategy set"
        : "diagnostic subset only; full-shard intake rejects it as strategy-set mismatch",
    };
  });
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
  if (strategy === "local-apple-qwen3-0_6b-local-rerank") return ["local-apple", "local-rerank"];
  return [];
}

function unique(items) {
  return [...new Set(items)].sort();
}

function materializeCommand() {
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live",
    `--target ${displayPath(targetPath)}`,
    "--private-output-dir <private-output-dir>",
    "--output <public-review-dir>/public-longmemeval-full-materialize-run.json",
    "--markdown-output <public-review-dir>/public-longmemeval-full-materialize-run-evidence.md",
  ].join(" ");
}

function responseArmExportTemplate() {
  return [
    "RECALLWEAVE_BASELINE_LIVE=1",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
    "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=<1-when-provider-arms-run>",
    "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=<1-when-provider-arms-run>",
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --live --execute",
    `--target ${displayPath(targetPath)}`,
    "--queryset <private-output-dir>/longmemeval-queryset.private.json",
    "--memories <private-output-dir>/longmemeval-memories.private.jsonl",
    "--private-output-dir <private-output-dir>/arms/{shardId}",
    `--strategies ${strategies.join(",")}`,
    `--context-token-budget ${contextTokenBudget}`,
    `--limit ${limit}`,
    `--max-memory-bytes ${maxMemoryBytes}`,
    "--query-offset {startIndex}",
    "--max-queries {queryCount}",
  ].join(" ");
}

function answerQualityTemplate() {
  const armArgs = strategies.map((strategy) => `--arm ${strategy}=<private-output-dir>/arms/{shardId}/${strategy}-responses.private.json`);
  return [
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
    "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>",
    "RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>",
    `RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=${target.benchmark?.answerModel ?? "<target-answer-model>"}`,
    `RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=${target.benchmark?.judgeModel ?? "<target-judge-model>"}`,
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live",
    `--target ${displayPath(targetPath)}`,
    "--queryset <private-output-dir>/longmemeval-queryset.private.json",
    "--memories <private-output-dir>/longmemeval-memories.private.jsonl",
    "--answer-labels <private-output-dir>/longmemeval-answer-labels.private.json",
    "--query-offset {startIndex}",
    "--max-queries {queryCount}",
    ...armArgs,
    "--output <public-review-dir>/answer-quality-{shardId}.json",
    "--markdown-output <public-review-dir>/answer-quality-{shardId}.md",
  ].join(" ");
}

function preflightTemplate() {
  const armArgs = strategies.map((strategy) => `--arm ${strategy}=<private-output-dir>/arms/{shardId}/${strategy}-responses.private.json`);
  return [
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
    "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>",
    "RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>",
    `RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=${target.benchmark?.answerModel ?? "<target-answer-model>"}`,
    `RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=${target.benchmark?.judgeModel ?? "<target-judge-model>"}`,
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready",
    `--target ${displayPath(targetPath)}`,
    "--queryset <private-output-dir>/longmemeval-queryset.private.json",
    "--memories <private-output-dir>/longmemeval-memories.private.jsonl",
    "--answer-labels <private-output-dir>/longmemeval-answer-labels.private.json",
    "--query-offset {startIndex}",
    "--max-queries {queryCount}",
    ...armArgs,
    "--output <public-review-dir>/answer-quality-preflight-{shardId}.json",
    "--markdown-output <public-review-dir>/answer-quality-preflight-{shardId}.md",
  ].join(" ");
}

function combineCommand(shardRows) {
  const inputs = shardRows.map((shard) => `<public-review-dir>/answer-quality-${shard.id}.json`).join(",");
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:combine --",
    `--input ${inputs}`,
    "--combine-mode shards",
    "--output <public-review-dir>/end-to-end-memory-score-full-combined.json",
    "--markdown-output <public-review-dir>/end-to-end-memory-score-full-combined.md",
  ].join(" ");
}

function resultGateCommand() {
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate --",
    `--target ${displayPath(targetPath)}`,
    "--result <public-review-dir>/end-to-end-memory-score-full-combined.json",
    "--reviewer-approval-report <public-review-dir>/memory-score-reviewer-intake-full.json",
    "--require-ready",
  ].join(" ");
}

function reviewerIntakeCommand() {
  return [
    "npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:reviewer-intake --",
    "--result <public-review-dir>/end-to-end-memory-score-full-combined.json",
    "--reviewer <reviewer-a-json>",
    "--reviewer <reviewer-b-json>",
    "--output <public-review-dir>/memory-score-reviewer-intake-full.json",
  ].join(" ");
}

function defaultStrategies() {
  return [
    "bm25-lite",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
    "cloud-voyage4-voyage-lite-rerank",
    "cloud-nvidia-nemotron-1b",
    "local-apple-qwen3-0_6b",
    "local-apple-qwen3-0_6b-local-rerank",
  ];
}

function renderMarkdown(value) {
  return [
    "# Full Answer-Quality Shard Plan",
    "",
    `- Status: ${value.status}`,
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
    "## Execution Lanes",
    ...value.executionLanes.flatMap((lane) => [
      `- ${lane.id}: ${lane.coverageReady ? "ready" : "missing"}; intake-compatible=${lane.acceptedByFullShardIntake}; providers=${lane.providerRequirements.join(", ") || "none"}`,
      `  - ${lane.operatorUse}`,
      `  - ${lane.shardIntakeCompatibility}`,
    ]),
    "",
    "## Shards",
    ...value.shards.map((shard) => `- ${shard.id}: ${shard.startIndex}-${shard.endIndexExclusive} (${shard.queryCount})`),
    "",
    "## Commands",
    "```bash",
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
