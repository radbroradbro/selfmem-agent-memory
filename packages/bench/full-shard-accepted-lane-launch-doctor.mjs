import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = args.reviewDir ?? "reviews/overnight-20260522";
const planPath = resolveInputPath(args.plan ?? `${reviewDir}/answer-quality-full-shard-plan-20260525.json`);
const privateInputDoctorPath = resolveInputPath(args.privateInputDoctor ?? `${reviewDir}/full-shard-private-input-doctor-current.json`);
const sotaDoctorPath = resolveInputPath(args.sotaDoctor ?? `${reviewDir}/full-memory-sota-doctor-20260526.json`);
const privateInputDir = args.privateInputDir ? resolveInputPath(args.privateInputDir) : null;
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(planPath), `full-shard plan missing: ${displayPath(planPath)}`);

const planRaw = readFileSync(planPath, "utf8");
assertSafePublicText(planRaw, "full-shard plan");
const plan = JSON.parse(planRaw);
assert.equal(plan.mode, "public-benchmark-answer-quality-shard-plan", "plan must be a full answer-quality shard plan");
const claimScope = String(plan.claimScope ?? plan.runPlan?.claimScope ?? "full-sota");
assert.ok(["full-sota", "local-full"].includes(claimScope), "plan claim scope must be full-sota or local-full");
const isFullSota = claimScope === "full-sota";
const progressInputState = discoverProgressInputs({ claimScope, reviewDir });

const workorder = runNodeJson("packages/bench/public-benchmark-answer-quality-shard-workorder.mjs", [
  "--plan",
  displayPath(planPath),
  "--max-workorders",
  "1",
  ...progressInputState.inputPaths.flatMap((inputPath) => ["--input", displayPath(inputPath)]),
]);
const privateInputDoctor = privateInputDir
  ? runNodeJson("packages/bench/full-shard-private-input-doctor.mjs", [
      "--plan",
      displayPath(planPath),
      "--private-input-dir",
      privateInputDir,
    ])
  : loadJson(privateInputDoctorPath, "full-shard private input doctor");
const sotaDoctor = existsSync(sotaDoctorPath) ? loadJson(sotaDoctorPath, "full memory SOTA doctor") : null;

const acceptedLane = workorder.executionLaneReadiness?.find((lane) => lane.acceptedByFullShardIntake === true) ?? null;
assert.ok(acceptedLane, "accepted full-shard intake lane missing");

const firstWorkorder = workorder.workorders?.[0] ?? null;
const privateInputReady = privateInputDoctor.readyForAnswerQualityShardRun === true;
const localRuntimeHealth = await inspectAcceptedLaneLocalRuntime(acceptedLane);
const acceptedLaneReadyForExport = acceptedLane.readyForResponseArmExport === true && localRuntimeHealth.readyForResponseArmExport === true;
const acceptedLaneReadyForScoring = acceptedLane.readyForAnswerQualityScoring === true;
const readyForFirstAcceptedShardRun = privateInputReady && acceptedLaneReadyForExport && acceptedLaneReadyForScoring;
const readyForAcceptedShardIntake = readyForFirstAcceptedShardRun && workorder.readyForShardIntake === true;
const readyForPublicSotaClaim =
  isFullSota &&
  readyForAcceptedShardIntake &&
  sotaDoctor?.countsAsFullMemorySotaEvidence === true &&
  sotaDoctor?.publicBenchmarkClaimsAllowed === true;
