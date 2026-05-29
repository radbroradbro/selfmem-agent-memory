import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  compactSession,
  containsRedactionBoundaryText,
} from "../core/dist/index.js";

const args = parseArgs(process.argv.slice(2));
const fixtureDir = new URL("./fixtures/session-compaction-local-batch.fixture/", import.meta.url);
const inputFiles = await collectInputs(args);
const strict = Boolean(args.strict ?? (!args.inputDir && args.inputs.length === 0));

if (inputFiles.length === 0) {
  throw new Error("no session audit input files found");
}

const sessionReports = [];

for (const input of inputFiles.slice(0, args.limit)) {
  const raw = await readFile(input, "utf8");
  const sessions = parseSessions(raw, {
    source: args.source ?? inferSource(input),
    sessionId: `local-batch:${hashForDisplay(input).slice(0, 16)}`,
  });

  for (const session of sessions) {
    const result = compactSession({
      ...session,
      maxCandidates: args.maxCandidates ?? 40,
    });
    sessionReports.push(buildSessionReport(result, input, raw));
  }
}

const report = buildBatchReport(sessionReports, {
  strict,
  inputCount: inputFiles.length,
  processedFileCount: Math.min(inputFiles.length, args.limit),
  truncated: inputFiles.length > args.limit,
  writesRealFiles: Boolean(args.output),
});

if (strict) {
  assert.equal(report.quality.privacyLeakCount, 0, JSON.stringify(report, null, 2));
  assert.equal(report.quality.chronologicalFailureCount, 0, JSON.stringify(report, null, 2));
  assert.ok(report.aggregate.sessionCount >= 3, JSON.stringify(report, null, 2));
  assert.ok(report.aggregate.eventCount >= 8, JSON.stringify(report, null, 2));
  assert.ok(report.aggregate.outputCandidates >= 7, JSON.stringify(report, null, 2));
  assert.ok(report.quality.exactIdentifierCandidateCount >= 2, JSON.stringify(report, null, 2));
  assert.ok(report.quality.sourceCounts.codex >= 1, JSON.stringify(report, null, 2));
  assert.ok(report.quality.sourceCounts.claude >= 1, JSON.stringify(report, null, 2));
  assert.ok(report.quality.sourceCounts.hermes >= 1, JSON.stringify(report, null, 2));
  assert.ok(report.aggregate.averageNoiseReductionRatio >= 0.2, JSON.stringify(report, null, 2));
  assert.ok(report.quality.topicLinkCount >= report.aggregate.outputCandidates, JSON.stringify(report, null, 2));
  assert.equal(report.quality.unlinkedCandidateCount, 0, JSON.stringify(report, null, 2));
  assert.equal(report.quality.lifecyclePhaseCounts.pre_compact, report.aggregate.sessionCount, JSON.stringify(report, null, 2));
  assert.equal(report.quality.lifecyclePhaseCounts.session_map_ready, report.aggregate.sessionCount, JSON.stringify(report, null, 2));
}

const output = `${JSON.stringify(report, null, 2)}\n`;
if (containsRedactionBoundaryText(output)) {
  throw new Error("batch audit output contains private boundary or key-shaped text");
}
if (args.output) {
  await writeFile(args.output, output, { mode: 0o600 });
}
console.log(output.trimEnd());

async function collectInputs(options) {
  if (options.inputs.length > 0) return options.inputs;
  const root = options.inputDir ?? fixtureDir;
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(String(root).startsWith("file:") ? new URL(root).pathname : root, entry.name))
    .filter((path) => [".json", ".jsonl"].includes(extname(path).toLowerCase()))
    .sort();
}

