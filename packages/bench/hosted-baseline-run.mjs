import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const liveRequested = Boolean(args.live) || process.env.RECALLWEAVE_BASELINE_LIVE === "1";
const fixtureRequested = Boolean(args.fixture) || !liveRequested;
const format = String(args.format ?? "json").toLowerCase();
assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
const outDir = resolvePath(args.outDir ?? process.env.RECALLWEAVE_BASELINE_RUN_DIR ?? "/tmp/recallweave-baseline-run");
const outputPath = args.output ? resolvePath(args.output) : null;
const preserveIds = Boolean(args.preserveIds) || process.env.RECALLWEAVE_BASELINE_PRESERVE_IDS === "1";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*)/i;

const paths = {
  querySetReport: join(outDir, "hosted-baseline-queryset-report.json"),
  sourceMatch: join(outDir, "baseline-source-match.json"),
  sourceAlignment: join(outDir, "baseline-source-alignment.json"),
  sourceGap: join(outDir, "baseline-source-gap.json"),
  hosted: join(outDir, "hosted-baseline-result.json"),
  recallWeaveResponses: join(outDir, "recallweave-search-responses.json"),
  recallWeave: join(outDir, "recallweave-result.json"),
  preflight: join(outDir, "hosted-baseline-preflight.json"),
  comparison: join(outDir, "baseline-comparison.json"),
  nextRun: join(outDir, "hosted-baseline-next-run.json"),
  packet: resolvePath(args.packetOutput ?? process.env.RECALLWEAVE_BASELINE_PACKET_OUTPUT ?? join(outDir, "recallweave-baseline-evidence-packet.zip")),
  intake: join(outDir, "returned-baseline-intake.json"),
};

mkdirSync(outDir, { recursive: true, mode: 0o700 });
mkdirSync(dirname(paths.packet), { recursive: true, mode: 0o700 });

const privateEnv = args.containerEnv ? loadPrivateEnv(resolvePath(args.containerEnv)) : {};
const querySetPath = resolveInputPath(
  args.queryset ??
    args.querySet ??
    privateEnv.RECALLWEAVE_BASELINE_QUERYSET ??
    process.env.RECALLWEAVE_BASELINE_QUERYSET ??
    (fixtureRequested ? "packages/bench/fixtures/hosted-baseline-queryset.fixture.json" : null),
);
const localContainerDir = resolveInputPath(args.containerDir ?? privateEnv.RECALLWEAVE_BASELINE_CONTAINER_DIR ?? process.env.RECALLWEAVE_BASELINE_CONTAINER_DIR ?? null);
const localMapPath = resolveInputPath(args.localMap ?? privateEnv.RECALLWEAVE_BASELINE_LOCAL_MAP ?? process.env.RECALLWEAVE_BASELINE_LOCAL_MAP ?? null);
const privateMapPath = resolveInputPath(args.privateMap ?? privateEnv.RECALLWEAVE_BASELINE_PRIVATE_MAP ?? process.env.RECALLWEAVE_BASELINE_PRIVATE_MAP ?? null);
const memoriesPath = resolveInputPath(
  args.memories ??
    args.memoriesJsonl ??
    privateEnv.RECALLWEAVE_BASELINE_MEMORIES_JSONL ??
    process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ??
    null,
);
const containerTag =
  args.container ??
  args.containerTag ??
  privateEnv.RECALLWEAVE_BASELINE_CONTAINER ??
  process.env.RECALLWEAVE_BASELINE_CONTAINER ??
  null;
const runId =
  args.runId ??
  privateEnv.RECALLWEAVE_BASELINE_RUN_ID ??
  process.env.RECALLWEAVE_BASELINE_RUN_ID ??
  (fixtureRequested ? "fixture-baseline-run" : `recallweave-baseline-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12)}`);
const judgeModel =
  args.judgeModel ??
  privateEnv.RECALLWEAVE_BASELINE_JUDGE_MODEL ??
  process.env.RECALLWEAVE_BASELINE_JUDGE_MODEL ??
  (fixtureRequested ? "fixture-judge" : null);
