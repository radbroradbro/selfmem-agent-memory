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

function buildGraphLayout(snapshot, visibleNodes) {
  const nodes = Array.isArray(visibleNodes) ? visibleNodes : [];
  const visibleIds = new Set(nodes.map((node) => node.id));
  const visibleEdges = (snapshot.edges ?? []).filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  const rankById = rankVisibleNodes(snapshot, nodes, visibleEdges);
  const ranks = [...new Set([...rankById.values()])].sort((a, b) => a - b);
  const columnCount = Math.min(2, Math.max(1, ranks.length));
  const columnByRank = new Map(
    ranks.map((rank, index) => [rank, Math.min(columnCount - 1, Math.floor((index * columnCount) / Math.max(1, ranks.length)))]),
  );
  const groups = new Map(Array.from({ length: columnCount }, (_, index) => [index, []]));

  for (const node of [...nodes].sort(compareGraphNodes)) {
    const rank = rankById.get(node.id) ?? kindRank(node.kind);
    groups.get(columnByRank.get(rank) ?? 0)?.push(node);
  }

  const maxRows = Math.max(1, ...[...groups.values()].map((group) => group.length));
  const rowGap = 148;
  const topPadding = 64;
  const bottomPadding = 72;
  const height = Math.max(380, topPadding + bottomPadding + maxRows * rowGap);
  const nodePositions = new Map();

  for (const [column, group] of groups.entries()) {
    const x = ((column + 1) / (columnCount + 1)) * 100;
    const columnOffset = column % 2 === 0 ? 0 : rowGap / 2;
    for (const [row, node] of group.entries()) {
      const rank = rankById.get(node.id) ?? kindRank(node.kind);
      const y = topPadding + columnOffset + row * rowGap;
      nodePositions.set(node.id, {
        id: node.id,
        x: Number(x.toFixed(2)),
        y: Math.round(Math.min(height - bottomPadding, y)),
        rank,
        row,
      });
    }
  }

  return {
    schemaVersion: 1,
    mode: "dynamic-graph-layout",
    writesRealFiles: false,
    height,
    columns: columnCount,
    rows: maxRows,
    nodes: [...nodePositions.values()],
    edges: visibleEdges.map((edge) => ({
      id: safeExportText(edge.id),
      kind: safeExportText(edge.kind),
      from: safeExportText(edge.from),
      to: safeExportText(edge.to),
    })),
    positionById: nodePositions,
  };
}

function graphScopedNodes(snapshot, visibleNodes, selectedId, scope) {
  const nodes = Array.isArray(visibleNodes) ? visibleNodes : [];
  if (scope !== "neighborhood" || !selectedId) return nodes;
  const neighborIds = selectedNeighborhoodIds(snapshot, selectedId);
  return nodes.filter((node) => neighborIds.has(node.id));
}

function buildGraphNavigation(snapshot, filteredNodes, visibleNodes, selectedId, scope) {
  const filtered = Array.isArray(filteredNodes) ? filteredNodes : [];
  const visible = Array.isArray(visibleNodes) ? visibleNodes : [];
  const selected = safeExportText(selectedId ?? "");
  const visibleIds = new Set(visible.map((node) => node.id));
  const neighborIds = selectedNeighborhoodIds(snapshot, selected);
  return {
    schemaVersion: 1,
    mode: "fixture-graph-navigation",
    writesRealFiles: false,
    scope: scope === "neighborhood" ? "neighborhood" : "all",
    selectedId: selected,
    selectedVisible: visibleIds.has(selected),
    filteredNodeCount: filtered.length,
    visibleNodeCount: visible.length,
    visibleEdgeCount: (snapshot.edges ?? []).filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to)).length,
    selectedNeighborCount: selected ? Math.max(0, neighborIds.size - 1) : 0,
    jumpOptions: filtered.map((node) => ({
      id: safeExportText(node.id),
      title: safeExportText(node.title),
      kind: safeExportText(node.kind),
      edgeCount: (snapshot.edges ?? []).filter((edge) => edge.from === node.id || edge.to === node.id).length,
    })),
  };
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

