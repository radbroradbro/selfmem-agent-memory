import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const targetPath = resolveInputPath(args.target ?? "reviews/overnight-20260522/public-longmemeval-full-run-target.json");
const privateInputDir = resolvePrivateInputDir(args.privateInputDir ?? process.env.RECALLWEAVE_SOTA_PRIVATE_INPUT_DIR ?? null);
const privateOutputDir = resolvePrivateOutputDir(args.privateOutputDir ?? process.env.RECALLWEAVE_SOTA_CONTROL_PROBE_OUTPUT_DIR ?? null);
const outputPath = args.output ? resolveInputPath(args.output) : null;
const markdownOutputPath = args.markdownOutput ?? args.markdown ? resolveInputPath(args.markdownOutput ?? args.markdown) : null;
const format = String(args.format ?? "json").toLowerCase();
const strategies = splitList(args.strategies ?? "bm25-lite,full-hybrid-rerank,query-expanded-full-hybrid-rerank");
const queryOffset = optionalNonNegativeInt(args.queryOffset ?? 0, "query offset");
const maxQueries = positiveInt(args.maxQueries ?? 25, "max queries");
const contextTokenBudget = positiveInt(args.contextTokenBudget ?? 800, "context token budget");
const limit = positiveInt(args.limit ?? 5, "limit");
const maxMemoryBytes = positiveInt(args.maxMemoryBytes ?? 300_000_000, "max memory bytes");

const allowedStrategies = new Set(["bm25-lite", "full-hybrid-rerank", "query-expanded-full-hybrid-rerank"]);
const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern = /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(["json", "markdown"].includes(format), "--format must be json or markdown");
for (const strategy of strategies) assert.ok(allowedStrategies.has(strategy), `control probe cannot run provider strategy: ${strategy}`);
assert.ok(existsSync(targetPath), `target missing: ${displayPath(targetPath)}`);
assert.ok(privateInputDir && existsSync(privateInputDir), "private input directory missing");
assertOutsideRepo(privateInputDir, "private input directory");
assertOutsideRepo(privateOutputDir, "private output directory");
mkdirSync(privateOutputDir, { recursive: true, mode: 0o700 });

const targetRaw = readFileSync(targetPath, "utf8");
assertSafePublicText(targetRaw, "target");
const target = JSON.parse(targetRaw);
assert.equal(target.fixtureOnly, false, "target must be live run-only target");
assert.equal(target.claimTier, "run-only", "target must remain run-only");
assert.equal(target.benchmark?.family, "longmemeval", "target must be LongMemEval");

const querySetPath = join(privateInputDir, "longmemeval-queryset.private.json");
const memoriesPath = join(privateInputDir, "longmemeval-memories.private.jsonl");
assert.ok(existsSync(querySetPath), "private queryset missing");
assert.ok(existsSync(memoriesPath), "private memories missing");

