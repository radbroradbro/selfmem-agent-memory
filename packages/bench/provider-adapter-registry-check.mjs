import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(root, args.input ?? "configs/provider-adapter-registry.json");
const outputPath = args.output ? resolve(root, args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolve(root, args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const requireReady = Boolean(args.requireReady);
const requiredFamilies = ["voyage", "gemini", "nvidia", "local-apple", "openrouter", "deepseek", "jina", "alibaba", "zeroentropy"];

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(existsSync(inputPath), `provider adapter registry missing: ${displayPath(inputPath)}`);

const raw = readFileSync(inputPath, "utf8");
assertSafePublicText(raw, "provider adapter registry");
const registry = JSON.parse(raw);
const report = buildReport(registry, raw);
const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "provider adapter registry report");
assertSafePublicText(markdownText, "provider adapter registry markdown");
if (outputPath) writeFileSync(outputPath, jsonText);
if (markdownOutputPath) writeFileSync(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (requireReady && report.status !== "READY_PROVIDER_ADAPTER_REGISTRY") process.exit(1);

function buildReport(value, rawText) {
  const adapters = Array.isArray(value.adapters) ? value.adapters : [];
  const families = adapters.map((item) => item.family).filter(Boolean);
  const missingFamilies = requiredFamilies.filter((family) => !families.includes(family));
  const blockers = [
    value.schemaVersion !== 1 ? "unsupported-schema-version" : null,
    value.mode !== "provider-adapter-registry" ? "unexpected-mode" : null,
    value.publicSafe !== true ? "registry-not-public-safe" : null,
    value.storesCredentials !== false ? "registry-must-not-store-credentials" : null,
    value.personalProductionDefaultArm !== "cloud-voyage4-voyage" ? "personal-production-default-not-voyage" : null,
    value.methodologyDefault?.memoryMethod !== "contextual-source-chunk-v1" ? "methodology-default-materializer-not-contextual-source-chunk" : null,
    value.methodologyDefault?.firstStage !== "bm25-lite" ? "methodology-default-first-stage-not-bm25" : null,
    value.methodologyDefault?.queryExpansionDefaultEnabled !== false ? "query-expansion-not-default-off" : null,
    value.benchmarkRules?.sameMaterializerAcrossProviderArms !== true ? "provider-arms-not-same-materializer" : null,
    value.benchmarkRules?.keepBm25ControlInEveryProviderRun !== true ? "bm25-control-not-required" : null,
    value.benchmarkRules?.crossProviderFallbackEnabled !== false ? "cross-provider-fallback-not-disabled" : null,
    value.benchmarkRules?.failureTaxonomyRequiredBeforePromotion !== true ? "failure-taxonomy-not-required" : null,
    value.benchmarkRules?.latencyCostQuotaLedgerRequiredBeforePromotion !== true ? "cost-latency-ledger-not-required" : null,
    missingFamilies.length ? "missing-provider-family" : null,
    adapters.some((item) => !Array.isArray(item.envKeyNames) || item.envKeyNames.length === 0) ? "adapter-missing-env-key-names" : null,
    adapters.some((item) => !Array.isArray(item.capabilities) || item.capabilities.length === 0) ? "adapter-missing-capabilities" : null,
  ].filter(Boolean);
  return {
    schemaVersion: 1,
    ok: blockers.length === 0,
    mode: "provider-adapter-registry-check",
    status: blockers.length === 0 ? "READY_PROVIDER_ADAPTER_REGISTRY" : "BLOCKED_PROVIDER_ADAPTER_REGISTRY",
    generatedAt: new Date().toISOString(),
    publicSafe: true,
    metricsOnly: true,
    callsProviderApis: false,
    sendsBenchmarkTextToProvider: false,
    storesCredentials: false,
    input: {
      path: displayPath(inputPath),
      hash: `sha256:${sha256(rawText)}`,
    },
    personalProductionDefaultArm: value.personalProductionDefaultArm ?? null,
    methodologyDefault: value.methodologyDefault ?? null,
    benchmarkRules: value.benchmarkRules ?? null,
    requiredFamilies,
    presentFamilies: families,
    missingFamilies,
    adapters: adapters.map((item) => ({
      family: item.family,
      status: item.status,
      capabilities: item.capabilities,
      benchmarkArms: item.benchmarkArms,
      role: item.role,
    })),
    blockers,
    nextActions: blockers.length
      ? ["Fix the provider registry before using it as the benchmark planning source."]
      : [
          "Use the registry to keep provider canaries on the same materializer.",
          "Implement planned Jina, Alibaba, and ZeroEntropy adapters only after the current contextual BM25 lane is stable.",
          "Do not enable query expansion by default until it wins a paired answer-quality lane.",
        ],
  };
}

function renderMarkdown(value) {
  return [
    "# Provider Adapter Registry",
    "",
    `- Status: ${value.status}`,
    `- Personal default arm: ${value.personalProductionDefaultArm}`,
    `- Methodology default: ${value.methodologyDefault?.memoryMethod ?? "n/a"} + ${value.methodologyDefault?.firstStage ?? "n/a"}`,
    `- Present families: ${value.presentFamilies.join(", ")}`,
    `- Missing families: ${value.missingFamilies.length ? value.missingFamilies.join(", ") : "none"}`,
    `- Blockers: ${value.blockers.length ? value.blockers.join(", ") : "none"}`,
    "",
    "## Adapter Status",
    "",
    ...value.adapters.map((item) => `- ${item.family}: ${item.status}; ${item.capabilities.join(", ")}`),
  ].join("\n");
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = values[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern =
    /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
  assert.doesNotMatch(text, secretPattern, `${label} contains credential-shaped text`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
}

function displayPath(path) {
  if (!path.startsWith(root)) return path;
  const offset = root.endsWith("/") ? root.length : root.length + 1;
  return path.slice(offset);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}
