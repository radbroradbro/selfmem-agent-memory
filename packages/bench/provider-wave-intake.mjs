import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const reviewDir = args.reviewDir ?? "reviews/overnight-20260522";
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const inputPaths = splitList(args.input ?? "").map(resolveInputPath);
const requireReady = Boolean(args.requireReady);
const format = String(args.format ?? "json").toLowerCase();

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");

const providerWavePaths = inputPaths.length ? inputPaths : discoverProviderWaveReports(reviewDir);
const reports = providerWavePaths.map(loadProviderWaveReport);
const providerGateReports = reports.filter((item) => item.json.mode === "public-benchmark-provider-gate");
assert.ok(providerGateReports.length > 0, "no public-benchmark-provider-gate reports found");

const providers = summarizeProviders(providerGateReports);
const controls = summarizeControls(providerGateReports);
const providerHybridContract = buildProviderHybridContract(controls);
const completedReports = providerGateReports.filter((item) => item.json.status === "COMPLETED");
const partialReports = providerGateReports.filter((item) => item.json.status === "PARTIAL_COMPLETED_WITH_ARM_FAILURES");
const failedReports = providerGateReports.filter((item) => item.json.status === "FAILED_ALL_ARMS");
const publicSafe = providerGateReports.every((item) => reportIsPublicSafe(item.json));
const metricsOnly = providerGateReports.every((item) => item.json.metricsOnly === true);
const sendsBenchmarkTextToProvider = providerGateReports.some((item) =>
  providerStrategies(item.json).some((strategy) => Number(strategy.provider?.documentCountSent ?? 0) > 0 || Number(strategy.provider?.queryCountSent ?? 0) > 0),
);
const providerFailures = providerGateReports.flatMap((item) =>
  arrayOf(item.json.failedStrategies).map((failure) => ({
    evidencePath: displayPath(item.path),
    strategy: failure.strategy ?? null,
    failureClass: failure.failureClass ?? null,
    retryableProviderLimit: Boolean(failure.retryableProviderLimit),
  })),
);
const providerPromotions = providerGateReports
  .map((item) => item.json.promotion)
  .filter((promotion) => promotion?.kind === "provider" && promotion.promoteProvider === true);
const blockers = [
  !publicSafe ? "provider-wave-report-not-public-safe" : null,
  !metricsOnly ? "provider-wave-report-not-metrics-only" : null,
  !controls.allHaveBm25 ? "provider-wave-missing-bm25-control" : null,
  !controls.allHaveFullHybrid ? "provider-wave-missing-full-hybrid-control" : null,
  providers.completedProviderFamilies.length === 0 ? "no-completed-provider-family-wave" : null,
  providerFailures.some((failure) => failure.retryableProviderLimit) ? "retryable-provider-limit-or-timeout-observed" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: !requireReady || blockers.filter((item) => item !== "retryable-provider-limit-or-timeout-observed").length === 0,
  mode: "provider-wave-intake",
  status: blockers.filter((item) => item !== "retryable-provider-limit-or-timeout-observed").length === 0
    ? "READY_PROVIDER_WAVE_INTAKE"
    : "BLOCKED_PROVIDER_WAVE_INTAKE",
  generatedAt: new Date().toISOString(),
  reviewDir,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  metricsOnly: true,
  publicSafe: true,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  publicBenchmarkClaimsAllowed: false,
  countsAsFullMemorySotaEvidence: false,
  countsAsEndToEndMemoryBenchmark: false,
  claimBoundary:
    "Provider wave intake summarizes retrieval/provider-gate canaries only. It does not count as answer-quality, MemoryBench, or full-memory SOTA evidence.",
  input: {
    reportCount: providerGateReports.length,
    completedReportCount: completedReports.length,
    partialReportCount: partialReports.length,
    failedReportCount: failedReports.length,
    evidence: providerGateReports.map((item) => ({
      path: displayPath(item.path),
      hash: item.hash,
      status: item.json.status,
      generatedAt: item.json.generatedAt ?? null,
      queryOffset: item.json.input?.requestedQuerySelection?.queryOffset ?? null,
      maxQueries: item.json.input?.requestedQuerySelection?.maxQueries ?? null,
      selectedQueryCount: item.json.input?.selectedQueryCount ?? null,
      strategies: arrayOf(item.json.strategies).map((strategy) => strategy.strategy).filter(Boolean),
    })),
  },
  controls,
  providerHybridContract,
  providers,
  providerFailures,
  providerPromotions: providerPromotions.map((promotion) => ({
    bestProviderStrategy: promotion.bestProviderStrategy ?? null,
    qualityDeltaVsBm25: promotion.qualityDeltaVsBm25 ?? null,
    latencyDeltaVsBm25: promotion.latencyDeltaVsBm25 ?? null,
  })),
  blockers,
  nextActions: nextActions({ providers, providerFailures, controls }),
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "provider wave intake report");
if (outputPath) writeOutput(outputPath, serialized);
if (markdownOutputPath) writeOutput(markdownOutputPath, `${renderMarkdown(report)}\n`);
process.stdout.write(format === "markdown" ? `${renderMarkdown(report)}\n` : serialized);
if (!report.ok) process.exitCode = 1;

