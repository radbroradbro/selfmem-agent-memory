import {
  buildContainerHealth,
  buildEditExport,
  buildGraphNavigation,
  buildGraphLayout,
  buildLifecyclePolicyDraft,
  buildMemoryReviewQueue,
  buildNucleusExport,
  buildBenchmarkDashboard,
  buildPromptContextPreview,
  buildReleaseReadinessConsole,
  buildResearchLineage,
  buildSessionCompactionAudit,
  containsPrivateLikeText,
  filteredNodes as selectFilteredNodes,
  graphScopedNodes,
  mergeSelectedAuditTrail,
  preferredVaultPath,
} from "./model.js";

const selectedAuditHistoryKey = "recallweave.selectedAudit.history";

const state = {
  snapshot: null,
  filter: "all",
  query: "",
  graphScope: "all",
  selectedId: null,
  edits: readEdits(),
  vault: null,
  syncReport: null,
  sessionCompactionAudit: null,
  benchmarkSummary: null,
  promptContextPreview: null,
  releaseReadiness: null,
  selectedVaultPath: "",
  localAudit: null,
  localBrowse: null,
  selectedBrowse: null,
  selectedAudit: null,
  localEdit: null,
  localMaterialize: null,
  selectedAuditHistory: readSelectedAuditHistory(),
  selectedSync: null,
  selectedSyncApply: null,
  lifecyclePolicyDraft: null,
  lifecyclePolicyApply: null,
  reviewQueueDraft: null,
  reviewQueueApply: null,
};

const searchInput = document.querySelector("#searchInput");
const graph = document.querySelector("#graph");
const graphNavigationStatus = document.querySelector("#graphNavigationStatus");
const graphNodeJump = document.querySelector("#graphNodeJump");
const centerSelected = document.querySelector("#centerSelected");
const nodeCount = document.querySelector("#nodeCount");
const edgeCount = document.querySelector("#edgeCount");
const editableCount = document.querySelector("#editableCount");
const healthStatus = document.querySelector("#healthStatus");
const containerFacts = document.querySelector("#containerFacts");
const detailKind = document.querySelector("#detailKind");
const detailTitle = document.querySelector("#detailTitle");
const detailFacts = document.querySelector("#detailFacts");
const provenance = document.querySelector("#provenance");
const snapshotSummary = document.querySelector("#snapshotSummary");
const snapshotExport = document.querySelector("#snapshotExport");
const researchLineage = document.querySelector("#researchLineage");
const compactionAuditSummary = document.querySelector("#compactionAuditSummary");
const compactionAuditFingerprints = document.querySelector("#compactionAuditFingerprints");
const compactionAuditExport = document.querySelector("#compactionAuditExport");
const benchmarkStatus = document.querySelector("#benchmarkStatus");
const benchmarkSummary = document.querySelector("#benchmarkSummary");
const benchmarkScenarios = document.querySelector("#benchmarkScenarios");
const benchmarkCaveats = document.querySelector("#benchmarkCaveats");
const benchmarkExport = document.querySelector("#benchmarkExport");
const contextPreviewSummary = document.querySelector("#contextPreviewSummary");
const contextPreviewMemories = document.querySelector("#contextPreviewMemories");
const contextPreviewSections = document.querySelector("#contextPreviewSections");
const contextPreviewOmitted = document.querySelector("#contextPreviewOmitted");
const contextPreviewExport = document.querySelector("#contextPreviewExport");
const releaseReadinessStatus = document.querySelector("#releaseReadinessStatus");
const releaseReadinessSummary = document.querySelector("#releaseReadinessSummary");
const releaseReadinessSurfaces = document.querySelector("#releaseReadinessSurfaces");
const releaseReadinessBlockers = document.querySelector("#releaseReadinessBlockers");
const releaseReadinessActions = document.querySelector("#releaseReadinessActions");
const releaseReadinessExport = document.querySelector("#releaseReadinessExport");
const policySummary = document.querySelector("#policySummary");
const policyForm = document.querySelector("#policyForm");
const policyForceRecall = document.querySelector("#policyForceRecall");
const policyPreCompress = document.querySelector("#policyPreCompress");
const policyMaxWrites = document.querySelector("#policyMaxWrites");
const policyLowConfidence = document.querySelector("#policyLowConfidence");
const policyStatus = document.querySelector("#policyStatus");
const policyDraft = document.querySelector("#policyDraft");
const policyApplyForm = document.querySelector("#policyApplyForm");
const policyApplyPath = document.querySelector("#policyApplyPath");
const policyApplyConfirm = document.querySelector("#policyApplyConfirm");
const policyApplyPhrase = document.querySelector("#policyApplyPhrase");
const policyApplyStatus = document.querySelector("#policyApplyStatus");
const policyApplySummary = document.querySelector("#policyApplySummary");
const policyApplyActions = document.querySelector("#policyApplyActions");
const reviewQueueSummary = document.querySelector("#reviewQueueSummary");
const reviewQueueForm = document.querySelector("#reviewQueueForm");
const reviewQueueItems = document.querySelector("#reviewQueueItems");
const reviewQueueStatus = document.querySelector("#reviewQueueStatus");
const reviewQueueDraft = document.querySelector("#reviewQueueDraft");
const reviewQueueApplyForm = document.querySelector("#reviewQueueApplyForm");
const reviewQueueApplyPath = document.querySelector("#reviewQueueApplyPath");
const reviewQueueApplyConfirm = document.querySelector("#reviewQueueApplyConfirm");
const reviewQueueApplyPhrase = document.querySelector("#reviewQueueApplyPhrase");
const reviewQueueApplyStatus = document.querySelector("#reviewQueueApplyStatus");
const reviewQueueApplySummary = document.querySelector("#reviewQueueApplySummary");
const reviewQueueApplyActions = document.querySelector("#reviewQueueApplyActions");
const vaultFileSelect = document.querySelector("#vaultFileSelect");
const vaultStatus = document.querySelector("#vaultStatus");
const vaultPreview = document.querySelector("#vaultPreview");
const syncSummary = document.querySelector("#syncSummary");
const syncActions = document.querySelector("#syncActions");
const selectedSyncForm = document.querySelector("#selectedSyncForm");
const selectedSyncPath = document.querySelector("#selectedSyncPath");
const selectedSyncConfirm = document.querySelector("#selectedSyncConfirm");
const selectedSyncStatus = document.querySelector("#selectedSyncStatus");
const selectedSyncSummary = document.querySelector("#selectedSyncSummary");
const selectedSyncActions = document.querySelector("#selectedSyncActions");
const selectedSyncApplyForm = document.querySelector("#selectedSyncApplyForm");
const selectedSyncApplyPath = document.querySelector("#selectedSyncApplyPath");
const selectedSyncApplyConfirm = document.querySelector("#selectedSyncApplyConfirm");
const selectedSyncApplyPhrase = document.querySelector("#selectedSyncApplyPhrase");
const selectedSyncApplyStatus = document.querySelector("#selectedSyncApplyStatus");
const selectedSyncApplySummary = document.querySelector("#selectedSyncApplySummary");
const selectedSyncApplyActions = document.querySelector("#selectedSyncApplyActions");
const localAuditSummary = document.querySelector("#localAuditSummary");
const localAuditFiles = document.querySelector("#localAuditFiles");
const localAuditReasons = document.querySelector("#localAuditReasons");
const localBrowseSummary = document.querySelector("#localBrowseSummary");
const localBrowseItems = document.querySelector("#localBrowseItems");
const selectedBrowseForm = document.querySelector("#selectedBrowseForm");
const selectedBrowsePath = document.querySelector("#selectedBrowsePath");
const selectedBrowseConfirm = document.querySelector("#selectedBrowseConfirm");
const selectedBrowseMaxItems = document.querySelector("#selectedBrowseMaxItems");
const selectedBrowseStatus = document.querySelector("#selectedBrowseStatus");
const selectedBrowseSummary = document.querySelector("#selectedBrowseSummary");
const selectedBrowseItems = document.querySelector("#selectedBrowseItems");
const localEditForm = document.querySelector("#localEditForm");
const localEditPath = document.querySelector("#localEditPath");
const localEditSourceFile = document.querySelector("#localEditSourceFile");
const localEditLine = document.querySelector("#localEditLine");
const localEditSourceId = document.querySelector("#localEditSourceId");
const localEditAction = document.querySelector("#localEditAction");
const localEditReason = document.querySelector("#localEditReason");
const localEditText = document.querySelector("#localEditText");
const localEditConfirm = document.querySelector("#localEditConfirm");
const localEditPhrase = document.querySelector("#localEditPhrase");
const localEditStatus = document.querySelector("#localEditStatus");
const localEditSummary = document.querySelector("#localEditSummary");
const localEditActions = document.querySelector("#localEditActions");
const localMaterializeForm = document.querySelector("#localMaterializeForm");
const localMaterializePath = document.querySelector("#localMaterializePath");
const localMaterializeConfirm = document.querySelector("#localMaterializeConfirm");
const localMaterializePhrase = document.querySelector("#localMaterializePhrase");
const localMaterializeStatus = document.querySelector("#localMaterializeStatus");
const localMaterializeSummary = document.querySelector("#localMaterializeSummary");
const localMaterializeActions = document.querySelector("#localMaterializeActions");
const selectedAuditForm = document.querySelector("#selectedAuditForm");
const selectedAuditPath = document.querySelector("#selectedAuditPath");
const selectedAuditConfirm = document.querySelector("#selectedAuditConfirm");
const selectedAuditStatus = document.querySelector("#selectedAuditStatus");
const selectedAuditSummary = document.querySelector("#selectedAuditSummary");
const selectedAuditMeta = document.querySelector("#selectedAuditMeta");
const selectedAuditHistory = document.querySelector("#selectedAuditHistory");
const docEditor = document.querySelector("#docEditor");
const saveEdit = document.querySelector("#saveEdit");
const resetEdit = document.querySelector("#resetEdit");
const editStatus = document.querySelector("#editStatus");
const exportStatus = document.querySelector("#exportStatus");
const editExport = document.querySelector("#editExport");
const timelineList = document.querySelector("#timelineList");

