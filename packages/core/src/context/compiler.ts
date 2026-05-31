import { redactPrivate } from "../redaction/private.js";

export type ContextIntent = "preference" | "current-state" | "temporal" | "event-count" | "general";

export interface ContextCandidate {
  id: string;
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface ContextFact {
  kind: ContextIntent;
  text: string;
  sourceId: string;
  confidence: "high" | "medium" | "low";
  atomicKind?: string;
  lifecycleStatus?: "current" | "superseded" | "tombstone" | "historical";
  supersedes?: string[];
  supersededBy?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface CompiledContext {
  intent: ContextIntent;
  text: string;
  citations: string[];
  facts: ContextFact[];
  evidence: Array<{ id: string; quote: string; score?: number; metadata?: Record<string, unknown> }>;
  tokenEstimate: number;
}

export function compileTypedContext(input: {
  query: string;
  candidates: ContextCandidate[];
  budgetTokens?: number;
  maxEvidenceItems?: number;
}): CompiledContext {
  const query = redactPrivate(input.query).text;
  const intent = classifyContextIntent(query);
  const maxEvidenceItems = input.maxEvidenceItems ?? (intent === "event-count" ? 8 : 5);
  const budgetTokens = input.budgetTokens ?? 1800;
  const budgetChars = Math.max(1200, budgetTokens * 4);
  const facts: ContextFact[] = [];
  const evidence: CompiledContext["evidence"] = [];

  for (const candidate of input.candidates.slice(0, maxEvidenceItems)) {
    const redacted = redactPrivate(candidate.text);
    if (redacted.fullyPrivate) continue;

    facts.push(...extractFacts(intent, query, candidate.id, redacted.text, candidate.metadata));
    const quote = selectEvidenceQuote(intent, query, redacted.text, Math.floor(budgetChars / maxEvidenceItems));
    if (quote.trim().length === 0) continue;
    const evidenceItem: CompiledContext["evidence"][number] = {
      id: candidate.id,
      quote,
    };
    if (typeof candidate.score === "number") evidenceItem.score = candidate.score;
    if (candidate.metadata !== undefined) evidenceItem.metadata = candidate.metadata;
    evidence.push(evidenceItem);
  }

  const uniqueFacts = dedupeFacts(facts);
  const text = renderTypedContext({ query, intent, facts: uniqueFacts, evidence });

  return {
    intent,
    text,
    citations: evidence.map((item) => item.id),
    facts: uniqueFacts,
    evidence,
    tokenEstimate: estimateTokens(text),
  };
}

export function classifyContextIntent(query: string): ContextIntent {
  const lower = query.toLowerCase();
  if (/\b(how many|count|number of)\b/.test(lower)) {
    return "event-count";
  }
  if (/\b(which|what)\b.*\b(first|before|after|earlier|later|start|started)\b/.test(lower)) {
    return "temporal";
  }
  if (/\b(current|latest|now|record|standing|status)\b/.test(lower)) {
    return "current-state";
  }
  if (/\b(prefer|preference|favorite|like|liked|suggest|recommend)\b/.test(lower)) {
    return "preference";
  }
  return "general";
}

function extractFacts(
  intent: ContextIntent,
  query: string,
  sourceId: string,
  text: string,
  metadata?: Record<string, unknown>,
): ContextFact[] {
  const atomicFact = extractAtomicMemoryFact(intent, sourceId, text, metadata);
  if (atomicFact) return [atomicFact];
  if (intent === "event-count") return extractEventFacts(sourceId, text);
  if (intent === "current-state") return extractCurrentStateFacts(sourceId, text);
  if (intent === "temporal") return extractTemporalFacts(query, sourceId, text, metadata);
  if (intent === "preference") return extractPreferenceFacts(sourceId, text);
  return [];
}

function extractAtomicMemoryFact(
  intent: ContextIntent,
  sourceId: string,
  text: string,
  metadata?: Record<string, unknown>,
): ContextFact | null {
  if (metadata?.kind !== "atomic_memory") return null;
  const atomicKind = safeMetadataString(metadata.atomicKind) ?? "fact";
  const confidence = safeConfidence(metadata.confidence);
  const lifecycleStatus = safeLifecycleStatus(metadata.lifecycleStatus, atomicKind);
  const factText = extractAtomicFactText(text) ?? trimSentence(text, 220);
  const fact: ContextFact = {
    kind: contextIntentForAtomicKind(atomicKind, intent),
    text: `${atomicKind}: ${factText}`,
    sourceId,
    confidence,
    atomicKind,
    lifecycleStatus,
  };
  const supersedes = safeMetadataStringArray(metadata.supersedes);
  const supersededBy = safeMetadataString(metadata.supersededBy);
  const validFrom = safeMetadataString(metadata.validFrom);
  const validUntil = safeMetadataString(metadata.validUntil);
  if (supersedes.length > 0) fact.supersedes = supersedes;
  if (supersededBy) fact.supersededBy = supersededBy;
  if (validFrom) fact.validFrom = validFrom;
  if (validUntil) fact.validUntil = validUntil;
  return fact;
}

function extractAtomicFactText(text: string): string | null {
  const match = text.match(/(?:^|\n)Atomic fact:\s*([^\n]+)/i);
  return match?.[1]?.trim() || null;
}

function contextIntentForAtomicKind(atomicKind: string, fallback: ContextIntent): ContextIntent {
  if (atomicKind === "preference") return "preference";
  if (atomicKind === "update" || atomicKind === "tombstone" || atomicKind === "decision") return "current-state";
  if (atomicKind === "task" || atomicKind === "procedure" || atomicKind === "bug") return "current-state";
  return fallback;
}

function safeConfidence(value: unknown): ContextFact["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function safeLifecycleStatus(value: unknown, atomicKind: string): NonNullable<ContextFact["lifecycleStatus"]> {
  if (value === "current" || value === "superseded" || value === "tombstone" || value === "historical") return value;
  return atomicKind === "tombstone" ? "tombstone" : "current";
}

function safeMetadataString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeMetadataStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeMetadataString(item)).filter((item): item is string => Boolean(item));
}