const arms = strategies.map((strategy) => exportStrategy(strategy));
const allExported = arms.every((arm) => arm.exported);
const allNoProviderCalls = arms.every((arm) => arm.providerCallsMade === 0);
const allShardCoverage = arms.every((arm) => arm.responseCount === maxQueries && arm.queryShard?.startIndex === queryOffset);
const allPrivateFilesOutsideRepo = arms.every((arm) => arm.privateResponseFileOutsideRepo === true);
const allPrivateFilesMode0600 = arms.every((arm) => arm.privateResponseFileMode0600 === true);
const allPrivacyClean = arms.every((arm) => arm.privacyLeakCount === 0 && arm.redactionFailureCount === 0);
const totalQueryCount = firstPositiveNumber(
  target.benchmark?.queryCount,
  target.fullComparableBenchmarkCount,
  arms.find((arm) => Number.isFinite(Number(arm.queryShard?.totalQueryCount)))?.queryShard?.totalQueryCount,
  0,
);
const queryExpansionArm = arms.find((arm) => arm.strategy === "query-expanded-full-hybrid-rerank");
const report = {
  schemaVersion: 1,
  ok: allExported && allNoProviderCalls && allShardCoverage && allPrivateFilesOutsideRepo && allPrivateFilesMode0600 && allPrivacyClean,
  mode: "full-shard-control-export-probe",
  status:
    allExported && allNoProviderCalls && allShardCoverage && allPrivateFilesOutsideRepo && allPrivateFilesMode0600 && allPrivacyClean
      ? "READY_FULL_SHARD_CONTROL_EXPORT_PROBE"
      : "BLOCKED_FULL_SHARD_CONTROL_EXPORT_PROBE",
  generatedAt: new Date().toISOString(),
  publicSafe: true,
  metricsOnly: true,
  callsProviderApis: false,
  sendsBenchmarkTextToProvider: false,
  writesPrivateResponseFiles: true,
  privateResponseFileCommitted: false,
  countsAsFullMemorySotaEvidence: false,
  publicBenchmarkClaimsAllowed: false,
  rawQuestionIdsIncluded: false,
  rawQuestionsIncluded: false,
  rawAnswersIncluded: false,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawPrivateOutputPathIncluded: false,
  target: {
    path: displayPath(targetPath),
    targetHash: `sha256:${sha256(targetRaw)}`,
    queryCount: totalQueryCount,
    shardId: `shard-${String(Math.floor(queryOffset / maxQueries) + 1).padStart(3, "0")}`,
    startIndex: queryOffset,
    endIndexExclusive: queryOffset + maxQueries,
    responseCount: maxQueries,
    answerModel: target.benchmark?.answerModel ?? null,
    judgeModel: target.benchmark?.judgeModel ?? null,
  },
  privateInputs: {
    directoryLabel: "external-private-input-dir",
    outputDirectoryLabel: "external-private-output-dir",
    querysetHash: `sha256:${fileHash(querySetPath)}`,
    memoriesHash: `sha256:${fileHash(memoriesPath)}`,
    valuesPrinted: false,
  },
  limits: {
    contextTokenBudget,
    limit,
    maxMemoryBytes,
  },
  controls: {
    deterministicOnly: true,
    providerStrategiesExcluded: true,
    queryExpansionMode: queryExpansionArm?.queryExpansionFallbacks > 0 ? "deterministic-proxy" : "not-run",
    localModelEvidence: false,
    answerQualityEvidence: false,
  },
  arms,
  aggregate: {
    allResponseCountsMatch: allShardCoverage,
    allProviderCallsZero: allNoProviderCalls,
    allPrivateFilesOutsideRepo,
    allPrivateFilesMode0600,
    allPrivacyClean,
  },
  safety: {
    privacyLeakCount: sum(arms.map((arm) => arm.privacyLeakCount)),
    redactionFailureCount: sum(arms.map((arm) => arm.redactionFailureCount)),
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPromptIncluded: false,
    rawAnswerIncluded: false,
  },
  nextActions: [
    "Run the provider and live local-model shard arms after endpoints and explicit public-data consent are configured.",
    "Run answer-quality preflight only after every required private response arm exists for the selected shard.",
    "Keep this control probe separate from SOTA evidence; it proves runnable same-shard controls, not answer-quality superiority.",
  ],
};

const jsonText = `${JSON.stringify(report, null, 2)}\n`;
const markdownText = `${renderMarkdown(report)}\n`;
assertSafePublicText(jsonText, "full-shard control export probe");
assertSafePublicText(markdownText, "full-shard control export probe markdown");
if (outputPath) writeOutput(outputPath, jsonText);
if (markdownOutputPath) writeOutput(markdownOutputPath, markdownText);
process.stdout.write(format === "markdown" ? markdownText : jsonText);
if (!report.ok) process.exitCode = 1;