const [
  response,
  vaultResponse,
  syncResponse,
  sessionCompactionResponse,
  benchmarkResponse,
  promptContextResponse,
  releaseReadinessResponse,
  localAuditResponse,
  localBrowseResponse,
] = await Promise.all([
  fetch("/fixtures/nucleus.fixture.json"),
  fetch("/fixtures/wiki-vault.json"),
  fetch("/fixtures/wiki-sync-report.json"),
  fetch("/fixtures/session-compaction-local-audit.json"),
  fetch("/fixtures/benchmark-summary.json"),
  fetch("/fixtures/prompt-context-preview.json"),
  fetch("/fixtures/release-readiness.json"),
  fetch("/fixtures/local-container-audit.json"),
  fetch("/fixtures/local-container-browse.json"),
]);
state.snapshot = await response.json();
state.vault = await vaultResponse.json();
state.syncReport = await syncResponse.json();
state.sessionCompactionAudit = await sessionCompactionResponse.json();
state.benchmarkSummary = await benchmarkResponse.json();
state.promptContextPreview = await promptContextResponse.json();
state.releaseReadiness = await releaseReadinessResponse.json();
state.localAudit = await localAuditResponse.json();
state.localBrowse = await localBrowseResponse.json();
state.query = searchInput.value;
state.selectedId = state.snapshot.nodes[0]?.id ?? null;
state.selectedVaultPath = preferredVaultPath(state.vault?.vault);
hydratePolicyControls();
hydrateReviewQueue();

render();

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

document.querySelectorAll("[data-graph-scope]").forEach((button) => {
  button.addEventListener("click", () => {
    state.graphScope = button.dataset.graphScope === "neighborhood" ? "neighborhood" : "all";
    document.querySelectorAll("[data-graph-scope]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render();
    centerSelectedNode();
  });
});

graphNodeJump.addEventListener("change", (event) => {
  state.selectedId = event.target.value;
  editStatus.textContent = "";
  render();
  centerSelectedNode();
});

centerSelected.addEventListener("click", () => {
  centerSelectedNode();
});

saveEdit.addEventListener("click", () => {
  if (!state.selectedId) return;
  if (containsPrivateLikeText(docEditor.value)) {
    editStatus.textContent = "Private or key-shaped text was not saved.";
    return;
  }
  state.edits[state.selectedId] = docEditor.value;
  localStorage.setItem("recallweave.fixture.edits", JSON.stringify(state.edits));
  editStatus.textContent = "Saved locally for this fixture review.";
  render();
});

resetEdit.addEventListener("click", () => {
  if (!state.selectedId) return;
  delete state.edits[state.selectedId];
  localStorage.setItem("recallweave.fixture.edits", JSON.stringify(state.edits));
  editStatus.textContent = "Reset to fixture source.";
  render();
});

vaultFileSelect.addEventListener("change", (event) => {
  state.selectedVaultPath = event.target.value;
  renderVaultPreview();
});

policyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.lifecyclePolicyDraft = buildLifecyclePolicyDraft(state.snapshot, {
    forceEveryTurn: policyForceRecall.checked,
    storePreCompressCheckpoints: policyPreCompress.checked,
    maxAutoWritesPerSession: policyMaxWrites.value,
    lowConfidenceAction: policyLowConfidence.value,
  });
  policyStatus.textContent = `${state.lifecyclePolicyDraft.changedFields.length} staged change${state.lifecyclePolicyDraft.changedFields.length === 1 ? "" : "s"}.`;
  renderLifecyclePolicy();
});

policyApplyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.lifecyclePolicyApply = { ok: false, code: "loading", message: "Applying selected local lifecycle policy." };
  renderLifecyclePolicyApply();
  try {
    const response = await fetch("/lifecycle-policy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: policyApplyPath.value,
        policy: state.lifecyclePolicyDraft,
        confirmWrite: policyApplyConfirm.checked,
        confirmationPhrase: policyApplyPhrase.value,
      }),
    });
    state.lifecyclePolicyApply = await response.json();
  } catch (error) {
    state.lifecyclePolicyApply = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    policyApplyPath.value = "";
    policyApplyPhrase.value = "";
    renderLifecyclePolicyApply();
  }
});

reviewQueueForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const decisions = Object.fromEntries(
    [...reviewQueueForm.querySelectorAll("[data-review-action]")].map((select) => [select.dataset.reviewAction, select.value]),
  );
  state.reviewQueueDraft = buildMemoryReviewQueue(state.snapshot, decisions);
  reviewQueueStatus.textContent = `${state.reviewQueueDraft.summary.changed} changed review decision${state.reviewQueueDraft.summary.changed === 1 ? "" : "s"}.`;
  renderReviewQueue();
});

reviewQueueApplyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.reviewQueueApply = { ok: false, code: "loading", message: "Applying selected local review decisions." };
  renderReviewQueueApply();
  try {
    const response = await fetch("/review-queue/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: reviewQueueApplyPath.value,
        reviewQueue: state.reviewQueueDraft,
        confirmWrite: reviewQueueApplyConfirm.checked,
        confirmationPhrase: reviewQueueApplyPhrase.value,
      }),
    });
    state.reviewQueueApply = await response.json();
  } catch (error) {
    state.reviewQueueApply = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    reviewQueueApplyPath.value = "";
    reviewQueueApplyPhrase.value = "";
    renderReviewQueueApply();
  }
});

selectedSyncForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.selectedSync = { ok: false, code: "loading", message: "Previewing selected local vault sync." };
  renderSelectedSync();
  try {
    const response = await fetch("/wiki/sync/dry-run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: selectedSyncPath.value,
        confirmReadOnly: selectedSyncConfirm.checked,
      }),
    });
    state.selectedSync = await response.json();
  } catch (error) {
    state.selectedSync = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    selectedSyncPath.value = "";
    renderSelectedSync();
  }
});

selectedSyncApplyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.selectedSyncApply = { ok: false, code: "loading", message: "Applying selected local vault sync." };
  renderSelectedSyncApply();
  try {
    const response = await fetch("/wiki/sync/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: selectedSyncApplyPath.value,
        confirmWrite: selectedSyncApplyConfirm.checked,
        confirmationPhrase: selectedSyncApplyPhrase.value,
      }),
    });
    state.selectedSyncApply = await response.json();
  } catch (error) {
    state.selectedSyncApply = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    selectedSyncApplyPath.value = "";
    selectedSyncApplyPhrase.value = "";
    renderSelectedSyncApply();
  }
});

selectedBrowseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.selectedBrowse = { ok: false, code: "loading", message: "Browsing selected local container." };
  renderSelectedBrowse();
  try {
    const response = await fetch("/local-container/browse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: selectedBrowsePath.value,
        confirmReadOnly: selectedBrowseConfirm.checked,
        maxItems: Number(selectedBrowseMaxItems.value),
      }),
    });
    state.selectedBrowse = await response.json();
  } catch (error) {
    state.selectedBrowse = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    selectedBrowsePath.value = "";
    renderSelectedBrowse();
  }
});

localEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.localEdit = { ok: false, code: "loading", message: "Applying selected local memory edit." };
  renderLocalEdit();
  try {
    const response = await fetch("/local-container/edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: localEditPath.value,
        edit: {
          sourceFile: localEditSourceFile.value,
          line: Number(localEditLine.value),
          sourceId: localEditSourceId.value,
          action: localEditAction.value,
          reason: localEditReason.value,
          replacementText: localEditText.value,
        },
        confirmWrite: localEditConfirm.checked,
        confirmationPhrase: localEditPhrase.value,
      }),
    });
    state.localEdit = await response.json();
  } catch (error) {
    state.localEdit = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    localEditPath.value = "";
    localEditPhrase.value = "";
    localEditText.value = "";
    renderLocalEdit();
  }
});

localMaterializeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.localMaterialize = { ok: false, code: "loading", message: "Materializing selected local memory edits." };
  renderLocalMaterialize();
  try {
    const response = await fetch("/local-container/materialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: localMaterializePath.value,
        confirmWrite: localMaterializeConfirm.checked,
        confirmationPhrase: localMaterializePhrase.value,
      }),
    });
    state.localMaterialize = await response.json();
  } catch (error) {
    state.localMaterialize = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    localMaterializePath.value = "";
    localMaterializePhrase.value = "";
    renderLocalMaterialize();
  }
});

selectedAuditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.selectedAudit = { ok: false, code: "loading", message: "Checking selected local container." };
  renderSelectedAudit();
  try {
    const response = await fetch("/local-container/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rootDir: selectedAuditPath.value,
        confirmReadOnly: selectedAuditConfirm.checked,
      }),
    });
    state.selectedAudit = await response.json();
    if (state.selectedAudit.ok) {
      state.selectedAuditHistory = mergeSelectedAuditTrail(state.selectedAuditHistory, state.selectedAudit);
      localStorage.setItem(selectedAuditHistoryKey, JSON.stringify(state.selectedAuditHistory));
    }
  } catch (error) {
    state.selectedAudit = { ok: false, code: "request_failed", message: error instanceof Error ? error.message : String(error) };
  } finally {
    selectedAuditPath.value = "";
    renderSelectedAudit();
    renderSelectedAuditHistory();
  }
});

function render() {
  const filtered = filteredNodes();
  const selected = currentSelected(filtered);
  const nodes = graphScopedNodes(state.snapshot, filtered, state.selectedId, state.graphScope);
  renderMetrics();
  renderContainerHealth();
  renderGraphNavigation(filtered, nodes);
  renderGraph(nodes);
  renderTimeline(nodes);
  renderDetails(selected);
  renderNucleusSnapshot();
  renderResearchLineage();
  renderSessionCompactionAudit();
  renderBenchmarkDashboard();
  renderPromptContextPreview();
  renderReleaseReadiness();
  renderLifecyclePolicy();
  renderLifecyclePolicyApply();
  renderReviewQueue();
  renderReviewQueueApply();
  renderVaultControls(selected);
  renderSyncReport();
  renderSelectedSync();
  renderSelectedSyncApply();
  renderLocalAudit();
  renderLocalBrowse();
  renderSelectedBrowse();
  renderLocalEdit();
  renderLocalMaterialize();
  renderSelectedAudit();
  renderSelectedAuditHistory();
  renderEditExport();
  scrollHashTargetIntoPanel();
}

function renderMetrics() {
  nodeCount.textContent = String(state.snapshot.nodes.length);
  edgeCount.textContent = String(state.snapshot.edges.length);
  editableCount.textContent = String(state.snapshot.nodes.filter((node) => node.editable).length);
}

function renderContainerHealth() {
  const health = buildContainerHealth(state.snapshot);
  healthStatus.textContent = health.health.status;
  healthStatus.dataset.status = health.health.status;
  containerFacts.replaceChildren(
    fact("Agent", health.agentLabel),
    fact("Local", health.localContainer),
    fact("Hosted read", health.sourceSupermemoryContainer),
    fact("Provider", health.providerMode),
    fact("Writes", health.writeMode),
    fact("Lifecycle", health.health.lifecycleEvents),
    fact("Traces", health.health.retrievalTraces),
    fact("Leaks", health.health.privacyLeakCount),
    fact("Redactions", health.health.redactionCount),
    fact("Duplicates", health.duplicateClusters.length),
  );
}

