import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const format = String(args.format || "json").trim().toLowerCase();
assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const fixtureMode = Boolean(args.fixture) || noEvidenceArgs(args);
const hostedPath = resolveInputPath(
  args.hosted ??
    args.hostedResult ??
    process.env.RECALLWEAVE_HOSTED_BASELINE_RESULT_JSON ??
    (fixtureMode ? "packages/bench/fixtures/hosted-baseline-result.fixture.json" : null),
);
const recallWeavePath = resolveInputPath(
  args.recallweave ??
    args.recallWeave ??
    args.recallweaveResult ??
    process.env.RECALLWEAVE_RESULT_JSON ??
    (fixtureMode ? "packages/bench/fixtures/recallweave-baseline-result.fixture.json" : null),
);
const comparisonPath = resolveInputPath(args.comparison ?? process.env.RECALLWEAVE_BASELINE_COMPARISON_JSON ?? null);
const preflightPath = resolveInputPath(args.preflight ?? process.env.RECALLWEAVE_BASELINE_PREFLIGHT_JSON ?? null);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;

const hosted = hostedPath ? loadResult(hostedPath, "hosted-supermemory") : null;
const recallWeave = recallWeavePath ? loadResult(recallWeavePath, "recallweave") : null;
const preflight = preflightPath ? loadAuxiliaryJson(preflightPath, "hosted-baseline-preflight") : hosted ? buildPreflightFromHosted(hosted) : null;
const comparison = comparisonPath
  ? loadAuxiliaryJson(comparisonPath, "baseline-comparison")
  : hosted && recallWeave
    ? generateComparison(hostedPath, recallWeavePath, fixtureMode)
    : null;

const comparability = comparison?.comparability ?? compareHarness(hosted, recallWeave);
const privacy = combinedPrivacy(hosted, recallWeave, comparison);
const comparisonPublicReady = Boolean(comparison?.publicBenchmarkClaimsAllowed);
const recallWeaveWin = Boolean(comparison?.recallWeaveWin);
const reviewerApprovalCount = Number(comparison?.reviewerApprovalCount ?? preflight?.reviewerApprovalCount ?? 0);
const status = chooseStatus({ hosted, recallWeave, comparison, preflight, privacy, comparability, recallWeaveWin, reviewerApprovalCount });
const blockReasons = blockReasonsFor({ hosted, recallWeave, comparison, preflight, privacy, comparability, recallWeaveWin, reviewerApprovalCount });
const commandPlan = commandsFor(status);

const output = {
  ok: true,
  mode: "hosted-baseline-next-run",
  writesRealFiles: false,
  callsHostedProvider: false,
  metricsOnly: true,
  plannerAuthorizesPublicClaims: false,
  publicLaunchAllowed: false,
  fleetRolloutAllowed: false,
  liveHostedCollectionAllowed: !blockReasons.some((item) => item.severity === "hard-block"),
  comparisonPublicClaimsReady: comparisonPublicReady,
  status,
  recommendedScope: recommendedScope(status),
  evidence: {
    fixtureOnly: Boolean(hosted?.fixtureOnly || recallWeave?.fixtureOnly || comparison?.fixtureOnly || fixtureMode),
    hosted: hosted ? summarizeRun(hosted) : null,
    recallWeave: recallWeave ? summarizeRun(recallWeave) : null,
    preflight: preflight ? summarizePreflight(preflight) : null,
    comparison: comparison ? summarizeComparison(comparison) : null,
  },
  comparability,
  privacy,
  blockReasons,
  commandPlan,
  acceptanceCriteria: acceptanceCriteria(),
  attachOnly: [
    "/tmp/recallweave-hosted-baseline-result.json",
    "/tmp/recallweave-result.json",
    "/tmp/recallweave-baseline-comparison.json",
    "/tmp/recallweave-hosted-baseline-preflight.json",
    "/tmp/recallweave-baseline-evidence-packet.zip",
  ],
  forbidden: [
    "provider keys",
    "raw hosted memories",
    "raw local memories",
    "raw transcripts",
    "raw prompts",
    "raw answers",
    "cookies",
    "bearer tokens",
    "private local paths",
    "unredacted diagnostics",
    "raw RecallWeave response exports that contain memory text",
  ],
};

