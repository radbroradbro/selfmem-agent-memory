import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = String(args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const resumePacketPath = resolveInputPath(args.resumePacket ?? `${reviewDir}/local-full-shard-002-resume-packet-20260526.json`);
const planPath = resolveInputPath(args.plan ?? `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`);
const privateDir = stringOrNull(args.privateInputDir ?? args.privateDir ?? process.env.RECALLWEAVE_FULL_SHARD_PRIVATE_DIR);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const resumeRaw = readFileSyncChecked(resumePacketPath, "resume packet");
const planRaw = readFileSyncChecked(planPath, "local-full shard plan");
const resumePacket = JSON.parse(resumeRaw);
const plan = JSON.parse(planRaw);

const privateDirState = inspectPrivateDir(privateDir);
const envState = inspectEnv();
const requiredInputFiles = inspectRequiredInputFiles(privateDirState.resolvedPath, plan);
const completedArmFiles = inspectCompletedArmFiles(privateDirState.resolvedPath, resumePacket);
const missingArmFiles = inspectMissingArmFiles(privateDirState.resolvedPath, resumePacket);
const commandPlaceholderState = inspectCommandPlaceholders(resumePacket);

const readyForMissingArmExport =
  resumePacket.status === "READY_FOR_LOCAL_FULL_SHARD_RESUME" &&
  privateDirState.present &&
  privateDirState.outsideRepository &&
  requiredInputFiles.every((file) => file.present && file.hashMatches && file.nonEmpty) &&
  completedArmFiles.every((file) => file.present && file.hashMatches && file.nonEmpty) &&
  envState.localEmbedding.ready &&
  envState.localRerank.ready &&
  envState.localSafety.ready;
const readyForAnswerQualityPreflight =
  readyForMissingArmExport &&
  missingArmFiles.every((file) => file.present && file.nonEmpty) &&
  envState.answerQuality.ready;
const readyForLocalShardIntake = readyForAnswerQualityPreflight;
const ready = readyForMissingArmExport && readyForAnswerQualityPreflight && readyForLocalShardIntake;

const blockers = [
  resumePacket.status !== "READY_FOR_LOCAL_FULL_SHARD_RESUME" ? "resume-packet-not-ready" : null,
  !privateDirState.provided ? "private-dir-not-provided" : null,
  privateDirState.provided && !privateDirState.present ? "private-dir-not-present" : null,
  privateDirState.present && !privateDirState.outsideRepository ? "private-dir-inside-repository" : null,
  requiredInputFiles.some((file) => !file.present) ? "required-private-input-files-missing" : null,
  requiredInputFiles.some((file) => file.present && !file.hashMatches) ? "required-private-input-file-hash-mismatch" : null,
  completedArmFiles.some((file) => !file.present) ? "completed-private-arm-files-missing" : null,
  completedArmFiles.some((file) => file.present && !file.hashMatches) ? "completed-private-arm-file-hash-mismatch" : null,
  !envState.localEmbedding.ready ? "local-embedding-env-missing" : null,
  !envState.localRerank.ready ? "local-rerank-env-missing" : null,
  !envState.localSafety.ready ? "local-safety-env-missing" : null,
  !envState.answerQuality.ready ? "answer-quality-env-missing" : null,
  readyForMissingArmExport && missingArmFiles.some((file) => !file.present) ? "missing-arm-files-not-yet-exported" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-shard-resume-env-doctor",
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
  env: envState.public,
  commandPlaceholders: commandPlaceholderState,
  requiredInputFiles,
  completedArmFiles,
  missingArmFiles,
  blockers,
  nextActions: ready
    ? [
        "Run the shard-002 missing-arm response export from the resume packet.",
        "Run shard-002 answer-quality preflight and answer-quality after the missing arm files exist.",
        "Run local shard intake with shard-001 and shard-002 public result JSONs.",
      ]
    : [
        "Provide RECALLWEAVE_FULL_SHARD_PRIVATE_DIR or --private-input-dir for the outside-repository private materialization directory.",
        "Set the local embedding and local rerank environment variables for the two missing local Apple arms.",
        "Set local answer-quality endpoint and model environment variables before preflight/scoring.",
        "Regenerate this doctor before running the resume packet commands.",
      ],
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

function inspectEnv() {
  const localEmbedding = envGroup([
    "SELFMEM_LOCAL_EMBED_BASE_URL",
    "SELFMEM_LOCAL_EMBED_MODEL",
    "SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS",
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
    { role: "queryset", name: "longmemeval-queryset.private.json", hash: planValue.materializeReport?.collectorCompatibleQuerySetHash },
    { role: "memories", name: "longmemeval-memories.private.jsonl", hash: planValue.materializeReport?.memoriesFileHash },
    { role: "answer-labels", name: "longmemeval-answer-labels.private.json", hash: planValue.target?.answerLabelsHash },
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
  const actualHash = present ? `sha256:${sha256(readFileSync(path))}` : null;
  return {
    role: spec.role,
    name: spec.name,
    pathLabel: "external-private-file",
    present,
    nonEmpty: sizeBytes > 0,
    sizeBytes: present ? sizeBytes : null,
    expectedHash: spec.hash ?? null,
    actualHash: actualHash ? "sha256:<redacted-public-hash>" : null,
    hashMatches: spec.hash ? actualHash === spec.hash : null,
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

function placeholderNames(command) {
  return [...String(command ?? "").matchAll(/<([^>]+)>/gu)].map((match) => match[1]);
}

function renderMarkdown(value) {
  return [
    "# Local-Full Shard Resume Environment Doctor",
    "",
    `- Status: ${value.status}`,
    `- Target shard: ${value.resumePacket.targetShard?.shardId ?? "n/a"} (${value.resumePacket.targetShard?.startIndex ?? "n/a"}-${value.resumePacket.targetShard?.endIndexExclusive ?? "n/a"})`,
    `- Ready for missing-arm export: ${value.readyForMissingArmExport}`,
    `- Ready for answer-quality preflight: ${value.readyForAnswerQualityPreflight}`,
    `- Ready for local shard intake: ${value.readyForLocalShardIntake}`,
    `- Private directory provided: ${value.privateDir.provided}`,
    `- Private directory present: ${value.privateDir.present}`,
    `- Private directory outside repository: ${value.privateDir.outsideRepository}`,
    `- Local embedding env ready: ${value.env.localEmbedding.ready}`,
    `- Local rerank env ready: ${value.env.localRerank.ready}`,
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
    ...value.requiredInputFiles.map((file) => `- ${file.role}: present=${file.present}; hashMatched=${file.hashMatches}`),
    "",
    "## Completed Arm Files",
    ...value.completedArmFiles.map((file) => `- ${file.role}: present=${file.present}; hashMatched=${file.hashMatches}`),
    "",
    "## Missing Arm Files",
    ...value.missingArmFiles.map((file) => `- ${file.role}: present=${file.present}`),
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
  return relative(root, path).replaceAll("\\", "/");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
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