const answerModel =
  args.answerModel ??
  privateEnv.RECALLWEAVE_BASELINE_ANSWER_MODEL ??
  process.env.RECALLWEAVE_BASELINE_ANSWER_MODEL ??
  (fixtureRequested ? "fixture-answer" : null);
const reviewerApprovalCount = String(args.reviewerApprovalCount ?? process.env.RECALLWEAVE_REVIEWER_APPROVAL_COUNT ?? "0");
const contextTokenBudget = optionalPositiveInt(
  args.contextTokenBudget ??
    privateEnv.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ??
    process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ??
    null,
  "context token budget",
);

assert.ok(querySetPath, "query set is required. Pass --queryset or RECALLWEAVE_BASELINE_QUERYSET");
assert.ok(existsSync(querySetPath), "query set is missing");
assert.ok(statSync(querySetPath).size > 0, "query set is empty");
assertSafeText(readFileSync(querySetPath, "utf8"), "query set");

if (!fixtureRequested) {
  assert.equal(liveRequested, true, "live hosted baseline run requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.equal(process.env.RECALLWEAVE_BASELINE_NO_RAW_TEXT, "1", "set RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 before live collection");
  assert.ok(process.env.SUPERMEMORY_API_KEY, "SUPERMEMORY_API_KEY must be present for live hosted collection");
  assert.ok(containerTag, "RECALLWEAVE_BASELINE_CONTAINER, --container, or --container-env is required for live hosted collection");
  assert.ok(judgeModel, "RECALLWEAVE_BASELINE_JUDGE_MODEL or --judge-model is required for live collection");
  assert.ok(answerModel, "RECALLWEAVE_BASELINE_ANSWER_MODEL or --answer-model is required for live collection");
  assert.ok(localContainerDir || memoriesPath, "live RecallWeave arm requires --container-dir, --memories, or matching env");
  assert.ok(localMapPath, "live baseline run requires --local-map or RECALLWEAVE_BASELINE_LOCAL_MAP for source alignment");
  assert.ok(privateMapPath, "live baseline run requires --private-map or RECALLWEAVE_BASELINE_PRIVATE_MAP for source alignment");
  assert.equal(
    Boolean(args.reviewedQueryset) || process.env.RECALLWEAVE_BASELINE_QUERYSET_REVIEWED === "1",
    true,
    "live baseline run requires --reviewed-queryset or RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1",
  );
}

const baseEnv = {
  ...process.env,
  ...privateEnv,
  RECALLWEAVE_BASELINE_QUERYSET: querySetPath,
  RECALLWEAVE_BASELINE_RUN_ID: runId,
  RECALLWEAVE_BASELINE_JUDGE_MODEL: judgeModel ?? "",
  RECALLWEAVE_BASELINE_ANSWER_MODEL: answerModel ?? "",
  RECALLWEAVE_REVIEWER_APPROVAL_COUNT: reviewerApprovalCount,
};
if (contextTokenBudget) baseEnv.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET = String(contextTokenBudget);
if (!fixtureRequested) {
  baseEnv.RECALLWEAVE_BASELINE_LIVE = "1";
  baseEnv.RECALLWEAVE_BASELINE_NO_RAW_TEXT = "1";
  baseEnv.RECALLWEAVE_BASELINE_CONTAINER = containerTag;
  baseEnv.RECALLWEAVE_BASELINE_QUERYSET_REVIEWED = "1";
}

const steps = [];
const querySetReport = runStep("validate-query-set", ["packages/bench/baseline-queryset-inspect.mjs", "--queryset", querySetPath, "--strict", "--output", paths.querySetReport], baseEnv);
const sourceMatchArgs = [
  "packages/bench/baseline-source-match-preflight.mjs",
  fixtureRequested ? "--fixture" : "--live",
  "--queryset",
  querySetPath,
  "--strict",
  "--output",
  paths.sourceMatch,
];
if (!fixtureRequested && localContainerDir) sourceMatchArgs.push("--container-dir", localContainerDir);
if (!fixtureRequested && memoriesPath) sourceMatchArgs.push("--memories", memoriesPath);
if (!fixtureRequested && preserveIds) sourceMatchArgs.push("--preserve-ids");
const sourceMatch = runStep("preflight-local-source-match", sourceMatchArgs, baseEnv);
const sourceAlignmentArgs = [
  "packages/bench/baseline-source-alignment.mjs",
  "--source-match",
  paths.sourceMatch,
  "--strict",
  "--output",
  paths.sourceAlignment,
];
if (!fixtureRequested && localMapPath) sourceAlignmentArgs.push("--local-map", localMapPath);
if (!fixtureRequested && privateMapPath) sourceAlignmentArgs.push("--private-map", privateMapPath);
const sourceAlignment = runStep("preflight-source-alignment", sourceAlignmentArgs, baseEnv);
const sourceGap = runStep(
  "plan-source-gap",
  [
    "packages/bench/baseline-source-gap-plan.mjs",
    "--source-match",
    paths.sourceMatch,
    "--source-alignment",
    paths.sourceAlignment,
    "--output",
    paths.sourceGap,
  ],
  baseEnv,
);
const hosted = runStep(
  "collect-hosted-baseline",
  [
    "packages/bench/hosted-baseline-collector.mjs",
    fixtureRequested ? "--fixture" : "--live",
    "--queryset",
    querySetPath,
    "--output",
    paths.hosted,
    "--run-id",
    runId,
    "--judge-model",
    judgeModel ?? "",
    "--answer-model",
    answerModel ?? "",
    ...(fixtureRequested ? [] : ["--container", containerTag]),
  ],
  { ...baseEnv, RECALLWEAVE_MATCHED_RUN_PRESENT: "1" },
);
const recallWeaveExportArgs = [
  "packages/bench/recallweave-response-export.mjs",
  fixtureRequested ? "--fixture" : "--live",
  "--queryset",
  querySetPath,
  "--output",
  paths.recallWeaveResponses,
];
if (!fixtureRequested && localContainerDir) recallWeaveExportArgs.push("--container-dir", localContainerDir);
if (!fixtureRequested && memoriesPath) recallWeaveExportArgs.push("--memories", memoriesPath);
if (!fixtureRequested && preserveIds) recallWeaveExportArgs.push("--preserve-ids");
if (contextTokenBudget) recallWeaveExportArgs.push("--context-token-budget", String(contextTokenBudget));
const recallWeaveResponses = runStep("export-recallweave-responses", recallWeaveExportArgs, baseEnv);
const recallWeave = runStep(
  "collect-recallweave-result",
  [
    "packages/bench/recallweave-baseline-collector.mjs",
    fixtureRequested ? "--fixture" : "--live",
    "--queryset",
    querySetPath,
    "--responses",
    paths.recallWeaveResponses,
    "--output",
    paths.recallWeave,
    "--run-id",
    runId,
    "--judge-model",
    judgeModel ?? "",
    "--answer-model",
    answerModel ?? "",
  ],
  { ...baseEnv, RECALLWEAVE_MATCHED_HOSTED_RUN_PRESENT: "1" },
);
const preflight = runStep("validate-hosted-baseline", ["packages/bench/hosted-baseline-preflight.mjs", "--result", paths.hosted, "--output", paths.preflight], baseEnv);
const comparison = runStep(
  "compare-matched-results",
  [
    "packages/bench/baseline-comparison.mjs",
    ...(fixtureRequested ? ["--fixture"] : []),
    "--hosted",
    paths.hosted,
    "--recallweave",
    paths.recallWeave,
    "--output",
    paths.comparison,
  ],
  baseEnv,
);
const nextRun = runStep(
  "plan-next-run",
  [
    "packages/bench/hosted-baseline-next-run.mjs",
    "--hosted",
    paths.hosted,
    "--recallweave",
    paths.recallWeave,
    "--preflight",
    paths.preflight,
    "--comparison",
    paths.comparison,
  ],
  baseEnv,
);
writeFileSync(paths.nextRun, `${JSON.stringify(nextRun.json, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
const packet = runStep(
  "package-baseline-evidence",
  [
    "packages/bench/baseline-evidence-packet.mjs",
    "--hosted",
    paths.hosted,
    "--recallweave",
    paths.recallWeave,
    "--comparison",
    paths.comparison,
    "--preflight",
    paths.preflight,
    ...(fixtureRequested ? [] : ["--strict-real"]),
    "--output",
    paths.packet,
  ],
  baseEnv,
);
const intake = runStep(
  "review-returned-packet",
  [
    "packages/bench/baseline-returned-packet-intake.mjs",
    "--packet",
    paths.packet,
    ...(fixtureRequested ? [] : ["--require-production-baseline"]),
    "--output",
    paths.intake,
  ],
  baseEnv,
);

const output = {
  ok: true,
  mode: "hosted-baseline-run",
  writesRealFiles: true,
  fixtureOnly: fixtureRequested,
  callsHostedProvider: !fixtureRequested,
  metricsOnly: true,
  publicLaunchAllowed: false,
  publicBenchmarkClaimsAllowed: Boolean(comparison.json.publicBenchmarkClaimsAllowed),
  requiresHumanApprovalForPublicClaims: true,
  strictRealAttempted: !fixtureRequested,
  countsAsProductionBaselineEvidence: Boolean(intake.json.countsAsProductionBaselineEvidence),
  countsAsPublicBenchmarkEvidence: Boolean(intake.json.countsAsPublicBenchmarkEvidence),
  status: intake.json.status,
  steps: steps.map((step) => ({
    id: step.id,
    ok: step.ok,
    mode: step.mode,
    writesRealFiles: step.writesRealFiles,
    callsHostedProvider: step.callsHostedProvider,
    metricsOnly: step.metricsOnly,
    output: step.output,
  })),
  outputs: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, basename(value)])),
  evidence: {
    querySet: summarizeQuerySet(querySetReport.json),
    sourceMatch: summarizeSourceMatch(sourceMatch.json),
    sourceAlignment: summarizeSourceAlignment(sourceAlignment.json),
    sourceGap: summarizeSourceGap(sourceGap.json),
    hosted: summarizeResult(hosted.json),
    recallWeaveResponses: summarizeExport(recallWeaveResponses.json),
    recallWeave: summarizeResult(recallWeave.json),
    preflight: {
      countsAsHostedBaselineEvidence: Boolean(preflight.json.countsAsHostedBaselineEvidence),
      publicBenchmarkClaimsAllowed: Boolean(preflight.json.publicBenchmarkClaimsAllowed),
      failedResultChecks: preflight.json.resultInspection?.failedResultChecks ?? [],
    },
    comparison: {
      countsAsComparisonEvidence: Boolean(comparison.json.countsAsComparisonEvidence),
      publicBenchmarkClaimsAllowed: Boolean(comparison.json.publicBenchmarkClaimsAllowed),
      recallWeaveWin: Boolean(comparison.json.recallWeaveWin),
      reviewerApprovalCount: Number(comparison.json.reviewerApprovalCount ?? 0),
      failedChecks: comparison.json.failedChecks ?? [],
    },
    nextRun: {
      status: nextRun.json.status,
      readyForOwnerReview: Boolean(nextRun.json.readyForOwnerReview),
      blockerPreserved: Boolean(nextRun.json.blockerPreserved),
    },
    packet: {
      pathLabel: packet.json.packet?.pathLabel ?? basename(paths.packet),
      sha256: packet.json.packet?.sha256 ?? fileHash(paths.packet),
      entries: packet.json.packet?.entries ?? [],
      packagePassesStrictReal: Boolean(packet.json.packagePassesStrictReal),
    },
    intake: {
      status: intake.json.status,
      countsAsProductionBaselineEvidence: Boolean(intake.json.countsAsProductionBaselineEvidence),
      countsAsPublicBenchmarkEvidence: Boolean(intake.json.countsAsPublicBenchmarkEvidence),
      publicLaunchAllowed: Boolean(intake.json.publicLaunchAllowed),
    },
  },
  liveRequirements: [
    "SUPERMEMORY_API_KEY is set locally",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
    "RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1 or --reviewed-queryset",
    "RECALLWEAVE_BASELINE_CONTAINER is provided through env, --container, or --container-env",
    "local RecallWeave memories are supplied through --container-dir or --memories",
    "local container map is supplied through --local-map or RECALLWEAVE_BASELINE_LOCAL_MAP",
    "private hosted container map is supplied through --private-map or RECALLWEAVE_BASELINE_PRIVATE_MAP",
    "use --preserve-ids or RECALLWEAVE_BASELINE_PRESERVE_IDS=1 when the local arm is a hosted mirror with preserved hosted ids",
    "RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET or --context-token-budget is set for matched local response export",
    "source-gap plan reports READY_FOR_MATCHED_BASELINE before hosted collection",
  ],
  forbidden: [
    "provider keys",
    "raw hosted memories",
    "raw local memories",
    "raw transcripts",
    "raw prompts",
    "raw answers",
    "private local paths",
    "private container maps",
    "private query sets",
  ],
};

const serialized = format === "markdown" ? `${buildMarkdown(output)}\n` : `${JSON.stringify(output, null, 2)}\n`;
assertSafeText(serialized, "hosted baseline run output");
if (outputPath) writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
process.stdout.write(serialized);

function runStep(id, commandArgs, env) {
  const result = spawnSync("node", commandArgs, {
    cwd: root,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assertNoSecrets(result.stdout, `${id} stdout`);
  assertNoSecrets(result.stderr, `${id} stderr`);
  assert.equal(result.status, 0, `${id} failed`);
  const json = JSON.parse(result.stdout);
  const step = {
    id,
    ok: Boolean(json.ok ?? true),
    mode: String(json.mode ?? json.evidenceType ?? json.provider ?? id),
    writesRealFiles: Boolean(json.writesRealFiles ?? commandArgs.includes("--output")),
    callsHostedProvider: Boolean(json.callsHostedProvider ?? (!fixtureRequested && id === "collect-hosted-baseline")),
    metricsOnly: json.metricsOnly === true,
    output: outputLabelFor(id),
    json,
  };
  steps.push(step);
  return step;
}

function outputLabelFor(id) {
  const labels = {
    "validate-query-set": basename(paths.querySetReport),
    "preflight-local-source-match": basename(paths.sourceMatch),
    "preflight-source-alignment": basename(paths.sourceAlignment),
    "plan-source-gap": basename(paths.sourceGap),
    "collect-hosted-baseline": basename(paths.hosted),
    "export-recallweave-responses": basename(paths.recallWeaveResponses),
    "collect-recallweave-result": basename(paths.recallWeave),
    "validate-hosted-baseline": basename(paths.preflight),
    "compare-matched-results": basename(paths.comparison),
    "plan-next-run": basename(paths.nextRun),
    "package-baseline-evidence": basename(paths.packet),
    "review-returned-packet": basename(paths.intake),
  };
  return labels[id] ?? null;
}

function summarizeSourceMatch(json) {
  return {
    sourceMatchReady: Boolean(json.sourceMatchReady),
    queryCount: Number(json.sourceMatchEvidence?.queryCount ?? 0),
    sourceMatchedQueryCount: Number(json.sourceMatchEvidence?.sourceMatchedQueryCount ?? 0),
    collectableQueryCount: Number(json.sourceMatchEvidence?.collectableQueryCount ?? 0),
    failedChecks: json.failedChecks ?? [],
    rawMemoryIncluded: Boolean(json.rawMemoryIncluded),
  };
}

function summarizeSourceAlignment(json) {
  return {
    status: json.status ?? null,
    labelAligned: Boolean(json.labelAlignment?.labelAligned),
    sourceMatchReady: Boolean(json.contentAlignment?.sourceMatchReady),
    matchedBaselineRunAllowed: Boolean(json.benchmarkGate?.matchedBaselineRunAllowed),
    publicBenchmarkClaimsAllowed: Boolean(json.benchmarkGate?.publicBenchmarkClaimsAllowed),
    privateLeakCount: Number(json.privateLeakCount ?? 0),
  };
}

function summarizeSourceGap(json) {
  return {
    status: json.repairPlan?.status ?? null,
    recommendedPath: json.repairPlan?.recommendedPath ?? null,
    baselineRunBlocked: Boolean(json.baselineRunBlocked),
    matchedBaselineRunAllowed: Boolean(json.benchmarkGate?.matchedBaselineRunAllowed),
    publicBenchmarkClaimsAllowed: Boolean(json.benchmarkGate?.publicBenchmarkClaimsAllowed),
  };
}

function summarizeQuerySet(json) {
  return {
    publicBenchmarkReady: Boolean(json.querySetEvidence?.publicBenchmarkReady),
    queryCount: Number(json.querySetEvidence?.queryCount ?? 0),
    unlabeledQueryCount: Number(json.querySetEvidence?.unlabeledQueryCount ?? 0),
    querySetHash: json.source?.querySetHash ?? json.querySetEvidence?.querySetHash ?? null,
  };
}

function summarizeResult(json) {
  return {
    provider: json.provider ?? null,
    fixtureOnly: Boolean(json.fixtureOnly),
    metricsOnly: Boolean(json.metricsOnly),
    evidenceType: json.evidenceType ?? null,
    queryCount: Number(json.queryCount ?? 0),
    querySetHash: json.querySetHash ?? null,
    scoringCodeHash: json.scoringCodeHash ?? null,
    privacyLeakCount: Number(json.privacyLeakCount ?? 0),
    redactionFailureCount: Number(json.redactionFailureCount ?? 0),
    rawMemoryIncluded: Boolean(json.rawMemoryIncluded),
    rawTranscriptIncluded: Boolean(json.rawTranscriptIncluded),
    rawPromptIncluded: Boolean(json.rawPromptIncluded),
    rawAnswerIncluded: Boolean(json.rawAnswerIncluded),
    metrics: json.metrics ?? {},
  };
}

function summarizeExport(json) {
  return {
    evidenceType: json.evidenceType ?? null,
    fixtureOnly: Boolean(json.fixtureOnly),
    metricsOnly: Boolean(json.metricsOnly),
    privacyLeakCount: Number(json.privacyLeakCount ?? 0),
    redactionFailureCount: Number(json.redactionFailureCount ?? 0),
    responseCount: Object.keys(json.responses ?? {}).length,
    skippedFullyPrivate: Number(json.inputStats?.skippedFullyPrivate ?? 0),
    contextBudget: json.contextBudget ?? null,
  };
}

function buildMarkdown(report) {
  return [
    "# RecallWeave Hosted Baseline Run",
    "",
    `Status: ${report.status}.`,
    `Fixture only: ${report.fixtureOnly ? "yes" : "no"}.`,
    `Calls hosted provider: ${report.callsHostedProvider ? "yes" : "no"}.`,
    `Production baseline evidence: ${report.countsAsProductionBaselineEvidence ? "yes" : "no"}.`,
    `Public benchmark evidence: ${report.countsAsPublicBenchmarkEvidence ? "yes" : "no"}.`,
    "Public launch allowed: no.",
    "",
    "Outputs:",
    ...Object.entries(report.outputs).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "Attach only the packet and metrics-only JSON files. Do not attach private query sets, private container maps, provider keys, raw memories, transcripts, prompts, or answers.",
  ].join("\n");
}

function loadPrivateEnv(inputPath) {
  assert.ok(existsSync(inputPath), "container env file is missing");
  assert.ok(statSync(inputPath).size > 0, "container env file is empty");
  const env = {};
  const raw = readFileSync(inputPath, "utf8");
  assert.doesNotMatch(raw, secretPattern, "container env file contains a key-shaped secret");
  for (const line of raw.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice("export ".length).trim();
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, value] = match;
    if (!key.startsWith("RECALLWEAVE_BASELINE_")) continue;
    env[key] = unquote(value);
  }
  return env;
}

function unquote(value) {
  const trimmed = String(value ?? "").trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--fixture") parsed.fixture = true;
    else if (item === "--live") parsed.live = true;
    else if (item === "--reviewed-queryset") parsed.reviewedQueryset = true;
    else if (item.startsWith("--")) {
      parsed[toCamel(item.slice(2))] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return parsed;
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "" || value === false) return null;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function assertSafeText(text, label) {
  assertNoSecrets(text, label);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private local path`);
}

function assertNoSecrets(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
}

function fileHash(inputPath) {
  return createHash("sha256").update(readFileSync(inputPath)).digest("hex");
}
