import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
const args = parseArgs(process.argv.slice(2));
const targetPath = resolveInputPath(args.target ?? process.env.RECALLWEAVE_MEMORYBENCH_TARGET ?? "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
const querySetPath = resolveOptionalPath(args.queryset ?? args.querySet ?? process.env.RECALLWEAVE_BASELINE_QUERYSET ?? null);
const memoriesPath = resolveOptionalPath(args.memories ?? args.memoriesJsonl ?? process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ?? null);
const answerLabelsPath = resolveOptionalPath(args.answerLabels ?? process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_LABELS ?? null);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const claimScope = String(args.claimScope ?? process.env.RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE ?? "full-sota").trim();
const modelMatchPolicy = String(
  args.modelMatchPolicy ?? process.env.RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY ?? defaultModelMatchPolicy(claimScope),
).trim();
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_MEMORYBENCH_MAX_QUERIES ?? null, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_MEMORYBENCH_QUERY_OFFSET ?? 0, "query offset");
const armSpecs = parseArmSpecs(args.arm ?? args.arms);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(
  ["full-sota", "local-full", "model-challenger"].includes(claimScope),
  "--claim-scope must be full-sota, local-full, or model-challenger",
);
assert.ok(
  ["exact-target-required", "local-diagnostic-allowed", "challenger-model-allowed"].includes(modelMatchPolicy),
  "--model-match-policy must be exact-target-required, local-diagnostic-allowed, or challenger-model-allowed",
);
assert.ok(
  claimScope === "local-full" || modelMatchPolicy !== "local-diagnostic-allowed",
  "only local-full can use local-diagnostic-allowed scoring",
);
assert.ok(
  claimScope === "model-challenger" || modelMatchPolicy !== "challenger-model-allowed",
  "only model-challenger can use challenger-model-allowed scoring",
);
assert.ok(existsSync(targetPath), `benchmark target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `benchmark target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "benchmark target");
const target = JSON.parse(targetRaw);
const targetOk = target.fixtureOnly === false && target.benchmark?.family === "longmemeval" && target.claimTier === "run-only";
const answerQualityCallsEnabled = truthyEnv("RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS");
const publicDataConfirmed = truthyEnv("RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA");
const noRawTextOutputConfirmed = truthyEnv("RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT");
const answerModel = envPresence("RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL", "RECALLWEAVE_BASELINE_ANSWER_MODEL");
const judgeModel = envPresence("RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL", "RECALLWEAVE_BASELINE_JUDGE_MODEL");
const baseUrl = envPresence("RECALLWEAVE_MEMORYBENCH_BASE_URL");
const apiKey = envPresence("RECALLWEAVE_MEMORYBENCH_API_KEY");
const endpointIsLocal = isLocalUrl(process.env.RECALLWEAVE_MEMORYBENCH_BASE_URL ?? "");
const targetAnswerModel = String(target.benchmark?.answerModel ?? "").trim();
const targetJudgeModel = String(target.benchmark?.judgeModel ?? "").trim();
const answerModelMatchesTarget = answerModel.present && targetAnswerModel.length > 0 && answerModel.value === targetAnswerModel;
const judgeModelMatchesTarget = judgeModel.present && targetJudgeModel.length > 0 && judgeModel.value === targetJudgeModel;
const exactTargetModelsRequired = modelMatchPolicy === "exact-target-required";
const localDiagnosticModelAllowed = modelMatchPolicy === "local-diagnostic-allowed";
const challengerModelAllowed = modelMatchPolicy === "challenger-model-allowed";
const localDiagnosticEndpointSatisfied = localDiagnosticModelAllowed && endpointIsLocal;
const scoringModelPolicySatisfied = exactTargetModelsRequired
  ? answerModelMatchesTarget && judgeModelMatchesTarget
  : localDiagnosticModelAllowed
    ? answerModel.present && judgeModel.present && localDiagnosticEndpointSatisfied
    : challengerModelAllowed && answerModel.present && judgeModel.present;

let queryShardSelection = null;
const privateInputs = inspectPrivateInputs();
const arms = inspectArms();
const strategyNames = arms.map((arm) => arm.strategy);
const challengerStrategies = strategyNames.filter((strategy) => !["bm25-lite", "full-hybrid-rerank"].includes(strategy));
const envReady =
  answerQualityCallsEnabled &&
  publicDataConfirmed &&
  noRawTextOutputConfirmed &&
  answerModel.present &&
  judgeModel.present &&
  scoringModelPolicySatisfied &&
  baseUrl.present &&
  (endpointIsLocal || apiKey.present);
