import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildContainerHealth,
  buildEditExport,
  buildLifecyclePolicyDraft,
  buildMemoryReviewQueue,
  buildNucleusExport,
  buildResearchLineage,
  containsPrivateLikeText,
  filteredNodes,
  mergeSelectedAuditTrail,
  preferredVaultPath,
} from "./src/model.js";
import { createBrainUiServer } from "./server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(join(here, "fixtures/nucleus.fixture.json"), "utf8"));
const selectedRoot = await mkdtemp(join(tmpdir(), "recallweave-selected-local-audit-"));
const selectedSyncRoot = await mkdtemp(join(tmpdir(), "recallweave-selected-wiki-sync-"));
const server = createBrainUiServer({ enableLocalAudit: true, enableLocalApply: true });

await writeFile(join(selectedRoot, "memories.jsonl"), "{\"kind\":\"decision\",\"text\":\"selected local writes only\"}\n", "utf8");
await writeFile(join(selectedRoot, "trace.jsonl"), "{\"event\":\"search\",\"count\":3}\n", "utf8");
await mkdir(join(selectedSyncRoot, "wiki/pages"), { recursive: true });
await writeFile(
  join(selectedSyncRoot, "wiki/pages/recallweave-index-90439aeb.md"),
  "---\ntitle: \"RecallWeave Index\"\nreviewed: true\n---\n\nHuman-reviewed local vault page remains untouched.\n",
  "utf8",
);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const [vault, syncReport] = await Promise.all([
    json(`${base}/fixtures/wiki-vault.json`),
    json(`${base}/fixtures/wiki-sync-report.json`),
  ]);
  const localAudit = await json(`${base}/fixtures/local-container-audit.json`);

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

  const policyDraft = buildLifecyclePolicyDraft(fixture, {
    forceEveryTurn: true,
    storePreCompressCheckpoints: true,
    maxAutoWritesPerSession: 12,
    lowConfidenceAction: "suppress",
  });
  assert.equal(policyDraft.mode, "fixture-lifecycle-policy-draft");
  assert.equal(policyDraft.writesRealFiles, false);
  assert.equal(policyDraft.recall.forceEveryTurn, true);
  assert.equal(policyDraft.writes.maxAutoWritesPerSession, 12);
  assert.equal(policyDraft.writes.lowConfidenceAction, "suppress");
  assert.ok(policyDraft.changedFields.some((change) => change.field === "recall.forceEveryTurn"));
  assert.ok(policyDraft.changedFields.some((change) => change.field === "writes.lowConfidenceAction"));
  const clampedPolicyDraft = buildLifecyclePolicyDraft(fixture, {
    maxAutoWritesPerSession: 9000,
    rerankCandidateLimit: 9000,
    rerankTokenBudget: "not-a-number",
    lowConfidenceAction: `unsafe ${"sm_" + "C".repeat(42)}`,
  });
  assert.equal(clampedPolicyDraft.writes.maxAutoWritesPerSession, 200);
  assert.equal(clampedPolicyDraft.recall.rerankCandidateLimit, 200);
  assert.equal(clampedPolicyDraft.recall.rerankTokenBudget, 6400);
  assert.equal(clampedPolicyDraft.writes.lowConfidenceAction, "review_queue");

  const reviewQueue = buildMemoryReviewQueue(fixture, {
    "candidate:maintenance-noise": "suppress",
    "candidate:duplicate-recallweave-decision": "merge",
    "candidate:high-value-policy": "approve",
  });
  assert.equal(reviewQueue.mode, "fixture-memory-review-queue");
  assert.equal(reviewQueue.writesRealFiles, false);
  assert.equal(reviewQueue.summary.candidates, 3);
  assert.equal(reviewQueue.summary.suppress, 1);
  assert.equal(reviewQueue.summary.merge, 1);
  assert.equal(reviewQueue.summary.approve, 1);
  assert.equal(reviewQueue.summary.changed, 0);
  assert.ok(reviewQueue.items.some((item) => item.reason === "maintenance_noise" && item.action === "suppress"));
  const changedReviewQueue = buildMemoryReviewQueue(fixture, {
    "candidate:maintenance-noise": "approve",
    "candidate:duplicate-recallweave-decision": "unsafe",
    "candidate:high-value-policy": `suppress ${"sm_" + "D".repeat(42)}`,
  });
  assert.equal(changedReviewQueue.summary.changed, 2);
  assert.ok(changedReviewQueue.items.some((item) => item.id === "candidate:maintenance-noise" && item.action === "approve"));
  assert.equal(changedReviewQueue.items.find((item) => item.id === "candidate:duplicate-recallweave-decision")?.action, "approve");

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
  const missingSyncConfirmation = await postJson(`${base}/wiki/sync/dry-run`, {
    rootDir: selectedSyncRoot,
    confirmReadOnly: false,
  });
  assert.equal(missingSyncConfirmation.ok, false);
  assert.equal(missingSyncConfirmation.code, "read_only_confirmation_required");
  const selectedSync = await postJson(`${base}/wiki/sync/dry-run`, {
    rootDir: selectedSyncRoot,
    confirmReadOnly: true,
  });
  assert.equal(selectedSync.ok, true);
  assert.equal(selectedSync.mode, "selected-wiki-sync-dry-run");
  assert.equal(selectedSync.writesRealFiles, false);
  assert.equal(selectedSync.report.dryRun, true);
  assert.equal(selectedSync.selection.rootPathRedacted, true);
  assert.match(selectedSync.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedSync.selection.rootDisplay.includes(selectedSyncRoot), false);
  assert.equal(selectedSync.report.rootDir.includes(selectedSyncRoot), false);
  assert.ok(selectedSync.report.summary.write > 0);
  assert.ok(selectedSync.report.summary.write_conflict_note >= 1);
  const selectedSyncConflict = selectedSync.report.actions.find((action) => action.action === "write_conflict_note" && action.conflictPath);
  assert.ok(selectedSyncConflict);
  assert.equal(selectedSync.auditTrail.event, "wiki_vault_sync_dry_run");
  assert.equal(selectedSync.auditTrail.writesRealFiles, false);
  await assert.rejects(readFile(join(selectedSyncRoot, selectedSyncConflict.conflictPath), "utf8"));
  const missingApplyConfirmation = await postJson(`${base}/wiki/sync/apply`, {
    rootDir: selectedSyncRoot,
    confirmWrite: false,
    confirmationPhrase: "APPLY LOCAL WIKI SYNC",
  });
  assert.equal(missingApplyConfirmation.ok, false);
  assert.equal(missingApplyConfirmation.code, "write_confirmation_required");
  const selectedSyncApply = await postJson(`${base}/wiki/sync/apply`, {
    rootDir: selectedSyncRoot,
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL WIKI SYNC",
  });
  assert.equal(selectedSyncApply.ok, true);
  assert.equal(selectedSyncApply.mode, "selected-wiki-sync-apply");
  assert.equal(selectedSyncApply.writesRealFiles, true);
  assert.equal(selectedSyncApply.report.dryRun, false);
  assert.equal(selectedSyncApply.selection.rootPathRedacted, true);
  assert.match(selectedSyncApply.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedSyncApply.selection.rootDisplay.includes(selectedSyncRoot), false);
  assert.equal(selectedSyncApply.report.rootDir.includes(selectedSyncRoot), false);
  assert.ok(selectedSyncApply.report.summary.write > 0);
  assert.ok(selectedSyncApply.report.summary.write_conflict_note >= 1);
  assert.equal(selectedSyncApply.auditTrail.event, "wiki_vault_sync_apply");
  assert.equal(selectedSyncApply.auditTrail.writesRealFiles, true);
  assert.ok(selectedSyncApply.report.auditLog.entriesWritten > 0);
  const selectedApplyConflict = selectedSyncApply.report.actions.find((action) => action.action === "write_conflict_note" && action.conflictPath);
  assert.ok(selectedApplyConflict);
  await assert.doesNotReject(readFile(join(selectedSyncRoot, "wiki/index.md"), "utf8"));
  await assert.doesNotReject(readFile(join(selectedSyncRoot, selectedApplyConflict.conflictPath), "utf8"));
  const applyAuditLog = await readFile(join(selectedSyncRoot, ".recallweave/wiki-sync-audit.jsonl"), "utf8");
  assert.match(applyAuditLog, /wiki_vault_sync_write_intent/);
  assert.equal(applyAuditLog.includes(selectedSyncRoot), false);
  assert.equal(localAudit.ok, true);
  assert.equal(localAudit.report.mode, "local-container-audit");
  assert.equal(localAudit.report.writesRealFiles, false);
  assert.equal(localAudit.report.rootPathRedacted, true);
  assert.equal(localAudit.report.totals.existingFiles, 3);
  assert.ok(localAudit.report.totals.redactionCount >= 2);
  assert.equal(localAudit.report.health.status, "needs-review");
  assert.ok(localAudit.report.health.reasons.includes("private_or_key_shaped_text_detected"));
  const missingConfirmation = await postJson(`${base}/local-container/audit`, {
    rootDir: selectedRoot,
    confirmReadOnly: false,
  });
  assert.equal(missingConfirmation.ok, false);
  assert.equal(missingConfirmation.code, "read_only_confirmation_required");

  const selectedAudit = await postJson(`${base}/local-container/audit`, {
    rootDir: selectedRoot,
    containerLabel: `selected ${"sm_" + "A".repeat(42)}`,
    confirmReadOnly: true,
  });
  assert.equal(selectedAudit.ok, true);
  assert.equal(selectedAudit.mode, "selected-local-container-audit");
  assert.equal(selectedAudit.writesRealFiles, false);
  assert.equal(selectedAudit.selection.rootPathRedacted, true);
  assert.match(selectedAudit.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedAudit.selection.rootDisplay.includes(selectedRoot), false);
  assert.equal(selectedAudit.report.totals.existingFiles, 2);
  assert.equal(selectedAudit.report.health.status, "healthy");
  assert.equal(selectedAudit.auditTrail.writesRealFiles, false);
  assert.equal(selectedAudit.auditTrail.event, "local_container_audit_preview");
  const selectedAuditHistory = mergeSelectedAuditTrail(
    [
      {
        capturedAt: "not-a-date",
        rootDisplay: `/Users/private/profile/${"pa-" + "x".repeat(24)}`,
        containerLabel: `agent ${"sm_" + "B".repeat(42)}`,
        status: "<private>hidden</private>",
        existingFiles: 99,
        lines: 99,
        redactionCount: 99,
        event: "old_event",
      },
    ],
    selectedAudit,
  );
  assert.equal(selectedAuditHistory.length, 2);
  assert.equal(selectedAuditHistory[0].rootDisplay.includes(selectedRoot), false);
  assert.equal(selectedAuditHistory[0].writesRealFiles, false);
  assert.equal(selectedAuditHistory[0].event, "local_container_audit_preview");
  assert.equal(selectedAuditHistory[1].capturedAt, "unknown");

  const serialized = JSON.stringify({
    containerHealth,
    editExport,
    unsafeExport,
    nucleusExport,
    lineage,
    policyDraft,
    clampedPolicyDraft,
    reviewQueue,
    changedReviewQueue,
    vault,
    syncReport,
    missingSyncConfirmation,
    selectedSync,
    missingApplyConfirmation,
    selectedSyncApply,
    applyAuditLog,
    localAudit,
    missingConfirmation,
    selectedAudit,
    selectedAuditHistory,
  });
  assert.equal(containsPrivateLikeText(serialized), false, "serialized interaction outputs must stay public-safe");
  assert.equal(serialized.includes(selectedRoot), false, "selected local root path must stay redacted");
  assert.equal(serialized.includes(selectedSyncRoot), false, "selected sync root path must stay redacted");
  assert.equal(serialized.includes(selectedSyncRoot), false, "selected wiki sync root path must stay redacted");
  assert.equal(serialized.includes("/Users/private/profile"), false, "dirty prior history paths must be collapsed");

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
          "lifecycle-policy-draft",
          "review-queue-draft",
          "vault-path",
          "sync-report",
          "selected-wiki-sync-dry-run",
          "selected-wiki-sync-apply",
          "local-container-audit",
          "selected-local-audit",
          "selected-audit-history",
          "public-safe-serialization",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(selectedRoot, { recursive: true, force: true });
  await rm(selectedSyncRoot, { recursive: true, force: true });
}

async function json(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200, url);
  return response.json();
}
