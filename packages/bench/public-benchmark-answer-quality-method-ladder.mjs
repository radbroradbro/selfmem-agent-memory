import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.live;
const execute = Boolean(args.execute) || process.env.RECALLWEAVE_ANSWER_QUALITY_METHOD_LADDER_EXECUTE === "1";
const outputPath = args.output ?? process.env.RECALLWEAVE_ANSWER_QUALITY_METHOD_LADDER_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? process.env.RECALLWEAVE_ANSWER_QUALITY_METHOD_LADDER_MARKDOWN ?? null;
const format = String(args.format ?? "json").toLowerCase();
const targetPath = resolveInputPath(
  args.target ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ?? "reviews/overnight-20260522/public-longmemeval-full-run-target.json",
);
const methods = splitList(
  args.methods ??
    process.env.RECALLWEAVE_ANSWER_QUALITY_MEMORY_METHODS ??
    "session-v1,contextual-source-chunk-v1,contextual-index-source-chunk-v1,atomic-memory-v1",
);
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_ANSWER_QUALITY_METHOD_STRATEGIES ?? "bm25-lite,full-hybrid-rerank");
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 5, "limit");
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_MAX_QUERIES ?? 3, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_BASELINE_QUERY_OFFSET ?? 0, "query offset");
const claimScope = String(args.claimScope ?? process.env.RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE ?? "local-full").trim();
const modelMatchPolicy = String(
  args.modelMatchPolicy ?? process.env.RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY ?? (claimScope === "local-full" ? "local-diagnostic-allowed" : "challenger-model-allowed"),
).trim();
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 300_000_000, "max memory bytes");
const continueOnCallError = truthy(args.continueOnCallError ?? process.env.RECALLWEAVE_MEMORYBENCH_CONTINUE_ON_CALL_ERROR ?? "");

const memoryMethods = ["session-v1", "contextual-source-chunk-v1", "contextual-index-source-chunk-v1", "atomic-memory-v1"];
const retrievalStrategies = ["bm25-lite", "full-hybrid-rerank"];
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

if (args.continueOnCallErrorSmoke === true) {
  runContinueOnCallErrorSmoke();
  process.exit(0);
}

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(["full-sota", "local-full", "model-challenger"].includes(claimScope), "--claim-scope must be full-sota, local-full, or model-challenger");
assert.ok(
  ["exact-target-required", "local-diagnostic-allowed", "challenger-model-allowed"].includes(modelMatchPolicy),
  "--model-match-policy must be exact-target-required, local-diagnostic-allowed, or challenger-model-allowed",
);
assert.ok(methods.length >= 2, "answer-quality method ladder needs at least two memory methods");
assert.ok(strategies.length >= 1, "answer-quality method ladder needs at least one retrieval strategy");
for (const method of methods) assert.ok(memoryMethods.includes(method), `unknown memory method: ${method}`);
for (const strategy of strategies) assert.ok(retrievalStrategies.includes(strategy), `unknown answer-quality method-ladder strategy: ${strategy}`);
if (fixtureRequested) assert.equal(queryOffset, 0, "--query-offset is only supported for live answer-quality method ladders");

const runRoot = mkdtempSync(resolve(tmpdir(), "recallweave-aq-method-ladder-"));
const readiness = answerQualityReadiness();
const materializations = [];
const responseArms = [];
const answerQualityReports = [];