function buildSessionCompactionAudit(report) {
  const candidateFingerprints = Array.isArray(report?.candidateFingerprints)
    ? report.candidateFingerprints.map((candidate) => ({
        idHash: safeExportText(candidate?.idHash ?? ""),
        kind: safeExportText(candidate?.kind ?? "memory"),
        stale: Boolean(candidate?.stale),
        salience: score(candidate?.salience),
        reasonCount: numeric(candidate?.reasonCount),
        sourceEventCount: numeric(candidate?.sourceEventCount),
        observedAt: safeTimestamp(candidate?.observedAt, "1970-01-01T00:00:00.000Z"),
      }))
    : [];
  return {
    schemaVersion: 1,
    mode: "fixture-local-session-compaction-audit",
    writesRealFiles: false,
    metricsOnly: true,
    ok: Boolean(report?.ok),
    input: {
      source: safeExportText(report?.input?.source ?? "codex"),
      sessionIdHash: safeExportText(report?.input?.sessionIdHash ?? ""),
      inputPathDisplay: normalizeRootDisplay(report?.input?.inputPathDisplay ?? "session-compaction-local-audit.fixture.jsonl"),
      eventCount: numeric(report?.input?.eventCount),
    },
    metrics: {
      inputEvents: numeric(report?.metrics?.inputEvents),
      redactionCount: numeric(report?.metrics?.redactionCount),
      skippedFullyPrivate: numeric(report?.metrics?.skippedFullyPrivate),
      skippedNoise: numeric(report?.metrics?.skippedNoise),
      outputCandidates: numeric(report?.metrics?.outputCandidates),
      chronological: report?.metrics?.chronological === true,
      noiseReductionRatio: numeric(report?.metrics?.noiseReductionRatio),
    },
    quality: {
      candidateCount: numeric(report?.quality?.candidateCount),
      kindCounts: safeNumberMap(report?.quality?.kindCounts),
      staleCandidateCount: numeric(report?.quality?.staleCandidateCount),
      exactIdentifierCandidateCount: numeric(report?.quality?.exactIdentifierCandidateCount),
      averageSalience: numeric(report?.quality?.averageSalience),
      salienceBands: safeNumberMap(report?.quality?.salienceBands),
      firstObservedAt: safeOptionalTimestamp(report?.quality?.firstObservedAt),
      lastObservedAt: safeOptionalTimestamp(report?.quality?.lastObservedAt),
      privacyLeakCount: numeric(report?.quality?.privacyLeakCount),
    },
    candidateFingerprints,
    strict: Boolean(report?.strict),
  };
}

