import assert from "node:assert/strict";
import { createBrainUiServer } from "./server.mjs";

const server = createBrainUiServer();

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const [index, app, model, styles, fixture, vault, syncReport, localAudit, health] = await Promise.all([
    text(`${base}/`),
    text(`${base}/app.js`),
    text(`${base}/model.js`),
    text(`${base}/styles.css`),
    json(`${base}/fixtures/nucleus.fixture.json`),
    json(`${base}/fixtures/wiki-vault.json`),
    json(`${base}/fixtures/wiki-sync-report.json`),
    json(`${base}/fixtures/local-container-audit.json`),
    json(`${base}/healthz`),
  ]);

  assert.equal(health.ok, true);
  assert.match(index, /RecallWeave Brain/);
  assert.match(index, /Container/);
  assert.match(index, /Nucleus Snapshot/);
  assert.match(index, /Research Lineage/);
  assert.match(index, /Wiki Vault Preview/);
  assert.match(index, /Vault Sync Report/);
  assert.match(index, /Local Audit Preflight/);
  assert.match(index, /Selected local container audit/);
  assert.match(index, /Draft Export/);
  assert.match(app, /renderGraph/);
  assert.match(app, /buildContainerHealth/);
  assert.match(app, /buildNucleusExport/);
  assert.match(app, /buildResearchLineage/);
  assert.match(app, /renderVaultPreview/);
  assert.match(app, /renderSyncReport/);
  assert.match(app, /renderLocalAudit/);
  assert.match(app, /renderSelectedAudit/);
  assert.match(app, /buildEditExport/);
  assert.match(model, /const kind = safeExportText\(node\.kind\)/);
  assert.match(model, /function buildContainerHealth/);
  assert.match(model, /function filteredNodes/);
  assert.match(model, /function preferredVaultPath/);
  assert.match(styles, /nucleus-shell/);
  assert.match(styles, /container-health/);
  assert.match(styles, /snapshot-export/);
  assert.match(styles, /research-lineage/);
  assert.match(styles, /vault-preview/);
  assert.match(styles, /sync-summary/);
  assert.match(styles, /audit-summary/);
  assert.match(styles, /selected-audit/);
  assert.match(styles, /edit-export/);
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.roots.container.writeMode, "local-only");
  assert.equal(fixture.roots.container.privacyLeakCount, 0);
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
  const disabledLocalAudit = await postJson(`${base}/local-container/audit`, {
    rootDir: "/tmp/recallweave-disabled-fixture",
    confirmReadOnly: true,
  });
  assert.equal(disabledLocalAudit.status, 403);
  assert.equal(disabledLocalAudit.body.ok, false);
  assert.equal(disabledLocalAudit.body.code, "local_audit_disabled");

  const serialized = JSON.stringify({ fixture, vault, syncReport, localAudit, disabledLocalAudit });
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
          "wiki-vault",
          "wiki-sync-report",
          "local-container-audit",
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
