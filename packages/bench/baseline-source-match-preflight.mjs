import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const hasExplicitQuerySet = Boolean(args.queryset ?? args.querySet ?? process.env.RECALLWEAVE_BASELINE_QUERYSET);
const hasExplicitSource = Boolean(
  args.memories ??
    args.memoriesJsonl ??
    process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ??
    args.containerDir ??
    process.env.RECALLWEAVE_BASELINE_CONTAINER_DIR,
);
const fixtureRequested = Boolean(args.fixture) || (!hasExplicitQuerySet && !hasExplicitSource);
const strict = Boolean(args.strict);
const liveRequested = Boolean(args.live) || process.env.RECALLWEAVE_BASELINE_LIVE === "1";
const querySetPath = resolveInputPath(
  args.queryset ??
    args.querySet ??
    process.env.RECALLWEAVE_BASELINE_QUERYSET ??
    (fixtureRequested ? "packages/bench/fixtures/hosted-baseline-queryset.fixture.json" : null),
);
const memoriesPath = resolveInputPath(
  args.memories ??
    args.memoriesJsonl ??
    process.env.RECALLWEAVE_BASELINE_MEMORIES_JSONL ??
    (fixtureRequested ? "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl" : null),
);
const containerDir = resolveInputPath(args.containerDir ?? process.env.RECALLWEAVE_BASELINE_CONTAINER_DIR ?? null);
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_SOURCE_MATCH_OUTPUT_JSON ?? null;
const preserveIds = fixtureRequested || args.preserveIds === true || process.env.RECALLWEAVE_BASELINE_PRESERVE_IDS === "1";

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const privatePathPattern =
  /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*)/i;
const privateTagPattern = /<private>[\s\S]*?(?:<\/private>|$)/gi;

assert.ok(querySetPath, "query set is required. Pass --queryset or RECALLWEAVE_BASELINE_QUERYSET");
assert.ok(existsSync(querySetPath), `query set missing: ${displayPath(querySetPath)}`);
assert.ok(statSync(querySetPath).size > 0, `query set empty: ${displayPath(querySetPath)}`);

const effectiveMemoriesPath = memoriesPath ?? (containerDir ? join(containerDir, "memories.jsonl") : null);
assert.ok(effectiveMemoriesPath, "memories input is required. Pass --memories, --container-dir, or RECALLWEAVE_BASELINE_MEMORIES_JSONL");
assert.ok(existsSync(effectiveMemoriesPath), `memories file missing: ${displayPath(effectiveMemoriesPath)}`);
assert.ok(statSync(effectiveMemoriesPath).size > 0, `memories file empty: ${displayPath(effectiveMemoriesPath)}`);
assert.ok(statSync(effectiveMemoriesPath).size <= 5_000_000, `memories file too large for source-match preflight: ${displayPath(effectiveMemoriesPath)}`);

