import { compileTypedContext } from "../context/compiler.js";
import { redactPrivate } from "../redaction/private.js";
import type { HybridCandidate, NormalizedHybridCandidate } from "./normalize.js";
import { dedupeHybridCandidates, type DedupeResult } from "./dedupe.js";
import { tokenizeForSimilarity } from "./normalize.js";
import { createDeterministicCompactWriter, type CompactWriter, type DistillationTrace } from "./distill.js";

export interface HybridSearchSource {
  id: string;
  origin: HybridCandidate["origin"];
  required?: boolean;
  search(query: string, options: { topK: number }): Promise<HybridCandidate[]>;
}

export interface HybridSearchTrace {
  sourceRuns: Array<{
    sourceId: string;
    origin: HybridCandidate["origin"];
    status: "ok" | "error";
    candidateCount: number;
    elapsedMs: number;
    message?: string;
  }>;
  dedupe: {
    groups: DedupeResult["groups"];
    reviewCandidates: DedupeResult["reviewCandidates"];
    skippedUnsafe: number;
  };
  ranking: {
    mode: string;
    candidateCount: number;
    selectedCount: number;
  };
  context: {
    rehydratedAtomicCount: number;
    missingSourceCount: number;
  };
  distillation?: DistillationTrace;
}

export interface HybridSearchResult {
  candidates: NormalizedHybridCandidate[];
  context: ReturnType<typeof compileTypedContext>;
  trace: HybridSearchTrace;
}

export type HybridRanker = (
  query: string,
  candidates: NormalizedHybridCandidate[],
  options: { topK: number },
) => Promise<NormalizedHybridCandidate[]> | NormalizedHybridCandidate[];

export async function searchHybrid(input: {
  query: string;
  sources: HybridSearchSource[];
  topK?: number;
  contextBudgetTokens?: number;
  distill?: boolean;
  compactWriter?: CompactWriter;
  distillationMaxMemories?: number;
  ranker?: HybridRanker;
  rankerMode?: string;
}): Promise<HybridSearchResult> {
  const redacted = redactPrivate(input.query);
  if (redacted.fullyPrivate) {
    throw new Error("Cannot search hybrid memory with a fully private query.");
  }
  const topK = input.topK ?? 10;
  const sourceRuns: HybridSearchTrace["sourceRuns"] = [];
  const batches = await Promise.all(input.sources.map(async (source) => {
    const startedAt = performance.now();
    try {
      const hits = await source.search(redacted.text, { topK });
      sourceRuns.push({
        sourceId: source.id,
        origin: source.origin,
        status: "ok",
        candidateCount: hits.length,
        elapsedMs: performance.now() - startedAt,
      });
      return hits;
    } catch (error) {
      sourceRuns.push({
        sourceId: source.id,
        origin: source.origin,
        status: "error",
        candidateCount: 0,
        elapsedMs: performance.now() - startedAt,
        message: sanitizeError(String(error)),
      });
      if (source.required) throw error;
      return [];
    }
  }));

  const deduped = dedupeHybridCandidates(batches.flat());
  const distillation = input.distill
    ? await (input.compactWriter ?? createDeterministicCompactWriter()).distill({
      query: redacted.text,
      candidates: deduped.candidates,
      maxMemories: input.distillationMaxMemories ?? Math.max(topK, 12),
    })
    : undefined;
  const searchableCandidates = distillation?.memories.length ? distillation.memories : deduped.candidates;
  const ranker = input.ranker ?? ((query, candidates, options) => rerankLexically(query, candidates).slice(0, options.topK));
  const ranked = (await ranker(redacted.text, searchableCandidates, { topK })).slice(0, topK);
  const contextRehydration = rehydrateContextCandidates(ranked, deduped.candidates);
  const contextInput = {
    query: redacted.text,
    candidates: contextRehydration.candidates,
    ...(input.contextBudgetTokens !== undefined ? { budgetTokens: input.contextBudgetTokens } : {}),
  };
  const context = compileTypedContext(contextInput);

  return {
    candidates: ranked,
    context,
    trace: {
      sourceRuns: sourceRuns.sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
      dedupe: {
        groups: deduped.groups,
        reviewCandidates: deduped.reviewCandidates,
        skippedUnsafe: deduped.skippedUnsafe,
      },
      ranking: {
        mode: input.rankerMode ?? "lexical",
        candidateCount: searchableCandidates.length,
        selectedCount: ranked.length,
      },
      context: {
        rehydratedAtomicCount: contextRehydration.rehydratedAtomicCount,
        missingSourceCount: contextRehydration.missingSourceCount,
      },
      ...(distillation ? { distillation: distillation.trace } : {}),
    },
  };
}

