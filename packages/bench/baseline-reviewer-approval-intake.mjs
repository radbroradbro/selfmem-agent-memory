import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ? resolvePath(args.output) : null;
const reviewInputs = normalizeList([
  ...args.review,
  ...(process.env.RECALLWEAVE_REVIEWER_APPROVAL_FILES || "").split(","),
]);
const comparisonInput = args.comparison || process.env.RECALLWEAVE_BASELINE_COMPARISON_JSON || "";
const runInput = args.run || process.env.RECALLWEAVE_BASELINE_RUN_JSON || "";
const packetInput = args.packet || args.packetReport || process.env.RECALLWEAVE_BASELINE_PACKET_JSON || process.env.RECALLWEAVE_BASELINE_PACKET_ZIP || "";
const strictTarget = Boolean(args.strictTarget || args.requireApproval || args.requireApprovals);
const requireApprovals = Number(args.requireApprovals || process.env.RECALLWEAVE_REQUIRE_REVIEWER_APPROVALS || 0);
const templateMode = Boolean(args.template);

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /^(?:rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)$/i;
const approvalVerdicts = new Set(["APPROVE_BENCHMARK_CLAIM", "APPROVE_SOURCE_MATCHED_BASELINE"]);
const requiredAttestations = [
  "metricsOnlyEvidenceReviewed",
  "noRawMemoryText",
  "noRawTranscriptText",
  "noRawPromptText",
  "noRawAnswerText",
  "noCredentials",
  "privacyLeakCountZero",
  "sameHarnessReviewed",
  "sourceMatchedReviewed",
  "contextTokenCaveatReviewed",
  "publicLaunchStillBlocked",
  "ownerApprovalStillRequired",
];

const target = buildTarget({ comparisonInput, runInput, packetInput });

