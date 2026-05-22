import type { HybridCandidate } from "./normalize.js";
export type SyncDecisionStatus = "queued" | "skipped-duplicate" | "skipped-tombstoned" | "skipped-unsafe" | "skipped-budget" | "blocked-health";
export interface SyncHealth {
    readHealthy: boolean;
    writeHealthy: boolean;
    message?: string;
}
export interface SyncDecision {
    localId: string;
    status: SyncDecisionStatus;
    reason: string;
    idempotencyKey?: string;
    containerTag?: string;
}
export interface SyncPlan {
    dryRun: boolean;
    decisions: SyncDecision[];
    writeCount: number;
    blocked: boolean;
}
export declare function planSupermemorySync(input: {
    localMemories: HybridCandidate[];
    remoteCandidates?: HybridCandidate[];
    health: SyncHealth;
    allowedContainerTags: string[];
    dailyWriteBudget?: number;
    dryRun?: boolean;
}): SyncPlan;
//# sourceMappingURL=sync.d.ts.map