function extractEventFacts(sourceId: string, text: string): ContextFact[] {
  const sentences = splitSentences(text);
  const facts: ContextFact[] = [];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (/\b(plan|planning|upcoming|will|going to|might|maybe|idea|ideas)\b/.test(lower)) continue;
    if (!/\b(attended|went to|visited|joined|met|completed|finished|launched|deployed|fixed|created|decided|returned from|got back from)\b/.test(lower)) continue;

    facts.push({
      kind: "event-count",
      text: `Attended event evidence: ${trimSentence(sentence, 180)}`,
      sourceId,
      confidence: "medium",
    });
  }

  return facts;
}

function extractCurrentStateFacts(sourceId: string, text: string): ContextFact[] {
  const facts: ContextFact[] = [];
  for (const sentence of splitSentences(text)) {
    if (!/\b(current|latest|now|status|standing|record|active|default|selected|enabled|disabled)\b/i.test(sentence)) continue;
    facts.push({
      kind: "current-state",
      text: trimSentence(sentence, 180),
      sourceId,
      confidence: "medium",
    });
  }
  return facts;
}

function extractTemporalFacts(
  query: string,
  sourceId: string,
  text: string,
  metadata?: Record<string, unknown>,
): ContextFact[] {
  const facts: ContextFact[] = [];
  const entities = quotedPhrases(query);
  const sessionDate = typeof metadata?.date === "string" ? metadata.date : extractSessionDate(text);

  for (const entity of entities) {
    const window = windowAroundNeedle(text, entity, 600);
    if (!window) continue;
    let timing = sessionDate ? `Session date ${sessionDate}` : "Undated session";
    const relativeTime = extractRelativeTime(window);
    if (relativeTime && sessionDate) {
      timing += `; stated ${relativeTime}`;
    } else if (/\bstarted\b/.test(window.toLowerCase())) {
      timing += "; stated start evidence";
    }
    facts.push({
      kind: "temporal",
      text: `${entity}: ${timing}.`,
      sourceId,
      confidence: "medium",
    });
  }

  return facts;
}

