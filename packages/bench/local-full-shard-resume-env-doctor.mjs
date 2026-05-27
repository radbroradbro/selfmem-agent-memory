import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureTempRoots = [];
process.on("exit", () => {
  for (const tempRoot of fixtureTempRoots) {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Best effort only; fixture mode never writes inside the repository.
    }
  }
});
const fixtureMode = Boolean(args.fixture);
const fixtureState = fixtureMode ? createFixtureState() : null;
const reviewDir = String(fixtureState?.reviewDir ?? args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const resumePacketPath = resolveInputPath(
  args.resumePacket ?? fixtureState?.resumePacketPath ?? `${reviewDir}/local-full-shard-002-resume-packet-20260526.json`,
);
const planPath = resolveInputPath(args.plan ?? fixtureState?.planPath ?? `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`);
const materializePath = resolveInputPath(
  args.materialize ??
    args.materializeReport ??
    fixtureState?.materializePath ??
    `${reviewDir}/public-longmemeval-full-materialize-run.json`,
);
const durabilityPath = resolveInputPath(
  args.durabilityReport ??
    args.localEmbeddingDurabilityReport ??
    fixtureState?.durabilityPath ??
    `${reviewDir}/local-embedding-durability-smoke-20260526.json`,
);
const runtimeBlockerPath = resolveInputPath(
  args.runtimeBlocker ?? fixtureState?.runtimeBlockerPath ?? `${reviewDir}/answer-quality-local-full-shard-002-runtime-blocker-20260526.json`,
);
const minDurabilityTokenCount = positiveInt(
  args.minDurabilityTokenCount ?? process.env.RECALLWEAVE_LOCAL_FULL_MIN_DURABILITY_TOKENS ?? 700,
  "minimum durability token count",
);
const privateDir = stringOrNull(fixtureState?.privateDir ?? args.privateInputDir ?? args.privateDir ?? process.env.RECALLWEAVE_FULL_SHARD_PRIVATE_DIR);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const resumeRaw = readFileSyncChecked(resumePacketPath, "resume packet");
const planRaw = readFileSyncChecked(planPath, "local-full shard plan");
const materializeRaw = readFileSyncChecked(materializePath, "full materialize report");
const durabilityRaw = readFileSyncChecked(durabilityPath, "local embedding durability report");
const runtimeBlockerRaw = readFileSyncChecked(runtimeBlockerPath, "local-full runtime blocker report");
const resumePacket = JSON.parse(resumeRaw);
const plan = JSON.parse(planRaw);
const materializeReport = JSON.parse(materializeRaw);
const durabilityReport = JSON.parse(durabilityRaw);
const runtimeBlockerReport = JSON.parse(runtimeBlockerRaw);

const privateDirState = inspectPrivateDir(privateDir);
const envState = inspectEnv();
const sourceRetentionState = inspectSourceRetention(materializeReport, materializeRaw, privateDirState.resolvedPath);
const durabilityState = inspectDurabilityReport({
  durabilityReport,
  durabilityRaw,
  runtimeBlockerReport,
  runtimeBlockerRaw,
  minTokenCount: minDurabilityTokenCount,
});
const requiredInputFiles = inspectRequiredInputFiles(privateDirState.resolvedPath, plan);
const completedArmFiles = inspectCompletedArmFiles(privateDirState.resolvedPath, resumePacket);
const missingArmFiles = inspectMissingArmFiles(privateDirState.resolvedPath, resumePacket);
const commandPlaceholderState = inspectCommandPlaceholders(resumePacket);
const commandMaterializationState = inspectCommandMaterialization({
  commandPlaceholderState,
  privateDirState,
  envState,
  reviewDir,
});

const privateInputFilesReady = requiredInputFiles.every(privateFileReady);
const completedPrivateArmFilesReady = completedArmFiles.every(privateFileReady);
const localResumeExecutionEnvReady = envState.localEmbedding.ready && envState.localRerank.ready && envState.localSafety.ready;
const readyForMissingArmExportExceptEnv =
  resumePacket.status === "READY_FOR_LOCAL_FULL_SHARD_RESUME" &&
  privateDirState.present &&
  privateDirState.outsideRepository &&
  sourceRetentionState.readyForPrivateAudit &&
  durabilityState.readyForLocalFullResume &&
  privateInputFilesReady &&
  completedPrivateArmFilesReady;
const readyForMissingArmExport = readyForMissingArmExportExceptEnv && localResumeExecutionEnvReady;
const readyForAnswerQualityPreflight =
  readyForMissingArmExport &&
  missingArmFiles.every((file) => file.present && file.nonEmpty) &&
  envState.answerQuality.ready;
const readyForLocalShardIntake = readyForAnswerQualityPreflight;
const ready = readyForMissingArmExport && readyForAnswerQualityPreflight && readyForLocalShardIntake;
const readyForCommandMaterialization = readyForAnswerQualityPreflight && commandMaterializationState.readyForCommandMaterialization;

const blockers = [
  resumePacket.status !== "READY_FOR_LOCAL_FULL_SHARD_RESUME" ? "resume-packet-not-ready" : null,
  !privateDirState.provided ? "private-dir-not-provided" : null,
  privateDirState.provided && !privateDirState.present ? "private-dir-not-present" : null,
  privateDirState.present && !privateDirState.outsideRepository ? "private-dir-inside-repository" : null,
  !sourceRetentionState.contractReady ? "raw-source-retention-contract-not-ready" : null,
  privateDirState.present && sourceRetentionState.rawSourcePrivateFiles.some((file) => !file.present) ? "raw-source-private-files-missing" : null,
  privateDirState.present && sourceRetentionState.rawSourcePrivateFiles.some((file) => file.present && !file.hashMatches) ? "raw-source-private-file-hash-mismatch" : null,
  !durabilityState.reportReady ? "local-embedding-durability-report-not-ready" : null,
  !durabilityState.longProbeReady ? "local-embedding-durability-long-probe-not-ready" : null,
  !durabilityState.generatedAfterRuntimeBlocker ? "local-embedding-durability-report-not-fresher-than-runtime-blocker" : null,
  durabilityState.failedProbeClasses.length > 0 ? "local-embedding-durability-probes-failed" : null,
  requiredInputFiles.some((file) => !file.present) ? "required-private-input-files-missing" : null,
  requiredInputFiles.some(privateFileHashMismatch) ? "required-private-input-file-hash-mismatch" : null,
  completedArmFiles.some((file) => !file.present) ? "completed-private-arm-files-missing" : null,
  completedArmFiles.some(privateFileHashMismatch) ? "completed-private-arm-file-hash-mismatch" : null,
  !envState.localEmbedding.ready ? "local-embedding-env-missing" : null,
  !envState.localRerank.ready ? "local-rerank-env-missing" : null,
  !envState.localSafety.ready ? "local-safety-env-missing" : null,
  !envState.answerQuality.ready ? "answer-quality-env-missing" : null,
  readyForMissingArmExport && missingArmFiles.some((file) => !file.present) ? "missing-arm-files-not-yet-exported" : null,
  readyForAnswerQualityPreflight && !commandMaterializationState.readyForCommandMaterialization
    ? "resume-command-materialization-placeholders-unresolved"
    : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-shard-resume-env-doctor",
  fixtureOnly: fixtureMode,
  status: ready ? "READY_LOCAL_FULL_SHARD_RESUME_ENV" : "BLOCKED_LOCAL_FULL_SHARD_RESUME_ENV",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsEnvValues: false,
  printsPrivatePaths: false,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  readyForMissingArmExport,
  readyForAnswerQualityPreflight,
  readyForShardAnswerQuality: readyForAnswerQualityPreflight,
  readyForLocalShardIntake,
  readyForCommandMaterialization,
  privateInputFilesReady,
  completedPrivateArmFilesReady,
  readyForMissingArmExportExceptEnv,
  localResumeExecutionEnvReady,
  answerQualityEnvReady: envState.answerQuality.ready,
  resumePacketCommandsRunnableAsPrinted: commandMaterializationState.commandsRunnableAsPrinted,
  resumePacket: {
    path: displayPath(resumePacketPath),
    hash: `sha256:${sha256(resumeRaw)}`,
    status: resumePacket.status ?? null,
    targetShard: resumePacket.targetShard ?? null,
    missingStrategies: resumePacket.resumeState?.missingStrategies ?? [],
    completedStrategies: resumePacket.resumeState?.completedStrategies ?? [],
  },
  plan: {
    path: displayPath(planPath),
    hash: `sha256:${sha256(planRaw)}`,
    claimScope: plan.runPlan?.claimScope ?? plan.claimScope ?? null,
    queryCount: Number(plan.runPlan?.queryCount ?? 0),
    shardCount: Number(plan.runPlan?.shardCount ?? 0),
    maxMemoryBytes: Number(plan.runPlan?.maxMemoryBytes ?? 0),
  },
  privateDir: privateDirState.public,
  sourceRetention: sourceRetentionState.public,
  localEmbeddingDurability: durabilityState.public,
  env: envState.public,
  commandPlaceholders: commandPlaceholderState,
  commandMaterialization: commandMaterializationState,
  requiredInputFiles,
  completedArmFiles,
  missingArmFiles,
  blockers,
  nextActions: buildNextActions({
    ready,
    privateDirState,
    sourceRetentionState,
    durabilityState,
    privateInputFilesReady,
    completedPrivateArmFilesReady,
    readyForMissingArmExport,
    readyForAnswerQualityPreflight,
    readyForLocalShardIntake,
    resumePacket,
    envState,
    missingArmFiles,
  }),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local-full shard resume env doctor");
assertSafePublicText(markdownText, "local-full shard resume env doctor markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inspectPrivateDir(value) {
  const resolvedPath = value ? resolveInputPath(value) : null;
  const present = Boolean(resolvedPath && existsSync(resolvedPath) && statSync(resolvedPath).isDirectory());
  const rel = resolvedPath ? relative(root, resolvedPath) : null;
  const insideRepository = Boolean(resolvedPath && rel && !rel.startsWith("..") && !isAbsolute(rel));
  return {
    resolvedPath,
    provided: Boolean(value),
    present,
    outsideRepository: Boolean(resolvedPath && present && !insideRepository),
    public: {
      provided: Boolean(value),
      label: value ? "external-private-dir" : null,
      present,
      outsideRepository: Boolean(resolvedPath && present && !insideRepository),
      pathPrinted: false,
    },
  };
}

function buildNextActions({
  ready,
  privateDirState: privateState,
  sourceRetentionState: sourceState,
  durabilityState: durability,
  privateInputFilesReady: inputsReady,
  completedPrivateArmFilesReady: completedArmsReady,
  readyForMissingArmExport: missingArmReady,
  readyForAnswerQualityPreflight: preflightReady,
  readyForLocalShardIntake: intakeReady,
  resumePacket: packet,
  envState: env,
  missingArmFiles: missingFiles,
}) {
  const shardId = packet?.targetShard?.shardId ?? "target shard";
  if (ready) {
    return [
      `Run the ${shardId} missing-arm response export from the resume packet if the recovered arm file has not already been written.`,
      `Run ${shardId} answer-quality preflight and answer-quality after all private arm files exist.`,
      `Run local shard intake including public result JSONs through ${shardId}.`,
    ];
  }
  const actions = [];
  if (!privateState.provided || !privateState.present || !privateState.outsideRepository) {
    actions.push("Provide RECALLWEAVE_FULL_SHARD_PRIVATE_DIR or --private-input-dir for the outside-repository private materialization directory.");
  }
  if (privateState.present && !sourceState.readyForPrivateAudit) {
    actions.push("Restore the private raw-source audit files so the raw dataset, selected rows, and source manifest hashes match the materialize report.");
  }
  if (!durability.readyForLocalFullResume) {
    actions.push("Regenerate the local embedding durability smoke after the runtime blocker with the required long probe passing.");
  }
  if (privateState.present && !inputsReady) {
    actions.push("Restore the private query set, memories file, and answer labels so the resume input contracts validate.");
  }
  if (privateState.present && !completedArmsReady) {
    actions.push(`Restore the completed ${shardId} private arm response files so already-finished arms can be reused safely.`);
  }
  if (!env.localEmbedding.ready || !env.localRerank.ready || !env.localSafety.ready) {
    actions.push("Set the local embedding, local rerank, and safety environment variables for the two missing local Apple arms.");
  }
  if (missingArmReady && missingFiles.some((file) => !file.present)) {
    actions.push(`Run the ${shardId} missing-arm response export from the resume packet.`);
  }
  if (!env.answerQuality.ready) {
    actions.push("Set local answer-quality endpoint and model environment variables before preflight/scoring.");
  }
  if (preflightReady && !intakeReady) {
    actions.push(`Run local shard intake including public result JSONs through ${shardId}.`);
  }
  actions.push("Regenerate this doctor before running the next resume packet command.");
  return [...new Set(actions)];
}

function inspectDurabilityReport({ durabilityReport, durabilityRaw, runtimeBlockerReport, runtimeBlockerRaw, minTokenCount }) {
  const probes = arrayOf(durabilityReport?.probes);
  const tokenCounts = arrayOf(durabilityReport?.tokenCounts)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right);
  const maxTokenCount = tokenCounts.at(-1) ?? 0;
  const failedProbeClasses = [...new Set(probes.map((probe) => probe?.failureClass).filter(Boolean))];
  const passProbeCount = probes.filter((probe) => probe?.status === "pass").length;
  const generatedAfterRuntimeBlocker = timestampAfter(durabilityReport?.generatedAt, runtimeBlockerReport?.generatedAt);
  const reportReady =
    durabilityReport?.mode === "local-embedding-durability-smoke" &&
    durabilityReport?.status === "READY_LOCAL_EMBEDDING_DURABILITY" &&
    durabilityReport?.readyForLocalAppleArmExport === true &&
    durabilityReport?.syntheticOnly === true &&
    durabilityReport?.rawSyntheticInputIncluded === false &&
    durabilityReport?.baseUrlPrinted === false &&
    durabilityReport?.endpointPrinted === false &&
    durabilityReport?.countsAsLocalFullBenchmarkEvidence === false &&
    durabilityReport?.countsAsFullMemorySotaEvidence === false &&
    durabilityReport?.publicBenchmarkClaimsAllowed === false &&
    failedProbeClasses.length === 0;
  const longProbeReady =
    reportReady &&
    maxTokenCount >= minTokenCount &&
    probes.some((probe) => probe?.status === "pass" && Number(probe?.tokenCount ?? 0) >= minTokenCount);
  const readyForLocalFullResume = reportReady && longProbeReady && generatedAfterRuntimeBlocker;
  return {
    reportReady,
    longProbeReady,
    generatedAfterRuntimeBlocker,
    failedProbeClasses,
    readyForLocalFullResume,
    public: {
      report: {
        path: displayPath(durabilityPath),
        hash: `sha256:${sha256(durabilityRaw)}`,
        mode: durabilityReport?.mode ?? null,
        status: durabilityReport?.status ?? null,
      },
      runtimeBlocker: {
        path: displayPath(runtimeBlockerPath),
        hash: `sha256:${sha256(runtimeBlockerRaw)}`,
        mode: runtimeBlockerReport?.mode ?? null,
        status: runtimeBlockerReport?.status ?? null,
        failedArm: runtimeBlockerReport?.failedArm?.strategy ?? null,
        failureClass: runtimeBlockerReport?.failedArm?.failureClass ?? null,
      },
      reportReady,
      longProbeReady,
      generatedAfterRuntimeBlocker,
      readyForLocalFullResume,
      minRequiredTokenCount: minTokenCount,
      maxProbeTokenCount: maxTokenCount,
      probeCount: probes.length,
      passProbeCount,
      tokenCounts,
      failedProbeClasses,
      rawSyntheticInputIncluded: Boolean(durabilityReport?.rawSyntheticInputIncluded),
      baseUrlPrinted: Boolean(durabilityReport?.baseUrlPrinted),
      endpointPrinted: Boolean(durabilityReport?.endpointPrinted),
      countsAsLocalFullBenchmarkEvidence: Boolean(durabilityReport?.countsAsLocalFullBenchmarkEvidence),
      countsAsFullMemorySotaEvidence: Boolean(durabilityReport?.countsAsFullMemorySotaEvidence),
    },
  };
}

function inspectSourceRetention(materializeReportValue, materializeRawValue, privatePath) {
  const retention = materializeReportValue?.sourceRetention ?? {};
  const privateOutputs = materializeReportValue?.privateOutputs ?? {};
  const outputFiles = arrayOf(privateOutputs.files);
  const requiredMaterializeRoles = ["queryset", "memories", "answer-labels", "raw-dataset", "selected-raw-rows", "source-manifest"];
  const requiredPrivateAuditRoles = ["raw-dataset", "selected-raw-rows", "source-manifest"];
  const presentRoles = new Set(outputFiles.map((file) => file.role).filter(Boolean));
  const missingMaterializeRoles = requiredMaterializeRoles.filter((role) => !presentRoles.has(role));
  const rawSourcePrivateFiles = requiredPrivateAuditRoles.map((role) => {
    const spec = outputFiles.find((file) => file.role === role) ?? { role, name: `${role}.private`, hash: null };
    return inspectPrivateFile(privatePath, {
      role: spec.role,
      name: spec.name,
      hash: spec.hash,
    });
  });
  const rawSourcePrivateFilesReady =
    Boolean(privatePath) &&
    rawSourcePrivateFiles.every((file) => file.present && file.nonEmpty && file.hashMatches === true);
  const publicReportIsSafe =
    materializeReportValue?.rawQuestionsIncluded === false &&
    materializeReportValue?.rawAnswersIncluded === false &&
    materializeReportValue?.rawMemoryIncluded === false &&
    materializeReportValue?.rawPrivateOutputPathIncluded === false &&
    retention.rawTextPubliclyIncluded === false &&
    retention.privateOutputPathIncluded === false;
  const rawSourcesRetainedPrivately =
    retention.rawDatasetRetainedPrivate === true &&
    retention.selectedRawRowsRetainedPrivate === true &&
    retention.sourceManifestRetainedPrivate === true &&
    missingMaterializeRoles.length === 0;
  const contractReady =
    materializeReportValue?.mode === "public-benchmark-materialize-run" &&
    rawSourcesRetainedPrivately &&
    publicReportIsSafe &&
    privateOutputs.directoryInsideRepository === false;
  return {
    contractReady,
    rawSourcesRetainedPrivately,
    publicReportIsSafe,
    rawSourcePrivateFiles,
    readyForPrivateAudit: contractReady && rawSourcePrivateFilesReady,
    public: {
      materializeReport: {
        path: displayPath(materializePath),
        hash: `sha256:${sha256(materializeRawValue)}`,
        mode: materializeReportValue?.mode ?? null,
      },
      contractReady,
      rawSourcesRetainedPrivately,
      publicReportIsSafe,
      readyForPrivateAudit: contractReady && rawSourcePrivateFilesReady,
      compressedDefaultRetrievalAllowed: true,
      uiMayUseCompressedDefaultButAuditRetainsRawSource: true,
      rawTextPubliclyIncluded: Boolean(retention.rawTextPubliclyIncluded),
      privateOutputPathIncluded: Boolean(retention.privateOutputPathIncluded),
      privateOutputDirectoryLabel: privateOutputs.directoryLabel ?? null,
      directoryInsideRepository: Boolean(privateOutputs.directoryInsideRepository),
      fileMode: privateOutputs.fileMode ?? null,
      directoryMode: privateOutputs.directoryMode ?? null,
      requiredMaterializeRoles,
      requiredPrivateAuditRoles,
      missingMaterializeRoles,
      rawDatasetItemCount: Number(retention.rawDatasetItemCount ?? 0),
      selectedRawRowsCount: Number(retention.selectedRawRowsCount ?? 0),
      rawDatasetHash: retention.rawDatasetHash ?? null,
      selectedRawRowsHash: retention.selectedRawRowsHash ?? null,
      sourceManifestHash: retention.sourceManifestHash ?? null,
      rawSourcePrivateFiles,
    },
  };
}

function inspectEnv() {
  const localEmbedding = envGroup([
    "SELFMEM_LOCAL_EMBED_BASE_URL",
    "SELFMEM_LOCAL_EMBED_MODEL",
    "SELFMEM_LOCAL_EMBED_MAX_TOKENS",
    "SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS",
    "SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT",
  ]);
  const localRerank = envGroup([
    "SELFMEM_LOCAL_RERANK_BASE_URL",
    "SELFMEM_LOCAL_RERANK_MODEL",
    "SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT",
  ]);
  const localSafety = envGroup([
    "RECALLWEAVE_BASELINE_LIVE",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT",
    "RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY",
  ], { requireTruthy: true });
  const answerQuality = envGroup([
    "RECALLWEAVE_MEMORYBENCH_BASE_URL",
    "RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL",
    "RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL",
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT",
  ], {
    truthyNames: [
      "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS",
      "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA",
      "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT",
    ],
  });
  return {
    localEmbedding,
    localRerank,
    localSafety,
    answerQuality,
    public: {
      localEmbedding: localEmbedding.public,
      localRerank: localRerank.public,
      localSafety: localSafety.public,
      answerQuality: answerQuality.public,
      optionalQueryExpansionForResume: {
        requiredForMissingArmStrategies: false,
        presentNames: presentNames(["SELFMEM_QUERY_EXPANSION_BASE_URL", "SELFMEM_QUERY_EXPANSION_MODEL"]),
      },
    },
  };
}

function envGroup(names, options = {}) {
  const truthyNames = new Set(options.requireTruthy ? names : options.truthyNames ?? []);
  const present = presentNames(names);
  const missing = names.filter((name) => !hasEnv(name));
  const nonTruthy = names.filter((name) => truthyNames.has(name) && process.env[name] !== "1");
  const ready = missing.length === 0 && nonTruthy.length === 0;
  return {
    ready,
    missing,
    nonTruthy,
    public: {
      ready,
      requiredNames: names,
      presentNames: present,
      missingNames: missing,
      nonTruthyNames: nonTruthy,
      printsValues: false,
    },
  };
}

function inspectRequiredInputFiles(privatePath, planValue) {
  return [
    {
      role: "queryset",
      name: "longmemeval-queryset.private.json",
      hash: planValue.materializeReport?.collectorCompatibleQuerySetHash,
      hashKind: "collector-compatible-queryset",
      hashSource: "semantic-json-contract",
    },
    { role: "memories", name: "longmemeval-memories.private.jsonl", hash: planValue.materializeReport?.memoriesFileHash },
    {
      role: "answer-labels",
      name: "longmemeval-answer-labels.private.json",
      hash: planValue.target?.answerLabelsHash,
      hashKind: "embedded-answer-labels",
      hashSource: "semantic-json-contract",
    },
  ].map((spec) => inspectPrivateFile(privatePath, spec));
}

function inspectCompletedArmFiles(privatePath, packet) {
  return arrayOf(packet.resumeState?.completedPrivateArmEvidence).map((entry) =>
    inspectPrivateFile(privatePath ? join(privatePath, "arms", packet.targetShard?.shardId ?? "shard-002") : null, {
      role: entry.strategy,
      name: entry.name,
      hash: entry.hash,
    }),
  );
}

function inspectMissingArmFiles(privatePath, packet) {
  return arrayOfStrings(packet.resumeState?.missingStrategies).map((strategy) =>
    inspectPrivateFile(privatePath ? join(privatePath, "arms", packet.targetShard?.shardId ?? "shard-002") : null, {
      role: strategy,
      name: `${strategy}-responses.private.json`,
      hash: null,
    }),
  );
}

function inspectPrivateFile(basePath, spec) {
  const path = basePath ? join(basePath, spec.name) : null;
  const present = Boolean(path && existsSync(path) && statSync(path).isFile());
  const sizeBytes = present ? statSync(path).size : 0;
  const contract = present ? inspectPrivateFileContract(path, spec) : { actualHash: null, parseOk: null, contractPresent: false };
  return {
    role: spec.role,
    name: spec.name,
    pathLabel: "external-private-file",
    present,
    nonEmpty: sizeBytes > 0,
    sizeBytes: present ? sizeBytes : null,
    hashKind: spec.hashKind ?? "file-sha256",
    hashSource: spec.hashSource ?? "file-bytes",
    parseOk: contract.parseOk,
    contractPresent: contract.contractPresent,
    expectedHash: spec.hash ?? null,
    actualHash: contract.actualHash ? "sha256:<redacted-public-hash>" : null,
    hashMatches: spec.hash ? contract.actualHash === spec.hash : null,
  };
}

function privateFileReady(file) {
  return (
    file.present === true &&
    file.nonEmpty === true &&
    file.parseOk !== false &&
    file.contractPresent !== false &&
    file.hashMatches !== false
  );
}

function privateFileHashMismatch(file) {
  return file.present === true && file.hashMatches === false;
}

function inspectPrivateFileContract(path, spec) {
  if (spec.hashKind === "collector-compatible-queryset") {
    try {
      const value = JSON.parse(readFileSync(path, "utf8"));
      const contractPresent = Array.isArray(value.queries);
      return {
        actualHash: contractPresent ? `sha256:${stableHash(collectorQuerySetHashPayload(value))}` : null,
        parseOk: true,
        contractPresent,
      };
    } catch {
      return { actualHash: null, parseOk: false, contractPresent: false };
    }
  }
  if (spec.hashKind === "embedded-answer-labels") {
    try {
      const value = JSON.parse(readFileSync(path, "utf8"));
      const actualHash = isSha256Hash(value.answerLabelsHash) ? value.answerLabelsHash : null;
      return {
        actualHash,
        parseOk: true,
        contractPresent: Boolean(actualHash),
      };
    } catch {
      return { actualHash: null, parseOk: false, contractPresent: false };
    }
  }
  return {
    actualHash: `sha256:${sha256(readFileSync(path))}`,
    parseOk: null,
    contractPresent: true,
  };
}

function inspectCommandPlaceholders(packet) {
  const commands = packet.commands ?? {};
  const all = [...new Set(Object.values(commands).flatMap((command) => placeholderNames(command)))].sort();
  return {
    count: all.length,
    names: all,
    privateOutputDirPlaceholderPresent: all.includes("private-output-dir"),
    publicReviewDirPlaceholderPresent: all.includes("public-review-dir"),
    envValuePlaceholdersPresent: all.filter((name) => !["private-output-dir", "public-review-dir"].includes(name)),
  };
}

function inspectCommandMaterialization({ commandPlaceholderState: placeholders, privateDirState: privateState, envState: env, reviewDir: reviewDirectory }) {
  const optionalPlaceholderPolicy = {
    "1-when-cloud-query-expansion-runs": "Set to 1 only when a cloud query-expansion arm is intentionally enabled; otherwise remove or set to 0.",
    "env-only-if-cloud-endpoint": "Provide only for an authenticated cloud scoring endpoint; omit for local no-auth scoring endpoints.",
    "local-query-expansion-base-url-if-used": "Fill only when a local query-expansion sidecar is used for the retry.",
    "query-expansion-model-if-used": "Fill only when a query-expansion sidecar is used for the retry.",
  };
  const requiredPlaceholderSpecs = {
    "private-output-dir": {
      source: "RECALLWEAVE_FULL_SHARD_PRIVATE_DIR or --private-input-dir",
      ready: privateState.present && privateState.outsideRepository,
      printsValue: false,
    },
    "public-review-dir": {
      source: "--review-dir or RECALLWEAVE_REVIEW_DIR",
      ready: String(reviewDirectory ?? "").trim().length > 0,
      printsValue: false,
    },
    "local-embedding-base-url": envPlaceholder("SELFMEM_LOCAL_EMBED_BASE_URL", env),
    "local-embedding-model": envPlaceholder("SELFMEM_LOCAL_EMBED_MODEL", env),
    "safe-local-embedding-max-token-limit": envPlaceholder("SELFMEM_LOCAL_EMBED_MAX_TOKENS", env),
    "safe-local-embedding-batch-token-limit": envPlaceholder("SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS", env),
    "safe-local-dense-candidate-limit": envPlaceholder("SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT", env),
    "local-rerank-base-url": envPlaceholder("SELFMEM_LOCAL_RERANK_BASE_URL", env),
    "local-rerank-model": envPlaceholder("SELFMEM_LOCAL_RERANK_MODEL", env),
    "local-rerank-candidate-limit": envPlaceholder("SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT", env),
    "openai-compatible-base-url": envPlaceholder("RECALLWEAVE_MEMORYBENCH_BASE_URL", env),
    "local-answer-model": envPlaceholder("RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL", env),
    "local-judge-model": envPlaceholder("RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL", env),
  };
  const required = placeholders.names
    .filter((name) => !Object.hasOwn(optionalPlaceholderPolicy, name))
    .map((name) => {
      const spec = requiredPlaceholderSpecs[name] ?? {
        source: "unknown-placeholder",
        ready: false,
        printsValue: false,
      };
      return {
        name,
        source: spec.source,
        ready: Boolean(spec.ready),
        printsValue: false,
      };
    });
  const optional = placeholders.names
    .filter((name) => Object.hasOwn(optionalPlaceholderPolicy, name))
    .map((name) => ({
      name,
      operatorChoiceRequired: true,
      policy: optionalPlaceholderPolicy[name],
      printsValue: false,
    }));
  const unresolvedRequiredPlaceholderNames = required.filter((entry) => !entry.ready).map((entry) => entry.name);
  return {
    templatePlaceholdersPresent: placeholders.count > 0,
    commandsRunnableAsPrinted: placeholders.count === 0,
    requiresOperatorPlaceholderSubstitution: placeholders.count > 0,
    readyForCommandMaterialization: unresolvedRequiredPlaceholderNames.length === 0,
    requiredPlaceholderCount: required.length,
    requiredPlaceholdersReady: unresolvedRequiredPlaceholderNames.length === 0,
    requiredPlaceholders: required,
    unresolvedRequiredPlaceholderNames,
    optionalPlaceholderCount: optional.length,
    optionalPlaceholders: optional,
    optionalPlaceholderNames: optional.map((entry) => entry.name),
    printsMaterializedCommands: false,
    printsPrivatePaths: false,
    printsEnvValues: false,
    materializedCommandHashesIncluded: false,
  };
}

function envPlaceholder(name, env) {
  return {
    source: name,
    ready: Object.values(env).some((group) => Array.isArray(group?.public?.presentNames) && group.public.presentNames.includes(name)),
    printsValue: false,
  };
}

function placeholderNames(command) {
  return [...String(command ?? "").matchAll(/<([^>]+)>/gu)].map((match) => match[1]);
}

function renderMarkdown(value) {
  return [
    "# Local-Full Shard Resume Environment Doctor",
    "",
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Target shard: ${value.resumePacket.targetShard?.shardId ?? "n/a"} (${value.resumePacket.targetShard?.startIndex ?? "n/a"}-${value.resumePacket.targetShard?.endIndexExclusive ?? "n/a"})`,
    `- Ready for missing-arm export: ${value.readyForMissingArmExport}`,
    `- Ready for missing-arm export except env: ${value.readyForMissingArmExportExceptEnv}`,
    `- Ready for answer-quality preflight: ${value.readyForAnswerQualityPreflight}`,
    `- Ready for local shard intake: ${value.readyForLocalShardIntake}`,
    `- Ready for command materialization: ${value.readyForCommandMaterialization}`,
    `- Private input files ready: ${value.privateInputFilesReady}`,
    `- Completed private arm files ready: ${value.completedPrivateArmFilesReady}`,
    `- Local resume execution env ready: ${value.localResumeExecutionEnvReady}`,
    `- Resume packet commands runnable as printed: ${value.resumePacketCommandsRunnableAsPrinted}`,
    `- Private directory provided: ${value.privateDir.provided}`,
    `- Private directory present: ${value.privateDir.present}`,
    `- Private directory outside repository: ${value.privateDir.outsideRepository}`,
    `- Raw-source retention contract ready: ${value.sourceRetention.contractReady}`,
    `- Raw-source private audit ready: ${value.sourceRetention.readyForPrivateAudit}`,
    `- Compressed default retrieval allowed: ${value.sourceRetention.compressedDefaultRetrievalAllowed}`,
    `- Local embedding durability report ready: ${value.localEmbeddingDurability.reportReady}`,
    `- Local embedding durability long probe ready: ${value.localEmbeddingDurability.longProbeReady}`,
    `- Local embedding durability fresher than runtime blocker: ${value.localEmbeddingDurability.generatedAfterRuntimeBlocker}`,
    `- Local embedding env ready: ${value.env.localEmbedding.ready}`,
    `- Local rerank env ready: ${value.env.localRerank.ready}`,
    `- Local safety env ready: ${value.env.localSafety.ready}`,
    `- Answer-quality env ready: ${value.env.answerQuality.ready}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    "",
    "## Missing Environment Names",
    ...[
      ...value.env.localEmbedding.missingNames,
      ...value.env.localRerank.missingNames,
      ...value.env.localSafety.missingNames,
      ...value.env.answerQuality.missingNames,
    ].map((name) => `- ${name}`),
    "",
    "## Private Inputs",
    `- Ready: ${value.privateInputFilesReady}`,
    ...value.requiredInputFiles.map(
      (file) => `- ${file.role}: present=${file.present}; hashKind=${file.hashKind}; hashMatched=${file.hashMatches}`,
    ),
    "",
    "## Raw Source Retention",
    `- Contract ready: ${value.sourceRetention.contractReady}`,
    `- Public report safe: ${value.sourceRetention.publicReportIsSafe}`,
    `- Ready for private audit: ${value.sourceRetention.readyForPrivateAudit}`,
    `- Compressed default retrieval allowed: ${value.sourceRetention.compressedDefaultRetrievalAllowed}`,
    `- Required private audit roles: ${value.sourceRetention.requiredPrivateAuditRoles.join(", ")}`,
    ...value.sourceRetention.rawSourcePrivateFiles.map((file) => `- ${file.role}: present=${file.present}; hashMatched=${file.hashMatches}`),
    "",
    "## Local Embedding Durability",
    `- Report ready: ${value.localEmbeddingDurability.reportReady}`,
    `- Ready for local-full resume: ${value.localEmbeddingDurability.readyForLocalFullResume}`,
    `- Long probe ready: ${value.localEmbeddingDurability.longProbeReady}`,
    `- Generated after runtime blocker: ${value.localEmbeddingDurability.generatedAfterRuntimeBlocker}`,
    `- Minimum required token count: ${value.localEmbeddingDurability.minRequiredTokenCount}`,
    `- Maximum probe token count: ${value.localEmbeddingDurability.maxProbeTokenCount}`,
    `- Probe count: ${value.localEmbeddingDurability.probeCount}`,
    `- Failed probe classes: ${value.localEmbeddingDurability.failedProbeClasses.join(", ") || "none"}`,
    "",
    "## Completed Arm Files",
    `- Ready: ${value.completedPrivateArmFilesReady}`,
    ...value.completedArmFiles.map((file) => `- ${file.role}: present=${file.present}; hashMatched=${file.hashMatches}`),
    "",
    "## Missing Arm Files",
    ...value.missingArmFiles.map((file) => `- ${file.role}: present=${file.present}`),
    "",
    "## Command Materialization",
    `- Template placeholders present: ${value.commandMaterialization.templatePlaceholdersPresent}`,
    `- Commands runnable as printed: ${value.commandMaterialization.commandsRunnableAsPrinted}`,
    `- Required placeholders ready: ${value.commandMaterialization.requiredPlaceholdersReady}`,
    `- Unresolved required placeholders: ${value.commandMaterialization.unresolvedRequiredPlaceholderNames.join(", ") || "none"}`,
    `- Optional placeholders requiring operator choice: ${value.commandMaterialization.optionalPlaceholderNames.join(", ") || "none"}`,
    `- Prints materialized commands: ${value.commandMaterialization.printsMaterializedCommands}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function readFileSyncChecked(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return raw;
}

function createFixtureState() {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-local-full-resume-env-fixture-"));
  fixtureTempRoots.push(tempRoot);
  const privateDir = join(tempRoot, "private");
  const reportsDir = join(tempRoot, "reports");
  const armsDir = join(privateDir, "arms", "shard-002");
  mkdirSync(armsDir, { recursive: true, mode: 0o700 });
  mkdirSync(reportsDir, { recursive: true, mode: 0o700 });

  const querySet = {
    schemaVersion: 1,
    datasetSlice: "local-full-resume-env-fixture",
    queries: [
      { id: "fixture-query-025", q: "synthetic local resume query", expectedResultIds: ["fixture-memory-025"] },
      { id: "fixture-query-026", q: "synthetic local rerank query", expectedResultIds: ["fixture-memory-026"] },
    ],
  };
  const querySetHash = `sha256:${stableHash(collectorQuerySetHashPayload(querySet))}`;
  const querySetFileHash = writeFixtureFile(join(privateDir, "longmemeval-queryset.private.json"), fixtureJson(querySet));
  const memoriesHash = writeFixtureFile(
    join(privateDir, "longmemeval-memories.private.jsonl"),
    `${JSON.stringify({ id: "fixture-memory-025", text: "synthetic memory one" })}\n${JSON.stringify({
      id: "fixture-memory-026",
      text: "synthetic memory two",
    })}\n`,
  );
  const answerLabels = [
    { queryId: "fixture-query-025", questionId: "fixture-question-025", questionType: "fixture", answer: "synthetic memory one" },
    { queryId: "fixture-query-026", questionId: "fixture-question-026", questionType: "fixture", answer: "synthetic memory two" },
  ];
  const answerLabelsHash = `sha256:${stableHash(
    canonicalJson(
      answerLabels.map(({ questionId, questionType, answer }) => ({
        questionId,
        questionType,
        answer,
      })),
    ),
  )}`;
  const answerLabelsFileHash = writeFixtureFile(
    join(privateDir, "longmemeval-answer-labels.private.json"),
    fixtureJson({
      schemaVersion: 1,
      answerLabelsHash,
      labels: answerLabels,
    }),
  );
  const rawDatasetHash = writeFixtureFile(
    join(privateDir, "longmemeval-raw-dataset.private.json"),
    fixtureJson({ schemaVersion: 1, rows: [{ id: "fixture-query-025" }, { id: "fixture-query-026" }] }),
  );
  const selectedRawRowsHash = writeFixtureFile(
    join(privateDir, "longmemeval-selected-raw-rows.private.json"),
    fixtureJson({ schemaVersion: 1, selected: ["fixture-query-025", "fixture-query-026"] }),
  );
  const sourceManifestHash = writeFixtureFile(
    join(privateDir, "longmemeval-source-manifest.private.json"),
    fixtureJson({ schemaVersion: 1, source: "fixture-local-full-resume-env", rowCount: 2 }),
  );

  const completedArmEvidence = ["bm25-lite", "full-hybrid-rerank", "query-expanded-full-hybrid-rerank"].map((strategy) => {
    const name = `${strategy}-responses.private.json`;
    const hash = writeFixtureFile(
      join(armsDir, name),
      fixtureJson({
        schemaVersion: 1,
        mode: "public-benchmark-answer-quality-arm-export",
        strategy,
        responses: {
          "fixture-query-025": { resultIds: ["fixture-memory-025"] },
          "fixture-query-026": { resultIds: ["fixture-memory-026"] },
        },
      }),
    );
    return { strategy, name, hash, responseCount: 2, providerCallsMade: strategy.includes("query-expanded") ? 2 : 0 };
  });
  for (const strategy of ["local-apple-qwen3-0_6b", "local-apple-qwen3-0_6b-local-rerank"]) {
    writeFixtureFile(
      join(armsDir, `${strategy}-responses.private.json`),
      fixtureJson({
        schemaVersion: 1,
        mode: "public-benchmark-answer-quality-arm-export",
        strategy,
        responses: {
          "fixture-query-025": { resultIds: ["fixture-memory-025"] },
          "fixture-query-026": { resultIds: ["fixture-memory-026"] },
        },
      }),
    );
  }

  const materializePath = join(reportsDir, "materialize.json");
  const planPath = join(reportsDir, "plan.json");
  const resumePacketPath = join(reportsDir, "resume-packet.json");
  const durabilityPath = join(reportsDir, "durability.json");
  const runtimeBlockerPath = join(reportsDir, "runtime-blocker.json");

  writeJsonFile(materializePath, {
    schemaVersion: 1,
    mode: "public-benchmark-materialize-run",
    rawQuestionsIncluded: false,
    rawAnswersIncluded: false,
    rawMemoryIncluded: false,
    rawPrivateOutputPathIncluded: false,
    sourceRetention: {
      rawDatasetRetainedPrivate: true,
      selectedRawRowsRetainedPrivate: true,
      sourceManifestRetainedPrivate: true,
      rawTextPubliclyIncluded: false,
      privateOutputPathIncluded: false,
      rawDatasetItemCount: 2,
      selectedRawRowsCount: 2,
      rawDatasetHash,
      selectedRawRowsHash,
      sourceManifestHash,
    },
    privateOutputs: {
      directoryLabel: "external-private-dir",
      directoryInsideRepository: false,
      fileMode: "0600",
      directoryMode: "0700",
      files: [
        { role: "queryset", name: "longmemeval-queryset.private.json", hash: querySetFileHash },
        { role: "memories", name: "longmemeval-memories.private.jsonl", hash: memoriesHash },
        { role: "answer-labels", name: "longmemeval-answer-labels.private.json", hash: answerLabelsFileHash },
        { role: "raw-dataset", name: "longmemeval-raw-dataset.private.json", hash: rawDatasetHash },
        { role: "selected-raw-rows", name: "longmemeval-selected-raw-rows.private.json", hash: selectedRawRowsHash },
        { role: "source-manifest", name: "longmemeval-source-manifest.private.json", hash: sourceManifestHash },
      ],
    },
  });
  writeJsonFile(planPath, {
    schemaVersion: 1,
    runPlan: {
      claimScope: "local-full",
      queryCount: 2,
      shardCount: 1,
      maxMemoryBytes: 1024,
    },
    materializeReport: {
      collectorCompatibleQuerySetHash: querySetHash,
      memoriesFileHash: memoriesHash,
    },
    target: {
      answerLabelsHash,
    },
  });
  writeJsonFile(resumePacketPath, {
    schemaVersion: 1,
    status: "READY_FOR_LOCAL_FULL_SHARD_RESUME",
    targetShard: {
      shardId: "shard-002",
      startIndex: 25,
      endIndexExclusive: 27,
      queryOffset: 25,
      maxQueries: 2,
      queryCount: 2,
    },
    resumeState: {
      missingStrategies: ["local-apple-qwen3-0_6b", "local-apple-qwen3-0_6b-local-rerank"],
      completedStrategies: completedArmEvidence.map((entry) => entry.strategy),
      completedPrivateArmEvidence: completedArmEvidence,
    },
    commands: {
      resumeEnvDoctor: "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-shard-resume-env -- --private-input-dir <private-output-dir>",
      missingArmResponseExport:
        "RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-base-url> SELFMEM_LOCAL_EMBED_MODEL=<local-embedding-model> SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-base-url> SELFMEM_LOCAL_RERANK_MODEL=<local-rerank-model> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --private-output-dir <private-output-dir>/arms/shard-002",
      preflight:
        "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<local-answer-model> RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<local-judge-model> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --output <public-review-dir>/answer-quality-local-full-preflight-shard-002.json",
      answerQuality:
        "RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<local-answer-model> RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<local-judge-model> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --output <public-review-dir>/answer-quality-local-full-shard-002.json",
    },
  });
  writeJsonFile(durabilityPath, {
    schemaVersion: 1,
    mode: "local-embedding-durability-smoke",
    status: "READY_LOCAL_EMBEDDING_DURABILITY",
    generatedAt: "2026-05-26T12:00:00.000Z",
    readyForLocalAppleArmExport: true,
    syntheticOnly: true,
    rawSyntheticInputIncluded: false,
    baseUrlPrinted: false,
    endpointPrinted: false,
    countsAsLocalFullBenchmarkEvidence: false,
    countsAsFullMemorySotaEvidence: false,
    publicBenchmarkClaimsAllowed: false,
    tokenCounts: [32, 128, 512, 700],
    probes: [
      { name: "short", status: "pass", tokenCount: 32 },
      { name: "medium", status: "pass", tokenCount: 128 },
      { name: "wide", status: "pass", tokenCount: 512 },
      { name: "long", status: "pass", tokenCount: 700 },
    ],
  });
  writeJsonFile(runtimeBlockerPath, {
    schemaVersion: 1,
    mode: "public-benchmark-answer-quality",
    status: "BLOCKED_LOCAL_FULL_SHARD_RUNTIME",
    generatedAt: "2026-05-26T11:00:00.000Z",
    failedArm: {
      strategy: "local-apple-qwen3-0_6b",
      failureClass: "local-embedding-server-socket-close",
    },
  });

  setFixtureEnv();
  return { reviewDir: "fixture-local-full-shard-resume-env", privateDir, resumePacketPath, planPath, materializePath, durabilityPath, runtimeBlockerPath };
}

function setFixtureEnv() {
  Object.assign(process.env, {
    RECALLWEAVE_BASELINE_LIVE: "1",
    RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
    RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY: "1",
    SELFMEM_LOCAL_EMBED_BASE_URL: "http://127.0.0.1:65535/v1",
    SELFMEM_LOCAL_EMBED_MODEL: "fixture-local-embedding-model",
    SELFMEM_LOCAL_EMBED_MAX_TOKENS: "900",
    SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS: "700",
    SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT: "16",
    SELFMEM_LOCAL_RERANK_BASE_URL: "http://127.0.0.1:65534/v1",
    SELFMEM_LOCAL_RERANK_MODEL: "fixture-local-rerank-model",
    SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT: "8",
    RECALLWEAVE_MEMORYBENCH_BASE_URL: "http://127.0.0.1:65533/v1",
    RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "fixture-local-answer-model",
    RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "fixture-local-judge-model",
    RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS: "1",
    RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA: "1",
    RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT: "1",
  });
}

function fixtureJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeFixtureFile(path, text) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
  return `sha256:${sha256(readFileSync(path))}`;
}

function writeJsonFile(path, value) {
  writeFileSync(path, fixtureJson(value), { encoding: "utf8", mode: 0o600 });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function hasEnv(name) {
  return String(process.env[name] ?? "").trim().length > 0;
}

function presentNames(names) {
  return names.filter(hasEnv);
}

function stringOrNull(value) {
  const string = String(value ?? "").trim();
  return string.length ? string : null;
}

function positiveInt(value, label) {
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function timestampAfter(candidate, baseline) {
  const candidateMs = Date.parse(String(candidate ?? ""));
  const baselineMs = Date.parse(String(baseline ?? ""));
  return Number.isFinite(candidateMs) && Number.isFinite(baselineMs) && candidateMs > baselineMs;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function arrayOfStrings(value) {
  return arrayOf(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function resolveInputPath(pathLike) {
  const value = String(pathLike);
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(path) {
  const rel = relative(root, path).replaceAll("\\", "/");
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : "external-file";
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function collectorQuerySetHashPayload(querySet) {
  return {
    schemaVersion: querySet.schemaVersion ?? 1,
    datasetSlice: querySet.datasetSlice ?? null,
    queries: arrayOf(querySet.queries).map((query) => ({
      id: query.id,
      q: query.q,
      expectedResultIds: query.expectedResultIds ?? [],
      expectedResultHashes: query.expectedResultHashes ?? [],
    })),
  };
}

function stableHash(value) {
  return sha256(typeof value === "string" ? value : JSON.stringify(value));
}

function canonicalJson(value) {
  return JSON.stringify(sortForHash(value));
}

function sortForHash(value) {
  if (Array.isArray(value)) return value.map((item) => sortForHash(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortForHash(child)]),
    );
  }
  return value;
}

function isSha256Hash(value) {
  return /^sha256:[a-f0-9]{64}$/iu.test(String(value ?? ""));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
  assert.equal(secretPattern.test(text), false, `${label} contains secret-shaped text`);
  assert.equal(privatePathPattern.test(text), false, `${label} contains absolute private path`);
  assert.equal(privateTagPattern.test(text), false, `${label} contains private tag`);
}