function renderGraph(nodes) {
  graph.replaceChildren();
  const layout = buildGraphLayout(state.snapshot, nodes);
  graph.style.minHeight = `${layout.height}px`;
  graph.dataset.layoutMode = layout.mode;
  graph.dataset.layoutColumns = String(layout.columns);
  graph.dataset.layoutRows = String(layout.rows);
  graph.dataset.graphScope = state.graphScope;
  graph.dataset.visibleNodeCount = String(nodes.length);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", `0 0 100 ${layout.height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  for (const edge of layout.edges) {
    const from = layout.positionById.get(edge.from);
    const to = layout.positionById.get(edge.to);
    if (!from || !to) continue;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "edge");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    svg.append(line);
  }
  graph.append(svg);

  if (nodes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No fixture nodes match this search and filter.";
    graph.append(empty);
    return;
  }

  for (const node of nodes) {
    const point = layout.positionById.get(node.id);
    if (!point) continue;
    const button = document.createElement("button");
    button.className = `node${node.id === state.selectedId ? " selected" : ""}`;
    button.dataset.kind = node.kind;
    button.setAttribute("aria-label", `${node.kind.replaceAll("_", " ")}: ${node.title}`);
    button.style.left = `${point.x}%`;
    button.style.top = `${point.y}px`;
    button.innerHTML = [
      `<small>${escapeHtml(node.kind.replaceAll("_", " "))}</small>`,
      `<strong>${escapeHtml(node.title)}</strong>`,
      confidenceMarkup(node.confidence),
    ].join("");
    button.addEventListener("click", () => {
      state.selectedId = node.id;
      editStatus.textContent = "";
      render();
      centerSelectedNode();
    });
    graph.append(button);
  }
}

function renderGraphNavigation(filtered, nodes) {
  const navigation = buildGraphNavigation(state.snapshot, filtered, nodes, state.selectedId, state.graphScope);
  graphNavigationStatus.textContent = `${navigation.visibleNodeCount}/${navigation.filteredNodeCount} nodes | ${navigation.selectedNeighborCount} links`;
  graphNavigationStatus.dataset.mode = navigation.mode;
  graphNavigationStatus.dataset.scope = navigation.scope;
  graphNavigationStatus.dataset.visibleNodeCount = String(navigation.visibleNodeCount);
  graphNavigationStatus.dataset.filteredNodeCount = String(navigation.filteredNodeCount);
  graphNavigationStatus.dataset.neighborCount = String(navigation.selectedNeighborCount);
  graphNodeJump.replaceChildren(
    ...navigation.jumpOptions.map((option) => {
      const item = document.createElement("option");
      item.value = option.id;
      item.textContent = `${option.kind.replaceAll("_", " ")} | ${option.title}`;
      item.selected = option.id === state.selectedId;
      return item;
    }),
  );
  graphNodeJump.disabled = navigation.jumpOptions.length === 0;
  centerSelected.disabled = !navigation.selectedVisible;
  document.querySelectorAll("[data-graph-scope]").forEach((button) => {
    button.classList.toggle("active", button.dataset.graphScope === navigation.scope);
  });
}

function centerSelectedNode() {
  requestAnimationFrame(() => {
    const selected = graph.querySelector(".node.selected");
    if (!selected) return;
    selected.scrollIntoView({ block: "center", inline: "center" });
  });
}

function renderTimeline(nodes) {
  timelineList.replaceChildren();
  for (const node of [...nodes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const item = document.createElement("li");
    item.innerHTML = `<time>${escapeHtml(formatTime(node.createdAt))}</time><strong>${escapeHtml(node.kind.replaceAll("_", " "))}</strong><p>${escapeHtml(node.title)}</p>`;
    timelineList.append(item);
  }
}

function renderDetails(node) {
  if (!node) return;
  detailKind.textContent = node.kind.replaceAll("_", " ");
  detailTitle.textContent = node.title;
  detailFacts.replaceChildren(
    fact("Created", formatTime(node.createdAt)),
    fact("Updated", formatTime(node.updatedAt)),
    fact("Confidence", typeof node.confidence === "number" ? `${Math.round(node.confidence * 100)}%` : "not scored"),
    fact("Tags", (node.tags ?? []).join(", ") || "none"),
    fact("Edges", edgeSummary(node.id)),
  );
  renderProvenance(node);
  const body = state.edits[node.id] ?? node.metadata?.body ?? renderMetadata(node.metadata);
  docEditor.value = typeof body === "string" ? body : "";
  docEditor.disabled = !node.editable;
  saveEdit.disabled = !node.editable;
  resetEdit.disabled = !node.editable;
  if (!node.editable) editStatus.textContent = "This fixture node is inspect-only.";
}

function renderNucleusSnapshot() {
  const snapshot = buildNucleusExport(state.snapshot);
  snapshotSummary.replaceChildren(
    stat("Mode", "fixture"),
    stat("Nodes", snapshot.counts.nodes),
    stat("Edges", snapshot.counts.edges),
    stat("Editable", snapshot.counts.editable),
  );
  snapshotExport.textContent = JSON.stringify(snapshot, null, 2);
}

function hydratePolicyControls() {
  state.lifecyclePolicyDraft = buildLifecyclePolicyDraft(state.snapshot);
  policyForceRecall.checked = state.lifecyclePolicyDraft.recall.forceEveryTurn;
  policyPreCompress.checked = state.lifecyclePolicyDraft.writes.storePreCompressCheckpoints;
  policyMaxWrites.value = String(state.lifecyclePolicyDraft.writes.maxAutoWritesPerSession);
  policyLowConfidence.value = state.lifecyclePolicyDraft.writes.lowConfidenceAction;
  policyStatus.textContent = "Fixture policy loaded.";
}

function hydrateReviewQueue() {
  state.reviewQueueDraft = buildMemoryReviewQueue(state.snapshot);
  reviewQueueStatus.textContent = "Fixture review queue loaded.";
}

function renderResearchLineage() {
  const packet = buildResearchLineage(state.snapshot);
  researchLineage.replaceChildren();
  if (packet.trails.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No fixture research lineage nodes.";
    researchLineage.append(empty);
    return;
  }

  for (const trail of packet.trails) {
    const card = document.createElement("article");
    const title = document.createElement("h4");
    const meta = document.createElement("p");
    const list = document.createElement("ol");
    card.className = "lineage-card";
    title.textContent = trail.query.title;
    meta.textContent = `${packet.mode} | writesRealFiles: ${packet.writesRealFiles}`;
    appendLineageStep(list, "query", trail.query);
    for (const step of trail.steps) {
      appendLineageStep(list, step.edgeKind, step.node);
    }
    card.append(title, meta, list);
    researchLineage.append(card);
  }
}

function renderSessionCompactionAudit() {
  const packet = buildSessionCompactionAudit(state.sessionCompactionAudit);
  compactionAuditSummary.replaceChildren(
    stat("Mode", packet.metricsOnly ? "metrics-only" : "needs review"),
    stat("Events", packet.input.eventCount),
    stat("Candidates", packet.metrics.outputCandidates),
    stat("Leaks", packet.quality.privacyLeakCount),
    stat("Redactions", packet.metrics.redactionCount),
    stat("Noise skipped", packet.metrics.skippedNoise),
    stat("Chronological", packet.metrics.chronological ? "yes" : "no"),
    stat("Exact IDs", packet.quality.exactIdentifierCandidateCount),
  );

  compactionAuditFingerprints.replaceChildren();
  for (const candidate of packet.candidateFingerprints) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const value = document.createElement("span");
    const meta = document.createElement("small");
    item.dataset.kind = candidate.kind;
    label.textContent = candidate.kind;
    value.textContent = `${Math.round(candidate.salience * 100)}% salience, ${candidate.reasonCount} reasons`;
    meta.textContent = `${candidate.idHash} | ${formatTime(candidate.observedAt)} | ${candidate.sourceEventCount} source event${candidate.sourceEventCount === 1 ? "" : "s"}`;
    item.append(label, value, meta);
    compactionAuditFingerprints.append(item);
  }

  compactionAuditExport.textContent = JSON.stringify(packet, null, 2);
}