if (!fixtureRequested) {
  assert.equal(liveRequested, true, "live source-match preflight requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.equal(process.env.RECALLWEAVE_BASELINE_NO_RAW_TEXT, "1", "set RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 before live source-match preflight");
}

const querySetRaw = readFileSync(querySetPath, "utf8");
assert.doesNotMatch(querySetRaw, secretPattern, `${displayPath(querySetPath)} contains a key-shaped secret`);
assert.doesNotMatch(querySetRaw, privatePathPattern, `${displayPath(querySetPath)} contains a private path`);
const querySet = JSON.parse(querySetRaw);
const queries = Array.isArray(querySet.queries) ? querySet.queries : [];
assert.ok(queries.length > 0, "query set must contain at least one query");
for (const query of queries) {
  assert.ok(typeof query.id === "string" && query.id.trim(), "each query needs an id");
  assert.ok(typeof query.q === "string" && query.q.trim(), `query ${query.id} needs q`);
}

const loaded = loadMemories(effectiveMemoriesPath, { preserveIds });
const querySetEvidence = summarizeQuerySetEvidence(queries);
const sourceMatch = summarizeSourceMatch(queries, loaded);
const failedChecks = failedSourceMatchChecks(querySetEvidence, sourceMatch);
const sourceMatchReady = failedChecks.length === 0;

const report = {
  ok: sourceMatchReady,
  mode: "baseline-source-match-preflight",
  schemaVersion: 1,
  fixtureOnly: fixtureRequested || querySet.fixtureOnly === true,
  writesRealFiles: Boolean(outputPath),
  metricsOnly: true,
  publicSafe: true,
  sourceMatchReady,
  rawQueryIncluded: false,
  rawExpectedIdsIncluded: false,
  rawExpectedHashesIncluded: false,
  rawMemoryIncluded: false,
  privateLeakCount: 0,
  hasSecretPattern: false,
  source: {
    querySetFile: displayPath(querySetPath),
    memoriesFileName: basename(effectiveMemoriesPath),
    containerDirHash: containerDir ? shortHash(containerDir) : null,
    memoriesFileHash: `sha256:${fileHash(effectiveMemoriesPath)}`,
    outputIdMode: preserveIds ? "preserve-ids" : "hashed-ids",
    querySetHash: `sha256:${stableHash({
      schemaVersion: querySet.schemaVersion ?? 1,
      datasetSlice: querySet.datasetSlice ?? null,
      queries: queries.map((query) => ({
        id: query.id,
        q: query.q,
        expectedResultIds: query.expectedResultIds ?? [],
        expectedResultHashes: query.expectedResultHashes ?? [],
      })),
    })}`,
  },
  querySetEvidence,
  localSourceEvidence: {
    linesRead: loaded.linesRead,
    parsed: loaded.parsed,
    candidateCount: loaded.candidates.length,
    skippedInvalid: loaded.skippedInvalid,
    skippedFullyPrivate: loaded.skippedFullyPrivate,
    redactionCount: loaded.redactionCount,
    keyRedactionCount: loaded.keyRedactionCount,
    uniqueExportIdCount: loaded.outputIds.size,
    uniqueSourceIdCount: loaded.sourceIds.size,
    uniqueContentHashCount: loaded.contentHashes.size,
  },
  sourceMatchEvidence: sourceMatch.summary,
  queryFingerprints: sourceMatch.queryFingerprints,
  failedChecks,
  nextActions: sourceMatchReady
    ? [
        "Run baseline:run with this reviewed query set and local container before making any public comparison claim.",
        "Attach this metrics-only source-match preflight report with the hosted/local evidence packet.",
      ]
    : [
        "Mirror the selected hosted source into the local RecallWeave container or rebuild the query labels from this local source.",
        "Prefer expected content hashes for cross-system source matching when raw ids are not stable across hosted and local stores.",
        "Rerun baseline:source-match -- --queryset <path> --container-dir <local-container> --strict before the next hosted/local run.",
      ],
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assertSafePublicText(serialized, "source-match preflight report");
if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);
if (strict && !sourceMatchReady) process.exit(1);

function summarizeSourceMatch(queries, loaded) {
  const queryFingerprints = queries.map((query) => {
    const expectedIds = arrayOfStrings(query.expectedResultIds);
    const expectedHashes = arrayOfStrings(query.expectedResultHashes).map(normalizeHashRef);
    const exportIdMatches = expectedIds.filter((id) => loaded.outputIds.has(id)).length;
    const sourceIdMatches = expectedIds.filter((id) => loaded.sourceIds.has(id)).length;
    const contentHashMatches = expectedHashes.filter((hash) => loaded.contentHashes.has(hash)).length;
    const sourceIdOnlyMatches = Math.max(0, sourceIdMatches - exportIdMatches);
    const collectableMatches = exportIdMatches + contentHashMatches;
    const sourceMatches = sourceIdMatches + contentHashMatches;
    return {
      queryIdHash: shortHash(query.id),
      queryHash: shortHash(query.q),
      expectedRefCount: expectedIds.length + expectedHashes.length,
      expectedIdRefCount: expectedIds.length,
      expectedHashRefCount: expectedHashes.length,
      exportIdMatchCount: exportIdMatches,
      sourceIdMatchCount: sourceIdMatches,
      contentHashMatchCount: contentHashMatches,
      sourceIdOnlyMatchCount: sourceIdOnlyMatches,
      collectableMatchCount: collectableMatches,
      hasSourceMatch: sourceMatches > 0,
      hasCollectableMatch: collectableMatches > 0,
    };
  });
  const summary = {
    queryCount: queryFingerprints.length,
    sourceMatchedQueryCount: queryFingerprints.filter((query) => query.hasSourceMatch).length,
    collectableQueryCount: queryFingerprints.filter((query) => query.hasCollectableMatch).length,
    missingQueryCount: queryFingerprints.filter((query) => !query.hasSourceMatch).length,
    nonCollectableQueryCount: queryFingerprints.filter((query) => query.hasSourceMatch && !query.hasCollectableMatch).length,
    expectedRefCount: queryFingerprints.reduce((sum, query) => sum + query.expectedRefCount, 0),
    matchedSourceRefCount: queryFingerprints.reduce((sum, query) => sum + query.sourceIdMatchCount + query.contentHashMatchCount, 0),
    matchedCollectableRefCount: queryFingerprints.reduce((sum, query) => sum + query.collectableMatchCount, 0),
    exportIdMatchCount: queryFingerprints.reduce((sum, query) => sum + query.exportIdMatchCount, 0),
    sourceIdOnlyMatchCount: queryFingerprints.reduce((sum, query) => sum + query.sourceIdOnlyMatchCount, 0),
    contentHashMatchCount: queryFingerprints.reduce((sum, query) => sum + query.contentHashMatchCount, 0),
  };
  return { summary, queryFingerprints };
}

function failedSourceMatchChecks(querySetEvidence, sourceMatch) {
  const checks = [];
  if (!querySetEvidence.publicBenchmarkReady) checks.push("query-set-not-public-benchmark-ready");
  if (sourceMatch.summary.queryCount !== sourceMatch.summary.sourceMatchedQueryCount) checks.push("local-source-missing-expected-refs");
  if (sourceMatch.summary.queryCount !== sourceMatch.summary.collectableQueryCount) checks.push("local-export-cannot-score-every-query");
  if (sourceMatch.summary.sourceIdOnlyMatchCount > 0) checks.push("source-id-only-matches-not-collectable-with-current-output-id-mode");
  return checks;
}

function summarizeQuerySetEvidence(queries) {
  const expectedRefCounts = queries.map(queryExpectedRefCount);
  const queryHashes = queries.map((query) => shortHash(query.q));
  const uniqueQueryCount = new Set(queryHashes).size;
  const duplicateQueryCount = queries.length - uniqueQueryCount;
  const minExpectedRefsPerQuery = expectedRefCounts.length ? Math.min(...expectedRefCounts) : 0;
  return {
    queryCount: queries.length,
    uniqueQueryCount,
    duplicateQueryCount,
    labeledQueryCount: expectedRefCounts.filter((count) => count > 0).length,
    unlabeledQueryCount: expectedRefCounts.filter((count) => count === 0).length,
    expectedResultRefCount: expectedRefCounts.reduce((sum, count) => sum + count, 0),
    minExpectedRefsPerQuery,
    usesExpectedIds: queries.some((query) => arrayOfStrings(query.expectedResultIds).length > 0),
    usesExpectedHashes: queries.some((query) => arrayOfStrings(query.expectedResultHashes).length > 0),
    publicBenchmarkReady: expectedRefCounts.every((count) => count > 0) && duplicateQueryCount === 0,
  };
}

function queryExpectedRefCount(query) {
  return arrayOfStrings(query.expectedResultIds).length + arrayOfStrings(query.expectedResultHashes).length;
}

function loadMemories(inputPath, options) {
  const raw = readFileSync(inputPath, "utf8");
  assert.doesNotMatch(raw, secretPattern, `${displayPath(inputPath)} contains a key-shaped secret`);
  assert.doesNotMatch(raw, privatePathPattern, `${displayPath(inputPath)} contains a private path`);
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const candidates = [];
  let parsed = 0;
  let skippedInvalid = 0;
  let skippedFullyPrivate = 0;
  let redactionCount = 0;
  let keyRedactionCount = 0;

  lines.forEach((line, index) => {
    try {
      const item = JSON.parse(line);
      parsed += 1;
      const text = extractMemoryText(item);
      if (!text.trim()) {
        skippedInvalid += 1;
        return;
      }
      const redacted = redactForExport(text);
      redactionCount += redacted.privateRedactionCount;
      keyRedactionCount += redacted.keyRedactionCount;
      if (!redacted.text.trim()) {
        skippedFullyPrivate += 1;
        return;
      }
      const sourceId = safeScalar(item.id ?? item.memory_id ?? item.memoryId ?? item.sourceId ?? `line-${index + 1}`);
      const contentHash = `sha256:${stableHash(normalizeText(redacted.text))}`;
      candidates.push({
        sourceId,
        outputId: options.preserveIds ? sourceId : `memory:${shortHash(sourceId)}`,
        contentHash,
      });
    } catch {
      skippedInvalid += 1;
    }
  });

  return {
    linesRead: lines.length,
    parsed,
    candidates,
    skippedInvalid,
    skippedFullyPrivate,
    redactionCount,
    keyRedactionCount,
    sourceIds: new Set(candidates.map((candidate) => candidate.sourceId)),
    outputIds: new Set(candidates.map((candidate) => candidate.outputId)),
    contentHashes: new Set(candidates.map((candidate) => candidate.contentHash)),
  };
}

function extractMemoryText(item) {
  if (!item || typeof item !== "object") return "";
  for (const key of ["content", "memory", "text", "summary", "value", "distilled", "replacementText"]) {
    if (typeof item[key] === "string") return item[key];
  }
  if (item.metadata && typeof item.metadata === "object") {
    for (const key of ["content", "memory", "text", "summary"]) {
      if (typeof item.metadata[key] === "string") return item.metadata[key];
    }
  }
  return "";
}

function redactForExport(text) {
  const privateMatches = text.match(privateTagPattern) ?? [];
  let redacted = text.replace(privateTagPattern, " ");
  const keyMatches = redacted.match(secretPattern) ?? [];
  redacted = redacted.replace(secretPattern, " ");
  return {
    text: redacted.replace(/\s+/g, " ").trim(),
    privateRedactionCount: privateMatches.length,
    keyRedactionCount: keyMatches.length,
  };
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHashRef(value) {
  const text = String(value ?? "").trim();
  return /^[a-f0-9]{64}$/i.test(text) ? `sha256:${text.toLowerCase()}` : text;
}

function safeScalar(value) {
  const text = String(value ?? "").trim() || "unknown";
  assert.doesNotMatch(text, secretPattern, "memory id contains a key-shaped secret");
  assert.doesNotMatch(text, privatePathPattern, "memory id contains a private path");
  return text.slice(0, 160);
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function assertSafePublicText(text, label) {
  assert.doesNotMatch(text, secretPattern, `${label} contains a key-shaped secret`);
  assert.doesNotMatch(text, privatePathPattern, `${label} contains a private path`);
  assert.doesNotMatch(text, privateTagPattern, `${label} contains private tags`);
  assert.doesNotMatch(text, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/i, `${label} contains raw query or memory fields`);
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  if (!rel.startsWith("../") && rel !== "..") return rel;
  return `external:${basename(value)}`;
}

function fileHash(path) {
  return stableHash(readFileSync(path, "utf8"));
}

function stableHash(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function shortHash(value) {
  return stableHash(String(value)).slice(0, 16);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
