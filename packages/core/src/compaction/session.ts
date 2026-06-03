import { createHash } from "node:crypto";
import { redactPrivate } from "../redaction/private.js";
import type { MemoryKind } from "../types.js";

export type SessionEventRole = "user" | "assistant" | "tool" | "system";
export type SessionSource = "codex" | "claude" | "hermes" | "openclaw" | "other";

export interface SessionEvent {
  id: string;
  role: SessionEventRole;
  content: string;
  timestamp: string;
  source?: SessionSource;
  metadata?: Record<string, unknown>;
}

export interface SessionCompactionInput {
  sessionId: string;
  source: SessionSource;
  startedAt: string;
  endedAt?: string;
  events: SessionEvent[];
  maxCandidates?: number;
  staleRules?: SessionCompactionStaleRule[];
}

export type SessionLifecyclePhase =
  | "session_start"
  | "pre_compact"
  | "candidate_distilled"
  | "topic_linked"
  | "session_map_ready"
  | "session_end";

export interface CompactedMemoryCandidate {
  id: string;
  kind: MemoryKind;
  text: string;
  observedAt: string;
  sourceSessionId: string;
  sourceEventIds: string[];
  salience: number;
  reasons: string[];
  stale?: boolean;
}

export interface SessionTopicLink {
  id: string;
  topicPath: string[];
  candidateIds: string[];
  sourceEventIds: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  salience: number;
  reasons: string[];
}

export interface SessionLifecycleEvent {
  id: string;
  phase: SessionLifecyclePhase;
  observedAt: string;
  sourceEventIds: string[];
  candidateIds: string[];
  topicIds: string[];
  counters: Record<string, number>;
  warnings: string[];
}

export interface SessionMapTelemetry {
  counters: {
    inputEvents: number;
    statementsInspected: number;
    durableStatements: number;
    duplicateCandidateMerges: number;
    redactionCount: number;
    skippedFullyPrivate: number;
    skippedNoise: number;
    outputCandidates: number;
    topicLinks: number;
    linkedCandidates: number;
    unlinkedCandidates: number;
    staleCandidates: number;
  };
  wasteSignals: string[];
  warnings: string[];
}

export interface SessionMap {
  id: string;
  sessionId: string;
  source: SessionSource;
  startedAt: string;
  endedAt?: string;
  candidateIds: string[];
  topicLinks: SessionTopicLink[];
  lifecycleEvents: SessionLifecycleEvent[];
  telemetry: SessionMapTelemetry;
}

export interface SessionCompactionMetrics {
  inputEvents: number;
  redactionCount: number;
  skippedFullyPrivate: number;
  skippedNoise: number;
  outputCandidates: number;
  chronological: boolean;
  noiseReductionRatio: number;
}

export interface SessionCompactionResult {
  sessionId: string;
  source: SessionSource;
  candidates: CompactedMemoryCandidate[];
  metrics: SessionCompactionMetrics;
  sessionMap: SessionMap;
}

export interface SessionCompactionStaleRule {
  id: string;
  pattern: RegExp;
  detailPattern?: RegExp;
  replacementText?: string;
  saliencePenalty?: number;
}

const noisePattern =
  /\b(ok|okay|thanks|thank you|lol|lmao|status check|heartbeat|typing|running|done|looks good)\b/i;

type DurablePattern = {
  kind: MemoryKind;
  pattern: RegExp;
  reason: string;
  baseSalience: number;
};

