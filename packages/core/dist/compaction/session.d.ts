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
}
export interface SessionCompactionStaleRule {
    id: string;
    pattern: RegExp;
    detailPattern?: RegExp;
    replacementText?: string;
    saliencePenalty?: number;
}
export declare function compactSession(input: SessionCompactionInput): SessionCompactionResult;
//# sourceMappingURL=session.d.ts.map