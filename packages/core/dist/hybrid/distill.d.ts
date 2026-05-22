import type { MemoryScope } from "../types.js";
import type { HybridCandidate, NormalizedHybridCandidate } from "./normalize.js";
export type CompactWriterProvider = "deterministic" | "openai-compatible";
export interface DistilledMemory extends NormalizedHybridCandidate {
    sourceKind: "derived";
    metadata: Record<string, unknown> & {
        distilled: true;
        distilledAt: string;
        distilledBy: string;
        sourceCandidateIds: string[];
    };
}
export interface DistillationTrace {
    provider: CompactWriterProvider;
    inputCandidates: number;
    outputMemories: number;
    skippedFullyPrivate: number;
    redactionCount: number;
    elapsedMs: number;
    warnings: string[];
}
export interface DistillationResult {
    memories: DistilledMemory[];
    trace: DistillationTrace;
}
export interface CompactWriterInput {
    query?: string;
    candidates: HybridCandidate[];
    maxMemories?: number;
    maxMemoriesPerCandidate?: number;
    scope?: MemoryScope;
    containerTag?: string;
    now?: string;
}
export interface CompactWriter {
    id: string;
    provider: CompactWriterProvider;
    distill(input: CompactWriterInput): Promise<DistillationResult>;
}
export declare function createDeterministicCompactWriter(): CompactWriter;
export declare function distillDeterministically(input: CompactWriterInput): DistillationResult;
export declare function createOpenAICompatibleCompactWriter(options: {
    id?: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs?: number;
    maxInputCharsPerCandidate?: number;
}): CompactWriter;
//# sourceMappingURL=distill.d.ts.map