const readyForLocalFullBenchmarkResult = !isFullSota && readyForAcceptedShardIntake;
const blockers = unique([
  ...arrayOf(privateInputDoctor.blockers),
  ...arrayOf(acceptedLane.blockers),
  ...arrayOf(localRuntimeHealth.blockers),
  !privateInputReady ? "full-shard-private-inputs-not-ready" : null,
  !acceptedLaneReadyForExport ? "accepted-lane-response-export-not-ready" : null,
  !acceptedLaneReadyForScoring ? "accepted-lane-answer-quality-scoring-not-ready" : null,
  workorder.readyForShardIntake !== true
    ? isFullSota
      ? "full-answer-quality-shard-results-not-returned"
      : "local-full-answer-quality-shard-results-not-returned"
    : null,
  isFullSota && sotaDoctor?.countsAsFullMemorySotaEvidence !== true ? "full-memory-sota-score-not-proven" : null,
  isFullSota && sotaDoctor?.publicBenchmarkClaimsAllowed !== true ? "public-sota-claim-not-allowed" : null,
].filter(Boolean));

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "full-shard-accepted-lane-launch-doctor",
  status: readyForFirstAcceptedShardRun ? "READY_FOR_ACCEPTED_LANE_SHARD_LAUNCH" : "BLOCKED_ACCEPTED_LANE_SHARD_LAUNCH",
  claimScope,
  generatedAt: new Date().toISOString(),
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  plan: {
    path: displayPath(planPath),
    hash: `sha256:${sha256(planRaw)}`,
    claimScope,
    queryCount: Number(plan.runPlan?.queryCount ?? 0),
    shardCount: Number(plan.runPlan?.shardCount ?? 0),
    shardSize: Number(plan.runPlan?.shardSize ?? 0),
    acceptedLaneIds: arrayOf(plan.executionLanes)
      .filter((lane) => lane.acceptedByFullShardIntake === true)
      .map((lane) => lane.id),
    diagnosticLaneIds: arrayOf(plan.executionLanes)
      .filter((lane) => lane.acceptedByFullShardIntake !== true)
      .map((lane) => lane.id),
  },
  launchGate: {
    readyForFirstAcceptedShardRun,
    readyForAcceptedShardIntake,
    readyForPublicSotaClaim,
    readyForLocalFullBenchmarkResult,
    privateInputsReady: privateInputReady,
    acceptedLaneReadyForResponseArmExport: acceptedLaneReadyForExport,
    acceptedLaneReadyForAnswerQualityScoring: acceptedLaneReadyForScoring,
    localRuntimeReadyForResponseArmExport: localRuntimeHealth.readyForResponseArmExport,
    shardResultsReturned: workorder.readyForShardIntake === true,
    fullMemorySotaScoreProven: sotaDoctor?.countsAsFullMemorySotaEvidence === true,
    publicSotaClaimAllowed: sotaDoctor?.publicBenchmarkClaimsAllowed === true,
  },
  privateInput: {
    source: privateInputDir ? "fresh-private-input-dir-check" : "checked-in-private-input-doctor",
    status: privateInputDoctor.status ?? null,
    readyForAnswerQualityShardRun: privateInputReady,
    rawSourcesRetainedPrivate: privateInputDoctor.materializeReport?.rawSourcesRetainedPrivate === true,
    privateDirectoryPresent: privateInputDoctor.privateInput?.directoryPresent === true,
    privateDirectoryInsideRepository: privateInputDoctor.privateInput?.directoryInsideRepository === true,
    privatePathPrinted: privateInputDoctor.privateInput?.valuePrinted === true,
    filesPresent: arrayOf(privateInputDoctor.privateInput?.files).filter((file) => file.present === true).length,
    filesHashMatched: arrayOf(privateInputDoctor.privateInput?.files).filter((file) => file.hashMatches === true).length,
    filesMode0600: arrayOf(privateInputDoctor.privateInput?.files).filter((file) => file.mode === "0600").length,
    blockerCount: arrayOf(privateInputDoctor.blockers).length,
    blockers: arrayOf(privateInputDoctor.blockers),
  },
  acceptedLane: {
    laneId: acceptedLane.laneId,
    label: acceptedLane.label,
    acceptedByFullShardIntake: acceptedLane.acceptedByFullShardIntake === true,
    canReachFullSotaGateAfterShardIntake: acceptedLane.canReachFullSotaGateAfterShardIntake === true,
    diagnosticOnly: acceptedLane.diagnosticOnly === true,
    strategies: acceptedLane.strategies ?? [],
    providerRequirements: acceptedLane.providerRequirements ?? [],
    readyForResponseArmExport: acceptedLaneReadyForExport,
    readyForAnswerQualityScoring: acceptedLaneReadyForScoring,
    readyForAcceptedShardIntakeCandidate: acceptedLane.readyForAcceptedShardIntakeCandidate === true,
    countsAsFullMemorySotaEvidence: acceptedLane.countsAsFullMemorySotaEvidence === true,
    publicBenchmarkClaimsAllowed: acceptedLane.publicBenchmarkClaimsAllowed === true,
    responseArmExport: acceptedLane.responseArmExport,
    answerQuality: sanitizeAnswerQualityReadiness(acceptedLane.answerQuality),
    queryExpansion: acceptedLane.queryExpansion,
    providerReadiness: acceptedLane.providerReadiness,
    localRuntimeHealth,
    blockerCount: arrayOf(acceptedLane.blockers).length,
    blockers: arrayOf(acceptedLane.blockers),
  },
  shardProgress: {
    progressSource: progressInputState.source,
    progressIntakePath: progressInputState.intakePath ? displayPath(progressInputState.intakePath) : null,
    progressInputCount: progressInputState.inputPaths.length,
    progressInputFiles: progressInputState.inputPaths.map((inputPath) => basename(inputPath)),
    acceptedShardCount: Number(workorder.progress?.acceptedShardCount ?? 0),
    pendingShardCount: Number(workorder.progress?.pendingShardCount ?? 0),
    rejectedResultCount: Number(workorder.progress?.rejectedResultCount ?? 0),
    duplicateResultCount: Number(workorder.progress?.duplicateResultCount ?? 0),
    workorderCount: Number(workorder.progress?.workorderCount ?? 0),
    firstPendingShardId: firstWorkorder?.shardId ?? null,
    firstPendingShardRange:
      firstWorkorder == null ? null : `${firstWorkorder.startIndex}-${firstWorkorder.endIndexExclusive}`,
  },
  operatorInputsNeeded: operatorInputsNeeded(acceptedLane, privateInputDoctor, { isFullSota, localRuntimeHealth }),
  nextCommands: {
    responseArmExport: firstWorkorder?.commands?.responseArmExport ?? null,
    answerQuality: firstWorkorder?.commands?.answerQuality ?? null,
    workorderRefresh: "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:shard-workorder",
    shardIntakeAfterAllShards: workorder.gatedCommands?.shardIntake ?? null,
  },
  blockers,
  nextActions: readyForFirstAcceptedShardRun
    ? isFullSota
      ? [
          "Run the accepted full-SOTA lane shard commands into an outside-repository private output directory.",
          "Commit only public-safe shard result JSON and markdown after answer-quality scoring completes.",
          "Keep public SOTA and production-replacement claims blocked until shard intake, combine, result gate, reviewers, UI/docs refresh, owner approval, and real canary all pass.",
        ]
      : [
          "Run the accepted local-full lane shard commands into an outside-repository private output directory.",
          "Commit only public-safe shard result JSON and markdown after answer-quality scoring completes.",
          "Treat the completed result as local model-method evidence only; SOTA, launch, and production-replacement claims still require the full provider/reviewer/canary gate.",
        ]
    : isFullSota
      ? [
          "Satisfy the private-input doctor, accepted-lane model/provider readiness, answer-quality endpoint, and query-expansion evidence requirements.",
          "Use local query expansion when available; use cloud query expansion only with explicit public-data and provider-call consent.",
          "Do not substitute diagnostic BM25/control lanes for the accepted full-SOTA lane.",
        ]
      : [
          "Satisfy the private-input doctor, local embedding, local rerank, answer-quality endpoint, and model-backed query-expansion requirements.",
          "Use local query expansion when available; use cloud query expansion only with explicit public-data and provider-call consent.",
          "Do not substitute BM25, deterministic expansion, or provider-only lanes for the accepted local-full lane.",
        ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "accepted lane launch doctor");
