export type ContextIntent = "preference" | "current-state" | "temporal" | "event-count" | "general";
export interface ContextCandidate {
    id: string;
    text: string;
    score?: number;
    metadata?: Record<string, unknown>;
}
export interface ContextFact {
    kind: ContextIntent;
    text: string;
    sourceId: string;
    confidence: "high" | "medium" | "low";
    atomicKind?: string;
    lifecycleStatus?: "current" | "superseded" | "tombstone" | "historical";
    supersedes?: string[];
    supersededBy?: string;
    validFrom?: string;
    validUntil?: string;
}
export interface CompiledContext {
    intent: ContextIntent;
    text: string;
    citations: string[];
    facts: ContextFact[];
    evidence: Array<{
        id: string;
        quote: string;
        score?: number;
        metadata?: Record<string, unknown>;
    }>;
    tokenEstimate: number;
}
export declare function compileTypedContext(input: {
    query: string;
    candidates: ContextCandidate[];
    budgetTokens?: number;
    maxEvidenceItems?: number;
}): CompiledContext;
export declare function classifyContextIntent(query: string): ContextIntent;
//# sourceMappingURL=compiler.d.ts.map