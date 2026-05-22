import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import {
  compactSession,
  containsRedactionBoundaryText,
} from "../core/dist/index.js";

const args = parseArgs(process.argv.slice(2));
const fixtureUrl = new URL("./fixtures/session-compaction-local-audit.fixture.jsonl", import.meta.url);
const inputPath = args.input ?? fixtureUrl;
const strict = Boolean(args.strict ?? !args.input);
const raw = await readFile(inputPath, "utf8");
const session = parseSession(raw, {
  source: args.source ?? "codex",
  sessionId: args.sessionId ?? `local-session:${hashForDisplay(raw).slice(0, 16)}`,
});
const result = compactSession({
  ...session,
  maxCandidates: args.maxCandidates ?? 40,
});
const report = buildMetricsOnlyReport(result, {
  inputPathDisplay: displayPath(inputPath),
  strict,
});

if (strict) {
  assert.equal(report.quality.privacyLeakCount, 0, JSON.stringify(report, null, 2));
  assert.equal(report.metrics.chronological, true, JSON.stringify(report, null, 2));
  assert.ok(report.metrics.redactionCount >= 2, JSON.stringify(report, null, 2));
  assert.ok(report.metrics.outputCandidates >= 4, JSON.stringify(report, null, 2));
  assert.ok(report.quality.kindCounts.decision >= 1, JSON.stringify(report, null, 2));
  assert.ok(report.quality.kindCounts.procedure >= 1, JSON.stringify(report, null, 2));
  assert.ok(report.quality.exactIdentifierCandidateCount >= 1, JSON.stringify(report, null, 2));
}

console.log(JSON.stringify(report, null, 2));

function buildMetricsOnlyReport(result, options) {
  const candidates = result.candidates;
  const candidateText = candidates.map((candidate) => candidate.text).join("\n");
  const serializedWithoutText = JSON.stringify({
    sessionId: result.sessionId,
    source: result.source,
    metrics: result.metrics,
    candidateFingerprints: candidates.map(candidateFingerprint),
  });
  const privacyLeakCount =
    (containsRedactionBoundaryText(candidateText) ? 1 : 0) +
    (containsRedactionBoundaryText(serializedWithoutText) ? 1 : 0);
  const kindCounts = {};
  const salienceBands = { high: 0, medium: 0, low: 0 };
  for (const candidate of candidates) {
    kindCounts[candidate.kind] = (kindCounts[candidate.kind] ?? 0) + 1;
    if (candidate.salience >= 0.8) salienceBands.high += 1;
    else if (candidate.salience >= 0.6) salienceBands.medium += 1;
    else salienceBands.low += 1;
  }
  return {
    ok: privacyLeakCount === 0 && result.metrics.chronological === true,
    mode: "local-session-compaction-audit",
    writesRealFiles: false,
    metricsOnly: true,
    input: {
      source: result.source,
      sessionIdHash: hashForDisplay(result.sessionId),
      inputPathDisplay: options.inputPathDisplay,
      eventCount: result.metrics.inputEvents,
    },
    metrics: result.metrics,
    quality: {
      candidateCount: candidates.length,
      kindCounts,
      staleCandidateCount: candidates.filter((candidate) => candidate.stale).length,
      exactIdentifierCandidateCount: candidates.filter((candidate) => candidate.reasons.includes("exact-identifier")).length,
      averageSalience: average(candidates.map((candidate) => candidate.salience)),
      salienceBands,
      firstObservedAt: candidates[0]?.observedAt ?? null,
      lastObservedAt: candidates.at(-1)?.observedAt ?? null,
      privacyLeakCount,
    },
    candidateFingerprints: candidates.map(candidateFingerprint),
    strict: options.strict,
  };
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

function parseSession(raw, fallback) {
  const trimmed = raw.trim();
  const parsed = parseJsonOrJsonLines(trimmed);
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.events)) {
    return {
      sessionId: String(parsed.sessionId ?? fallback.sessionId),
      source: normalizeSource(parsed.source ?? fallback.source),
      startedAt: safeTimestamp(parsed.startedAt ?? parsed.events[0]?.timestamp),
      endedAt: parsed.endedAt ? safeTimestamp(parsed.endedAt) : undefined,
      events: parsed.events.map(normalizeEvent),
    };
  }
  const events = Array.isArray(parsed) ? parsed.map(normalizeEvent) : [normalizeEvent(parsed)];
  return {
    sessionId: fallback.sessionId,
    source: normalizeSource(fallback.source),
    startedAt: safeTimestamp(events[0]?.timestamp),
    events,
  };
}

function parseJsonOrJsonLines(raw) {
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      if (!raw.includes("\n")) throw error;
    }
  }
  return parseJsonLines(raw);
}

function parseJsonLines(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function normalizeEvent(event, index = 0) {
  const timestamp = safeTimestamp(event?.timestamp ?? event?.createdAt ?? event?.created_at);
  return {
    id: String(event?.id ?? event?.uuid ?? event?.event_id ?? `event-${index}`),
    role: normalizeRole(event?.role ?? event?.message?.role ?? event?.type),
    timestamp,
    content: extractText(event?.content ?? event?.text ?? event?.message?.content ?? event?.parts ?? event),
    metadata: {
      sourceType: String(event?.type ?? event?.kind ?? "event"),
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
      .filter(([key]) => ["content", "text", "message", "parts", "summary"].includes(key))
      .map(([, nested]) => extractText(nested))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function normalizeRole(value) {
  const role = String(value ?? "user").toLowerCase();
  return ["user", "assistant", "tool", "system"].includes(role) ? role : "user";
}

function normalizeSource(value) {
  const source = String(value ?? "other").toLowerCase();
  return ["codex", "claude", "hermes", "openclaw", "other"].includes(source) ? source : "other";
}

function safeTimestamp(value) {
  const date = new Date(value ?? "1970-01-01T00:00:00.000Z");
  return Number.isNaN(date.getTime()) ? "1970-01-01T00:00:00.000Z" : date.toISOString();
}

function hashForDisplay(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function displayPath(pathOrUrl) {
  const value = String(pathOrUrl);
  if (value.startsWith("file:")) return `.../${basename(new URL(value).pathname)}`;
  return `.../${basename(value)}`;
}

function average(values) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") parsed.strict = true;
    else if (arg === "--input") parsed.input = argv[++index];
    else if (arg === "--source") parsed.source = argv[++index];
    else if (arg === "--session-id") parsed.sessionId = argv[++index];
    else if (arg === "--max-candidates") parsed.maxCandidates = Number.parseInt(argv[++index] ?? "", 10);
    else if (arg === "--help") {
      console.log("Usage: node packages/bench/session-compaction-local-audit.mjs [--input events.jsonl] [--source codex|claude|hermes|openclaw|other] [--session-id ID] [--strict]");
      process.exit(0);
    }
  }
  return parsed;
}
