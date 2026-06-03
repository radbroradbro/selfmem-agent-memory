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
      // Best effort only; fixture mode writes public-safe synthetic files outside the repository.
    }
  }
});

const fixtureMode = Boolean(args.fixture);
const fixtureState = fixtureMode ? createFixtureState() : null;
const reviewDir = String(fixtureState?.reviewDir ?? args.reviewDir ?? process.env.RECALLWEAVE_REVIEW_DIR ?? "reviews/overnight-20260522");
const planPath = resolveInputPath(args.plan ?? fixtureState?.planPath ?? `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`);
const resumePacketPath = resolveInputPath(
  args.resumePacket ?? fixtureState?.resumePacketPath ?? `${reviewDir}/local-full-shard-002-resume-packet-20260526.json`,
);
const materializerPath = resolveInputPath(
  args.materializer ??
    args.commandMaterializer ??
    fixtureState?.materializerPath ??
    `${reviewDir}/local-full-shard-002-resume-command-materializer-20260526.json`,
);
const shard001Path = resolveInputPath(
  args.shard001 ?? fixtureState?.shard001Path ?? `${reviewDir}/answer-quality-local-full-shard-001-20260526.json`,
);
const shard002Path = resolveInputPath(
  args.shard002 ?? args.result ?? fixtureState?.shard002Path ?? `${reviewDir}/answer-quality-local-full-shard-002.json`,
);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const planState = loadRequiredJson(planPath, "local-full shard plan");
const resumePacketState = loadRequiredJson(resumePacketPath, "local-full resume packet");
const materializerState = loadOptionalJson(materializerPath, "local-full resume command materializer");
const shard001State = loadOptionalJson(shard001Path, "local-full shard 001 result");
const shard002State = loadOptionalJson(shard002Path, "local-full shard 002 result");
const plan = planState.json;
const resumePacket = resumePacketState.json;
const materializer = materializerState.json;
const shard001 = shard001State.json;
const shard002 = shard002State.json;
const expectedShard = (plan.shards ?? []).find((shard) => shard.id === "shard-002") ?? null;
const previousShard = inspectPreviousShard(shard001State, shard001, plan);
const commandMaterializer = inspectMaterializer(materializerState, materializer);
const shardResult = inspectShard002Result(shard002State, shard002, plan, expectedShard);
const readyForLocalShardIntake = commandMaterializer.ready && previousShard.accepted && shardResult.accepted;