output.operatorMessage = buildMarkdown(output);
const serialized = format === "markdown" ? `${output.operatorMessage}\n` : `${JSON.stringify(output, null, 2)}\n`;
assertSafeText(serialized, "next-run planner output");
process.stdout.write(serialized);

function loadResult(inputPath, expectedProvider) {
  const json = loadJson(inputPath, `${expectedProvider} result`);
  const provider = String(json.provider ?? json.baselineProvider ?? "");
  assert.equal(provider, expectedProvider, `${expectedProvider} result provider mismatch`);
  return {
    provider,
    fixtureOnly: isFixture(json),
    metricsOnly: json.metricsOnly === true,
    runIdHash: json.runId ? shortHash(String(json.runId)) : null,
    sourceCommit: String(json.sourceCommit ?? json.commit ?? ""),
    datasetSlice: String(json.datasetSlice ?? json.benchmarkSlice ?? json.datasetVersion ?? ""),
    querySetHash: String(json.querySetHash ?? json.queryHash ?? json.questionSetHash ?? ""),
    scoringCodeHash: String(json.scoringCodeHash ?? json.harnessHash ?? json.scoringHash ?? ""),
    judgeModel: String(json.judgeModel ?? ""),
    answerModel: String(json.answerModel ?? ""),
    sameHarness: json.sameHarness === true || json.comparability?.sameHarness === true,
    sameDataset: json.sameDataset === true || json.comparability?.sameDataset === true,
    sameJudge: json.sameJudge === true || json.comparability?.sameJudge === true,
    sameAnswerModel: json.sameAnswerModel === true || json.comparability?.sameAnswerModel === true,
    privacy: {
      privacyLeakCount: Number(json.privacyLeakCount ?? json.privacy?.leakCount ?? 0),
      redactionFailureCount: Number(json.redactionFailureCount ?? json.redactionFailures ?? 0),
      rawMemoryIncluded: Boolean(json.rawMemoryIncluded ?? json.includesRawMemoryText ?? false),
      rawTranscriptIncluded: Boolean(json.rawTranscriptIncluded ?? json.includesRawTranscriptText ?? false),
      rawPromptIncluded: Boolean(json.rawPromptIncluded ?? json.includesRawPromptText ?? false),
      rawAnswerIncluded: Boolean(json.rawAnswerIncluded ?? json.includesRawAnswerText ?? false),
    },
    metrics: normalizeMetrics(json.metrics ?? json),
    cost: {
      ingestUsd: finiteNumberOrNull(json.cost?.ingestUsd ?? json.ingestCostUsd),
      queryUsd: finiteNumberOrNull(json.cost?.queryUsd ?? json.queryCostUsd),
    },
  };
}

function loadAuxiliaryJson(inputPath, expectedMode) {
  const json = loadJson(inputPath, expectedMode);
  assert.equal(json.mode, expectedMode, `${expectedMode} mode mismatch`);
  return json;
}

function loadJson(inputPath, label) {
  assert.ok(existsSync(inputPath), `${label} missing`);
  assert.ok(statSync(inputPath).size > 0, `${label} empty`);
  const raw = readFileSync(inputPath, "utf8");
  assertSafeText(raw, label);
  return JSON.parse(raw);
}