const durablePatterns: DurablePattern[] = [
  { kind: "decision", pattern: /\b(decided|decision|default|approved|use .* as|keep .* as)\b/i, reason: "decision", baseSalience: 0.86 },
  { kind: "preference", pattern: /\b(prefer|preference|want|don't want|do not want|do not write|never store|comfort|annoying|easier)\b/i, reason: "preference", baseSalience: 0.78 },
  { kind: "profile", pattern: /\b(remember|background|profile|identity|high-level|class context|school material)\b/i, reason: "profile", baseSalience: 0.7 },
  { kind: "procedure", pattern: /\b(procedure|run|install|setup|set up|wire|configure|update|doctor|smoke|test)\b/i, reason: "procedure", baseSalience: 0.82 },
  { kind: "bug", pattern: /\b(bug|error|failed|failure|issue|regression|broken|blocked)\b/i, reason: "bug", baseSalience: 0.75 },
  { kind: "fix", pattern: /\b(fix|fixed|patched|resolved|clean|passed|working|verified)\b/i, reason: "fix", baseSalience: 0.76 },
  { kind: "methodology", pattern: /\b(benchmark|hypothesis|research|lineage|source-lock|review|evidence|gate)\b/i, reason: "methodology", baseSalience: 0.8 },
  { kind: "source", pattern: /\b(source|paper|docs|github|plugin|gbrain|wiki|obsidian)\b/i, reason: "source", baseSalience: 0.69 },
  { kind: "fact", pattern: /\b[A-Z][A-Z0-9]+-\d{2,}\b/, reason: "exact-identifier", baseSalience: 0.74 },
];

const defaultStaleRules: SessionCompactionStaleRule[] = [
  {
    id: "completed-academic-term",
    pattern: /\b(Spring|Summer|Fall|Winter)\s+20\d{2}\b/i,
    detailPattern: /\b(class|course|school|notes|outline|exam)\b/i,
    replacementText: "Completed academic-term material is stale background. Keep only high-level profile context, not bulk notes.",
    saliencePenalty: 0.32,
  },
];

export function compactSession(input: SessionCompactionInput): SessionCompactionResult {
  const maxCandidates = input.maxCandidates ?? 40;
  const sortedEvents = [...input.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const candidates = new Map<string, CompactedMemoryCandidate>();
  let redactionCount = 0;
  let skippedFullyPrivate = 0;
  let skippedNoise = 0;
  let statementsInspected = 0;
  let durableStatements = 0;
  let duplicateCandidateMerges = 0;

  for (const event of sortedEvents) {
    const redacted = redactPrivate(event.content);
    redactionCount += redacted.redactionCount;
    if (redacted.fullyPrivate) {
      skippedFullyPrivate += 1;
      continue;
    }

    const statements = splitStatements(redacted.text);
    for (const statement of statements) {
      statementsInspected += 1;
      const compacted = compactStatement({
        sessionId: input.sessionId,
        eventId: event.id,
        timestamp: event.timestamp,
        statement,
        staleRules: input.staleRules ?? defaultStaleRules,
      });

      if (!compacted) {
        skippedNoise += 1;
        continue;
      }

      durableStatements += 1;
      const existing = candidates.get(compacted.id);
      if (existing) {
        duplicateCandidateMerges += 1;
        existing.sourceEventIds.push(event.id);
        existing.salience = Math.max(existing.salience, compacted.salience);
        existing.reasons = [...new Set([...existing.reasons, ...compacted.reasons])];
        continue;
      }

      candidates.set(compacted.id, compacted);
      if (candidates.size >= maxCandidates) break;
    }
    if (candidates.size >= maxCandidates) break;
  }

  const output = [...candidates.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const metrics = {
    inputEvents: input.events.length,
    redactionCount,
    skippedFullyPrivate,
    skippedNoise,
    outputCandidates: output.length,
    chronological: isChronological(output),
    noiseReductionRatio: input.events.length === 0 ? 0 : 1 - output.length / input.events.length,
  };
  return {
    sessionId: input.sessionId,
    source: input.source,
    candidates: output,
    metrics,
    sessionMap: buildSessionMap({
      input,
      sortedEvents,
      candidates: output,
      metrics,
      counters: {
        statementsInspected,
        durableStatements,
        duplicateCandidateMerges,
      },
    }),
  };
}

function compactStatement(input: {
  sessionId: string;
  eventId: string;
  timestamp: string;
  statement: string;
  staleRules: SessionCompactionStaleRule[];
}): CompactedMemoryCandidate | undefined {
  const text = normalizeStatement(input.statement);
  if (text.length < 24) return undefined;
  if (noisePattern.test(text) && text.length < 90) return undefined;

  const staleRule = findStaleRule(text, input.staleRules);
  const stale = Boolean(staleRule);
  const matches = durablePatterns.filter((item) => item.pattern.test(text));
  if (matches.length === 0 && !stale) return undefined;

  const selected = selectBestMatch(text, matches) ?? { kind: "profile" as MemoryKind, pattern: /\bprofile\b/i, reason: "profile", baseSalience: 0.7 };
  const salience = Math.max(
    0.1,
    selected.baseSalience + Math.min(matches.length, 3) * 0.03 - (stale ? staleRule?.saliencePenalty ?? 0.32 : 0),
  );
  const rendered = stale && staleRule ? renderStaleMemory(text, staleRule) : text;
  return {
    id: `compact:${stableHash(`${selected.kind}:${rendered}`).slice(0, 24)}`,
    kind: stale ? "profile" : selected.kind,
    text: rendered,
    observedAt: input.timestamp,
    sourceSessionId: input.sessionId,
    sourceEventIds: [input.eventId],
    salience: Number(salience.toFixed(2)),
    reasons: [...new Set(matches.map((item) => item.reason).concat(staleRule ? [`stale:${staleRule.id}`] : []))],
    ...(stale ? { stale: true } : {}),
  };
}

function selectBestMatch(text: string, matches: DurablePattern[]): DurablePattern | undefined {
  return [...matches].sort((a, b) => matchScore(text, b) - matchScore(text, a))[0];
}

function matchScore(text: string, pattern: DurablePattern): number {
  return pattern.baseSalience + (hasExplicitKindLabel(text, pattern.kind) ? 0.2 : 0);
}

function hasExplicitKindLabel(text: string, kind: MemoryKind): boolean {
  const labels: Record<string, string[]> = {
    decision: ["decision", "decided"],
    preference: ["preference"],
    procedure: ["procedure"],
    bug: ["bug", "issue"],
    fix: ["fix", "fixed"],
    methodology: ["methodology", "research hypothesis", "hypothesis"],
    source: ["source"],
  };
  const kindLabels = labels[kind] ?? [];
  return kindLabels.some((label) => new RegExp(`^\\s*${label}\\s*:`, "i").test(text));
}

function findStaleRule(text: string, rules: SessionCompactionStaleRule[]): SessionCompactionStaleRule | undefined {
  return rules.find((rule) => rule.pattern.test(text) && (!rule.detailPattern || rule.detailPattern.test(text)));
}

function renderStaleMemory(_text: string, rule: SessionCompactionStaleRule): string {
  if (rule.replacementText) return rule.replacementText;
  return "Stale source material is background. Keep only high-level context, not bulk historical detail.";
}

function splitStatements(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n{2,}|(?:^|\n)\s*[-*]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStatement(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function isChronological(candidates: CompactedMemoryCandidate[]): boolean {
  return candidates.every((candidate, index) => index === 0 || candidates[index - 1]!.observedAt <= candidate.observedAt);
}

function buildSessionMap(input: {
  input: SessionCompactionInput;
  sortedEvents: SessionEvent[];
  candidates: CompactedMemoryCandidate[];
  metrics: SessionCompactionMetrics;
  counters: {
    statementsInspected: number;
    durableStatements: number;
    duplicateCandidateMerges: number;
  };
}): SessionMap {
  const topicLinks = buildTopicLinks(input.candidates);
  const linkedCandidateIds = new Set(topicLinks.flatMap((link) => link.candidateIds));
  const warnings = buildSessionMapWarnings(input.metrics, topicLinks, linkedCandidateIds);
  const telemetry: SessionMapTelemetry = {
    counters: {
      inputEvents: input.metrics.inputEvents,
      statementsInspected: input.counters.statementsInspected,
      durableStatements: input.counters.durableStatements,
      duplicateCandidateMerges: input.counters.duplicateCandidateMerges,
      redactionCount: input.metrics.redactionCount,
      skippedFullyPrivate: input.metrics.skippedFullyPrivate,
      skippedNoise: input.metrics.skippedNoise,
      outputCandidates: input.metrics.outputCandidates,
      topicLinks: topicLinks.length,
      linkedCandidates: linkedCandidateIds.size,
      unlinkedCandidates: input.candidates.length - linkedCandidateIds.size,
      staleCandidates: input.candidates.filter((candidate) => candidate.stale).length,
    },
    wasteSignals: buildWasteSignals(input.metrics, topicLinks, linkedCandidateIds.size, input.candidates.length),
    warnings,
  };
  const sessionMapId = `session-map:${stableHash(`${input.input.source}:${input.input.sessionId}`).slice(0, 24)}`;
  const base = {
    sessionMapId,
    events: input.sortedEvents,
    candidates: input.candidates,
    topicLinks,
    telemetry,
  };
  return {
    id: sessionMapId,
    sessionId: input.input.sessionId,
    source: input.input.source,
    startedAt: input.input.startedAt,
    ...(input.input.endedAt ? { endedAt: input.input.endedAt } : {}),
    candidateIds: input.candidates.map((candidate) => candidate.id),
    topicLinks,
    lifecycleEvents: [
      lifecycleEvent({ ...base, phase: "session_start", observedAt: input.input.startedAt, sourceEventIds: [], candidateIds: [], topicIds: [] }),
      lifecycleEvent({ ...base, phase: "pre_compact", observedAt: input.sortedEvents[0]?.timestamp ?? input.input.startedAt, sourceEventIds: input.sortedEvents.map((event) => event.id), candidateIds: [], topicIds: [] }),
      lifecycleEvent({ ...base, phase: "candidate_distilled", observedAt: input.candidates.at(-1)?.observedAt ?? input.input.startedAt, sourceEventIds: [...new Set(input.candidates.flatMap((candidate) => candidate.sourceEventIds))], candidateIds: input.candidates.map((candidate) => candidate.id), topicIds: [] }),
      lifecycleEvent({ ...base, phase: "topic_linked", observedAt: input.candidates.at(-1)?.observedAt ?? input.input.startedAt, sourceEventIds: [...new Set(topicLinks.flatMap((link) => link.sourceEventIds))], candidateIds: [...linkedCandidateIds], topicIds: topicLinks.map((link) => link.id) }),
      lifecycleEvent({ ...base, phase: "session_map_ready", observedAt: input.input.endedAt ?? input.sortedEvents.at(-1)?.timestamp ?? input.input.startedAt, sourceEventIds: input.sortedEvents.map((event) => event.id), candidateIds: input.candidates.map((candidate) => candidate.id), topicIds: topicLinks.map((link) => link.id) }),
      lifecycleEvent({ ...base, phase: "session_end", observedAt: input.input.endedAt ?? input.sortedEvents.at(-1)?.timestamp ?? input.input.startedAt, sourceEventIds: [], candidateIds: [], topicIds: [] }),
    ],
    telemetry,
  };
}

function buildTopicLinks(candidates: CompactedMemoryCandidate[]): SessionTopicLink[] {
  const grouped = new Map<string, SessionTopicLink>();
  for (const candidate of candidates) {
    const topicPath = topicPathForCandidate(candidate);
    const topicKey = topicPath.join(" / ");
    const existing = grouped.get(topicKey);
    if (existing) {
      existing.candidateIds.push(candidate.id);
      existing.sourceEventIds = [...new Set([...existing.sourceEventIds, ...candidate.sourceEventIds])];
      existing.firstObservedAt = existing.firstObservedAt < candidate.observedAt ? existing.firstObservedAt : candidate.observedAt;
      existing.lastObservedAt = existing.lastObservedAt > candidate.observedAt ? existing.lastObservedAt : candidate.observedAt;
      existing.salience = Number(Math.max(existing.salience, candidate.salience).toFixed(2));
      existing.reasons = [...new Set([...existing.reasons, ...candidate.reasons])];
      continue;
    }
    grouped.set(topicKey, {
      id: `topic-link:${stableHash(topicKey).slice(0, 24)}`,
      topicPath,
      candidateIds: [candidate.id],
      sourceEventIds: [...candidate.sourceEventIds],
      firstObservedAt: candidate.observedAt,
      lastObservedAt: candidate.observedAt,
      salience: candidate.salience,
      reasons: [...candidate.reasons],
    });
  }
  return [...grouped.values()].sort((a, b) => b.salience - a.salience || a.topicPath.join(" / ").localeCompare(b.topicPath.join(" / ")));
}

function topicPathForCandidate(candidate: CompactedMemoryCandidate): string[] {
  const topicText = candidate.text.replace(/^\s*(Decision|Preference|Procedure|Bug|Fix|Methodology|Research hypothesis|Fact|Profile|Source)\s*:\s*/i, "");
  const exact = topicText.match(/\b[A-Z][A-Z0-9]+-\d{2,}\b/)?.[0];
  const properName = topicText.match(/\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,2}\b/)?.[0];
  const root = exact ?? properName ?? candidate.kind;
  return [normalizeTopicSegment(root), normalizeTopicSegment(candidate.kind)];
}

function normalizeTopicSegment(value: string): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "General";
  return cleaned
    .split(" ")
    .slice(0, 6)
    .map((word) => (word.match(/^[A-Z0-9_-]+$/) ? word : word[0]!.toUpperCase() + word.slice(1)))
    .join(" ");
}

function lifecycleEvent(input: {
  sessionMapId: string;
  phase: SessionLifecyclePhase;
  observedAt: string;
  sourceEventIds: string[];
  candidateIds: string[];
  topicIds: string[];
  telemetry: SessionMapTelemetry;
}): SessionLifecycleEvent {
  return {
    id: `lifecycle:${stableHash(`${input.sessionMapId}:${input.phase}:${input.observedAt}`).slice(0, 24)}`,
    phase: input.phase,
    observedAt: input.observedAt,
    sourceEventIds: input.sourceEventIds,
    candidateIds: input.candidateIds,
    topicIds: input.topicIds,
    counters: countersForLifecyclePhase(input.phase, input.telemetry),
    warnings: input.telemetry.warnings,
  };
}

function countersForLifecyclePhase(phase: SessionLifecyclePhase, telemetry: SessionMapTelemetry): Record<string, number> {
  if (phase === "pre_compact") {
    return {
      inputEvents: telemetry.counters.inputEvents,
      statementsInspected: telemetry.counters.statementsInspected,
      redactionCount: telemetry.counters.redactionCount,
      skippedFullyPrivate: telemetry.counters.skippedFullyPrivate,
    };
  }
  if (phase === "candidate_distilled") {
    return {
      durableStatements: telemetry.counters.durableStatements,
      duplicateCandidateMerges: telemetry.counters.duplicateCandidateMerges,
      outputCandidates: telemetry.counters.outputCandidates,
      skippedNoise: telemetry.counters.skippedNoise,
      staleCandidates: telemetry.counters.staleCandidates,
    };
  }
  if (phase === "topic_linked") {
    return {
      topicLinks: telemetry.counters.topicLinks,
      linkedCandidates: telemetry.counters.linkedCandidates,
      unlinkedCandidates: telemetry.counters.unlinkedCandidates,
    };
  }
  if (phase === "session_map_ready") {
    return {
      outputCandidates: telemetry.counters.outputCandidates,
      topicLinks: telemetry.counters.topicLinks,
      warningCount: telemetry.warnings.length,
      wasteSignalCount: telemetry.wasteSignals.length,
    };
  }
  return {};
}

function buildWasteSignals(
  metrics: SessionCompactionMetrics,
  topicLinks: SessionTopicLink[],
  linkedCandidateCount: number,
  candidateCount: number,
): string[] {
  const signals = [];
  if (metrics.skippedNoise > Math.max(3, metrics.outputCandidates * 2)) signals.push("high-noise-skip-rate");
  if (metrics.redactionCount > 0) signals.push("redaction-observed");
  if (topicLinks.length === 0 && candidateCount > 0) signals.push("no-topic-links");
  if (candidateCount > linkedCandidateCount) signals.push("unlinked-candidates");
  if (metrics.noiseReductionRatio < 0.2 && metrics.inputEvents > 3) signals.push("low-noise-reduction");
  return signals;
}

function buildSessionMapWarnings(
  metrics: SessionCompactionMetrics,
  topicLinks: SessionTopicLink[],
  linkedCandidateIds: Set<string>,
): string[] {
  const warnings = [];
  if (!metrics.chronological) warnings.push("candidate-order-not-chronological");
  if (metrics.outputCandidates === 0 && metrics.inputEvents > 0) warnings.push("no-durable-candidates");
  if (topicLinks.length === 0 && metrics.outputCandidates > 0) warnings.push("topic-map-empty");
  if (linkedCandidateIds.size < metrics.outputCandidates) warnings.push("some-candidates-unlinked");
  return warnings;
}