assertSafePublicText(markdownText, "accepted lane launch doctor markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function sanitizeAnswerQualityReadiness(value) {
  return {
    ready: value?.ready === true,
    answerQualityCallsEnabled: value?.answerQualityCallsEnabled === true,
    publicDataConfirmed: value?.publicDataConfirmed === true,
    noRawTextOutputConfirmed: value?.noRawTextOutputConfirmed === true,
    answerModelPresent: value?.answerModelPresent === true,
    judgeModelPresent: value?.judgeModelPresent === true,
    targetAnswerModel: value?.targetAnswerModel ?? null,
    targetJudgeModel: value?.targetJudgeModel ?? null,
    answerModelMatchesTarget: value?.answerModelMatchesTarget === true,
    judgeModelMatchesTarget: value?.judgeModelMatchesTarget === true,
    modelMatchPolicy: value?.modelMatchPolicy ?? null,
    exactTargetModelsRequired: value?.exactTargetModelsRequired === true,
    localDiagnosticModelAllowed: value?.localDiagnosticModelAllowed === true,
    localDiagnosticEndpointSatisfied: value?.localDiagnosticEndpointSatisfied === true,
    scoringModelPolicySatisfied: value?.scoringModelPolicySatisfied === true,
    baseUrlPresent: value?.baseUrlPresent === true,
    endpointIsLocal: value?.endpointIsLocal === true,
    cloudEndpointRequiresApiKey: value?.cloudEndpointRequiresApiKey === true,
    apiKeyPresent: value?.apiKeyPresent === true,
    printsEnvValues: false,
    blockers: arrayOf(value?.blockers),
  };
}