if (templateMode) {
  const template = {
    schemaVersion: 1,
    mode: "baseline-reviewer-approval",
    fixtureOnly: false,
    reviewer: {
      id: "<stable-reviewer-id>",
      provider: "<claude|codex|gemini|deepseek|other>",
      model: "<model-name>",
    },
    verdict: "APPROVE_SOURCE_MATCHED_BASELINE",
    countsAsBenchmarkApproval: true,
    claimScope: "source-matched-canary",
    target: approvalTargetTemplate(target),
    attestations: Object.fromEntries(requiredAttestations.map((key) => [key, true])),
    blockingConcerns: [],
    nonBlockingConcerns: [
      "Public launch still requires owner approval.",
      "Context-token budget should be tuned before marketing claims.",
    ],
  };
  emit({
    ok: true,
    mode: "baseline-reviewer-approval-template",
    writesRealFiles: Boolean(outputPath),
    callsHostedProvider: false,
    metricsOnly: true,
    publicLaunchAllowed: false,
    target,
    template,
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
const failedChecks = [
  check("target-present", target.hasAnyTarget || !strictTarget),
  check("reviews-present", reviewInputs.length > 0 || !strictTarget),
  check("two-independent-approvals", reviewerApprovalCount >= 2),
  check("required-approval-count", requireApprovals ? reviewerApprovalCount >= requireApprovals : true),
].filter((item) => !item.ok).map((item) => item.name);

const result = {
  ok: failedChecks.length === 0 || (!strictTarget && requireApprovals === 0),
  mode: "baseline-reviewer-approval-intake",
  writesRealFiles: Boolean(outputPath),
  callsHostedProvider: false,
  metricsOnly: true,
  publicLaunchAllowed: false,
  publicBenchmarkApprovalReady: reviewerApprovalCount >= 2,
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
  failedChecks,
  safety: {
    printsCredentialValues: false,
    includesRawMemoryText: false,
    includesRawTranscriptText: false,
    includesRawPromptText: false,
    includesRawAnswerText: false,
    acceptsOnlyMetricsOnlyReviewArtifacts: true,
    requiresPacketOrRunBinding: true,
    requiresTwoIndependentReviewersForClaims: true,
  },
  nextActions:
    reviewerApprovalCount >= 2
      ? [
          "Rerun baseline:compare with --reviewer-approval-report pointing to this intake report.",
          "Rebuild the metrics-only baseline packet so publicBenchmarkClaimsAllowed reflects the verified reviewer approvals.",
          "Public launch still remains blocked until owner approval.",
        ]
      : [
          "Collect two independent review artifacts against the same metrics-only packet or run.",
          "Each reviewer must bind to the packet SHA or run/comparison hash and acknowledge the context-token caveat.",
          "Do not publish benchmark comparison claims yet.",
        ],
};

emit(result);
if (requireApprovals && reviewerApprovalCount < requireApprovals) process.exitCode = 1;

function evaluateReview(input, target) {
  const inputPath = resolvePath(input);
  assert.ok(existsSync(inputPath), `review missing: ${basename(inputPath)}`);
  assert.ok(statSync(inputPath).size > 0, `review empty: ${basename(inputPath)}`);
  const raw = readFileSync(inputPath, "utf8");
  assertSafeText(raw, basename(inputPath));
  const json = parseReviewJson(raw, basename(inputPath));
  const normalizedRaw = `${JSON.stringify(json, null, 2)}\n`;
  assertSafeText(normalizedRaw, basename(inputPath));
  assert.deepEqual(findForbiddenKeys(json), [], `${basename(inputPath)} contains forbidden raw-content keys`);

  const reviewer = json.reviewer ?? {};
  const reviewerId = String(reviewer.id ?? json.reviewerId ?? "").trim();
  const provider = String(reviewer.provider ?? json.provider ?? "").trim().toLowerCase();
  const model = String(reviewer.model ?? json.model ?? "").trim();
  const reviewerKey = `${provider || "unknown"}:${model || "unknown"}:${reviewerId || shortHash(normalizedRaw)}`;
  const verdict = String(json.verdict ?? "").trim().toUpperCase();
  const claimScope = String(json.claimScope ?? "").trim().toLowerCase();
  const attestations = json.attestations ?? {};
  const missingAttestations = requiredAttestations.filter((key) => attestations[key] !== true);
  const targetBound = targetMatches(json.target ?? {}, target);
  const blockingConcerns = Array.isArray(json.blockingConcerns) ? json.blockingConcerns : [];
  const failedChecks = [
    check("mode", json.mode === "baseline-reviewer-approval" || json.mode === "recallweave-baseline-reviewer-approval"),
    check("not-fixture", json.fixtureOnly !== true),
    check("reviewer-id", reviewerId.length > 0),
    check("reviewer-provider", provider.length > 0),
    check("reviewer-model", model.length > 0),
    check("approval-verdict", approvalVerdicts.has(verdict)),
    check("counts-as-benchmark-approval", json.countsAsBenchmarkApproval === true),
    check("source-matched-canary-scope", claimScope === "source-matched-canary"),
    check("target-bound", targetBound),
    check("required-attestations", missingAttestations.length === 0),
    check("no-blocking-concerns", blockingConcerns.length === 0),
    check("public-launch-still-blocked", json.publicLaunchAllowed !== true && attestations.publicLaunchStillBlocked === true),
  ].filter((item) => !item.ok).map((item) => item.name);
  return {
    sourceLabel: basename(inputPath),
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

function buildTarget({ comparisonInput, runInput, packetInput }) {
  const target = {
    packetSha256: null,
    runHash: null,
    comparisonHash: null,
    querySetHash: null,
    scoringCodeHash: null,
    sourceCommit: null,
    datasetSlice: null,
    judgeModel: null,
    answerModel: null,
    fixtureOnly: null,
    hasAnyTarget: false,
  };
  if (packetInput) {
    const packet = loadPacket(packetInput);
    target.packetSha256 = packet.packetSha256;
    target.fixtureOnly = target.fixtureOnly ?? packet.fixtureOnly;
  }
  if (runInput) {
    const run = loadJsonInput(runInput, "baseline run");
    assert.equal(run.json.mode, "hosted-baseline-run", "run target must be hosted-baseline-run");
    target.runHash = run.sha256;
    target.querySetHash = target.querySetHash ?? run.json.evidence?.hosted?.querySetHash ?? run.json.evidence?.recallWeave?.querySetHash ?? null;
    target.scoringCodeHash = target.scoringCodeHash ?? run.json.evidence?.hosted?.scoringCodeHash ?? run.json.evidence?.recallWeave?.scoringCodeHash ?? null;
    target.sourceCommit = target.sourceCommit ?? run.json.evidence?.hosted?.sourceCommit ?? run.json.evidence?.recallWeave?.sourceCommit ?? null;
    target.datasetSlice = target.datasetSlice ?? run.json.evidence?.hosted?.datasetSlice ?? run.json.evidence?.recallWeave?.datasetSlice ?? null;
    target.judgeModel = target.judgeModel ?? run.json.evidence?.hosted?.judgeModel ?? run.json.evidence?.recallWeave?.judgeModel ?? null;
    target.answerModel = target.answerModel ?? run.json.evidence?.hosted?.answerModel ?? run.json.evidence?.recallWeave?.answerModel ?? null;
    target.fixtureOnly = target.fixtureOnly ?? Boolean(run.json.fixtureOnly);
  }
  if (comparisonInput) {
    const comparison = loadJsonInput(comparisonInput, "baseline comparison");
    assert.equal(comparison.json.mode, "baseline-comparison", "comparison target must be baseline-comparison");
    target.comparisonHash = comparison.sha256;
    target.querySetHash = target.querySetHash ?? comparison.json.hosted?.querySetHash ?? comparison.json.recallWeave?.querySetHash ?? null;
    target.scoringCodeHash = target.scoringCodeHash ?? comparison.json.hosted?.scoringCodeHash ?? comparison.json.recallWeave?.scoringCodeHash ?? null;
    target.sourceCommit = target.sourceCommit ?? comparison.json.sourceCommit ?? comparison.json.hosted?.sourceCommit ?? comparison.json.recallWeave?.sourceCommit ?? null;
    target.datasetSlice = target.datasetSlice ?? comparison.json.hosted?.datasetSlice ?? comparison.json.recallWeave?.datasetSlice ?? null;
    target.judgeModel = target.judgeModel ?? comparison.json.hosted?.judgeModel ?? comparison.json.recallWeave?.judgeModel ?? null;
    target.answerModel = target.answerModel ?? comparison.json.hosted?.answerModel ?? comparison.json.recallWeave?.answerModel ?? null;
    target.fixtureOnly = target.fixtureOnly ?? Boolean(comparison.json.fixtureOnly);
  }
  target.hasAnyTarget = Boolean(target.packetSha256 || target.runHash || target.comparisonHash || target.querySetHash || target.scoringCodeHash);
  return target;
}

function loadPacket(packetLike) {
  const inputPath = resolvePath(packetLike);
  assert.ok(existsSync(inputPath), `packet target missing: ${basename(inputPath)}`);
  assert.ok(statSync(inputPath).size > 0, `packet target empty: ${basename(inputPath)}`);
  const raw = readFileSync(inputPath);
  const text = raw.toString("utf8");
  if (text.trim().startsWith("{")) {
    assertSafeText(text, basename(inputPath));
    const json = JSON.parse(text);
    assert.equal(json.mode, "baseline-evidence-packet", "packet JSON target must be baseline-evidence-packet");
    return {
      packetSha256: String(json.packet?.sha256 ?? ""),
      fixtureOnly: Boolean(json.fixtureOnly),
    };
  }
  return {
    packetSha256: sha256(raw),
    fixtureOnly: null,
  };
}

function loadJsonInput(pathLike, label) {
  const inputPath = resolvePath(pathLike);
  assert.ok(existsSync(inputPath), `${label} missing: ${basename(inputPath)}`);
  assert.ok(statSync(inputPath).size > 0, `${label} empty: ${basename(inputPath)}`);
  const raw = readFileSync(inputPath, "utf8");
  assertSafeText(raw, basename(inputPath));
  const json = JSON.parse(raw);
  assert.deepEqual(findForbiddenKeys(json), [], `${label} contains forbidden raw-content keys`);
  return { json, sha256: sha256(raw) };
}

function targetMatches(reviewTarget, target) {
  if (!target.hasAnyTarget) return !strictTarget;
  if (target.fixtureOnly === true) return false;
  if (target.packetSha256) return String(reviewTarget.packetSha256 ?? "") === target.packetSha256;
  if (target.runHash) return String(reviewTarget.runHash ?? "") === target.runHash;
  if (target.comparisonHash) return String(reviewTarget.comparisonHash ?? "") === target.comparisonHash;
  const queryMatches = target.querySetHash ? String(reviewTarget.querySetHash ?? "") === target.querySetHash : true;
  const scoringMatches = target.scoringCodeHash ? String(reviewTarget.scoringCodeHash ?? "") === target.scoringCodeHash : true;
  return queryMatches && scoringMatches;
}

function approvalTargetTemplate(target) {
  return {
    packetSha256: target.packetSha256 ?? "<packet-sha256>",
    runHash: target.runHash ?? "<run-json-sha256-if-no-packet>",
    comparisonHash: target.comparisonHash ?? "<comparison-json-sha256-if-no-packet>",
    querySetHash: target.querySetHash ?? "<query-set-hash>",
    scoringCodeHash: target.scoringCodeHash ?? "<scoring-code-hash>",
    sourceCommit: target.sourceCommit ?? "<source-commit>",
    datasetSlice: target.datasetSlice ?? "<dataset-slice>",
    judgeModel: target.judgeModel ?? "<judge-model>",
    answerModel: target.answerModel ?? "<answer-model>",
  };
}

function parseReviewJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    assert.ok(fenced, `${label} must be JSON or contain one fenced JSON block`);
    return JSON.parse(fenced[1]);
  }
}

function parseArgs(argv) {
  const parsed = { review: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--template") parsed.template = true;
    else if (item === "--strict-target") parsed.strictTarget = true;
    else if (item === "--require-approval") parsed.requireApproval = true;
    else if (item === "--require-approvals") {
      parsed.requireApprovals = argv[index + 1] ?? "";
      index += 1;
    } else if (item.startsWith("--")) {
      const key = toCamel(item.slice(2));
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        parsed[key] = true;
      } else {
        if (key === "review") parsed.review.push(next);
        else parsed[key] = next;
        index += 1;
      }
    }
  }
  return parsed;
}

function normalizeList(values) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function assertSafeText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a raw local path`);
}

function findForbiddenKeys(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, `${prefix}[${index}]`));
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const isAllowedRawPresenceFlag = /^(rawMemory|rawTranscript|rawPrompt|rawAnswer)Included$|^includesRaw(Memory|Transcript|Prompt|Answer)Text$/.test(key);
    const self = forbiddenKeyPattern.test(key) && !isAllowedRawPresenceFlag ? [path] : [];
    const unsafeAllowedFlag = isAllowedRawPresenceFlag && Boolean(nested) === true ? [path] : [];
    return [...self, ...unsafeAllowedFlag, ...findForbiddenKeys(nested, path)];
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function shortHash(value) {
  return sha256(String(value)).slice(0, 16);
}

function emit(value) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  assertSafeText(serialized, "reviewer approval intake output");
  if (outputPath) writeFileSync(resolvePath(outputPath), serialized, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(serialized);
}