function exportStrategy(strategy) {
  const responsePath = join(privateOutputDir, `${strategy}-responses.private.json`);
  const started = Date.now();
  const result = spawnSync(
    "node",
    [
      "packages/bench/recallweave-response-export.mjs",
      "--live",
      "--preserve-ids",
      "--queryset",
      querySetPath,
      "--memories",
      memoriesPath,
      "--strategy",
      strategy,
      "--context-token-budget",
      String(contextTokenBudget),
      "--limit",
      String(limit),
      "--max-memory-bytes",
      String(maxMemoryBytes),
      "--query-offset",
      String(queryOffset),
      "--max-queries",
      String(maxQueries),
      "--output",
      responsePath,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: deterministicEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(result.status, 0, `response export failed for ${strategy}: ${safeError(result.stderr || result.stdout)}`);
  assert.ok(existsSync(responsePath), `${strategy} response export missing`);
  chmodSync(responsePath, 0o600);
  const raw = readFileSync(responsePath, "utf8");
  assertSafeResponseExport(raw, strategy);
  const parsed = JSON.parse(raw);
  const timings = Object.values(parsed.responses ?? {}).map((response) => Number(response.timing ?? 0)).filter(Number.isFinite);
  const provider = parsed.source?.provider ?? {};
  const mode = modeString(responsePath);
  return {
    strategy,
    exported: true,
    pathLabel: "external-private-response-file",
    name: basename(responsePath),
    privateResponseFileHash: `sha256:${sha256(raw)}`,
    privateResponseFileSizeBytes: statSync(responsePath).size,
    privateResponseFileOutsideRepo: isOutsideRepo(responsePath),
    privateResponseFileMode: mode,
    privateResponseFileMode0600: mode === "0600",
    querySetHash: parsed.querySetHash ?? null,
    queryShard: parsed.queryShard ?? null,
    responseCount: Object.keys(parsed.responses ?? {}).length,
    inputStats: parsed.inputStats ?? null,
    contextBudget: parsed.contextBudget ?? null,
    featureProfile: parsed.inputStats?.featureProfile ?? null,
    providerStrategy: Boolean(provider.providerStrategy),
    providerCallsMade: Number(provider.providerCallsMade ?? 0),
    providerMockCalls: Number(provider.providerMockCalls ?? 0),
    queryExpansionCalls: Number(provider.queryExpansionCalls ?? 0),
    queryExpansionFallbacks: Number(provider.queryExpansionFallbacks ?? 0),
    timingMs: timingSummary(timings, { observedWallSeconds: Math.max(1, Math.round((Date.now() - started) / 1000)) }),
    privacyLeakCount: Number(parsed.privacyLeakCount ?? 0),
    redactionFailureCount: Number(parsed.redactionFailureCount ?? 0),
  };
}

function renderMarkdown(value) {
  return [
    "# Full-Shard Control Export Probe",
    "",
    `- Status: ${value.status}`,
    `- Shard: ${value.target.shardId} (${value.target.startIndex}-${value.target.endIndexExclusive})`,
    `- Calls provider APIs: ${value.callsProviderApis}`,
    `- Sends benchmark text to provider: ${value.sendsBenchmarkTextToProvider}`,
    `- Counts as full memory SOTA evidence: ${value.countsAsFullMemorySotaEvidence}`,
    `- Public benchmark claims allowed: ${value.publicBenchmarkClaimsAllowed}`,
    `- Private response file committed: ${value.privateResponseFileCommitted}`,
    `- Query expansion mode: ${value.controls.queryExpansionMode}`,
    `- All response counts match: ${value.aggregate.allResponseCountsMatch}`,
    `- All provider calls zero: ${value.aggregate.allProviderCallsZero}`,
    `- All private files outside repo: ${value.aggregate.allPrivateFilesOutsideRepo}`,
    `- All private files mode 0600: ${value.aggregate.allPrivateFilesMode0600}`,
    `- All privacy checks clean: ${value.aggregate.allPrivacyClean}`,
    "",
    "## Arms",
    ...value.arms.map(
      (arm) =>
        `- ${arm.strategy}: responses=${arm.responseCount}, candidates=${arm.inputStats?.candidates ?? 0}, p50Ms=${arm.timingMs.p50}, wallSeconds=${arm.timingMs.observedWallSeconds}, providerCalls=${arm.providerCallsMade}, fileHash=${arm.privateResponseFileHash}`,
    ),
    "",
    "## Next Actions",
    ...value.nextActions.map((item) => `- ${item}`),
  ].join("\n");
}

function resolvePrivateInputDir(value) {
  if (value) return resolveInputPath(value);
  const pointer = "/tmp/recallweave-sota-full-current-path";
  if (!existsSync(pointer)) return null;
  const runRoot = readFileSync(pointer, "utf8").trim();
  return join(runRoot, "full-materialized");
}

function resolvePrivateOutputDir(value) {
  if (value) return resolveInputPath(value);
  const pointer = "/tmp/recallweave-sota-full-current-path";
  if (existsSync(pointer)) return join(readFileSync(pointer, "utf8").trim(), "full-materialized", "arms", "shard-001-control-probe");
  return resolve("/tmp", `recallweave-control-probe-${Date.now()}`);
}

function deterministicEnv() {
  const env = { ...process.env };
  for (const key of [
    "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS",
    "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA",
    "RECALLWEAVE_QUERY_EXPANSION_CALLS",
    "SELFMEM_QUERY_EXPANSION_BASE_URL",
    "SELFMEM_QUERY_EXPANSION_MODEL",
  ]) {
    delete env[key];
  }
  env.RECALLWEAVE_BASELINE_LIVE = "1";
  env.RECALLWEAVE_BASELINE_NO_RAW_TEXT = "1";
  return env;
}

function assertSafeResponseExport(raw, strategy) {
  assertNoPattern(raw, secretPattern, `${strategy} response export contains a key-shaped secret`);
  assertNoPattern(raw, privatePathPattern, `${strategy} response export contains a private path`);
  assertNoPattern(raw, privateTagPattern, `${strategy} response export contains private tags`);
  assertNoPattern(raw, /\b(content|memory|text|raw|rawText|document|prompt)"\s*:/, `${strategy} response export contains raw text fields`);
}

function assertSafePublicText(text, label) {
  assertNoPattern(text, secretPattern, `${label} contains a key-shaped secret`);
  assertNoPattern(text, privatePathPattern, `${label} contains a private path`);
  assertNoPattern(text, privateTagPattern, `${label} contains private tags`);
  assertNoPattern(text, /\b(q|answer|content|memory|text|raw|prompt)"\s*:/, `${label} contains raw text-like fields`);
}

function assertNoPattern(text, pattern, message) {
  pattern.lastIndex = 0;
  if (pattern.test(String(text))) throw new Error(message);
}

function timingSummary(values, { observedWallSeconds }) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    min: sorted[0] ?? 0,
    p50: percentile(sorted, 0.5),
    max: sorted.at(-1) ?? 0,
    average: sorted.length ? Math.round(sum(sorted) / sorted.length) : 0,
    observedWallSeconds,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))] ?? 0;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    const value = !next || next.startsWith("--") ? true : next;
    if (parsed[key] == null) parsed[key] = value;
    else if (Array.isArray(parsed[key])) parsed[key].push(value);
    else parsed[key] = [parsed[key], value];
    if (value !== true) index += 1;
  }
  return parsed;
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveInputPath(value) {
  return isAbsolute(String(value ?? "")) ? String(value ?? "") : resolve(root, String(value ?? ""));
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? "external-input" : rel;
}

function assertOutsideRepo(path, label) {
  assert.ok(isOutsideRepo(path), `${label} must stay outside the repository`);
}

function isOutsideRepo(path) {
  const rel = relative(root, resolve(path));
  return rel.startsWith("..") || isAbsolute(rel);
}

function modeString(path) {
  return `0${(statSync(path).mode & 0o777).toString(8)}`.slice(-4);
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: "utf8", mode: 0o600 });
}

function fileHash(path) {
  return sha256(readFileSync(path, "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function positiveInt(value, label) {
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function optionalNonNegativeInt(value, label) {
  if (value == null || value === "" || value === false) return 0;
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed) && parsed >= 0, `${label} must be a non-negative integer`);
  return parsed;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function safeError(value) {
  return String(value ?? "")
    .replace(secretPattern, "[REDACTED_SECRET]")
    .replace(privatePathPattern, "external-input")
    .slice(0, 2000);
}