function renderBenchmarkDashboard() {
  const packet = buildBenchmarkDashboard(state.benchmarkSummary);
  benchmarkStatus.textContent = packet.verdict;
  benchmarkStatus.dataset.verdict = packet.verdict;
  benchmarkSummary.replaceChildren(
    stat("Scenarios", `${packet.aggregate.passedScenarios}/${packet.suite.scenarioCount}`),
    stat("Failures", packet.aggregate.failedScenarios),
    stat("Leaks", packet.aggregate.privacyLeakCount),
    stat("Exact IDs", `${Math.round(packet.aggregate.exactIdentifierAccuracy * 100)}%`),
    stat("Kind cov", `${Math.round(packet.aggregate.averageKindCoverage * 100)}%`),
    stat("Term cov", `${Math.round(packet.aggregate.averageRequiredTermCoverage * 100)}%`),
    stat("Noise", `${Math.round(packet.aggregate.averageNoiseReductionRatio * 100)}%`),
    stat("Candidates", packet.aggregate.totalOutputCandidates),
  );

  benchmarkScenarios.replaceChildren();
  for (const scenario of packet.scenarios) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    const small = document.createElement("small");
    item.dataset.status = scenario.passed ? "pass" : "fail";
    strong.textContent = scenario.passed ? "pass" : "fail";
    span.textContent = scenario.label;
    small.textContent = `${Math.round(scenario.exactIdentifierAccuracy * 100)}% exact IDs | ${Math.round(scenario.noiseReductionRatio * 100)}% noise reduction | ${scenario.outputCandidates} candidates`;
    item.append(strong, span, small);
    benchmarkScenarios.append(item);
  }

  benchmarkCaveats.replaceChildren();
  for (const caveat of packet.caveats) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = "caveat";
    span.textContent = caveat;
    item.append(strong, span);
    benchmarkCaveats.append(item);
  }

  benchmarkExport.textContent = JSON.stringify(packet, null, 2);
}

function renderPromptContextPreview() {
  const packet = buildPromptContextPreview(state.snapshot, state.promptContextPreview);
  contextPreviewSummary.replaceChildren(
    stat("Tokens", `${packet.totalTokens}/${packet.tokenBudget}`),
    stat("Remaining", packet.budgetRemaining),
    stat("Selected", packet.selectedMemories.length),
    stat("Leaks", packet.safety.privacyLeakCount),
  );

  contextPreviewMemories.replaceChildren();
  for (const memory of packet.selectedMemories) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const value = document.createElement("span");
    const meta = document.createElement("small");
    item.dataset.source = memory.source;
    label.textContent = memory.kind;
    value.textContent = memory.title;
    meta.textContent = `${memory.source} | ${Math.round(memory.rerankScore * 100)}% rerank | ${memory.tokens} tokens`;
    item.append(label, value, meta);
    contextPreviewMemories.append(item);
  }

  contextPreviewSections.replaceChildren();
  for (const section of packet.sections) {
    const article = document.createElement("article");
    const title = document.createElement("h4");
    const text = document.createElement("p");
    const meta = document.createElement("small");
    article.dataset.source = section.source;
    title.textContent = section.title;
    text.textContent = section.text;
    meta.textContent = `${section.source} | ${section.tokens} tokens | ${section.citationIds.length} citation${section.citationIds.length === 1 ? "" : "s"}`;
    article.append(title, text, meta);
    contextPreviewSections.append(article);
  }

  contextPreviewOmitted.replaceChildren();
  for (const candidate of packet.omittedCandidates) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const value = document.createElement("span");
    label.textContent = candidate.kind;
    value.textContent = `${candidate.reason} | ${candidate.tokens} tokens`;
    item.append(label, value);
    contextPreviewOmitted.append(item);
  }

  contextPreviewExport.textContent = JSON.stringify(packet, null, 2);
}

function renderReleaseReadiness() {
  const packet = buildReleaseReadinessConsole(state.releaseReadiness);
  releaseReadinessStatus.textContent = packet.publicLaunchVerdict;
  releaseReadinessStatus.dataset.verdict = packet.publicLaunchVerdict;
  releaseReadinessSummary.replaceChildren(
    stat("Verdict", packet.publicLaunchVerdict),
    stat("Prod ready", packet.productionReady ? "yes" : "no"),
    stat("Code CI", packet.latestVerifiedCodeBaseline.ciConclusion),
    stat("Blockers", packet.blockers.length),
    stat("Surfaces", packet.surfaces.length),
    stat("Leaks", packet.safetySummary.privacyLeakCount),
    stat("Fixture", packet.safetySummary.fixtureOnly ? "yes" : "no"),
    stat("Hosted writes", packet.safetySummary.hostedWriteBackDisabled ? "off" : "review"),
  );

  releaseReadinessSurfaces.replaceChildren();
  for (const surface of packet.surfaces) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = "surface";
    span.textContent = surface;
    item.append(strong, span);
    releaseReadinessSurfaces.append(item);
  }

  releaseReadinessBlockers.replaceChildren();
  for (const blocker of packet.blockers) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = "blocker";
    span.textContent = blocker;
    item.append(strong, span);
    releaseReadinessBlockers.append(item);
  }

  releaseReadinessActions.replaceChildren();
  for (const action of packet.manualActions) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = "manual";
    span.textContent = action;
    item.append(strong, span);
    releaseReadinessActions.append(item);
  }

  releaseReadinessExport.textContent = JSON.stringify(packet, null, 2);
}