function discoverProviderWaveReports(dir) {
  const absDir = resolveInputPath(dir);
  assert.ok(existsSync(absDir), `review dir missing: ${dir}`);
  return readdirSync(absDir)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => /public-longmemeval.*provider.*(?:wave|mitigated|keyrotation|slicefixed).*20\d{6}\.json$/.test(name))
    .map((name) => resolve(absDir, name))
    .sort();
}

function loadProviderWaveReport(path) {
  assert.ok(existsSync(path), `provider wave report missing: ${displayPath(path)}`);
  assert.ok(statSync(path).isFile(), `provider wave report must be a file: ${displayPath(path)}`);
  const text = readFileSync(path, "utf8");
  assertSafePublicText(text, displayPath(path));
  const json = JSON.parse(text);
  return {
    path,
    hash: `sha256:${sha256(text)}`,
    json,
  };
}

function summarizeControls(items) {
  const rows = items.map((item) => {
    const strategies = arrayOf(item.json.strategies).map((strategy) => strategy.strategy);
    return {
      path: displayPath(item.path),
      hasBm25: strategies.includes("bm25-lite"),
      hasFullHybrid: strategies.includes("full-hybrid-rerank"),
      providerArmCount: providerStrategies(item.json).length,
      failedProviderArmCount: arrayOf(item.json.failedStrategies).filter((failure) => providerFamilyForStrategy(failure.strategy)).length,
    };
  });
  return {
    allHaveBm25: rows.every((row) => row.hasBm25),
    allHaveFullHybrid: rows.every((row) => row.hasFullHybrid),
    rows,
  };
}

function buildProviderHybridContract(controls) {
  return {
    bm25LexicalFloorRequired: true,
    fullHybridControlRequired: true,
    sameDataControlsRequired: true,
    providerChallengersAreHybridContextArms: true,
    providerOnlyDenseClaimsAllowed: false,
    allProviderWavesMeetHybridControlContract: controls.allHaveBm25 && controls.allHaveFullHybrid,
    answerQualityStillRequiredForMemoryClaims: true,
  };
}