function buildPromptContextPreview(snapshot, packet = {}) {
  const nodesById = new Map((snapshot.nodes ?? []).map((node) => [node.id, node]));
  const rawSerialized = JSON.stringify(packet ?? {});
  const selectedMemories = Array.isArray(packet?.selectedMemories)
    ? packet.selectedMemories.map((memory, index) => {
        const id = safeExportText(memory?.id ?? `memory:${index}`);
        const node = nodesById.get(id);
        return {
          id,
          kind: safeExportText(memory?.kind ?? node?.kind ?? "memory"),
          title: safeExportText(memory?.title ?? node?.title ?? id),
          source: safeChoice(memory?.source ?? "local", ["local", "hosted-readonly", "wiki", "session", "fixture"], "local"),
          tokens: numeric(memory?.tokens),
          injected: memory?.injected !== false,
          rerankScore: score(memory?.rerankScore),
          channelRanks: safeNumberMap(memory?.channelRanks),
          reason: safeExportText(memory?.reason ?? "selected_by_rerank"),
          citationIds: safeStringList(memory?.citationIds),
        };
      })
    : [];
  const omittedCandidates = Array.isArray(packet?.omittedCandidates)
    ? packet.omittedCandidates.map((candidate, index) => ({
        id: safeExportText(candidate?.id ?? `omitted:${index}`),
        kind: safeExportText(candidate?.kind ?? "memory"),
        reason: safeExportText(candidate?.reason ?? "outside_token_budget"),
        tokens: numeric(candidate?.tokens),
        rerankScore: score(candidate?.rerankScore),
      }))
    : [];
  const sections = Array.isArray(packet?.sections)
    ? packet.sections.map((section, index) => ({
        id: safeExportText(section?.id ?? `section:${index}`),
        title: safeExportText(section?.title ?? "Recall section"),
        source: safeChoice(section?.source ?? "local", ["local", "hosted-readonly", "wiki", "session", "fixture"], "local"),
        tokens: numeric(section?.tokens),
        injected: section?.injected !== false,
        citationIds: safeStringList(section?.citationIds),
        text: safeExportText(section?.text ?? ""),
      }))
    : [];
  const tokenBudget = numeric(packet?.tokenBudget);
  const totalTokens = numeric(packet?.totalTokens) || sections.reduce((total, section) => total + section.tokens, 0);
  return {
    schemaVersion: 1,
    mode: "fixture-prompt-context-preview",
    writesRealFiles: false,
    query: safeExportText(packet?.query ?? ""),
    generatedAt: safeTimestamp(packet?.generatedAt, snapshot.generatedAt ?? "1970-01-01T00:00:00.000Z"),
    traceId: safeExportText(packet?.traceId ?? ""),
    tokenBudget,
    totalTokens,
    budgetRemaining: Math.max(0, tokenBudget - totalTokens),
    selectedMemories,
    omittedCandidates,
    sections,
    citations: safeStringList(packet?.citations),
    safety: {
      metricsOnly: false,
      privacyLeakCount: numeric(packet?.safety?.privacyLeakCount) + (containsPrivateLikeText(rawSerialized) ? 1 : 0),
      redactionCount: numeric(packet?.safety?.redactionCount),
      hostedReadThrough: safeChoice(packet?.safety?.hostedReadThrough ?? "read-only", ["read-only", "disabled"], "read-only"),
      writeMode: safeChoice(packet?.safety?.writeMode ?? "local-only", ["local-only", "disabled"], "local-only"),
    },
    compiledContext: safeExportText(packet?.compiledContext ?? ""),
  };
}