function extractPreferenceFacts(sourceId: string, text: string): ContextFact[] {
  const facts: ContextFact[] = [];
  for (const sentence of splitSentences(text)) {
    if (!/\b(prefer|favorite|success|worked well|loved|like|enjoyed|hit with)\b/i.test(sentence)) continue;
    facts.push({
      kind: "preference",
      text: trimSentence(sentence, 180),
      sourceId,
      confidence: "medium",
    });
  }
  return facts;
}

function selectEvidenceQuote(intent: ContextIntent, query: string, text: string, budgetChars: number): string {
  const budget = Math.max(500, budgetChars);
  if (intent === "temporal") {
    const entities = quotedPhrases(query);
    const windows = entities.map((entity) => windowAroundNeedle(text, entity, Math.floor(budget / entities.length || budget)))
      .filter((value): value is string => Boolean(value));
    if (windows.length > 0) return windows.join("\n...\n").slice(0, budget);
  }

  const scored = scoreWindows(query, text, budget);
  return scored[0]?.text.trim() ?? text.slice(0, budget).trim();
}

function renderTypedContext(input: {
  query: string;
  intent: ContextIntent;
  facts: ContextFact[];
  evidence: CompiledContext["evidence"];
}): string {
  const currentFacts = input.facts.filter((fact) => !isHistoricalFact(fact));
  const historicalFacts = input.facts.filter((fact) => isHistoricalFact(fact));
  const factLines = input.facts.length > 0
    ? [
      "Current truth:",
      currentFacts.length > 0 ? renderFactList(currentFacts) : "No current facts extracted.",
      historicalFacts.length > 0 ? "\nSuperseded or historical facts:" : null,
      historicalFacts.length > 0 ? renderFactList(historicalFacts) : null,
    ].filter((value): value is string => Boolean(value)).join("\n")
    : "No derived facts extracted.";

  const evidenceLines = input.evidence.length > 0
    ? input.evidence.map((item, index) => {
      const provenance = renderEvidenceProvenance(item.metadata);
      const score = typeof item.score === "number" ? ` score=${item.score.toFixed(3)}` : "";
      return `### Evidence ${index + 1}: ${item.id}${provenance}${score}\n${item.quote}`;
    }).join("\n\n")
    : "No retrieved evidence.";

  return `RecallWeave shadow context
Intent: ${input.intent}
Query: ${input.query}

Derived facts:
${factLines}

Evidence:
${evidenceLines}`;
}

function isHistoricalFact(fact: ContextFact): boolean {
  return fact.lifecycleStatus === "superseded" || fact.lifecycleStatus === "tombstone" || Boolean(fact.supersededBy);
}

function renderFactList(facts: ContextFact[]): string {
  return facts.map((fact, index) => {
    const lifecycle = renderFactLifecycle(fact);
    return `${index + 1}. ${fact.text} [${fact.sourceId}]${lifecycle}`;
  }).join("\n");
}

function renderFactLifecycle(fact: ContextFact): string {
  const fields = [
    fact.lifecycleStatus ? `status=${fact.lifecycleStatus}` : null,
    fact.validFrom ? `validFrom=${fact.validFrom}` : null,
    fact.validUntil ? `validUntil=${fact.validUntil}` : null,
    fact.supersededBy ? `supersededBy=${fact.supersededBy}` : null,
    fact.supersedes && fact.supersedes.length > 0 ? `supersedes=${fact.supersedes.join(",")}` : null,
  ].filter((value): value is string => Boolean(value));
  return fields.length > 0 ? ` (${fields.join(" ")})` : "";
}

