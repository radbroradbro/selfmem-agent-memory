import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildContainerHealth,
  buildEditExport,
  buildNucleusExport,
  buildResearchLineage,
  containsPrivateLikeText,
  filteredNodes,
  preferredVaultPath,
} from "./src/model.js";
import { createBrainUiServer } from "./server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(join(here, "fixtures/nucleus.fixture.json"), "utf8"));
const server = createBrainUiServer();

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const [vault, syncReport] = await Promise.all([
    json(`${base}/fixtures/wiki-vault.json`),
    json(`${base}/fixtures/wiki-sync-report.json`),
  ]);

  const nativeMemoryMatches = filteredNodes(fixture, "all", "native memory");
  assert.ok(nativeMemoryMatches.some((node) => node.kind === "derived_doc"), "native memory search should find derived docs");
  assert.ok(
    nativeMemoryMatches.some((node) => node.kind === "retrieval_trace"),
    "native memory search should expose retrieval trace nodes",
  );

  const retrievalTrace = fixture.nodes.find((node) => node.kind === "retrieval_trace");
  const editableNodes = fixture.nodes.filter((node) => node.editable === true);
  const editableNode = editableNodes.at(-1);
  assert.ok(retrievalTrace, "fixture must include a retrieval trace");
  assert.ok(editableNode, "fixture must include an editable node");

  const containerHealth = buildContainerHealth(fixture);
  assert.equal(containerHealth.mode, "fixture-container-health");
  assert.equal(containerHealth.writesRealFiles, false);
  assert.equal(containerHealth.writeMode, "local-only");
  assert.equal(containerHealth.health.status, "healthy-fixture");
  assert.equal(containerHealth.health.privacyLeakCount, 0);
  assert.ok(containerHealth.health.retrievalTraces >= 1);
  assert.ok(containerHealth.countsByKind.memory >= 1);

  const privateCandidate = `<private>fixture secret</private> ${"pa-" + "x".repeat(24)}`;
  assert.equal(containsPrivateLikeText(privateCandidate), true, "private/key-shaped edit should be rejected by UI guard");

  const edits = {
    [editableNode.id]: "Keep native memory docs editable through a dry-run draft export.",
    [retrievalTrace.id]: "This inspect-only node must not appear in the edit export.",
    [fixture.nodes[0].id]: privateCandidate,
  };
  const editExport = buildEditExport(fixture, edits);
  assert.equal(editExport.mode, "fixture-draft");
  assert.equal(editExport.writesRealFiles, false);
  assert.ok(editExport.edits.some((edit) => edit.nodeId === editableNode.id), "saved fixture edit should export");
  assert.ok(
    editExport.edits.some((edit) => edit.contents.includes("Keep native memory docs editable")),
    "saved fixture edit contents should survive export",
  );
  assert.ok(!editExport.edits.some((edit) => edit.nodeId === retrievalTrace.id), "inspect-only edit should be ignored");
  const unsafeExport = buildEditExport(fixture, { [editableNode.id]: privateCandidate });
  assert.match(unsafeExport.edits[0]?.contents ?? "", /\[REDACTED_PRIVATE\]/);

  const nucleusExport = buildNucleusExport(fixture);
  assert.equal(nucleusExport.mode, "fixture-nucleus-snapshot");
  assert.equal(nucleusExport.writesRealFiles, false);
  assert.ok(nucleusExport.counts.nodes >= 8);
  assert.ok(nucleusExport.counts.edges >= 8);
  assert.ok(nucleusExport.counts.kinds.retrieval_trace >= 1);

  const lineage = buildResearchLineage(fixture);
  assert.equal(lineage.mode, "fixture-research-lineage");
  assert.equal(lineage.writesRealFiles, false);
  assert.ok(lineage.trails.length >= 1);
  const lineageKinds = new Set(
    lineage.trails.flatMap((trail) => [trail.query.kind, ...trail.steps.map((step) => step.node.kind)]),
  );
  assert.ok(lineageKinds.has("research_query"));
  assert.ok(lineageKinds.has("hypothesis"));
  assert.ok(lineageKinds.has("decision"));

  assert.equal(vault.ok, true);
  assert.equal(vault.lint.length, 0);
  assert.ok(vault.vault.files.some((file) => file.path === "wiki/index.md"));
  const directVaultPath = preferredVaultPath(vault.vault, editableNode);
  assert.ok(vault.vault.files.some((file) => file.path === directVaultPath), "editable node should map to a vault file");
  assert.ok(preferredVaultPath(vault.vault).includes("wiki/index.md"), "vault fallback should prefer the index page");

  assert.equal(syncReport.ok, true);
  assert.equal(syncReport.report.dryRun, true);
  assert.ok(syncReport.report.summary.write_conflict_note >= 1);
  assert.ok(syncReport.report.actions.some((action) => action.action === "write_conflict_note" && action.conflictPath));

  const serialized = JSON.stringify({ containerHealth, editExport, unsafeExport, nucleusExport, lineage, vault, syncReport });
  assert.equal(containsPrivateLikeText(serialized), false, "serialized interaction outputs must stay public-safe");

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          "search-filter",
          "retrieval-trace",
          "editable-node",
          "container-health",
          "private-edit-guard",
          "draft-export",
          "nucleus-export",
          "research-lineage",
          "vault-path",
          "sync-report",
          "public-safe-serialization",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}

async function json(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return response.json();
}