function generateComparison(hostedInput, recallWeaveInput, forceFixture) {
  const command = ["packages/bench/baseline-comparison.mjs", "--hosted", hostedInput, "--recallweave", recallWeaveInput];
  if (forceFixture) command.push("--fixture");
  const run = spawnSync("node", command, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(run.status, 0, `baseline comparison generation failed\n${run.stderr}`);
  const json = JSON.parse(run.stdout);
  assert.equal(json.mode, "baseline-comparison");
  return json;
}

function buildPreflightFromHosted(hostedResult) {
  const checks = [
    resultCheck("not-fixture", !hostedResult.fixtureOnly),
    resultCheck("provider-hosted-supermemory", hostedResult.provider === "hosted-supermemory"),
    resultCheck("metrics-only", hostedResult.metricsOnly),
    resultCheck("privacy-leaks-zero", hostedResult.privacy.privacyLeakCount === 0),
    resultCheck("redaction-failures-zero", hostedResult.privacy.redactionFailureCount === 0),
    resultCheck("no-raw-memory", hostedResult.privacy.rawMemoryIncluded === false),
    resultCheck("no-raw-transcript", hostedResult.privacy.rawTranscriptIncluded === false),
    resultCheck("no-raw-prompt", hostedResult.privacy.rawPromptIncluded === false),
    resultCheck("no-raw-answer", hostedResult.privacy.rawAnswerIncluded === false),
    resultCheck("same-harness", hostedResult.sameHarness),
    resultCheck("same-dataset", hostedResult.sameDataset),
    resultCheck("same-judge", hostedResult.sameJudge),
    resultCheck("same-answer-model", hostedResult.sameAnswerModel),
    resultCheck("run-id", Boolean(hostedResult.runIdHash)),
    resultCheck("source-commit", nonEmpty(hostedResult.sourceCommit)),
    resultCheck("dataset-slice", nonEmpty(hostedResult.datasetSlice)),
    resultCheck("query-set-hash", hashLike(hostedResult.querySetHash)),
    resultCheck("scoring-code-hash", hashLike(hostedResult.scoringCodeHash)),
    resultCheck("cost-latency", hostedResult.cost.ingestUsd != null && hostedResult.cost.queryUsd != null && hostedResult.metrics.latencyP50Ms != null && hostedResult.metrics.latencyP95Ms != null),
    resultCheck("retrieval-or-quality-metric", hostedResult.metrics.quality != null || hostedResult.metrics.pAt1 != null || hostedResult.metrics.recallAt5 != null || hostedResult.metrics.ndcgAt10 != null),
  ];
  const failedResultChecks = checks.filter((item) => !item.ok).map((item) => item.name);
  return {
    mode: "hosted-baseline-preflight",
    metricsOnly: true,
    callsHostedProvider: false,
    countsAsHostedBaselineEvidence: failedResultChecks.length === 0,
    publicBenchmarkClaimsAllowed: false,
    resultInspection: {
      provider: hostedResult.provider,
      fixtureOnly: hostedResult.fixtureOnly,
      metricsOnly: hostedResult.metricsOnly,
      privacyLeakCount: hostedResult.privacy.privacyLeakCount,
      redactionFailureCount: hostedResult.privacy.redactionFailureCount,
      rawMemoryIncluded: hostedResult.privacy.rawMemoryIncluded,
      rawTranscriptIncluded: hostedResult.privacy.rawTranscriptIncluded,
      rawPromptIncluded: hostedResult.privacy.rawPromptIncluded,
      rawAnswerIncluded: hostedResult.privacy.rawAnswerIncluded,
      failedResultChecks,
    },
  };
}

function chooseStatus(input) {
  const { hosted, recallWeave, comparison, preflight, privacy, comparability, recallWeaveWin, reviewerApprovalCount } = input;
  if (!privacyClean(privacy)) return "BLOCKED_PRIVACY";
  if (!hosted) return "NEEDS_HOSTED_BASELINE";
  if (!hosted.metricsOnly) return "BLOCKED_HOSTED_NOT_METRICS_ONLY";
  if (!preflight?.countsAsHostedBaselineEvidence) return hosted.fixtureOnly ? "FIXTURE_PLAN_ONLY" : "NEEDS_VALID_HOSTED_PREFLIGHT";
  if (!recallWeave) return "NEEDS_MATCHED_RECALLWEAVE_RUN";
  if (!recallWeave.metricsOnly) return "BLOCKED_RECALLWEAVE_NOT_METRICS_ONLY";
  if (!comparison) return "NEEDS_MATCHED_COMPARISON";
  if (!Object.values(comparability).every(Boolean)) return "BLOCKED_HARNESS_MISMATCH";
  if (!comparison.countsAsComparisonEvidence) return "NEEDS_STRICT_REAL_COMPARISON";
  if (!recallWeaveWin) return "NEEDS_RESEARCH_ITERATION";
  if (reviewerApprovalCount < 2) return "NEEDS_TWO_REVIEWER_APPROVALS";
  return "READY_FOR_OWNER_REVIEW";
}

function blockReasonsFor(input) {
  const { hosted, recallWeave, comparison, preflight, privacy, comparability, recallWeaveWin, reviewerApprovalCount } = input;
  const reasons = [];
  if (!privacyClean(privacy)) reasons.push({ severity: "hard-block", reason: "One or more result files are not privacy-clean. Do not run or attach comparison evidence." });
  if (!hosted) reasons.push({ severity: "soft-block", reason: "No hosted Supermemory result exists yet. Collect one read-only hosted baseline." });
  if (hosted?.fixtureOnly) reasons.push({ severity: "soft-block", reason: "Hosted result is fixture-only. It validates shape but cannot close the baseline blocker." });
  if (hosted && hosted.metricsOnly !== true) reasons.push({ severity: "hard-block", reason: "Hosted result is not marked metrics-only." });
  if (preflight && preflight.countsAsHostedBaselineEvidence !== true) reasons.push({ severity: "soft-block", reason: "Hosted preflight does not count as strict-real hosted evidence yet." });
  if (!recallWeave) reasons.push({ severity: "soft-block", reason: "No matched RecallWeave result exists yet." });
  if (recallWeave?.fixtureOnly) reasons.push({ severity: "soft-block", reason: "RecallWeave result is fixture-only. It validates shape but cannot support a public comparison." });
  if (recallWeave && recallWeave.metricsOnly !== true) reasons.push({ severity: "hard-block", reason: "RecallWeave result is not marked metrics-only." });
  if (comparability && !Object.values(comparability).every(Boolean)) reasons.push({ severity: "hard-block", reason: "Hosted and RecallWeave runs do not share the same source-locked harness settings." });
  if (comparison && comparison.countsAsComparisonEvidence !== true) reasons.push({ severity: "soft-block", reason: "Comparison does not count as strict-real evidence." });
  if (comparison && !recallWeaveWin) reasons.push({ severity: "research-block", reason: "RecallWeave has not beaten the matched baseline on the available metrics." });
  if (comparison && reviewerApprovalCount < 2) reasons.push({ severity: "review-block", reason: "Two independent reviewer approvals are required before benchmark claims." });
  if (!reasons.length) reasons.push({ severity: "owner-block", reason: "Evidence is ready for owner review. The planner still does not authorize public launch." });
  return reasons;
}

function commandsFor(status) {
  const resultPath = "/tmp/recallweave-hosted-baseline-result.json";
  const recallWeaveResultPath = "/tmp/recallweave-result.json";
  const recallWeaveResponsesPath = "/tmp/recallweave-search-responses.json";
  const comparisonPath = "/tmp/recallweave-baseline-comparison.json";
  const preflightPath = "/tmp/recallweave-hosted-baseline-preflight.json";
  const templatePath = "/tmp/recallweave-hosted-baseline-template.json";
  const querySetPath = "/tmp/recallweave-hosted-baseline-queryset.json";
  const packetPath = "/tmp/recallweave-baseline-evidence-packet.zip";
  const commands = [
    {
      id: "print-template",
      description: "Print the aggregate-only hosted result schema before any live provider call.",
      command: `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template --output ${templatePath}`,
    },
    {
      id: "fixture-shape-check",
      description: "Validate the local parser and gate behavior without using a hosted provider.",
      command: "npm exec --yes pnpm@10.23.0 -- baseline:next-run -- --fixture",
    },
  ];

  if (["NEEDS_HOSTED_BASELINE", "FIXTURE_PLAN_ONLY", "NEEDS_VALID_HOSTED_PREFLIGHT"].includes(status)) {
    commands.push({
      id: "collect-hosted-baseline",
      description: "Run read-only hosted Supermemory search with metrics and hashes only.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        "RECALLWEAVE_BASELINE_CONTAINER=<hosted-container-label>",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        "RECALLWEAVE_BASELINE_RUN_ID=<unique-run-id>",
        "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model>",
        "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model>",
        `npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output ${resultPath}`,
      ].join(" "),
    });
    commands.push({
      id: "validate-hosted-baseline",
      description: "Validate the hosted result before collecting the local arm.",
      command: `npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --result ${resultPath} --output ${preflightPath}`,
    });
  }

  if (["NEEDS_MATCHED_RECALLWEAVE_RUN", "FIXTURE_PLAN_ONLY", "NEEDS_VALID_HOSTED_PREFLIGHT"].includes(status)) {
    commands.push({
      id: "export-recallweave-responses",
      description: "Export the local RecallWeave arm with hashed identifiers, content hashes, scores, timings, and no raw text.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        "RECALLWEAVE_BASELINE_CONTAINER_DIR=<local-recallweave-container-dir>",
        `npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --live --container-dir <local-recallweave-container-dir> --output ${recallWeaveResponsesPath}`,
      ].join(" "),
    });
    commands.push({
      id: "collect-recallweave-result",
      description: "Convert the local response export into the matched RecallWeave aggregate result.",
      command: [
        "RECALLWEAVE_BASELINE_LIVE=1",
        "RECALLWEAVE_BASELINE_NO_RAW_TEXT=1",
        `RECALLWEAVE_BASELINE_QUERYSET=${querySetPath}`,
        `RECALLWEAVE_BASELINE_RESPONSES_JSON=${recallWeaveResponsesPath}`,
        "RECALLWEAVE_BASELINE_RUN_ID=<matched-run-id>",
        "RECALLWEAVE_BASELINE_JUDGE_MODEL=<judge-model>",
        "RECALLWEAVE_BASELINE_ANSWER_MODEL=<answer-model>",
        `npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --live --responses ${recallWeaveResponsesPath} --output ${recallWeaveResultPath}`,
      ].join(" "),
    });
  }

  commands.push(
    {
      id: "compare-matched-results",
      description: "Compare hosted and RecallWeave aggregate result files. This still cannot publish a claim by itself.",
      command: `RECALLWEAVE_REVIEWER_APPROVAL_COUNT=<0-until-reviewed> npm exec --yes pnpm@10.23.0 -- baseline:compare -- --hosted ${resultPath} --recallweave ${recallWeaveResultPath} --output ${comparisonPath}`,
    },
    {
      id: "package-review-evidence",
      description: "Package only aggregate hosted, local, comparison, and preflight files for reviewer intake.",
      command: [
        "npm exec --yes pnpm@10.23.0 -- baseline:packet --",
        `--hosted ${resultPath}`,
        `--recallweave ${recallWeaveResultPath}`,
        `--comparison ${comparisonPath}`,
        `--preflight ${preflightPath}`,
        "--strict-real",
        `--output ${packetPath}`,
      ].join(" "),
    },
  );

  if (["NEEDS_RESEARCH_ITERATION", "BLOCKED_HARNESS_MISMATCH", "BLOCKED_PRIVACY"].includes(status)) {
    commands.push({
      id: "do-not-publish",
      description: "Write a private gap or blocker report. Do not market a comparison score from this state.",
      command: "printf '%s\\n' 'Blocked: write a private gap report and rerun after one reviewed methodology change.'",
    });
  }
  return commands;
}

