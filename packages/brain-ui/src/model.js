const privateLikePattern =
  /<private>[\s\S]*?(?:<\/private>|$)|pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9._-]{20,}/gi;

function filteredNodes(snapshot, filter, query) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return snapshot.nodes.filter((node) => {
    const matchesKind = filter === "all" || node.kind === filter;
    const haystack = JSON.stringify(node).toLowerCase();
    const matchesQuery = tokens.length === 0 || tokens.every((token) => haystack.includes(token));
    return matchesKind && matchesQuery;
  });
}

function buildNucleusExport(snapshot) {
  const kindCounts = snapshot.nodes.reduce((counts, node) => {
    const kind = safeExportText(node.kind);
    counts[kind] = (counts[kind] ?? 0) + 1;
    return counts;
  }, {});
  return {
    schemaVersion: snapshot.schemaVersion,
    mode: "fixture-nucleus-snapshot",
    writesRealFiles: false,
    counts: {
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      editable: snapshot.nodes.filter((node) => node.editable).length,
      kinds: kindCounts,
    },
    nodes: snapshot.nodes.map((node) => ({
      id: safeExportText(node.id),
      kind: safeExportText(node.kind),
      title: safeExportText(node.title),
      editable: Boolean(node.editable),
      tags: (node.tags ?? []).map(safeExportText),
    })),
    edges: snapshot.edges.map((edge) => ({
      id: safeExportText(edge.id),
      kind: safeExportText(edge.kind),
      from: safeExportText(edge.from),
      to: safeExportText(edge.to),
    })),
  };
}

function buildResearchLineage(snapshot) {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const queryNodes = snapshot.nodes.filter((node) => node.kind === "research_query");
  return {
    schemaVersion: snapshot.schemaVersion,
    mode: "fixture-research-lineage",
    writesRealFiles: false,
    trails: queryNodes.map((query) => ({
      query: nodeSummary(query),
      steps: collectLineageSteps(snapshot, query.id, nodesById),
    })),
  };
}

function buildContainerHealth(snapshot) {
  const fixtureContainer = snapshot.roots?.container ?? {};
  const memoryKinds = ["memory", "derived_doc", "retrieval_trace", "lifecycle_event", "research_query", "decision", "hypothesis"];
  const countsByKind = Object.fromEntries(memoryKinds.map((kind) => [kind, snapshot.nodes.filter((node) => node.kind === kind).length]));
  const newestWrites = [...snapshot.nodes]
    .sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt)))
    .slice(0, 4)
    .map(nodeSummary);
  const duplicateClusters = duplicateTitleClusters(snapshot.nodes);
  const lifecycleEvents = snapshot.nodes.filter((node) => node.kind === "lifecycle_event");
  const retrievalTraces = snapshot.nodes.filter((node) => node.kind === "retrieval_trace");
  const privacyLeakCount = numeric(fixtureContainer.privacyLeakCount) + sumMetadataNumber(snapshot.nodes, "privacyLeakCount");
  const redactionCount = numeric(fixtureContainer.redactionCount) + sumMetadataNumber(snapshot.nodes, "redactionCount");
  return {
    schemaVersion: snapshot.schemaVersion,
    mode: "fixture-container-health",
    writesRealFiles: false,
    agentLabel: safeExportText(fixtureContainer.agentLabel ?? "fixture-agent"),
    localContainer: safeExportText(fixtureContainer.localContainer ?? "recallweave_fixture_local"),
    sourceSupermemoryContainer: safeExportText(fixtureContainer.sourceSupermemoryContainer ?? "fixture_supermemory_readonly"),
    providerMode: safeExportText(fixtureContainer.providerMode ?? "fixture-voyage-rerank-read-through"),
    writeMode: safeExportText(fixtureContainer.writeMode ?? "local-only"),
    lastAuditAt: safeExportText(fixtureContainer.lastAuditAt ?? snapshot.generatedAt ?? ""),
    countsByKind,
    newestWrites,
    duplicateClusters,
    health: {
      lifecycleEvents: lifecycleEvents.length,
      retrievalTraces: retrievalTraces.length,
      privacyLeakCount,
      redactionCount,
      status: privacyLeakCount === 0 && retrievalTraces.length > 0 ? "healthy-fixture" : "needs-review",
    },
  };
}

function buildEditExport(snapshot, edits) {
  const editableNodes = new Map(snapshot.nodes.filter((node) => node.editable).map((node) => [node.id, node]));
  const exportEdits = Object.entries(edits)
    .filter(([nodeId, contents]) => editableNodes.has(nodeId) && typeof contents === "string" && contents.trim().length > 0)
    .map(([nodeId, contents]) => {
      const node = editableNodes.get(nodeId);
      return {
        nodeId: safeExportText(nodeId),
        title: safeExportText(node.title),
        kind: safeExportText(node.kind),
        contents: redactPrivateLikeText(contents),
      };
    });
  return {
    schemaVersion: 1,
    mode: "fixture-draft",
    writesRealFiles: false,
    edits: exportEdits,
  };
}