function renderLifecyclePolicy() {
  const draft = state.lifecyclePolicyDraft ?? buildLifecyclePolicyDraft(state.snapshot);
  const hermesEnabled = Object.values(draft.lifecycle.hermes ?? {}).filter((value) => value === "enabled").length;
  const openclawEnabled = Object.values(draft.lifecycle.openclaw ?? {}).filter((value) => value === "enabled").length;
  policySummary.replaceChildren(
    stat("Recall", draft.recall.forceEveryTurn ? "every turn" : draft.recall.defaultMode),
    stat("Rerank K", draft.recall.rerankCandidateLimit),
    stat("Writes", draft.writes.maxAutoWritesPerSession),
    stat("Changes", draft.changedFields.length),
  );
  policyDraft.textContent = JSON.stringify(
    {
      ...draft,
      lifecycleSummary: {
        hermesEnabled,
        openclawEnabled,
      },
    },
    null,
    2,
  );
}

function renderLifecyclePolicyApply() {
  policyApplySummary.replaceChildren();
  policyApplyActions.replaceChildren();
  const payload = state.lifecyclePolicyApply;
  if (!payload) {
    policyApplyStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    policyApplyStatus.textContent = payload.message ?? payload.code ?? "Lifecycle policy apply unavailable.";
    return;
  }

  policyApplyStatus.textContent = `${payload.selection.rootDisplay} lifecycle policy applied.`;
  policyApplySummary.replaceChildren(
    stat("Writes", payload.writesRealFiles ? "enabled" : "disabled"),
    stat("Changed", payload.report?.summary?.changedFields ?? 0),
    stat("Pre-compress", payload.report?.summary?.storePreCompressCheckpoints ? "on" : "off"),
    stat("Audit", payload.report?.auditLog?.entriesWritten ?? 0),
  );
  for (const [label, value] of [
    ["Policy", payload.report?.policyPath],
    ["Audit", payload.report?.auditLog?.path],
    ["Trail", payload.auditTrail?.event],
  ]) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = label;
    span.textContent = value ?? "";
    item.append(strong, span);
    policyApplyActions.append(item);
  }
}

function renderReviewQueue() {
  const draft = state.reviewQueueDraft ?? buildMemoryReviewQueue(state.snapshot);
  reviewQueueSummary.replaceChildren(
    stat("Candidates", draft.summary.candidates),
    stat("Approve", draft.summary.approve),
    stat("Suppress", draft.summary.suppress),
    stat("Changed", draft.summary.changed),
  );
  reviewQueueItems.replaceChildren();
  for (const candidate of draft.items) {
    const article = document.createElement("article");
    const title = document.createElement("h4");
    const text = document.createElement("p");
    const meta = document.createElement("small");
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    const select = document.createElement("select");
    const selectId = `review-${candidate.id.replaceAll(/[^a-z0-9_-]/gi, "-")}`;
    article.className = "review-candidate";
    article.dataset.reason = candidate.reason;
    title.textContent = `${candidate.kind}: ${candidate.reason.replaceAll("_", " ")}`;
    text.textContent = candidate.text;
    meta.textContent = `${Math.round(candidate.confidence * 100)}% confidence | source ${candidate.sourceNodeId}`;
    labelText.textContent = "Decision";
    label.htmlFor = selectId;
    select.id = selectId;
    select.name = selectId;
    select.dataset.reviewAction = candidate.id;
    for (const action of ["approve", "suppress", "merge", "needs_more_evidence"]) {
      const option = document.createElement("option");
      option.value = action;
      option.textContent = action.replaceAll("_", " ");
      option.selected = action === candidate.action;
      select.append(option);
    }
    label.append(labelText, select);
    article.append(title, text, meta, label);
    reviewQueueItems.append(article);
  }
  reviewQueueDraft.textContent = JSON.stringify(draft, null, 2);
}

function renderReviewQueueApply() {
  reviewQueueApplySummary.replaceChildren();
  reviewQueueApplyActions.replaceChildren();
  const payload = state.reviewQueueApply;
  if (!payload) {
    reviewQueueApplyStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    reviewQueueApplyStatus.textContent = payload.message ?? payload.code ?? "Review queue apply unavailable.";
    return;
  }

  reviewQueueApplyStatus.textContent = `${payload.selection.rootDisplay} review decisions applied.`;
  reviewQueueApplySummary.replaceChildren(
    stat("Writes", payload.writesRealFiles ? "enabled" : "disabled"),
    stat("Decisions", payload.report?.summary?.decisions ?? 0),
    stat("Suppress", payload.report?.summary?.suppress ?? 0),
    stat("Audit", payload.report?.auditLog?.entriesWritten ?? 0),
  );
  for (const [label, value] of [
    ["Decisions", payload.report?.decisionsPath],
    ["Audit", payload.report?.auditLog?.path],
    ["Trail", payload.auditTrail?.event],
  ]) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = label;
    span.textContent = value ?? "";
    item.append(strong, span);
    reviewQueueApplyActions.append(item);
  }
}

function appendLineageStep(list, label, node) {
  const item = document.createElement("li");
  const strong = document.createElement("strong");
  const span = document.createElement("span");
  strong.textContent = `${label}: ${node.kind}`;
  span.textContent = node.title;
  item.append(strong, span);
  list.append(item);
}

function renderEditExport() {
  const draft = buildEditExport(state.snapshot, state.edits);
  if (draft.edits.length === 0) {
    exportStatus.textContent = "No saved fixture edits.";
    editExport.textContent = "";
    return;
  }
  exportStatus.textContent = `${draft.edits.length} saved fixture edit${draft.edits.length === 1 ? "" : "s"}.`;
  editExport.textContent = JSON.stringify(draft, null, 2);
}

function renderVaultControls(node) {
  if (!state.vault?.ok) {
    vaultStatus.textContent = "Vault fixture unavailable.";
    vaultPreview.textContent = "";
    vaultFileSelect.replaceChildren();
    vaultFileSelect.disabled = true;
    return;
  }

  const files = state.vault.vault.files;
  const preferred = preferredVaultPath(state.vault?.vault, node);
  const nextPath = files.some((file) => file.path === state.selectedVaultPath) ? state.selectedVaultPath : preferred;
  state.selectedVaultPath = nextPath;
  vaultFileSelect.replaceChildren(
    ...files.map((file) => {
      const option = document.createElement("option");
      option.value = file.path;
      option.textContent = `${file.kind}: ${file.path}`;
      option.selected = file.path === nextPath;
      return option;
    }),
  );
  vaultFileSelect.disabled = files.length === 0;
  renderVaultPreview();
}

function renderVaultPreview() {
  const files = state.vault?.vault?.files ?? [];
  const selected = files.find((file) => file.path === state.selectedVaultPath) ?? files[0];
  if (!selected) {
    vaultStatus.textContent = "No compiled vault files.";
    vaultPreview.textContent = "";
    return;
  }
  const lintCount = state.vault?.lint?.length ?? 0;
  vaultStatus.textContent = `${files.length} files compiled. ${lintCount === 0 ? "Lint clean." : `${lintCount} lint issues.`}`;
  vaultPreview.textContent = selected.contents;
}

