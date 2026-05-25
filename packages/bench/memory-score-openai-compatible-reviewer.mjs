import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ? resolvePath(args.output) : null;
const dryRun = Boolean(args.dryRun || args.template || args.printPrompt);
const provider = String(args.provider || process.env.RECALLWEAVE_REVIEW_OPENAI_PROVIDER || "deepseek").trim();
const model = String(args.model || process.env.RECALLWEAVE_REVIEW_OPENAI_MODEL || defaultModel(provider)).trim();
const baseUrl = String(args.baseUrl || process.env.RECALLWEAVE_REVIEW_OPENAI_BASE_URL || defaultBaseUrl(provider)).trim();
const reviewerId = String(args.reviewerId || process.env.RECALLWEAVE_REVIEWER_ID || `${provider}-${shortHash(model)}`).trim();
const maxTokens = Number(args.maxTokens || process.env.RECALLWEAVE_REVIEW_OPENAI_MAX_TOKENS || 2400);
const temperature = Number(args.temperature || process.env.RECALLWEAVE_REVIEW_OPENAI_TEMPERATURE || 0);
const thinkingEnabled = Boolean(args.thinking || process.env.RECALLWEAVE_REVIEW_OPENAI_THINKING === "1");
const reasoningEffort = String(args.reasoningEffort || process.env.RECALLWEAVE_REVIEW_OPENAI_REASONING_EFFORT || "").trim();
const resultInput =
  args.result || process.env.RECALLWEAVE_MEMORY_SCORE_RESULT_JSON || "reviews/overnight-20260522/end-to-end-memory-score-combined-20260525.json";
const gateInput = args.gate || process.env.RECALLWEAVE_MEMORY_SCORE_GATE_JSON || "reviews/overnight-20260522/end-to-end-memory-score-gate-20260525.json";
const sotaInput = args.sota || process.env.RECALLWEAVE_SOTA_LADDER_JSON || "reviews/overnight-20260522/sota-ladder-report-20260525.json";
const voyageBlockerInput =
  args.voyageBlocker || process.env.RECALLWEAVE_VOYAGE_BLOCKER_JSON || "reviews/overnight-20260522/voyage-provider-rate-limit-20260525.json";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /^(?:q|question|questions|answer|answers|goldAnswer|candidateAnswer|rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawQuestion|rawQuestions|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|questionText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)$/i;
const allowedFalseFlags =
  /^(?:rawQuestionIdsIncluded|rawQuestionsIncluded|rawAnswersIncluded|rawMemoryIncluded|rawTranscriptIncluded|rawPromptIncluded|rawPrivateOutputPathIncluded|includesRawMemoryText|includesRawTranscriptText|includesRawPromptText|includesRawAnswerText|includesRawQuestionText|rawResponseTextAllowed)$/;
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

const loadedResult = loadJsonInput(resultInput, "memory score result");
const target = buildTarget(loadedResult);
assert.ok(target.hasAnyTarget, "reviewer needs --result evidence");
const evidence = buildEvidenceSummary({ loadedResult, gateInput, sotaInput, voyageBlockerInput, target });
const prompt = buildPrompt({ provider, model, reviewerId, target, evidence });
assertSafeText(prompt, "memory score reviewer prompt");

if (dryRun) {
  const artifact = buildDryRunArtifact({ provider, model, reviewerId, target });
  emitResult({
    ok: true,
    mode: "memory-score-openai-compatible-reviewer",
    dryRun: true,
    writesRealFiles: Boolean(outputPath),
    callsHostedProvider: false,
    callsReviewerProvider: false,
    metricsOnly: true,
    publicLaunchAllowed: false,
    provider,
    model,
    baseUrlLabel: safeUrlLabel(baseUrl),
    apiKeySource: null,
    target,
    prompt: args.printPrompt ? prompt : undefined,
    promptHash: sha256(prompt),
    reviewArtifact: artifact,
  }, artifact);
  process.exit(0);
}

const { apiKey, apiKeySource } = readApiKey(provider);
assert.ok(apiKey, "set RECALLWEAVE_REVIEW_OPENAI_API_KEY or the provider-specific key in the environment");
const response = await callOpenAiCompatibleReviewer({
  apiKey,
  baseUrl,
  model,
  prompt,
  maxTokens,
  temperature,
  thinkingEnabled,
  reasoningEffort,
});
const artifact = normalizeReviewerArtifact({
  rawContent: response.content,
  provider,
  model,
  reviewerId,
  target,
});
emitResult({
  ok: true,
  mode: "memory-score-openai-compatible-reviewer",
  dryRun: false,
  writesRealFiles: Boolean(outputPath),
  callsHostedProvider: false,
  callsReviewerProvider: true,
  metricsOnly: true,
  publicLaunchAllowed: false,
  provider,
  model,
  baseUrlLabel: safeUrlLabel(baseUrl),
  apiKeySource,
  target,
  promptHash: sha256(prompt),
  usage: response.usage,
  finishReason: response.finishReason,
  reviewArtifact: artifact,
});

