import assert from "node:assert/strict";
import { createBrainUiServer } from "./server.mjs";

const server = createBrainUiServer();

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const [index, app, model, styles, fixture, vault, syncReport, localAudit, localBrowse, health] = await Promise.all([
    text(`${base}/`),
    text(`${base}/app.js`),
    text(`${base}/model.js`),
    text(`${base}/styles.css`),
    json(`${base}/fixtures/nucleus.fixture.json`),
    json(`${base}/fixtures/wiki-vault.json`),
    json(`${base}/fixtures/wiki-sync-report.json`),
    json(`${base}/fixtures/local-container-audit.json`),
    json(`${base}/fixtures/local-container-browse.json`),
    json(`${base}/healthz`),
  ]);

  assert.equal(health.ok, true);
  assert.match(index, /RecallWeave Brain/);
  assert.match(index, /Container/);
  assert.match(index, /Nucleus Snapshot/);
  assert.match(index, /Research Lineage/);
  assert.match(index, /Lifecycle Policy/);
  assert.match(index, /Selected local lifecycle policy apply/);
  assert.match(index, /Review Queue/);
  assert.match(index, /Selected local review queue apply/);
  assert.match(index, /Wiki Vault Preview/);
  assert.match(index, /Vault Sync Report/);
  assert.match(index, /Selected local vault sync dry run/);
  assert.match(index, /Selected local vault sync apply/);
  assert.match(index, /Local Audit Preflight/);
  assert.match(index, /Selected local container browse/);
  assert.match(index, /Selected local memory edit/);
  assert.match(index, /Selected local container audit/);
  assert.match(index, /Draft Export/);
  assert.match(app, /renderGraph/);
  assert.match(app, /buildContainerHealth/);
  assert.match(app, /buildNucleusExport/);
  assert.match(app, /buildResearchLineage/);
  assert.match(app, /buildLifecyclePolicyDraft/);
  assert.match(app, /buildMemoryReviewQueue/);
  assert.match(app, /renderLifecyclePolicy/);
  assert.match(app, /renderLifecyclePolicyApply/);
  assert.match(app, /renderReviewQueue/);
  assert.match(app, /renderReviewQueueApply/);
  assert.match(app, /renderVaultPreview/);
  assert.match(app, /renderSyncReport/);
  assert.match(app, /renderSelectedSync/);
  assert.match(app, /renderLocalAudit/);
  assert.match(app, /renderLocalBrowse/);
  assert.match(app, /renderSelectedBrowse/);
  assert.match(app, /renderLocalEdit/);
  assert.match(app, /renderSelectedAudit/);
  assert.match(app, /renderSelectedAuditHistory/);
  assert.match(app, /buildEditExport/);
  assert.match(model, /const kind = safeExportText\(node\.kind\)/);
  assert.match(model, /function buildContainerHealth/);
  assert.match(model, /function buildLifecyclePolicyDraft/);
  assert.match(model, /function buildMemoryReviewQueue/);
  assert.match(model, /function mergeSelectedAuditTrail/);
  assert.match(model, /function filteredNodes/);
  assert.match(model, /function preferredVaultPath/);
  assert.match(styles, /nucleus-shell/);
  assert.match(styles, /container-health/);
  assert.match(styles, /snapshot-export/);
  assert.match(styles, /research-lineage/);
  assert.match(styles, /policy-draft/);
  assert.match(styles, /review-candidate/);
  assert.match(styles, /vault-preview/);
  assert.match(styles, /sync-summary/);
  assert.match(styles, /selected-sync/);
  assert.match(styles, /audit-summary/);
  assert.match(styles, /selected-audit/);
  assert.match(styles, /audit-history/);
  assert.match(styles, /edit-export/);
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.roots.container.writeMode, "local-only");
  assert.equal(fixture.roots.container.privacyLeakCount, 0);
  assert.equal(fixture.roots.lifecyclePolicy.writes.lowConfidenceAction, "review_queue");
  assert.equal(fixture.roots.lifecyclePolicy.lifecycle.hermes.on_pre_compress, "enabled");
  assert.equal(fixture.roots.reviewQueue.candidates.length, 3);
  assert.ok(fixture.nodes.length >= 8);
  assert.ok(fixture.edges.length >= 8);
  assert.ok(fixture.nodes.some((node) => node.kind === "retrieval_trace"));
  assert.ok(fixture.nodes.some((node) => node.kind === "hypothesis"));
  assert.ok(fixture.nodes.some((node) => node.editable === true));
  assert.equal(vault.ok, true);
  assert.equal(vault.lint.length, 0);
  assert.ok(vault.vault.files.some((file) => file.path === "wiki/index.md"));
  assert.ok(vault.vault.files.some((file) => file.kind === "wiki_page"));
  assert.equal(syncReport.ok, true);
  assert.equal(syncReport.report.rootDir, "fixture-temp-vault");
  assert.equal(syncReport.report.dryRun, true);
  assert.ok(syncReport.report.summary.write > 0);
  assert.ok(syncReport.report.summary.write_conflict_note >= 1);
  assert.ok(syncReport.report.actions.some((action) => action.action === "write_conflict_note" && action.conflictPath));
  assert.equal(localAudit.ok, true);
  assert.equal(localAudit.report.mode, "local-container-audit");
  assert.equal(localAudit.report.writesRealFiles, false);
  assert.equal(localAudit.report.rootPathRedacted, true);
  assert.equal(localAudit.report.totals.existingFiles, 3);
  assert.ok(localAudit.report.totals.redactionCount >= 2);
  assert.equal(localAudit.report.health.status, "needs-review");
  assert.equal(localBrowse.ok, true);
  assert.equal(localBrowse.report.mode, "local-container-browse-preview");
  assert.equal(localBrowse.report.writesRealFiles, false);
  assert.equal(localBrowse.report.rootPathRedacted, true);
  assert.ok(localBrowse.report.totals.itemsReturned >= 2);
  assert.ok(localBrowse.report.items.some((item) => item.summary.includes("local-only writes")));
  const disabledLocalAudit = await postJson(`${base}/local-container/audit`, {
    rootDir: "/tmp/recallweave-disabled-fixture",
    confirmReadOnly: true,
  });
  assert.equal(disabledLocalAudit.status, 403);
  assert.equal(disabledLocalAudit.body.ok, false);
  assert.equal(disabledLocalAudit.body.code, "local_audit_disabled");
  const disabledLocalBrowse = await postJson(`${base}/local-container/browse`, {
    rootDir: "/tmp/recallweave-disabled-browse-fixture",
    confirmReadOnly: true,
  });
  assert.equal(disabledLocalBrowse.status, 403);
  assert.equal(disabledLocalBrowse.body.ok, false);
  assert.equal(disabledLocalBrowse.body.code, "local_browse_disabled");
  const disabledSelectedSync = await postJson(`${base}/wiki/sync/dry-run`, {
    rootDir: "/tmp/recallweave-disabled-sync-fixture",
    confirmReadOnly: true,
  });
  assert.equal(disabledSelectedSync.status, 403);
  assert.equal(disabledSelectedSync.body.ok, false);
  assert.equal(disabledSelectedSync.body.code, "local_sync_disabled");
  const disabledSelectedSyncApply = await postJson(`${base}/wiki/sync/apply`, {
    rootDir: "/tmp/recallweave-disabled-sync-apply-fixture",
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL WIKI SYNC",
  });
  assert.equal(disabledSelectedSyncApply.status, 403);
  assert.equal(disabledSelectedSyncApply.body.ok, false);
  assert.equal(disabledSelectedSyncApply.body.code, "local_sync_apply_disabled");
  const disabledPolicyApply = await postJson(`${base}/lifecycle-policy/apply`, {
    rootDir: "/tmp/recallweave-disabled-policy-apply-fixture",
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL LIFECYCLE POLICY",
  });
  assert.equal(disabledPolicyApply.status, 403);
  assert.equal(disabledPolicyApply.body.ok, false);
  assert.equal(disabledPolicyApply.body.code, "lifecycle_policy_apply_disabled");
  const disabledReviewApply = await postJson(`${base}/review-queue/apply`, {
    rootDir: "/tmp/recallweave-disabled-review-apply-fixture",
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL REVIEW QUEUE",
  });
  assert.equal(disabledReviewApply.status, 403);
  assert.equal(disabledReviewApply.body.ok, false);
  assert.equal(disabledReviewApply.body.code, "review_queue_apply_disabled");
  const disabledLocalEdit = await postJson(`${base}/local-container/edit`, {
    rootDir: "/tmp/recallweave-disabled-local-edit-fixture",
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL MEMORY EDIT",
  });
  assert.equal(disabledLocalEdit.status, 403);
  assert.equal(disabledLocalEdit.body.ok, false);
  assert.equal(disabledLocalEdit.body.code, "local_edit_disabled");

  const serialized = JSON.stringify({
    fixture,
    vault,
    syncReport,
    localAudit,
    localBrowse,
    disabledLocalAudit,
    disabledLocalBrowse,
    disabledSelectedSync,
    disabledSelectedSyncApply,
    disabledPolicyApply,
    disabledReviewApply,
    disabledLocalEdit,
  });
  assert.doesNotMatch(serialized, /<private>|pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_/);
  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          "index",
          "app",
          "model",
          "styles",
          "fixture",
          "lifecycle-policy",
          "review-queue",
          "wiki-vault",
          "wiki-sync-report",
          "selected-wiki-sync-disabled",
          "selected-wiki-sync-apply-disabled",
          "lifecycle-policy-apply-disabled",
          "review-queue-apply-disabled",
          "selected-local-edit-disabled",
          "local-container-audit",
          "local-container-browse",
          "selected-local-browse-disabled",
          "selected-local-audit-disabled",
          "healthz",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}

async function text(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return response.text();
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
  return {
    status: response.status,
    body: await response.json(),
  };
}