async function inspectAcceptedLaneLocalRuntime(lane) {
  const providers = new Set(arrayOf(lane.providerRequirements));
  const timeoutMs = positiveInt(process.env.RECALLWEAVE_ACCEPTED_LANE_LOCAL_HEALTH_TIMEOUT_MS ?? 1_500, "local health timeout ms");
  const localApple = await inspectLocalEndpoint({
    provider: "local-apple",
    required: providers.has("local-apple"),
    envNames: ["SELFMEM_LOCAL_EMBED_BASE_URL"],
    value: process.env.SELFMEM_LOCAL_EMBED_BASE_URL,
    pathKind: "models",
    timeoutMs,
  });
  const localRerank = await inspectLocalEndpoint({
    provider: "local-rerank",
    required: providers.has("local-rerank"),
    envNames: ["SELFMEM_LOCAL_RERANK_ENDPOINT", "SELFMEM_LOCAL_RERANK_BASE_URL"],
    value: localRerankHealthSource(),
    pathKind: "healthz",
    timeoutMs,
  });
  const endpoints = {
    "local-apple": localApple,
    "local-rerank": localRerank,
  };
  const blockers = [localApple, localRerank]
    .filter((item) => item.required && !item.ready)
    .flatMap((item) => item.blockers);
  return {
    timeoutMs,
    endpointValuesPrinted: false,
    readyForResponseArmExport: blockers.length === 0,
    endpoints,
    blockers: unique(blockers),
  };
}

async function inspectLocalEndpoint({ provider, required, envNames, value, pathKind, timeoutMs }) {
  const configured = String(value ?? "").trim().length > 0;
  const localOnly = configured ? isLocalUrl(value) : false;
  if (!required) {
    return endpointState({ provider, required, configured, localOnly, checked: false, reachable: true, status: "not-required" });
  }
  if (!configured) {
    return endpointState({
      provider,
      required,
      configured,
      localOnly,
      checked: false,
      reachable: false,
      status: "missing",
      blockers: [`${provider}-endpoint-missing`],
      envNames,
    });
  }
  if (!localOnly) {
    return endpointState({
      provider,
      required,
      configured,
      localOnly,
      checked: false,
      reachable: false,
      status: "not-local",
      blockers: [`${provider}-endpoint-not-local`],
      envNames,
    });
  }
  const healthUrl = healthProbeUrl(value, pathKind);
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return endpointState({
        provider,
        required,
        configured,
        localOnly,
        checked: true,
        reachable: false,
        httpStatus: response.status,
        status: "non-200",
        blockers: [`${provider}-endpoint-non-200`],
        envNames,
      });
    }
    return endpointState({
      provider,
      required,
      configured,
      localOnly,
      checked: true,
      reachable: true,
      httpStatus: response.status,
      status: "ready",
      envNames,
    });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return endpointState({
      provider,
      required,
      configured,
      localOnly,
      checked: true,
      reachable: false,
      httpStatus: null,
      status: timeout ? "timeout" : "fetch-failed",
      blockers: [timeout ? `${provider}-endpoint-timeout` : `${provider}-endpoint-fetch-failed`],
      envNames,
    });
  }
}

function endpointState({
  provider,
  required,
  configured,
  localOnly,
  checked,
  reachable,
  httpStatus = null,
  status,
  blockers = [],
  envNames = [],
}) {
  return {
    provider,
    required: Boolean(required),
    configured: Boolean(configured),
    localOnly: Boolean(localOnly),
    checked: Boolean(checked),
    reachable: Boolean(reachable),
    ready: !required || (Boolean(configured) && Boolean(localOnly) && Boolean(reachable)),
    httpStatus,
    status,
    envNames,
    endpointValuePrinted: false,
    blockers,
  };
}

function localRerankHealthSource() {
  const directEndpoint = String(process.env.SELFMEM_LOCAL_RERANK_ENDPOINT ?? "").trim();
  if (directEndpoint) return directEndpoint;
  const baseUrl = String(process.env.SELFMEM_LOCAL_RERANK_BASE_URL ?? "").trim();
  if (!baseUrl) return "";
  return `${baseUrl.replace(/\/+$/, "")}/rerank`;
}

