import type { MemoryKind, MemoryScope } from "../types.js";
export type HybridOrigin = "local" | "supermemory-live" | "supermemory-export";
export type RemoteSystem = "supermemory";
export type SourceKind = "derived" | "manual" | "remote-import" | "raw_transcript" | "benchmark" | "private" | "unknown";
export interface HybridProvenance {
    origin: HybridOrigin;
    sourceId: string;
    observedAt: string;
    remoteSystem?: RemoteSystem;
    remoteId?: string;
    containerTag?: string;
}
export interface HybridCandidate {
    id: string;
    text: string;
    origin: HybridOrigin;
    score: number;
    kind?: MemoryKind;
    scope?: MemoryScope;
    containerTag?: string;
    remoteSystem?: RemoteSystem;
    remoteId?: string;
    sourceKind?: SourceKind;
    sourceId?: string;
    confidence?: number;
    syncEligible?: boolean;
    safeForRemote?: boolean;
    observedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    normalizedHash?: string;
    provenance?: HybridProvenance[];
    metadata?: Record<string, unknown>;
}
export interface NormalizedHybridCandidate extends HybridCandidate {
    normalizedHash: string;
    safeForRemote: boolean;
    redactionCount: number;
}
export declare function normalizeMemoryText(input: string): string;
export declare function normalizedHash(input: string): string;
export declare function normalizeHybridCandidate(candidate: HybridCandidate): NormalizedHybridCandidate | null;
export declare function tokenizeForSimilarity(input: string): string[];
export declare function jaccardSimilarity(a: string, b: string): number;
//# sourceMappingURL=normalize.d.ts.map