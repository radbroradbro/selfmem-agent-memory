import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ? resolvePath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolvePath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const resultInput = args.result ?? process.env.RECALLWEAVE_MEMORY_SCORE_RESULT_JSON ?? "";
const reviewInputs = normalizeList([
  ...coerceArray(args.review),
  ...(process.env.RECALLWEAVE_MEMORY_SCORE_REVIEWER_APPROVAL_FILES || "").split(","),
]);
const strictTarget = Boolean(args.strictTarget || args.requireApproval || args.requireApprovals);
const requireApprovals = Number(args.requireApprovals || process.env.RECALLWEAVE_REQUIRE_MEMORY_SCORE_REVIEWER_APPROVALS || 0);
const templateMode = Boolean(args.template);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /^(?:q|question|questions|answer|answers|goldAnswer|candidateAnswer|rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawQuestion|rawQuestions|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|questionText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)$/i;
const allowedFalseFlags =
  /^(?:rawQuestionIdsIncluded|rawQuestionsIncluded|rawAnswersIncluded|rawMemoryIncluded|rawTranscriptIncluded|rawPromptIncluded|rawPrivateOutputPathIncluded|includesRawMemoryText|includesRawTranscriptText|includesRawPromptText|includesRawAnswerText|includesRawQuestionText|rawResponseTextAllowed)$/;
const approvalVerdicts = new Set(["APPROVE_MEMORY_SCORE_EVIDENCE", "APPROVE_FULL_MEMORY_SOTA_PACKET"]);
const requiredAttestations = [
  "metricsOnlyEvidenceReviewed",
  "noRawQuestionText",
  "noRawMemoryText",
  "noRawTranscriptText",
  "noRawPromptText",
  "noRawAnswerText",
  "noCredentials",
  "privacyLeakCountZero",
  "sameDataTargetReviewed",
  "answerQualityHarnessReviewed",
  "strategyCoverageReviewed",
  "componentBenchmarksNotSubstituted",
  "publicLaunchStillBlocked",
  "ownerApprovalStillRequired",
  "uiDocsReleaseNotesStillRequired",
];

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const target = buildTarget(resultInput);

if (templateMode) {
  emit({
    ok: true,
    mode: "memory-score-reviewer-approval-template",
    status: "TEMPLATE_ONLY",
    writesRealFiles: Boolean(outputPath || markdownOutputPath),
    callsProviderApis: false,
    metricsOnly: true,
    publicSafe: true,
    publicLaunchAllowed: false,
    target,
    template: approvalTemplate(target),
  });
  process.exit(0);
}

const reviewResults = reviewInputs.map((input) => evaluateReview(input, target));
const seenReviewerKeys = new Set();
const normalizedReviews = reviewResults.map((review) => {
  const duplicateReviewer = seenReviewerKeys.has(review.reviewerKey);
  seenReviewerKeys.add(review.reviewerKey);
  const failedChecks = duplicateReviewer ? [...review.failedChecks, "independent-reviewer"] : review.failedChecks;
  return {
    ...review,
    duplicateReviewer,
    failedChecks,
    countable: review.countable && !duplicateReviewer,
  };
});
const countableReviews = normalizedReviews.filter((review) => review.countable);
const reviewerApprovalCount = countableReviews.length;
const independentReviewerCount = new Set(countableReviews.map((review) => review.reviewerKey)).size;
const targetBlockers = [
  !target.resultPresent ? "memory-score-result-missing" : null,
  target.fixtureOnly === true ? "fixture-result-cannot-be-reviewed-for-sota" : null,
  target.memoryBenchAnswerQuality !== true ? "memorybench-answer-quality-not-proven" : null,
  target.retrievalProxyOnly !== false ? "retrieval-proxy-result-cannot-be-reviewed-for-sota" : null,
  target.metricsOnly !== true ? "result-not-metrics-only" : null,
  target.publicSafe !== true ? "result-not-public-safe" : null,
].filter(Boolean);
const approvalBlockers = [
  strictTarget && reviewInputs.length === 0 ? "review-artifacts-missing" : null,
  reviewerApprovalCount < 2 ? "two-independent-reviewer-approvals-missing" : null,
  requireApprovals && reviewerApprovalCount < requireApprovals ? "required-reviewer-approval-count-missing" : null,
].filter(Boolean);
const blockers = [...targetBlockers, ...approvalBlockers];

