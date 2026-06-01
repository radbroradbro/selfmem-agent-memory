import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const defaultAllowedProviders = [
  "voyage",
  "gemini",
  "nvidia",
  "local-apple",
  "local-rerank",
  "openrouter",
  "deepseek",
  "jina",
  "alibaba",
];

const defaultDisallowedIfPaid = ["cohere", "openai", "pinecone", "zeroentropy"];

export function providersForBenchmarkStrategy(strategy) {
  const value = String(strategy ?? "").trim().toLowerCase();
  if (!value) return [];
  if (value === "cloud-gemini-voyage-rerank" || value === "cloud-gemini2-voyage-rerank") return ["gemini", "voyage"];
  if (value.includes("gemini")) return ["gemini"];
  if (value.includes("voyage")) return ["voyage"];
  if (value.includes("nvidia") || value.includes("nemotron") || value.includes("nv-embed") || value.includes("embedcode")) return ["nvidia"];
  if (value === "local-apple-qwen3-0_6b-local-rerank" || value === "local-apple-qwen3-4b-local-rerank") return ["local-apple", "local-rerank"];
  if (value.includes("local-apple")) return ["local-apple"];
  if (value.includes("openrouter")) return ["openrouter"];
  if (value.includes("deepseek")) return ["deepseek"];
  if (value.includes("jina")) return ["jina"];
  if (value.includes("alibaba") || value.includes("dashscope") || value.includes("qwen-cloud")) return ["alibaba"];
  if (value.includes("cohere")) return ["cohere"];
  if (value.includes("zeroentropy") || value.includes("zerank")) return ["zeroentropy"];
  if (value.includes("pinecone")) return ["pinecone"];
  if (value.includes("openai")) return ["openai"];
  return [];
}

export function buildProviderBudgetContract({
  root,
  benchmarkKind,
  fixtureOnly = false,
  providerCallsEnabled = false,
  publicDataConfirmed = false,
  requiredProviders = [],
} = {}) {
  assert.ok(root, "provider budget contract requires repo root");
  const maxPaidUsd = nonNegativeNumber(
    process.env.RECALLWEAVE_BENCHMARK_MAX_PAID_USD ?? process.env.RECALLWEAVE_PROVIDER_MAX_PAID_USD ?? "0",
    "provider max paid USD",
  );
  const allowedProviders = normalizedList(process.env.RECALLWEAVE_PROVIDER_ALLOWED_PROVIDERS, defaultAllowedProviders);
  const disallowedIfPaid = normalizedList(process.env.RECALLWEAVE_PROVIDER_DISALLOWED_IF_PAID, defaultDisallowedIfPaid);
  const normalizedRequiredProviders = uniqueStrings(requiredProviders.flatMap(normalizeProvider).filter(Boolean));
  const unknownProviderFamiliesRequested = normalizedRequiredProviders.filter((provider) => !allowedProviders.includes(provider));
  const paidProviderFamiliesRequested =
    maxPaidUsd === 0 ? normalizedRequiredProviders.filter((provider) => disallowedIfPaid.includes(provider)) : [];
  const keyScopedThrottle = throttleScope() === "key";
  const configHashes = {
    benchBudget: fileHashIfPresent(root, "configs/bench-budget.yaml"),
    providerMatrix: fileHashIfPresent(root, "configs/provider-matrix.yaml"),
    defaultCloud: fileHashIfPresent(root, "configs/default.cloud.yaml"),
    providerAdapterRegistry: fileHashIfPresent(root, "configs/provider-adapter-registry.json"),
    benchmarkTargetLock: fileHashIfPresent(root, "configs/benchmark-target-lock.json"),
  };
  const blockers = [
    unknownProviderFamiliesRequested.length ? "provider-family-not-allowed-by-budget-contract" : null,
    paidProviderFamiliesRequested.length ? "paid-provider-family-requested-in-no-spend-mode" : null,
  ].filter(Boolean);

  return {
    schemaVersion: 1,
    kind: "provider-budget-contract",
    benchmarkKind: String(benchmarkKind ?? "unknown"),
    fixtureOnly: Boolean(fixtureOnly),
    mode: maxPaidUsd === 0 ? "no-spend-free-tier" : "approved-paid-cap",
    noSpendMode: maxPaidUsd === 0,
    maxPaidUsd,
    maxPaidUsdSource:
      process.env.RECALLWEAVE_BENCHMARK_MAX_PAID_USD || process.env.RECALLWEAVE_PROVIDER_MAX_PAID_USD ? "environment" : "default-zero",
    providerCallsEnabled: Boolean(providerCallsEnabled),
    publicDataConfirmed: Boolean(publicDataConfirmed),
    allowedProviders,
    disallowedIfPaid,
    requiredProviders: normalizedRequiredProviders,
    requiredProvidersWithinAllowed: unknownProviderFamiliesRequested.length === 0,
    unknownProviderFamiliesRequested,
    paidProviderRequestedInNoSpendMode: paidProviderFamiliesRequested.length > 0,
    paidProviderFamiliesRequested,
    keyRotation: {
      allowed: true,
      purpose: "cost isolation, reliability, and free-credit usage",
      sameProviderOnly: true,
      neverSwitchModelsWithinArm: true,
      doNotBypassProviderTermsOrPublishedLimits: true,
      stopOnRateLimitInsteadOfSwitchingArms: true,
    },
    cachePolicy: {
      cacheEmbeddings: true,
      cacheRerankScores: true,
      reuseCachedProviderOutputsBeforeFullWave: true,
      cacheKeyMustIncludeProviderModelDimensionsAndPayloadHash: true,
      rawProviderPayloadsMayNotBeWrittenToPublicEvidence: true,
    },
    fallbackPolicy: {
      crossProviderFallbackEnabled: false,
      failedProviderArmStaysFailedForThatRun: true,
      rerunAsSeparateArmOnly: true,
    },
    rateLimitPolicy: {
      sourceOfTruth: "provider dashboard, provider response headers, or explicit environment throttles",
      throttleScope: throttleScope(),
      keyScopedThrottleEnabled: keyScopedThrottle,
      globalMinIntervalMs: nonNegativeInteger(process.env.RECALLWEAVE_PROVIDER_MIN_INTERVAL_MS ?? "0", "provider min interval"),
      retryAttempts: nonNegativeInteger(process.env.RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS ?? "4", "provider retry attempts"),
      timeoutMs: nonNegativeInteger(process.env.RECALLWEAVE_PROVIDER_TIMEOUT_MS ?? "60000", "provider timeout"),
    },
    reportRules: {
      metricsOnly: true,
      publicSafeEvidenceOnly: true,
      providerValuesPrinted: false,
      rawQuestionsIncluded: false,
      rawAnswersIncluded: false,
      rawMemoryIncluded: false,
      rawTranscriptIncluded: false,
    },
    configHashes,
    blockers,
  };
}