function buildSessionReport(result, inputPath, raw) {
  const candidates = result.candidates;
  const candidateText = candidates.map((candidate) => candidate.text).join("\n");
  const serializedWithoutText = JSON.stringify({
    sessionId: result.sessionId,
    source: result.source,
    metrics: result.metrics,
    candidateFingerprints: candidates.map(candidateFingerprint),
    sessionMap: sessionMapFingerprint(result.sessionMap),
  });
  const privacyLeakCount =
    (containsRedactionBoundaryText(candidateText) ? 1 : 0) +
    (containsRedactionBoundaryText(serializedWithoutText) ? 1 : 0);
  return {
    source: result.source,
    sessionIdHash: hashForDisplay(result.sessionId),
    inputPathHash: hashForDisplay(inputPath),
    inputFileDisplay: displayFile(inputPath),
    inputBytes: Buffer.byteLength(raw, "utf8"),
    metrics: result.metrics,
    quality: {
      candidateCount: candidates.length,
      staleCandidateCount: candidates.filter((candidate) => candidate.stale).length,
      exactIdentifierCandidateCount: candidates.filter((candidate) => candidate.reasons.includes("exact-identifier")).length,
      averageSalience: average(candidates.map((candidate) => candidate.salience)),
      privacyLeakCount,
      chronological: result.metrics.chronological,
    },
    sessionMap: sessionMapFingerprint(result.sessionMap),
    candidateFingerprints: candidates.map(candidateFingerprint),
  };
}

function buildBatchReport(sessionReports, options) {
  const kindCounts = {};
  const sourceCounts = {};
  const salienceBands = { high: 0, medium: 0, low: 0 };
  let eventCount = 0;
  let redactionCount = 0;
  let skippedFullyPrivate = 0;
  let skippedNoise = 0;
  let outputCandidates = 0;
  let exactIdentifierCandidateCount = 0;
  let staleCandidateCount = 0;
  let privacyLeakCount = 0;
  let chronologicalFailureCount = 0;
  let topicLinkCount = 0;
  let lifecycleEventCount = 0;
  let unlinkedCandidateCount = 0;
  let duplicateCandidateMerges = 0;
  const wasteSignalCounts = {};
  const lifecyclePhaseCounts = {};
  const noiseReductionValues = [];

  for (const report of sessionReports) {
    sourceCounts[report.source] = (sourceCounts[report.source] ?? 0) + 1;
    eventCount += report.metrics.inputEvents;
    redactionCount += report.metrics.redactionCount;
    skippedFullyPrivate += report.metrics.skippedFullyPrivate;
    skippedNoise += report.metrics.skippedNoise;
    outputCandidates += report.metrics.outputCandidates;
    exactIdentifierCandidateCount += report.quality.exactIdentifierCandidateCount;
    staleCandidateCount += report.quality.staleCandidateCount;
    privacyLeakCount += report.quality.privacyLeakCount;
    if (!report.quality.chronological) chronologicalFailureCount += 1;
    topicLinkCount += report.sessionMap.topicLinkCount;
    lifecycleEventCount += report.sessionMap.lifecycleEventCount;
    unlinkedCandidateCount += report.sessionMap.unlinkedCandidateCount;
    duplicateCandidateMerges += report.sessionMap.duplicateCandidateMerges;
    noiseReductionValues.push(report.metrics.noiseReductionRatio);
    incrementCounts(wasteSignalCounts, report.sessionMap.wasteSignals);
    incrementObjectCounts(lifecyclePhaseCounts, report.sessionMap.lifecyclePhaseCounts);

    for (const candidate of report.candidateFingerprints) {
      kindCounts[candidate.kind] = (kindCounts[candidate.kind] ?? 0) + 1;
      if (candidate.salience >= 0.8) salienceBands.high += 1;
      else if (candidate.salience >= 0.6) salienceBands.medium += 1;
      else salienceBands.low += 1;
    }
  }

  return {
    ok: privacyLeakCount === 0 && chronologicalFailureCount === 0,
    mode: "local-session-compaction-batch-audit",
    writesRealFiles: options.writesRealFiles,
    metricsOnly: true,
    input: {
      inputFileCount: options.inputCount,
      processedFileCount: options.processedFileCount,
      truncated: options.truncated,
      limit: args.limit,
      maxCandidatesPerSession: args.maxCandidates ?? 40,
    },
    aggregate: {
      sessionCount: sessionReports.length,
      eventCount,
      redactionCount,
      skippedFullyPrivate,
      skippedNoise,
      outputCandidates,
      averageNoiseReductionRatio: average(noiseReductionValues),
    },
    quality: {
      sourceCounts,
      kindCounts,
      salienceBands,
      staleCandidateCount,
      exactIdentifierCandidateCount,
      chronologicalFailureCount,
      privacyLeakCount,
      candidateFingerprintCount: sessionReports.reduce((sum, report) => sum + report.candidateFingerprints.length, 0),
      topicLinkCount,
      lifecycleEventCount,
      lifecyclePhaseCounts,
      unlinkedCandidateCount,
      duplicateCandidateMerges,
      wasteSignalCounts,
    },
    sessions: sessionReports.map((report) => ({
      source: report.source,
      sessionIdHash: report.sessionIdHash,
      inputPathHash: report.inputPathHash,
      inputFileDisplay: report.inputFileDisplay,
      inputBytes: report.inputBytes,
      eventCount: report.metrics.inputEvents,
      outputCandidates: report.metrics.outputCandidates,
      redactionCount: report.metrics.redactionCount,
      noiseReductionRatio: report.metrics.noiseReductionRatio,
      chronological: report.metrics.chronological,
      staleCandidateCount: report.quality.staleCandidateCount,
      exactIdentifierCandidateCount: report.quality.exactIdentifierCandidateCount,
      averageSalience: report.quality.averageSalience,
      sessionMap: report.sessionMap,
      candidateFingerprints: report.candidateFingerprints,
    })),
    strict: options.strict,
  };
}

