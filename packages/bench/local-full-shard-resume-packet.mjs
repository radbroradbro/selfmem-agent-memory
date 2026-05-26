import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? "reviews/overnight-20260522");
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const files = {
  plan: `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`,
  workorder: `${reviewDir}/answer-quality-local-full-shard-workorder-20260526.json`,
  runtimeBlocker: `${reviewDir}/answer-quality-local-full-shard-002-runtime-blocker-20260526.json`,
  runtimeDoctor: `${reviewDir}/local-embedding-runtime-doctor-20260526.json`,
  durabilitySmoke: `${reviewDir}/local-embedding-durability-smoke-20260526.json`,
  acceptedLaneDoctor: `${reviewDir}/local-full-accepted-lane-launch-doctor-20260526.json`,
  sotaDoctor: `${reviewDir}/full-memory-sota-doctor-20260526.json`,
};

const evidence = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, loadJson(path)]));
const plan = evidence.plan.json;
const workorder = evidence.workorder.json;
const runtimeBlocker = evidence.runtimeBlocker.json;
const runtimeDoctor = evidence.runtimeDoctor.json;
const durabilitySmoke = evidence.durabilitySmoke.json;
const acceptedLaneDoctor = evidence.acceptedLaneDoctor.json;
const sotaDoctor = evidence.sotaDoctor.json;

const resumeWorkorder = (workorder.workorders ?? []).find((item) => item.runtimeResume?.resumeAvailable === true) ?? workorder.workorders?.[0] ?? null;
const runtimeResume = resumeWorkorder?.runtimeResume ?? null;
const completedArmEvidence = arrayOf(runtimeResume?.completedPrivateArmEvidence).map(publicCompletedArmEvidence);
const missingStrategies = arrayOfStrings(runtimeResume?.missingStrategies);
const completedStrategies = arrayOfStrings(runtimeResume?.completedStrategies);
const runtimeDoctorReady = isRuntimeDoctorReady(runtimeDoctor);
const durabilityReady = isDurabilityReady(durabilitySmoke);
const targetShard = {
  shardId: resumeWorkorder?.shardId ?? runtimeBlocker.queryShard?.shardId ?? null,
  startIndex: intOrNull(resumeWorkorder?.startIndex ?? runtimeBlocker.queryShard?.startIndex ?? runtimeBlocker.queryShard?.queryOffset),
  endIndexExclusive: intOrNull(resumeWorkorder?.endIndexExclusive ?? runtimeBlocker.queryShard?.endIndexExclusive),
  queryOffset: intOrNull(runtimeBlocker.queryShard?.queryOffset ?? resumeWorkorder?.startIndex),
  maxQueries: intOrNull(runtimeBlocker.queryShard?.maxQueries ?? resumeWorkorder?.queryCount),
  queryCount: intOrNull(resumeWorkorder?.queryCount ?? runtimeBlocker.queryShard?.maxQueries),
  expectedPublicResult: resumeWorkorder?.expectedPublicResult ?? null,
  expectedPublicMarkdown: resumeWorkorder?.expectedPublicMarkdown ?? null,
  expectedPrivateArmDirectoryLabel: resumeWorkorder?.expectedPrivateArmDirectory ?? null,
};

const resumeReady = Boolean(
  workorder.mode === "public-benchmark-answer-quality-shard-workorder" &&
    workorder.plan?.claimScope === "local-full" &&
    runtimeBlocker.mode === "answer-quality-local-full-shard-runtime-blocker" &&
    runtimeBlocker.claimScope === "local-full" &&
    runtimeResume?.resumeAvailable === true &&
    targetShard.shardId === "shard-002" &&
    targetShard.startIndex === 25 &&
    targetShard.endIndexExclusive === 50 &&
    completedStrategies.length > 0 &&
    missingStrategies.length > 0 &&
    completedArmEvidence.length === completedStrategies.length &&
    runtimeDoctorReady.ready &&
    durabilityReady.ready &&
    typeof resumeWorkorder?.commands?.missingArmResponseExport === "string" &&
    resumeWorkorder.commands.missingArmResponseExport.includes("--strategies local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank") &&
    resumeWorkorder.commands.missingArmResponseExport.includes("--query-offset 25"),
);

