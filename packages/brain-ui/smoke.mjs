import assert from "node:assert/strict";
import { createBrainUiServer } from "./server.mjs";

const server = createBrainUiServer();

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const [
    index,
    app,
    model,
    styles,
    fixture,
    vault,
    syncReport,
    sessionCompactionAudit,
    benchmarkSummary,
    canaryRollout,
    researchSourceLock,
    modelMatrix,
    promptContextPreview,
    releaseReadiness,
    localAudit,
    localBrowse,
    health,
  ] = await Promise.all([
    text(`${base}/`),
    text(`${base}/app.js`),
    text(`${base}/model.js`),
    text(`${base}/styles.css`),
    json(`${base}/fixtures/nucleus.fixture.json`),
    json(`${base}/fixtures/wiki-vault.json`),
    json(`${base}/fixtures/wiki-sync-report.json`),
    json(`${base}/fixtures/session-compaction-local-audit.json`),
    json(`${base}/fixtures/benchmark-summary.json`),
    json(`${base}/fixtures/canary-rollout.json`),
    json(`${base}/fixtures/research-source-lock.json`),
    json(`${base}/fixtures/model-matrix.json`),
    json(`${base}/fixtures/prompt-context-preview.json`),
    json(`${base}/fixtures/release-readiness.json`),
    json(`${base}/fixtures/local-container-audit.json`),
    json(`${base}/fixtures/local-container-browse.json`),
    json(`${base}/healthz`),
  ]);

  assert.equal(health.ok, true);
  assert.match(index, /RecallWeave Brain/);
  assert.match(index, /Jump to Nucleus node/);
  assert.match(index, /data-graph-scope="neighborhood"/);
  assert.match(index, /Container/);
  assert.match(index, /Nucleus Snapshot/);
  assert.match(index, /Research Lineage/);
  assert.match(index, /Lifecycle Trail/);
  assert.match(index, /Compaction Audit/);
  assert.match(index, /Benchmark Dashboard/);
  assert.match(index, /Canary Rollout/);
  assert.match(index, /Research Source Lock/);
  assert.match(index, /Model Matrix/);
  assert.match(index, /Context Preview/);
  assert.match(index, /Release Readiness/);
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
  assert.match(index, /Selected local memory materialize/);
  assert.match(index, /Selected local container audit/);
  assert.match(index, /Draft Export/);
  assert.match(app, /renderGraph/);
  assert.match(app, /renderGraphNavigation/);
  assert.match(app, /buildContainerHealth/);
  assert.match(app, /buildGraphNavigation/);
  assert.match(app, /buildGraphLayout/);
  assert.match(app, /buildNucleusExport/);
  assert.match(app, /buildResearchLineage/);
  assert.match(app, /buildLifecycleTrail/);
  assert.match(app, /renderLifecycleTrail/);
  assert.match(app, /buildSessionCompactionAudit/);
  assert.match(app, /buildBenchmarkDashboard/);
  assert.match(app, /buildCanaryRollout/);
  assert.match(app, /buildResearchSourceLock/);
  assert.match(app, /renderModelMatrix/);
  assert.match(app, /buildModelMatrix/);
  assert.match(app, /buildPromptContextPreview/);
  assert.match(app, /buildReleaseReadinessConsole/);
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
  assert.match(app, /renderLocalMaterialize/);
  assert.match(app, /renderSelectedAudit/);
  assert.match(app, /renderSelectedAuditHistory/);
  assert.match(app, /scrollHashTargetIntoPanel/);
  assert.match(app, /buildEditExport/);
  assert.match(model, /const kind = safeExportText\(node\.kind\)/);
  assert.match(model, /function buildContainerHealth/);
  assert.match(model, /function buildGraphNavigation/);
  assert.match(model, /function buildGraphLayout/);
  assert.match(model, /function graphScopedNodes/);
  assert.match(model, /function buildSessionCompactionAudit/);
  assert.match(model, /function buildBenchmarkDashboard/);
  assert.match(model, /function buildCanaryRollout/);
  assert.match(model, /function buildResearchSourceLock/);
  assert.match(model, /function buildModelMatrix/);
  assert.match(model, /function buildLifecycleTrail/);
  assert.match(model, /function buildPromptContextPreview/);
  assert.match(model, /function buildReleaseReadinessConsole/);
  assert.match(model, /function buildLifecyclePolicyDraft/);
  assert.match(model, /function buildMemoryReviewQueue/);
  assert.match(model, /function mergeSelectedAuditTrail/);
  assert.match(model, /function filteredNodes/);
  assert.match(model, /function preferredVaultPath/);
  assert.match(styles, /nucleus-shell/);
  assert.match(styles, /graph-toolbar/);
  assert.match(styles, /container-health/);
  assert.match(styles, /snapshot-export/);
  assert.match(styles, /research-lineage/);
  assert.match(styles, /lifecycle-trail/);
  assert.match(styles, /policy-draft/);
  assert.match(styles, /review-candidate/);
  assert.match(styles, /vault-preview/);
  assert.match(styles, /sync-summary/);
  assert.match(styles, /selected-sync/);
  assert.match(styles, /audit-summary/);
  assert.match(styles, /selected-audit/);
  assert.match(styles, /audit-history/);
  assert.match(styles, /benchmark-verdict/);
  assert.match(styles, /canary-verdict/);
  assert.match(styles, /source-lock-status/);
  assert.match(styles, /model-matrix-status/);
  assert.match(styles, /context-section-list/);
  assert.match(styles, /release-verdict/);
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
  assert.equal(sessionCompactionAudit.ok, true);
  assert.equal(sessionCompactionAudit.mode, "local-session-compaction-audit");
  assert.equal(sessionCompactionAudit.writesRealFiles, false);
  assert.equal(sessionCompactionAudit.metricsOnly, true);
  assert.equal(sessionCompactionAudit.input.eventCount, 6);
  assert.equal(sessionCompactionAudit.metrics.redactionCount, 2);
  assert.equal(sessionCompactionAudit.metrics.outputCandidates, 4);
  assert.equal(sessionCompactionAudit.metrics.chronological, true);
  assert.equal(sessionCompactionAudit.quality.privacyLeakCount, 0);
  assert.equal(sessionCompactionAudit.quality.exactIdentifierCandidateCount, 1);
  assert.equal(sessionCompactionAudit.candidateFingerprints.length, 4);
  assert.equal(sessionCompactionAudit.sessionMap.topicLinkCount, 4);
  assert.equal(sessionCompactionAudit.sessionMap.lifecycleEventCount, 6);
  assert.equal(sessionCompactionAudit.sessionMap.unlinkedCandidateCount, 0);
  assert.equal(sessionCompactionAudit.sessionMap.lifecyclePhaseCounts.pre_compact, 1);
  assert.equal(sessionCompactionAudit.sessionMap.lifecyclePhaseCounts.session_map_ready, 1);
  assert.ok(!sessionCompactionAudit.candidateFingerprints.some((candidate) => Object.hasOwn(candidate, "text")));
  assert.equal(benchmarkSummary.mode, "local-compaction-benchmark-summary");
  assert.equal(benchmarkSummary.writesRealFiles, false);
  assert.equal(benchmarkSummary.metricsOnly, true);
  assert.equal(benchmarkSummary.suite.scenarioCount, 5);
  assert.equal(benchmarkSummary.aggregate.passedScenarios, 5);
  assert.equal(benchmarkSummary.aggregate.failedScenarios, 0);
  assert.equal(benchmarkSummary.aggregate.privacyLeakCount, 0);
  assert.equal(benchmarkSummary.aggregate.exactIdentifierAccuracy, 1);
  assert.ok(benchmarkSummary.aggregate.averageNoiseReductionRatio >= 0.2);
  assert.ok(benchmarkSummary.scenarios.every((scenario) => scenario.passed));
  assert.equal(canaryRollout.mode, "one-agent-canary-rollout");
  assert.equal(canaryRollout.writesRealFiles, false);
  assert.equal(canaryRollout.metricsOnly, true);
  assert.equal(canaryRollout.target.scope, "one-agent");
  assert.equal(canaryRollout.target.hostedSupermemoryMode, "read-through-only");
  assert.equal(canaryRollout.readiness.publicLaunchVerdict, "FAIL");
  assert.ok(canaryRollout.prerequisites.some((item) => item.id === "dry-run-first"));
  assert.ok(canaryRollout.steps.some((step) => step.id === "rollback"));
  assert.ok(canaryRollout.metricsToCollect.includes("privacy_leak_count"));
  assert.ok(canaryRollout.blockers.includes("human-public-launch-approval-required"));
  assert.equal(researchSourceLock.mode, "research-source-lock");
  assert.equal(researchSourceLock.sources.length, 11);
  assert.ok(researchSourceLock.sources.some((source) => source.id === "source:gbrain"));
  assert.ok(researchSourceLock.sources.some((source) => source.id === "source:karpathy-llm-wiki"));
  assert.ok(researchSourceLock.sources.some((source) => source.id === "source:obsidian-karpathy-plugin"));
  assert.ok(researchSourceLock.sources.some((source) => source.id === "source:memorybench"));
  assert.ok(researchSourceLock.sources.some((source) => source.id === "source:hermes-memory-provider"));
  assert.ok(researchSourceLock.sources.some((source) => source.status === "watch"));
  assert.equal(researchSourceLock.implementationRules.length, 8);
  assert.ok(researchSourceLock.implementationRules.some((rule) => rule.id === "rule:topic-paths"));
  assert.ok(researchSourceLock.implementationRules.some((rule) => rule.id === "rule:stale-memory-supersession"));
  assert.ok(researchSourceLock.implementationRules.some((rule) => rule.id === "rule:budgeted-lifecycle-frequency"));
  assert.ok(researchSourceLock.implementationRules.some((rule) => rule.id === "rule:dashboard-to-cluster-zoom"));
  assert.equal(modelMatrix.mode, "model-autoresearch-matrix");
  assert.equal(modelMatrix.writesRealFiles, false);
  assert.equal(modelMatrix.metricsOnly, true);
  assert.equal(modelMatrix.defaults.localArm, "local-apple-qwen3-0_6b");
  assert.equal(modelMatrix.defaults.queryExpansion, "off");
  assert.equal(modelMatrix.defaults.credentialMode, "env-only");
  assert.ok(modelMatrix.localLane.embedder.includes("Qwen3-Embedding-0.6B"));
  assert.ok(modelMatrix.localLane.runtime.includes("llama.cpp"));
  assert.ok(modelMatrix.arms.some((arm) => arm.id === "cloud-nvidia-nemotron-1b"));
  assert.ok(modelMatrix.arms.some((arm) => arm.id === "local-apple-qwen3-0_6b-local-rerank"));
  assert.ok(modelMatrix.gates.some((gate) => gate.includes("matched source-locked canary")));
  assert.equal(promptContextPreview.ok, true);
  assert.equal(promptContextPreview.mode, "prompt-context-preview");
  assert.equal(promptContextPreview.tokenBudget, 900);
  assert.equal(promptContextPreview.totalTokens, 642);
  assert.equal(promptContextPreview.safety.privacyLeakCount, 0);
  assert.equal(promptContextPreview.safety.writeMode, "local-only");
  assert.ok(promptContextPreview.selectedMemories.length >= 3);
  assert.ok(promptContextPreview.sections.some((section) => section.title === "Active Recall"));
  assert.ok(promptContextPreview.omittedCandidates.some((candidate) => candidate.reason.includes("noise")));
  assert.equal(releaseReadiness.mode, "release-readiness-console");
  assert.equal(releaseReadiness.publicLaunchVerdict, "FAIL");
  assert.equal(releaseReadiness.productionReady, false);
  assert.equal(releaseReadiness.safetyBoundary.usesFixtureUiEvidence, true);
  assert.equal(releaseReadiness.safetyBoundary.commitsRawMemories, false);
  assert.equal(releaseReadiness.safetyBoundary.commitsRawTranscripts, false);
  assert.equal(releaseReadiness.safetyBoundary.commitsCredentials, false);
  assert.equal(releaseReadiness.safetyBoundary.enablesHostedWriteBack, false);
  assert.equal(releaseReadiness.latestVerifiedCodeBaseline.ciConclusion, "success");
  assert.ok(releaseReadiness.provenPreviewSurfaces.includes("brain-ui-prompt-context-preview"));
  assert.ok(releaseReadiness.remainingBlockers.includes("human-public-launch-approval-required"));
  assert.ok(releaseReadiness.manualActions.length >= 4);
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
  assert.equal(localBrowse.report.editOverlay.applied, 1);
  assert.ok(localBrowse.report.items.some((item) => item.overlays?.some((overlay) => overlay.replacementPreview?.includes("visible edit overlays"))));
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
  const disabledLocalMaterialize = await postJson(`${base}/local-container/materialize`, {
    rootDir: "/tmp/recallweave-disabled-local-materialize-fixture",
    confirmWrite: true,
    confirmationPhrase: "APPLY LOCAL MEMORY MATERIALIZE",
  });
  assert.equal(disabledLocalMaterialize.status, 403);
  assert.equal(disabledLocalMaterialize.body.ok, false);
  assert.equal(disabledLocalMaterialize.body.code, "local_materialize_disabled");

  const serialized = JSON.stringify({
    fixture,
    vault,
    syncReport,
    sessionCompactionAudit,
    benchmarkSummary,
    canaryRollout,
    researchSourceLock,
    promptContextPreview,
    releaseReadiness,
    localAudit,
    localBrowse,
    disabledLocalAudit,
    disabledLocalBrowse,
    disabledSelectedSync,
    disabledSelectedSyncApply,
    disabledPolicyApply,
    disabledReviewApply,
    disabledLocalEdit,
    disabledLocalMaterialize,
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
          "dynamic-graph-layout",
          "graph-navigation-controls",
          "session-compaction-audit",
          "benchmark-dashboard",
          "canary-rollout",
          "research-source-lock",
          "model-autoresearch-matrix",
          "prompt-context-preview",
          "release-readiness-console",
          "lifecycle-policy",
          "review-queue",
          "wiki-vault",
          "wiki-sync-report",
          "selected-wiki-sync-disabled",
          "selected-wiki-sync-apply-disabled",
          "lifecycle-policy-apply-disabled",
          "review-queue-apply-disabled",
          "selected-local-edit-disabled",
          "selected-local-materialize-disabled",
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