function summarizeProviders(items) {
  const byProvider = new Map();
  for (const item of items) {
    for (const strategy of providerStrategies(item.json)) {
      const families = arrayOf(strategy.provider?.providers);
      for (const provider of families.length ? families : [providerFamilyForStrategy(strategy.strategy)]) {
        if (!provider) continue;
        const state = byProvider.get(provider) ?? emptyProviderState(provider);
        state.completedArmCount += 1;
        state.completedQueryCount += Number(strategy.queryShard?.responseCount ?? 0);
        state.providerCallCount += Number(strategy.provider?.providerCallsMade ?? 0);
        state.embeddingCallCount += Number(strategy.provider?.embeddingCalls ?? 0);
        state.rerankCallCount += Number(strategy.provider?.rerankCalls ?? 0);
        state.documentCountSent += Number(strategy.provider?.documentCountSent ?? 0);
        state.queryCountSent += Number(strategy.provider?.queryCountSent ?? 0);
        state.bestQuality = maxNullable(state.bestQuality, strategy.metrics?.quality);
        state.bestStrategy = state.bestQuality === Number(strategy.metrics?.quality ?? NaN) ? strategy.strategy : state.bestStrategy;
        state.strategyNames.add(strategy.strategy);
        state.models.add(strategy.provider?.embedModel).add(strategy.provider?.rerankModel).add(strategy.provider?.modelArm);
        state.queryRanges.add(queryRange(strategy.queryShard));
        byProvider.set(provider, state);
      }
    }
    for (const failure of arrayOf(item.json.failedStrategies)) {
      const provider = providerFamilyForStrategy(failure.strategy);
      if (!provider) continue;
      const state = byProvider.get(provider) ?? emptyProviderState(provider);
      state.failedArmCount += 1;
      state.failureClasses.add(failure.failureClass ?? "unknown-provider-failure");
      state.retryableFailureCount += failure.retryableProviderLimit ? 1 : 0;
      state.strategyNames.add(failure.strategy);
      byProvider.set(provider, state);
    }
  }
  const rows = [...byProvider.values()].map((state) => ({
    provider: state.provider,
    completedArmCount: state.completedArmCount,
    failedArmCount: state.failedArmCount,
    retryableFailureCount: state.retryableFailureCount,
    completedQueryCount: state.completedQueryCount,
    providerCallCount: state.providerCallCount,
    embeddingCallCount: state.embeddingCallCount,
    rerankCallCount: state.rerankCallCount,
    documentCountSent: state.documentCountSent,
    queryCountSent: state.queryCountSent,
    bestStrategy: state.bestStrategy,
    bestQuality: state.bestQuality,
    strategies: [...state.strategyNames].filter(Boolean).sort(),
    models: [...state.models].filter(Boolean).sort(),
    queryRanges: [...state.queryRanges].filter(Boolean).sort(),
    failureClasses: [...state.failureClasses].filter(Boolean).sort(),
  })).sort((a, b) => a.provider.localeCompare(b.provider));
  return {
    completedProviderFamilies: rows.filter((row) => row.completedArmCount > 0).map((row) => row.provider),
    failedProviderFamilies: rows.filter((row) => row.failedArmCount > 0).map((row) => row.provider),
    rows,
  };
}

function emptyProviderState(provider) {
  return {
    provider,
    completedArmCount: 0,
    failedArmCount: 0,
    retryableFailureCount: 0,
    completedQueryCount: 0,
    providerCallCount: 0,
    embeddingCallCount: 0,
    rerankCallCount: 0,
    documentCountSent: 0,
    queryCountSent: 0,
    bestStrategy: null,
    bestQuality: null,
    strategyNames: new Set(),
    models: new Set(),
    queryRanges: new Set(),
    failureClasses: new Set(),
  };
}

function providerStrategies(report) {
  return arrayOf(report.strategies).filter((strategy) => strategy.provider?.providerStrategy === true || providerFamilyForStrategy(strategy.strategy));
}

function providerFamilyForStrategy(strategy) {
  const value = String(strategy ?? "");
  if (value.includes("gemini")) return "gemini";
  if (value.includes("voyage")) return "voyage";
  if (value.includes("nvidia") || value.includes("nemotron") || value.includes("nv-embed") || value.includes("embedcode")) return "nvidia";
  if (value.includes("local-apple")) return "local-apple";
  return null;
}

function reportIsPublicSafe(report) {
  return (
    report.publicSafe === true &&
    report.metricsOnly === true &&
    report.rawQuestionIdsIncluded === false &&
    report.rawQuestionsIncluded === false &&
    report.rawAnswersIncluded === false &&
    report.rawMemoryIncluded === false &&
    report.rawTranscriptIncluded === false &&
    report.rawPrivateOutputPathIncluded === false &&
    report.publicBenchmarkClaimsAllowed === false
  );
}