const privateInputsReady = privateInputs.querySet.present && privateInputs.memories.present && privateInputs.answerLabels.present;
const armsReady = arms.length > 0 && arms.every((arm) => arm.present && arm.parseable);
const responseArmsCoverSelectedShard = arms.length > 0 && arms.every((arm) => arm.selectedShardCoverage?.ready === true);
const sameDataReady =
  privateInputs.querySet.matchesTarget !== false &&
  privateInputs.answerLabels.matchesTarget !== false &&
  arms.every((arm) => arm.querySetMatches !== false) &&
  responseArmsCoverSelectedShard;
const requiredStrategyCoverage = {
  hasBm25Lite: strategyNames.includes("bm25-lite"),
  hasFullHybridRerank: strategyNames.includes("full-hybrid-rerank"),
  hasChallenger: challengerStrategies.length > 0,
};

const blockers = [
  !targetOk ? "target-not-public-longmemeval-run-only" : null,
  !answerQualityCallsEnabled ? "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled" : null,
  !publicDataConfirmed ? "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed" : null,
  !noRawTextOutputConfirmed ? "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed" : null,
  !answerModel.present ? "answer-model-missing" : null,
  !judgeModel.present ? "judge-model-missing" : null,
  !targetAnswerModel ? "target-answer-model-missing" : null,
  !targetJudgeModel ? "target-judge-model-missing" : null,
  exactTargetModelsRequired && answerModel.present && !answerModelMatchesTarget ? "answer-model-does-not-match-target" : null,
  exactTargetModelsRequired && judgeModel.present && !judgeModelMatchesTarget ? "judge-model-does-not-match-target" : null,
  localDiagnosticModelAllowed && baseUrl.present && !endpointIsLocal ? "local-diagnostic-scoring-requires-local-endpoint" : null,
  !baseUrl.present ? "openai-compatible-base-url-missing" : null,
  baseUrl.present && !endpointIsLocal && !apiKey.present ? "cloud-endpoint-api-key-missing" : null,
  !privateInputs.querySet.present ? "private-queryset-missing" : null,
  !privateInputs.memories.present ? "private-memories-missing" : null,
  !privateInputs.answerLabels.present ? "private-answer-labels-missing" : null,
  privateInputs.querySet.matchesTarget === false ? "private-queryset-hash-mismatch" : null,
  privateInputs.answerLabels.matchesTarget === false ? "private-answer-labels-hash-mismatch" : null,
  arms.length === 0 ? "response-arm-exports-missing" : null,
  !armsReady && arms.length > 0 ? "response-arm-export-not-ready" : null,
  arms.some((arm) => arm.querySetMatches === false) ? "response-arm-queryset-hash-mismatch" : null,
  arms.some((arm) => arm.selectedShardCoverage?.ready === false) ? "response-arm-selected-shard-coverage-mismatch" : null,
  arms.some((arm) => arm.selectedShardCoverage?.selectedQueryIdHashMatches === false) ? "response-arm-selected-query-hash-mismatch" : null,
  !requiredStrategyCoverage.hasBm25Lite ? "bm25-lite-arm-missing" : null,
  !requiredStrategyCoverage.hasFullHybridRerank ? "full-hybrid-rerank-arm-missing" : null,
  !requiredStrategyCoverage.hasChallenger ? "provider-or-local-challenger-arm-missing" : null,
].filter(Boolean);
const ready = blockers.length === 0;

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "public-benchmark-answer-quality-preflight",
  status: ready ? "READY_FOR_LIVE_ANSWER_QUALITY" : "BLOCKED_ANSWER_QUALITY_ENV",
  claimScope,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  printsCredentials: false,
  generatedAt: new Date().toISOString(),
  target: {
    path: displayPath(targetPath),
    hash: `sha256:${sha256(targetRaw)}`,
    fixtureOnly: Boolean(target.fixtureOnly),
    benchmark: target.benchmark?.family ?? target.benchmark?.name ?? null,
    claimTier: target.claimTier ?? null,
    answerLabelsHash: target.benchmark?.answerLabelsHash ?? null,
    scoringCodeHash: target.benchmark?.scoringCodeHash ?? null,
    answerModel: targetAnswerModel || null,
    judgeModel: targetJudgeModel || null,
  },
  consent: {
    answerQualityCallsEnabled,
    publicDataConfirmed,
    noRawTextOutputConfirmed,
  },
  endpoint: {
    baseUrlPresent: baseUrl.present,
    endpointIsLocal,
    apiKeyPresent: apiKey.present,
    valuePrinted: false,
  },
  models: {
    answerModelPresent: answerModel.present,
    judgeModelPresent: judgeModel.present,
    answerModelMatchesTarget,
    judgeModelMatchesTarget,
    valuesPrinted: false,
  },
  scoringPolicy: {
    claimScope,
    modelMatchPolicy,
    exactTargetModelsRequired,
    localDiagnosticModelAllowed,
    challengerModelAllowed,
    localDiagnosticEndpointRequired: localDiagnosticModelAllowed,
    localDiagnosticEndpointSatisfied,
    modelMismatchAllowed: localDiagnosticModelAllowed || challengerModelAllowed,
    scoringModelPolicySatisfied,
    countsAsFullMemorySotaEvidence: false,
    countsAsLocalFullBenchmarkEvidence: claimScope === "local-full" && ready,
    countsAsModelChallengerBenchmarkEvidence: claimScope === "model-challenger" && ready,
  },
  privateInputs,
  queryShard: queryShardSelection
    ? {
        requested: maxQueries != null || queryOffset > 0,
        startIndex: queryShardSelection.startIndex,
        endIndexExclusive: queryShardSelection.endIndexExclusive,
        totalQueryCount: queryShardSelection.totalQueryCount,
        selectedQueryCount: queryShardSelection.ids.length,
        selectedQueryIdHash: queryShardSelection.selectedQueryIdHash,
      }
    : null,
  arms,
  requiredStrategyCoverage,
  readiness: {
    envReady,
    privateInputsReady,
    armsReady,
    responseArmsCoverSelectedShard,
    sameDataReady,
    liveAnswerQualityCanRun: ready,
    readyForEndToEndMemoryScoreGate: ready,
    countsAsFullMemorySotaEvidence: false,
  },
  blockers,
  nextActions: ready
    ? [
    "Run benchmark:answer-quality with --live against the private materialized inputs and response arm exports.",
    claimScope === "local-full"
      ? "Attach the metrics-only result to benchmark:memory-score:result-gate --claim-scope local-full --require-ready."
      : "Attach the metrics-only result to benchmark:memory-score:result-gate --require-ready.",
    claimScope === "local-full"
      ? "Treat this as local diagnostic evidence only; exact SOTA and public superiority claims still need the full provider/scoring lane."
      : claimScope === "model-challenger"
        ? "Treat this as a stronger-model reported-score comparison lane, not strict same-model SOTA evidence."
      : "Send the metrics-only packet to independent reviewers before public benchmark wording changes.",
  ]
    : [
        "Materialize the source-locked target into an operator-private directory outside the repository.",
        "Export one private RecallWeave response file per strategy with baseline:export:recallweave.",
        "Set explicit answer-quality model-call, public-data, and no-raw-output consent flags before live scoring.",
        "Include bm25-lite, full-hybrid-rerank, and at least one provider or local challenger arm.",
      ],
  liveCommandTemplate: liveCommandTemplate(),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "answer-quality preflight report");
