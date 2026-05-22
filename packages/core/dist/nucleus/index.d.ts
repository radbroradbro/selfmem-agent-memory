import type { MemoryScope, ProvenanceRef, RetrievalTrace } from "../types.js";
export type NucleusNodeKind = "memory" | "source" | "wiki_page" | "derived_doc" | "session_summary" | "entity" | "project" | "decision" | "contradiction" | "research_query" | "source_claim" | "hypothesis" | "lifecycle_event" | "retrieval_trace";
export type NucleusEdgeKind = "derived_from" | "cites" | "mentions" | "decides" | "contradicts" | "supports" | "challenges" | "answers" | "tests" | "informs" | "supersedes" | "related_to" | "captured_by" | "injected_into" | "syncs_to" | "edited_by";
export type NativeRuntime = "hermes" | "openclaw" | "codex" | "claude_code" | "opencode" | "mcp";
export type SleepCyclePhase = "signal" | "pre_compress" | "distill" | "dedupe" | "relink" | "contradiction_repair" | "salience_score" | "wiki_sync" | "eval_replay" | "compact" | "archive";
export interface NucleusNode {
    id: string;
    kind: NucleusNodeKind;
    title: string;
    createdAt: string;
    updatedAt: string;
    scope?: MemoryScope;
    containerTag?: string;
    tags?: string[];
    aliases?: string[];
    confidence?: number;
    editable?: boolean;
    stale?: boolean;
    provenance?: ProvenanceRef[];
    metadata?: Record<string, unknown>;
}
export interface NucleusEdge {
    id: string;
    from: string;
    to: string;
    kind: NucleusEdgeKind;
    createdAt: string;
    weight?: number;
    metadata?: Record<string, unknown>;
}
export interface NucleusIndexSnapshot {
    schemaVersion: 1;
    generatedAt: string;
    roots: {
        indexPageId?: string;
        methodologyPageId?: string;
        activeSessionId?: string;
    };
    nodes: NucleusNode[];
    edges: NucleusEdge[];
}
export interface NativeMemoryOptimizationPlan {
    runtime: NativeRuntime;
    lifecycleHooks: Array<{
        name: string;
        phase: SleepCyclePhase;
        required: boolean;
        purpose: string;
    }>;
    recallPolicy: {
        everyTurn: boolean;
        skipMaintenanceTraffic: boolean;
        maxContextTokens: number;
        hybridSearch: boolean;
        includeRetrievalTrace: boolean;
    };
    writePolicy: {
        localOnly: boolean;
        preservePreCompressionEvidence: boolean;
        distillBeforePromptRecall: boolean;
        rejectFullyPrivate: boolean;
        rejectStatusOnly: boolean;
    };
    sleepCycle: {
        enabled: boolean;
        phases: SleepCyclePhase[];
        maxSpendUsd?: number;
    };
}
export interface WikiSyncPage {
    id: string;
    path: string;
    title: string;
    frontmatter: {
        type: string;
        category: string;
        tags: string[];
        aliases: string[];
        sources: string[];
        confidence: number;
        version: number;
        reviewed: boolean;
    };
    body: string;
    provenance: ProvenanceRef[];
    reviewedManualEdit?: boolean;
}
export interface ResearchLineageRecord {
    id: string;
    query: string;
    createdAt: string;
    updatedAt: string;
    status: "open" | "testing" | "accepted" | "rejected" | "superseded";
    hypothesis: string;
    pros: string[];
    cons: string[];
    sourceRefs: ProvenanceRef[];
    decision?: string;
    nextQuestions?: string[];
    metadata?: Record<string, unknown>;
}
export interface BrainUiEvidenceSpec {
    fixtureOnly: true;
    requiredFlow: Array<"launch" | "search" | "open_node" | "edit_derived_doc" | "view_provenance" | "view_retrieval_trace" | "view_lifecycle" | "save_or_cancel">;
    allowedArtifacts: Array<"screenshot" | "screen_recording" | "accessibility_snapshot" | "console_log">;
    forbiddenContent: Array<"raw_memory" | "raw_transcript" | "credential" | "private_path" | "private_agent_log">;
}
export declare const DEFAULT_BRAIN_UI_EVIDENCE_SPEC: BrainUiEvidenceSpec;
export declare function createNucleusRetrievalTraceNode(input: {
    id: string;
    trace: RetrievalTrace;
    createdAt: string;
    containerTag?: string;
}): NucleusNode;
export declare function createResearchLineageNodes(record: ResearchLineageRecord): {
    queryNode: NucleusNode;
    hypothesisNode: NucleusNode;
    decisionNode?: NucleusNode;
    edges: NucleusEdge[];
};
export declare function sanitizeNucleusSnapshot(snapshot: NucleusIndexSnapshot): NucleusIndexSnapshot;
export declare function sanitizeNucleusNode(node: NucleusNode, nodeIdMap?: Map<string, string>): NucleusNode;
export declare function sanitizeNucleusEdge(edge: NucleusEdge, nodeIdMap?: Map<string, string>): NucleusEdge;
//# sourceMappingURL=index.d.ts.map