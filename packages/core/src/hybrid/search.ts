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
  distillation?: DistillationTrace;
}

export interface HybridSearchResult {
  candidates: NormalizedHybridCandidate[];
  context: ReturnType<typeof compileTypedContext>;
  trace: HybridSearchTrace;
}

export async function searchHybrid(input: {
  query: string;
  sources: HybridSearchSource[];
  topK?: number;
  contextBudgetTokens?: number;
  distill?: boolean;
  compactWriter?: CompactWriter;
  distillationMaxMemories?: number;
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
  const ranked = rerankLexically(redacted.text, searchableCandidates).slice(0, topK);
  const contextInput = {
    query: redacted.text,
    candidates: ranked.map((candidate) => ({
      id: candidate.id,
      text: candidate.text,
      score: candidate.score,
      metadata: {
        origin: candidate.origin,
        containerTag: candidate.containerTag,
        remoteSystem: candidate.remoteSystem,
        remoteId: candidate.remoteId,
        normalizedHash: candidate.normalizedHash,
      },
    })),
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

function sanitizeError(message: string): string {
  return message
    .replace(/sm_[A-Za-z0-9_-]{20,}/g, "[REDACTED_SUPERMEMORY_KEY]")
    .replace(/pa-[A-Za-z0-9_-]{20,}/g, "[REDACTED_VOYAGE_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}