const blockers = [
  plan.mode !== "public-benchmark-answer-quality-shard-plan" ? "local-full-plan-mode-mismatch" : null,
  (plan.runPlan?.claimScope ?? plan.claimScope) !== "local-full" ? "local-full-plan-claim-scope-mismatch" : null,
  !expectedShard ? "shard-002-not-in-plan" : null,
  resumePacket.status !== "READY_FOR_LOCAL_FULL_SHARD_RESUME" ? "resume-packet-not-ready" : null,
  !commandMaterializer.present ? "resume-command-materializer-report-missing" : null,
  commandMaterializer.present && !commandMaterializer.ready ? "resume-command-materializer-not-ready" : null,
  commandMaterializer.present && !commandMaterializer.writesPrivateCommandFile ? "resume-private-command-file-not-written" : null,
  !previousShard.present ? "shard-001-result-missing" : null,
  previousShard.present && !previousShard.accepted ? "shard-001-result-not-accepted" : null,
  !shardResult.present ? "shard-002-result-missing" : null,
  ...shardResult.failures,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "local-full-shard-resume-result-doctor",
  fixtureOnly: fixtureMode,
  status: blockers.length === 0 ? "READY_LOCAL_FULL_SHARD_002_RESULT_FOR_INTAKE" : "BLOCKED_LOCAL_FULL_SHARD_002_RESULT",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
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
  printsPrivatePaths: false,
  printsEnvValues: false,
  printsMaterializedCommands: false,
  countsAsLocalFullBenchmarkEvidence: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  readyForLocalShardIntake,
  readyForShardCombine: false,
  readyForEndToEndMemoryScoreGate: false,
  plan: {
    path: planState.path,
    hash: planState.hash,
    claimScope: plan.runPlan?.claimScope ?? plan.claimScope ?? null,
    queryCount: Number(plan.runPlan?.queryCount ?? 0),
    shardCount: Number(plan.runPlan?.shardCount ?? 0),
    strategies: plan.runPlan?.strategies ?? [],
  },
  resumePacket: {
    path: resumePacketState.path,
    hash: resumePacketState.hash,
    status: resumePacket.status ?? null,
    targetShard: resumePacket.targetShard ?? null,
  },
  commandMaterializer,
  previousShard,
  shardResult,
  localShardIntakeCommand: [
    "npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-shard-intake",
    `--input ${reviewDir}/answer-quality-local-full-shard-001-20260526.json,${reviewDir}/answer-quality-local-full-shard-002.json`,
    `--output ${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002.json`,
    `--markdown-output ${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002.md`,
  ].join(" "),
  blockers,
  nextActions:
    blockers.length === 0
      ? [
          "Run the local shard intake command for shard-001 plus shard-002.",
          "Keep local-full combine blocked until all twenty local-full shards are accepted.",
          "Keep full-memory SOTA and public benchmark claims blocked until provider comparison, reviewer approval, docs/UI refresh, owner approval, and real canary evidence pass.",
        ]
      : [
          "Run the resume command materializer with real outside-repository private inputs.",
          "Run the generated private script to produce the shard-002 public answer-quality result.",
          "Regenerate this result doctor before running local shard intake.",
        ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "local-full shard resume result doctor");
assertSafePublicText(markdownText, "local-full shard resume result doctor markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function inspectMaterializer(state, value) {
  const present = Boolean(state.present && value);
  return {
    path: state.path,
    hash: state.hash,
    present,
    status: value?.status ?? null,
    fixtureOnly: value?.fixtureOnly ?? null,
    ready: present && value?.status === "READY_LOCAL_FULL_RESUME_PRIVATE_COMMANDS" && value?.readyForMaterialization === true,
    writesPrivateCommandFile: value?.writesRealPrivateCommandFile === true,
    privateCommandPathPrinted: value?.privateCommandFile?.pathPrinted === true,
    privateCommandFileHash: value?.privateCommandFile?.hash ?? null,
    commandCount: Number(value?.commandPlan?.commandCount ?? 0),
    materializedCommandCount: Number(value?.commandPlan?.materializedCommandCount ?? 0),
    commandsPrinted: value?.commandPlan?.commandsPrinted === true,
    printsMaterializedCommands: value?.printsMaterializedCommands === true,
    printsPrivatePaths: value?.printsPrivatePaths === true,
    printsEnvValues: value?.printsEnvValues === true,
    blockers: arrayOfStrings(value?.blockers),
  };
}

function inspectPreviousShard(state, value, planValue) {
  const range = value?.input?.queryShard ?? {};
  const accepted =
    state.present &&
    value?.mode === "public-benchmark-answer-quality" &&
    value?.fixtureOnly === false &&
    value?.publicSafe === true &&
    value?.metricsOnly === true &&
    value?.memoryBenchAnswerQuality === true &&
    value?.claimScope === "local-full" &&
    Number(range.startIndex ?? -1) === 0 &&
    Number(range.endIndexExclusive ?? -1) === 25 &&
    value?.input?.targetHash === planValue.target?.hash;
  return {
    path: state.path,
    hash: state.hash,
    present: state.present,
    accepted,
    startIndex: state.present ? Number(range.startIndex ?? -1) : null,
    endIndexExclusive: state.present ? Number(range.endIndexExclusive ?? -1) : null,
  };
}

function inspectShard002Result(state, value, planValue, shard) {
  if (!state.present || !value) {
    return {
      path: state.path,
      hash: null,
      present: false,
      accepted: false,
      failures: [],
      metricsSummary: [],
    };
  }
  const range = value.input?.queryShard ?? {};
  const expectedStrategies = [...(planValue.runPlan?.strategies ?? [])].sort();
  const actualStrategies = arrayOf(value.strategies)
    .map((entry) => String(entry?.strategy ?? ""))
    .filter(Boolean)
    .sort();
  const failures = [
    value.mode !== "public-benchmark-answer-quality" ? "not-answer-quality-report" : null,
    value.fixtureOnly !== false ? "fixture-result" : null,
    value.metricsOnly !== true ? "not-metrics-only" : null,
    value.publicSafe !== true ? "not-public-safe" : null,
    value.memoryBenchAnswerQuality !== true ? "memorybench-answer-quality-not-proven" : null,
    value.claimScope !== "local-full" ? "claim-scope-not-local-full" : null,
    value.publicBenchmarkClaimsAllowed !== false ? "public-claims-enabled" : null,
    value.rawQuestionIdsIncluded !== false ? "raw-question-ids-included" : null,
    value.rawQuestionsIncluded !== false ? "raw-questions-included" : null,
    value.rawAnswersIncluded !== false ? "raw-answers-included" : null,
    value.rawMemoryIncluded !== false ? "raw-memory-included" : null,
    value.rawTranscriptIncluded !== false ? "raw-transcript-included" : null,
    value.rawPromptIncluded !== false ? "raw-prompt-included" : null,
    Number(range.startIndex ?? -1) !== Number(shard?.startIndex ?? 25) ? "shard-start-index-mismatch" : null,
    Number(range.endIndexExclusive ?? -1) !== Number(shard?.endIndexExclusive ?? 50) ? "shard-end-index-mismatch" : null,
    Number(value.input?.queryOffset ?? -1) !== Number(shard?.startIndex ?? 25) ? "query-offset-mismatch" : null,
    Number(value.input?.queryLimit ?? -1) !== Number(shard?.queryCount ?? 25) ? "query-limit-mismatch" : null,
    Number(value.input?.scoredQueryCount ?? -1) !== Number(shard?.queryCount ?? 25) ? "scored-query-count-mismatch" : null,
    value.input?.targetHash !== planValue.target?.hash ? "target-hash-mismatch" : null,
    value.input?.querySetHash !== planValue.materializeReport?.collectorCompatibleQuerySetHash ? "query-set-hash-mismatch" : null,
    value.input?.materializerHash !== planValue.materializeReport?.materializerHash ? "materializer-hash-mismatch" : null,
    value.input?.answerLabelsHash !== planValue.target?.answerLabelsHash ? "answer-labels-hash-mismatch" : null,
    range.rangeHash !== shard?.rangeHash ? "range-hash-mismatch" : null,
    JSON.stringify(actualStrategies) !== JSON.stringify(expectedStrategies) ? "strategy-set-mismatch" : null,
  ].filter(Boolean);
  return {
    path: state.path,
    hash: state.hash,
    present: true,
    accepted: failures.length === 0,
    startIndex: Number(range.startIndex ?? -1),
    endIndexExclusive: Number(range.endIndexExclusive ?? -1),
    scoredQueryCount: Number(value.input?.scoredQueryCount ?? 0),
    strategyCount: actualStrategies.length,
    strategyNames: actualStrategies,
    metricsSummary: arrayOf(value.strategies).map((entry) => ({
      strategy: entry.strategy,
      answerQuality: numberOrNull(entry.metrics?.answerQuality),
      quality: numberOrNull(entry.metrics?.quality),
      scoredQueryCount: numberOrNull(entry.scoredQueryCount),
      answerLatencyP50Ms: numberOrNull(entry.metrics?.answerLatencyP50Ms),
      contextTokensAvg: numberOrNull(entry.metrics?.contextTokensAvg),
    })),
    failures,
  };
}

function createFixtureState() {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-local-full-resume-result-fixture-"));
  fixtureTempRoots.push(tempRoot);
  const reviewDirPath = join(tempRoot, "reviews");
  mkdirSync(reviewDirPath, { recursive: true });
  const planPath = resolve(root, "reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json");
  const resumePacketPath = resolve(root, "reviews/overnight-20260522/local-full-shard-002-resume-packet-20260526.json");
  const shard001Path = resolve(root, "reviews/overnight-20260522/answer-quality-local-full-shard-001-20260526.json");
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const shard001 = JSON.parse(readFileSync(shard001Path, "utf8"));
  const shard002 = structuredClone(shard001);
  const shardPlan = plan.shards.find((shard) => shard.id === "shard-002");
  shard002.generatedAt = "2026-05-26T00:00:00.000Z";
  shard002.input = {
    ...shard002.input,
    queryOffset: shardPlan.startIndex,
    queryLimit: shardPlan.queryCount,
    scoredQueryCount: shardPlan.queryCount,
    scoredQueryStart: shardPlan.startIndex,
    scoredQueryEndExclusive: shardPlan.endIndexExclusive,
    queryShard: {
      ...shard002.input.queryShard,
      startIndex: shardPlan.startIndex,
      endIndexExclusive: shardPlan.endIndexExclusive,
      scoredQueryCount: shardPlan.queryCount,
      rangeHash: shardPlan.rangeHash,
    },
  };
  const materializer = {
    schemaVersion: 1,
    ok: true,
    mode: "local-full-shard-resume-command-materializer",
    fixtureOnly: true,
    status: "READY_LOCAL_FULL_RESUME_PRIVATE_COMMANDS",
    publicSafe: true,
    metricsOnly: true,
    readyForMaterialization: true,
    writesRealPrivateCommandFile: true,
    printsMaterializedCommands: false,
    printsEnvValues: false,
    printsPrivatePaths: false,
    countsAsLocalFullBenchmarkEvidence: false,
    countsAsFullMemorySotaEvidence: false,
    privateCommandFile: {
      pathPrinted: false,
      hash: `sha256:${sha256("fixture-private-script")}`,
    },
    commandPlan: {
      commandCount: 8,
      materializedCommandCount: 8,
      commandsPrinted: false,
    },
    blockers: [],
  };
  const materializerPath = join(reviewDirPath, "local-full-shard-002-resume-command-materializer-20260526.json");
  const shard002Path = join(reviewDirPath, "answer-quality-local-full-shard-002.json");
  writeFileSync(materializerPath, `${JSON.stringify(materializer, null, 2)}\n`);
  writeFileSync(shard002Path, `${JSON.stringify(shard002, null, 2)}\n`);
  return {
    reviewDir: "reviews/overnight-20260522",
    planPath,
    resumePacketPath,
    shard001Path,
    materializerPath,
    shard002Path,
  };
}

function renderMarkdown(value) {
  return [
    "# Local-Full Shard Resume Result Doctor",
    "",
    `- Status: ${value.status}`,
    `- Fixture only: ${value.fixtureOnly}`,
    `- Ready for local shard intake: ${value.readyForLocalShardIntake}`,
    `- Counts as local-full benchmark evidence: ${value.countsAsLocalFullBenchmarkEvidence}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    "",
    "## Materializer",
    `- Present: ${value.commandMaterializer.present}`,
    `- Status: ${value.commandMaterializer.status ?? "n/a"}`,
    `- Ready: ${value.commandMaterializer.ready}`,
    `- Writes private command file: ${value.commandMaterializer.writesPrivateCommandFile}`,
    `- Prints private paths: ${value.commandMaterializer.printsPrivatePaths}`,
    `- Prints env values: ${value.commandMaterializer.printsEnvValues}`,
    "",
    "## Shard Result",
    `- Present: ${value.shardResult.present}`,
    `- Accepted: ${value.shardResult.accepted}`,
    `- Range: ${value.shardResult.startIndex ?? "n/a"}-${value.shardResult.endIndexExclusive ?? "n/a"}`,
    `- Strategy count: ${value.shardResult.strategyCount ?? 0}`,
    `- Strategies: ${value.shardResult.strategyNames?.join(", ") || "none"}`,
    `- Failures: ${value.shardResult.failures?.join(", ") || "none"}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function loadRequiredJson(path, label) {
  assert.ok(existsSync(path), `${label} missing: ${displayPath(path)}`);
  assert.ok(statSync(path).size > 0, `${label} empty: ${displayPath(path)}`);
  return loadJson(path, label);
}

function loadOptionalJson(path, label) {
  if (!existsSync(path) || statSync(path).size === 0) {
    return {
      path: displayPath(path),
      hash: null,
      present: false,
      json: null,
    };
  }
  return loadJson(path, label);
}

function loadJson(path, label) {
  const raw = readFileSync(path, "utf8");
  assertSafePublicText(raw, label);
  return {
    path: displayPath(path),
    hash: `sha256:${sha256(raw)}`,
    present: true,
    json: JSON.parse(raw),
  };
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

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function arrayOfStrings(value) {
  return arrayOf(value).map((item) => String(item)).filter(Boolean);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