async function callOpenAiCompatibleReviewer({
  apiKey,
  baseUrl,
  model,
  prompt,
  maxTokens,
  temperature,
  thinkingEnabled,
  reasoningEffort,
}) {
  const body = {
    model,
    messages: [
      {
        role: "system",
        content: "You are an adversarial memory benchmark reviewer. Return only one JSON object. Do not include markdown.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };
  if (thinkingEnabled) body.thinking = { type: "enabled" };
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;

  const response = await fetch(chatCompletionsUrl(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  assertSafeText(text, "review provider response");
  assert.ok(response.ok, `review provider failed with HTTP ${response.status}: ${safeHttpError(text)}`);
  const json = JSON.parse(text);
  const content = String(json.choices?.[0]?.message?.content ?? "").trim();
  assert.ok(content, "review provider returned empty content");
  assertSafeText(content, "review provider content");
  return {
    content,
    finishReason: json.choices?.[0]?.finish_reason ?? null,
    usage: sanitizeUsage(json.usage ?? null),
  };
}

function buildPrompt({ provider, model, reviewerId, target, evidence }) {
  const template = {
    schemaVersion: 1,
    mode: "memory-score-reviewer-approval",
    fixtureOnly: false,
    reviewer: { id: reviewerId, provider, model },
    verdict: "APPROVE_MEMORY_SCORE_EVIDENCE",
    countsAsBenchmarkApproval: true,
    claimScope: "source-locked-memory-score",
    publicLaunchAllowed: false,
    target: approvalTarget(target),
    attestations: Object.fromEntries(requiredAttestations.map((key) => [key, true])),
    blockingConcerns: [],
    nonBlockingConcerns: [
      "Public launch still requires owner approval.",
      "Full SOTA replacement wording remains blocked until the missing provider arms, UI/docs/release-note updates, and owner approval pass.",
    ],
  };
  return [
    "Review this RecallWeave source-locked memory-score packet.",
    "",
    "Your task:",
    "1. Inspect only the metrics-only evidence below.",
    "2. Approve only the limited memory-score evidence if it is public-safe, source-locked, same-data, and answer-quality based.",
    "3. Do not approve broad SOTA, production replacement, or public launch claims.",
    "4. Missing Voyage, missing owner approval, missing UI/docs/release-note updates, or production rollout gaps should remain explicit concerns, but they do not automatically block approval of this limited memory-score evidence if the reviewed result itself is sound.",
    "5. Reject the evidence if raw question text, raw answers, raw memory text, raw transcripts, credentials, private paths, source mismatch, retrieval-proxy substitution, or component-benchmark substitution appears.",
    "6. Return one JSON object matching the schema. No markdown.",
    "",
    "Approval JSON schema and target:",
    JSON.stringify(template, null, 2),
    "",
    "Required attestations:",
    JSON.stringify(requiredAttestations, null, 2),
    "",
    "Metrics-only evidence:",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

function buildEvidenceSummary({ loadedResult, gateInput, sotaInput, voyageBlockerInput, target }) {
  const result = loadedResult.json;
  return {
    schemaVersion: 1,
    mode: "memory-score-openai-compatible-reviewer-evidence",
    metricsOnly: true,
    rawContentIncluded: false,
    credentialsIncluded: false,
    privatePathsIncluded: false,
    publicLaunchAllowed: false,
    target,
    result: summarizeMemoryScoreResult(result, loadedResult.sha256),
    gate: optionalJsonSummary(gateInput, summarizeGate),
    sotaLadder: optionalJsonSummary(sotaInput, summarizeSotaLadder),
    voyageProviderRateLimit: optionalJsonSummary(voyageBlockerInput, summarizeVoyageRateLimit),
  };
}

function summarizeMemoryScoreResult(json, resultHash) {
  return {
    mode: json.mode,
    combineMode: json.combineMode ?? null,
    resultHash,
    fixtureOnly: Boolean(json.fixtureOnly),
    benchmark: json.benchmark ?? json.target?.benchmark ?? null,
    metricsOnly: json.metricsOnly === true,
    publicSafe: json.publicSafe === true,
    retrievalProxyOnly: json.retrievalProxyOnly === true,
    memoryBenchAnswerQuality: json.memoryBenchAnswerQuality === true,
    readyForEndToEndMemoryScoreGate: json.readyForEndToEndMemoryScoreGate === true,
    publicBenchmarkClaimsAllowed: json.publicBenchmarkClaimsAllowed === true,
    provider: {
      answerModel: json.provider?.answerModel ?? null,
      judgeModel: json.provider?.judgeModel ?? null,
      callsMade: Number(json.provider?.callsMade ?? 0),
      publicDataConfirmed: json.provider?.publicDataConfirmed === true,
    },
    hashes: {
      targetHash: targetFromResult(json).targetHash,
      querySetHash: targetFromResult(json).querySetHash,
      materializerHash: targetFromResult(json).materializerHash,
      scoringCodeHash: targetFromResult(json).scoringCodeHash,
      answerLabelsHash: targetFromResult(json).answerLabelsHash,
      strategyNamesHash: targetFromResult(json).strategyNamesHash,
    },
    scoredQueryCount: targetFromResult(json).scoredQueryCount,
    winner: json.winner ?? null,
    strategies: normalizeStrategies(json).map((row) => ({
      strategy: row.strategy,
      metrics: {
        answerQuality: row.metrics?.answerQuality ?? null,
        judgeCorrectRate: row.metrics?.judgeCorrectRate ?? null,
        answerLatencyP50Ms: row.metrics?.answerLatencyP50Ms ?? null,
        scoredQueryCount: row.metrics?.scoredQueryCount ?? null,
      },
    })),
    privacy: {
      privacyLeakCount: Number(json.privacyLeakCount ?? 0),
      redactionFailureCount: Number(json.redactionFailureCount ?? 0),
      rawQuestionsIncluded: json.rawQuestionsIncluded === true,
      rawAnswersIncluded: json.rawAnswersIncluded === true,
      rawMemoryIncluded: json.rawMemoryIncluded === true,
      rawTranscriptIncluded: json.rawTranscriptIncluded === true,
      rawPromptIncluded: json.rawPromptIncluded === true,
    },
  };
}

function summarizeGate(json) {
  return {
    mode: json.mode,
    status: json.status,
    countsAsEndToEndMemoryBenchmark: json.countsAsEndToEndMemoryBenchmark === true,
    countsAsFullMemorySotaEvidence: json.countsAsFullMemorySotaEvidence === true,
    publicBenchmarkClaimsAllowed: json.publicBenchmarkClaimsAllowed === true,
    result: {
      answerQualityMetric: json.result?.answerQualityMetric ?? null,
      arms: json.result?.arms ?? [],
    },
    reviewerApproval: json.reviewerApproval ?? null,
    blockers: json.blockers ?? [],
  };
}

function summarizeSotaLadder(json) {
  return {
    mode: json.mode,
    status: json.status,
    publicBenchmarkClaimsAllowed: json.publicBenchmarkClaimsAllowed === true,
    componentBenchmarksAreModelSelectionOnly: json.componentBenchmarksAreModelSelectionOnly === true,
    mtebCanSelectModelsButCannotProveMemoryQuality: json.mtebCanSelectModelsButCannotProveMemoryQuality === true,
    bestObservedRows: (json.bestObservedRows ?? []).slice(0, 8).map((row) => ({
      strategy: row.strategy,
      quality: row.quality ?? null,
      answerQuality: row.answerQuality ?? null,
      memoryBenchAnswerQuality: row.memoryBenchAnswerQuality === true,
      retrievalProxyOnly: row.retrievalProxyOnly === true,
      publicBenchmarkClaimsAllowed: row.publicBenchmarkClaimsAllowed === true,
    })),
    blockers: json.blockers ?? [],
  };
}

function summarizeVoyageRateLimit(json) {
  return {
    mode: json.mode,
    status: json.status,
    provider: json.provider ?? "voyage",
    httpStatus: json.httpStatus ?? null,
    attemptedStrategies: json.attemptedStrategies ?? [],
    impact: json.impact ?? [],
  };
}

function optionalJsonSummary(pathLike, summarizer) {
  if (!pathLike) return null;
  const path = resolvePath(pathLike);
  if (!existsSync(path)) return null;
  const loaded = loadJsonInput(path, basename(path));
  return {
    path: displayPath(path),
    hash: loaded.sha256,
    ...summarizer(loaded.json),
  };
}

function buildTarget(loaded) {
  return {
    ...targetFromResult(loaded.json),
    resultPresent: true,
    resultHash: loaded.sha256,
    hasAnyTarget: true,
  };
}

function targetFromResult(json) {
  const strategies = normalizeStrategies(json).map((row) => String(row.strategy ?? row.armId ?? "")).filter(Boolean);
  return {
    targetHash: json.target?.hash ?? json.input?.targetHash ?? null,
    querySetHash: json.input?.querySetHash ?? json.querySetHash ?? null,
    materializerHash: json.input?.materializerHash ?? json.materializerHash ?? null,
    scoringCodeHash: json.input?.scoringCodeHash ?? json.target?.scoringCodeHash ?? json.scoringCodeHash ?? null,
    answerLabelsHash: json.input?.answerLabelsHash ?? json.target?.answerLabelsHash ?? json.answerLabelsHash ?? null,
    benchmark: typeof json.benchmark === "string" ? json.benchmark : json.target?.benchmark ?? null,
    fixtureOnly: Boolean(json.fixtureOnly),
    metricsOnly: Boolean(json.metricsOnly),
    publicSafe: Boolean(json.publicSafe),
    retrievalProxyOnly: Boolean(json.retrievalProxyOnly),
    memoryBenchAnswerQuality: Boolean(json.memoryBenchAnswerQuality),
    strategyNamesHash: strategies.length ? `sha256:${sha256(JSON.stringify(strategies.sort()))}` : null,
    scoredQueryCount: Number(json.input?.scoredQueryCount ?? normalizeStrategies(json)[0]?.metrics?.scoredQueryCount ?? 0),
  };
}

function normalizeStrategies(json) {
  return [
    ...(Array.isArray(json?.strategies) ? json.strategies : []),
    ...(Array.isArray(json?.arms) ? json.arms : []),
    ...(Array.isArray(json?.results) ? json.results : []),
  ].filter((item) => item && typeof item === "object");
}

function normalizeReviewerArtifact({ rawContent, provider, model, reviewerId, target }) {
  const parsed = parseReviewJson(rawContent, "review provider content");
  assert.deepEqual(findForbiddenKeys(parsed), [], "review provider content contains forbidden raw-content keys");
  const artifact = {
    schemaVersion: 1,
    mode: parsed.mode ?? "memory-score-reviewer-approval",
    fixtureOnly: parsed.fixtureOnly === true,
    reviewer: {
      id: String(parsed.reviewer?.id ?? parsed.reviewerId ?? reviewerId),
      provider: String(parsed.reviewer?.provider ?? parsed.provider ?? provider),
      model: String(parsed.reviewer?.model ?? parsed.model ?? model),
    },
    verdict: String(parsed.verdict ?? "NEEDS_REVIEW"),
    countsAsBenchmarkApproval: parsed.countsAsBenchmarkApproval === true,
    claimScope: String(parsed.claimScope ?? ""),
    publicLaunchAllowed: parsed.publicLaunchAllowed === true,
    target: parsed.target ?? approvalTarget(target),
    attestations: parsed.attestations ?? {},
    blockingConcerns: Array.isArray(parsed.blockingConcerns) ? parsed.blockingConcerns : ["Reviewer did not provide blockingConcerns as an array."],
    nonBlockingConcerns: Array.isArray(parsed.nonBlockingConcerns) ? parsed.nonBlockingConcerns : [],
  };
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertSafeText(serialized, "review artifact");
  assert.deepEqual(findForbiddenKeys(artifact), [], "review artifact contains forbidden raw-content keys");
  return artifact;
}

function buildDryRunArtifact({ provider, model, reviewerId, target }) {
  return {
    schemaVersion: 1,
    mode: "memory-score-reviewer-approval",
    fixtureOnly: true,
    reviewer: { id: reviewerId, provider, model },
    verdict: "DRY_RUN_NOT_REVIEWED",
    countsAsBenchmarkApproval: false,
    claimScope: "source-locked-memory-score",
    publicLaunchAllowed: false,
    target: approvalTarget(target),
    attestations: Object.fromEntries(requiredAttestations.map((key) => [key, false])),
    blockingConcerns: ["Dry run did not call an external reviewer provider."],
    nonBlockingConcerns: ["Use this only to inspect the sanitized prompt and command wiring."],
  };
}

function approvalTarget(target) {
  return {
    resultHash: target.resultHash,
    targetHash: target.targetHash,
    querySetHash: target.querySetHash,
    scoringCodeHash: target.scoringCodeHash,
    answerLabelsHash: target.answerLabelsHash,
    benchmark: target.benchmark,
    strategyNamesHash: target.strategyNamesHash,
  };
}

function readApiKey(providerName) {
  const normalized = providerName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const lower = providerName.toLowerCase();
  const candidates = [
    "RECALLWEAVE_REVIEW_OPENAI_API_KEY",
    normalized ? `RECALLWEAVE_REVIEW_${normalized}_API_KEY` : "",
    lower === "deepseek" || lower === "deepseek-pro" ? "DEEPSEEK_PRO_API_KEY" : "",
    lower === "deepseek" || lower === "deepseek-flash" ? "DEEPSEEK_FLASH_API_KEY" : "",
    lower === "deepseek" ? "DEEPSEEK_API_KEY" : "",
    lower === "nvidia" ? "NVIDIA_API_KEY" : "",
    lower === "openrouter" ? "OPENROUTER_API_KEY" : "",
    lower === "zai" || lower === "zai-coding" ? "ZAI_API_KEY" : "",
  ].filter(Boolean);
  for (const name of candidates) {
    const value = process.env[name];
    if (value) return { apiKey: value, apiKeySource: name };
  }
  return { apiKey: "", apiKeySource: null };
}

function defaultModel(providerName) {
  const lower = providerName.toLowerCase();
  if (lower === "deepseek" || lower === "deepseek-pro") return "deepseek-v4-pro";
  if (lower === "deepseek-flash") return "deepseek-v4-flash";
  if (lower === "zai" || lower === "zai-coding") return "glm-5.1";
  if (lower === "openrouter") return "deepseek/deepseek-v4-pro";
  return "";
}

function defaultBaseUrl(providerName) {
  const lower = providerName.toLowerCase();
  if (lower === "deepseek" || lower === "deepseek-pro") return process.env.DEEPSEEK_PRO_BASE_URL || "https://api.deepseek.com";
  if (lower === "deepseek-flash") return process.env.DEEPSEEK_FLASH_BASE_URL || "https://api.deepseek.com";
  if (lower === "nvidia") return process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
  if (lower === "openrouter") return "https://openrouter.ai/api/v1";
  if (lower === "zai" || lower === "zai-coding") return process.env.ZAI_BASE_URL || process.env.ZAI_OPENAI_URL || "";
  return "";
}

function chatCompletionsUrl(baseUrl) {
  assert.ok(baseUrl, "set RECALLWEAVE_REVIEW_OPENAI_BASE_URL for this provider");
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function safeUrlLabel(value) {
  if (!value) return null;
  const url = new URL(chatCompletionsUrl(value));
  return `${url.protocol}//${url.host}${url.pathname}`;
}

function sanitizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  return {
    promptTokens: Number(usage.prompt_tokens ?? 0),
    completionTokens: Number(usage.completion_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? 0),
  };
}

function safeHttpError(text) {
  try {
    const json = JSON.parse(text);
    return JSON.stringify({
      error: json.error?.message ?? json.message ?? "unknown reviewer provider error",
      type: json.error?.type ?? null,
      code: json.error?.code ?? null,
    });
  } catch {
    return text.slice(0, 240);
  }
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

function loadJsonInput(pathLike, label) {
  const inputPath = resolvePath(pathLike);
  assert.ok(existsSync(inputPath), `${label} missing: ${displayPath(inputPath)}`);
  assert.ok(statSync(inputPath).size > 0, `${label} empty: ${displayPath(inputPath)}`);
  const raw = readFileSync(inputPath, "utf8");
  assertSafeText(raw, label);
  const json = JSON.parse(raw);
  assert.deepEqual(findForbiddenKeys(json), [], `${label} contains forbidden raw-content keys`);
  const normalizedRaw = `${JSON.stringify(json, null, 2)}\n`;
  assertSafeText(normalizedRaw, label);
  return { path: inputPath, raw: normalizedRaw, json, sha256: `sha256:${sha256(raw)}` };
}

function findForbiddenKeys(value, path = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, [...path, String(index)]));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    if (forbiddenKeyPattern.test(key) && !(allowedFalseFlags.test(key) && child === false)) return [[...path, key].join(".")];
    return findForbiddenKeys(child, [...path, key]);
  });
}

function emitResult(result, artifact = result.reviewArtifact) {
  if (outputPath) {
    const artifactSerialized = `${JSON.stringify(artifact, null, 2)}\n`;
    assertSafeText(artifactSerialized, "review artifact output");
    writeFileSync(outputPath, artifactSerialized, { encoding: "utf8", mode: 0o600 });
  }
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  assertSafeText(serialized, "reviewer runner output");
  process.stdout.write(serialized);
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

function resolvePath(value) {
  return isAbsolute(String(value ?? "")) ? String(value) : resolve(root, String(value ?? ""));
}

function displayPath(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : basename(path);
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
