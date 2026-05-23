import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = parseArgs(process.argv.slice(2));
const fixtureRequested = Boolean(args.fixture);
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
const outputPath = args.output ?? process.env.RECALLWEAVE_BASELINE_RESPONSES_JSON ?? null;
const limit = positiveInt(args.limit ?? process.env.RECALLWEAVE_BASELINE_LIMIT ?? 10, "limit");
const preserveIds = fixtureRequested || args.preserveIds === true || process.env.RECALLWEAVE_BASELINE_PRESERVE_IDS === "1";
const generatedAt = new Date().toISOString();

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
assert.ok(statSync(effectiveMemoriesPath).size <= 5_000_000, `memories file too large for metrics export: ${displayPath(effectiveMemoriesPath)}`);

if (!fixtureRequested) {
  assert.equal(liveRequested, true, "live RecallWeave response export requires --live or RECALLWEAVE_BASELINE_LIVE=1");
  assert.equal(process.env.RECALLWEAVE_BASELINE_NO_RAW_TEXT, "1", "set RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 before live response export");
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
assert.ok(loaded.candidates.length > 0, "memories input produced no searchable candidates");

const responses = {};
for (const query of queries) {
  const startedAt = performance.now();
  const ranked = rankCandidates(query.q, loaded.candidates).slice(0, limit);
  responses[query.id] = {
    timing: Math.max(1, Math.round(performance.now() - startedAt)),
    total: ranked.length,
    results: ranked.map((candidate) => ({
      id: candidate.outputId,
      contentHash: candidate.contentHash,
      score: candidate.score,
      estimatedTokens: candidate.estimatedTokens,
      source: "local_selfmem",
    })),
  };
}

const result = {
  schemaVersion: 1,
  fixtureOnly: fixtureRequested || querySet.fixtureOnly === true,
  evidenceType: fixtureRequested ? "fixture-recallweave-response-export" : "live-recallweave-response-export",
  metricsOnly: true,
  generatedAt,
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
  source: {
    kind: fixtureRequested ? "fixture-local-container" : "local-container-memories-jsonl",
    containerDirHash: containerDir ? shortHash(containerDir) : null,
    memoriesFileHash: `sha256:${fileHash(effectiveMemoriesPath)}`,
    memoriesFileName: basename(effectiveMemoriesPath),
    preserveIds,
  },
  privacyLeakCount: 0,
  redactionFailureCount: 0,
  rawMemoryIncluded: false,
  rawTranscriptIncluded: false,
  rawPromptIncluded: false,
  rawAnswerIncluded: false,
  inputStats: {
    linesRead: loaded.linesRead,
    parsed: loaded.parsed,
    candidates: loaded.candidates.length,
    skippedInvalid: loaded.skippedInvalid,
    skippedFullyPrivate: loaded.skippedFullyPrivate,
    redactionCount: loaded.redactionCount,
    keyRedactionCount: loaded.keyRedactionCount,
  },
  responses,
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern, "RecallWeave response export contains a key-shaped secret");
assert.doesNotMatch(serialized, privatePathPattern, "RecallWeave response export contains a private path");
assert.doesNotMatch(serialized, privateTagPattern, "RecallWeave response export contains private tags");
assert.doesNotMatch(serialized, /\b(memory|content|chunk|text|raw|rawText|document)"\s*:/, "RecallWeave response export contains raw response text fields");

if (outputPath) {
  const resolvedOutput = resolve(outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, serialized, { mode: 0o600 });
}
process.stdout.write(serialized);

function loadMemories(inputPath, options) {
  const raw = readFileSync(inputPath, "utf8");
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
        text: redacted.text,
        contentHash,
        estimatedTokens: estimateTokens(redacted.text),
        baseScore: finiteNumberOrDefault(item.score ?? item.similarity ?? item.confidence, 0),
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

function rankCandidates(query, candidates) {
  const queryTokens = new Set(tokenize(query));
  return candidates
    .map((candidate) => {
      const docTokens = new Set(tokenize(candidate.text));
      let overlap = 0;
      for (const token of queryTokens) {
        if (docTokens.has(token)) overlap += 1;
      }
      const union = new Set([...queryTokens, ...docTokens]).size || 1;
      const lexical = overlap / union;
      const exactBoost = candidate.text.toLowerCase().includes(query.toLowerCase()) ? 0.1 : 0;
      return { ...candidate, score: round(Math.min(1, candidate.baseScore + lexical + exactBoost)) };
    })
    .sort((left, right) => right.score - left.score || left.outputId.localeCompare(right.outputId));
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

function tokenize(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9_/-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

function safeScalar(value) {
  const text = String(value ?? "").trim() || "unknown";
  assert.doesNotMatch(text, secretPattern, "memory id contains a key-shaped secret");
  assert.doesNotMatch(text, privatePathPattern, "memory id contains a private path");
  return text.slice(0, 160);
}

function resolveInputPath(value) {
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(root, value);
}

function displayPath(value) {
  const rel = relative(root, value).replaceAll("\\", "/");
  return rel.startsWith("..") ? basename(value) : rel;
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

function round(value) {
  return Number(Number(value).toFixed(4));
}

function finiteNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveInt(value, label) {
  const number = Number(value);
  assert.ok(Number.isInteger(number) && number > 0, `${label} must be a positive integer`);
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