function buildReleaseReadinessConsole(packet = {}) {
  const rawSerialized = JSON.stringify(packet ?? {});
  const codeBaseline = packet?.latestVerifiedCodeBaseline ?? {};
  const documentationBaseline = packet?.latestDocumentationBaseline ?? {};
  const safetyBoundary = packet?.safetyBoundary ?? {};
  const blockers = safeStringList(packet?.remainingBlockers);
  const manualActions = safeStringList(packet?.manualActions);
  const surfaces = safeStringList(packet?.provenPreviewSurfaces);
  const launchVerdict = safeChoice(packet?.publicLaunchVerdict ?? "FAIL", ["FAIL", "PASS", "PASS_WITH_CONCERNS"], "FAIL");
  const productionReady = packet?.productionReady === true;
  const safetyFlags = {
    usesFixtureUiEvidence: booleanSetting(safetyBoundary.usesFixtureUiEvidence, true),
    commitsRawMemories: booleanSetting(safetyBoundary.commitsRawMemories, false),
    commitsRawTranscripts: booleanSetting(safetyBoundary.commitsRawTranscripts, false),
    commitsCredentials: booleanSetting(safetyBoundary.commitsCredentials, false),
    enablesHostedWriteBack: booleanSetting(safetyBoundary.enablesHostedWriteBack, false),
  };
  return {
    schemaVersion: 1,
    mode: "fixture-release-readiness-console",
    writesRealFiles: false,
    metricsOnly: true,
    generatedAt: safeTimestamp(packet?.generatedAt, "1970-01-01T00:00:00.000Z"),
    publicLaunchVerdict: launchVerdict,
    productionReady,
    repository: safeExportText(packet?.repository ?? "example/recallweave"),
    pullRequest: {
      number: numeric(packet?.pullRequest?.number),
      branch: safeExportText(packet?.pullRequest?.branch ?? ""),
      base: safeExportText(packet?.pullRequest?.base ?? ""),
      state: safeChoice(packet?.pullRequest?.state ?? "open", ["open", "closed", "merged", "draft"], "open"),
      mergeable: packet?.pullRequest?.mergeable === true,
    },
    latestVerifiedCodeBaseline: {
      headSha: safeCommitSha(codeBaseline.headSha),
      shortSha: shortSha(codeBaseline.headSha),
      ciRunId: numeric(codeBaseline.ciRunId),
      ciConclusion: safeChoice(codeBaseline.ciConclusion ?? "unknown", ["success", "failure", "cancelled", "skipped", "unknown"], "unknown"),
      localReleaseCheck: safeChoice(codeBaseline.localReleaseCheck ?? "unknown", ["passed", "failed", "unknown"], "unknown"),
      secretScan: safeChoice(codeBaseline.secretScan ?? "unknown", ["zero_hits", "hits", "unknown"], "unknown"),
    },
    latestDocumentationBaseline: {
      headSha: safeCommitSha(documentationBaseline.headSha),
      shortSha: shortSha(documentationBaseline.headSha),
      ciRunId: numeric(documentationBaseline.ciRunId),
      ciConclusion: safeChoice(documentationBaseline.ciConclusion ?? "unknown", ["success", "failure", "cancelled", "skipped", "unknown"], "unknown"),
    },
    safetyBoundary: safetyFlags,
    safetySummary: {
      fixtureOnly: safetyFlags.usesFixtureUiEvidence === true,
      rawMemorySafe: safetyFlags.commitsRawMemories === false && safetyFlags.commitsRawTranscripts === false,
      credentialSafe: safetyFlags.commitsCredentials === false,
      hostedWriteBackDisabled: safetyFlags.enablesHostedWriteBack === false,
      privacyLeakCount: containsPrivateLikeText(rawSerialized) ? 1 : 0,
    },
    surfaces,
    blockers,
    manualActions,
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

function buildLifecyclePolicyDraft(snapshot, overrides = {}) {
  const policy = snapshot.roots?.lifecyclePolicy ?? {};
  const recall = policy.recall ?? {};
  const writes = policy.writes ?? {};
  const lifecycle = policy.lifecycle ?? {};
  const draft = {
    schemaVersion: 1,
    mode: "fixture-lifecycle-policy-draft",
    writesRealFiles: false,
    recall: {
      forceEveryTurn: booleanSetting(overrides.forceEveryTurn, recall.forceEveryTurn),
      defaultMode: safeExportText(recall.defaultMode ?? "skip_obvious_maintenance"),
      rerankCandidateLimit: clampInteger(
        overrides.rerankCandidateLimit ?? recall.rerankCandidateLimit,
        1,
        200,
        36,
      ),
      rerankTokenBudget: clampInteger(overrides.rerankTokenBudget ?? recall.rerankTokenBudget, 256, 64_000, 6400),
      skipWhenPromptMatches: safeStringList(recall.skipWhenPromptMatches),
      forceWhenPromptMatches: safeStringList(recall.forceWhenPromptMatches),
    },
    writes: {
      storeExplicitToolWrites: booleanSetting(writes.storeExplicitToolWrites, true),
      storeAgentEndSummaries: booleanSetting(writes.storeAgentEndSummaries, true),
      storePreCompressCheckpoints: booleanSetting(
        overrides.storePreCompressCheckpoints,
        writes.storePreCompressCheckpoints,
      ),
      rejectFullyPrivate: booleanSetting(writes.rejectFullyPrivate, true),
      rejectKeyShapedContent: booleanSetting(writes.rejectKeyShapedContent, true),
      suppressDuplicates: booleanSetting(writes.suppressDuplicates, true),
      maxAutoWritesPerSession: clampInteger(overrides.maxAutoWritesPerSession ?? writes.maxAutoWritesPerSession, 0, 200, 20),
      lowConfidenceAction: safeChoice(overrides.lowConfidenceAction ?? writes.lowConfidenceAction, [
        "review_queue",
        "suppress",
        "write_with_low_confidence_flag",
      ]),
    },
    lifecycle: {
      hermes: safeStatusMap(lifecycle.hermes),
      openclaw: safeStatusMap(lifecycle.openclaw),
    },
  };
  draft.changedFields = summarizePolicyChanges(policy, draft);
  return draft;
}

function buildMemoryReviewQueue(snapshot, decisions = {}) {
  const candidates = Array.isArray(snapshot.roots?.reviewQueue?.candidates) ? snapshot.roots.reviewQueue.candidates : [];
  const items = candidates.map((candidate) => {
    const id = safeExportText(candidate.id);
    const action = safeChoice(decisions[id] ?? candidate.recommendedAction, [
      "approve",
      "suppress",
      "merge",
      "needs_more_evidence",
    ]);
    return {
      id,
      kind: safeExportText(candidate.kind ?? "memory"),
      text: safeExportText(candidate.text ?? ""),
      reason: safeExportText(candidate.reason ?? "review_required"),
      confidence: score(candidate.confidence),
      sourceNodeId: safeExportText(candidate.sourceNodeId ?? ""),
      recommendedAction: safeChoice(candidate.recommendedAction, ["approve", "suppress", "merge", "needs_more_evidence"]),
      action,
      changed: action !== safeChoice(candidate.recommendedAction, ["approve", "suppress", "merge", "needs_more_evidence"]),
    };
  });
  return {
    schemaVersion: 1,
    mode: "fixture-memory-review-queue",
    writesRealFiles: false,
    summary: {
      candidates: items.length,
      approve: items.filter((item) => item.action === "approve").length,
      suppress: items.filter((item) => item.action === "suppress").length,
      merge: items.filter((item) => item.action === "merge").length,
      needsMoreEvidence: items.filter((item) => item.action === "needs_more_evidence").length,
      changed: items.filter((item) => item.changed).length,
    },
    items,
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

function safeOptionalTimestamp(value) {
  if (!value) return null;
  return safeTimestamp(value, "1970-01-01T00:00:00.000Z");
}

function booleanSetting(value, fallback) {
  if (typeof value === "boolean") return value;
  return Boolean(fallback);
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeChoice(value, allowed, fallback = allowed[0]) {
  const safe = safeExportText(value);
  return allowed.includes(safe) ? safe : fallback;
}

function safeStringList(value) {
  return Array.isArray(value) ? value.map(safeExportText).filter(Boolean).slice(0, 20) : [];
}

function safeStatusMap(value) {
  const entries = Object.entries(value ?? {}).map(([key, status]) => [
    safeExportText(key),
    safeChoice(status, ["enabled", "disabled"], "disabled"),
  ]);
  return Object.fromEntries(entries);
}

function safeNumberMap(value) {
  return Object.fromEntries(
    Object.entries(value ?? {})
      .map(([key, count]) => [safeExportText(key), numeric(count)])
      .filter(([key]) => key),
  );
}

function safeCommitSha(value) {
  const safe = safeExportText(value ?? "");
  return /^[a-f0-9]{40}$/i.test(safe) ? safe.toLowerCase() : "";
}

function shortSha(value) {
  return safeCommitSha(value).slice(0, 7);
}

function summarizePolicyChanges(original, draft) {
  const changes = [];
  const pairs = [
    ["recall.forceEveryTurn", original.recall?.forceEveryTurn, draft.recall.forceEveryTurn],
    ["recall.rerankCandidateLimit", original.recall?.rerankCandidateLimit, draft.recall.rerankCandidateLimit],
    ["recall.rerankTokenBudget", original.recall?.rerankTokenBudget, draft.recall.rerankTokenBudget],
    ["writes.storePreCompressCheckpoints", original.writes?.storePreCompressCheckpoints, draft.writes.storePreCompressCheckpoints],
    ["writes.maxAutoWritesPerSession", original.writes?.maxAutoWritesPerSession, draft.writes.maxAutoWritesPerSession],
    ["writes.lowConfidenceAction", original.writes?.lowConfidenceAction, draft.writes.lowConfidenceAction],
  ];
  for (const [field, before, after] of pairs) {
    if (before !== after) {
      changes.push({ field, before: safeExportText(before), after: safeExportText(after) });
    }
  }
  return changes;
}

function preferredVaultPath(vault, node) {
  const files = vault?.files ?? [];
  if (node) {
    const direct = files.find((file) => file.nodeId === node.id);
    if (direct) return direct.path;
  }
  return files.find((file) => file.path === "wiki/index.md")?.path ?? files[0]?.path ?? "";
}

function selectedNeighborhoodIds(snapshot, selectedId) {
  const selected = safeExportText(selectedId ?? "");
  if (!selected) return new Set();
  const ids = new Set([selected]);
  for (const edge of snapshot.edges ?? []) {
    if (edge.from === selected) ids.add(edge.to);
    if (edge.to === selected) ids.add(edge.from);
  }
  return ids;
}

function rankVisibleNodes(snapshot, nodes, edges) {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const ranks = new Map();
  const explicitRoot = safeExportText(snapshot.roots?.indexPageId);
  const roots = nodes
    .filter((node) => node.id === explicitRoot || (incoming.get(node.id) ?? 0) === 0)
    .sort(compareGraphNodes);
  const queue = roots.map((node) => ({ id: node.id, rank: node.id === explicitRoot ? 0 : kindRank(node.kind) }));

  while (queue.length > 0) {
    const current = queue.shift();
    const previous = ranks.get(current.id);
    if (previous !== undefined && previous <= current.rank) continue;
    ranks.set(current.id, current.rank);
    for (const next of outgoing.get(current.id) ?? []) {
      queue.push({ id: next, rank: current.rank + 1 });
    }
  }

  for (const node of nodes) {
    if (!ranks.has(node.id)) ranks.set(node.id, kindRank(node.kind));
  }

  return ranks;
}

function compareGraphNodes(a, b) {
  return (
    kindRank(a.kind) - kindRank(b.kind) ||
    String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) ||
    String(a.title ?? "").localeCompare(String(b.title ?? "")) ||
    String(a.id ?? "").localeCompare(String(b.id ?? ""))
  );
}

function kindRank(kind) {
  const ranks = {
    source: 0,
    memory: 1,
    research_query: 1,
    retrieval_trace: 2,
    lifecycle_event: 2,
    hypothesis: 2,
    decision: 3,
    derived_doc: 4,
    wiki_page: 4,
  };
  return ranks[safeExportText(kind)] ?? 2;
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

function score(value) {
  return Math.min(1, Math.max(0, numeric(value)));
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
  buildGraphNavigation,
  buildGraphLayout,
  buildLifecyclePolicyDraft,
  buildMemoryReviewQueue,
  buildNucleusExport,
  buildPromptContextPreview,
  buildReleaseReadinessConsole,
  buildResearchLineage,
  buildSessionCompactionAudit,
  buildSelectedAuditTrailEntry,
  containsPrivateLikeText,
  filteredNodes,
  graphScopedNodes,
  mergeSelectedAuditTrail,
  preferredVaultPath,
  redactPrivateLikeText,
  safeExportText,
};