assertSafePublicText(markdownText, "answer-quality preflight markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function inspectPrivateInputs() {
  const querySet = inspectPrivateJson(querySetPath, "queryset", inspectQuerySet);
  const memories = inspectPrivateJsonl(memoriesPath, "memories");
  const answerLabels = inspectPrivateJson(answerLabelsPath, "answer-labels", inspectAnswerLabels);
  return { querySet, memories, answerLabels };
}

function inspectPrivateJson(path, role, inspector) {
  if (!path) return { role, present: false, rawTextPrivate: true };
  assertPrivateFile(path, role);
  const raw = readFileSync(path, "utf8");
  assertNoPattern(raw, secretPattern, `${role} contains a key-shaped secret`);
  const parsed = JSON.parse(raw);
  return {
    role,
    present: true,
    rawTextPrivate: true,
    pathLabel: "external-input",
    name: basename(path),
    hash: `sha256:${sha256(raw)}`,
    ...inspector(parsed),
  };
}

function inspectPrivateJsonl(path, role) {
  if (!path) return { role, present: false, rawTextPrivate: true };
  assertPrivateFile(path, role);
  const raw = readFileSync(path, "utf8");
  assertNoPattern(raw, secretPattern, `${role} contains a key-shaped secret`);
  const lineCount = raw.split(/\r?\n/).filter((line) => line.trim()).length;
  return {
    role,
    present: true,
    rawTextPrivate: true,
    pathLabel: "external-input",
    name: basename(path),
    hash: `sha256:${sha256(raw)}`,
    lineCount,
  };
}

