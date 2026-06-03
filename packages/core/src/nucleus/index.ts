import { createHash } from "node:crypto";
import { redactPrivate } from "../redaction/private.js";
import type { SessionMap } from "../compaction/session.js";
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

export interface NucleusSessionMapNodes {
  sessionNode: NucleusNode;
  topicNodes: NucleusNode[];
  lifecycleNodes: NucleusNode[];
  edges: NucleusEdge[];
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

export function createNucleusSessionMapNodes(input: {
  sessionMap: SessionMap;
  createdAt?: string;
  containerTag?: string;
}): NucleusSessionMapNodes {
  const createdAt = input.createdAt ?? input.sessionMap.startedAt;
  const sessionNodeInput: NucleusNode = {
    id: input.sessionMap.id,
    kind: "session_summary",
    title: `Session map: ${input.sessionMap.source}`,
    createdAt,
    updatedAt: input.sessionMap.endedAt ?? createdAt,
    tags: ["session-map", input.sessionMap.source],
    metadata: {
      candidateCount: input.sessionMap.candidateIds.length,
      topicLinkCount: input.sessionMap.topicLinks.length,
      lifecycleEventCount: input.sessionMap.lifecycleEvents.length,
      wasteSignals: input.sessionMap.telemetry.wasteSignals,
      warnings: input.sessionMap.telemetry.warnings,
    },
  };
  if (input.containerTag) sessionNodeInput.containerTag = input.containerTag;
  const sessionNode = sanitizeNucleusNode(sessionNodeInput);

  const topicNodes = input.sessionMap.topicLinks.map((link) => {
    const node: NucleusNode = {
      id: link.id,
      kind: "wiki_page",
      title: link.topicPath.join(" / "),
      createdAt: link.firstObservedAt,
      updatedAt: link.lastObservedAt,
      tags: ["session-topic", ...link.topicPath.map((part) => part.toLowerCase().replace(/\s+/g, "-"))],
      confidence: link.salience,
      metadata: {
        topicPath: link.topicPath,
        candidateCount: link.candidateIds.length,
        sourceEventCount: link.sourceEventIds.length,
        reasons: link.reasons,
      },
    };
    if (input.containerTag) node.containerTag = input.containerTag;
    return sanitizeNucleusNode(node);
  });

  const lifecycleNodes = input.sessionMap.lifecycleEvents.map((event) => {
    const node: NucleusNode = {
      id: event.id,
      kind: "lifecycle_event",
      title: `Lifecycle: ${event.phase}`,
      createdAt: event.observedAt,
      updatedAt: event.observedAt,
      tags: ["lifecycle", event.phase],
      metadata: {
        phase: event.phase,
        sourceEventCount: event.sourceEventIds.length,
        candidateCount: event.candidateIds.length,
        topicCount: event.topicIds.length,
        counters: event.counters,
        warnings: event.warnings,
      },
    };
    if (input.containerTag) node.containerTag = input.containerTag;
    return sanitizeNucleusNode(node);
  });

  const edges: NucleusEdge[] = [
    ...input.sessionMap.topicLinks.map((link) =>
      sanitizeNucleusEdge({
        id: `${input.sessionMap.id}:syncs-to:${link.id}`,
        from: sessionNode.id,
        to: publicId("node", link.id),
        kind: "syncs_to",
        createdAt: link.lastObservedAt,
        weight: link.salience,
        metadata: {
          candidateCount: link.candidateIds.length,
          sourceEventCount: link.sourceEventIds.length,
          reasons: link.reasons,
        },
      }),
    ),
    ...input.sessionMap.lifecycleEvents.map((event) =>
      sanitizeNucleusEdge({
        id: `${event.id}:captures:${input.sessionMap.id}`,
        from: publicId("node", event.id),
        to: sessionNode.id,
        kind: "captured_by",
        createdAt: event.observedAt,
        metadata: {
          phase: event.phase,
          candidateCount: event.candidateIds.length,
          topicCount: event.topicIds.length,
        },
      }),
    ),
  ];

  return { sessionNode, topicNodes, lifecycleNodes, edges };
}

export function sanitizeNucleusSnapshot(snapshot: NucleusIndexSnapshot): NucleusIndexSnapshot {
  const nodeIdMap = new Map(snapshot.nodes.map((node) => [node.id, publicId("node", node.id)]));
  return {
    ...snapshot,
    generatedAt: redactText(snapshot.generatedAt),
    roots: sanitizeRoots(snapshot.roots, nodeIdMap),
    nodes: snapshot.nodes.map((node) => sanitizeNucleusNode(node, nodeIdMap)),
    edges: snapshot.edges.map((edge) => sanitizeNucleusEdge(edge, nodeIdMap)),
  };
}

export function sanitizeNucleusNode(node: NucleusNode, nodeIdMap?: Map<string, string>): NucleusNode {
  const sanitized: NucleusNode = {
    ...node,
    id: nodeIdMap?.get(node.id) ?? publicId("node", node.id),
    title: redactText(node.title),
    createdAt: redactText(node.createdAt),
    updatedAt: redactText(node.updatedAt),
  };

  if (node.containerTag) sanitized.containerTag = publicId("container", node.containerTag);
  if (node.tags) sanitized.tags = node.tags.map(redactText);
  if (node.aliases) sanitized.aliases = node.aliases.map(redactText);
  if (node.provenance) sanitized.provenance = node.provenance.map(sanitizeProvenance);
  if (node.metadata) sanitized.metadata = sanitizeUnknown(node.metadata) as Record<string, unknown>;

  return sanitized;
}

export function sanitizeNucleusEdge(edge: NucleusEdge, nodeIdMap?: Map<string, string>): NucleusEdge {
  const sanitized: NucleusEdge = {
    ...edge,
    id: publicId("edge", edge.id),
    from: nodeIdMapValue(edge.from),
    to: nodeIdMapValue(edge.to),
    createdAt: redactText(edge.createdAt),
  };

  if (edge.metadata) sanitized.metadata = sanitizeUnknown(edge.metadata) as Record<string, unknown>;

  return sanitized;

  function nodeIdMapValue(id: string): string {
    return publicId("node", nodeIdMap?.get(id) ?? id);
  }
}

function sanitizeRoots(
  roots: NucleusIndexSnapshot["roots"],
  nodeIdMap: Map<string, string>,
): NucleusIndexSnapshot["roots"] {
  const sanitized: NucleusIndexSnapshot["roots"] = {};
  if (roots.indexPageId) sanitized.indexPageId = nodeIdMap.get(roots.indexPageId) ?? publicId("node", roots.indexPageId);
  if (roots.methodologyPageId) sanitized.methodologyPageId = nodeIdMap.get(roots.methodologyPageId) ?? publicId("node", roots.methodologyPageId);
  if (roots.activeSessionId) sanitized.activeSessionId = publicId("session", roots.activeSessionId);
  return sanitized;
}

function sanitizeProvenance(provenance: ProvenanceRef): ProvenanceRef {
  const sanitized: ProvenanceRef = {
    ...provenance,
    sourceId: publicId("source", provenance.sourceId),
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

function publicId(prefix: string, value: string): string {
  if (new RegExp(`^${prefix}:[a-f0-9]{16}$`).test(value)) return value;
  return `${prefix}:${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}
