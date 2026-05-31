import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture) || !args.live;
const outputPath = args.output ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_METHOD_LADDER_REPORT ?? null;
const markdownOutputPath = args.markdownOutput ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_METHOD_LADDER_MARKDOWN ?? null;
const format = String(args.format ?? "json").toLowerCase();
const targetPath = resolveInputPath(
  args.target ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_TARGET ?? "reviews/overnight-20260522/public-longmemeval-full-run-target.json",
);
const methods = splitList(
  args.methods ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_MEMORY_METHODS ?? "session-v1,contextual-source-chunk-v1,contextual-index-source-chunk-v1",
);
const strategies = splitList(args.strategies ?? process.env.RECALLWEAVE_PUBLIC_BENCHMARK_METHOD_STRATEGIES ?? "bm25-lite,full-hybrid-rerank");
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? process.env.RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 5, "limit");
const maxQueries = optionalPositiveInt(args.maxQueries ?? process.env.RECALLWEAVE_BASELINE_MAX_QUERIES ?? 10, "max queries");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? process.env.RECALLWEAVE_BASELINE_QUERY_OFFSET ?? 0, "query offset");
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? process.env.RECALLWEAVE_BASELINE_MAX_MEMORY_BYTES ?? 300_000_000, "max memory bytes");

const memoryMethods = ["session-v1", "contextual-source-chunk-v1", "contextual-index-source-chunk-v1"];
const retrievalStrategies = ["bm25-lite", "full-hybrid-rerank"];
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|\/tmp\/[^/\s"]+|\/home\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
assert.ok(methods.length >= 2, "method ladder needs at least two memory methods");
assert.ok(strategies.length >= 1, "method ladder needs at least one retrieval strategy");
for (const method of methods) assert.ok(memoryMethods.includes(method), `unknown memory method: ${method}`);
for (const strategy of strategies) assert.ok(retrievalStrategies.includes(strategy), `unknown method-ladder strategy: ${strategy}`);
if (fixtureRequested) assert.equal(queryOffset, 0, "--query-offset is only supported for live method ladders");

const runRoot = mkdtempSync(resolve(tmpdir(), "recallweave-method-ladder-"));
const materializations = [];
const rows = [];

for (const method of methods) {
  const methodDir = resolve(runRoot, method);
  mkdirSync(methodDir, { recursive: true, mode: 0o700 });
  const materializerPath = resolve(methodDir, "materialize.json");
  runNode([
    "packages/bench/public-benchmark-materialize-run.mjs",
    fixtureRequested ? "--fixture" : "--live",
    "--memory-method",
    method,
    "--private-output-dir",
    methodDir,
    "--context-token-budget",
    String(contextTokenBudget),
    "--limit",
    String(limit),
    ...(fixtureRequested ? [] : ["--target", targetPath]),
    ...(maxQueries ? ["--max-queries", String(maxQueries)] : []),
    ...(queryOffset ? ["--query-offset", String(queryOffset)] : []),
    "--format",
    "json",
    "--output",
    materializerPath,
  ]);
  const materialize = JSON.parse(readFileSync(materializerPath, "utf8"));
  materializations.push(materializationSummary(method, materialize));

  for (const strategy of strategies) {
    const responsePath = resolve(methodDir, `${strategy}-responses.json`);
    const resultPath = resolve(methodDir, `${strategy}-metrics.json`);
    const commonEnv = {
      RECALLWEAVE_BASELINE_LIVE: "1",
      RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
      SELFMEM_SUPERMEMORY_SEARCH_DISABLED: "1",
      RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH: "1",
    };
    runNode(
      [
        "packages/bench/recallweave-response-export.mjs",
        "--live",
        "--queryset",
        resolve(methodDir, "longmemeval-queryset.private.json"),
        "--memories",
        resolve(methodDir, "longmemeval-memories.private.jsonl"),
        "--preserve-ids",
        "--strategy",
        strategy,
        "--context-token-budget",
        String(contextTokenBudget),
        "--limit",
        String(limit),
        "--max-memory-bytes",
        String(maxMemoryBytes),
        "--output",
        responsePath,
      ],
      commonEnv,
    );
    runNode(
      [
        "packages/bench/recallweave-baseline-collector.mjs",
        "--live",
        "--queryset",
        resolve(methodDir, "longmemeval-queryset.private.json"),
        "--responses",
        responsePath,
        "--retrieval-mode",
        `strategy:${strategy}`,
        "--judge-model",
        "retrieval-proxy",
        "--answer-model",
        "retrieval-proxy",
        "--limit",
        String(limit),
        "--output",
        resultPath,
      ],
      commonEnv,
    );
    rows.push(rowSummary({ method, strategy, responsePath, resultPath }));
  }
}

const winner = [...rows].sort((a, b) => b.quality - a.quality || b.pAt1 - a.pAt1 || a.latencyP50Ms - b.latencyP50Ms)[0] ?? null;
const chunkRows = rows.filter((row) => row.method !== "session-v1");
const bestChunk = [...chunkRows].sort((a, b) => b.quality - a.quality || b.pAt1 - a.pAt1 || a.latencyP50Ms - b.latencyP50Ms)[0] ?? null;
const selectedHashes = new Set(materializations.map((item) => item.selectedQuestionIdsHash));
const report = {
  schemaVersion: 1,
  ok: true,
  evidenceType: "memory-method-retrieval-proxy-ladder",
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  metricsOnly: true,
  retrievalProxyOnly: true,
  memoryBenchAnswerQuality: false,
  publicBenchmarkClaimsAllowed: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  printsCredentials: false,
  benchmark: "longmemeval",
  fixtureOnly: fixtureRequested,
  claimBoundary: "retrieval-proxy memory-method diagnostic only; not answer-quality, production, or SOTA evidence",
  queryShard: {
    startIndex: queryOffset,
    endIndexExclusive: maxQueries ? queryOffset + maxQueries : null,
    requestedLimit: maxQueries,
    sameRawQuerySelectionAcrossMethods: selectedHashes.size === 1,
    selectedQuestionIdsHash: selectedHashes.size === 1 ? [...selectedHashes][0] : null,
  },
  contextTokenBudget,
  limit,
  methods,
  strategies,
  materializations,
  rows,
  winner,
  bestChunkMethod: bestChunk,
  interpretation: interpretation({ winner, bestChunk }),
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "memory method ladder report");
assertSafePublicText(markdownText, "memory method ladder markdown");
if (outputPath) writeOutput(resolveOutput(outputPath), jsonText);
if (markdownOutputPath) writeOutput(resolveOutput(markdownOutputPath), markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);

function materializationSummary(method, materialize) {
  return {
    method,
    selectedQuestionIdsHash: materialize.selection?.selectedQuestionIdsHash ?? null,
    queryCount: materialize.selection?.queryCount ?? null,
    haystackSessionCount: materialize.selection?.haystackSessionCount ?? null,
    memoryRecordCount: materialize.selection?.memoryRecordCount ?? null,
    contextualSourceChunkCount: materialize.selection?.contextualSourceChunkCount ?? null,
    contextualIndexMemoryCount: materialize.selection?.contextualIndexMemoryCount ?? null,
    expectedResultRefCount: materialize.selection?.expectedResultRefCount ?? null,
    querySetHash: materialize.selection?.querySetHash ?? null,
    collectorCompatibleQuerySetHash: materialize.selection?.collectorCompatibleQuerySetHash ?? null,
    memoriesFileHash: materialize.selection?.memoriesFileHash ?? null,
  };
}

function rowSummary(input) {
  const metrics = JSON.parse(readFileSync(input.resultPath, "utf8"));
  const responses = JSON.parse(readFileSync(input.responsePath, "utf8"));
  const resultIds = Object.values(responses.responses ?? {}).flatMap((response) => (response.results ?? []).map((item) => String(item.id ?? "")));
  return {
    method: input.method,
    strategy: input.strategy,
    quality: metrics.metrics?.quality ?? null,
    pAt1: metrics.metrics?.pAt1 ?? null,
    recallAt5: metrics.metrics?.recallAt5 ?? null,
    recallAt10: metrics.metrics?.recallAt10 ?? null,
    ndcgAt10: metrics.metrics?.ndcgAt10 ?? null,
    latencyP50Ms: metrics.metrics?.latencyP50Ms ?? null,
    queryCount: metrics.queryCount ?? null,
    expectedResultRefCount: metrics.querySetEvidence?.expectedResultRefCount ?? null,
    skippedSourceOnly: responses.inputStats?.skippedSourceOnly ?? null,
    resultIdMode: resultIds.some((id) => id.includes("#chunk-")) ? "source-chunk-or-mixed" : "session-or-memory",
    querySetHash: metrics.querySetHash ?? null,
    responsesHash: `sha256:${fileHash(input.responsePath)}`,
    resultHash: `sha256:${fileHash(input.resultPath)}`,
  };
}

function interpretation(input) {
  if (!input.winner) return "No completed rows. Treat this as a harness failure.";
  if (input.winner.method === "session-v1") {
    return "The session-level control still wins this retrieval-proxy ladder. Chunked methods should not be promoted from this evidence alone; use answer-quality scoring to test whether finer source rehydration helps final answers despite lower proxy recall.";
  }
  if (input.bestChunk?.method === "contextual-index-source-chunk-v1") {
    return "The contextual index is the best chunked method on this ladder. It may deserve a larger answer-quality shard before promotion.";
  }
  return "A chunked method won the retrieval-proxy ladder, but answer-quality scoring is still required before promotion.";
}

function renderMarkdown(value) {
  const rows = [
    "# Memory Method Retrieval-Proxy Ladder",
    "",
    `- Fixture only: ${value.fixtureOnly}`,
    `- Query shard: ${value.queryShard.startIndex} to ${value.queryShard.endIndexExclusive ?? "end"}`,
    `- Same raw query selection: ${value.queryShard.sameRawQuerySelectionAcrossMethods}`,
    `- Context token budget: ${value.contextTokenBudget}`,
    `- Limit: ${value.limit}`,
    `- Claim boundary: ${value.claimBoundary}`,
    "",
    "## Results",
    "",
    "| Method | Strategy | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | Expected refs |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...value.rows.map(
      (row) =>
        `| ${row.method} | ${row.strategy} | ${row.quality} | ${row.pAt1} | ${row.recallAt5} | ${row.ndcgAt10} | ${row.latencyP50Ms} | ${row.expectedResultRefCount} |`,
    ),
    "",
    "## Materialization",
    "",
    "| Method | Queries | Sessions | Records | Source chunks | Index records | Expected refs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...value.materializations.map(
      (item) =>
        `| ${item.method} | ${item.queryCount} | ${item.haystackSessionCount} | ${item.memoryRecordCount} | ${item.contextualSourceChunkCount} | ${item.contextualIndexMemoryCount} | ${item.expectedResultRefCount} |`,
    ),
    "",
    "## Interpretation",
    "",
    value.interpretation,
  ];
  return rows.join("\n");
}

function runNode(commandArgs, extraEnv = {}) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const message = [result.stderr, result.stdout].filter(Boolean).join("\n").slice(0, 4000);
    throw new Error(`command failed: ${commandArgs[0]} ${message}`);
  }
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, privateTagPattern, `${label} contains private tags`);
  assert.doesNotMatch(text, /"\s*(?:content|memory|text|raw|rawText|document)"\s*:/i, `${label} contains raw content fields`);
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function resolveOutput(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileHash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
  return number;
}

function optionalPositiveInt(value, label) {
  if (value == null || value === "") return null;
  return positiveInt(value, label);
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "") return 0;
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number >= 0, `${label} must be a non-negative integer`);
  return number;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item.startsWith("--")) {
      const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
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
