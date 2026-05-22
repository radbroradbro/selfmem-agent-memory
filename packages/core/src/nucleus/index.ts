import { redactPrivate } from "../redaction/private.js";
import type { MemoryScope, ProvenanceRef, RetrievalTrace } from "../types.js";

export type NucleusNodeKind =
  | "memory"
  | "source"
  | "wiki_page"
  | "derived_doc"
  | "session_summary"
  | "entity"
  | "project"
  | "decision"
  | "contradiction"
  | "research_query"
  | "source_claim"
  | "hypothesis"
  | "lifecycle_event"
  | "retrieval_trace";

export type NucleusEdgeKind =
  | "derived_from"
  | "cites"
  | "mentions"
  | "decides"
  | "contradicts"
  | "supports"
  | "challenges"
  | "answers"
  | "tests"
  | "informs"
  | "supersedes"
  | "related_to"
  | "captured_by"
  | "injected_into"
  | "syncs_to"
  | "edited_by";

export type NativeRuntime = "hermes" | "openclaw" | "codex" | "claude_code" | "opencode" | "mcp";

export type SleepCyclePhase =
  | "signal"
  | "pre_compress"
  | "distill"
  | "dedupe"
  | "relink"
  | "contradiction_repair"
  | "salience_score"
  | "wiki_sync"
  | "eval_replay"
  | "compact"
  | "archive";

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
  requiredFlow: Array<
    | "launch"
    | "search"
    | "open_node"
    | "edit_derived_doc"
    | "view_provenance"
    | "view_retrieval_trace"
    | "view_lifecycle"
    | "save_or_cancel"
  >;
  allowedArtifacts: Array<"screenshot" | "screen_recording" | "accessibility_snapshot" | "console_log">;
  forbiddenContent: Array<"raw_memory" | "raw_transcript" | "credential" | "private_path" | "private_agent_log">;
}

export const DEFAULT_BRAIN_UI_EVIDENCE_SPEC: BrainUiEvidenceSpec = {
  fixtureOnly: true,
  requiredFlow: [
    "launch",
    "search",
    "open_node",
    "edit_derived_doc",
    "view_provenance",
    "view_retrieval_trace",
    "view_lifecycle",
    "save_or_cancel",
  ],
  allowedArtifacts: ["screenshot", "screen_recording", "accessibility_snapshot", "console_log"],
  forbiddenContent: ["raw_memory", "raw_transcript", "credential", "private_path", "private_agent_log"],
};

export function createNucleusRetrievalTraceNode(input: {
  id: string;
  trace: RetrievalTrace;
  createdAt: string;
  containerTag?: string;
}): NucleusNode {
  const channelNames = input.trace.channels.map((channel) => channel.name).join(", ");
  const node: NucleusNode = {
    id: input.id,
    kind: "retrieval_trace",
    title: `Retrieval trace: ${input.trace.query}`,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    tags: ["retrieval", "trace", "hybrid-search"],
    metadata: {
      query: input.trace.query,
      channels: channelNames,
      candidateCount: new Set(input.trace.channels.flatMap((channel) => channel.candidateIds)).size,
      rerankCount: input.trace.rerank.length,
    },
  };

  if (input.containerTag) node.containerTag = input.containerTag;

  return sanitizeNucleusNode(node);
}

export function createResearchLineageNodes(record: ResearchLineageRecord): {
  queryNode: NucleusNode;
  hypothesisNode: NucleusNode;
  decisionNode?: NucleusNode;
  edges: NucleusEdge[];
} {
  const createdAt = record.createdAt;
  const queryNode = sanitizeNucleusNode({
    id: `${record.id}:query`,
    kind: "research_query",
    title: record.query,
    createdAt,
    updatedAt: record.updatedAt,
    tags: ["research", record.status],
    provenance: record.sourceRefs,
    metadata: {
      status: record.status,
      pros: record.pros,
      cons: record.cons,
      nextQuestions: record.nextQuestions,
      ...record.metadata,
    },
  });
  const hypothesisNode = sanitizeNucleusNode({
    id: `${record.id}:hypothesis`,
    kind: "hypothesis",
    title: record.hypothesis,
    createdAt,
    updatedAt: record.updatedAt,
    tags: ["research", "hypothesis", record.status],
    provenance: record.sourceRefs,
  });
  const decisionNode = record.decision
    ? sanitizeNucleusNode({
        id: `${record.id}:decision`,
        kind: "decision",
        title: record.decision,
        createdAt,
        updatedAt: record.updatedAt,
        tags: ["research", "decision", record.status],
        provenance: record.sourceRefs,
      })
    : undefined;

  const edges: NucleusEdge[] = [
    sanitizeNucleusEdge({
      id: `${record.id}:query-answers-hypothesis`,
      from: queryNode.id,
      to: hypothesisNode.id,
      kind: "answers",
      createdAt,
    }),
  ];

  if (decisionNode) {
    edges.push(
      sanitizeNucleusEdge({
        id: `${record.id}:hypothesis-informs-decision`,
        from: hypothesisNode.id,
        to: decisionNode.id,
        kind: "informs",
        createdAt,
      }),
    );
  }

  return decisionNode
    ? { queryNode, hypothesisNode, decisionNode, edges }
    : { queryNode, hypothesisNode, edges };
}

export function sanitizeNucleusSnapshot(snapshot: NucleusIndexSnapshot): NucleusIndexSnapshot {
  return {
    ...snapshot,
    roots: sanitizeUnknown(snapshot.roots) as NucleusIndexSnapshot["roots"],
    nodes: snapshot.nodes.map(sanitizeNucleusNode),
    edges: snapshot.edges.map(sanitizeNucleusEdge),
  };
}

export function sanitizeNucleusNode(node: NucleusNode): NucleusNode {
  const sanitized: NucleusNode = {
    ...node,
    title: redactText(node.title),
  };

  if (node.containerTag) sanitized.containerTag = redactText(node.containerTag);
  if (node.tags) sanitized.tags = node.tags.map(redactText);
  if (node.aliases) sanitized.aliases = node.aliases.map(redactText);
  if (node.provenance) sanitized.provenance = node.provenance.map(sanitizeProvenance);
  if (node.metadata) sanitized.metadata = sanitizeUnknown(node.metadata) as Record<string, unknown>;

  return sanitized;
}

export function sanitizeNucleusEdge(edge: NucleusEdge): NucleusEdge {
  const sanitized: NucleusEdge = {
    ...edge,
  };

  if (edge.metadata) sanitized.metadata = sanitizeUnknown(edge.metadata) as Record<string, unknown>;

  return sanitized;
}

function sanitizeProvenance(provenance: ProvenanceRef): ProvenanceRef {
  const sanitized: ProvenanceRef = {
    ...provenance,
    sourceId: redactText(provenance.sourceId),
  };

  if (provenance.quote) sanitized.quote = redactText(provenance.quote);

  return sanitized;
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(sanitizeUnknown);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [redactText(key), sanitizeUnknown(nested)]),
  );
}

function redactText(text: string): string {
  return redactPrivate(text).text;
}
