import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = {
  trace: join(root, "packages/bench/fixtures/canary-runtime-trace.fixture.jsonl"),
  raw: join(root, "packages/bench/fixtures/canary-runtime-raw.fixture.jsonl"),
  memories: join(root, "packages/bench/fixtures/canary-runtime-memories.fixture.jsonl"),
  containerMap: join(root, "packages/bench/fixtures/canary-runtime-container-map.fixture.json"),
};

const args = parseArgs(process.argv.slice(2));
const source = prepareSource(args);
const host = String(args.host || "").trim();
const containerDir = args.container ? resolvePath(args.container) : "";
const discovered = source.root ? discoverDiagnosticInputs(source.root) : {};
const shouldUseFixtureFallback = !source.root && !containerDir;
const tracePath = resolveInput(args.trace, containerDir ? join(containerDir, "trace.jsonl") : discovered.trace || (shouldUseFixtureFallback ? fixture.trace : ""));
const rawPath = resolveInput(args.raw, containerDir ? join(containerDir, "raw_events.jsonl") : discovered.raw || (shouldUseFixtureFallback ? fixture.raw : ""));
const memoriesPath = resolveInput(args.memories, containerDir ? join(containerDir, "memories.jsonl") : discovered.memories || (shouldUseFixtureFallback ? fixture.memories : ""));
const containerMapPath = resolveInput(args.containerMap, containerDir ? join(containerDir, "container-map.json") : discovered.containerMap || (shouldUseFixtureFallback ? fixture.containerMap : ""));
const reliabilityPath = resolveInput(args.reliability, discovered.reliability || "");
const monitorPath = resolveInput(args.monitor, discovered.monitor || "");
const fixtureRoot = join(root, "packages/bench/fixtures");
const fixturePathOnly = Boolean(args.fixture)
  || Boolean(source.root && source.root.startsWith(fixtureRoot))
  || (
    tracePath === fixture.trace
    && rawPath === fixture.raw
    && memoriesPath === fixture.memories
    && containerMapPath === fixture.containerMap
  );

const trace = readTrace(tracePath, true);
const rawEvents = readJsonl(rawPath, false);
const memories = readJsonl(memoriesPath, false);
const containerMap = readJson(containerMapPath);
const reliability = readJson(reliabilityPath);
const monitor = readJson(monitorPath);
const traceSummary = tracePath.endsWith(".json") ? readJson(tracePath) : {};
const fixtureOnly = fixturePathOnly || hasFixtureMarker(containerMap, reliability, trace);
const monitorContainer = activeMonitorContainer(monitor);
const monitorSummary = objectValue(monitor.stdout_json?.summary) || objectValue(monitor.summary) || {};
const eventCounts = mergeCounts(
  countEvents(trace),
  objectValue(traceSummary.event_counts),
  objectValue(traceSummary.recent_event_counts),
  objectValue(reliability.event_counts),
  objectValue(monitorContainer.eventCounts),
);
const rawEventCounts = countEvents(rawEvents);
const searchEvents = trace.filter((item) => item.event === "search");
const storeEvents = trace.filter((item) => item.event === "store");
const beforePromptEvents = trace.filter((item) => item.event === "before_prompt_build" || item.event === "prefetch");
const errorEvents = trace.filter((item) => isErrorEvent(item.event));
const redactionCount = countRedactions(trace, rawEvents, memories);
const privacyLeakCount = Math.max(
  countLeaks(trace, rawEvents, memories),
  Number(reliability.privacy_leak_count ?? 0),
  Number(monitorSummary.privacyLeakCount ?? 0),
  Number(monitorContainer.privacyLeakCount ?? 0),
);
const timestamps = [
  ...trace.map((item) => timestampMs(item.ts ?? item.timestamp ?? item.created_at)),
  timestampMs(traceSummary.first_ts),
  timestampMs(traceSummary.last_ts),
].filter(Number.isFinite);
const startedAt = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : new Date(0).toISOString();
const endedAt = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : startedAt;
const durationMinutes = Math.max(0, Math.ceil((Date.parse(endedAt) - Date.parse(startedAt)) / 60000));
const agentIdentity = firstString(
  containerMap.agent_identity,
  containerMap.agentIdentity,
  reliability.agent_identity,
  monitorContainer.agentIdentity,
  monitorSummary.agent,
  "unknown-agent",
);
const localContainer = firstString(
  containerMap.local_container,
  containerMap.localContainer,
  containerMap.container,
  reliability.local_container,
  monitorContainer.localContainer,
  monitorSummary.activeLocalContainer,
  "unknown-container",
);
const sourceContainer = firstString(
  containerMap.source_supermemory_container,
  containerMap.sourceSupermemoryContainer,
  reliability.source_supermemory_container,
  monitorContainer.sourceSupermemoryContainer,
  monitorSummary.sourceSupermemoryContainer,
  "not-detected",
);
const providerMode = latestString(trace, "provider_mode")
  || providerModeFromSummary(traceSummary)
  || firstString(containerMap.provider_mode, containerMap.mode, reliability.mode, monitorSummary.mode, "unknown");