function normalizedList(value, fallback) {
  const parsed = splitList(value).map(normalizeProvider).filter(Boolean);
  return uniqueStrings(parsed.length ? parsed : fallback.map(normalizeProvider));
}

function normalizeProvider(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!normalized) return "";
  if (normalized.startsWith("nvidia") || normalized.startsWith("nvapi") || normalized.includes("nemotron")) return "nvidia";
  if (normalized.startsWith("gemini") || normalized.startsWith("google") || normalized.includes("ai-studio")) return "gemini";
  if (normalized.startsWith("voyage")) return "voyage";
  if (normalized.startsWith("local-rerank")) return "local-rerank";
  if (normalized.startsWith("local") || normalized.includes("apple")) return "local-apple";
  if (normalized.startsWith("open-router")) return "openrouter";
  if (normalized.startsWith("openrouter")) return "openrouter";
  if (normalized.startsWith("deepseek")) return "deepseek";
  if (normalized.startsWith("jina")) return "jina";
  if (normalized.startsWith("alibaba") || normalized.startsWith("dashscope") || normalized.startsWith("qwen-cloud")) return "alibaba";
  if (normalized.startsWith("zero-entropy") || normalized.startsWith("zeroentropy") || normalized.startsWith("zerank")) return "zeroentropy";
  if (normalized.startsWith("cohere")) return "cohere";
  if (normalized.startsWith("pinecone")) return "pinecone";
  if (normalized.startsWith("openai")) return "openai";
  return normalized;
}

function throttleScope() {
  const value = String(process.env.RECALLWEAVE_PROVIDER_THROTTLE_SCOPE ?? "provider").trim().toLowerCase();
  return value === "key" || value === "per-key" || value === "credential" ? "key" : "provider";
}

function nonNegativeNumber(value, label) {
  const number = Number(value);
  assert.ok(Number.isFinite(number) && number >= 0, `${label} must be a non-negative number`);
  return Number(number.toFixed(6));
}

function nonNegativeInteger(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer`);
  return number;
}

function fileHashIfPresent(root, file) {
  const path = resolve(root, file);
  if (!existsSync(path)) return null;
  return `sha256:${createHash("sha256").update(readFileSync(path, "utf8")).digest("hex")}`;
}

function splitList(value) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort();
}
