import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const planPath = resolveInputPath(args.plan ?? "reviews/overnight-20260522/answer-quality-full-shard-plan-20260525.json");
const materializeReportPath = resolveInputPath(
  args.materializeReport ?? "reviews/overnight-20260522/public-longmemeval-full-materialize-run.json",
);
const privateInputDir = args.privateInputDir ? resolveInputPath(args.privateInputDir) : null;
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;
const expectedFiles = [
  { role: "queryset", name: "longmemeval-queryset.private.json", planHashKey: "querySetHash" },
  { role: "memories", name: "longmemeval-memories.private.jsonl", planHashKey: "memoriesFileHash" },
  { role: "answer-labels", name: "longmemeval-answer-labels.private.json", planHashKey: "answerLabelsFileHash" },
  { role: "raw-dataset", name: "longmemeval-raw-dataset.private.json", planHashKey: "rawDatasetHash" },
  { role: "selected-raw-rows", name: "longmemeval-selected-raw-rows.private.json", planHashKey: "selectedRawRowsHash" },
  { role: "source-manifest", name: "longmemeval-source-manifest.private.json", planHashKey: "sourceManifestHash" },
];

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(planPath), `full-shard plan missing: ${displayPath(planPath)}`);
assert.ok(existsSync(materializeReportPath), `materialize report missing: ${displayPath(materializeReportPath)}`);

const planRaw = readFileSync(planPath, "utf8");
const materializeRaw = readFileSync(materializeReportPath, "utf8");
assertSafePublicText(planRaw, "full-shard plan");
assertSafePublicText(materializeRaw, "materialize report");
const plan = JSON.parse(planRaw);
const materialize = JSON.parse(materializeRaw);
assert.equal(plan.mode, "public-benchmark-answer-quality-shard-plan", "plan must be full-shard plan");
assert.equal(materialize.mode, "public-benchmark-materialize-run", "materialize report must be materialize-run report");

const files = expectedFiles.map((item) => inspectPrivateFile(item));
const privateDirInsideRepo = privateInputDir ? isInsideRepo(privateInputDir) : null;
const privateDirPresent = Boolean(privateInputDir && existsSync(privateInputDir) && statSync(privateInputDir).isDirectory());
const memoryFile = files.find((item) => item.role === "memories");
const checks = {
  privateInputDirProvided: Boolean(privateInputDir),
  privateInputDirPresent: privateDirPresent,
  privateInputDirOutsideRepository: privateInputDir ? !privateDirInsideRepo : false,
  privateInputDirNotPrinted: true,
  planReadyForShardRun: plan.readyForAnswerQualityShardRun === true,
  materializeTargetMatchesPlan: materialize.target?.targetFileHash === plan.target?.hash,
  materializeCollectorQuerySetMatchesPlan: materialize.selection?.collectorCompatibleQuerySetHash === plan.materializeReport?.collectorCompatibleQuerySetHash,
  materializeHashMatchesPlan: `sha256:${sha256(materializeRaw)}` === plan.materializeReport?.hash,
  fullQueryCountPresent: Number(plan.runPlan?.queryCount ?? 0) === 500 && Number(materialize.selection?.queryCount ?? 0) === 500,
  fullShardCountPresent: Number(plan.runPlan?.shardCount ?? 0) === 20,
  maxMemoryBytesCoversPrivateMemories:
    Number(plan.runPlan?.maxMemoryBytes ?? 0) > 0 && Number(memoryFile?.sizeBytes ?? Number.POSITIVE_INFINITY) <= Number(plan.runPlan?.maxMemoryBytes ?? 0),
  responseArmTemplateCarriesMemoryLimit: String(plan.runPlan?.responseArmExportTemplate ?? "").includes(
    `--max-memory-bytes ${plan.runPlan?.maxMemoryBytes}`,
  ),
  allPrivateFilesPresent: files.every((file) => file.present),
  allPrivateFilesOutsideRepository: files.every((file) => file.outsideRepository),
  allPrivateFilesHashMatched: files.every((file) => file.hashMatches),
  allPrivateFilesNonEmpty: files.every((file) => Number(file.sizeBytes ?? 0) > 0),
  allPrivateFilesMode0600: files.every((file) => file.mode === "0600"),
  rawSourceRetentionPrivate: materialize.rawSourcesRetainedPrivate === true && materialize.sourceRetention?.rawTextPubliclyIncluded === false,
};
const blockers = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([key]) => kebab(key));
const ready = blockers.length === 0;

