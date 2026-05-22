import {
  buildContainerHealth,
  buildEditExport,
  buildNucleusExport,
  buildResearchLineage,
  containsPrivateLikeText,
  filteredNodes as selectFilteredNodes,
  preferredVaultPath,
} from "./model.js";

const state = {
  snapshot: null,
  filter: "all",
  query: "",
  selectedId: null,
  edits: readEdits(),
  vault: null,
  syncReport: null,
  selectedVaultPath: "",
};

const positions = {
  "wiki:index": [50, 15],
  "memory:hybrid-recall": [27, 34],
  "trace:context-001": [52, 39],
  "event:hermes-pre-compress": [76, 32],
  "doc:native-memory-plan": [53, 64],
  "research:gbrain-query": [22, 70],
  "hypothesis:research-lineage": [36, 84],
  "decision:ui-fixture-first": [68, 84],
  "source:fixture-design-note": [78, 62],
};

const searchInput = document.querySelector("#searchInput");
const graph = document.querySelector("#graph");
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
const vaultFileSelect = document.querySelector("#vaultFileSelect");
const vaultStatus = document.querySelector("#vaultStatus");
const vaultPreview = document.querySelector("#vaultPreview");
const syncSummary = document.querySelector("#syncSummary");
const syncActions = document.querySelector("#syncActions");
const docEditor = document.querySelector("#docEditor");
const saveEdit = document.querySelector("#saveEdit");
const resetEdit = document.querySelector("#resetEdit");
const editStatus = document.querySelector("#editStatus");
const exportStatus = document.querySelector("#exportStatus");
const editExport = document.querySelector("#editExport");
const timelineList = document.querySelector("#timelineList");

const [response, vaultResponse, syncResponse] = await Promise.all([
  fetch("/fixtures/nucleus.fixture.json"),
  fetch("/fixtures/wiki-vault.json"),
  fetch("/fixtures/wiki-sync-report.json"),
]);
state.snapshot = await response.json();
state.vault = await vaultResponse.json();
state.syncReport = await syncResponse.json();
state.query = searchInput.value;
state.selectedId = state.snapshot.nodes[0]?.id ?? null;
state.selectedVaultPath = preferredVaultPath(state.vault?.vault);

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

function render() {
  const nodes = filteredNodes();
  const selected = currentSelected(nodes);
  renderMetrics();
  renderContainerHealth();
  renderGraph(nodes);
  renderTimeline(nodes);
  renderDetails(selected);
  renderNucleusSnapshot();
  renderResearchLineage();
  renderVaultControls(selected);
  renderSyncReport();
  renderEditExport();
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
  const visible = new Set(nodes.map((node) => node.id));
  const edges = state.snapshot.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  for (const edge of edges) {
    const from = position(edge.from);
    const to = position(edge.to);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "edge");
    line.setAttribute("x1", `${from[0]}%`);
    line.setAttribute("y1", `${from[1]}%`);
    line.setAttribute("x2", `${to[0]}%`);
    line.setAttribute("y2", `${to[1]}%`);
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
    const button = document.createElement("button");
    button.className = `node${node.id === state.selectedId ? " selected" : ""}`;
    button.dataset.kind = node.kind;
    button.setAttribute("aria-label", `${node.kind.replaceAll("_", " ")}: ${node.title}`);
    button.style.left = `${position(node.id)[0]}%`;
    button.style.top = `${position(node.id)[1]}%`;
    button.innerHTML = [
      `<small>${escapeHtml(node.kind.replaceAll("_", " "))}</small>`,
      `<strong>${escapeHtml(node.title)}</strong>`,
      confidenceMarkup(node.confidence),
    ].join("");
    button.addEventListener("click", () => {
      state.selectedId = node.id;
      editStatus.textContent = "";
      render();
    });
    graph.append(button);
  }
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

function position(id) {
  return positions[id] ?? [50, 50];
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

function formatTime(value) {
  return new Date(value).toISOString().slice(11, 16);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export { buildContainerHealth, buildEditExport, buildNucleusExport, buildResearchLineage, renderGraph };