const result = {
  schemaVersion: 1,
  ok: blockers.length === 0 || (!strictTarget && requireApprovals === 0),
  mode: "memory-score-reviewer-approval-intake",
  status: blockers.length === 0 ? "READY_MEMORY_SCORE_REVIEWERS" : "BLOCKED_MEMORY_SCORE_REVIEWERS",
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  metricsOnly: true,
  publicSafe: true,
  publicLaunchAllowed: false,
  publicBenchmarkApprovalReady: blockers.length === 0,
  countsAsFullMemorySotaReview: blockers.length === 0,
  reviewerApprovalCount,
  independentReviewerCount,
  reviewsSubmitted: reviewInputs.length,
  target,
  reviews: normalizedReviews.map((review) => ({
    sourceLabel: review.sourceLabel,
    reviewerKeyHash: shortHash(review.reviewerKey),
    provider: review.provider,
    model: review.model,
    verdict: review.verdict,
    claimScope: review.claimScope,
    targetBound: review.targetBound,
    countable: review.countable,
    duplicateReviewer: review.duplicateReviewer,
    failedChecks: review.failedChecks,
  })),
  blockers,
  safety: {
    acceptsOnlyMetricsOnlyReviewArtifacts: true,
    requiresResultBinding: true,
    requiresTwoIndependentReviewersForClaims: true,
    printsCredentialValues: false,
    includesRawQuestionText: false,
    includesRawMemoryText: false,
    includesRawTranscriptText: false,
    includesRawPromptText: false,
    includesRawAnswerText: false,
  },
  nextActions:
    blockers.length === 0
      ? [
          "Run benchmark:memory-score:result-gate with --reviewer-approval-report pointing to this intake report.",
          "Attach the reviewer-approved gate report to the SOTA ladder packet.",
          "Public launch still remains blocked until owner approval, UI evidence, docs, and release notes are current.",
        ]
      : [
          "Run the live answer-quality harness and pass its metrics-only result to this reviewer intake.",
          "Collect two independent reviewer approval JSON files bound to the exact result hash.",
          "Do not publish SOTA or MemoryBench-style claims until this intake and benchmark:memory-score:result-gate both pass.",
        ],
};

emit(result);
if (requireApprovals && reviewerApprovalCount < requireApprovals) process.exitCode = 1;

function buildTarget(pathLike) {
  const empty = {
    resultPresent: false,
    resultHash: null,
    targetHash: null,
    querySetHash: null,
    materializerHash: null,
    scoringCodeHash: null,
    answerLabelsHash: null,
    answerModel: null,
    judgeModel: null,
    benchmark: null,
    fixtureOnly: null,
    metricsOnly: null,
    publicSafe: null,
    retrievalProxyOnly: null,
    memoryBenchAnswerQuality: null,
    strategyNamesHash: null,
    scoredQueryCount: null,
    hasAnyTarget: false,
  };
  if (!pathLike) return empty;
  const loaded = loadJsonInput(pathLike, "memory score result");
  const json = loaded.json;
  const strategies = normalizeStrategies(json);
  return {
    resultPresent: true,
    resultHash: loaded.sha256,
    targetHash: json.target?.hash ?? json.input?.targetHash ?? null,
    querySetHash: json.input?.querySetHash ?? json.querySetHash ?? null,
    materializerHash: json.input?.materializerHash ?? json.materializerHash ?? null,
    scoringCodeHash: json.input?.scoringCodeHash ?? json.target?.scoringCodeHash ?? json.scoringCodeHash ?? null,
    answerLabelsHash: json.input?.answerLabelsHash ?? json.target?.answerLabelsHash ?? json.answerLabelsHash ?? null,
    answerModel: extractActualAnswerModel(json),
    judgeModel: extractActualJudgeModel(json),
    benchmark: typeof json.benchmark === "string" ? json.benchmark : json.target?.benchmark ?? null,
    fixtureOnly: Boolean(json.fixtureOnly),
    metricsOnly: Boolean(json.metricsOnly),
    publicSafe: Boolean(json.publicSafe),
    retrievalProxyOnly: Boolean(json.retrievalProxyOnly),
    memoryBenchAnswerQuality: Boolean(json.memoryBenchAnswerQuality),
    strategyNamesHash: strategies.length ? `sha256:${sha256(JSON.stringify(strategies.sort()))}` : null,
    scoredQueryCount: Number(json.input?.scoredQueryCount ?? strategies[0]?.scoredQueryCount ?? 0),
    hasAnyTarget: true,
  };
}

