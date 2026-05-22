import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildContainerHealth,
  buildEditExport,
  buildGraphNavigation,
  buildGraphLayout,
  buildLifecyclePolicyDraft,
  buildMemoryReviewQueue,
  buildNucleusExport,
  buildPromptContextPreview,
  buildResearchLineage,
  buildSessionCompactionAudit,
  containsPrivateLikeText,
  filteredNodes,
  graphScopedNodes,
  mergeSelectedAuditTrail,
  preferredVaultPath,
} from "./src/model.js";
import { createBrainUiServer } from "./server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(join(here, "fixtures/nucleus.fixture.json"), "utf8"));
const sessionCompactionFixture = JSON.parse(await readFile(join(here, "fixtures/session-compaction-local-audit.json"), "utf8"));
const promptContextFixture = JSON.parse(await readFile(join(here, "fixtures/prompt-context-preview.json"), "utf8"));
const selectedRoot = await mkdtemp(join(tmpdir(), "recallweave-selected-local-audit-"));
const selectedSyncRoot = await mkdtemp(join(tmpdir(), "recallweave-selected-wiki-sync-"));
const selectedPolicyRoot = await mkdtemp(join(tmpdir(), "recallweave-selected-policy-"));
const selectedReviewRoot = await mkdtemp(join(tmpdir(), "recallweave-selected-review-"));
const selectedEditRoot = await mkdtemp(join(tmpdir(), "recallweave-selected-edit-"));
const server = createBrainUiServer({
  enableLocalAudit: true,
  enableLocalBrowse: true,
  enableLocalApply: true,
  enablePolicyApply: true,
  enableReviewApply: true,
  enableLocalEdit: true,
  enableLocalMaterialize: true,
});

