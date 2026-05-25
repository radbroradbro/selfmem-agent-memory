import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const outputPath = args.output ?? process.env.RECALLWEAVE_SOTA_LADDER_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ?? process.env.RECALLWEAVE_SOTA_LADDER_MARKDOWN ?? null;
const strict = Boolean(args.strict);

const evidenceFiles = {
  sourceLockedTarget: "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json",
  expandedHybridGate: "reviews/overnight-20260522/public-longmemeval-expanded-hybrid-gate.json",
  expandedAutoresearch: "reviews/overnight-20260522/public-longmemeval-expanded-autoresearch-loop.json",
  voyageLatencyCanary: "reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider.json",
  localApple4bWarm: "reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-provider-900tok-warm.json",
  readinessNote: "reviews/overnight-20260522/benchmark-sota-readiness-20260525.md",
};

const loaded = Object.fromEntries(Object.entries(evidenceFiles).map(([key, file]) => [key, loadEvidence(file)]));
const rows = collectRows(loaded);
const allStrategies = [...new Set(rows.map((row) => row.strategy).filter(Boolean))].sort();

const requiredArms = [
  { id: "bm25-lite", role: "lexical floor", status: hasStrategy(rows, "bm25-lite") ? "present" : "missing" },
  {
    id: "dense-or-vector-only",
    role: "semantic control",
    status: hasAnyStrategy(rows, ["dense-proxy", "local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]) ? "present" : "missing",
  },
  { id: "full-hybrid-rerank", role: "intended local hybrid control", status: hasStrategy(rows, "full-hybrid-rerank") ? "present" : "missing" },
  {
    id: "provider-voyage4-rerank",
    role: "cloud quality challenger",
    status: hasAnyStrategy(rows, ["cloud-voyage4-voyage", "cloud-voyage4-voyage-lite-rerank", "cloud-voyage4-lite-voyage-lite"]) ? "present" : "missing",
  },
  {
    id: "provider-nvidia-or-gemini",
    role: "non-Voyage provider challenger",
    status: hasAnyStrategy(rows, ["cloud-nvidia-retriever-500m", "cloud-nvidia-nemotron-1b", "cloud-nvidia-e5-mistral", "cloud-gemini-embed-rerank-proxy", "cloud-gemini-voyage-rerank"])
      ? "present"
      : "missing-live-result",
  },
  {
    id: "local-apple-embedding",
    role: "zero-spend local challenger",
    status: hasAnyStrategy(rows, ["local-apple-qwen3-0_6b", "local-apple-qwen3-4b"]) ? "present" : "missing",
  },
  {
    id: "local-apple-reranker-sidecar",
    role: "local rerank method challenger",
    status: hasAnyStrategy(rows, ["local-apple-qwen3-0_6b-local-rerank", "local-apple-qwen3-4b-local-rerank"]) ? "present" : "missing-live-result",
  },
  {
    id: "llm-query-expansion",
    role: "query expansion challenger",
    status: hasAnyStrategy(rows, ["query-expanded-full-hybrid-rerank"])
      ? "deterministic-proxy-present-live-llm-missing"
      : "missing-live-result",
  },
];

const componentEvidence = [
  {
    id: "mteb",
    role: "embedding benchmark family",
    claimUse: "model-selection-only",
    source: "https://arxiv.org/abs/2210.07316",
    finding: "MTEB covers embedding tasks and says no one embedding method dominates all tasks.",
  },
  {
    id: "qwen3-embedding-reranker",
    role: "local/open-weight candidate selector",
    claimUse: "model-selection-only",
    source: "https://github.com/QwenLM/Qwen3-Embedding",
    finding: "Qwen3 4B/8B embedding and Qwen3 reranker reported scores justify local challenger arms where hardware allows.",
  },
  {
    id: "voyage-4-rerank-2_5",
    role: "cloud/provider candidate selector",
    claimUse: "model-selection-only",
    source: "https://www.mongodb.com/docs/voyageai/models/",
    finding: "Voyage 4 and rerank-2.5 are documented high-quality cloud retrieval and rerank candidates.",
  },
  {
    id: "nvidia-retrieval-nim",
    role: "cloud/provider embedding and rerank selector",
    claimUse: "model-selection-only",
    source: "https://docs.api.nvidia.com/nim/reference/retrieval-apis",
    finding: "NVIDIA NIM exposes current embedding and rerank endpoints suitable for same-data challenger arms.",
  },
  {
    id: "query-expansion-retrieval-pipeline",
    role: "query expansion method selector",
    claimUse: "method-selection-only",
    source: "https://arxiv.org/abs/2602.16989",
    finding: "A 2026 retrieval pipeline used LLM-based query expansion before sparse retrieval, dense ranking, and Qwen3 reranking under limited compute.",
  },
];

const queryExpansionPolicy = {
  allowedInLocalBenchmark: true,
  preferredLocalCandidates: [
    {
      id: "small-current-local-llm",
      examples: ["Qwen 3.6 local family", "Gemma 4 local family", "other May-2026 small instruction model"],
      role: "Generate bounded query rewrites before retrieval.",
      requirement: "Must run through an env-only local OpenAI-compatible endpoint and be reported separately from embedding/rerank latency.",
    },
  ],
  cloudExceptionAllowed: true,
  cloudExceptionCandidates: [
    {
      id: "nvidia-query-expansion",
      role: "Use one cloud query-expansion call when local context/quality is the limiting factor.",
      requirement: "Report it as a mixed local-plus-cloud arm, not as a pure local result.",
    },
  ],
  publicClaimRule:
    "Query expansion can improve the method, but it does not count as local-only unless the expansion model runs locally; mixed arms must label the cloud substep.",
};

const reportedMemoryTargets = [
  {
    id: "supermemory-production-research-gpt4o",
    benchmark: "LongMemEval-S",
    score: 81.6,
    scoreUnit: "overall percent",
    judge: "gpt-4o",
    source: "https://supermemory.ai/research/",
    targetUse: "reported-memory-system-target",
    caveat: "Self-reported production/research target; RecallWeave needs matching benchmark semantics before claiming a win.",
  },
  {
    id: "supermemory-production-research-gpt5",
    benchmark: "LongMemEval-S",
    score: 84.6,
    scoreUnit: "overall percent",
    judge: "gpt-5",
    source: "https://supermemory.ai/research/",
    targetUse: "reported-memory-system-target",
    caveat: "Useful target row for same-benchmark comparison; not replaceable by MTEB component scores.",
  },
  {
    id: "supermemory-experimental-asmr",
    benchmark: "LongMemEval-S",
    score: 98.6,
    scoreUnit: "overall percent",
    judge: "multi-agent experimental flow",
    source: "https://supermemory.ai/blog/we-broke-the-frontier-in-agent-memory-introducing-99-sota-memory-system/",
    targetUse: "ceiling-reference-not-production-target",
    caveat: "The source labels this as experimental/non-production and a parody/social experiment.",
  },
];

const checks = {
  sourceLockedTargetPresent: loaded.sourceLockedTarget.exists,
  componentEvidencePresent: componentEvidence.length >= 3,
  sameDataControlRowsPresent: requiredArms.filter((arm) => ["bm25-lite", "dense-or-vector-only", "full-hybrid-rerank"].includes(arm.id)).every((arm) => arm.status === "present"),
  voyageProviderCanaryPresent: requiredArms.find((arm) => arm.id === "provider-voyage4-rerank")?.status === "present",
  nvidiaOrGeminiLiveCanaryPresent: requiredArms.find((arm) => arm.id === "provider-nvidia-or-gemini")?.status === "present",
  localAppleEmbeddingCanaryPresent: requiredArms.find((arm) => arm.id === "local-apple-embedding")?.status === "present",
  localAppleRerankerCanaryPresent: requiredArms.find((arm) => arm.id === "local-apple-reranker-sidecar")?.status === "present",
  llmQueryExpansionLiveCanaryPresent: requiredArms.find((arm) => arm.id === "llm-query-expansion")?.status === "present",
  queryExpansionProxyPresent: requiredArms.find((arm) => arm.id === "llm-query-expansion")?.status === "deterministic-proxy-present-live-llm-missing",
  endToEndMemoryScorePresent: rows.some((row) => row.memoryBenchAnswerQuality === true && row.retrievalProxyOnly === false),
  publicClaimsAllowedByInputs: rows.some((row) => row.publicBenchmarkClaimsAllowed === true),
  reportedMemoryTargetsPresent: reportedMemoryTargets.length >= 2,
  readinessNotePresent: loaded.readinessNote.exists,
};

const blockers = [
  !checks.endToEndMemoryScorePresent ? "missing-end-to-end-memory-benchmark-score" : null,
  !checks.publicClaimsAllowedByInputs ? "all-current-result-files-keep-public-claims-disabled" : null,
  !checks.nvidiaOrGeminiLiveCanaryPresent ? "missing-nvidia-or-gemini-live-same-data-result" : null,
  !checks.localAppleRerankerCanaryPresent ? "missing-local-apple-reranker-sidecar-result" : null,
  !checks.llmQueryExpansionLiveCanaryPresent ? "missing-live-llm-query-expansion-result" : null,
  !checks.sameDataControlRowsPresent ? "missing-same-data-control-row" : null,
  !checks.sourceLockedTargetPresent ? "missing-source-locked-target" : null,
].filter(Boolean);

const report = {
  schemaVersion: 1,
  ok: true,
  mode: "public-benchmark-sota-ladder",
  status: blockers.length === 0 ? "READY_FOR_REVIEWED_MEMORY_CLAIM" : "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE",
  metricsOnly: true,
  publicSafe: true,
  writesRealFiles: Boolean(outputPath || markdownOutputPath),
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  printsCredentials: false,
  publicBenchmarkClaimsAllowed: blockers.length === 0,
  componentBenchmarksAreModelSelectionOnly: true,
  mtebCanSelectModelsButCannotProveMemoryQuality: true,
  generatedAt: new Date().toISOString(),
  evidenceFiles: Object.fromEntries(
    Object.entries(loaded).map(([key, value]) => [
      key,
      {
        path: value.path,
        exists: value.exists,
        hash: value.hash,
        mode: value.json?.mode ?? null,
        fixtureOnly: value.json?.fixtureOnly ?? null,
        retrievalProxyOnly: value.json?.retrievalProxyOnly ?? null,
        memoryBenchAnswerQuality: value.json?.memoryBenchAnswerQuality ?? null,
        publicBenchmarkClaimsAllowed: value.json?.publicBenchmarkClaimsAllowed ?? null,
      },
    ]),
  ),
  componentEvidence,
  queryExpansionPolicy,
  reportedMemoryTargets,
  requiredFullMemoryArms: requiredArms,
  observedStrategies: allStrategies,
  bestObservedRows: summarizeBestRows(rows),
  checks,
  blockers,
  nextActions: nextActions(blockers),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "sota ladder report");
assertSafePublicText(markdownText, "sota ladder markdown report");

if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(args.format === "markdown" ? markdownText : jsonText);
if (strict && blockers.length > 0) process.exit(1);

function collectRows(loadedEvidence) {
  const rowsOut = [];
  for (const [sourceKey, evidence] of Object.entries(loadedEvidence)) {
    const json = evidence.json;
    if (!json || typeof json !== "object") continue;
    for (const row of json.strategies ?? json.arms ?? []) {
      rowsOut.push({
        sourceKey,
        sourcePath: evidence.path,
        strategy: row.strategy ?? row.armId ?? null,
        metrics: row.metrics ?? null,
        fixtureOnly: Boolean(json.fixtureOnly),
        retrievalProxyOnly: Boolean(json.retrievalProxyOnly),
        memoryBenchAnswerQuality: Boolean(json.memoryBenchAnswerQuality),
        publicBenchmarkClaimsAllowed: Boolean(json.publicBenchmarkClaimsAllowed),
      });
    }
  }
  return rowsOut;
}

function summarizeBestRows(rowsIn) {
  const scored = rowsIn.filter((row) => Number.isFinite(Number(row.metrics?.quality)));
  const bestByStrategy = new Map();
  for (const row of scored) {
    const current = bestByStrategy.get(row.strategy);
    const quality = Number(row.metrics.quality);
    const latency = Number(row.metrics.latencyP50Ms ?? Number.POSITIVE_INFINITY);
    const currentQuality = Number(current?.metrics?.quality ?? Number.NEGATIVE_INFINITY);
    const currentLatency = Number(current?.metrics?.latencyP50Ms ?? Number.POSITIVE_INFINITY);
    if (!current || quality > currentQuality || (quality === currentQuality && latency < currentLatency)) {
      bestByStrategy.set(row.strategy, row);
    }
  }
  return [...bestByStrategy.values()]
    .sort((a, b) => Number(b.metrics.quality) - Number(a.metrics.quality) || Number(a.metrics.latencyP50Ms ?? 0) - Number(b.metrics.latencyP50Ms ?? 0))
    .slice(0, 12)
    .map((row) => ({
      strategy: row.strategy,
      sourcePath: row.sourcePath,
      quality: row.metrics.quality,
      pAt1: row.metrics.pAt1,
      recallAt5: row.metrics.recallAt5,
      ndcgAt10: row.metrics.ndcgAt10,
      latencyP50Ms: row.metrics.latencyP50Ms,
      retrievalProxyOnly: row.retrievalProxyOnly,
      memoryBenchAnswerQuality: row.memoryBenchAnswerQuality,
      publicBenchmarkClaimsAllowed: row.publicBenchmarkClaimsAllowed,
    }));
}

function nextActions(blockersIn) {
  if (blockersIn.length === 0) {
    return [
      "Package the metrics-only result and send it to independent reviewers.",
      "Run the UI, docs, and release-note checks against the reviewed result before launch.",
    ];
  }
  return [
    "Use MTEB and model-card evidence only to choose embedding and reranker candidates.",
    "Run the full same-data memory benchmark ladder before any SOTA or production replacement claim.",
    "Add live NVIDIA or Gemini provider results, plus a local Apple reranker-sidecar result, on the same source-locked target.",
    "Test LLM query expansion as its own arm: local small-model first where practical, or a clearly labeled cloud-only query-expansion substep if local hardware is the bottleneck.",
    "Promote no method until an end-to-end memory score beats the reported target under matching metric definitions.",
    "Send the exact metrics-only packet to Gemini/Claude or NVIDIA/DeepSeek-style reviewers before release wording changes.",
  ];
}

function renderMarkdown(value) {
  const lines = [
    "# Public Benchmark SOTA Ladder",
    "",
    `- Status: ${value.status}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- MTEB/component evidence is model-selection only: ${value.componentBenchmarksAreModelSelectionOnly}`,
    "",
    "## Blockers",
    ...(value.blockers.length ? value.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Required Full Memory Arms",
    ...value.requiredFullMemoryArms.map((arm) => `- ${arm.id}: ${arm.status} (${arm.role})`),
    "",
    "## Best Observed Rows",
    ...value.bestObservedRows.map(
      (row) =>
        `- ${row.strategy}: quality ${row.quality}, P@1 ${row.pAt1}, nDCG@10 ${row.ndcgAt10}, p50 ${row.latencyP50Ms} ms, retrievalProxyOnly=${row.retrievalProxyOnly}`,
    ),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ];
  return lines.join("\n");
}

function hasStrategy(rowsIn, strategy) {
  return rowsIn.some((row) => row.strategy === strategy);
}

function hasAnyStrategy(rowsIn, strategies) {
  const wanted = new Set(strategies);
  return rowsIn.some((row) => wanted.has(row.strategy));
}

function loadEvidence(file) {
  const path = file;
  const abs = resolve(root, file);
  if (!existsSync(abs)) return { path, exists: false, hash: null, json: null };
  const text = readFileSync(abs, "utf8");
  assertSafePublicText(text, file);
  let json = null;
  if (file.endsWith(".json")) json = JSON.parse(text);
  return { path, exists: true, hash: `sha256:${sha256(text)}`, json };
}

function writeOutput(path, text) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, text, { encoding: "utf8", mode: 0o600 });
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

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function assertSafePublicText(text, label) {
  const secretPattern =
    /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
  assert.ok(!secretPattern.test(text), `${label} appears to contain a credential`);
}