function approvalTemplate(targetValue) {
  return {
    schemaVersion: 1,
    mode: "memory-score-reviewer-approval",
    fixtureOnly: false,
    reviewer: {
      id: "<stable-reviewer-id>",
      provider: "<claude|codex|gemini|deepseek|nvidia|other>",
      model: "<model-name>",
    },
    verdict: "APPROVE_MEMORY_SCORE_EVIDENCE",
    countsAsBenchmarkApproval: true,
    claimScope: "source-locked-memory-score",
    publicLaunchAllowed: false,
    target: approvalTargetTemplate(targetValue),
    attestations: Object.fromEntries(requiredAttestations.map((key) => [key, true])),
    blockingConcerns: [],
    nonBlockingConcerns: [
      "Public launch still requires owner approval.",
      "UI evidence, docs, and release notes must reflect the exact reviewed result before release wording changes.",
    ],
  };
}

function approvalTargetTemplate(targetValue) {
  return {
    resultHash: targetValue.resultHash ?? "<sha256:result-json>",
    targetHash: targetValue.targetHash ?? "<sha256:source-locked-target>",
    querySetHash: targetValue.querySetHash ?? "<sha256:query-set>",
    scoringCodeHash: targetValue.scoringCodeHash ?? "<sha256:scoring-code>",
    answerLabelsHash: targetValue.answerLabelsHash ?? "<sha256:answer-labels>",
    answerModel: targetValue.answerModel ?? "<answer-model>",
    judgeModel: targetValue.judgeModel ?? "<judge-model>",
    benchmark: targetValue.benchmark ?? "longmemeval",
    strategyNamesHash: targetValue.strategyNamesHash ?? "<sha256:strategy-names>",
  };
}

function evaluateReview(input, targetValue) {
  const loaded = loadJsonInput(input, "memory score reviewer approval");
  const json = loaded.json;
  assert.deepEqual(findForbiddenKeys(json), [], `${basename(resolvePath(input))} contains forbidden raw-content keys`);

  const reviewer = json.reviewer ?? {};
  const reviewerId = String(reviewer.id ?? json.reviewerId ?? "").trim();
  const provider = String(reviewer.provider ?? json.provider ?? "").trim().toLowerCase();
  const model = String(reviewer.model ?? json.model ?? "").trim();
  const reviewerKey = `${provider || "unknown"}:${model || "unknown"}:${reviewerId || shortHash(loaded.raw)}`;
  const verdict = String(json.verdict ?? "").trim().toUpperCase();
  const claimScope = String(json.claimScope ?? "").trim().toLowerCase();
  const attestations = json.attestations ?? {};
  const missingAttestations = requiredAttestations.filter((key) => attestations[key] !== true);
  const blockingConcerns = Array.isArray(json.blockingConcerns) ? json.blockingConcerns : [];
  const targetBound = targetMatches(json.target ?? {}, targetValue);
  const failedChecks = [
    check("mode", json.mode === "memory-score-reviewer-approval" || json.mode === "recallweave-memory-score-reviewer-approval"),
    check("not-fixture", json.fixtureOnly !== true),
    check("reviewer-id", reviewerId.length > 0),
    check("reviewer-provider", provider.length > 0),
    check("reviewer-model", model.length > 0),
    check("approval-verdict", approvalVerdicts.has(verdict)),
    check("counts-as-benchmark-approval", json.countsAsBenchmarkApproval === true),
    check("source-locked-memory-score-scope", claimScope === "source-locked-memory-score"),
    check("target-bound", targetBound),
    check("required-attestations", missingAttestations.length === 0),
    check("no-blocking-concerns", blockingConcerns.length === 0),
    check("public-launch-still-blocked", json.publicLaunchAllowed !== true && attestations.publicLaunchStillBlocked === true),
  ]
    .filter((item) => !item.ok)
    .map((item) => item.name);
  return {
    sourceLabel: basename(resolvePath(input)),
    reviewerKey,
    provider,
    model,
    verdict,
    claimScope,
    targetBound,
    failedChecks,
    countable: failedChecks.length === 0,
  };
}

