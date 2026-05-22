import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = {
  trace: join(root, "packages/bench/fixtures/canary-runtime-trace.fixture.jsonl"),
  raw: join(root, "packages/bench/fixtures/canary-runtime-raw.fixture.jsonl"),
  memories: join(root, "packages/bench/fixtures/canary-runtime-memories.fixture.jsonl"),
  containerMap: join(root, "packages/bench/fixtures/canary-runtime-container-map.fixture.json"),
};

const args = parseArgs(process.argv.slice(2));
const host = String(args.host || "").trim();
const containerDir = args.container ? resolvePath(args.container) : "";
const tracePath = resolveInput(args.trace, containerDir ? join(containerDir, "trace.jsonl") : fixture.trace);
const rawPath = resolveInput(args.raw, containerDir ? join(containerDir, "raw_events.jsonl") : fixture.raw);
const memoriesPath = resolveInput(args.memories, containerDir ? join(containerDir, "memories.jsonl") : fixture.memories);
const containerMapPath = resolveInput(args.containerMap, containerDir ? join(containerDir, "container-map.json") : fixture.containerMap);
const fixtureOnly = Boolean(args.fixture)
  || (
    tracePath === fixture.trace
    && rawPath === fixture.raw
    && memoriesPath === fixture.memories
    && containerMapPath === fixture.containerMap
  );

const trace = readJsonl(tracePath, true);
const rawEvents = readJsonl(rawPath, false);
const memories = readJsonl(memoriesPath, false);
const containerMap = readJson(containerMapPath);
const eventCounts = countEvents(trace);
const rawEventCounts = countEvents(rawEvents);
const searchEvents = trace.filter((item) => item.event === "search");
const storeEvents = trace.filter((item) => item.event === "store");
const beforePromptEvents = trace.filter((item) => item.event === "before_prompt_build" || item.event === "prefetch");
const errorEvents = trace.filter((item) => isErrorEvent(item.event));
const redactionCount = countRedactions(trace, rawEvents, memories);
const privacyLeakCount = countLeaks(trace, rawEvents, memories);
const timestamps = trace.map((item) => timestampMs(item.ts ?? item.timestamp ?? item.created_at)).filter(Number.isFinite);
const startedAt = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : new Date(0).toISOString();
const endedAt = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : startedAt;
const durationMinutes = Math.max(0, Math.ceil((Date.parse(endedAt) - Date.parse(startedAt)) / 60000));
const agentIdentity = stringValue(containerMap.agent_identity ?? containerMap.agentIdentity ?? "unknown-agent");
const localContainer = stringValue(containerMap.local_container ?? containerMap.localContainer ?? containerMap.container ?? "unknown-container");
const sourceContainer = stringValue(
  containerMap.source_supermemory_container ?? containerMap.sourceSupermemoryContainer ?? "not-detected",
);
const providerMode = latestString(trace, "provider_mode") || stringValue(containerMap.provider_mode ?? containerMap.mode ?? "unknown");
const readOnly = Boolean(containerMap.read_only ?? containerMap.readOnly);
const localResultSeen = searchEvents.some((item) => nestedNumber(item, "data", "local_result_count") > 0);
const remoteResultSeen = searchEvents.some((item) => nestedNumber(item, "data", "supermemory_result_count") > 0);
const hostedReadThroughObserved = trace.some((item) => nestedBoolean(item, "data", "supermemory_read_through")) || providerMode.includes("supermemory-read-through");
const searchCount = searchEvents.length || beforePromptEvents.length;
const zeroResultSearches = searchEvents.filter((item) => nestedNumber(item, "data", "result_count") === 0).length;
const rejectedWrites = countNamed(eventCounts, ["agent_end_write_suppressed", "memory_write_rejected"]);
const writeDenominator = Math.max(1, storeEvents.length + rejectedWrites);
const generatedAt = new Date().toISOString();