for (const method of methods) {
  const methodDir = resolve(runRoot, method);
  mkdirSync(methodDir, { recursive: true, mode: 0o700 });
  const materializerPath = resolve(methodDir, "materialize.json");
  runNode([
    "packages/bench/public-benchmark-materialize-run.mjs",
    fixtureRequested ? "--fixture" : "--live",
    "--memory-method",
    method,
    "--private-output-dir",
    methodDir,
    "--context-token-budget",
    String(contextTokenBudget),
    "--limit",
    String(limit),
    ...(fixtureRequested ? [] : ["--target", targetPath]),
    ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
    ...(queryOffset ? ["--query-offset", String(queryOffset)] : []),
    "--format",
    "json",
    "--output",
    materializerPath,
  ]);
  const materialize = JSON.parse(readFileSync(materializerPath, "utf8"));
  materializations.push(materializationSummary(method, materialize));

  const methodArmSpecs = [];
  for (const strategy of strategies) {
    const responsePath = resolve(methodDir, `${strategy}-responses.json`);
    const commonEnv = {
      RECALLWEAVE_BASELINE_LIVE: "1",
      RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
      SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
      RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
    };
    runNode(
      [
        "packages/bench/recallweave-response-export.mjs",
        "--live",
        "--queryset",
        resolve(methodDir, "longmemeval-queryset.private.json"),
        "--memories",
        resolve(methodDir, "longmemeval-memories.private.jsonl"),
        "--preserve-ids",
        "--strategy",
        strategy,
        "--context-token-budget",
        String(contextTokenBudget),
        "--limit",
        String(limit),
        "--max-memory-bytes",
        String(maxMemoryBytes),
        "--output",
        responsePath,
      ],
      commonEnv,
    );
    const response = JSON.parse(readFileSync(responsePath, "utf8"));
    responseArms.push(responseArmSummary({ method, strategy, response, responsePath }));
    methodArmSpecs.push(`${strategy}=${responsePath}`);
  }

  if (execute) {
    assert.equal(readiness.ready, true, `answer-quality method ladder cannot execute: ${readiness.blockers.join(", ")}`);
    const answerQualityPath = resolve(methodDir, "answer-quality.json");
    runNode(
      answerQualityCommandArgs({
        targetPath,
        methodDir,
        claimScope,
        modelMatchPolicy,
        methodArmSpecs,
        answerQualityPath,
        continueOnCallError,
      }),
      {
        SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
        RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
      },
    );
    const answerQuality = JSON.parse(readFileSync(answerQualityPath, "utf8"));
    answerQualityReports.push(answerQualitySummary({ method, answerQuality, answerQualityPath }));
  }
}

