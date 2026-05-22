const state = {
  snapshot: null,
  filter: "all",
  query: "",
  selectedId: null,
  edits: readEdits(),
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
const detailKind = document.querySelector("#detailKind");
const detailTitle = document.querySelector("#detailTitle");
const detailFacts = document.querySelector("#detailFacts");
const provenance = document.querySelector("#provenance");
const docEditor = document.querySelector("#docEditor");
const saveEdit = document.querySelector("#saveEdit");
const resetEdit = document.querySelector("#resetEdit");
const editStatus = document.querySelector("#editStatus");
const timelineList = document.querySelector("#timelineList");

const response = await fetch("/fixtures/nucleus.fixture.json");
state.snapshot = await response.json();
state.query = searchInput.value;
state.selectedId = state.snapshot.nodes[0]?.id ?? null;

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

function render() {
  const nodes = filteredNodes();
  const selected = currentSelected(nodes);
  renderMetrics();
  renderGraph(nodes);
  renderTimeline(nodes);
  renderDetails(selected);
}

function renderMetrics() {
  nodeCount.textContent = String(state.snapshot.nodes.length);
  edgeCount.textContent = String(state.snapshot.edges.length);
  editableCount.textContent = String(state.snapshot.nodes.filter((node) => node.editable).length);
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
  const query = state.query.trim().toLowerCase();
  return state.snapshot.nodes.filter((node) => {
    const matchesKind = state.filter === "all" || node.kind === state.filter;
    const haystack = JSON.stringify(node).toLowerCase();
    const matchesQuery = query.length === 0 || query.split(/\s+/).every((token) => haystack.includes(token));
    return matchesKind && matchesQuery;
  });
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
    return JSON.parse(localStorage.getItem("recallweave.fixture.edits") ?? "{}");
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

export { renderGraph };