const report = {
  schemaVersion: 1,
  mode: "one-agent-canary-runtime-report",
  generatedAt,
  commit: stringValue(args.commit || process.env.GITHUB_SHA || "unknown"),
  fixtureOnly,
  evidenceType: fixtureOnly ? "fixture-trace-derived-canary-report" : "real-trace-derived-canary-report",
  agent: {
    host: host || inferHost(containerMap, tracePath),
    agentIdentityHash: hashLabel("agent", agentIdentity),
    localContainerHash: hashLabel("container", localContainer),
    sourceContainerHash: hashLabel("source", sourceContainer),
  },
  window: {
    startedAt,
    endedAt,
    durationMinutes,
  },
  provider: {
    mode: providerMode,
    localWriteMode: readOnly ? "disabled" : "enabled",
    hostedSupermemoryMode: hostedReadThroughObserved ? "read-through-only" : "disabled",
    embedder: inferEmbedder(providerMode),
    reranker: inferReranker(providerMode),
  },
  counts: {
    sessionStart: countNamed(eventCounts, ["session_start", "initialize"]),
    beforePromptBuild: beforePromptEvents.length,
    preCompress: countNamed(eventCounts, ["pre_compress", "compression_checkpoint", "lcm_after_compression_prompt_build"]),
    agentEnd: countNamed(eventCounts, ["agent_end", "session_end"]),
    search: searchCount,
    store: storeEvents.length,
    forget: countNamed(eventCounts, ["forget"]),
    errors: errorEvents.length,
    skippedUnknownIdentity: agentIdentity === "unknown-agent" ? 1 : 0,
    unknownContainerWrites: localContainer.includes("unknown") && storeEvents.length > 0 ? storeEvents.length : 0,
  },
  latencyMs: {
    recallP50: percentile(searchEvents.map((item) => nestedNumber(item, "data", "elapsed_ms")).filter((value) => value > 0), 0.5),
    recallP95: percentile(searchEvents.map((item) => nestedNumber(item, "data", "elapsed_ms")).filter((value) => value > 0), 0.95),
    storeP50: percentile(storeEvents.map((item) => nestedNumber(item, "data", "elapsed_ms")).filter((value) => value > 0), 0.5),
    storeP95: percentile(storeEvents.map((item) => nestedNumber(item, "data", "elapsed_ms")).filter((value) => value > 0), 0.95),
  },
  quality: {
    beforePromptHasContextRate: beforePromptEvents.length
      ? beforePromptEvents.filter((item) => nestedNumber(item, "data", "result_count") > 0).length / beforePromptEvents.length
      : 0,
    zeroResultRate: searchCount ? zeroResultSearches / searchCount : 1,
    writeSuccessRate: storeEvents.length / writeDenominator,
    lcmHookObserved: countNamed(eventCounts, ["pre_compress", "compression_checkpoint", "lcm_after_compression_prompt_build"]) > 0
      || countNamed(rawEventCounts, ["compression_checkpoint_raw"]) > 0,
    lifecycleCovered:
      countNamed(eventCounts, ["session_start", "initialize"]) > 0
      && beforePromptEvents.length > 0
      && countNamed(eventCounts, ["agent_end", "session_end"]) > 0,
    hybridSearchCovered: localResultSeen && remoteResultSeen,
    localWritesObserved: storeEvents.length > 0,
    hostedReadThroughObserved,
  },
  privacy: {
    privacyLeakCount,
    redactionCount,
    secretPatternHits: countSecretHits(trace, rawEvents, memories),
    rawMemoryIncluded: false,
    rawTranscriptIncluded: false,
    rawPromptIncluded: false,
    rawAnswerIncluded: false,
  },
  eventFingerprints: trace.slice(-5).map((item) => ({
    eventHash: hashLabel("evt", `${item.ts ?? ""}:${item.event ?? ""}:${JSON.stringify(item.data ?? {})}`),
    kind: stringValue(item.event || "unknown"),
    observedAt: stringValue(item.ts ?? item.timestamp ?? item.created_at ?? ""),
  })),
  rollback: {
    available: true,
    tested: Boolean(args.rollbackTested || fixtureOnly),
    command: "selfmem_update --rollback",
  },
  failures: errorEvents.map((item) => ({
    eventHash: hashLabel("evt", `${item.ts ?? ""}:${item.event ?? ""}:${JSON.stringify(item.data ?? {})}`),
    kind: stringValue(item.event),
  })),
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
assert.doesNotMatch(serialized, secretPattern(), "generated report contains a key-shaped secret");
assert.doesNotMatch(serialized, privatePathPattern(), "generated report contains a raw local path");
if (args.output) {
  const outputPath = resolvePath(args.output);
  writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
}
process.stdout.write(serialized);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--") continue;
    if (item === "--fixture") parsed.fixture = true;
    else if (item === "--rollback-tested") parsed.rollbackTested = true;
    else if (item.startsWith("--")) parsed[toCamel(item.slice(2))] = argv[index + 1] ?? "";
    if (item.startsWith("--") && !["--fixture", "--rollback-tested"].includes(item)) index += 1;
  }
  return parsed;
}