export function makeStaticHybridSource(input: {
  id: string;
  origin: HybridCandidate["origin"];
  candidates: HybridCandidate[];
  fail?: boolean;
}): HybridSearchSource {
  return {
    id: input.id,
    origin: input.origin,
    async search(query, options) {
      if (input.fail) throw new Error(`${input.id} unavailable`);
      return rerankLexically(query, input.candidates).slice(0, options.topK);
    },
  };
}

function rerankLexically<T extends HybridCandidate>(query: string, candidates: T[]): T[] {
  const queryTokens = new Set(tokenizeForSimilarity(query));
  return candidates
    .map((candidate) => ({ candidate, score: candidate.score + lexicalScore(queryTokens, candidate.text) }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .map(({ candidate, score }) => ({ ...candidate, score }));
}

function lexicalScore(queryTokens: Set<string>, text: string): number {
  const docTokens = new Set(tokenizeForSimilarity(text));
  let score = 0;
  for (const token of queryTokens) {
    if (docTokens.has(token)) score += 1;
  }
  return score;
}

function rehydrateContextCandidates(
  ranked: NormalizedHybridCandidate[],
  searchableCandidates: NormalizedHybridCandidate[],
): {
  candidates: Array<{ id: string; text: string; score: number; metadata: Record<string, unknown> }>;
  rehydratedAtomicCount: number;
  missingSourceCount: number;
} {
  const sources = sourceCandidateIndex(searchableCandidates);
  let rehydratedAtomicCount = 0;
  let missingSourceCount = 0;

  const candidates = ranked.map((candidate) => {
    const metadata = contextMetadata(candidate);
    const rehydrateId = sourceRehydrateId(candidate);
    if (!rehydrateId) {
      return {
        id: candidate.id,
        text: candidate.text,
        score: candidate.score,
        metadata,
      };
    }

    const source = sources.get(rehydrateId);
    if (!source || source.id === candidate.id) {
      missingSourceCount += 1;
      return {
        id: candidate.id,
        text: candidate.text,
        score: candidate.score,
        metadata,
      };
    }

    rehydratedAtomicCount += 1;
    return {
      id: candidate.id,
      text: rehydratedContextText(candidate, source),
      score: candidate.score,
      metadata,
    };
  });

  return {
    candidates,
    rehydratedAtomicCount,
    missingSourceCount,
  };
}

function sourceCandidateIndex(candidates: NormalizedHybridCandidate[]): Map<string, NormalizedHybridCandidate> {
  const index = new Map<string, NormalizedHybridCandidate>();
  for (const candidate of candidates) {
    if (!isSourceCandidate(candidate)) continue;
    for (const key of sourceCandidateKeys(candidate)) {
      if (!index.has(key)) index.set(key, candidate);
    }
  }
  return index;
}

function sourceCandidateKeys(candidate: NormalizedHybridCandidate): string[] {
  return [
    candidate.id,
    candidate.sourceId,
    safeString(candidate.metadata?.sourceId),
    safeString(candidate.metadata?.sourceChunkId),
    safeString(candidate.metadata?.rehydrateId),
  ].filter((value): value is string => Boolean(value));
}

function isSourceCandidate(candidate: NormalizedHybridCandidate): boolean {
  const role = safeString(candidate.metadata?.retrievalRole);
  const kind = safeString(candidate.metadata?.kind ?? candidate.kind);
  return role === "source" || kind === "contextual_source_chunk";
}

function sourceRehydrateId(candidate: NormalizedHybridCandidate): string | null {
  if (!isIndexCandidate(candidate)) return null;
  return safeString(candidate.metadata?.rehydrateId)
    ?? safeString(candidate.metadata?.sourceChunkId)
    ?? null;
}

function isIndexCandidate(candidate: NormalizedHybridCandidate): boolean {
  const role = safeString(candidate.metadata?.retrievalRole);
  const kind = safeString(candidate.metadata?.kind ?? candidate.kind);
  return role === "index" || kind === "atomic_memory" || kind === "contextual_index";
}

function rehydratedContextText(
  candidate: NormalizedHybridCandidate,
  source: NormalizedHybridCandidate,
): string {
  const atomic = candidate.text.trim();
  const sourceText = source.text.trim();
  if (!atomic) return sourceText;
  if (!sourceText) return atomic;
  return [
    "Atomic match:",
    atomic,
    "",
    "Rehydrated source chunk:",
    sourceText,
  ].join("\n");
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

const CONTEXT_METADATA_KEYS = [
  "origin",
  "kind",
  "atomicKind",
  "confidence",
  "scope",
  "sourceKind",
  "sourceId",
  "containerTag",
  "remoteSystem",
  "remoteId",
  "normalizedHash",
  "observedAt",
  "createdAt",
  "updatedAt",
  "date",
  "documentDate",
  "eventDate",
  "title",
  "topic",
  "topicPath",
  "subtopic",
  "subtopicPath",
  "retrievalRole",
  "sourceChunkId",
  "rehydrateId",
  "sourceContentHash",
  "sourceEstimatedTokens",
  "parentSessionId",
  "legacyAtomicId",
  "validFrom",
  "validUntil",
  "supersedes",
  "supersededBy",
  "contradictedBy",
  "lifecycleStatus",
  "atomicSubjectKey",
  "entities",
  "topics",
  "chunkIndex",
  "chunkCount",
  "atomicFactIndex",
  "atomicFactCount",
] as const;

function contextMetadata(candidate: NormalizedHybridCandidate): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...(candidate.metadata ?? {}),
  };
  assignDefined(merged, {
    origin: candidate.origin,
    scope: candidate.scope,
    sourceKind: candidate.sourceKind,
    sourceId: candidate.sourceId,
    containerTag: candidate.containerTag,
    remoteSystem: candidate.remoteSystem,
    remoteId: candidate.remoteId,
    normalizedHash: candidate.normalizedHash,
    observedAt: candidate.observedAt,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  });
  if (candidate.kind && merged.kind === undefined) merged.kind = candidate.kind;

  const output: Record<string, unknown> = {};
  for (const key of CONTEXT_METADATA_KEYS) {
    const value = safeMetadataValue(merged[key]);
    if (value !== undefined) output[key] = value;
  }
  return output;
}

function assignDefined(target: Record<string, unknown>, values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) target[key] = value;
  }
}

function safeMetadataValue(value: unknown): string | number | boolean | string[] | undefined {
  if (Array.isArray(value)) {
    const safeItems = value
      .map((item) => safeMetadataValue(item))
      .filter((item): item is string => typeof item === "string");
    return safeItems.length > 0 ? safeItems.slice(0, 12) : undefined;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const redacted = redactPrivate(value).text.trim();
  if (!redacted || redacted.includes("[REDACTED")) return undefined;
  if (/(?:\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\/|\/tmp\/|\/home\/|[A-Za-z]:\\Users\\)/i.test(redacted)) {
    return undefined;
  }
  return redacted.length > 180 ? `${redacted.slice(0, 177)}...` : redacted;
}

function sanitizeError(message: string): string {
  return message
    .replace(/sm_[A-Za-z0-9_-]{20,}/g, "[REDACTED_SUPERMEMORY_KEY]")
    .replace(/pa-[A-Za-z0-9_-]{20,}/g, "[REDACTED_VOYAGE_KEY]")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/nvapi-[A-Za-z0-9_-]{20,}/g, "[REDACTED_NVIDIA_KEY]")
    .replace(/jina_[A-Za-z0-9_-]{20,}/g, "[REDACTED_JINA_KEY]")
    .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}