const blockers = [
  workorder.mode !== "public-benchmark-answer-quality-shard-workorder" ? "local-full-workorder-mode-mismatch" : null,
  workorder.plan?.claimScope !== "local-full" ? "local-full-workorder-claim-scope-mismatch" : null,
  runtimeBlocker.mode !== "answer-quality-local-full-shard-runtime-blocker" ? "runtime-blocker-mode-mismatch" : null,
  runtimeBlocker.claimScope !== "local-full" ? "runtime-blocker-claim-scope-mismatch" : null,
  runtimeResume?.resumeAvailable !== true ? "runtime-resume-not-available" : null,
  targetShard.shardId !== "shard-002" ? "resume-target-shard-mismatch" : null,
  targetShard.startIndex !== 25 || targetShard.endIndexExclusive !== 50 ? "resume-target-range-mismatch" : null,
  completedStrategies.length === 0 ? "completed-strategy-evidence-missing" : null,
  missingStrategies.length === 0 ? "missing-strategy-list-empty" : null,
  completedArmEvidence.length !== completedStrategies.length ? "completed-arm-evidence-count-mismatch" : null,
  !runtimeDoctorReady.ready ? "local-embedding-runtime-not-ready" : null,
  !durabilityReady.ready ? "local-embedding-durability-smoke-not-ready" : null,
  typeof resumeWorkorder?.commands?.missingArmResponseExport !== "string" ? "missing-arm-export-command-missing" : null,
  resumeWorkorder?.commands?.missingArmResponseExport && !resumeWorkorder.commands.missingArmResponseExport.includes("--query-offset 25")
    ? "missing-arm-export-command-offset-mismatch"
    : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-shard-resume-packet",
  status: resumeReady ? "READY_FOR_LOCAL_FULL_SHARD_RESUME" : "BLOCKED_LOCAL_FULL_SHARD_RESUME",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  callsProviderApis: false,
  callsHostedSupermemory: false,
  callsLocalEndpoint: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  readyForShardIntake: false,
  readyForShardCombine: false,
  readyForEndToEndMemoryScoreGate: false,
  publicBenchmarkClaimsAllowed: false,
  publicLaunchAllowed: false,
  inputs: summarizeEvidence(evidence),
  readiness: {
    resumeReady,
    workorderStatus: workorder.status ?? null,
    workorderClaimScope: workorder.plan?.claimScope ?? null,
    runtimeBlockerStatus: runtimeBlocker.status ?? null,
    runtimeResumeAvailable: runtimeResume?.resumeAvailable === true,
    missingArmOnlyExportAvailable: typeof resumeWorkorder?.commands?.missingArmResponseExport === "string",
    localEmbeddingRuntimeReady: runtimeDoctorReady.ready,
    localEmbeddingDurabilityReady: durabilityReady.ready,
    acceptedLaneLaunchStatus: acceptedLaneDoctor.status ?? null,
    sotaDoctorStatus: sotaDoctor.status ?? null,
    fullSotaStillBlocked: sotaDoctor.countsAsFullMemorySotaEvidence !== true,
  },
  progress: {
    acceptedShardCount: Number(workorder.progress?.acceptedShardCount ?? 0),
    pendingShardCount: Number(workorder.progress?.pendingShardCount ?? 0),
    rejectedResultCount: Number(workorder.progress?.rejectedResultCount ?? 0),
    runtimeBlockerInputCount: Number(workorder.runtimeBlockers?.inputCount ?? 0),
    runtimeBlockerResumeAvailableCount: Number(workorder.runtimeBlockers?.resumeAvailableCount ?? 0),
    firstAcceptedShardId: acceptedLaneDoctor.shardProgress?.acceptedShardIds?.[0] ?? "shard-001",
    nextPendingShardId: acceptedLaneDoctor.shardProgress?.firstPendingShardId ?? targetShard.shardId,
    nextPendingShardRange: acceptedLaneDoctor.shardProgress?.firstPendingShardRange ?? `${targetShard.startIndex}-${targetShard.endIndexExclusive}`,
  },
  targetShard,
  resumeState: {
    sourceRuntimeBlockerHash: evidence.runtimeBlocker.hash,
    previousFailureClass: runtimeBlocker.failedArm?.failureClass ?? runtimeResume?.failureClass ?? null,
    previousFailedStrategy: runtimeBlocker.failedArm?.strategy ?? runtimeResume?.failedStrategy ?? null,
    publicSyntheticReproduced: runtimeBlocker.publicSyntheticReproduction?.reproduced === true,
    completedArmCount: completedArmEvidence.length,
    missingArmCount: missingStrategies.length,
    completedStrategies,
    missingStrategies,
    completedPrivateArmEvidence: completedArmEvidence,
    historicalBlockers: arrayOfStrings(runtimeBlocker.blockers ?? runtimeResume?.blockers),
  },
  localRuntime: {
    runtimeDoctorStatus: runtimeDoctor.status ?? null,
    runtimeReady: runtimeDoctorReady.ready,
    runtimeModelLooksDedicated: runtimeDoctor.modelArtifact?.likelyDedicatedEmbedding === true,
    runtimeEndpointReachable: runtimeDoctor.localEndpoint?.modelsEndpointReachable === true,
    runtimePrintsEndpoint: runtimeDoctor.endpointPrinted === true,
    runtimePrintsPrivatePath: runtimeDoctor.privatePathPrinted === true,
    durabilityStatus: durabilitySmoke.status ?? null,
    durabilityReady: durabilityReady.ready,
    durabilityProbeCount: Number(durabilitySmoke.probes?.length ?? 0),
    durabilityPrintsEndpoint: durabilitySmoke.endpointPrinted === true,
    durabilityPrintsRawInput: durabilitySmoke.rawSyntheticInputIncluded === true,
    blockers: [...new Set([...runtimeDoctorReady.blockers, ...durabilityReady.blockers])],
  },
  commands: {
    resumeEnvDoctor: [
      "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-shard-resume-env --",
      "--private-input-dir <private-output-dir>",
      `--output ${reviewDir}/local-full-shard-002-resume-env-doctor-20260526.json`,
      `--markdown-output ${reviewDir}/local-full-shard-002-resume-env-doctor-20260526.md`,
    ].join(" "),
    rerunRuntimeDoctor: [
      "npm exec --yes pnpm@10.23.0 -- benchmark:local-embedding:runtime-doctor --",
      "--require-ready",
      `--output ${reviewDir}/local-embedding-runtime-doctor-20260526.json`,
      `--markdown-output ${reviewDir}/local-embedding-runtime-doctor-20260526.md`,
    ].join(" "),
    rerunDurabilitySmoke: [
      "npm exec --yes pnpm@10.23.0 -- benchmark:local-embedding:durability --",
      "--require-ready",
      `--output ${reviewDir}/local-embedding-durability-smoke-20260526.json`,
      `--markdown-output ${reviewDir}/local-embedding-durability-smoke-20260526.md`,
    ].join(" "),
    missingArmResponseExport: resumeWorkorder?.commands?.missingArmResponseExport ?? null,
    preflight: resumeWorkorder?.commands?.preflight ?? null,
    answerQuality: resumeWorkorder?.commands?.answerQuality ?? null,
    localShardIntake: [
      "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-shard-intake",
      "--input <public-review-dir>/answer-quality-local-full-shard-001.json,<public-review-dir>/answer-quality-local-full-shard-002.json",
      `--output ${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002.json`,
      `--markdown-output ${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002.md`,
      "--require-ready",
    ].join(" "),
    fullSotaDoctor: `npm exec --yes pnpm@10.23.0 -- benchmark:sota-doctor -- --output ${reviewDir}/full-memory-sota-doctor-20260526.json --markdown-output ${reviewDir}/full-memory-sota-doctor-20260526.md`,
  },
  safety: {
    noRawQuestionIds: true,
    noRawQuestions: true,
    noRawAnswers: true,
    noRawMemory: true,
    noRawTranscript: true,
    noRawPrompt: true,
    noAbsolutePrivatePaths: true,
    privateSourcesRetainedOutsideRepo: true,
    publicOutputUsesHashesCountsAndLabelsOnly: true,
  },
  blockers,
  nextActions: resumeReady
    ? [
        "Re-run the local embedding runtime doctor while the same local endpoint is alive.",
        "Re-run the local embedding durability smoke with --require-ready.",
        "Run the missing-arm-only response export for shard-002 so the already exported BM25, full-hybrid, and query-expanded arms are reused.",
        "Run the shard-002 answer-quality preflight and answer-quality commands.",
        "Re-run local shard intake with shard-001 and shard-002 public result JSONs.",
        "Do not combine, publish, or claim local-full benchmark evidence until all twenty local-full shards are accepted.",
      ]
    : [
        "Fix the packet blockers and regenerate this resume packet before retrying shard-002.",
        "Keep full-memory SOTA, public benchmark superiority, and launch wording blocked.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local-full shard resume packet");
assertSafePublicText(markdownText, "local-full shard resume packet markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function loadJson(pathLike) {
  const path = resolveInputPath(pathLike);
  assert.ok(existsSync(path), `input missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `input empty: ${displayPath(path)}`);
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, displayPath(path));
  return {
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    json: JSON.parse(raw),
  };
}

function summarizeEvidence(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      {
        path: item.path,
        hash: item.hash,
        mode: item.json.mode ?? null,
        status: item.json.status ?? null,
      },
    ]),
  );
}

function publicCompletedArmEvidence(entry) {
  return {
    strategy: entry.strategy,
    name: entry.name,
    pathLabel: entry.pathLabel,
    hash: entry.hash,
    responseCount: Number(entry.responseCount ?? 0),
    providerCallsMade: Number(entry.providerCallsMade ?? 0),
    queryExpansionCalls: Number(entry.queryExpansionCalls ?? 0),
    queryExpansionMode: entry.queryExpansionMode ?? null,
    queryExpansionModel: entry.queryExpansionModel ?? null,
  };
}

function isRuntimeDoctorReady(report) {
  const ready =
    report?.mode === "local-embedding-runtime-doctor" &&
    report?.status === "READY_LOCAL_EMBEDDING_RUNTIME" &&
    report?.readyForLocalEmbeddingDurabilitySmoke === true &&
    report?.readyForLocalAppleArmExport === true &&
    report?.modelArtifact?.likelyDedicatedEmbedding === true &&
    report?.localEndpoint?.modelsEndpointReachable === true &&
    report?.privatePathPrinted === false &&
    report?.endpointPrinted === false &&
    report?.rawConfigIncluded === false;
  return {
    ready,
    blockers: ready ? [] : [...new Set(["local-embedding-runtime-not-ready", ...arrayOfStrings(report?.blockers)])],
  };
}

function isDurabilityReady(report) {
  const ready =
    report?.mode === "local-embedding-durability-smoke" &&
    report?.status === "READY_LOCAL_EMBEDDING_DURABILITY" &&
    report?.readyForLocalAppleArmExport === true &&
    report?.rawSyntheticInputIncluded === false &&
    report?.baseUrlPrinted === false &&
    report?.endpointPrinted === false &&
    Number(report?.probes?.length ?? 0) >= 4;
  return {
    ready,
    blockers: ready ? [] : [...new Set(["local-embedding-durability-smoke-not-ready", ...arrayOfStrings(report?.blockers)])],
  };
}

function renderMarkdown(value) {
  return [
    "# Local-Full Shard Resume Packet",
    "",
    `- Status: ${value.status}`,
    `- Target shard: ${value.targetShard.shardId} (${value.targetShard.startIndex}-${value.targetShard.endIndexExclusive})`,
    `- Accepted local-full shards: ${value.progress.acceptedShardCount}`,
    `- Pending local-full shards: ${value.progress.pendingShardCount}`,
    `- Runtime resume available: ${value.readiness.runtimeResumeAvailable}`,
    `- Local embedding runtime ready: ${value.readiness.localEmbeddingRuntimeReady}`,
    `- Local embedding durability ready: ${value.readiness.localEmbeddingDurabilityReady}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    "",
    "## Resume State",
    `- Previous failure: ${value.resumeState.previousFailureClass ?? "n/a"}`,
    `- Completed arms: ${value.resumeState.completedStrategies.join(", ") || "none"}`,
    `- Missing arms: ${value.resumeState.missingStrategies.join(", ") || "none"}`,
    `- Completed private arm hashes: ${value.resumeState.completedPrivateArmEvidence.map((item) => `${item.strategy}=${item.hash}`).join("; ") || "none"}`,
    "",
    "## Commands",
    `- Resume env doctor: ${value.commands.resumeEnvDoctor}`,
    `- Runtime doctor: ${value.commands.rerunRuntimeDoctor}`,
    `- Durability smoke: ${value.commands.rerunDurabilitySmoke}`,
    `- Missing-arm export: ${value.commands.missingArmResponseExport ?? "n/a"}`,
    `- Preflight: ${value.commands.preflight ?? "n/a"}`,
    `- Answer quality: ${value.commands.answerQuality ?? "n/a"}`,
    `- Local shard intake: ${value.commands.localShardIntake}`,
    "",
    "## Safety",
    `- Metrics only: ${value.metricsOnly}`,
    `- Public safe: ${value.publicSafe}`,
    `- Raw questions included: ${value.rawQuestionsIncluded}`,
    `- Raw answers included: ${value.rawAnswersIncluded}`,
    `- Raw memory included: ${value.rawMemoryIncluded}`,
    `- Raw private output path included: ${value.rawPrivateOutputPathIncluded}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function arrayOfStrings(value) {
  return arrayOf(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function intOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function resolveInputPath(pathLike) {
  const value = String(pathLike);
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/i;
  const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
  assert.equal(secretPattern.test(text), false, `${label} contains secret-shaped text`);
  assert.equal(privatePathPattern.test(text), false, `${label} contains absolute private path`);
  assert.equal(privateTagPattern.test(text), false, `${label} contains private tag`);
}