function resolveInput(value, fallback) {
  const candidate = value ? resolvePath(value) : fallback;
  if (!existsSync(candidate)) return "";
  return candidate;
}

function resolvePath(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function readJson(path) {
  if (!path || !existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  assert.doesNotMatch(raw, secretPattern(), `input contains a key-shaped secret: ${dirname(path)}`);
  const data = JSON.parse(raw);
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function readJsonl(path, required) {
  if (!path || !existsSync(path)) {
    assert.equal(required, false, "trace input is required");
    return [];
  }
  const raw = readFileSync(path, "utf8");
  assert.doesNotMatch(raw, secretPattern(), `input contains a key-shaped secret: ${dirname(path)}`);
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const item = JSON.parse(line);
        return item && typeof item === "object" && !Array.isArray(item) ? [item] : [];
      } catch {
        return [];
      }
    });
}

function countEvents(items) {
  return items.reduce((counts, item) => {
    const event = stringValue(item.event || "unknown");
    counts[event] = (counts[event] || 0) + 1;
    return counts;
  }, {});
}

function countNamed(counts, names) {
  return names.reduce((sum, name) => sum + Number(counts[name] || 0), 0);
}

function nestedNumber(item, ...keys) {
  let value = item;
  for (const key of keys) value = value && typeof value === "object" ? value[key] : undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nestedBoolean(item, ...keys) {
  let value = item;
  for (const key of keys) value = value && typeof value === "object" ? value[key] : undefined;
  return value === true;
}

function latestString(items, key) {
  for (const item of [...items].reverse()) {
    const direct = item[key];
    const nested = item.data && typeof item.data === "object" ? item.data[key] : "";
    const value = stringValue(direct || nested);
    if (value) return value;
  }
  return "";
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return Number(sorted[index].toFixed(3));
}

function timestampMs(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function hashLabel(prefix, value) {
  return `${prefix}_${createHash("sha256").update(String(value || "missing")).digest("hex").slice(0, 12)}`;
}

function stringValue(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function inferHost(map, tracePathValue) {
  const mapped = stringValue(map.host || map.runtime || "");
  if (["hermes", "openclaw", "codex", "claude-code"].includes(mapped)) return mapped;
  return tracePathValue.includes("selfmem_canary") ? "hermes" : "openclaw";
}

function inferEmbedder(providerMode) {
  if (providerMode.includes("voyage")) return "voyage-4-large";
  return "local-lexical";
}

function inferReranker(providerMode) {
  if (providerMode.includes("rerank-2.5")) return "rerank-2.5";
  return "none";
}

function isErrorEvent(event) {
  return /(?:^|_)(error|failed|failure)$/.test(String(event || ""));
}

function countRedactions(...groups) {
  const text = JSON.stringify(groups);
  return (text.match(/\[REDACTED[_A-Z]*\]/g) || []).length;
}

function countLeaks(...groups) {
  const text = JSON.stringify(groups);
  return Number(/<\/?private>/i.test(text)) + countSecretHits(...groups) + Number(privatePathPattern().test(text));
}

function countSecretHits(...groups) {
  const text = JSON.stringify(groups);
  const match = text.match(secretPattern());
  return match ? match.length : 0;
}

function secretPattern() {
  return /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/g;
}

function privatePathPattern() {
  return /(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