function recommendedScope(status) {
  if (status.startsWith("BLOCKED")) return "blocked-before-live-baseline";
  if (status === "READY_FOR_OWNER_REVIEW") return "owner-review-not-public-launch";
  if (status === "NEEDS_RESEARCH_ITERATION") return "private-gap-report-and-one-reviewed-methodology-change";
  return "single-source-locked-hosted-vs-recallweave-canary";
}

function acceptanceCriteria() {
  return [
    "hosted and RecallWeave results are non-fixture",
    "both results are metrics-only and privacy-clean",
    "same dataset slice, query-set hash, scoring-code hash, judge model, and answer model",
    "latency, cost, P@1, recall@5, recall@10, NDCG@10, quality, and context-token fields present",
    "RecallWeave beats hosted baseline without any quality metric regressing more than the comparison gate allows",
    "two independent reviewers approve the setup and result before any public comparison language",
    "owner approval remains required for public launch or visibility changes",
  ];
}

function buildMarkdown(plan) {
  const lines = [
    "# RecallWeave Hosted Baseline Next Run",
    "",
    `Status: ${plan.status}`,
    `Scope: ${plan.recommendedScope}`,
    `Public launch allowed: ${plan.publicLaunchAllowed ? "yes" : "no"}`,
    `Planner authorizes public claims: ${plan.plannerAuthorizesPublicClaims ? "yes" : "no"}`,
    "",
    "## Evidence State",
    "",
    `- Hosted: ${plan.evidence.hosted ? runLine(plan.evidence.hosted) : "missing"}`,
    `- RecallWeave: ${plan.evidence.recallWeave ? runLine(plan.evidence.recallWeave) : "missing"}`,
    `- Comparison: ${plan.evidence.comparison ? comparisonLine(plan.evidence.comparison) : "missing"}`,
    "",
    "## Blocks",
    "",
  ];
  for (const reason of plan.blockReasons) lines.push(`- ${reason.severity}: ${reason.reason}`);
  lines.push("", "## Commands", "");
  for (const item of plan.commandPlan) lines.push(`### ${item.id}`, "", item.description, "", "```bash", item.command, "```", "");
  lines.push("## Pass Criteria", "");
  for (const item of plan.acceptanceCriteria) lines.push(`- ${item}`);
  lines.push("", "Attach only aggregate result files, the comparison, preflight, and baseline packet zip. Do not attach raw memories, transcripts, prompts, answers, credentials, private paths, cookies, or unredacted diagnostics.");
  return lines.join("\n");
}

