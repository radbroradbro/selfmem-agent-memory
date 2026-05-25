import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const resultPath = args.result ? resolve(root, args.result) : null;
const targetPath = resolve(root, args.target ?? "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const reviewerApprovalReportPath = args.reviewerApprovalReport ?? args.reviewerReport ?? process.env.RECALLWEAVE_MEMORY_SCORE_REVIEWER_APPROVAL_REPORT ?? null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const fixtureProxySmoke = Boolean(args.fixtureProxySmoke);

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
assert.ok(statSync(targetPath).size > 0, `target empty: ${displayPath(targetPath)}`);

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "target");
const target = JSON.parse(targetRaw);
const loaded = loadResult();
const reviewerApproval = loadReviewerApprovalReport();
const report = buildGateReport({ loaded, target, targetRaw, reviewerApproval });
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "end-to-end memory score gate");
assertSafePublicText(markdownText, "end-to-end memory score gate markdown");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_END_TO_END_MEMORY_SCORE") process.exit(1);

function loadResult() {
  if (fixtureProxySmoke) {
    const result = spawnSync(
      "node",
      [
        "packages/bench/public-benchmark-strategy-compare.mjs",
        "--fixture",
        "--strategies",
        "bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(result.status, 0, `fixture strategy compare failed\n${result.stderr}\n${result.stdout}`);
    assertSafePublicText(result.stdout, "fixture retrieval-proxy result");
    return {
      source: "generated-fixture-retrieval-proxy-smoke",
      path: null,
      exists: true,
      json: JSON.parse(result.stdout),
      hash: `sha256:${sha256(result.stdout)}`,
    };
  }
  if (!resultPath || !existsSync(resultPath)) {
    return {
      source: "missing-result",
      path: resultPath ? displayPath(resultPath) : null,
      exists: false,
      json: null,
      hash: null,
    };
  }
  assert.ok(statSync(resultPath).size > 0, `result empty: ${displayPath(resultPath)}`);
  const text = readFileSync(resultPath, "utf8");
  assertSafePublicText(text, displayPath(resultPath));
  return {
    source: "result-file",
    path: displayPath(resultPath),
    exists: true,
    json: JSON.parse(text),
    hash: `sha256:${sha256(text)}`,
  };
}

function loadReviewerApprovalReport() {
  if (!reviewerApprovalReportPath || !existsSync(resolve(root, reviewerApprovalReportPath))) {
    return {
      source: "missing-reviewer-approval-report",
      path: reviewerApprovalReportPath ? displayPath(resolve(root, reviewerApprovalReportPath)) : null,
      exists: false,
      json: null,
      hash: null,
    };
  }
  const path = resolve(root, reviewerApprovalReportPath);
  assert.ok(statSync(path).size > 0, `reviewer approval report empty: ${displayPath(path)}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, displayPath(path));
  const json = JSON.parse(text);
  assert.equal(json.mode, "memory-score-reviewer-approval-intake", "reviewer approval report must be memory-score-reviewer-approval-intake");
  return {
    source: "reviewer-approval-report-file",
    path: displayPath(path),
    exists: true,
    json,
    hash: `sha256:${sha256(text)}`,
  };
}

function buildGateReport({ loaded, target, targetRaw, reviewerApproval }) {
  const result = loaded.json;
  const rows = normalizeRows(result);
  const rowNames = rows.map((item) => item.strategy ?? item.armId).filter(Boolean);
  const answerMetric = bestAnswerMetric(rows, result);
  const reviewerApprovalCount = reviewerApproval.exists ? Number(reviewerApproval.json?.reviewerApprovalCount ?? 0) : 0;
  const targetBenchmark = target.benchmark?.family ?? target.benchmark?.name;
  const targetScoringHash = target.benchmark?.scoringCodeHash ?? null;
  const targetAnswerLabelsHash = target.benchmark?.answerLabelsHash ?? null;
  const targetAnswerModel = target.benchmark?.answerModel ?? null;
  const targetJudgeModel = target.benchmark?.judgeModel ?? null;
  const targetHash = `sha256:${sha256(targetRaw)}`;
  const resultTargetHash = result?.target?.hash ?? result?.input?.targetHash ?? result?.sourceLock?.targetHash ?? null;
  const resultScoringHash = result?.scoringCodeHash ?? result?.input?.scoringCodeHash ?? result?.target?.scoringCodeHash ?? null;
  const resultAnswerLabelsHash = result?.answerLabelsHash ?? result?.input?.answerLabelsHash ?? result?.target?.answerLabelsHash ?? null;
  const resultAnswerModel = extractActualAnswerModel(result);
  const resultJudgeModel = extractActualJudgeModel(result);
  const reviewerTarget = reviewerApproval.json?.target ?? {};
  const reviewerApprovalReportTargetBound =
    reviewerApproval.exists &&
    reviewerTarget.resultHash === loaded.hash &&
    (!resultTargetHash || reviewerTarget.targetHash === resultTargetHash) &&
    (!resultScoringHash || reviewerTarget.scoringCodeHash === resultScoringHash) &&
    (!resultAnswerLabelsHash || reviewerTarget.answerLabelsHash === resultAnswerLabelsHash) &&
    (!resultAnswerModel || reviewerTarget.answerModel === resultAnswerModel) &&
    (!resultJudgeModel || reviewerTarget.judgeModel === resultJudgeModel);
  const checks = {
    resultExists: loaded.exists,
    modeRecognized: [
      "end-to-end-memory-score",
      "memorybench-answer-quality",
      "public-benchmark-answer-quality",
      "public-benchmark-memory-score",
    ].includes(String(result?.mode ?? "")),
    metricsOnly: result?.metricsOnly === true,
    publicSafe: result?.publicSafe === true,
    fixtureOnlyFalse: result?.fixtureOnly === false,
    retrievalProxyOnlyFalse: result?.retrievalProxyOnly === false,
    memoryBenchAnswerQualityTrue: result?.memoryBenchAnswerQuality === true,
    publicClaimsDisabledBeforeReview:
      result?.publicBenchmarkClaimsAllowed === false || (reviewerApprovalCount >= 2 && result?.publicBenchmarkClaimsAllowed === true),
    rawQuestionsExcluded: result?.rawQuestionsIncluded === false,
    rawAnswersExcluded: result?.rawAnswersIncluded === false,
    rawMemoryExcluded: result?.rawMemoryIncluded === false,
    rawTranscriptExcluded: result?.rawTranscriptIncluded === false,
    sourceLockedTarget:
      result?.input?.source === "materialized-source-locked-longmemeval" ||
      result?.sourceLock?.sameDataAttestation === true ||
      result?.target?.sourceLocked === true,
    targetHashMatches: resultTargetHash === targetHash,
    benchmarkMatchesTarget: result?.benchmark === targetBenchmark || result?.benchmark?.family === targetBenchmark || result?.target?.benchmark === targetBenchmark,
    querySetHashPresent: typeof (result?.input?.querySetHash ?? result?.querySetHash) === "string" && String(result?.input?.querySetHash ?? result?.querySetHash).startsWith("sha256:"),
    materializerHashPresent:
      typeof (result?.input?.materializerHash ?? result?.materializerHash) === "string" &&
      String(result?.input?.materializerHash ?? result?.materializerHash).startsWith("sha256:"),
    scoringCodeHashMatches: Boolean(targetScoringHash) && resultScoringHash === targetScoringHash,
    answerLabelsHashMatches: Boolean(targetAnswerLabelsHash) && resultAnswerLabelsHash === targetAnswerLabelsHash,
    answerModelPresent: typeof resultAnswerModel === "string" && resultAnswerModel.length > 0,
    judgeModelPresent: typeof resultJudgeModel === "string" && resultJudgeModel.length > 0,
    answerModelMatchesTarget: Boolean(targetAnswerModel) && resultAnswerModel === targetAnswerModel,
    judgeModelMatchesTarget: Boolean(targetJudgeModel) && resultJudgeModel === targetJudgeModel,
    answerQualityMetricPresent: answerMetric.value != null && Number.isFinite(Number(answerMetric.value)),
    answerQualityMetricInRange: answerMetric.value != null && Number(answerMetric.value) >= 0 && Number(answerMetric.value) <= 100,
    bm25ControlPresent: hasAny(rowNames, ["bm25-lite"]),
    denseControlPresent: hasAny(rowNames, ["dense-proxy", "local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]),
    fullHybridControlPresent: hasAny(rowNames, ["full-hybrid-rerank"]),
    queryExpansionArmPresent: hasAny(rowNames, ["query-expanded-full-hybrid-rerank"]),
    voyageProviderArmPresent: hasAny(rowNames, ["cloud-voyage4-voyage", "cloud-voyage4-voyage-lite-rerank", "cloud-voyage4-lite-voyage-lite"]),
    nvidiaOrGeminiProviderArmPresent: rowNames.some((name) => String(name).startsWith("cloud-nvidia-") || name === "cloud-gemini-voyage-rerank"),
    localAppleArmPresent: hasAny(rowNames, ["local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]),
    localRerankArmPresent: hasAny(rowNames, ["local-apple-qwen3-0_6b-local-rerank", "local-apple-qwen3-4b-local-rerank"]),
    reviewerApprovalReportPresent: reviewerApproval.exists,
    reviewerApprovalReportReady:
      reviewerApproval.json?.publicBenchmarkApprovalReady === true && reviewerApproval.json?.countsAsFullMemorySotaReview === true,
    reviewerApprovalReportTargetBound,
    reviewerApprovalsPresent: reviewerApprovalCount >= 2,
    privacyLeakCountersClear: rows.every((item) => Number(item.privacyLeakCount ?? 0) === 0 && Number(item.redactionFailureCount ?? 0) === 0),
  };

  const blockers = [
    !checks.resultExists ? "missing-end-to-end-memory-score-file" : null,
    !checks.modeRecognized ? "result-not-end-to-end-memory-score-report" : null,
    !checks.metricsOnly ? "result-not-metrics-only" : null,
    !checks.publicSafe ? "result-not-public-safe" : null,
    !checks.fixtureOnlyFalse ? "fixture-result-cannot-count-as-end-to-end-memory-score" : null,
    !checks.retrievalProxyOnlyFalse ? "retrieval-proxy-result-cannot-count-as-answer-quality" : null,
    !checks.memoryBenchAnswerQualityTrue ? "memorybench-answer-quality-not-proven" : null,
    !checks.publicClaimsDisabledBeforeReview ? "public-claims-enabled-without-review" : null,
    !checks.rawQuestionsExcluded ? "raw-questions-included" : null,
    !checks.rawAnswersExcluded ? "raw-answers-included" : null,
    !checks.rawMemoryExcluded ? "raw-memory-included" : null,
    !checks.rawTranscriptExcluded ? "raw-transcript-included" : null,
    !checks.sourceLockedTarget ? "result-not-bound-to-source-locked-target" : null,
    !checks.targetHashMatches ? "target-hash-does-not-match-source-locked-target" : null,
    !checks.benchmarkMatchesTarget ? "benchmark-does-not-match-target" : null,
    !checks.querySetHashPresent ? "missing-query-set-hash" : null,
    !checks.materializerHashPresent ? "missing-materializer-hash" : null,
    !checks.scoringCodeHashMatches ? "scoring-code-hash-does-not-match-target" : null,
    !checks.answerLabelsHashMatches ? "answer-labels-hash-does-not-match-target" : null,
    !checks.answerModelPresent ? "missing-actual-answer-model" : null,
    !checks.judgeModelPresent ? "missing-actual-judge-model" : null,
    !checks.answerModelMatchesTarget ? "answer-model-does-not-match-target" : null,
    !checks.judgeModelMatchesTarget ? "judge-model-does-not-match-target" : null,
    !checks.answerQualityMetricPresent ? "missing-answer-quality-score" : null,
    !checks.answerQualityMetricInRange ? "answer-quality-score-out-of-range" : null,
    !checks.bm25ControlPresent ? "missing-bm25-control" : null,
    !checks.denseControlPresent ? "missing-dense-or-vector-control" : null,
    !checks.fullHybridControlPresent ? "missing-full-hybrid-control" : null,
    !checks.queryExpansionArmPresent ? "missing-query-expansion-arm" : null,
    !checks.voyageProviderArmPresent ? "missing-voyage-provider-arm" : null,
    !checks.nvidiaOrGeminiProviderArmPresent ? "missing-nvidia-or-gemini-provider-arm" : null,
    !checks.localAppleArmPresent ? "missing-local-apple-arm" : null,
    !checks.localRerankArmPresent ? "missing-local-rerank-arm" : null,
    !checks.reviewerApprovalReportPresent ? "missing-memory-score-reviewer-approval-report" : null,
    checks.reviewerApprovalReportPresent && !checks.reviewerApprovalReportReady ? "memory-score-reviewer-approval-report-not-ready" : null,
    checks.reviewerApprovalReportPresent && !checks.reviewerApprovalReportTargetBound ? "memory-score-reviewer-approval-report-not-bound-to-result" : null,
    !checks.reviewerApprovalsPresent ? "missing-two-independent-reviewer-approvals" : null,
    !checks.privacyLeakCountersClear ? "privacy-or-redaction-counter-nonzero" : null,
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    ok: true,
    mode: "end-to-end-memory-score-gate",
    status: blockers.length === 0 ? "READY_END_TO_END_MEMORY_SCORE" : "BLOCKED_END_TO_END_MEMORY_SCORE",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    publicBenchmarkClaimsAllowed: false,
    countsAsEndToEndMemoryBenchmark: blockers.length === 0,
    countsAsFullMemorySotaEvidence: blockers.length === 0,
    reason:
      blockers.length === 0
        ? "Same-data answer-quality result is source-locked, reviewed, and eligible for the full memory SOTA ladder."
        : "Result is missing, retrieval-only, fixture-only, unreviewed, or otherwise insufficient for end-to-end memory quality claims.",
    target: {
      path: displayPath(targetPath),
      hash: targetHash,
      benchmark: targetBenchmark ?? null,
      claimTier: target.claimTier ?? null,
      scoringCodeHash: targetScoringHash,
      answerLabelsHash: targetAnswerLabelsHash,
      answerModel: targetAnswerModel,
      judgeModel: targetJudgeModel,
    },
    result: {
      source: loaded.source,
      path: loaded.path,
      hash: loaded.hash,
      fixtureOnly: Boolean(result?.fixtureOnly),
      mode: result?.mode ?? null,
      benchmark: typeof result?.benchmark === "string" ? result.benchmark : result?.benchmark?.family ?? null,
      targetHash: resultTargetHash,
      querySetHash: result?.input?.querySetHash ?? result?.querySetHash ?? null,
      materializerHash: result?.input?.materializerHash ?? result?.materializerHash ?? null,
      scoringCodeHash: resultScoringHash,
      answerLabelsHash: resultAnswerLabelsHash,
      answerModel: resultAnswerModel,
      judgeModel: resultJudgeModel,
      answerQualityMetric: answerMetric,
      reviewerApprovalCount,
      arms: rowNames,
    },
    reviewerApproval: {
      source: reviewerApproval.source,
      path: reviewerApproval.path,
      hash: reviewerApproval.hash,
      exists: reviewerApproval.exists,
      status: reviewerApproval.json?.status ?? null,
      publicBenchmarkApprovalReady: Boolean(reviewerApproval.json?.publicBenchmarkApprovalReady),
      countsAsFullMemorySotaReview: Boolean(reviewerApproval.json?.countsAsFullMemorySotaReview),
      reviewerApprovalCount,
      independentReviewerCount: Number(reviewerApproval.json?.independentReviewerCount ?? 0),
      targetBound: reviewerApprovalReportTargetBound,
    },
    checks,
    blockers,
    nextActions: blockers.length
      ? [
          "Run the same-data LongMemEval/MemoryBench answer-quality harness, not only the retrieval-proxy strategy comparison.",
          "Include BM25, dense/vector, full-hybrid, live query-expansion, provider challenger, local Apple, and local reranker arms on the exact source-locked target.",
          "Attach only metrics-only public-safe output, then re-run this gate with --require-ready before claiming full-memory SOTA evidence.",
          "Send the exact gate-passing packet to two independent reviewers before owner/public release approval.",
        ]
      : [
          "Attach this gate report to the SOTA ladder packet and reviewer packet.",
          "Update UI evidence, docs, and release notes against the reviewed result before owner approval.",
        ],
  };
}

function normalizeRows(result) {
  if (!result || typeof result !== "object") return [];
  const candidates = [
    ...(Array.isArray(result.strategies) ? result.strategies : []),
    ...(Array.isArray(result.arms) ? result.arms : []),
    ...(Array.isArray(result.results) ? result.results : []),
  ];
  return candidates.filter((item) => item && typeof item === "object");
}

function bestAnswerMetric(rows, result) {
  const direct =
    result?.metrics?.answerQuality ??
    result?.metrics?.memoryScore ??
    result?.metrics?.longmemevalScore ??
    result?.score ??
    result?.answerQualityScore ??
    null;
  if (direct != null) return { name: "result", value: Number(direct) };
  for (const row of rows) {
    const value = row.metrics?.answerQuality ?? row.metrics?.memoryScore ?? row.metrics?.longmemevalScore ?? row.answerQualityScore ?? row.score;
    if (value != null && Number.isFinite(Number(value))) {
      return { name: row.strategy ?? row.armId ?? "row", value: Number(value) };
    }
  }
  return { name: null, value: null };
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

function hasAny(values, wanted) {
  const set = new Set(values);
  return wanted.some((item) => set.has(item));
}

function renderMarkdown(value) {
  return [
    "# End-to-End Memory Score Gate",
    "",
    `- Status: ${value.status}`,
    `- Counts as end-to-end memory benchmark: ${value.countsAsEndToEndMemoryBenchmark}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Target: ${value.target.path}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Result",
    `- Source: ${value.result.source}`,
    `- Fixture only: ${value.result.fixtureOnly}`,
    `- Answer model: ${value.result.answerModel ?? "missing"} (target ${value.target.answerModel ?? "missing"})`,
    `- Judge model: ${value.result.judgeModel ?? "missing"} (target ${value.target.judgeModel ?? "missing"})`,
    `- Answer quality metric: ${value.result.answerQualityMetric.name ?? "missing"}=${value.result.answerQualityMetric.value ?? "missing"}`,
    `- Reviewer approvals: ${value.result.reviewerApprovalCount}`,
    `- Arms: ${value.result.arms.join(", ") || "none"}`,
    "",
    "## Reviewer Approval",
    `- Report exists: ${value.reviewerApproval.exists}`,
    `- Report status: ${value.reviewerApproval.status ?? "missing"}`,
    `- Target bound: ${value.reviewerApproval.targetBound}`,
    `- Independent reviewers: ${value.reviewerApproval.independentReviewerCount}`,
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function displayPath(path) {
  return String(path).replace(root, "").replace(/^\/+/, "") || ".";
}

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
  assert.doesNotMatch(String(text), secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(String(text), privatePathPattern, `${label} contains a private local path`);
}