function parseSessions(raw, fallback) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = parseJsonOrJsonLines(trimmed);
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.sessions)) {
    return parsed.sessions.flatMap((session, index) => normalizeSession(session, fallback, index));
  }
  return normalizeSession(parsed, fallback, 0);
}

function normalizeSession(parsed, fallback, index) {
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.events)) {
    const events = parsed.events.map((event, eventIndex) => normalizeEvent(event, eventIndex)).filter((event) => event.content);
    return [
      {
        sessionId: String(parsed.sessionId ?? `${fallback.sessionId}:${index}`),
        source: normalizeSource(parsed.source ?? fallback.source),
        startedAt: safeTimestamp(parsed.startedAt ?? events[0]?.timestamp, 0),
        endedAt: parsed.endedAt ? safeTimestamp(parsed.endedAt, events.length) : undefined,
        events,
      },
    ];
  }

  const rawEvents = Array.isArray(parsed) ? parsed : [parsed];
  const events = rawEvents.map((event, eventIndex) => normalizeEvent(event, eventIndex)).filter((event) => event.content);
  return [
    {
      sessionId: fallback.sessionId,
      source: normalizeSource(fallback.source),
      startedAt: safeTimestamp(events[0]?.timestamp, 0),
      events,
    },
  ];
}

function parseJsonOrJsonLines(raw) {
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      if (!raw.includes("\n")) throw error;
    }
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function normalizeEvent(event, index = 0) {
  const item = event?.item ?? event?.payload?.item ?? event?.response_item ?? event?.message ?? event;
  const timestamp = safeTimestamp(
    event?.timestamp ?? event?.createdAt ?? event?.created_at ?? item?.timestamp ?? item?.createdAt ?? item?.created_at,
    index,
  );
  return {
    id: String(event?.id ?? event?.uuid ?? event?.event_id ?? item?.id ?? `event-${index}`),
    role: normalizeRole(event?.role ?? item?.role ?? event?.message?.role ?? event?.type ?? item?.type),
    timestamp,
    content: extractText(event?.content ?? event?.text ?? event?.message?.content ?? item?.content ?? item?.text ?? item),
    metadata: {
      sourceType: String(event?.type ?? event?.kind ?? item?.type ?? "event"),
    },
  };
}

function extractText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    return Object.entries(value)
      .filter(([key]) => ["content", "text", "message", "messages", "parts", "summary", "item", "payload", "response"].includes(key))
      .map(([, nested]) => extractText(nested))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function normalizeRole(value) {
  const role = String(value ?? "user").toLowerCase();
  if (role.includes("assistant") || role.includes("response_item")) return "assistant";
  if (role.includes("tool")) return "tool";
  if (role.includes("system") || role.includes("session_meta")) return "system";
  return ["user", "assistant", "tool", "system"].includes(role) ? role : "user";
}

function normalizeSource(value) {
  const source = String(value ?? "other").toLowerCase();
  return ["codex", "claude", "hermes", "openclaw", "other"].includes(source) ? source : "other";
}

function inferSource(path) {
  const lower = String(path).toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (lower.includes("hermes")) return "hermes";
  if (lower.includes("openclaw")) return "openclaw";
  if (lower.includes("codex")) return "codex";
  return "other";
}