function renderSyncReport() {
  syncSummary.replaceChildren();
  syncActions.replaceChildren();
  const report = state.syncReport?.report;
  if (!report) {
    syncSummary.textContent = "Fixture sync report unavailable.";
    return;
  }

  const summary = report.summary ?? {};
  syncSummary.replaceChildren(
    stat("Dry run", report.dryRun ? "yes" : "no"),
    stat("Writes", summary.write ?? 0),
    stat("Conflicts", summary.write_conflict_note ?? 0),
    stat("Unchanged", summary.skip_unchanged ?? 0),
  );

  const prioritized = [...(report.actions ?? [])].sort((a, b) => actionRank(a.action) - actionRank(b.action)).slice(0, 8);
  for (const action of prioritized) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const path = document.createElement("span");
    item.dataset.action = action.action;
    label.textContent = action.action.replaceAll("_", " ");
    path.textContent = action.path;
    item.append(label, path);
    if (action.conflictPath) {
      const conflict = document.createElement("small");
      conflict.textContent = action.conflictPath;
      item.append(conflict);
    }
    syncActions.append(item);
  }
}

function renderSelectedSync() {
  selectedSyncSummary.replaceChildren();
  selectedSyncActions.replaceChildren();
  const payload = state.selectedSync;
  if (!payload) {
    selectedSyncStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    selectedSyncStatus.textContent = payload.message ?? payload.code ?? "Selected vault sync unavailable.";
    return;
  }

  const summary = payload.report?.summary ?? {};
  selectedSyncStatus.textContent = `${payload.selection.rootDisplay} previewed read-only.`;
  selectedSyncSummary.replaceChildren(
    stat("Dry run", payload.report?.dryRun ? "yes" : "no"),
    stat("Writes", summary.write ?? 0),
    stat("Conflicts", summary.write_conflict_note ?? 0),
    stat("Unchanged", summary.skip_unchanged ?? 0),
  );

  const actions = [...(payload.report?.actions ?? [])].sort((a, b) => actionRank(a.action) - actionRank(b.action)).slice(0, 8);
  for (const action of actions) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const path = document.createElement("span");
    item.dataset.action = action.action;
    label.textContent = action.action.replaceAll("_", " ");
    path.textContent = action.path;
    item.append(label, path);
    if (action.conflictPath) {
      const conflict = document.createElement("small");
      conflict.textContent = action.conflictPath;
      item.append(conflict);
    }
    selectedSyncActions.append(item);
  }
}

function renderSelectedSyncApply() {
  selectedSyncApplySummary.replaceChildren();
  selectedSyncApplyActions.replaceChildren();
  const payload = state.selectedSyncApply;
  if (!payload) {
    selectedSyncApplyStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    selectedSyncApplyStatus.textContent = payload.message ?? payload.code ?? "Selected vault apply unavailable.";
    return;
  }

  const summary = payload.report?.summary ?? {};
  selectedSyncApplyStatus.textContent = `${payload.selection.rootDisplay} applied with audit log.`;
  selectedSyncApplySummary.replaceChildren(
    stat("Dry run", payload.report?.dryRun ? "yes" : "no"),
    stat("Writes", summary.write ?? 0),
    stat("Conflicts", summary.write_conflict_note ?? 0),
    stat("Audit entries", payload.report?.auditLog?.entriesWritten ?? 0),
  );

  const actions = [...(payload.report?.actions ?? [])].sort((a, b) => actionRank(a.action) - actionRank(b.action)).slice(0, 8);
  for (const action of actions) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const path = document.createElement("span");
    item.dataset.action = action.action;
    label.textContent = action.action.replaceAll("_", " ");
    path.textContent = action.path;
    item.append(label, path);
    if (action.conflictPath) {
      const conflict = document.createElement("small");
      conflict.textContent = action.conflictPath;
      item.append(conflict);
    }
    selectedSyncApplyActions.append(item);
  }
}

function renderLocalAudit() {
  localAuditSummary.replaceChildren();
  localAuditFiles.replaceChildren();
  localAuditReasons.replaceChildren();
  const report = state.localAudit?.report;
  if (!report) {
    localAuditSummary.textContent = "Fixture audit unavailable.";
    return;
  }

  localAuditSummary.replaceChildren(
    stat("Status", report.health.status),
    stat("Files", report.totals.existingFiles),
    stat("Lines", report.totals.lines),
    stat("Redactions", report.totals.redactionCount),
  );

  for (const file of report.files) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const value = document.createElement("span");
    item.dataset.reason = file.skippedReason ?? "inspected";
    label.textContent = file.name;
    value.textContent = file.skippedReason
      ? file.skippedReason.replaceAll("_", " ")
      : `${file.lineCount ?? 0} lines, ${file.redactionCount ?? 0} redactions`;
    item.append(label, value);
    localAuditFiles.append(item);
  }

  for (const reason of report.health.reasons) {
    const item = document.createElement("li");
    item.textContent = reason.replaceAll("_", " ");
    localAuditReasons.append(item);
  }
}

function renderLocalBrowse() {
  localBrowseSummary.replaceChildren();
  localBrowseItems.replaceChildren();
  const report = state.localBrowse?.report;
  if (!report) {
    localBrowseSummary.textContent = "Fixture browse unavailable.";
    return;
  }

  localBrowseSummary.replaceChildren(
    stat("Browse mode", "fixture"),
    stat("Items", report.totals.itemsReturned),
    stat("Lines", report.totals.linesInspected),
    stat("Redactions", report.totals.redactionCount),
  );
  renderBrowseItems(localBrowseItems, report.items);
}

function renderSelectedBrowse() {
  selectedBrowseSummary.replaceChildren();
  selectedBrowseItems.replaceChildren();
  const payload = state.selectedBrowse;
  if (!payload) {
    selectedBrowseStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    selectedBrowseStatus.textContent = payload.message ?? payload.code ?? "Local browse unavailable.";
    return;
  }

  selectedBrowseStatus.textContent = `${payload.selection.rootDisplay} browsed read-only.`;
  selectedBrowseSummary.replaceChildren(
    stat("Items", payload.report.totals.itemsReturned),
    stat("Files", payload.report.totals.filesInspected),
    stat("Skipped private", payload.report.totals.skippedPrivate),
    stat("Redactions", payload.report.totals.redactionCount),
    stat("Writes", payload.writesRealFiles ? "enabled" : "disabled"),
  );
  renderBrowseItems(selectedBrowseItems, payload.report.items);
}

function renderLocalEdit() {
  localEditSummary.replaceChildren();
  localEditActions.replaceChildren();
  const payload = state.localEdit;
  if (!payload) {
    localEditStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    localEditStatus.textContent = payload.message ?? payload.code ?? "Local memory edit unavailable.";
    return;
  }

  const summary = payload.report?.summary ?? {};
  localEditStatus.textContent = `${payload.selection.rootDisplay} edit overlay applied.`;
  localEditSummary.replaceChildren(
    stat("Action", summary.action ?? "unknown"),
    stat("Source", `${summary.sourceFile ?? "memories.jsonl"}:${summary.line ?? 1}`),
    stat("Bytes", summary.replacementBytes ?? 0),
    stat("Audit entries", payload.report?.auditLog?.entriesWritten ?? 0),
  );

  const entries = [
    ["Trail", payload.auditTrail?.event ?? "local_memory_edit_overlay"],
    ["Edit log", payload.report?.editsPath ?? ".recallweave/local-memory-edits.jsonl"],
    ["Audit log", payload.report?.auditLog?.path ?? ".recallweave/local-memory-edit-audit.jsonl"],
    ["Hash", payload.auditTrail?.contentHash ?? "unknown"],
  ];
  for (const [label, value] of entries) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = label;
    span.textContent = String(value);
    item.append(strong, span);
    localEditActions.append(item);
  }
}