const readOnly = Boolean(containerMap.read_only ?? containerMap.readOnly);
const localResultSeen = searchEvents.some((item) => nestedNumber(item, "data", "local_result_count") > 0)
  || Boolean(monitorContainer.hybridSearchCovered)
  || Boolean(reliability.checks?.hybrid_search_observed);
const remoteResultSeen = searchEvents.some((item) => nestedNumber(item, "data", "supermemory_result_count") > 0)
  || Boolean(monitorContainer.supermemoryReadThroughReturnedResults)
  || Number(reliability.reliability_metrics?.hybrid_local_plus_supermemory_search_count ?? 0) > 0
  || Boolean(reliability.checks?.hybrid_search_observed);
const hostedReadThroughObserved = trace.some((item) => nestedBoolean(item, "data", "supermemory_read_through"))
  || providerMode.includes("supermemory-read-through")
  || String(reliability.mode ?? "").includes("Supermemory read-through")
  || String(monitorSummary.mode ?? "").includes("supermemory-read-through")
  || Boolean(monitorContainer.supermemoryReadThroughReturnedResults)
  || Boolean(reliability.checks?.hybrid_search_observed);
const sessionStartCount = countNamed(eventCounts, ["session_start", "initialize"]);
const beforePromptCount = Math.max(beforePromptEvents.length, countNamed(eventCounts, ["before_prompt_build", "prefetch"]));
const preCompressCount = countNamed(eventCounts, ["pre_compress", "compression_checkpoint", "lcm_after_compression_prompt_build"]);
const agentEndCount = countNamed(eventCounts, ["agent_end", "session_end"]);
const searchCount = Math.max(searchEvents.length, countNamed(eventCounts, ["search"]), beforePromptCount);
const storeCount = Math.max(storeEvents.length, countNamed(eventCounts, ["store"]));
const searchLatencySamples = searchEvents.map((item) => nestedNumber(item, "data", "elapsed_ms")).filter((value) => value > 0);
const storeLatencySamples = storeEvents.map((item) => nestedNumber(item, "data", "elapsed_ms")).filter((value) => value > 0);
const zeroResultSearches = searchEvents.filter((item) => nestedNumber(item, "data", "result_count") === 0).length;
const rejectedWrites = countNamed(eventCounts, ["agent_end_write_suppressed", "memory_write_rejected"]);
const writeDenominator = Math.max(1, storeCount + rejectedWrites);
const zeroResultRate = numericValue(
  reliability.reliability_metrics?.zero_result_rate,
  monitorContainer.zeroResultRate,
  searchCount ? zeroResultSearches / searchCount : 1,
);
const generatedAt = new Date().toISOString();

