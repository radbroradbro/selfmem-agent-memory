import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const planPath = resolveInputPath(args.plan ?? "reviews/overnight-20260522/answer-quality-full-shard-plan-20260525.json");
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const maxWorkorders = positiveInt(args.maxWorkorders ?? args.max ?? Number.MAX_SAFE_INTEGER, "max workorders");
const inputs = inputPaths();

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(planPath), `shard plan missing: ${displayPath(planPath)}`);
assert.ok(statSync(planPath).size > 0, `shard plan empty: ${displayPath(planPath)}`);
const planRaw = readFileSync(planPath, "utf8");
assertSafePublicText(planRaw, "shard plan");
const plan = JSON.parse(planRaw);
assert.equal(plan.mode, "public-benchmark-answer-quality-shard-plan", "plan must be a full answer-quality shard plan");

const loaded = inputs.map(loadCandidateResult);
const evaluated = evaluateExistingShardResults({ plan, loaded });
const pendingShards = (plan.shards ?? []).filter((shard) => !evaluated.acceptedByShardId.has(shard.id));
const selectedPendingShards = pendingShards.slice(0, maxWorkorders);
const allExpectedPublicInputs = (plan.shards ?? []).map((shard) => `<public-review-dir>/answer-quality-${shard.id}.json`);
const readyForShardIntake = pendingShards.length === 0 && evaluated.rejectedResults.length === 0 && evaluated.duplicateResults.length === 0;
const executionLaneReadiness = buildExecutionLaneReadiness(plan.executionLanes ?? []);
const fullSotaLaneReadiness = executionLaneReadiness.find((lane) => lane.acceptedByFullShardIntake === true) ?? null;

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "public-benchmark-answer-quality-shard-workorder",
  status: readyForShardIntake ? "READY_TO_RUN_FULL_ANSWER_QUALITY_SHARD_INTAKE" : "PENDING_FULL_ANSWER_QUALITY_SHARD_RUNS",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  readyForShardIntake,
  readyForShardCombine: false,
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
  plan: {
    path: displayPath(planPath),
    hash: `sha256:${sha256(planRaw)}`,
    targetHash: plan.target?.hash ?? null,
    queryCount: plan.runPlan?.queryCount ?? null,
    shardSize: plan.runPlan?.shardSize ?? null,
    shardCount: plan.runPlan?.shardCount ?? null,
    strategies: plan.runPlan?.strategies ?? [],
  },
  executionLanes: plan.executionLanes ?? [],
  executionLaneReadiness,
  fullSotaLaneReadiness,
  fullSotaLaneReadyForResponseArmExport: Boolean(fullSotaLaneReadiness?.readyForResponseArmExport),
  fullSotaLaneReadyForAnswerQualityScoring: Boolean(fullSotaLaneReadiness?.readyForAnswerQualityScoring),
  fullSotaLaneEnvironmentBlockers: fullSotaLaneReadiness?.blockers ?? [],
  progress: {
    inputCount: inputs.length,
    acceptedShardCount: evaluated.acceptedResults.length,
    pendingShardCount: pendingShards.length,
    rejectedResultCount: evaluated.rejectedResults.length,
    duplicateResultCount: evaluated.duplicateResults.length,
    workorderCount: selectedPendingShards.length,
  },
  acceptedShards: evaluated.acceptedResults,
  pendingShards: pendingShards.map(publicShardRow),
  rejectedResults: evaluated.rejectedResults,
  duplicateResults: evaluated.duplicateResults,
  workorders: selectedPendingShards.map((shard) => buildWorkorder(plan, shard)),
  gatedCommands: {
    shardIntake: [
      "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:shard-intake",
      `--input ${allExpectedPublicInputs.join(",")}`,
      "--output <public-review-dir>/answer-quality-full-shard-intake.json",
      "--markdown-output <public-review-dir>/answer-quality-full-shard-intake.md",
      "--require-ready",
    ].join(" "),
    combineAfterIntakePasses: plan.runPlan?.combineCommand ?? null,
    resultGateAfterCombine: plan.runPlan?.resultGateCommand ?? null,
    reviewerIntakeAfterCombine: plan.runPlan?.reviewerIntakeCommand ?? null,
  },
  blockers: [
    pendingShards.length > 0 ? "answer-quality-shard-runs-pending" : null,
    evaluated.rejectedResults.length > 0 ? "answer-quality-shard-results-rejected" : null,
    evaluated.duplicateResults.length > 0 ? "answer-quality-shard-results-duplicated" : null,
  ].filter(Boolean),
  nextActions: readyForShardIntake
    ? [
        "Run benchmark:answer-quality:shard-intake with --require-ready against the accepted public shard-result JSONs.",
        "Run benchmark:answer-quality:combine only after shard intake reports READY_TO_COMBINE_FULL_ANSWER_QUALITY_SHARDS.",
        "Keep SOTA, public benchmark, and production-replacement claims blocked until result gate, reviewer intake, UI/docs, owner approval, and real canary all pass.",
      ]
    : [
        "Run the listed response-arm export and answer-quality commands for the pending shards.",
        "Re-run this workorder with the returned public shard-result JSONs to track progress.",
        "Do not run combine until benchmark:answer-quality:shard-intake passes with complete coverage.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "shard workorder report");
assertSafePublicText(markdownText, "shard workorder markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inputPaths() {
  const explicit = normalizeList([args.input, args.inputs].flatMap(coerceArray));
  const directory = args.directory ?? args.dir ?? null;
  if (!directory) return explicit;
  const dir = resolveInputPath(directory);
  assert.ok(existsSync(dir), `shard result directory missing: ${displayPath(dir)}`);
  const discovered = readdirSync(dir)
    .filter((name) => /^answer-quality-shard-\d{3}\.json$/u.test(name))
    .map((name) => join(dir, name));
  return [...explicit, ...discovered].sort();
}

function loadCandidateResult(pathLike) {
  const path = resolveInputPath(pathLike);
  assert.ok(existsSync(path), `shard result missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `shard result empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, displayPath(path));
  return {
    fileName: basename(path),
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json: JSON.parse(raw),
  };
}

function evaluateExistingShardResults({ plan: planValue, loaded: loadedItems }) {
  const expected = new Map((planValue.shards ?? []).map((shard) => [rangeKey(shard), shard]));
  const acceptedByShardId = new Map();
  const acceptedResults = [];
  const rejectedResults = [];
  const duplicateResults = [];
  const seenRanges = new Set();
  for (const item of loadedItems) {
    const range = shardRange(item.json);
    const key = range ? rangeKey(range) : null;
    const expectedShard = key ? expected.get(key) : null;
    const failures = candidateFailures({ item, range, expectedShard, planValue });
    if (key && seenRanges.has(key)) {
      duplicateResults.push({ range: key, fileName: item.fileName, hash: item.hash });
      failures.push("duplicate-shard-range");
    }
    if (key) seenRanges.add(key);
    const row = {
      shardId: expectedShard?.id ?? null,
      range: key,
      startIndex: range?.startIndex ?? null,
      endIndexExclusive: range?.endIndexExclusive ?? null,
      scoredQueryCount: range?.scoredQueryCount ?? null,
      fileName: item.fileName,
      hash: item.hash,
    };
    if (failures.length) rejectedResults.push({ ...row, failures });
    else {
      acceptedResults.push(row);
      acceptedByShardId.set(expectedShard.id, row);
    }
  }
  acceptedResults.sort((left, right) => left.startIndex - right.startIndex);
  return { acceptedByShardId, acceptedResults, rejectedResults, duplicateResults };
}

function candidateFailures({ item, range, expectedShard, planValue }) {
  return [
    item.json.mode !== "public-benchmark-answer-quality" ? "not-answer-quality-report" : null,
    item.json.fixtureOnly !== false ? "fixture-result" : null,
    item.json.metricsOnly !== true ? "not-metrics-only" : null,
    item.json.publicSafe !== true ? "not-public-safe" : null,
    item.json.retrievalProxyOnly !== false ? "retrieval-proxy-only" : null,
    item.json.memoryBenchAnswerQuality !== true ? "memorybench-answer-quality-not-proven" : null,
    item.json.publicBenchmarkClaimsAllowed !== false ? "public-claims-enabled" : null,
    item.json.rawQuestionsIncluded !== false ? "raw-questions-included" : null,
    item.json.rawAnswersIncluded !== false ? "raw-answers-included" : null,
    item.json.rawMemoryIncluded !== false ? "raw-memory-included" : null,
    item.json.rawTranscriptIncluded !== false ? "raw-transcript-included" : null,
    item.json.target?.hash !== planValue.target?.hash ? "target-hash-mismatch" : null,
    item.json.input?.targetHash !== planValue.target?.hash ? "input-target-hash-mismatch" : null,
    item.json.input?.answerLabelsHash !== planValue.target?.answerLabelsHash ? "answer-labels-hash-mismatch" : null,
    item.json.input?.scoringCodeHash !== planValue.target?.scoringCodeHash ? "scoring-code-hash-mismatch" : null,
    item.json.input?.querySetHash !== planValue.materializeReport?.collectorCompatibleQuerySetHash ? "query-set-hash-mismatch" : null,
    item.json.input?.materializerHash !== planValue.materializeReport?.materializerHash ? "materializer-hash-mismatch" : null,
    Number(item.json.input?.totalQueryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "total-query-count-mismatch" : null,
    Number(item.json.input?.queryCount ?? 0) !== Number(planValue.runPlan?.queryCount ?? 0) ? "input-query-count-mismatch" : null,
    item.json.provider?.answerModel !== planValue.target?.answerModel ? "answer-model-mismatch" : null,
    item.json.provider?.judgeModel !== planValue.target?.judgeModel ? "judge-model-mismatch" : null,
    Number(item.json.privacyLeakCount ?? 0) !== 0 ? "privacy-leak-count-nonzero" : null,
    Number(item.json.redactionFailureCount ?? 0) !== 0 ? "redaction-failure-count-nonzero" : null,
    !range ? "query-shard-range-missing" : null,
    range && !expectedShard ? "query-shard-range-not-in-plan" : null,
    range && Number(range.totalQueryCount) !== Number(planValue.runPlan?.queryCount ?? 0) ? "range-total-query-count-mismatch" : null,
    range && expectedShard && range.scoredQueryCount !== expectedShard.queryCount ? "scored-query-count-mismatch" : null,
    range && range.scoredQueryCount !== range.endIndexExclusive - range.startIndex ? "range-count-mismatch" : null,
    expectedShard && item.json.input?.queryShard?.selectedQueryIdHash !== expectedShard.rangeHash ? "shard-range-hash-mismatch" : null,
    strategyNamesHash(item.json) !== planStrategyHash(planValue) ? "strategy-set-mismatch" : null,
  ].filter(Boolean);
}

function buildWorkorder(planValue, shard) {
  return {
    shardId: shard.id,
    startIndex: shard.startIndex,
    endIndexExclusive: shard.endIndexExclusive,
    queryCount: shard.queryCount,
    expectedPublicResult: `<public-review-dir>/answer-quality-${shard.id}.json`,
    expectedPublicMarkdown: `<public-review-dir>/answer-quality-${shard.id}.md`,
    expectedPrivateArmDirectory: `<private-output-dir>/arms/${shard.id}`,
    commands: {
      responseArmExport: replaceShardTokens(planValue.runPlan?.responseArmExportTemplate ?? "", shard),
      answerQuality: replaceShardTokens(planValue.runPlan?.answerQualityTemplate ?? "", shard),
    },
  };
}

function replaceShardTokens(template, shard) {
  return String(template)
    .replaceAll("{shardId}", shard.id)
    .replaceAll("{startIndex}", String(shard.startIndex))
    .replaceAll("{queryCount}", String(shard.queryCount));
}

function publicShardRow(shard) {
  return {
    shardId: shard.id,
    startIndex: shard.startIndex,
    endIndexExclusive: shard.endIndexExclusive,
    queryCount: shard.queryCount,
    rangeHash: shard.rangeHash,
  };
}

function buildExecutionLaneReadiness(lanes) {
  return lanes.map((lane) => {
    const strategies = lane.strategies ?? [];
    const providers = lane.providerRequirements ?? [];
    const providerReadiness = Object.fromEntries(providers.map((provider) => [provider, inspectProviderReadiness(provider)]));
    const exportReadiness = inspectResponseArmExportReadiness({ lane, providers, strategies, providerReadiness });
    const answerQualityReadiness = inspectAnswerQualityReadiness();
    const queryExpansionReadiness = inspectQueryExpansionReadiness(strategies);
    const blockers = unique([
      !lane.coverageReady ? "lane-strategy-coverage-missing" : null,
      ...exportReadiness.blockers,
      ...answerQualityReadiness.blockers,
      ...queryExpansionReadiness.blockers,
    ].filter(Boolean));
    return {
      laneId: lane.id,
      label: lane.label,
      acceptedByFullShardIntake: Boolean(lane.acceptedByFullShardIntake),
      diagnosticOnly: lane.acceptedByFullShardIntake !== true,
      coverageReady: Boolean(lane.coverageReady),
      strategies,
      providerRequirements: providers,
      providerReadiness,
      responseArmExport: exportReadiness,
      queryExpansion: queryExpansionReadiness,
      answerQuality: answerQualityReadiness,
      readyForResponseArmExport: lane.coverageReady === true && exportReadiness.ready && queryExpansionReadiness.ready,
      readyForAnswerQualityScoring:
        lane.coverageReady === true && exportReadiness.ready && queryExpansionReadiness.ready && answerQualityReadiness.ready,
      readyForAcceptedShardIntakeCandidate:
        lane.acceptedByFullShardIntake === true &&
        lane.coverageReady === true &&
        exportReadiness.ready &&
        queryExpansionReadiness.ready &&
        answerQualityReadiness.ready,
      countsAsFullMemorySotaEvidence: false,
      publicBenchmarkClaimsAllowed: false,
      blockers,
    };
  });
}

function inspectResponseArmExportReadiness({ lane, providers, strategies, providerReadiness }) {
  const requiresProviderCalls = providers.some((provider) => provider !== "local-apple" && provider !== "local-rerank");
  const providerCredentialBlockers = providers.flatMap((provider) => {
    const state = providerReadiness[provider];
    return state?.ready ? [] : [`${provider}-credentials-missing`];
  });
  const blockers = [
    !truthyEnv("RECALLWEAVE_BASELINE_LIVE") ? "RECALLWEAVE_BASELINE_LIVE-not-enabled" : null,
    !truthyEnv("RECALLWEAVE_BASELINE_NO_RAW_TEXT") ? "RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed" : null,
    requiresProviderCalls && !truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS")
      ? "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled"
      : null,
    requiresProviderCalls && !truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA")
      ? "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed"
      : null,
    ...providerCredentialBlockers,
  ].filter(Boolean);
  return {
    laneId: lane.id,
    ready: blockers.length === 0,
    liveExportEnabled: truthyEnv("RECALLWEAVE_BASELINE_LIVE"),
    noRawTextConfirmed: truthyEnv("RECALLWEAVE_BASELINE_NO_RAW_TEXT"),
    providerCallsRequired: requiresProviderCalls,
    providerCallsEnabled: truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS"),
    providerPublicDataConfirmed: truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA"),
    queryExpansionStrategyPresent: strategies.includes("query-expanded-full-hybrid-rerank"),
    printsEnvValues: false,
    blockers,
  };
}

function inspectAnswerQualityReadiness() {
  const baseUrl = String(process.env.RECALLWEAVE_MEMORYBENCH_BASE_URL ?? "").trim();
  const answerModelPresent = hasAnyEnv("RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL", "RECALLWEAVE_BASELINE_ANSWER_MODEL");
  const judgeModelPresent = hasAnyEnv("RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL", "RECALLWEAVE_BASELINE_JUDGE_MODEL");
  const baseUrlPresent = baseUrl.length > 0;
  const cloudEndpointRequiresApiKey = baseUrlPresent && !isLocalUrl(baseUrl);
  const apiKeyPresent = hasAnyEnv("RECALLWEAVE_MEMORYBENCH_API_KEY");
  const blockers = [
    !truthyEnv("RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS")
      ? "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled"
      : null,
    !truthyEnv("RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA") ? "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed" : null,
    !truthyEnv("RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT")
      ? "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed"
      : null,
    !answerModelPresent ? "answer-model-missing" : null,
    !judgeModelPresent ? "judge-model-missing" : null,
    !baseUrlPresent ? "openai-compatible-base-url-missing" : null,
    cloudEndpointRequiresApiKey && !apiKeyPresent ? "RECALLWEAVE_MEMORYBENCH_API_KEY-missing-for-cloud-endpoint" : null,
  ].filter(Boolean);
  return {
    ready: blockers.length === 0,
    answerQualityCallsEnabled: truthyEnv("RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS"),
    publicDataConfirmed: truthyEnv("RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA"),
    noRawTextOutputConfirmed: truthyEnv("RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT"),
    answerModelPresent,
    judgeModelPresent,
    baseUrlPresent,
    endpointIsLocal: baseUrlPresent ? isLocalUrl(baseUrl) : false,
    cloudEndpointRequiresApiKey,
    apiKeyPresent,
    printsEnvValues: false,
    blockers,
  };
}

function inspectQueryExpansionReadiness(strategies) {
  if (!strategies.includes("query-expanded-full-hybrid-rerank")) {
    return {
      required: false,
      ready: true,
      localEndpointPresent: false,
      localModelPresent: false,
      localReady: false,
      cloudCallsEnabled: false,
      publicDataConfirmed: false,
      cloudProviderReady: false,
      readyProviderKinds: [],
      printsEnvValues: false,
      blockers: [],
    };
  }
  const localEndpointPresent = hasAnyEnv("SELFMEM_QUERY_EXPANSION_BASE_URL");
  const localModelPresent = hasAnyEnv("SELFMEM_QUERY_EXPANSION_MODEL");
  const localReady = localEndpointPresent && localModelPresent;
  const cloudCallsEnabled = truthyEnv("RECALLWEAVE_QUERY_EXPANSION_CALLS") || truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS");
  const publicDataConfirmed =
    truthyEnv("RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA") || truthyEnv("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA");
  const readyProviderKinds = ["nvidia", "gemini", "openrouter"].filter((provider) => inspectProviderReadiness(provider).ready);
  const cloudProviderReady = cloudCallsEnabled && publicDataConfirmed && readyProviderKinds.length > 0;
  const blockers = [
    !localReady && !cloudCallsEnabled ? "query-expansion-local-endpoint-or-cloud-consent-missing" : null,
    !localReady && cloudCallsEnabled && !publicDataConfirmed ? "query-expansion-public-data-not-confirmed" : null,
    !localReady && cloudCallsEnabled && publicDataConfirmed && readyProviderKinds.length === 0
      ? "query-expansion-cloud-provider-credentials-missing"
      : null,
  ].filter(Boolean);
  return {
    required: true,
    ready: localReady || cloudProviderReady,
    localEndpointPresent,
    localModelPresent,
    localReady,
    cloudCallsEnabled,
    publicDataConfirmed,
    cloudProviderReady,
    readyProviderKinds,
    defaultCloudProviderOrder: ["nvidia", "gemini", "openrouter"],
    printsEnvValues: false,
    blockers,
  };
}

function inspectProviderReadiness(provider) {
  const valueEnvNames = providerValueEnvNames(provider);
  const keyFileEnvNames = providerKeyFileEnvNames(provider);
  const valueKeyCount = valueEnvNames.flatMap((name) => splitEnvList(process.env[name] ?? "")).length;
  const fileStates = keyFileEnvNames.map(inspectProviderKeyFileEnv);
  const fileKeyCount = fileStates.reduce((count, state) => count + state.keyCount, 0);
  const keyCount = valueKeyCount + fileKeyCount;
  return {
    ready: keyCount > 0,
    keyCount,
    valueEnvNames,
    keyFileEnvNames,
    configuredValueEnvNames: valueEnvNames.filter((name) => hasAnyEnv(name)),
    configuredKeyFileEnvNames: fileStates.filter((state) => state.configured).map((state) => state.envName),
    keyFileIssues: fileStates.filter((state) => state.issue).map((state) => ({ envName: state.envName, issue: state.issue })),
    printsEnvValues: false,
  };
}

function inspectProviderKeyFileEnv(envName) {
  const value = process.env[envName];
  if (!value) return { envName, configured: false, keyCount: 0, issue: null };
  const resolved = resolve(String(value));
  if (!existsSync(resolved)) return { envName, configured: true, keyCount: 0, issue: "file-missing" };
  if (!statSync(resolved).isFile()) return { envName, configured: true, keyCount: 0, issue: "not-a-file" };
  if (!isOutsideRepo(resolved)) return { envName, configured: true, keyCount: 0, issue: "file-inside-repository" };
  const fileRaw = readFileSync(resolved, "utf8");
  return { envName, configured: true, keyCount: splitEnvList(fileRaw).length, issue: null };
}

function providerValueEnvNames(provider) {
  if (provider === "gemini") return ["GEMINI_API_KEY", "GEMINI_API_KEYS", "GOOGLE_API_KEY", "GOOGLE_API_KEYS", "AI_STUDIO_API_KEY", "AI_STUDIO_API_KEYS"];
  if (provider === "voyage") return ["VOYAGE_API_KEY", "VOYAGE_API_KEYS"];
  if (provider === "nvidia") return ["NVIDIA_API_KEY", "NVIDIA_API_KEYS", "NVAPI_KEY", "NVAPI_KEYS"];
  if (provider === "openrouter") return ["OPENROUTER_API_KEY", "OPENROUTER_API_KEYS"];
  if (provider === "local-apple") return ["SELFMEM_LOCAL_EMBED_BASE_URL"];
  if (provider === "local-rerank") return ["SELFMEM_LOCAL_RERANK_ENDPOINT", "SELFMEM_LOCAL_RERANK_BASE_URL"];
  return [];
}

function providerKeyFileEnvNames(provider) {
  if (provider === "gemini") return ["GEMINI_API_KEY_FILE", "GEMINI_API_KEYS_FILE", "GOOGLE_API_KEY_FILE", "GOOGLE_API_KEYS_FILE", "AI_STUDIO_API_KEY_FILE", "AI_STUDIO_API_KEYS_FILE"];
  if (provider === "voyage") return ["VOYAGE_API_KEY_FILE", "VOYAGE_API_KEYS_FILE"];
  if (provider === "nvidia") return ["NVIDIA_API_KEY_FILE", "NVIDIA_API_KEYS_FILE", "NVAPI_KEY_FILE", "NVAPI_KEYS_FILE"];
  if (provider === "openrouter") return ["OPENROUTER_API_KEY_FILE", "OPENROUTER_API_KEYS_FILE"];
  return [];
}

function truthyEnv(name) {
  return process.env[name] === "1";
}

function hasAnyEnv(...names) {
  return names.some((name) => String(process.env[name] ?? "").trim().length > 0);
}

function splitEnvList(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalUrl(value) {
  try {
    const parsed = new URL(String(value));
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isOutsideRepo(path) {
  const rel = relative(root, path);
  return rel.startsWith("..") || isAbsolute(rel);
}

function shardRange(result) {
  const shard = result.input?.queryShard ?? {};
  const startIndex = intOrNull(result.input?.scoredQueryStart ?? shard.startIndex ?? result.input?.queryOffset);
  const endIndexExclusive = intOrNull(result.input?.scoredQueryEndExclusive ?? shard.endIndexExclusive);
  const totalQueryCount = intOrNull(result.input?.totalQueryCount ?? shard.totalQueryCount ?? result.input?.queryCount);
  const scoredQueryCount = intOrNull(result.input?.scoredQueryCount ?? shard.scoredQueryCount);
  if ([startIndex, endIndexExclusive, totalQueryCount, scoredQueryCount].some((value) => value == null)) return null;
  return { startIndex, endIndexExclusive, totalQueryCount, scoredQueryCount };
}

function strategyNamesHash(result) {
  return `sha256:${sha256(JSON.stringify((result.strategies ?? []).map((item) => item.strategy).filter(Boolean).sort()))}`;
}

function planStrategyHash(planValue) {
  return `sha256:${sha256(JSON.stringify([...(planValue.runPlan?.strategies ?? [])].sort()))}`;
}

function rangeKey(value) {
  return `${value.startIndex}-${value.endIndexExclusive}`;
}

function renderMarkdown(value) {
  return [
    "# Full Answer-Quality Shard Workorder",
    "",
    `- Status: ${value.status}`,
    `- Ready for shard intake: ${value.readyForShardIntake}`,
    `- Ready for shard combine: ${value.readyForShardCombine}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Accepted shards: ${value.progress.acceptedShardCount}`,
    `- Pending shards: ${value.progress.pendingShardCount}`,
    `- Rejected results: ${value.progress.rejectedResultCount}`,
    `- Workorders emitted: ${value.progress.workorderCount}`,
    "",
    "## Workorders",
    ...(value.workorders.length
      ? value.workorders.map((item) => `- ${item.shardId}: ${item.startIndex}-${item.endIndexExclusive}`)
      : ["- none"]),
    "",
    "## Execution Lanes",
    ...((value.executionLanes ?? []).length
      ? value.executionLanes.map(
          (lane) =>
            `- ${lane.id}: ready=${lane.coverageReady}; intake-compatible=${lane.acceptedByFullShardIntake}; providers=${lane.providerRequirements?.join(", ") || "none"}`,
        )
      : ["- none"]),
    "",
    "## Execution Lane Readiness",
    ...((value.executionLaneReadiness ?? []).length
      ? value.executionLaneReadiness.flatMap((lane) => [
          `- ${lane.laneId}: response-export=${lane.readyForResponseArmExport}; answer-quality=${lane.readyForAnswerQualityScoring}; intake-candidate=${lane.readyForAcceptedShardIntakeCandidate}`,
          `  - blockers=${lane.blockers.length ? lane.blockers.join(", ") : "none"}`,
        ])
      : ["- none"]),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Gated Commands",
    `- Intake: ${value.gatedCommands.shardIntake}`,
    `- Combine after intake passes: ${value.gatedCommands.combineAfterIntakePasses ?? "none"}`,
    `- Result gate after combine: ${value.gatedCommands.resultGateAfterCombine ?? "none"}`,
    `- Reviewer intake after combine: ${value.gatedCommands.reviewerIntakeAfterCombine ?? "none"}`,
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

function normalizeList(values) {
  return values
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items)].sort();
}

function coerceArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function intOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
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
  return rel.startsWith("..") ? basename(value) : rel;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