function targetMatches(reviewTarget, targetValue) {
  if (!targetValue.hasAnyTarget) return !strictTarget;
  const fields = [
    "resultHash",
    "targetHash",
    "querySetHash",
    "scoringCodeHash",
    "answerLabelsHash",
    "answerModel",
    "judgeModel",
    "benchmark",
    "strategyNamesHash",
  ];
  return fields.every((field) => {
    const expected = targetValue[field];
    if (!expected) return true;
    return String(reviewTarget[field] ?? "") === String(expected);
  });
}

function loadJsonInput(pathLike, label) {
  const inputPath = resolvePath(pathLike);
  assert.ok(existsSync(inputPath), `${label} missing: ${basename(inputPath)}`);
  assert.ok(statSync(inputPath).size > 0, `${label} empty: ${basename(inputPath)}`);
  const raw = readFileSync(inputPath, "utf8");
  assertSafeText(raw, label);
  const json = JSON.parse(raw);
  assert.deepEqual(findForbiddenKeys(json), [], `${label} contains forbidden raw-content keys`);
  const normalizedRaw = `${JSON.stringify(json, null, 2)}\n`;
  assertSafeText(normalizedRaw, label);
  return { path: inputPath, raw: normalizedRaw, json, sha256: `sha256:${sha256(raw)}` };
}

function normalizeStrategies(json) {
  const rows = [
    ...(Array.isArray(json?.strategies) ? json.strategies : []),
    ...(Array.isArray(json?.arms) ? json.arms : []),
    ...(Array.isArray(json?.results) ? json.results : []),
  ].filter((item) => item && typeof item === "object");
  return rows.map((row) => String(row.strategy ?? row.armId ?? "")).filter(Boolean);
}

function extractActualAnswerModel(result) {
  return firstString(
    result?.provider?.answerModel,
    result?.input?.answerModel,
    result?.answerModel,
    result?.models?.answerModel,
    result?.model?.answerModel,
  );
}

function extractActualJudgeModel(result) {
  return firstString(
    result?.provider?.judgeModel,
    result?.input?.judgeModel,
    result?.judgeModel,
    result?.models?.judgeModel,
    result?.model?.judgeModel,
  );
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

function findForbiddenKeys(value, path = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, [...path, String(index)]));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    if (forbiddenKeyPattern.test(key) && !(allowedFalseFlags.test(key) && child === false)) return [[...path, key].join(".")];
    return findForbiddenKeys(child, [...path, key]);
  });
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function emit(value) {
  const jsonText = `${JSON.stringify(value, null, 2)}\n`;
  const markdownText = `${renderMarkdown(value)}\n`;
  assertSafeText(jsonText, "memory score reviewer intake report");
  assertSafeText(markdownText, "memory score reviewer intake markdown");
  if (outputPath) writeOutput(outputPath, jsonText);
  if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
  process.stdout.write(format === "markdown" ? markdownText : jsonText);
}

function renderMarkdown(value) {
  return [
    "# Memory Score Reviewer Approval Intake",
    "",
    `- Status: ${value.status}`,
    `- Public benchmark approval ready: ${value.publicBenchmarkApprovalReady}`,
    `- Counts as full memory SOTA review: ${value.countsAsFullMemorySotaReview}`,
    `- Reviewer approvals: ${value.reviewerApprovalCount}`,
    `- Independent reviewers: ${value.independentReviewerCount}`,
    `- Result hash: ${value.target?.resultHash ?? "missing"}`,
    `- Answer model: ${value.target?.answerModel ?? "missing"}`,
    `- Judge model: ${value.target?.judgeModel ?? "missing"}`,
    "",
    "## Blockers",
    ...(value.blockers?.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Reviews",
    ...(value.reviews?.length
      ? value.reviews.map((review) => `- ${review.provider}/${review.model}: countable=${review.countable}, targetBound=${review.targetBound}`)
      : ["- none"]),
    "",
    "## Next Actions",
    ...(value.nextActions ?? []).map((item) => `- ${item}`),
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { review: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (key === "review") parsed.review.push(value);
    else if (parsed[key] == null) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
    if (value !== true) index += 1;
  }
  return parsed;
}

function normalizeList(items) {
  return items.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function coerceArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function resolvePath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function assertSafeText(text, label) {
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortHash(value) {
  return sha256(value).slice(0, 16);
}