function renderEvidenceProvenance(metadata?: Record<string, unknown>): string {
  if (!metadata) return "";
  const fields = [
    ["date", metadata.date],
    ["event", metadata.eventDate],
    ["kind", metadata.kind],
    ["role", metadata.retrievalRole],
    ["title", metadata.title],
    ["topic", metadata.topic],
    ["source", metadata.sourceId ?? metadata.sourceChunkId],
    ["parent", metadata.parentSessionId],
    ["rehydrate", metadata.rehydrateId],
    ["atomic", metadata.atomicKind],
    ["status", metadata.lifecycleStatus],
    ["validFrom", metadata.validFrom],
    ["validUntil", metadata.validUntil],
    ["supersededBy", metadata.supersededBy],
    ["confidence", metadata.confidence],
  ]
    .map(([label, value]) => safeProvenanceField(label as string, value))
    .filter((value): value is string => Boolean(value));
  return fields.length ? ` ${fields.join(" ")}` : "";
}

function safeProvenanceField(label: string, value: unknown): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? `${label}=${value}` : null;
  if (typeof value === "boolean") return `${label}=${value}`;
  if (typeof value !== "string") return null;
  const redacted = redactPrivate(value).text.trim();
  if (!redacted || redacted.includes("[REDACTED")) return null;
  if (/(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i.test(redacted)) {
    return null;
  }
  const compact = redacted.replace(/\s+/g, "_");
  const truncated = compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
  return `${label}=${truncated}`;
}

function dedupeFacts(facts: ContextFact[]): ContextFact[] {
  const seen = new Set<string>();
  const output: ContextFact[] = [];
  for (const fact of facts) {
    const key = fact.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(fact);
  }
  return output;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=(?:user|assistant|[A-Z0-9"']))/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function scoreWindows(query: string, text: string, budget: number): Array<{ text: string; score: number }> {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 3 && !STOPWORDS.has(term));
  const windows: Array<{ text: string; score: number }> = [];
  const step = Math.max(300, Math.floor(budget / 2));
  for (let start = 0; start < text.length; start += step) {
    const candidate = text.slice(start, start + budget);
    const lower = candidate.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (lower.match(new RegExp(escapeRegExp(term), "g"))?.length ?? 0), 0);
    windows.push({ text: candidate, score });
  }
  return windows.sort((a, b) => b.score - a.score);
}

function windowAroundNeedle(text: string, needle: string, budget: number): string | null {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return null;
  return trimWindow(text, index, budget);
}

function trimWindow(text: string, center: number, budget: number): string {
  const half = Math.floor(budget / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(text.length, start + budget);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < text.length ? " ..." : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function quotedPhrases(query: string): string[] {
  return Array.from(query.matchAll(/["']([^"']+)["']/g))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value && value.length > 1));
}

function extractSessionDate(text: string): string | undefined {
  return text.match(/^Session date:\s*([^\n]+)/)?.[1]?.trim();
}

function extractRelativeTime(text: string): string | undefined {
  const lower = text.toLowerCase();
  const match = lower.match(/\b(?:about\s+|around\s+|roughly\s+)?(?:a|an|one|\d{1,3})\s+(?:day|days|week|weeks|month|months|year|years)\s+(?:ago|earlier|before|after)\b/);
  if (match?.[0]) return match[0];
  const duration = lower.match(/\b(?:for\s+)?(?:a|an|one|\d{1,3})\s+(?:day|days|week|weeks|month|months|year|years)\b/);
  if (duration?.[0]) return `duration ${duration[0].replace(/^for\s+/, "")}`;
  return undefined;
}

function trimSentence(sentence: string, maxLength: number): string {
  const compact = sentence.replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 4).trim()} ...`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "have",
  "what",
  "when",
  "where",
  "which",
  "were",
  "was",
  "did",
  "does",
  "how",
  "many",
  "current",
  "any",
  "some",
  "over",
]);