await writeFile(join(selectedRoot, "memories.jsonl"), "{\"kind\":\"decision\",\"text\":\"selected local writes only\"}\n", "utf8");
await writeFile(
  join(selectedEditRoot, "memories.jsonl"),
  "{\"id\":\"mem_fixture_edit\",\"kind\":\"decision\",\"text\":\"old fixture memory text\"}\n",
  "utf8",
);
await writeFile(
  join(selectedRoot, "trace.jsonl"),
  [
    "{\"event\":\"search\",\"query\":\"selected local recall\",\"count\":3}",
    "{\"event\":\"store\",\"text\":\"public <private>hidden</private>\"}",
  ].join("\n"),
  "utf8",
);
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

  const expandedFixture = {
    ...fixture,
    nodes: [
      ...fixture.nodes,
      ...Array.from({ length: 18 }, (_, index) => ({
        id: `memory:layout-extra-${index}`,
        kind: index % 3 === 0 ? "memory" : index % 3 === 1 ? "decision" : "derived_doc",
        title: `Layout extra node ${index}`,
        createdAt: `2026-05-22T10:${String(index).padStart(2, "0")}:00.000Z`,
        updatedAt: `2026-05-22T10:${String(index).padStart(2, "0")}:30.000Z`,
        tags: ["layout"],
      })),
    ],
    edges: [
      ...fixture.edges,
      ...Array.from({ length: 18 }, (_, index) => ({
        id: `edge:layout-extra-${index}`,
        from: index % 2 === 0 ? fixture.nodes[0].id : `memory:layout-extra-${Math.max(0, index - 1)}`,
        to: `memory:layout-extra-${index}`,
        kind: "relates_to",
        createdAt: `2026-05-22T10:${String(index).padStart(2, "0")}:45.000Z`,
      })),
    ],
  };
  const layout = buildGraphLayout(expandedFixture, expandedFixture.nodes);
  assert.equal(layout.mode, "dynamic-graph-layout");
  assert.equal(layout.writesRealFiles, false);
  assert.equal(layout.nodes.length, expandedFixture.nodes.length);
  assert.ok(layout.columns >= 2, "expanded layout should use multiple dynamic columns");
  assert.ok(layout.height > 380, "expanded layout should grow vertically instead of piling nodes");
  const layoutSerialized = JSON.stringify(layout);
  assert.doesNotMatch(layoutSerialized, /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);
  const pointsByColumn = new Map();
  for (const point of layout.nodes) {
    const points = pointsByColumn.get(point.x) ?? [];
    points.push(point);
    pointsByColumn.set(point.x, points);
  }
  for (const points of pointsByColumn.values()) {
    const sorted = [...points].sort((a, b) => a.y - b.y);
    for (let index = 1; index < sorted.length; index += 1) {
      assert.ok(sorted[index].y - sorted[index - 1].y >= 110, "same-column graph nodes should be vertically separated");
    }
  }
  const selectedLayoutNode = expandedFixture.nodes[0];
  const neighborhoodNodes = graphScopedNodes(expandedFixture, expandedFixture.nodes, selectedLayoutNode.id, "neighborhood");
  const graphNavigation = buildGraphNavigation(
    expandedFixture,
    expandedFixture.nodes,
    neighborhoodNodes,
    selectedLayoutNode.id,
    "neighborhood",
  );
  assert.equal(graphNavigation.mode, "fixture-graph-navigation");
  assert.equal(graphNavigation.writesRealFiles, false);
  assert.equal(graphNavigation.scope, "neighborhood");
  assert.equal(graphNavigation.filteredNodeCount, expandedFixture.nodes.length);
  assert.ok(graphNavigation.visibleNodeCount < graphNavigation.filteredNodeCount, "neighborhood mode should reduce visible nodes");
  assert.equal(graphNavigation.selectedVisible, true);
  assert.ok(graphNavigation.jumpOptions.length >= expandedFixture.nodes.length);
  assert.ok(graphNavigation.selectedNeighborCount >= 1);
  assert.doesNotMatch(JSON.stringify(graphNavigation), /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);

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

  const sessionCompactionAudit = buildSessionCompactionAudit(sessionCompactionFixture);
  assert.equal(sessionCompactionAudit.mode, "fixture-local-session-compaction-audit");
  assert.equal(sessionCompactionAudit.writesRealFiles, false);
  assert.equal(sessionCompactionAudit.metricsOnly, true);
  assert.equal(sessionCompactionAudit.input.eventCount, 6);
  assert.equal(sessionCompactionAudit.metrics.redactionCount, 2);
  assert.equal(sessionCompactionAudit.metrics.outputCandidates, 4);
  assert.equal(sessionCompactionAudit.metrics.chronological, true);
  assert.equal(sessionCompactionAudit.quality.privacyLeakCount, 0);
  assert.equal(sessionCompactionAudit.quality.exactIdentifierCandidateCount, 1);
  assert.equal(sessionCompactionAudit.candidateFingerprints.length, 4);
  assert.ok(!sessionCompactionAudit.candidateFingerprints.some((candidate) => Object.hasOwn(candidate, "text")));
  assert.doesNotMatch(JSON.stringify(sessionCompactionAudit), /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);

  const promptContext = buildPromptContextPreview(fixture, promptContextFixture);
  assert.equal(promptContext.mode, "fixture-prompt-context-preview");
  assert.equal(promptContext.writesRealFiles, false);
  assert.equal(promptContext.query, "native memory optimization");
  assert.equal(promptContext.tokenBudget, 900);
  assert.equal(promptContext.totalTokens, 642);
  assert.equal(promptContext.budgetRemaining, 258);
  assert.equal(promptContext.safety.privacyLeakCount, 0);
  assert.equal(promptContext.safety.hostedReadThrough, "read-only");
  assert.equal(promptContext.safety.writeMode, "local-only");
  assert.ok(promptContext.selectedMemories.some((memory) => memory.id === "memory:hybrid-recall" && memory.injected));
  assert.ok(promptContext.sections.some((section) => section.title === "Guardrails" && section.injected));
  assert.ok(promptContext.omittedCandidates.some((candidate) => candidate.reason.includes("noise")));
  assert.match(promptContext.compiledContext, /<recallweave-context>/);
  assert.doesNotMatch(JSON.stringify(promptContext), /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);

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
  const missingPolicyApplyConfirmation = await postJson(`${base}/lifecycle-policy/apply`, {
    rootDir: selectedPolicyRoot,
    policy: policyDraft,
    confirmWrite: false,
    confirmationPhrase: "APPLY LOCAL LIFECYCLE POLICY",
  });
  assert.equal(missingPolicyApplyConfirmation.ok, false);
  assert.equal(missingPolicyApplyConfirmation.code, "write_confirmation_required");
  const unsafePolicyApply = await postJson(`${base}/lifecycle-policy/apply`, {
    rootDir: selectedPolicyRoot,
    policy: {
      ...policyDraft,
      recall: {
        ...policyDraft.recall,
        forceWhenPromptMatches: [`public ${"pa-" + "F".repeat(44)}`],
      },
    },
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL LIFECYCLE POLICY",
  });
  assert.equal(unsafePolicyApply.ok, false);
  assert.equal(unsafePolicyApply.code, "policy_contains_private_or_key_shaped_text");
  const selectedPolicyApply = await postJson(`${base}/lifecycle-policy/apply`, {
    rootDir: selectedPolicyRoot,
    policy: policyDraft,
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL LIFECYCLE POLICY",
  });
  assert.equal(selectedPolicyApply.ok, true);
  assert.equal(selectedPolicyApply.mode, "selected-lifecycle-policy-apply");
  assert.equal(selectedPolicyApply.writesRealFiles, true);
  assert.equal(selectedPolicyApply.selection.rootPathRedacted, true);
  assert.match(selectedPolicyApply.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedPolicyApply.selection.rootDisplay.includes(selectedPolicyRoot), false);
  assert.equal(selectedPolicyApply.report.rootDir.includes(selectedPolicyRoot), false);
  assert.equal(selectedPolicyApply.report.policyPath, ".recallweave/lifecycle-policy.json");
  assert.equal(selectedPolicyApply.report.auditLog.entriesWritten, 1);
  assert.equal(selectedPolicyApply.report.summary.forceEveryTurn, true);
  assert.equal(selectedPolicyApply.report.summary.storePreCompressCheckpoints, true);
  assert.equal(selectedPolicyApply.report.summary.maxAutoWritesPerSession, 12);
  assert.equal(selectedPolicyApply.report.summary.lowConfidenceAction, "suppress");
  assert.equal(selectedPolicyApply.auditTrail.event, "lifecycle_policy_apply");
  assert.equal(selectedPolicyApply.auditTrail.writesRealFiles, true);
  const lifecyclePolicyFile = await readFile(join(selectedPolicyRoot, ".recallweave/lifecycle-policy.json"), "utf8");
  const lifecycleAuditLog = await readFile(join(selectedPolicyRoot, ".recallweave/lifecycle-policy-audit.jsonl"), "utf8");
  const writtenPolicy = JSON.parse(lifecyclePolicyFile);
  assert.equal(writtenPolicy.mode, "local-lifecycle-policy");
  assert.equal(writtenPolicy.writesRealFiles, true);
  assert.equal(writtenPolicy.recall.forceEveryTurn, true);
  assert.equal(writtenPolicy.writes.storePreCompressCheckpoints, true);
  assert.equal(writtenPolicy.writes.maxAutoWritesPerSession, 12);
  assert.match(lifecycleAuditLog, /lifecycle_policy_apply/);
  assert.equal(lifecycleAuditLog.includes(selectedPolicyRoot), false);

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
  const missingReviewApplyConfirmation = await postJson(`${base}/review-queue/apply`, {
    rootDir: selectedReviewRoot,
    reviewQueue,
    confirmWrite: false,
    confirmationPhrase: "APPLY LOCAL REVIEW QUEUE",
  });
  assert.equal(missingReviewApplyConfirmation.ok, false);
  assert.equal(missingReviewApplyConfirmation.code, "write_confirmation_required");
  const unsafeReviewApply = await postJson(`${base}/review-queue/apply`, {
    rootDir: selectedReviewRoot,
    reviewQueue: {
      ...reviewQueue,
      items: [
        ...reviewQueue.items,
        {
          id: "candidate:unsafe",
          action: "suppress",
          text: `public ${"sm_" + "G".repeat(42)}`,
        },
      ],
    },
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL REVIEW QUEUE",
  });
  assert.equal(unsafeReviewApply.ok, false);
  assert.equal(unsafeReviewApply.code, "review_queue_contains_private_or_key_shaped_text");
  const selectedReviewApply = await postJson(`${base}/review-queue/apply`, {
    rootDir: selectedReviewRoot,
    reviewQueue,
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL REVIEW QUEUE",
  });
  assert.equal(selectedReviewApply.ok, true);
  assert.equal(selectedReviewApply.mode, "selected-review-queue-apply");
  assert.equal(selectedReviewApply.writesRealFiles, true);
  assert.equal(selectedReviewApply.selection.rootPathRedacted, true);
  assert.match(selectedReviewApply.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedReviewApply.selection.rootDisplay.includes(selectedReviewRoot), false);
  assert.equal(selectedReviewApply.report.rootDir.includes(selectedReviewRoot), false);
  assert.equal(selectedReviewApply.report.decisionsPath, ".recallweave/review-decisions.jsonl");
  assert.equal(selectedReviewApply.report.auditLog.entriesWritten, 1);
  assert.equal(selectedReviewApply.report.summary.decisions, 3);
  assert.equal(selectedReviewApply.report.summary.approve, 1);
  assert.equal(selectedReviewApply.report.summary.suppress, 1);
  assert.equal(selectedReviewApply.report.summary.merge, 1);
  assert.equal(selectedReviewApply.auditTrail.event, "review_queue_apply");
  assert.equal(selectedReviewApply.auditTrail.writesRealFiles, true);
  const reviewDecisionLog = await readFile(join(selectedReviewRoot, ".recallweave/review-decisions.jsonl"), "utf8");
  const reviewAuditLog = await readFile(join(selectedReviewRoot, ".recallweave/review-queue-audit.jsonl"), "utf8");
  assert.match(reviewDecisionLog, /memory_review_decision/);
  assert.match(reviewAuditLog, /review_queue_apply/);
  assert.equal(reviewDecisionLog.includes(selectedReviewRoot), false);
  assert.equal(reviewAuditLog.includes(selectedReviewRoot), false);
  assert.equal(reviewDecisionLog.includes("The nightly watchdog ping completed"), false, "review apply should not write candidate text");
  assert.equal(reviewDecisionLog.includes("RecallWeave should keep local writes"), false, "review apply should not write candidate text");
  assert.equal(reviewDecisionLog.includes("Run privacy tests"), false, "review apply should not write candidate text");

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
  const missingBrowseConfirmation = await postJson(`${base}/local-container/browse`, {
    rootDir: selectedRoot,
    confirmReadOnly: false,
  });
  assert.equal(missingBrowseConfirmation.ok, false);
  assert.equal(missingBrowseConfirmation.code, "read_only_confirmation_required");
  const selectedBrowse = await postJson(`${base}/local-container/browse`, {
    rootDir: selectedRoot,
    containerLabel: `browse ${"sm_" + "E".repeat(42)}`,
    confirmReadOnly: true,
    maxItems: 8,
  });
  assert.equal(selectedBrowse.ok, true);
  assert.equal(selectedBrowse.mode, "selected-local-container-browse");
  assert.equal(selectedBrowse.writesRealFiles, false);
  assert.equal(selectedBrowse.selection.rootPathRedacted, true);
  assert.match(selectedBrowse.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedBrowse.selection.rootDisplay.includes(selectedRoot), false);
  assert.ok(selectedBrowse.report.totals.itemsReturned >= 2);
  assert.ok(selectedBrowse.report.totals.redactionCount >= 1);
  assert.equal(selectedBrowse.auditTrail.event, "local_container_browse_preview");
  assert.equal(selectedBrowse.auditTrail.writesRealFiles, false);
  assert.ok(selectedBrowse.report.items.some((item) => item.summary.includes("selected local writes only")));
  assert.ok(selectedBrowse.report.items.some((item) => item.event === "search"));
  const missingLocalEditConfirmation = await postJson(`${base}/local-container/edit`, {
    rootDir: selectedEditRoot,
    edit: {
      sourceFile: "memories.jsonl",
      line: 1,
      sourceId: "mem_fixture_edit",
      action: "replace",
      reason: "manual_correction",
      replacementText: "new fixture memory text",
    },
    confirmWrite: false,
    confirmationPhrase: "APPLY LOCAL MEMORY EDIT",
  });
  assert.equal(missingLocalEditConfirmation.ok, false);
  assert.equal(missingLocalEditConfirmation.code, "write_confirmation_required");
  const unsafeLocalEdit = await postJson(`${base}/local-container/edit`, {
    rootDir: selectedEditRoot,
    edit: {
      sourceFile: "memories.jsonl",
      line: 1,
      sourceId: "mem_fixture_edit",
      action: "replace",
      reason: "manual_correction",
      replacementText: `public ${"sm_" + "H".repeat(42)}`,
    },
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL MEMORY EDIT",
  });
  assert.equal(unsafeLocalEdit.ok, false);
  assert.equal(unsafeLocalEdit.code, "local_edit_contains_private_or_key_shaped_text");
  const selectedLocalEdit = await postJson(`${base}/local-container/edit`, {
    rootDir: selectedEditRoot,
    edit: {
      sourceFile: "memories.jsonl",
      line: 1,
      sourceId: "mem_fixture_edit",
      action: "replace",
      reason: "manual_correction",
      replacementText: "new fixture memory text",
    },
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL MEMORY EDIT",
  });
  assert.equal(selectedLocalEdit.ok, true);
  assert.equal(selectedLocalEdit.mode, "selected-local-memory-edit");
  assert.equal(selectedLocalEdit.writesRealFiles, true);
  assert.equal(selectedLocalEdit.selection.rootPathRedacted, true);
  assert.match(selectedLocalEdit.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedLocalEdit.selection.rootDisplay.includes(selectedEditRoot), false);
  assert.equal(selectedLocalEdit.report.rootDir.includes(selectedEditRoot), false);
  assert.equal(selectedLocalEdit.report.editsPath, ".recallweave/local-memory-edits.jsonl");
  assert.equal(selectedLocalEdit.report.auditLog.entriesWritten, 1);
  assert.equal(selectedLocalEdit.report.summary.action, "replace");
  assert.equal(selectedLocalEdit.report.summary.originalContentIncluded, false);
  assert.equal(selectedLocalEdit.report.summary.replacementContentIncludedInEditLog, true);
  assert.equal(selectedLocalEdit.auditTrail.event, "local_memory_edit_overlay");
  assert.equal(selectedLocalEdit.auditTrail.writesRealFiles, true);
  const localEditLog = await readFile(join(selectedEditRoot, ".recallweave/local-memory-edits.jsonl"), "utf8");
  const localEditAuditLog = await readFile(join(selectedEditRoot, ".recallweave/local-memory-edit-audit.jsonl"), "utf8");
  assert.match(localEditLog, /local_memory_edit_overlay/);
  assert.match(localEditLog, /new fixture memory text/);
  assert.match(localEditAuditLog, /local_memory_edit_overlay/);
  assert.equal(localEditAuditLog.includes("new fixture memory text"), false, "local edit audit must be content-free");
  assert.equal(localEditLog.includes(selectedEditRoot), false);
  assert.equal(localEditAuditLog.includes(selectedEditRoot), false);
  const selectedEditBrowse = await postJson(`${base}/local-container/browse`, {
    rootDir: selectedEditRoot,
    confirmReadOnly: true,
    maxItems: 5,
  });
  assert.equal(selectedEditBrowse.ok, true);
  assert.equal(selectedEditBrowse.mode, "selected-local-container-browse");
  assert.equal(selectedEditBrowse.report.editOverlay.applied, 1);
  assert.equal(selectedEditBrowse.report.totals.editOverlayCount, 1);
  assert.ok(
    selectedEditBrowse.report.items.some((item) =>
      item.overlays?.some((overlay) => overlay.replacementPreview?.includes("new fixture memory text")),
    ),
    "selected browse should surface the local edit overlay",
  );
  assert.equal(selectedEditBrowse.report.rootDir?.includes?.(selectedEditRoot) ?? false, false);
  const missingMaterializeConfirmation = await postJson(`${base}/local-container/materialize`, {
    rootDir: selectedEditRoot,
    confirmWrite: false,
    confirmationPhrase: "APPLY LOCAL MEMORY MATERIALIZE",
  });
  assert.equal(missingMaterializeConfirmation.ok, false);
  assert.equal(missingMaterializeConfirmation.code, "write_confirmation_required");
  const selectedMaterialize = await postJson(`${base}/local-container/materialize`, {
    rootDir: selectedEditRoot,
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL MEMORY MATERIALIZE",
  });
  assert.equal(selectedMaterialize.ok, true);
  assert.equal(selectedMaterialize.mode, "selected-local-memory-materialize");
  assert.equal(selectedMaterialize.writesRealFiles, true);
  assert.equal(selectedMaterialize.selection.rootPathRedacted, true);
  assert.match(selectedMaterialize.selection.rootDisplay, /^\.\.\.\//);
  assert.equal(selectedMaterialize.selection.rootDisplay.includes(selectedEditRoot), false);
  assert.equal(selectedMaterialize.report.totals.applied, 1);
  assert.equal(selectedMaterialize.report.totals.replaced, 1);
  assert.equal(selectedMaterialize.report.totals.skipped, 0);
  assert.equal(selectedMaterialize.report.backup.written, true);
  assert.match(selectedMaterialize.report.backup.path, /^\.recallweave\/backups\/memories-/);
  assert.equal(selectedMaterialize.report.auditLog.entriesWritten, 1);
  assert.equal(selectedMaterialize.auditTrail.event, "local_memory_materialize");
  assert.equal(selectedMaterialize.auditTrail.writesRealFiles, true);
  const materializedMemory = await readFile(join(selectedEditRoot, "memories.jsonl"), "utf8");
  const materializeAuditLog = await readFile(join(selectedEditRoot, ".recallweave/local-memory-materialize-audit.jsonl"), "utf8");
  assert.match(materializedMemory, /new fixture memory text/);
  assert.doesNotMatch(materializedMemory, /old fixture memory text/);
  assert.match(materializeAuditLog, /local_memory_materialize/);
  assert.equal(materializeAuditLog.includes("new fixture memory text"), false, "materialize audit must be content-free");
  assert.equal(materializeAuditLog.includes(selectedEditRoot), false);
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
  assert.equal(selectedAudit.report.health.status, "needs-review");
  assert.ok(selectedAudit.report.health.reasons.includes("private_or_key_shaped_text_detected"));
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
    sessionCompactionAudit,
    policyDraft,
    clampedPolicyDraft,
    missingPolicyApplyConfirmation,
    unsafePolicyApply,
    selectedPolicyApply,
    lifecyclePolicyFile,
    lifecycleAuditLog,
    reviewQueue,
    changedReviewQueue,
    missingReviewApplyConfirmation,
    unsafeReviewApply,
    selectedReviewApply,
    reviewDecisionLog,
    reviewAuditLog,
    vault,
    syncReport,
    missingSyncConfirmation,
    selectedSync,
    missingApplyConfirmation,
    selectedSyncApply,
    applyAuditLog,
    localAudit,
    missingBrowseConfirmation,
    selectedBrowse,
    missingLocalEditConfirmation,
    unsafeLocalEdit,
    selectedLocalEdit,
    localEditAuditLog,
    selectedEditBrowse,
    missingMaterializeConfirmation,
    selectedMaterialize,
    materializeAuditLog,
    missingConfirmation,
    selectedAudit,
    selectedAuditHistory,
  });
  assert.equal(containsPrivateLikeText(serialized), false, "serialized interaction outputs must stay public-safe");
  assert.equal(serialized.includes(selectedRoot), false, "selected local root path must stay redacted");
  assert.equal(serialized.includes(selectedSyncRoot), false, "selected sync root path must stay redacted");
  assert.equal(serialized.includes(selectedSyncRoot), false, "selected wiki sync root path must stay redacted");
  assert.equal(serialized.includes(selectedReviewRoot), false, "selected review root path must stay redacted");
  assert.equal(serialized.includes(selectedEditRoot), false, "selected edit root path must stay redacted");
  assert.equal(serialized.includes("/Users/private/profile"), false, "dirty prior history paths must be collapsed");

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          "search-filter",
          "retrieval-trace",
          "dynamic-graph-layout",
          "graph-navigation-controls",
          "editable-node",
          "container-health",
          "private-edit-guard",
          "draft-export",
          "nucleus-export",
          "research-lineage",
          "session-compaction-audit",
          "prompt-context-preview",
          "lifecycle-policy-draft",
          "selected-lifecycle-policy-apply",
          "review-queue-draft",
          "selected-review-queue-apply",
          "vault-path",
          "sync-report",
          "selected-wiki-sync-dry-run",
          "selected-wiki-sync-apply",
          "local-container-audit",
          "selected-local-browse",
          "selected-local-memory-edit",
          "selected-local-edit-overlay-browse",
          "selected-local-edit-materialize",
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
  await rm(selectedPolicyRoot, { recursive: true, force: true });
  await rm(selectedReviewRoot, { recursive: true, force: true });
  await rm(selectedEditRoot, { recursive: true, force: true });
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