function nextActions({ providers, providerFailures, controls }) {
  const actions = [];
  if (!controls.allHaveBm25 || !controls.allHaveFullHybrid) {
    actions.push("Reject provider waves that do not include bm25-lite and full-hybrid-rerank controls on the same query slice.");
  }
  const retryProviders = [...new Set(providerFailures.filter((failure) => failure.retryableProviderLimit).map((failure) => providerFamilyForStrategy(failure.strategy)).filter(Boolean))];
  if (retryProviders.length) {
    actions.push(`Retry ${retryProviders.join(", ")} with provider-specific slices, capped dense/rerank candidates, and explicit provider arm timeout.`);
  }
  const completedProviders = providers.completedProviderFamilies;
  const missingCore = ["gemini", "nvidia", "voyage"].filter((provider) => !completedProviders.includes(provider));
  if (missingCore.length) {
    actions.push(`Collect at least one completed same-data control wave for: ${missingCore.join(", ")}.`);
  }
  actions.push("Keep these provider waves separate from answer-quality and full-SOTA evidence until response arms are scored by the accepted answer-quality shard ladder.");
  return actions;
}

function renderMarkdown(value) {
  return [
    "# Provider Wave Intake",
    "",
    `- Status: ${value.status}`,
    `- Reports: ${value.input.reportCount}`,
    `- Completed reports: ${value.input.completedReportCount}`,
    `- Partial reports: ${value.input.partialReportCount}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Sends benchmark text to provider: ${value.sendsBenchmarkTextToProvider}`,
    "",
    "## Controls",
    `- All waves include BM25: ${value.controls.allHaveBm25}`,
    `- All waves include full hybrid: ${value.controls.allHaveFullHybrid}`,
    "",
    "## Provider Hybrid Contract",
    `- BM25 lexical floor required: ${value.providerHybridContract.bm25LexicalFloorRequired}`,
    `- Full hybrid control required: ${value.providerHybridContract.fullHybridControlRequired}`,
    `- Same-data controls required: ${value.providerHybridContract.sameDataControlsRequired}`,
    `- Provider challengers are hybrid context arms: ${value.providerHybridContract.providerChallengersAreHybridContextArms}`,
    `- Provider-only dense claims allowed: ${value.providerHybridContract.providerOnlyDenseClaimsAllowed}`,
    `- All provider waves meet hybrid control contract: ${value.providerHybridContract.allProviderWavesMeetHybridControlContract}`,
    `- Answer quality still required for memory claims: ${value.providerHybridContract.answerQualityStillRequiredForMemoryClaims}`,
    "",
    "## Providers",
    ...value.providers.rows.map((row) =>
      `- ${row.provider}: completed=${row.completedArmCount}, failed=${row.failedArmCount}, queries=${row.completedQueryCount}, calls=${row.providerCallCount}, docsSent=${row.documentCountSent}, best=${row.bestStrategy ?? "n/a"}:${row.bestQuality ?? "n/a"}, failures=${row.failureClasses.join(", ") || "none"}`,
    ),
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function queryRange(queryShard) {
  if (!queryShard) return null;
  return `${queryShard.startIndex ?? "?"}-${queryShard.endIndexExclusive ?? "?"}`;
}

function maxNullable(current, next) {
  const currentNumber = Number(current);
  const nextNumber = Number(next);
  if (!Number.isFinite(nextNumber)) return current ?? null;
  if (!Number.isFinite(currentNumber)) return nextNumber;
  return Math.max(currentNumber, nextNumber);
}

function splitList(value) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function resolveInputPath(path) {
  return isAbsolute(path) ? path : resolve(root, path);
}

function displayPath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
  assert.doesNotMatch(text, secretPattern, `${label} contains a credential`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}