function inspectQuerySet(value) {
  const querySetHash = `sha256:${stableHash(collectorQuerySetHashPayload(value))}`;
  queryShardSelection = selectQueries(value.queries ?? [], value.authoring?.materializationShard);
  const expectedAnswerLabelsHash = target.benchmark?.answerLabelsHash ?? null;
  const expectedScoringCodeHash = target.benchmark?.scoringCodeHash ?? null;
  const directTargetMatch =
    value.authoring?.answerLabelsHash === expectedAnswerLabelsHash &&
    value.authoring?.scoringCodeHash === expectedScoringCodeHash;
  const shardTargetMatch =
    value.authoring?.materializationShard?.applied === true &&
    value.authoring?.targetAnswerLabelsHash === expectedAnswerLabelsHash &&
    value.authoring?.scoringCodeHash === expectedScoringCodeHash;
  return {
    querySetHash,
    queryCount: queryShardSelection.totalQueryCount,
    localQueryCount: Number(value.queries?.length ?? 0),
    selectedQueryCount: queryShardSelection.ids.length,
    selectedQueryIdHash: queryShardSelection.selectedQueryIdHash,
    answerLabelsHash: value.authoring?.answerLabelsHash ?? null,
    targetAnswerLabelsHash: value.authoring?.targetAnswerLabelsHash ?? null,
    scoringCodeHash: value.authoring?.scoringCodeHash ?? null,
    materializationShard: value.authoring?.materializationShard ?? null,
    matchesTarget: directTargetMatch || shardTargetMatch,
  };
}

function inspectAnswerLabels(value) {
  const expectedAnswerLabelsHash = target.benchmark?.answerLabelsHash ?? null;
  const expectedScoringCodeHash = target.benchmark?.scoringCodeHash ?? null;
  const directTargetMatch = value.answerLabelsHash === expectedAnswerLabelsHash && value.scoringCodeHash === expectedScoringCodeHash;
  const shardTargetMatch =
    value.materializationShard?.applied === true &&
    value.targetAnswerLabelsHash === expectedAnswerLabelsHash &&
    value.scoringCodeHash === expectedScoringCodeHash;
  return {
    labelCount: value.materializationShard?.applied === true
      ? Number(value.materializationShard.totalQueryCount ?? value.labels?.length ?? 0)
      : Number(value.labels?.length ?? 0),
    localLabelCount: Number(value.labels?.length ?? 0),
    answerLabelsHash: value.answerLabelsHash ?? null,
    targetAnswerLabelsHash: value.targetAnswerLabelsHash ?? null,
    scoringCodeHash: value.scoringCodeHash ?? null,
    materializationShard: value.materializationShard ?? null,
    matchesTarget: directTargetMatch || shardTargetMatch,
  };
}

function inspectArms() {
  return armSpecs.map((arm) => {
    assertSafeStrategy(arm.strategy);
    assertPrivateFile(arm.path, `${arm.strategy} response arm`);
    const raw = readFileSync(arm.path, "utf8");
    assertNoPattern(raw, secretPattern, `${arm.strategy} response arm contains a key-shaped secret`);
    const parsed = JSON.parse(raw);
    const querySetHash = parsed.querySetHash ?? null;
    const responses = parsed.responses && typeof parsed.responses === "object" ? parsed.responses : {};
    const responseIds = new Set(Object.keys(responses));
    const selectedIds = queryShardSelection?.ids ?? [];
    const missingSelectedCount = selectedIds.filter((id) => !responseIds.has(id)).length;
    const extraResponseCount = [...responseIds].filter((id) => !selectedIds.includes(id)).length;
    const responseCount = responseIds.size;
    const selectedShardCoverage = {
      ready:
        selectedIds.length > 0 &&
        missingSelectedCount === 0 &&
        extraResponseCount === 0 &&
        responseCount === selectedIds.length &&
        (parsed.queryShard?.startIndex == null || Number(parsed.queryShard.startIndex) === queryShardSelection?.startIndex) &&
        (parsed.queryShard?.endIndexExclusive == null || Number(parsed.queryShard.endIndexExclusive) === queryShardSelection?.endIndexExclusive) &&
        (parsed.queryShard?.selectedQueryIdHash == null || parsed.queryShard.selectedQueryIdHash === queryShardSelection?.selectedQueryIdHash),
      expectedResponseCount: selectedIds.length,
      responseCount,
      missingSelectedCount,
      extraResponseCount,
      responseStartIndex: parsed.queryShard?.startIndex ?? null,
      responseEndIndexExclusive: parsed.queryShard?.endIndexExclusive ?? null,
      responseSelectedQueryIdHash: parsed.queryShard?.selectedQueryIdHash ?? null,
      expectedSelectedQueryIdHash: queryShardSelection?.selectedQueryIdHash ?? null,
      selectedQueryIdHashMatches:
        parsed.queryShard?.selectedQueryIdHash == null ? null : parsed.queryShard.selectedQueryIdHash === queryShardSelection?.selectedQueryIdHash,
    };
    return {
      strategy: arm.strategy,
      present: true,
      parseable: true,
      rawTextPrivate: true,
      pathLabel: "external-input",
      name: basename(arm.path),
      hash: `sha256:${sha256(raw)}`,
      querySetHash,
      responseCount,
      querySetMatches:
        privateInputs?.querySet?.querySetHash && querySetHash ? querySetHash === privateInputs.querySet.querySetHash : null,
      selectedShardCoverage,
    };
  });
}