function buildSelectedAuditTrailEntry(payload, capturedAt = new Date().toISOString()) {
  if (!payload?.ok) return null;
  return {
    schemaVersion: 1,
    mode: "selected-local-audit-trail-entry",
    writesRealFiles: false,
    capturedAt: safeTimestamp(capturedAt),
    rootDisplay: normalizeRootDisplay(payload.selection?.rootDisplay),
    containerLabel: safeExportText(payload.selection?.containerLabel ?? "selected-local-container"),
    status: safeExportText(payload.report?.health?.status ?? "unknown"),
    existingFiles: numeric(payload.report?.totals?.existingFiles),
    lines: numeric(payload.report?.totals?.lines),
    redactionCount: numeric(payload.report?.totals?.redactionCount),
    event: safeExportText(payload.auditTrail?.event ?? "local_container_audit_preview"),
  };
}

function mergeSelectedAuditTrail(existing, payload, limit = 8) {
  const entry = buildSelectedAuditTrailEntry(payload);
  const prior = Array.isArray(existing) ? existing : [];
  const safePrior = prior
    .map((item) => ({
      schemaVersion: 1,
      mode: "selected-local-audit-trail-entry",
      writesRealFiles: false,
      capturedAt: safeTimestamp(item?.capturedAt, "unknown"),
      rootDisplay: normalizeRootDisplay(item?.rootDisplay),
      containerLabel: safeExportText(item?.containerLabel ?? ""),
      status: safeExportText(item?.status ?? ""),
      existingFiles: numeric(item?.existingFiles),
      lines: numeric(item?.lines),
      redactionCount: numeric(item?.redactionCount),
      event: safeExportText(item?.event ?? ""),
    }))
    .filter((item) => item.rootDisplay && item.status);
  return [...(entry ? [entry] : []), ...safePrior].slice(0, Math.max(1, limit));
}

function normalizeRootDisplay(value) {
  const safe = safeExportText(value ?? "selected-local-container").trim();
  const compact = safe.replace(/^(\.\.\.[/\\])+/, "");
  const segments = compact.split(/[/\\]+/).filter(Boolean);
  return `.../${segments.at(-1) ?? "selected-local-container"}`;
}

function safeTimestamp(value, fallback = new Date().toISOString()) {
  const safe = safeExportText(value ?? fallback);
  const date = new Date(safe);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function preferredVaultPath(vault, node) {
  const files = vault?.files ?? [];
  if (node) {
    const direct = files.find((file) => file.nodeId === node.id);
    if (direct) return direct.path;
  }
  return files.find((file) => file.path === "wiki/index.md")?.path ?? files[0]?.path ?? "";
}

function containsPrivateLikeText(value) {
  privateLikePattern.lastIndex = 0;
  return privateLikePattern.test(String(value));
}

function redactPrivateLikeText(value) {
  privateLikePattern.lastIndex = 0;
  return String(value).replace(privateLikePattern, "[REDACTED_PRIVATE]");
}

function safeExportText(value) {
  return redactPrivateLikeText(value ?? "");
}

function duplicateTitleClusters(nodes) {
  const clusters = new Map();
  for (const node of nodes) {
    const key = String(node.title ?? "")
      .trim()
      .toLowerCase()
      .replaceAll(/\s+/g, " ");
    if (!key) continue;
    const group = clusters.get(key) ?? [];
    group.push(nodeSummary(node));
    clusters.set(key, group);
  }
  return [...clusters.values()].filter((group) => group.length > 1);
}

function sumMetadataNumber(nodes, key) {
  return nodes.reduce((total, node) => total + numeric(node.metadata?.[key]), 0);
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function collectLineageSteps(snapshot, startId, nodesById) {
  const lineageKinds = new Set(["research_query", "hypothesis", "decision", "source"]);
  const steps = [];
  const visited = new Set([startId]);
  let frontier = [startId];
  for (let depth = 0; depth < 4; depth += 1) {
    const nextFrontier = [];
    for (const from of frontier) {
      for (const edge of snapshot.edges.filter((candidate) => candidate.from === from)) {
        if (visited.has(edge.to)) continue;
        const node = nodesById.get(edge.to);
        if (!node) continue;
        visited.add(edge.to);
        if (lineageKinds.has(node.kind) || (node.tags ?? []).includes("research")) {
          steps.push({ edgeKind: safeExportText(edge.kind), node: nodeSummary(node) });
        }
        nextFrontier.push(edge.to);
      }
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }
  return steps;
}

function nodeSummary(node) {
  return {
    id: safeExportText(node.id),
    kind: safeExportText(node.kind),
    title: safeExportText(node.title),
    confidence: typeof node.confidence === "number" ? node.confidence : null,
    tags: (node.tags ?? []).map(safeExportText),
  };
}

export {
  buildEditExport,
  buildContainerHealth,
  buildNucleusExport,
  buildResearchLineage,
  buildSelectedAuditTrailEntry,
  containsPrivateLikeText,
  filteredNodes,
  mergeSelectedAuditTrail,
  preferredVaultPath,
  redactPrivateLikeText,
  safeExportText,
};