function renderLocalMaterialize() {
  localMaterializeSummary.replaceChildren();
  localMaterializeActions.replaceChildren();
  const payload = state.localMaterialize;
  if (!payload) {
    localMaterializeStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    localMaterializeStatus.textContent = payload.message ?? payload.code ?? "Local memory materialize unavailable.";
    return;
  }

  localMaterializeStatus.textContent = `${payload.selection.rootDisplay} materialized with backup.`;
  localMaterializeSummary.replaceChildren(
    stat("Applied", payload.report?.totals?.applied ?? 0),
    stat("Replaced", payload.report?.totals?.replaced ?? 0),
    stat("Appended", payload.report?.totals?.appended ?? 0),
    stat("Skipped", payload.report?.totals?.skipped ?? 0),
    stat("Audit entries", payload.report?.auditLog?.entriesWritten ?? 0),
  );

  const entries = [
    ["Trail", payload.auditTrail?.event ?? "local_memory_materialize"],
    ["Backup", payload.report?.backup?.path ?? "not-written"],
    ["Audit log", payload.report?.auditLog?.path ?? ".recallweave/local-memory-materialize-audit.jsonl"],
    ["Overlay log", payload.report?.editOverlay?.path ?? ".recallweave/local-memory-edits.jsonl"],
  ];
  for (const [label, value] of entries) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = label;
    span.textContent = String(value);
    item.append(strong, span);
    localMaterializeActions.append(item);
  }
}

function renderBrowseItems(target, items) {
  for (const entry of items ?? []) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const value = document.createElement("span");
    const meta = document.createElement("small");
    item.dataset.kind = entry.kind;
    label.textContent = entry.kind;
    value.textContent = entry.summary;
    meta.textContent = `${entry.sourceFile}:${entry.line}${entry.event ? ` | ${entry.event}` : ""}`;
    item.append(label, value, meta);
    for (const overlay of entry.overlays ?? []) {
      const note = document.createElement("small");
      note.dataset.overlay = overlay.action;
      note.textContent = `overlay: ${overlay.action.replaceAll("_", " ")} | ${overlay.reason.replaceAll("_", " ")}${
        overlay.replacementPreview ? ` | ${overlay.replacementPreview}` : ""
      }`;
      item.append(note);
    }
    target.append(item);
  }
}

function renderSelectedAudit() {
  selectedAuditSummary.replaceChildren();
  selectedAuditMeta.replaceChildren();
  const payload = state.selectedAudit;
  if (!payload) {
    selectedAuditStatus.textContent = "";
    return;
  }

  if (!payload.ok) {
    selectedAuditStatus.textContent = payload.message ?? payload.code ?? "Local audit unavailable.";
    return;
  }

  selectedAuditStatus.textContent = `${payload.selection.rootDisplay} audited read-only.`;
  selectedAuditSummary.replaceChildren(
    stat("Status", payload.report.health.status),
    stat("Files", payload.report.totals.existingFiles),
    stat("Lines", payload.report.totals.lines),
    stat("Redactions", payload.report.totals.redactionCount),
  );

  const entries = [
    ["Root", payload.selection.rootDisplay],
    ["Writes", payload.writesRealFiles ? "enabled" : "disabled"],
    ["Trail", payload.auditTrail.event],
  ];
  for (const [label, value] of entries) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = label;
    span.textContent = String(value);
    item.append(strong, span);
    selectedAuditMeta.append(item);
  }
}

function renderSelectedAuditHistory() {
  selectedAuditHistory.replaceChildren();
  for (const entry of state.selectedAuditHistory) {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    const small = document.createElement("small");
    strong.textContent = `${entry.status} | ${entry.rootDisplay}`;
    span.textContent = `${entry.existingFiles} files, ${entry.lines} lines, ${entry.redactionCount} redactions`;
    small.textContent = `${entry.event} | ${formatTime(entry.capturedAt)}`;
    item.append(strong, span, small);
    selectedAuditHistory.append(item);
  }
}

function stat(label, value) {
  const item = document.createElement("div");
  const strong = document.createElement("strong");
  const span = document.createElement("span");
  strong.textContent = String(value);
  span.textContent = label;
  item.append(strong, span);
  return item;
}

function actionRank(action) {
  const ranks = {
    write_conflict_note: 0,
    skip_reviewed: 1,
    write: 2,
    skip_unchanged: 3,
  };
  return ranks[action] ?? 9;
}

function renderProvenance(node) {
  provenance.replaceChildren();
  const refs = node.provenance ?? [];
  if (refs.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No source quote attached to this fixture node.";
    provenance.append(empty);
    return;
  }
  for (const ref of refs) {
    const item = document.createElement("p");
    item.textContent = `${ref.sourceId}: ${ref.quote ?? "source reference"}`;
    provenance.append(item);
  }
}

function currentSelected(nodes) {
  if (nodes.some((node) => node.id === state.selectedId)) {
    return nodes.find((node) => node.id === state.selectedId);
  }
  const next = nodes[0] ?? state.snapshot.nodes[0];
  state.selectedId = next?.id ?? null;
  return next;
}

function filteredNodes() {
  return selectFilteredNodes(state.snapshot, state.filter, state.query);
}

function fact(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  const fragment = document.createDocumentFragment();
  fragment.append(dt, dd);
  return fragment;
}

function edgeSummary(id) {
  return state.snapshot.edges
    .filter((edge) => edge.from === id || edge.to === id)
    .map((edge) => `${edge.kind}: ${edge.from === id ? edge.to : edge.from}`)
    .join(" | ") || "none";
}

function renderMetadata(metadata) {
  if (!metadata) return "";
  return JSON.stringify(metadata, null, 2);
}

function confidenceMarkup(confidence) {
  if (typeof confidence !== "number") return "";
  return `<span class="confidence">${Math.round(confidence * 100)}% confidence</span>`;
}

function readEdits() {
  try {
    const parsed = JSON.parse(localStorage.getItem("recallweave.fixture.edits") ?? "{}");
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "string" && !containsPrivateLikeText(value)),
    );
  } catch {
    return {};
  }
}

function readSelectedAuditHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(selectedAuditHistoryKey) ?? "[]");
    return Array.isArray(parsed) ? mergeSelectedAuditTrail(parsed, null) : [];
  } catch {
    return [];
  }
}

function scrollHashTargetIntoPanel() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;
  const panel = document.querySelector(".detail-panel");
  const target = document.getElementById(hash);
  if (!panel || !target || !panel.contains(target)) return;
  requestAnimationFrame(() => {
    panel.scrollTop = Math.max(0, target.offsetTop - 28);
  });
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(11, 16);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export {
  buildContainerHealth,
  buildEditExport,
  buildLifecyclePolicyDraft,
  buildMemoryReviewQueue,
  buildNucleusExport,
  buildResearchLineage,
  renderGraph,
};
