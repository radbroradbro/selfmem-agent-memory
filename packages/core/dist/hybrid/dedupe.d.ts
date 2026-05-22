import type { HybridCandidate, NormalizedHybridCandidate } from "./normalize.js";
export interface DedupeGroup {
    primaryId: string;
    duplicateIds: string[];
    reason: "normalized-hash" | "remote-id" | "source-id";
    normalizedHash: string;
    origins: string[];
}
export interface DedupeReviewCandidate {
    ids: [string, string];
    reason: "near-text" | "semantic-review";
    similarity: number;
}
export interface DedupeResult {
    candidates: NormalizedHybridCandidate[];
    groups: DedupeGroup[];
    reviewCandidates: DedupeReviewCandidate[];
    skippedUnsafe: number;
}
export declare function dedupeHybridCandidates(candidates: HybridCandidate[]): DedupeResult;
//# sourceMappingURL=dedupe.d.ts.map