const report = {
  schemaVersion: 1,
  ok: !requireReady || ready,
  mode: "full-shard-private-input-doctor",
  status: ready ? "READY_FULL_SHARD_PRIVATE_INPUTS" : "BLOCKED_FULL_SHARD_PRIVATE_INPUTS",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  retrievalProxyOnly: false,
  memoryBenchAnswerQuality: false,
  readyForAnswerQualityShardRun: ready,
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
    queryCount: plan.runPlan?.queryCount ?? null,
    shardCount: plan.runPlan?.shardCount ?? null,
    maxMemoryBytes: plan.runPlan?.maxMemoryBytes ?? null,
    targetHash: plan.target?.hash ?? null,
    collectorCompatibleQuerySetHash: plan.materializeReport?.collectorCompatibleQuerySetHash ?? null,
    materializerHash: plan.materializeReport?.materializerHash ?? null,
  },
  materializeReport: {
    path: displayPath(materializeReportPath),
    hash: `sha256:${sha256(materializeRaw)}`,
    selectedRawRowsCount: materialize.sourceRetention?.selectedRawRowsCount ?? null,
    rawSourcesRetainedPrivate: materialize.rawSourcesRetainedPrivate === true,
    privateOutputPathIncluded: materialize.sourceRetention?.privateOutputPathIncluded === true,
  },
  privateInput: {
    directoryLabel: privateInputDir ? "external-private-input-dir" : null,
    directoryPresent: privateDirPresent,
    directoryInsideRepository: privateDirInsideRepo,
    valuePrinted: false,
    files,
  },
  checks,
  blockers,
  nextActions: ready
    ? [
        "Run benchmark:answer-quality:arms shard-by-shard with the checked-in plan template.",
        "Run benchmark:answer-quality:preflight for each shard before model-scored answer quality.",
        "Keep private input and response files outside the repository; commit only metrics-only shard outputs.",
      ]
    : [
        "Regenerate the full LongMemEval private materialization into an outside-repository directory.",
        "Run this doctor with --private-input-dir pointing at that directory before launching shard jobs.",
        "Do not start full-shard scoring until hashes, permissions, and the memory-size cap all pass.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "full-shard private input doctor");
assertSafePublicText(markdownText, "full-shard private input doctor markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function inspectPrivateFile(spec) {
  const materializeFile = (materialize.privateOutputs?.files ?? []).find((file) => file.role === spec.role);
  const expectedHash = materializeFile?.hash ?? plan.materializeReport?.[spec.planHashKey] ?? null;
  const path = privateInputDir ? join(privateInputDir, spec.name) : null;
  if (!path || !existsSync(path)) {
    return {
      role: spec.role,
      name: spec.name,
      present: false,
      outsideRepository: path ? !isInsideRepo(path) : false,
      hash: null,
      expectedHash,
      hashMatches: false,
      sizeBytes: null,
      mode: null,
      pathLabel: "external-private-input-file",
    };
  }
  const stat = statSync(path);
  const hash = `sha256:${fileHash(path)}`;
  return {
    role: spec.role,
    name: spec.name,
    present: stat.isFile(),
    outsideRepository: !isInsideRepo(path),
    hash,
    expectedHash,
    hashMatches: hash === expectedHash,
    sizeBytes: stat.size,
    mode: modeString(stat.mode),
    pathLabel: "external-private-input-file",
  };
}

function renderMarkdown(value) {
  return [
    "# Full-Shard Private Input Doctor",
    "",
    `- Status: ${value.status}`,
    `- Ready for shard run: ${value.readyForAnswerQualityShardRun}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Query count: ${value.plan.queryCount}`,
    `- Shard count: ${value.plan.shardCount}`,
    `- Max memory bytes: ${value.plan.maxMemoryBytes}`,
    `- Private directory present: ${value.privateInput.directoryPresent}`,
    `- Private directory inside repository: ${value.privateInput.directoryInsideRepository}`,
    `- Raw sources retained privately: ${value.materializeReport.rawSourcesRetainedPrivate}`,
    "",
    "## Files",
    ...value.privateInput.files.map(
      (file) =>
        `- ${file.role}: present=${file.present}, hashMatched=${file.hashMatches}, sizeBytes=${file.sizeBytes ?? "n/a"}, mode=${file.mode ?? "n/a"}`,
    ),
    "",
    "## Checks",
    ...Object.entries(value.checks).map(([key, passed]) => `- ${key}: ${passed}`),
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

function isInsideRepo(path) {
  const rel = relative(root, resolve(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value ?? "") : resolve(root, String(value ?? ""));
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

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function modeString(mode) {
  return (mode & 0o777).toString(8).padStart(4, "0");
}

function kebab(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