function parseArmSpecs(value) {
  return coerceArray(value).flatMap((item) =>
    String(item)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^([^:=]+)[:=](.+)$/);
        assert.ok(match, `invalid arm spec: ${part}; expected strategy=/private/responses.json`);
        return { strategy: match[1], path: resolveInputPath(match[2]) };
      }),
  );
}

function liveCommandTemplate() {
  const shardArgs = [
    queryOffset > 0 ? `--query-offset ${queryOffset}` : null,
    maxQueries ? `--max-queries ${maxQueries}` : null,
  ].filter(Boolean);
  return [
    `RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=${claimScope}`,
    `RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=${modelMatchPolicy}`,
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1",
    "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>",
    "RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>",
    `RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=${exactTargetModelsRequired ? targetAnswerModel || "<target-answer-model>" : "<local-answer-model>"}`,
    `RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=${exactTargetModelsRequired ? targetJudgeModel || "<target-judge-model>" : "<local-judge-model>"}`,
    [
      "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live",
      `--claim-scope ${claimScope}`,
      `--target ${displayPath(targetPath)}`,
      "--queryset <private-output-dir>/materialized/longmemeval-queryset.private.json",
      "--memories <private-output-dir>/materialized/longmemeval-memories.private.jsonl",
      "--answer-labels <private-output-dir>/materialized/longmemeval-answer-labels.private.json",
      ...shardArgs,
      "--arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json",
      "--arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json",
      "--arm <provider-or-local-arm>=<private-output-dir>/<provider-or-local-arm>-responses.private.json",
      "--output <public-answer-quality-output.json>",
    ].join(" "),
  ];
}

function renderMarkdown(value) {
  return [
    "# Answer-Quality Benchmark Preflight",
    "",
    `- Status: ${value.status}`,
    `- Claim scope: ${value.claimScope}`,
    `- Model match policy: ${value.scoringPolicy.modelMatchPolicy}`,
    `- Live answer-quality can run: ${value.readiness.liveAnswerQualityCanRun}`,
    `- Ready for end-to-end memory score gate: ${value.readiness.readyForEndToEndMemoryScoreGate}`,
    `- Calls provider APIs: ${value.callsProviderApis}`,
    `- Sends benchmark text to provider: ${value.sendsBenchmarkTextToProvider}`,
    `- Target hash: ${value.target.hash}`,
    `- Target answer model: ${value.target.answerModel ?? "missing"}`,
    `- Target judge model: ${value.target.judgeModel ?? "missing"}`,
    `- Query shard requested: ${value.queryShard?.requested ?? false}`,
    `- Query shard: ${value.queryShard ? `${value.queryShard.startIndex}-${value.queryShard.endIndexExclusive}` : "n/a"}`,
    "",
    "## Readiness",
    `- Env ready: ${value.readiness.envReady}`,
    `- Private inputs ready: ${value.readiness.privateInputsReady}`,
    `- Response arms ready: ${value.readiness.armsReady}`,
    `- Response arms cover selected shard: ${value.readiness.responseArmsCoverSelectedShard}`,
    `- Same-data hashes ready: ${value.readiness.sameDataReady}`,
    `- Answer model matches target: ${value.models.answerModelMatchesTarget}`,
    `- Judge model matches target: ${value.models.judgeModelMatchesTarget}`,
    `- Scoring model policy satisfied: ${value.scoringPolicy.scoringModelPolicySatisfied}`,
    `- Counts as local-full benchmark evidence: ${value.scoringPolicy.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as model-challenger benchmark evidence: ${value.scoringPolicy.countsAsModelChallengerBenchmarkEvidence}`,
    "",
    "## Strategy Coverage",
    `- BM25 lite: ${value.requiredStrategyCoverage.hasBm25Lite}`,
    `- Full hybrid rerank: ${value.requiredStrategyCoverage.hasFullHybridRerank}`,
    `- Provider or local challenger: ${value.requiredStrategyCoverage.hasChallenger}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
    "",
    "## Live Command Template",
    "```bash",
    ...value.liveCommandTemplate,
    "```",
  ].join("\n");
}