const report = {
  schemaVersion: 1,
  mode: "one-agent-canary-runtime-report",
  generatedAt,
  commit: stringValue(args.commit || process.env.GITHUB_SHA || "unknown"),
  fixtureOnly,
  evidenceType: fixtureOnly ? "fixture-trace-derived-canary-report" : "real-trace-derived-canary-report",
  evidenceSource: {
    inputKind: source.kind,
    traceKind: tracePath ? basename(tracePath) : "missing",
    metadataOnly: /metadata_only|summary/i.test(tracePath),
  },
  agent: {
    host: host || inferHost(containerMap, tracePath, reliability, monitor),
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
    sessionStart: sessionStartCount,
    beforePromptBuild: beforePromptCount,
    preCompress: preCompressCount,
    agentEnd: agentEndCount,
    search: searchCount,
    store: storeCount,
    forget: countNamed(eventCounts, ["forget"]),
    errors: Math.max(
      errorEvents.length,
      countErrorLikeEvents(eventCounts),
      Number(monitorContainer.errorCount ?? 0),
      Number(reliability.issues?.length ?? 0),
      Number(traceSummary.error_like_events?.length ?? 0),
    ),
    skippedUnknownIdentity: agentIdentity === "unknown-agent" ? 1 : 0,
    unknownContainerWrites: localContainer.includes("unknown") && storeCount > 0 ? storeCount : 0,
  },
  latencyMs: {
    recallP50: percentile(searchLatencySamples, 0.5),
    recallP95: percentile(searchLatencySamples, 0.95),
    storeP50: percentile(storeLatencySamples, 0.5),
    storeP95: percentile(storeLatencySamples, 0.95),
  },
  instrumentation: {
    searchLatencySampleCount: searchLatencySamples.length,
    storeLatencySampleCount: storeLatencySamples.length,
    missingSearchLatencyCount: Math.max(0, searchCount - searchLatencySamples.length),
    missingStoreLatencyCount: Math.max(0, storeCount - storeLatencySamples.length),
    metadataOnlyTrace: /metadata_only|summary/i.test(tracePath),
    summaryOnlyTrace: Boolean(traceSummary.event_counts && trace.length === 0),
  },
  quality: {
    beforePromptHasContextRate: beforePromptEvents.length
      ? beforePromptEvents.filter((item) => nestedNumber(item, "data", "result_count") > 0).length / beforePromptEvents.length
      : 0,
    zeroResultRate,
    writeSuccessRate: storeCount / writeDenominator,
    lcmHookObserved: preCompressCount > 0
      || countNamed(rawEventCounts, ["compression_checkpoint_raw"]) > 0,
    lifecycleCovered:
      sessionStartCount > 0
      && beforePromptCount > 0
      && agentEndCount > 0,
    hybridSearchCovered: localResultSeen && remoteResultSeen,
    localWritesObserved: storeCount > 0,
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

function prepareSource(parsed) {
  const zip = parsed.zip || parsed.diagnosticZip;
  if (zip) {
    const zipPath = resolvePath(zip);
    assert.ok(existsSync(zipPath), "diagnostic zip is missing");
    assertSafeZip(zipPath);
    const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-diagnostic-"));
    const extracted = spawnSync("unzip", ["-q", zipPath, "-d", tempRoot], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(extracted.status, 0, "diagnostic zip extraction failed");
    process.once("exit", () => rmSync(tempRoot, { recursive: true, force: true }));
    return { kind: "diagnostic-zip", root: tempRoot };
  }
  const dir = parsed.diagnosticDir || parsed.bundleDir || parsed.auditDir;
  if (dir) {
    const rootDir = resolvePath(dir);
    assert.ok(existsSync(rootDir), "diagnostic directory is missing");
    return { kind: "diagnostic-dir", root: rootDir };
  }
  if (parsed.container) return { kind: "container", root: "" };
  if (parsed.fixture) return { kind: "fixture", root: "" };
  return { kind: "fixture", root: "" };
}

function assertSafeZip(zipPath) {
  const listed = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(listed.status, 0, "diagnostic zip listing failed");
  for (const entry of listed.stdout.split(/\r?\n/).filter(Boolean)) {
    assert.equal(isSafeArchiveEntry(entry), true, "diagnostic zip contains an unsafe path");
  }
}

function isSafeArchiveEntry(entry) {
  return !entry.startsWith("/")
    && !/^[A-Za-z]:[\\/]/.test(entry)
    && !entry.split(/[\\/]+/).includes("..");
}

function discoverDiagnosticInputs(rootDir) {
  const files = collectFiles(rootDir);
  return {
    trace: pickFile(files, [
      /(^|\/)trace\.jsonl$/i,
      /(^|\/)trace_metadata_only\.jsonl$/i,
      /(^|\/)recent-trace-summary\.json$/i,
      /(^|\/)trace_summary_sanitized\.json$/i,
    ]),
    raw: pickFile(files, [
      /(^|\/)raw_events_metadata_only\.jsonl$/i,
      /(^|\/)raw_events\.jsonl$/i,
    ]),
    memories: pickFile(files, [
      /(^|\/)memories_metadata_only\.jsonl$/i,
      /(^|\/)memories\.jsonl$/i,
    ]),
    containerMap: pickFile(files, [
      /(^|\/)container-map\.json$/i,
      /(^|\/)container_map\.json$/i,
    ]),
    reliability: pickFile(files, [
      /(^|\/)reliability_reports\/latest\.json$/i,
      /(^|\/)selfmem-reliability-[^/]+\.json$/i,
    ], "latest"),
    monitor: pickFile(files, [
      /(^|\/)selfmem-monitor-current\.json$/i,
      /(^|\/)monitor-current\.json$/i,
    ]),
  };
}

function collectFiles(rootDir) {
  const found = [];
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readDirectory(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) found.push(full);
    }
  }
  return found.sort((left, right) => left.localeCompare(right));
}

function readDirectory(path) {
  return readdirSync(path, { withFileTypes: true });
}

function pickFile(files, patterns, mode = "first") {
  const matched = patterns.flatMap((pattern) => files.filter((file) => pattern.test(file.replaceAll("\\", "/"))));
  if (!matched.length) return "";
  const unique = [...new Set(matched)];
  if (mode === "latest") return unique.sort((left, right) => right.localeCompare(left))[0];
  return unique[0];
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
  assert.doesNotMatch(raw, secretPattern(), "input contains a key-shaped secret");
  const data = JSON.parse(raw);
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function readTrace(path, required) {
  if (!path || !existsSync(path)) {
    assert.equal(required, false, "trace input is required");
    return [];
  }
  if (path.endsWith(".json")) {
    const data = readJson(path);
    const events = Array.isArray(data.recent_events_sanitized)
      ? data.recent_events_sanitized
      : Array.isArray(data.events)
        ? data.events
        : Array.isArray(data.trace)
          ? data.trace
          : [];
    return events.flatMap((item) => normalizeEvent(item));
  }
  return readJsonl(path, required);
}

function readJsonl(path, required) {
  if (!path || !existsSync(path)) {
    assert.equal(required, false, "trace input is required");
    return [];
  }
  const raw = readFileSync(path, "utf8");
  assert.doesNotMatch(raw, secretPattern(), "input contains a key-shaped secret");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const item = JSON.parse(line);
        return normalizeEvent(item);
      } catch {
        return [];
      }
    });
}