function runLine(run) {
  return `${run.provider}, fixture=${run.fixtureOnly}, metricsOnly=${run.metricsOnly}, privacyLeaks=${run.privacy.privacyLeakCount}, quality=${run.metrics.quality}`;
}

function comparisonLine(comparison) {
  return `win=${comparison.recallWeaveWin}, strictEvidence=${comparison.countsAsComparisonEvidence}, reviewers=${comparison.reviewerApprovalCount}`;
}

function summarizeRun(run) {
  return {
    provider: run.provider,
    fixtureOnly: run.fixtureOnly,
    metricsOnly: run.metricsOnly,
    runIdHash: run.runIdHash,
    sourceCommit: run.sourceCommit,
    datasetSlice: run.datasetSlice,
    querySetHash: run.querySetHash,
    scoringCodeHash: run.scoringCodeHash,
    judgeModel: run.judgeModel,
    answerModel: run.answerModel,
    privacy: run.privacy,
    metrics: run.metrics,
    cost: run.cost,
  };
}

function summarizePreflight(preflight) {
  return {
    mode: preflight.mode,
    fixtureOnly: Boolean(preflight.resultInspection?.fixtureOnly),
    metricsOnly: preflight.metricsOnly === true,
    countsAsHostedBaselineEvidence: Boolean(preflight.countsAsHostedBaselineEvidence),
    publicBenchmarkClaimsAllowed: Boolean(preflight.publicBenchmarkClaimsAllowed),
    failedResultChecks: preflight.resultInspection?.failedResultChecks ?? [],
  };
}