function collectorQuerySetHashPayload(querySet) {
  return {
    schemaVersion: querySet.schemaVersion ?? 1,
    datasetSlice: querySet.datasetSlice ?? null,
    queries: (querySet.queries ?? []).map((query) => ({
      id: query.id,
      q: query.q,
      expectedResultIds: query.expectedResultIds ?? [],
      expectedResultHashes: query.expectedResultHashes ?? [],
    })),
  };
}

function defaultModelMatchPolicy(scope) {
  if (scope === "local-full") return "local-diagnostic-allowed";
  if (scope === "model-challenger") return "challenger-model-allowed";
  return "exact-target-required";
}

function selectQueries(queries, materializationShard = null) {
  const localStartIndex = Math.min(queryOffset, queries.length);
  const localEndIndexExclusive = maxQueries ? Math.min(queries.length, localStartIndex + maxQueries) : queries.length;
  const selected = queries.slice(localStartIndex, localEndIndexExclusive);
  const parent = parentShardCoordinates(materializationShard, queries.length);
  const startIndex = parent.startIndex + localStartIndex;
  const endIndexExclusive = parent.startIndex + localEndIndexExclusive;
  return {
    startIndex,
    endIndexExclusive,
    totalQueryCount: parent.totalQueryCount,
    ids: selected.map((query) => query.id),
    selectedQueryIdHash: `sha256:${stableHash(selected.map((query) => shortHash(query.id)).join("\n"))}`,
  };
}

function parentShardCoordinates(materializationShard, localTotalQueryCount) {
  if (!materializationShard || materializationShard.applied !== true) {
    return { startIndex: 0, totalQueryCount: localTotalQueryCount };
  }
  const startIndex = Number(materializationShard.startIndex ?? 0);
  const selectedCount = Number(materializationShard.selectedCount ?? localTotalQueryCount);
  const totalQueryCount = Number(materializationShard.totalQueryCount ?? localTotalQueryCount);
  assert.ok(Number.isInteger(startIndex) && startIndex >= 0, "materialization shard start index must be non-negative");
  assert.ok(Number.isInteger(selectedCount) && selectedCount === localTotalQueryCount, "materialization shard selected count must match queryset length");
  assert.ok(Number.isInteger(totalQueryCount) && totalQueryCount >= startIndex + localTotalQueryCount, "materialization shard total query count is invalid");
  return { startIndex, totalQueryCount };
}

function assertPrivateFile(path, label) {
  assert.ok(path, `${label} is required`);
  assert.ok(existsSync(path), `${label} missing: external-input`);
  assert.ok(statSync(path).size > 0, `${label} empty: external-input`);
  assertOutsideRepo(path, label);
}

function assertOutsideRepo(path, label) {
  const rel = relative(root, resolve(path));
  assert.ok(rel.startsWith("..") || isAbsolute(rel), `${label} must stay outside the repository`);
}

function assertSafeStrategy(value) {
  assert.match(String(value), /^[A-Za-z0-9_.-]+$/, `unsafe strategy label: ${value}`);
}

function envPresence(...names) {
  const presentNames = names.filter((name) => String(process.env[name] ?? "").trim());
  const firstPresentName = presentNames[0] ?? null;
  return {
    present: presentNames.length > 0,
    value: firstPresentName ? String(process.env[firstPresentName] ?? "").trim() : null,
    envNames: names,
    presentEnvNames: presentNames,
    valuePrinted: false,
  };
}

function truthyEnv(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] ?? ""));
}

function isLocalUrl(value) {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function coerceArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
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

function resolveOptionalPath(value) {
  return value ? resolveInputPath(value) : null;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "" || value === false) return null;
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "" || value === false) return 0;
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed >= 0, `${label} must be a non-negative integer`);
  return parsed;
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

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableHash(value) {
  return sha256(typeof value === "string" ? value : JSON.stringify(value));
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
}
