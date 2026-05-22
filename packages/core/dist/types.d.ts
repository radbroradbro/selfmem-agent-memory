export type MemoryScope = "user" | "project" | "team";
export type EmbedRole = "query" | "document";
export type SearchMode = "memories" | "documents" | "hybrid";
export type MemoryKind = "fact" | "preference" | "decision" | "procedure" | "bug" | "fix" | "conversation" | "source" | "profile" | "methodology";
export interface ProvenanceRef {
    sourceId: string;
    span?: {
        start: number;
        end: number;
    };
    quote?: string;
    createdAt: string;
}
export interface RetrievalTrace {
    query: string;
    channels: Array<{
        name: "dense" | "sparse" | "graph" | "temporal";
        candidateIds: string[];
        elapsedMs: number;
    }>;
    fusion: Array<{
        id: string;
        rrfScore: number;
        channelRanks: Record<string, number | null>;
    }>;
    rerank: Array<{
        id: string;
        beforeRank: number;
        afterRank: number;
        score: number;
    }>;
    amplification: Array<{
        id: string;
        winningChannel: string;
        rankDelta: number;
        helpedAnswer?: boolean;
    }>;
}
export interface EmbedRequest {
    texts: string[];
    role: EmbedRole;
    model?: string;
    dimensions?: number;
    task?: "retrieval" | "code-retrieval" | "classification" | "clustering" | "text-matching";
    metadata?: Record<string, unknown>;
}
export interface EmbedResult {
    model: string;
    dimensions: number;
    vectors: number[][];
    usage?: {
        inputTokens?: number;
        costUsd?: number;
    };
}
export interface Embedder {
    id: string;
    maxInputTokens: number;
    defaultDimensions: number;
    supportedDimensions?: number[];
    supports: {
        multimodal?: boolean;
        asymmetric?: boolean;
        matryoshka?: boolean;
    };
    embed(request: EmbedRequest): Promise<EmbedResult>;
}
export interface RerankCandidate {
    id: string;
    text: string;
    metadata?: Record<string, unknown>;
}
export interface RerankResult extends RerankCandidate {
    score: number;
    rank: number;
}
export interface Reranker {
    id: string;
    maxInputTokens: number;
    rerank(request: {
        query: string;
        candidates: RerankCandidate[];
        topK: number;
        model?: string;
        instruction?: string;
    }): Promise<{
        results: RerankResult[];
        usage?: {
            inputTokens?: number;
            costUsd?: number;
        };
    }>;
}
export interface SearchControls {
    searchMode?: SearchMode;
    limit?: number;
    threshold?: number;
    rerank?: boolean;
    rewriteQuery?: boolean;
    filters?: Record<string, unknown>;
    include?: {
        related?: boolean;
        forgotten?: boolean;
    };
}
export interface QueryExpansionRequest {
    query: string;
    instruction: string;
    maxRewrites: number;
}
export interface QueryExpander {
    id: string;
    maxInputTokens: number;
    rewrite(request: QueryExpansionRequest): Promise<{
        queries: string[];
        usage?: {
            inputTokens?: number;
            costUsd?: number;
        };
    }>;
}
export interface VectorStore {
    upsert(items: Array<{
        id: string;
        vector: number[];
        text: string;
        metadata: Record<string, unknown>;
    }>): Promise<void>;
    search(queryVector: number[], options: {
        topK: number;
        filter?: Record<string, unknown>;
    }): Promise<Array<{
        id: string;
        score: number;
        metadata: Record<string, unknown>;
    }>>;
    delete(ids: string[]): Promise<void>;
    clear(scope?: {
        containerTag?: string;
    }): Promise<void>;
}
export interface SparseStore {
    upsert(items: Array<{
        id: string;
        text: string;
        metadata: Record<string, unknown>;
    }>): Promise<void>;
    search(query: string, options: {
        topK: number;
        filter?: Record<string, unknown>;
    }): Promise<Array<{
        id: string;
        score: number;
        metadata: Record<string, unknown>;
    }>>;
}
export interface GraphStore {
    upsertNode(node: {
        id: string;
        type: string;
        label: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    upsertEdge(edge: {
        from: string;
        to: string;
        type: string;
        weight?: number;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    traverse(seedIds: string[], options: {
        edgeTypes?: string[];
        depth: number;
        topK: number;
    }): Promise<Array<{
        id: string;
        score: number;
        path: string[];
    }>>;
}
export interface MemoryContextInput {
    query: string;
    scopeTags: {
        user?: string;
        project?: string;
        team?: string;
    };
    budgetTokens: number;
    profile?: boolean;
    search?: SearchControls;
}
export interface MemorySearchInput extends SearchControls {
    query: string;
    scopeTags: string[];
    topK: number;
}
export interface MemoryEngine {
    ingest(input: {
        scope: MemoryScope;
        containerTag: string;
        sourceId: string;
        content: string;
        kind?: MemoryKind;
        metadata?: Record<string, unknown>;
    }): Promise<{
        memoryIds: string[];
        redacted: boolean;
    }>;
    context(input: MemoryContextInput): Promise<{
        text: string;
        citations: string[];
        trace: RetrievalTrace;
    }>;
    search(input: MemorySearchInput): Promise<Array<{
        id: string;
        text: string;
        score: number;
        provenance: ProvenanceRef[];
    }>>;
    forget(input: {
        id?: string;
        query?: string;
        containerTag: string;
        reason: string;
    }): Promise<{
        forgottenIds: string[];
    }>;
}
/**
 * Internal RecallWeave provider boundary. This intentionally extends MemoryEngine
 * with per-record/query forget support even though MemoryBench only exposes
 * bulk clear for benchmark isolation; see docs/memorybench-provider-contract.md.
 */
export interface MemoryProviderAdapter extends MemoryEngine {
    providerId: string;
    doctor(): Promise<{
        ok: boolean;
        checks: Array<{
            name: string;
            ok: boolean;
            detail?: string;
        }>;
    }>;
}
//# sourceMappingURL=types.d.ts.map