function normalizeEvent(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return [];
  const normalized = { ...item };
  if (!normalized.data || typeof normalized.data !== "object") {
    normalized.data = objectValue(normalized.data_summary) || eventDataFromFlatItem(normalized);
  }
  return [normalized];
}

function eventDataFromFlatItem(item) {
  return Object.fromEntries(
    Object.entries(item).filter(([key]) => !["event", "ts", "timestamp", "created_at"].includes(key)),
  );
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

function countErrorLikeEvents(counts) {
  if (!counts || typeof counts !== "object") return 0;
  return Object.entries(counts).reduce((sum, [name, value]) => {
    return isErrorEvent(name) ? sum + Number(value || 0) : sum;
  }, 0);
}

function mergeCounts(...groups) {
  const merged = {};
  for (const group of groups) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [key, value] of Object.entries(group)) {
      const count = Number(value);
      if (Number.isFinite(count)) merged[key] = Math.max(Number(merged[key] || 0), count);
    }
  }
  return merged;
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

function activeMonitorContainer(monitor) {
  const containers = Array.isArray(monitor.stdout_json?.containers)
    ? monitor.stdout_json.containers
    : Array.isArray(monitor.containers)
      ? monitor.containers
      : [];
  return objectValue(containers.find((item) => item.active)) || objectValue(containers[0]) || {};
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function providerModeFromSummary(summary) {
  const modes = Array.isArray(summary.provider_modes) ? summary.provider_modes : [];
  const [first] = modes
    .filter((item) => Array.isArray(item) && stringValue(item[0]) && stringValue(item[0]) !== "[none]")
    .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0));
  return first ? stringValue(first[0]) : "";
}

function hasFixtureMarker(map, reliability, trace) {
  if (map.fixture_only === true || map.fixtureOnly === true) return true;
  if (reliability.fixture_only === true || reliability.fixtureOnly === true) return true;
  const markerText = JSON.stringify({
    agent_identity: map.agent_identity,
    agentIdentity: map.agentIdentity,
    local_container: map.local_container,
    localContainer: map.localContainer,
    source_supermemory_container: map.source_supermemory_container,
    sourceSupermemoryContainer: map.sourceSupermemoryContainer,
    reliabilityAgent: reliability.agent_identity,
  });
  if (/"[^"]*fixture[^"]*"/i.test(markerText)) return true;
  return trace.some((item) => stringValue(item.data?.session_id).startsWith("fixture-"));
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

function firstString(...values) {
  for (const value of values) {
    const text = stringValue(value).trim();
    if (text) return text;
  }
  return "";
}

function numericValue(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function inferHost(map, tracePathValue, reliability, monitor) {
  const mapped = stringValue(map.host || map.runtime || "");
  if (["hermes", "openclaw", "codex", "claude-code"].includes(mapped)) return mapped;
  const monitorHost = stringValue(monitor.stdout_json?.host || monitor.host || "");
  if (["hermes", "openclaw", "codex", "claude-code"].includes(monitorHost)) return monitorHost;
  if (stringValue(monitor.stdout_json?.home || monitor.home).includes(".hermes")) return "hermes";
  if (stringValue(reliability.config_provider || reliability.hermes_home).includes("hermes")) return "hermes";
  if (tracePathValue.includes("hermes")) return "hermes";
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
