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
const maxTokens = Number(args.maxTokens || process.env.RECALLWEAVE_REVIEW_OPENAI_MAX_TOKENS || 2200);
const temperature = Number(args.temperature || process.env.RECALLWEAVE_REVIEW_OPENAI_TEMPERATURE || 0);
const thinkingEnabled = Boolean(args.thinking || process.env.RECALLWEAVE_REVIEW_OPENAI_THINKING === "1");
const reasoningEffort = String(args.reasoningEffort || process.env.RECALLWEAVE_REVIEW_OPENAI_REASONING_EFFORT || "").trim();
const comparisonInput = args.comparison || process.env.RECALLWEAVE_BASELINE_COMPARISON_JSON || "";
const runInput = args.run || process.env.RECALLWEAVE_BASELINE_RUN_JSON || "";
const packetInput = args.packet || args.packetReport || process.env.RECALLWEAVE_BASELINE_PACKET_JSON || process.env.RECALLWEAVE_BASELINE_PACKET_ZIP || "";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
const forbiddenKeyPattern =
  /^(?:rawMemory|rawMemories|rawTranscript|rawTranscripts|rawPrompt|rawPrompts|rawAnswer|rawAnswers|memoryText|transcriptText|promptText|answerText|messages|current_entries|memoriesJsonl|rawEventsJsonl|losslessContextJsonl|env|token|apiKey|authorization|cookie)$/i;
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
if (!target.hasAnyTarget && dryRun) Object.assign(target, buildDryRunTarget());
assert.ok(target.hasAnyTarget, "reviewer needs --packet, --comparison, or --run evidence");

const evidence = buildEvidenceSummary({ comparisonInput, runInput, packetInput, target });
const prompt = buildPrompt({ provider, model, reviewerId, target, evidence });
assertSafeText(prompt, "review prompt");