function summarizeComparison(comparison) {
  return {
    mode: comparison.mode,
    fixtureOnly: Boolean(comparison.fixtureOnly),
    metricsOnly: comparison.metricsOnly === true,
    countsAsComparisonEvidence: Boolean(comparison.countsAsComparisonEvidence),
    recallWeaveWin: Boolean(comparison.recallWeaveWin),
    reviewerApprovalCount: Number(comparison.reviewerApprovalCount ?? 0),
    publicBenchmarkClaimsAllowed: Boolean(comparison.publicBenchmarkClaimsAllowed),
    failedChecks: comparison.failedChecks ?? [],
    deltas: comparison.deltas ?? {},
  };
}

function compareHarness(hostedResult, recallWeaveResult) {
  if (!hostedResult || !recallWeaveResult) {
    return {
      sameDataset: false,
      sameQuerySet: false,
      sameScoringCode: false,
      sameJudge: false,
      sameAnswerModel: false,
      sameHarnessFlags: false,
    };
  }
  return {
    sameDataset: hostedResult.datasetSlice === recallWeaveResult.datasetSlice && nonEmpty(hostedResult.datasetSlice),
    sameQuerySet: hostedResult.querySetHash === recallWeaveResult.querySetHash && hashLike(hostedResult.querySetHash),
    sameScoringCode: hostedResult.scoringCodeHash === recallWeaveResult.scoringCodeHash && hashLike(hostedResult.scoringCodeHash),
    sameJudge: hostedResult.judgeModel === recallWeaveResult.judgeModel && nonEmpty(hostedResult.judgeModel),
    sameAnswerModel: hostedResult.answerModel === recallWeaveResult.answerModel && nonEmpty(hostedResult.answerModel),
    sameHarnessFlags:
      hostedResult.sameHarness &&
      recallWeaveResult.sameHarness &&
      hostedResult.sameDataset &&
      recallWeaveResult.sameDataset &&
      hostedResult.sameJudge &&
      recallWeaveResult.sameJudge &&
      hostedResult.sameAnswerModel &&
      recallWeaveResult.sameAnswerModel,
  };
}

