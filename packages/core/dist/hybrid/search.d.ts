import { compileTypedContext } from "../context/compiler.js";
import type { HybridCandidate, NormalizedHybridCandidate } from "./normalize.js";
import { type DedupeResult } from "./dedupe.js";
import { type CompactWriter, type DistillationTrace } from "./distill.js";
export interface HybridSearchSource {
    id: string;
    origin: HybridCandidate["origin"];
    required?: boolean;
    search(query: string, options: {
        topK: number;
    }): Promise<HybridCandidate[]>;
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
export type HybridRanker = (query: string, candidates: NormalizedHybridCandidate[], options: {
    topK: number;
}) => Promise<NormalizedHybridCandidate[]> | NormalizedHybridCandidate[];
export declare function searchHybrid(input: {
    query: string;
    sources: HybridSearchSource[];
    topK?: number;
    contextBudgetTokens?: number;
    distill?: boolean;
    compactWriter?: CompactWriter;
    distillationMaxMemories?: number;
    ranker?: HybridRanker;
    rankerMode?: string;
}): Promise<HybridSearchResult>;
export declare function makeStaticHybridSource(input: {
    id: string;
    origin: HybridCandidate["origin"];
    candidates: HybridCandidate[];
    fail?: boolean;
}): HybridSearchSource;
//# sourceMappingURL=search.d.ts.map