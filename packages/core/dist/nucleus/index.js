import { createHash } from "node:crypto";
import { redactPrivate } from "../redaction/private.js";
export const DEFAULT_BRAIN_UI_EVIDENCE_SPEC = {
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
export function createNucleusRetrievalTraceNode(input) {
    const channelNames = input.trace.channels.map((channel) => channel.name).join(", ");
    const node = {
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
    if (input.containerTag)
        node.containerTag = input.containerTag;
    return sanitizeNucleusNode(node);
}
export function createResearchLineageNodes(record) {
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
    const edges = [
        sanitizeNucleusEdge({
            id: `${record.id}:query-answers-hypothesis`,
            from: queryNode.id,
            to: hypothesisNode.id,
            kind: "answers",
            createdAt,
        }),
    ];
    if (decisionNode) {
        edges.push(sanitizeNucleusEdge({
            id: `${record.id}:hypothesis-informs-decision`,
            from: hypothesisNode.id,
            to: decisionNode.id,
            kind: "informs",
            createdAt,
        }));
    }
    return decisionNode
        ? { queryNode, hypothesisNode, decisionNode, edges }
        : { queryNode, hypothesisNode, edges };
}
export function createNucleusSessionMapNodes(input) {
    const createdAt = input.createdAt ?? input.sessionMap.startedAt;
    const sessionNodeInput = {
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
    if (input.containerTag)
        sessionNodeInput.containerTag = input.containerTag;
    const sessionNode = sanitizeNucleusNode(sessionNodeInput);
    const topicNodes = input.sessionMap.topicLinks.map((link) => {
        const node = {
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
        if (input.containerTag)
            node.containerTag = input.containerTag;
        return sanitizeNucleusNode(node);
    });
    const lifecycleNodes = input.sessionMap.lifecycleEvents.map((event) => {
        const node = {
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
        if (input.containerTag)
            node.containerTag = input.containerTag;
        return sanitizeNucleusNode(node);
    });
    const edges = [
        ...input.sessionMap.topicLinks.map((link) => sanitizeNucleusEdge({
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
        })),
        ...input.sessionMap.lifecycleEvents.map((event) => sanitizeNucleusEdge({
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
        })),
    ];
    return { sessionNode, topicNodes, lifecycleNodes, edges };
}
export function sanitizeNucleusSnapshot(snapshot) {
    const nodeIdMap = new Map(snapshot.nodes.map((node) => [node.id, publicId("node", node.id)]));
    return {
        ...snapshot,
        generatedAt: redactText(snapshot.generatedAt),
        roots: sanitizeRoots(snapshot.roots, nodeIdMap),
        nodes: snapshot.nodes.map((node) => sanitizeNucleusNode(node, nodeIdMap)),
        edges: snapshot.edges.map((edge) => sanitizeNucleusEdge(edge, nodeIdMap)),
    };
}
export function sanitizeNucleusNode(node, nodeIdMap) {
    const sanitized = {
        ...node,
        id: nodeIdMap?.get(node.id) ?? publicId("node", node.id),
        title: redactText(node.title),
        createdAt: redactText(node.createdAt),
        updatedAt: redactText(node.updatedAt),
    };
    if (node.containerTag)
        sanitized.containerTag = publicId("container", node.containerTag);
    if (node.tags)
        sanitized.tags = node.tags.map(redactText);
    if (node.aliases)
        sanitized.aliases = node.aliases.map(redactText);
    if (node.provenance)
        sanitized.provenance = node.provenance.map(sanitizeProvenance);
    if (node.metadata)
        sanitized.metadata = sanitizeUnknown(node.metadata);
    return sanitized;
}
export function sanitizeNucleusEdge(edge, nodeIdMap) {
    const sanitized = {
        ...edge,
        id: publicId("edge", edge.id),
        from: nodeIdMapValue(edge.from),
        to: nodeIdMapValue(edge.to),
        createdAt: redactText(edge.createdAt),
    };
    if (edge.metadata)
        sanitized.metadata = sanitizeUnknown(edge.metadata);
    return sanitized;
    function nodeIdMapValue(id) {
        return publicId("node", nodeIdMap?.get(id) ?? id);
    }
}
function sanitizeRoots(roots, nodeIdMap) {
    const sanitized = {};
    if (roots.indexPageId)
        sanitized.indexPageId = nodeIdMap.get(roots.indexPageId) ?? publicId("node", roots.indexPageId);
    if (roots.methodologyPageId)
        sanitized.methodologyPageId = nodeIdMap.get(roots.methodologyPageId) ?? publicId("node", roots.methodologyPageId);
    if (roots.activeSessionId)
        sanitized.activeSessionId = publicId("session", roots.activeSessionId);
    return sanitized;
}
function sanitizeProvenance(provenance) {
    const sanitized = {
        ...provenance,
        sourceId: publicId("source", provenance.sourceId),
    };
    if (provenance.quote)
        sanitized.quote = redactText(provenance.quote);
    return sanitized;
}
function sanitizeUnknown(value) {
    if (typeof value === "string")
        return redactText(value);
    if (Array.isArray(value))
        return value.map(sanitizeUnknown);
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [redactText(key), sanitizeUnknown(nested)]));
}
function redactText(text) {
    return redactPrivate(text).text;
}
function publicId(prefix, value) {
    if (new RegExp(`^${prefix}:[a-f0-9]{16}$`).test(value))
        return value;
    return `${prefix}:${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}
//# sourceMappingURL=index.js.map