function healthProbeUrl(value, pathKind) {
  const url = new URL(String(value));
  if (pathKind === "models") {
    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/models`.replace(/\/+/g, "/");
    url.search = "";
    return url.toString();
  }
  url.pathname = "/healthz";
  url.search = "";
  return url.toString();
}

function isLocalUrl(value) {
  try {
    const url = new URL(String(value));
    return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function operatorInputsNeeded(lane, privateInputDoctorReport, options) {
  const needs = [];
  const push = (id, ready, envNames, note) => {
    if (!ready) needs.push({ id, envNames, note, valuePrinted: false });
  };
  push("private-input-dir", privateInputDoctorReport.readyForAnswerQualityShardRun === true, ["--private-input-dir"], "outside-repository full benchmark private inputs");
  push(
    "response-export-consent",
    lane.responseArmExport?.liveExportEnabled === true && lane.responseArmExport?.noRawTextConfirmed === true,
    ["RECALLWEAVE_BASELINE_LIVE", "RECALLWEAVE_BASELINE_NO_RAW_TEXT"],
    "live response export with no raw text output",
  );
  for (const provider of arrayOf(lane.providerRequirements)) {
    const readiness = lane.providerReadiness?.[provider] ?? {};
    const endpointHealth = options.localRuntimeHealth?.endpoints?.[provider] ?? {};
    push(
      `${provider}-readiness`,
      readiness.ready === true && (provider.startsWith("local-") ? endpointHealth.ready === true : true),
      [...arrayOf(readiness.valueEnvNames), ...arrayOf(readiness.keyFileEnvNames)],
      `${provider} endpoint or credential readiness`,
    );
  }
  push(
    "provider-response-arms",
    lane.responseArmExport?.providerCallsRequired !== true || lane.responseArmExport?.providerCallsEnabled === true,
    ["RECALLWEAVE_PROVIDER_BENCHMARK_CALLS", "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA"],
    "provider challenger arms for the accepted lane",
  );
  push(
    "answer-quality-scoring",
    lane.answerQuality?.ready === true,
    [
      "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS",
      "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA",
      "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT",
      "RECALLWEAVE_MEMORYBENCH_BASE_URL",
      "RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL",
      "RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL",
    ],
    "OpenAI-compatible answer and judge endpoint matching the target models",
  );
  push(
    "query-expansion-evidence",
    lane.queryExpansion?.readyForAcceptedShardIntake === true,
    [
      "SELFMEM_QUERY_EXPANSION_BASE_URL",
      "SELFMEM_QUERY_EXPANSION_MODEL",
      "RECALLWEAVE_QUERY_EXPANSION_CALLS",
      "RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA",
    ],
    options.isFullSota
      ? "model-backed query expansion for the accepted SOTA lane"
      : "model-backed query expansion for the accepted local-full lane",
  );
  return needs;
}

function discoverProgressInputs({ claimScope, reviewDir }) {
  const explicit = normalizeList([args.input, args.inputs].flatMap(coerceArray)).map(resolveInputPath);
  if (explicit.length) {
    return {
      source: "explicit-shard-results",
      intakePath: null,
      inputPaths: existingPublicInputs(explicit),
    };
  }
  const explicitIntakes = normalizeList([args.progressIntake, args.progressIntakes].flatMap(coerceArray)).map(resolveInputPath);
  const defaultIntakes = claimScope === "local-full"
    ? [
        resolveInputPath(`${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526.json`),
        resolveInputPath(`${reviewDir}/answer-quality-local-full-shard-intake-after-shard-001-20260526.json`),
        resolveInputPath(`${reviewDir}/answer-quality-local-full-shard-intake-20260526.json`),
      ]
    : [resolveInputPath(`${reviewDir}/answer-quality-full-shard-intake-20260525.json`)];
  const candidateIntakes = explicitIntakes.length ? explicitIntakes : defaultIntakes;
  const intakeStates = candidateIntakes
    .filter((intakePath) => existsSync(intakePath))
    .map((intakePath) => {
      const raw = readFileSync(intakePath, "utf8");
      assertSafePublicText(raw, displayPath(intakePath));
      const intake = JSON.parse(raw);
      const inputPaths = existingPublicInputs(arrayOf(intake.acceptedShards).map((item) => join(dirname(intakePath), String(item.fileName ?? ""))));
      return {
        source: explicitIntakes.length ? "explicit-progress-intake" : "checked-in-progress-intake",
        intakePath,
        inputPaths,
      };
    })
    .sort((left, right) => right.inputPaths.length - left.inputPaths.length);
  return intakeStates[0] ?? {
    source: "no-progress-inputs",
    intakePath: null,
    inputPaths: [],
  };
}

function existingPublicInputs(paths) {
  return paths.filter((inputPath) => {
    if (!inputPath || basename(inputPath) === "") return false;
    if (!existsSync(inputPath)) return false;
    const raw = readFileSync(inputPath, "utf8");
    assertSafePublicText(raw, displayPath(inputPath));
    return true;
  });
}

function renderMarkdown(value) {
  const title = value.claimScope === "local-full" ? "Local-Full Accepted Lane Launch Doctor" : "Full-Shard Accepted Lane Launch Doctor";
  return [
    `# ${title}`,
    "",
    `- Status: ${value.status}`,
    `- Claim scope: ${value.claimScope}`,
    `- Ready for first accepted shard run: ${value.launchGate.readyForFirstAcceptedShardRun}`,
    `- Ready for public SOTA claim: ${value.launchGate.readyForPublicSotaClaim}`,
    `- Ready for local-full benchmark result: ${value.launchGate.readyForLocalFullBenchmarkResult}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Query count: ${value.plan.queryCount}`,
    `- Shards: ${value.plan.shardCount}`,
    `- Accepted lane: ${value.acceptedLane.laneId}`,
    `- Progress source: ${value.shardProgress.progressSource}`,
    `- Progress inputs: ${value.shardProgress.progressInputCount}`,
    `- Pending shards: ${value.shardProgress.pendingShardCount}`,
    "",
    "## Gate",
    `- Private inputs ready: ${value.launchGate.privateInputsReady}`,
    `- Response export ready: ${value.launchGate.acceptedLaneReadyForResponseArmExport}`,
    `- Answer-quality scoring ready: ${value.launchGate.acceptedLaneReadyForAnswerQualityScoring}`,
    `- Shard results returned: ${value.launchGate.shardResultsReturned}`,
    `- Full memory SOTA score proven: ${value.launchGate.fullMemorySotaScoreProven}`,
    "",
    "## Accepted Lane",
    `- Strategies: ${value.acceptedLane.strategies.join(", ")}`,
    `- Providers: ${value.acceptedLane.providerRequirements.join(", ")}`,
    `- Query expansion requirement: ${value.acceptedLane.queryExpansion.evidenceRequirement}`,
    `- Query expansion model-backed: ${value.acceptedLane.queryExpansion.modelBackedReady}`,
    `- Diagnostic fallback allowed: ${value.acceptedLane.queryExpansion.diagnosticFallbackAllowed}`,
    `- Answer model target: ${value.acceptedLane.answerQuality.targetAnswerModel ?? "n/a"}`,
    `- Judge model target: ${value.acceptedLane.answerQuality.targetJudgeModel ?? "n/a"}`,
    "",
    "## Local Runtime Health",
    `- Ready for response-arm export: ${value.acceptedLane.localRuntimeHealth.readyForResponseArmExport}`,
    `- Local Apple required: ${value.acceptedLane.localRuntimeHealth.endpoints["local-apple"].required}`,
    `- Local Apple configured: ${value.acceptedLane.localRuntimeHealth.endpoints["local-apple"].configured}`,
    `- Local Apple reachable: ${value.acceptedLane.localRuntimeHealth.endpoints["local-apple"].reachable}`,
    `- Local rerank required: ${value.acceptedLane.localRuntimeHealth.endpoints["local-rerank"].required}`,
    `- Local rerank configured: ${value.acceptedLane.localRuntimeHealth.endpoints["local-rerank"].configured}`,
    `- Local rerank reachable: ${value.acceptedLane.localRuntimeHealth.endpoints["local-rerank"].reachable}`,
    `- Endpoint values printed: ${value.acceptedLane.localRuntimeHealth.endpointValuesPrinted}`,
    "",
    "## Operator Inputs Needed",
    ...(value.operatorInputsNeeded.length
      ? value.operatorInputsNeeded.map((item) => `- ${item.id}: ${item.envNames.join(", ")}`)
      : ["- none"]),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function runNodeJson(script, scriptArgs) {
  const result = spawnSync("node", [script, ...scriptArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `node ${script} ${scriptArgs.join(" ")} failed\n${result.stderr}\n${result.stdout}`);
  assertSafePublicText(result.stdout, script);
  return JSON.parse(result.stdout);
}

function loadJson(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return JSON.parse(raw);
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

function displayPath(value) {
  const rel = relative(root, resolve(value)).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value ?? "") : resolve(root, String(value ?? ""));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function coerceArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeList(values) {
  return values
    .filter((value) => value != null && value !== true)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
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
