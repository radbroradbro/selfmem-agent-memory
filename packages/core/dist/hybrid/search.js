import { compileTypedContext } from "../context/compiler.js";
import { redactPrivate } from "../redaction/private.js";
import { dedupeHybridCandidates } from "./dedupe.js";
import { tokenizeForSimilarity } from "./normalize.js";
import { createDeterministicCompactWriter } from "./distill.js";
export async function searchHybrid(input) {
    const redacted = redactPrivate(input.query);
    if (redacted.fullyPrivate) {
        throw new Error("Cannot search hybrid memory with a fully private query.");
    }
    const topK = input.topK ?? 10;
    const sourceRuns = [];
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
        }
        catch (error) {
            sourceRuns.push({
                sourceId: source.id,
                origin: source.origin,
                status: "error",
                candidateCount: 0,
                elapsedMs: performance.now() - startedAt,
                message: sanitizeError(String(error)),
            });
            if (source.required)
                throw error;
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
            ranking: {
                mode: input.rankerMode ?? "lexical",
                candidateCount: searchableCandidates.length,
                selectedCount: ranked.length,
            },
            ...(distillation ? { distillation: distillation.trace } : {}),
        },
    };
}
export function makeStaticHybridSource(input) {
    return {
        id: input.id,
        origin: input.origin,
        async search(query, options) {
            if (input.fail)
                throw new Error(`${input.id} unavailable`);
            return rerankLexically(query, input.candidates).slice(0, options.topK);
        },
    };
}
function rerankLexically(query, candidates) {
    const queryTokens = new Set(tokenizeForSimilarity(query));
    return candidates
        .map((candidate) => ({ candidate, score: candidate.score + lexicalScore(queryTokens, candidate.text) }))
        .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
        .map(({ candidate, score }) => ({ ...candidate, score }));
}
function lexicalScore(queryTokens, text) {
    const docTokens = new Set(tokenizeForSimilarity(text));
    let score = 0;
    for (const token of queryTokens) {
        if (docTokens.has(token))
            score += 1;
    }
    return score;
}
function sanitizeError(message) {
    return message
        .replace(/sm_[A-Za-z0-9_-]{20,}/g, "[REDACTED_SUPERMEMORY_KEY]")
        .replace(/pa-[A-Za-z0-9_-]{20,}/g, "[REDACTED_VOYAGE_KEY]")
        .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED_GOOGLE_KEY]")
        .replace(/nvapi-[A-Za-z0-9_-]{20,}/g, "[REDACTED_NVIDIA_KEY]")
        .replace(/jina_[A-Za-z0-9_-]{20,}/g, "[REDACTED_JINA_KEY]")
        .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}
//# sourceMappingURL=search.js.map