if (dryRun) {
  const artifact = buildDryRunArtifact({ provider, model, reviewerId, target });
  emitResult({
    ok: true,
    mode: "baseline-openai-compatible-reviewer",
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
  mode: "baseline-openai-compatible-reviewer",
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
        content:
          "You are an adversarial benchmark reviewer. Return only one JSON object. Do not include markdown.",
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

  const result = await fetch(chatCompletionsUrl(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await result.text();
  assertSafeText(text, "review provider response");
  assert.ok(result.ok, `review provider failed with HTTP ${result.status}: ${safeHttpError(text)}`);
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
    mode: "baseline-reviewer-approval",
    fixtureOnly: false,
    reviewer: { id: reviewerId, provider, model },
    verdict: "APPROVE_SOURCE_MATCHED_BASELINE",
    countsAsBenchmarkApproval: true,
    claimScope: "source-matched-canary",
    target: approvalTarget(target),
    attestations: Object.fromEntries(requiredAttestations.map((key) => [key, true])),
    blockingConcerns: [],
    nonBlockingConcerns: [
      "Public launch still requires owner approval.",
      "This approves only a source-matched canary claim unless the packet proves a larger benchmark.",
    ],
  };
  return [
    "Review this RecallWeave hosted Supermemory baseline packet.",
    "",
    "Your task:",
    "1. Inspect the metrics-only evidence below.",
    "2. Approve only if the evidence supports a source-matched canary benchmark comparison.",
    "3. Reject if raw memory, transcript, prompt, answer, credentials, private paths, source mismatch, context-token mismatch, or owner-approval confusion appears.",
    "4. Public launch must remain blocked even when the benchmark claim is approved.",
    "5. Return one JSON object matching the schema. No markdown.",
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

function buildEvidenceSummary({ comparisonInput, runInput, packetInput, target }) {
  return {
    schemaVersion: 1,
    mode: "baseline-openai-compatible-reviewer-evidence",
    metricsOnly: true,
    rawContentIncluded: false,
    credentialsIncluded: false,
    privatePathsIncluded: false,
    publicLaunchAllowed: false,
    target,
    packet: packetInput ? loadPacketSummary(packetInput) : null,
    comparison: comparisonInput ? summarizeComparison(loadJsonInput(comparisonInput, "baseline comparison").json) : null,
    run: runInput ? summarizeRun(loadJsonInput(runInput, "baseline run").json) : null,
  };
}

function summarizeComparison(json) {
  assert.equal(json.mode, "baseline-comparison", "comparison target must be baseline-comparison");
  return {
    mode: json.mode,
    fixtureOnly: Boolean(json.fixtureOnly),
    metricsOnly: json.metricsOnly === true,
    countsAsComparisonEvidence: Boolean(json.countsAsComparisonEvidence),
    publicBenchmarkClaimsAllowed: Boolean(json.publicBenchmarkClaimsAllowed),
    publicLaunchAllowed: Boolean(json.publicLaunchAllowed),
    recallWeaveWin: Boolean(json.recallWeaveWin),
    reviewerApprovalCount: Number(json.reviewerApprovalCount ?? 0),
    failedChecks: json.failedChecks ?? [],
    contextBudget: json.contextBudget ?? null,
    privacy: {
      hostedPrivacyLeakCount: Number(json.hosted?.privacyLeakCount ?? json.privacy?.hostedPrivacyLeakCount ?? 0),
      recallWeavePrivacyLeakCount: Number(json.recallWeave?.privacyLeakCount ?? json.privacy?.recallWeavePrivacyLeakCount ?? 0),
      redactionFailureCount: Number(json.redactionFailureCount ?? json.privacy?.redactionFailureCount ?? 0),
    },
    hosted: summarizeArm(json.hosted),
    recallWeave: summarizeArm(json.recallWeave),
  };
}

function summarizeArm(arm = {}) {
  const metrics = arm.metrics ?? {};
  return {
    provider: arm.provider ?? null,
    sourceCommit: arm.sourceCommit ?? null,
    datasetSlice: arm.datasetSlice ?? null,
    querySetHash: arm.querySetHash ?? null,
    scoringCodeHash: arm.scoringCodeHash ?? null,
    judgeModel: arm.judgeModel ?? null,
    answerModel: arm.answerModel ?? null,
    quality: arm.quality ?? metrics.quality ?? null,
    pAt1: arm.pAt1 ?? metrics.pAt1 ?? null,
    recallAt5: arm.recallAt5 ?? metrics.recallAt5 ?? null,
    recallAt10: arm.recallAt10 ?? metrics.recallAt10 ?? null,
    ndcgAt10: arm.ndcgAt10 ?? metrics.ndcgAt10 ?? null,
    latencyP50Ms: arm.latencyP50Ms ?? metrics.latencyP50Ms ?? null,
    latencyP95Ms: arm.latencyP95Ms ?? metrics.latencyP95Ms ?? null,
    averageContextTokens:
      arm.averageContextTokens
        ?? arm.contextTokensAvg
        ?? metrics.averageContextTokens
        ?? metrics.contextTokensAvg
        ?? null,
    queryCount: arm.queryCount ?? metrics.queryCount ?? null,
  };
}

function summarizeRun(json) {
  assert.equal(json.mode, "hosted-baseline-run", "run target must be hosted-baseline-run");
  return {
    mode: json.mode,
    fixtureOnly: Boolean(json.fixtureOnly),
    metricsOnly: json.metricsOnly === true,
    countsAsHostedBaselineEvidence: Boolean(json.countsAsHostedBaselineEvidence),
    countsAsComparisonEvidence: Boolean(json.countsAsComparisonEvidence),
    publicBenchmarkClaimsAllowed: Boolean(json.publicBenchmarkClaimsAllowed),
    publicLaunchAllowed: Boolean(json.publicLaunchAllowed),
    failedChecks: json.failedChecks ?? [],
    evidence: {
      sourceMatch: {
        sourceMatchReady: Boolean(json.evidence?.sourceMatch?.sourceMatchReady),
        collectableQueryCount: Number(json.evidence?.sourceMatch?.collectableQueryCount ?? 0),
      },
      sourceAlignment: {
        status: json.evidence?.sourceAlignment?.status ?? null,
        matchedBaselineRunAllowed: Boolean(json.evidence?.sourceAlignment?.matchedBaselineRunAllowed),
      },
      sourceGap: {
        status: json.evidence?.sourceGap?.status ?? null,
        matchedBaselineRunAllowed: Boolean(json.evidence?.sourceGap?.matchedBaselineRunAllowed),
      },
      hosted: summarizeArm(json.evidence?.hosted),
      recallWeaveResponses: {
        contextBudget: json.evidence?.recallWeaveResponses?.contextBudget ?? null,
        privacyLeakCount: Number(json.evidence?.recallWeaveResponses?.privacyLeakCount ?? 0),
      },
      recallWeave: summarizeArm(json.evidence?.recallWeave),
      comparison: {
        recallWeaveWin: Boolean(json.evidence?.comparison?.recallWeaveWin),
        reviewerApprovalCount: Number(json.evidence?.comparison?.reviewerApprovalCount ?? 0),
        failedChecks: json.evidence?.comparison?.failedChecks ?? [],
      },
    },
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
    const packet = loadPacketSummary(packetInput);
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

function buildDryRunTarget() {
  return {
    packetSha256: null,
    runHash: null,
    comparisonHash: sha256("recallweave-openai-compatible-reviewer-dry-run"),
    querySetHash: "dry-run-query-set",
    scoringCodeHash: "dry-run-scoring-code",
    sourceCommit: "dry-run",
    datasetSlice: "dry-run",
    judgeModel: "dry-run",
    answerModel: "dry-run",
    fixtureOnly: true,
    hasAnyTarget: true,
  };
}

function loadPacketSummary(packetLike) {
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
      mode: json.mode,
      metricsOnly: json.metricsOnly === true,
      publicLaunchAllowed: Boolean(json.publicLaunchAllowed),
    };
  }
  return {
    packetSha256: sha256(raw),
    fixtureOnly: null,
    mode: "baseline-evidence-packet-zip",
    metricsOnly: true,
    publicLaunchAllowed: false,
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

function normalizeReviewerArtifact({ rawContent, provider, model, reviewerId, target }) {
  const parsed = parseReviewJson(rawContent, "review provider content");
  assert.deepEqual(findForbiddenKeys(parsed), [], "review provider content contains forbidden raw-content keys");
  const artifact = {
    schemaVersion: 1,
    mode: parsed.mode ?? "baseline-reviewer-approval",
    fixtureOnly: parsed.fixtureOnly === true,
    reviewer: {
      id: String(parsed.reviewer?.id ?? parsed.reviewerId ?? reviewerId),
      provider: String(parsed.reviewer?.provider ?? parsed.provider ?? provider),
      model: String(parsed.reviewer?.model ?? parsed.model ?? model),
    },
    verdict: String(parsed.verdict ?? "NEEDS_REVIEW"),
    countsAsBenchmarkApproval: parsed.countsAsBenchmarkApproval === true,
    claimScope: String(parsed.claimScope ?? ""),
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
    mode: "baseline-reviewer-approval",
    fixtureOnly: true,
    reviewer: { id: reviewerId, provider, model },
    verdict: "DRY_RUN_NOT_REVIEWED",
    countsAsBenchmarkApproval: false,
    claimScope: "source-matched-canary",
    target: approvalTarget(target),
    attestations: Object.fromEntries(requiredAttestations.map((key) => [key, false])),
    blockingConcerns: ["Dry run did not call an external reviewer provider."],
    nonBlockingConcerns: ["Use this only to inspect the sanitized prompt and command wiring."],
  };
}

function approvalTarget(target) {
  return {
    packetSha256: target.packetSha256,
    runHash: target.runHash,
    comparisonHash: target.comparisonHash,
    querySetHash: target.querySetHash,
    scoringCodeHash: target.scoringCodeHash,
    sourceCommit: target.sourceCommit,
    datasetSlice: target.datasetSlice,
    judgeModel: target.judgeModel,
    answerModel: target.answerModel,
  };
}

function readApiKey(provider) {
  const providerKey = provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const candidates = [
    "RECALLWEAVE_REVIEW_OPENAI_API_KEY",
    providerKey ? `RECALLWEAVE_REVIEW_${providerKey}_API_KEY` : "",
    provider.toLowerCase() === "deepseek" ? "DEEPSEEK_API_KEY" : "",
  ].filter(Boolean);
  for (const name of candidates) {
    const value = process.env[name];
    if (value) return { apiKey: value, apiKeySource: name };
  }
  return { apiKey: "", apiKeySource: null };
}

function defaultModel(provider) {
  return provider.toLowerCase() === "deepseek" ? "deepseek-v4-pro" : "";
}

function defaultBaseUrl(provider) {
  return provider.toLowerCase() === "deepseek" ? "https://api.deepseek.com" : "";
}

function chatCompletionsUrl(baseUrl) {
  assert.ok(baseUrl, "set RECALLWEAVE_REVIEW_OPENAI_BASE_URL for non-DeepSeek providers");
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

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
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

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(root, value);
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