function combinedPrivacy(hostedResult, recallWeaveResult, comparisonResult) {
  const comparisonPrivacy = comparisonResult?.privacy ?? {};
  return {
    privacyLeakCount:
      Number(hostedResult?.privacy?.privacyLeakCount ?? 0) +
      Number(recallWeaveResult?.privacy?.privacyLeakCount ?? 0) +
      Number(comparisonPrivacy.privacyLeakCount ?? 0),
    redactionFailureCount:
      Number(hostedResult?.privacy?.redactionFailureCount ?? 0) +
      Number(recallWeaveResult?.privacy?.redactionFailureCount ?? 0) +
      Number(comparisonPrivacy.redactionFailureCount ?? 0),
    rawMemoryIncluded:
      Boolean(hostedResult?.privacy?.rawMemoryIncluded) ||
      Boolean(recallWeaveResult?.privacy?.rawMemoryIncluded) ||
      Boolean(comparisonPrivacy.rawMemoryIncluded),
    rawTranscriptIncluded:
      Boolean(hostedResult?.privacy?.rawTranscriptIncluded) ||
      Boolean(recallWeaveResult?.privacy?.rawTranscriptIncluded) ||
      Boolean(comparisonPrivacy.rawTranscriptIncluded),
    rawPromptIncluded:
      Boolean(hostedResult?.privacy?.rawPromptIncluded) ||
      Boolean(recallWeaveResult?.privacy?.rawPromptIncluded) ||
      Boolean(comparisonPrivacy.rawPromptIncluded),
    rawAnswerIncluded:
      Boolean(hostedResult?.privacy?.rawAnswerIncluded) ||
      Boolean(recallWeaveResult?.privacy?.rawAnswerIncluded) ||
      Boolean(comparisonPrivacy.rawAnswerIncluded),
  };
}

function privacyClean(privacy) {
  return privacy.privacyLeakCount === 0 &&
    privacy.redactionFailureCount === 0 &&
    privacy.rawMemoryIncluded === false &&
    privacy.rawTranscriptIncluded === false &&
    privacy.rawPromptIncluded === false &&
    privacy.rawAnswerIncluded === false;
}

function normalizeMetrics(metrics) {
  return {
    quality: finiteNumberOrNull(metrics.quality ?? metrics.accuracy),
    pAt1: finiteNumberOrNull(metrics.pAt1),
    recallAt5: finiteNumberOrNull(metrics.recallAt5),
    recallAt10: finiteNumberOrNull(metrics.recallAt10),
    ndcgAt10: finiteNumberOrNull(metrics.ndcgAt10),
    latencyP50Ms: finiteNumberOrNull(metrics.latencyP50Ms),
    latencyP95Ms: finiteNumberOrNull(metrics.latencyP95Ms),
    contextTokensAvg: finiteNumberOrNull(metrics.contextTokensAvg),
  };
}

function noEvidenceArgs(parsed) {
  return !parsed.hosted && !parsed.hostedResult && !parsed.recallweave && !parsed.recallWeave && !parsed.recallweaveResult && !parsed.comparison && !parsed.preflight;
}

function isFixture(json) {
  return Boolean(json.fixtureOnly || String(json.evidenceType ?? "").toLowerCase().includes("fixture"));
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hashLike(value) {
  return typeof value === "string" && /^(sha256:)?[A-Za-z0-9_-]{8,}$/.test(value.trim());
}

function resultCheck(name, ok) {
  return { name, ok: Boolean(ok) };
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--fixture") parsed.fixture = true;
    else if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
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

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private local path`);
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
