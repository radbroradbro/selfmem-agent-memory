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
export type SessionLifecyclePhase = "session_start" | "pre_compact" | "candidate_distilled" | "topic_linked" | "session_map_ready" | "session_end";
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
export interface SessionTopicLink {
    id: string;
    topicPath: string[];
    candidateIds: string[];
    sourceEventIds: string[];
    firstObservedAt: string;
    lastObservedAt: string;
    salience: number;
    reasons: string[];
}
export interface SessionLifecycleEvent {
    id: string;
    phase: SessionLifecyclePhase;
    observedAt: string;
    sourceEventIds: string[];
    candidateIds: string[];
    topicIds: string[];
    counters: Record<string, number>;
    warnings: string[];
}
export interface SessionMapTelemetry {
    counters: {
        inputEvents: number;
        statementsInspected: number;
        durableStatements: number;
        duplicateCandidateMerges: number;
        redactionCount: number;
        skippedFullyPrivate: number;
        skippedNoise: number;
        outputCandidates: number;
        topicLinks: number;
        linkedCandidates: number;
        unlinkedCandidates: number;
        staleCandidates: number;
    };
    wasteSignals: string[];
    warnings: string[];
}
export interface SessionMap {
    id: string;
    sessionId: string;
    source: SessionSource;
    startedAt: string;
    endedAt?: string;
    candidateIds: string[];
    topicLinks: SessionTopicLink[];
    lifecycleEvents: SessionLifecycleEvent[];
    telemetry: SessionMapTelemetry;
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
    sessionMap: SessionMap;
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