function safeTimestamp(value, index = 0) {
  const date = new Date(value ?? Date.UTC(1970, 0, 1, 0, 0, 0, index));
  return Number.isNaN(date.getTime()) ? new Date(Date.UTC(1970, 0, 1, 0, 0, 0, index)).toISOString() : date.toISOString();
}

function candidateFingerprint(candidate) {
  return {
    idHash: hashForDisplay(candidate.id),
    kind: candidate.kind,
    stale: Boolean(candidate.stale),
    salience: candidate.salience,
    reasonCount: candidate.reasons.length,
    sourceEventCount: candidate.sourceEventIds.length,
    observedAt: candidate.observedAt,
  };
}

function sessionMapFingerprint(sessionMap) {
  return {
    idHash: hashForDisplay(sessionMap.id),
    topicLinkCount: sessionMap.topicLinks.length,
    lifecycleEventCount: sessionMap.lifecycleEvents.length,
    linkedCandidateCount: sessionMap.telemetry.counters.linkedCandidates,
    unlinkedCandidateCount: sessionMap.telemetry.counters.unlinkedCandidates,
    statementsInspected: sessionMap.telemetry.counters.statementsInspected,
    durableStatements: sessionMap.telemetry.counters.durableStatements,
    duplicateCandidateMerges: sessionMap.telemetry.counters.duplicateCandidateMerges,
    wasteSignals: sessionMap.telemetry.wasteSignals,
    warnings: sessionMap.telemetry.warnings,
    lifecyclePhaseCounts: countBy(sessionMap.lifecycleEvents.map((event) => event.phase)),
    topicFingerprints: sessionMap.topicLinks.map(topicLinkFingerprint),
  };
}

function topicLinkFingerprint(link) {
  return {
    idHash: hashForDisplay(link.id),
    topicPathHash: hashForDisplay(link.topicPath.join("/")),
    depth: link.topicPath.length,
    candidateCount: link.candidateIds.length,
    sourceEventCount: link.sourceEventIds.length,
    reasonCount: link.reasons.length,
    salience: link.salience,
    firstObservedAt: link.firstObservedAt,
    lastObservedAt: link.lastObservedAt,
  };
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function incrementCounts(target, values) {
  for (const value of values) {
    target[value] = (target[value] ?? 0) + 1;
  }
}

function incrementObjectCounts(target, values) {
  for (const [key, value] of Object.entries(values)) {
    target[key] = (target[key] ?? 0) + Number(value);
  }
}

function hashForDisplay(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function displayFile(inputPath) {
  const extension = extname(String(inputPath)).toLowerCase() || ".session";
  return `file:${hashForDisplay(inputPath).slice(0, 12)}${extension}`;
}

function average(values) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function parseArgs(argv) {
  const parsed = {
    inputs: [],
    limit: 25,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") parsed.strict = true;
    else if (arg === "--input") parsed.inputs.push(argv[++index]);
    else if (arg === "--input-dir") parsed.inputDir = argv[++index];
    else if (arg === "--source") parsed.source = argv[++index];
    else if (arg === "--limit") parsed.limit = Number.parseInt(argv[++index] ?? "", 10);
    else if (arg === "--max-candidates") parsed.maxCandidates = Number.parseInt(argv[++index] ?? "", 10);
    else if (arg === "--output") parsed.output = argv[++index];
    else if (arg === "--help") {
      console.log([
        "Usage: node packages/bench/session-compaction-local-batch-audit.mjs [options]",
        "",
        "Options:",
        "  --input FILE             Add one JSON or JSONL session export. Repeatable.",
        "  --input-dir DIR          Audit every .json/.jsonl file in one directory.",
        "  --source SOURCE          Override source: codex|claude|hermes|openclaw|other.",
        "  --limit N                Maximum files to process. Default: 25.",
        "  --max-candidates N       Maximum memory candidates per session.",
        "  --output FILE            Write the metrics-only report with mode 0600.",
        "  --strict                 Enforce fixture-quality thresholds.",
      ].join("\n"));
      process.exit(0);
    }
  }
  if (!Number.isFinite(parsed.limit) || parsed.limit < 1) parsed.limit = 25;
  return parsed;
}