const bestExecuted = [...answerQualityReports].sort(
  (left, right) => Number(right.winner?.answerQuality ?? 0) - Number(left.winner?.answerQuality ?? 0),
)[0] ?? null;
const report = {
  schemaVersion: 1,
  ok: execute ? answerQualityReports.length === methods.length : true,
  mode: "answer-quality-memory-method-ladder",
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  metricsOnly: true,
  retrievalProxyOnly: !execute,
  memoryBenchAnswerQuality: execute,
  publicBenchmarkClaimsAllowed: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsCredentials: false,
  benchmark: "longmemeval",
  fixtureOnly: fixtureRequested,
  executeRequested: execute,
  readyForExecution: readiness.ready,
  readiness,
  claimBoundary: execute
    ? "same-shard answer-quality method diagnostic; not production or SOTA evidence without the normal gates"
    : "answer-quality method-ladder workorder only; response arms are exported but no model-scored answer-quality calls were made",
  claimScope,
  modelMatchPolicy,
  queryShard: {
    startIndex: queryOffset,
    endIndexExclusive: maxQueries ? queryOffset + maxQueries : null,
    requestedLimit: maxQueries,
    sameRawQuerySelectionAcrossMethods: new Set(materializations.map((item) => item.selectedQuestionIdsHash)).size === 1,
    selectedQuestionIdsHash: uniqueOrNull(materializations.map((item) => item.selectedQuestionIdsHash)),
  },
  contextTokenBudget,
  limit,
  continueOnCallError,
  methods,
  strategies,
  materializations,
  responseArms,
  answerQualityReports,
  winner: bestExecuted,
  nextActions: execute
    ? methodComparisonNextActions(bestExecuted)
    : [
        "Start a local OpenAI-compatible answer/judge endpoint or provide an approved cloud endpoint through env-only secrets.",
        "Set RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1, and RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1.",
        "Re-run this command with --execute to score the exported same-shard arms, including atomic-memory-v1 if selected.",
      ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "answer-quality method ladder report");
assertSafePublicText(markdownText, "answer-quality method ladder markdown");
if (outputPath) writeOutput(resolveOutput(outputPath), jsonText);
if (markdownOutputPath) writeOutput(resolveOutput(markdownOutputPath), markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function methodComparisonNextActions(bestExecuted) {
  const method = bestExecuted?.method ?? "the winning memory method";
  const strategy = bestExecuted?.winner?.strategy ?? "the winning retrieval strategy";
  return [
    `Treat ${method} with ${strategy} as the next larger-slice challenger, not as a production default yet.`,
    "Promote only methods that beat session-v1 on the same raw query selection and retain their edge under failure-accounted answer-quality scoring.",
    "Run the standard result gate and reviewer intake before any public benchmark claim.",
  ];
}

function answerQualityReadiness() {
  const baseUrl = String(process.env.RECALLWEAVE_MEMORYBENCH_BASE_URL ?? "").trim();
  const answerModel = String(process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL ?? process.env.RECALLWEAVE_BASELINE_ANSWER_MODEL ?? "").trim();
  const judgeModel = String(process.env.RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL ?? process.env.RECALLWEAVE_BASELINE_JUDGE_MODEL ?? "").trim();
  const endpointIsLocal = isLocalUrl(baseUrl);
  const cloudEndpoint = Boolean(baseUrl) && !endpointIsLocal;
  const blockers = [
    process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS !== "1" ? "answer-quality-call-consent-missing" : null,
    process.env.RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA !== "1" ? "public-data-consent-missing" : null,
    process.env.RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT !== "1" ? "no-raw-output-guard-missing" : null,
    !baseUrl ? "openai-compatible-base-url-missing" : null,
    !answerModel ? "answer-model-missing" : null,
    !judgeModel ? "judge-model-missing" : null,
    modelMatchPolicy === "local-diagnostic-allowed" && baseUrl && !endpointIsLocal ? "local-diagnostic-requires-local-endpoint" : null,
    cloudEndpoint && !process.env.RECALLWEAVE_MEMORYBENCH_API_KEY ? "cloud-api-key-missing" : null,
  ].filter(Boolean);
  return {
    ready: blockers.length === 0,
    blockers,
    callsAllowed: process.env.RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS === "1",
    publicDataConfirmed: process.env.RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA === "1",
    noRawOutputGuard: process.env.RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT === "1",
    baseUrlPresent: Boolean(baseUrl),
    endpointLabel: endpointLabel(baseUrl),
    endpointIsLocal,
    answerModelPresent: Boolean(answerModel),
    judgeModelPresent: Boolean(judgeModel),
    cloudApiKeyPresent: cloudEndpoint ? Boolean(process.env.RECALLWEAVE_MEMORYBENCH_API_KEY) : null,
  };
}

function answerQualityCommandArgs(input) {
  return [
    "packages/bench/public-benchmark-answer-quality.mjs",
    "--live",
    "--target",
    input.targetPath,
    "--queryset",
    resolve(input.methodDir, "longmemeval-queryset.private.json"),
    "--memories",
    resolve(input.methodDir, "longmemeval-memories.private.jsonl"),
    "--answer-labels",
    resolve(input.methodDir, "longmemeval-answer-labels.private.json"),
    "--claim-scope",
    input.claimScope,
    "--model-match-policy",
    input.modelMatchPolicy,
    ...(input.continueOnCallError ? ["--continue-on-call-error"] : []),
    ...input.methodArmSpecs.flatMap((spec) => ["--arm", spec]),
    "--output",
    input.answerQualityPath,
  ];
}

function runContinueOnCallErrorSmoke() {
  const forgiving = answerQualityCommandArgs({
    targetPath: "/tmp/target.json",
    methodDir: "/tmp/method",
    claimScope: "model-challenger",
    modelMatchPolicy: "challenger-model-allowed",
    methodArmSpecs: ["bm25-lite=/tmp/bm25.json", "full-hybrid-rerank=/tmp/hybrid.json"],
    answerQualityPath: "/tmp/answer-quality.json",
    continueOnCallError: true,
  });
  const strict = answerQualityCommandArgs({
    targetPath: "/tmp/target.json",
    methodDir: "/tmp/method",
    claimScope: "model-challenger",
    modelMatchPolicy: "challenger-model-allowed",
    methodArmSpecs: ["bm25-lite=/tmp/bm25.json"],
    answerQualityPath: "/tmp/answer-quality.json",
    continueOnCallError: false,
  });
  assert.equal(forgiving.includes("--continue-on-call-error"), true);
  assert.equal(strict.includes("--continue-on-call-error"), false);
  assert.equal(forgiving.filter((item) => item === "--arm").length, 2);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      mode: "answer-quality-method-ladder-continue-on-call-error-smoke",
      forwardsContinueOnCallError: true,
      leavesStrictModeStrict: true,
    })}\n`,
  );
}

function materializationSummary(method, materialize) {
  return {
    method,
    selectedQuestionIdsHash: materialize.selection?.selectedQuestionIdsHash ?? null,
    queryCount: materialize.selection?.queryCount ?? null,
    haystackSessionCount: materialize.selection?.haystackSessionCount ?? null,
    memoryRecordCount: materialize.selection?.memoryRecordCount ?? null,
    contextualSourceChunkCount: materialize.selection?.contextualSourceChunkCount ?? null,
    contextualIndexMemoryCount: materialize.selection?.contextualIndexMemoryCount ?? null,
    atomicMemoryCount: materialize.selection?.atomicMemoryCount ?? null,
    expectedResultRefCount: materialize.selection?.expectedResultRefCount ?? null,
    querySetHash: materialize.selection?.querySetHash ?? null,
    collectorCompatibleQuerySetHash: materialize.selection?.collectorCompatibleQuerySetHash ?? null,
    memoriesFileHash: materialize.selection?.memoriesFileHash ?? null,
    answerLabelsFileHash: materialize.selection?.answerLabelsFileHash ?? null,
  };
}

function responseArmSummary(input) {
  const resultIds = Object.values(input.response.responses ?? {}).flatMap((response) => (response.results ?? []).map((item) => String(item.id ?? "")));
  return {
    method: input.method,
    strategy: input.strategy,
    responseCount: input.response.queryShard?.responseCount ?? null,
    querySetHash: input.response.querySetHash ?? null,
    responsesHash: `sha256:${fileHash(input.responsePath)}`,
    skippedSourceOnly: input.response.inputStats?.skippedSourceOnly ?? null,
    resultIdMode: resultIds.some((id) => id.includes("#chunk-")) ? "source-chunk-or-mixed" : "session-or-memory",
    provider: {
      strategy: input.response.source?.provider?.strategy ?? null,
      providerCallsMade: input.response.source?.provider?.providerCallsMade ?? null,
      modelArm: input.response.source?.provider?.modelArm ?? null,
    },
  };
}

function answerQualitySummary(input) {
  return {
    method: input.method,
    reportHash: `sha256:${fileHash(input.answerQualityPath)}`,
    readyForEndToEndMemoryScoreGate: input.answerQuality.readyForEndToEndMemoryScoreGate,
    claimScope: input.answerQuality.claimScope,
    modelMatchPolicy: input.answerQuality.scoringPolicy?.modelMatchPolicy ?? null,
    countsAsLocalFullBenchmarkEvidence: input.answerQuality.scoringPolicy?.countsAsLocalFullBenchmarkEvidence ?? false,
    countsAsModelChallengerBenchmarkEvidence: input.answerQuality.scoringPolicy?.countsAsModelChallengerBenchmarkEvidence ?? false,
    callsMade: input.answerQuality.provider?.callsMade ?? null,
    endpointLabel: input.answerQuality.provider?.endpointLabel ?? null,
    winner: input.answerQuality.winner ?? null,
    metrics: input.answerQuality.metrics ?? null,
    strategies: (input.answerQuality.strategies ?? []).map((arm) => ({
      strategy: arm.strategy,
      answerQuality: arm.metrics?.answerQuality ?? null,
      judgeCorrectRate: arm.metrics?.judgeCorrectRate ?? null,
      answerLatencyP50Ms: arm.metrics?.answerLatencyP50Ms ?? null,
      answerFailures: arm.provider?.answerFailures ?? 0,
      judgeFailures: arm.provider?.judgeFailures ?? 0,
      resultFingerprints: Array.isArray(arm.resultFingerprints) ? arm.resultFingerprints : [],
    })),
  };
}

function renderMarkdown(value) {
  const lines = [
    "# Answer-Quality Memory Method Ladder",
    "",
    `- Execute requested: ${value.executeRequested}`,
    `- Ready for execution: ${value.readyForExecution}`,
    `- Claim scope: ${value.claimScope}`,
    `- Model match policy: ${value.modelMatchPolicy}`,
    `- Query shard: ${value.queryShard.startIndex} to ${value.queryShard.endIndexExclusive ?? "end"}`,
    `- Same raw query selection: ${value.queryShard.sameRawQuerySelectionAcrossMethods}`,
    `- Claim boundary: ${value.claimBoundary}`,
    "",
    "## Readiness",
    "",
    `- Endpoint present: ${value.readiness.baseUrlPresent}`,
    `- Endpoint local: ${value.readiness.endpointIsLocal}`,
    `- Answer model present: ${value.readiness.answerModelPresent}`,
    `- Judge model present: ${value.readiness.judgeModelPresent}`,
    `- Blockers: ${value.readiness.blockers.join(", ") || "none"}`,
    "",
    "## Materialization",
    "",
    "| Method | Queries | Sessions | Records | Source chunks | Index records | Atomic records | Expected refs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...value.materializations.map(
      (item) =>
        `| ${item.method} | ${item.queryCount} | ${item.haystackSessionCount} | ${item.memoryRecordCount} | ${item.contextualSourceChunkCount} | ${item.contextualIndexMemoryCount} | ${item.atomicMemoryCount} | ${item.expectedResultRefCount} |`,
    ),
    "",
    "## Response Arms",
    "",
    "| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |",
    "| --- | --- | ---: | ---: | --- | ---: |",
    ...value.responseArms.map(
      (item) =>
        `| ${item.method} | ${item.strategy} | ${item.responseCount} | ${item.skippedSourceOnly} | ${item.resultIdMode} | ${item.provider.providerCallsMade} |`,
    ),
  ];
  if (value.answerQualityReports.length > 0) {
    lines.push("", "## Answer Quality", "", "| Method | Winner | Answer quality | Correct rate | Calls | Answer failures | Judge failures |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |");
    for (const item of value.answerQualityReports) {
      const answerFailures = item.strategies.reduce((sum, strategy) => sum + Number(strategy.answerFailures ?? 0), 0);
      const judgeFailures = item.strategies.reduce((sum, strategy) => sum + Number(strategy.judgeFailures ?? 0), 0);
      lines.push(
        `| ${item.method} | ${item.winner?.strategy ?? "none"} | ${item.winner?.answerQuality ?? "n/a"} | ${item.winner?.judgeCorrectRate ?? "n/a"} | ${item.callsMade} | ${answerFailures} | ${judgeFailures} |`,
      );
    }
  }
  lines.push("", "## Next Actions", "", ...value.nextActions.map((item) => `- ${item}`));
  return lines.join("\n");
}

function runNode(commandArgs, extraEnv = {}) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const message = [result.stderr, result.stdout].filter(Boolean).join("\n").slice(0, 4000);
    throw new Error(`command failed: ${commandArgs[0]} ${message}`);
  }
}

function endpointLabel(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (isLocalUrl(value)) return `${url.protocol}//${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return "unparseable-endpoint";
  }
}

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function assertSafePublicText(value, label) {
  assert.doesNotMatch(value, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(value, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(value, privateTagPattern, `${label} contains private tags`);
}

function writeOutput(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, { encoding: "utf8", mode: 0o600 });
}

function resolveOutput(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueOrNull(values) {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 1 ? unique[0] : null;
}

function fileHash(path) {
  assert.ok(existsSync(path), `hash input missing: ${path}`);
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "") return null;
  return positiveInt(value, label);
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "") return 0;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer`);
  return number;
}

function truthy(value) {
  return value === true || ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}
