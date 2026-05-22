import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());

const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "bin/selfmem_update",
  "docs/LOCAL_CONTAINER_AUDIT.md",
  "docs/PRODUCTION_READINESS.md",
  "docs/PUBLIC_RELEASE_CHECKLIST.md",
  "docs/RELEASE_HANDOFF.md",
  "docs/MODEL_MATRIX.md",
  "docs/AUTORESEARCH_BENCHMARK_PLAN.md",
  "packages/brain-ui/fixtures/model-matrix.json",
  "packages/bench/release-blocker-doctor.mjs",
  "packages/bench/github-handoff-packet.mjs",
  `${reviewDir}/kickoff.md`,
  `${reviewDir}/summary.md`,
  `${reviewDir}/claude-pr5-review-blocked.md`,
  `${reviewDir}/session-compaction-evidence.md`,
  `${reviewDir}/session-compaction-benchmark-evidence.md`,
  `${reviewDir}/session-compaction-local-audit-evidence.md`,
  `${reviewDir}/gemini-session-compaction-local-audit-review.md`,
  `${reviewDir}/wiki-vault-evidence.md`,
  `${reviewDir}/wiki-vault-sync-evidence.md`,
  `${reviewDir}/gemini-wiki-sync-audit-log-review.md`,
  `${reviewDir}/update-flow-evidence.md`,
  `${reviewDir}/consumer-install-smoke-evidence.md`,
  `${reviewDir}/gemini-consumer-install-smoke-review.md`,
  `${reviewDir}/local-container-audit-evidence.md`,
  `${reviewDir}/gemini-local-container-audit-review.md`,
  `${reviewDir}/brain-ui-vault-preview-evidence.md`,
  `${reviewDir}/brain-ui-nucleus-snapshot-evidence.md`,
  `${reviewDir}/gemini-brain-ui-nucleus-snapshot-review.md`,
  `${reviewDir}/brain-ui-research-lineage-evidence.md`,
  `${reviewDir}/gemini-brain-ui-research-lineage-review.md`,
  `${reviewDir}/brain-ui-research-source-lock-evidence.md`,
  `${reviewDir}/gemini-brain-ui-research-source-lock-review.md`,
  `${reviewDir}/brain-ui-model-matrix-evidence.md`,
  `${reviewDir}/gemini-brain-ui-model-matrix-review.md`,
  `${reviewDir}/brain-ui-compaction-audit-evidence.md`,
  `${reviewDir}/gemini-brain-ui-compaction-audit-review.md`,
  `${reviewDir}/brain-ui-benchmark-dashboard-evidence.md`,
  `${reviewDir}/gemini-brain-ui-benchmark-dashboard-review.md`,
  `${reviewDir}/brain-ui-canary-rollout-evidence.md`,
  `${reviewDir}/gemini-brain-ui-canary-rollout-review.md`,
  `${reviewDir}/brain-ui-context-preview-evidence.md`,
  `${reviewDir}/gemini-brain-ui-context-preview-review.md`,
  `${reviewDir}/brain-ui-release-readiness-evidence.md`,
  `${reviewDir}/gemini-brain-ui-release-readiness-review.md`,
  `${reviewDir}/brain-ui-current-head-live-evidence.md`,
  `${reviewDir}/gemini-brain-ui-current-head-live-review.md`,
  `${reviewDir}/brain-ui-lifecycle-policy-evidence.md`,
  `${reviewDir}/gemini-brain-ui-lifecycle-policy-review.md`,
  `${reviewDir}/brain-ui-lifecycle-policy-apply-evidence.md`,
  `${reviewDir}/gemini-brain-ui-lifecycle-policy-apply-review.md`,
  `${reviewDir}/brain-ui-review-queue-evidence.md`,
  `${reviewDir}/gemini-brain-ui-review-queue-review.md`,
  `${reviewDir}/brain-ui-review-queue-apply-evidence.md`,
  `${reviewDir}/gemini-brain-ui-review-queue-apply-review.md`,
  `${reviewDir}/brain-ui-edit-export-evidence.md`,
  `${reviewDir}/gemini-brain-ui-edit-export-review.md`,
  `${reviewDir}/brain-ui-sync-report-evidence.md`,
  `${reviewDir}/gemini-brain-ui-sync-report-review.md`,
  `${reviewDir}/brain-ui-container-health-evidence.md`,
  `${reviewDir}/gemini-brain-ui-container-health-review.md`,
  `${reviewDir}/brain-ui-local-audit-preview-evidence.md`,
  `${reviewDir}/gemini-brain-ui-local-audit-preview-review.md`,
  `${reviewDir}/brain-ui-selected-local-audit-evidence.md`,
  `${reviewDir}/gemini-brain-ui-selected-local-audit-review.md`,
  `${reviewDir}/brain-ui-selected-local-browse-evidence.md`,
  `${reviewDir}/gemini-brain-ui-selected-local-browse-review.md`,
  `${reviewDir}/brain-ui-local-memory-edit-evidence.md`,
  `${reviewDir}/gemini-brain-ui-local-memory-edit-review.md`,
  `${reviewDir}/brain-ui-local-edit-overlay-browse-evidence.md`,
  `${reviewDir}/gemini-brain-ui-local-edit-overlay-browse-review.md`,
  `${reviewDir}/brain-ui-local-memory-materialize-evidence.md`,
  `${reviewDir}/gemini-brain-ui-local-memory-materialize-review.md`,
  `${reviewDir}/brain-ui-dynamic-layout-evidence.md`,
  `${reviewDir}/gemini-brain-ui-dynamic-layout-review.md`,
  `${reviewDir}/brain-ui-graph-navigation-evidence.md`,
  `${reviewDir}/gemini-brain-ui-graph-navigation-review.md`,
  `${reviewDir}/brain-ui-selected-audit-history-evidence.md`,
  `${reviewDir}/gemini-brain-ui-selected-audit-history-review.md`,
  `${reviewDir}/brain-ui-selected-sync-dry-run-evidence.md`,
  `${reviewDir}/gemini-brain-ui-selected-sync-dry-run-review.md`,
  `${reviewDir}/gemini-selected-sync-apply-review.md`,
  `${reviewDir}/brain-ui-interaction-smoke-evidence.md`,
  `${reviewDir}/gemini-brain-ui-interaction-smoke-review.md`,
  `${reviewDir}/gemini-browser-evidence-gate-review.md`,
  `${reviewDir}/gemini-selfmem-update-command-review.md`,
  `${reviewDir}/release-readiness-evidence.md`,
  `${reviewDir}/release-handoff-evidence.md`,
  `${reviewDir}/gemini-release-handoff-review.md`,
  `${reviewDir}/release-blocker-doctor-evidence.md`,
  `${reviewDir}/gemini-release-blocker-doctor-review.md`,
  `${reviewDir}/github-handoff-packet-evidence.md`,
  `${reviewDir}/gemini-github-handoff-packet-review.md`,
  `${reviewDir}/release-state.json`,
  `${reviewDir}/gemini-release-state-guard-review.md`,
  `${reviewDir}/production-readiness.md`,
  `${reviewDir}/completion-audit.md`,
  `${reviewDir}/gemini-completion-audit-review.md`,
  `${reviewDir}/gemini-production-readiness-review-blocked.md`,
  `${reviewDir}/public-live-update-draft.md`,
  `${reviewDir}/dummy-brain-demo-storyboard.md`,
  `${reviewDir}/gemini-public-live-update-copy-review.md`,
  `${reviewDir}/pr-body-update-draft.md`,
  `${reviewDir}/github-issue-create-blocked.md`,
  `${reviewDir}/gemini-blocker-permission-refresh-review.md`,
  `${reviewDir}/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`,
  `${reviewDir}/ui-evidence/brain-ui-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-fixture-edit.png`,
  `${reviewDir}/ui-evidence/brain-ui-vault-preview-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-vault-preview.png`,
  `${reviewDir}/ui-evidence/brain-ui-nucleus-snapshot-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-nucleus-snapshot.png`,
  `${reviewDir}/ui-evidence/brain-ui-research-lineage-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-research-lineage.png`,
  `${reviewDir}/ui-evidence/brain-ui-research-source-lock-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-research-source-lock.png`,
  `${reviewDir}/ui-evidence/brain-ui-model-matrix-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-model-matrix.png`,
  `${reviewDir}/ui-evidence/brain-ui-compaction-audit-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-compaction-audit.png`,
  `${reviewDir}/ui-evidence/brain-ui-benchmark-dashboard-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-benchmark-dashboard.png`,
  `${reviewDir}/ui-evidence/brain-ui-canary-rollout-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-canary-rollout.png`,
  `${reviewDir}/ui-evidence/brain-ui-context-preview-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-context-preview.png`,
  `${reviewDir}/ui-evidence/brain-ui-release-readiness-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-release-readiness.png`,
  `${reviewDir}/ui-evidence/brain-ui-current-head-live-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-current-head-live.png`,
  `${reviewDir}/ui-evidence/brain-ui-lifecycle-policy-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-lifecycle-policy.png`,
  `${reviewDir}/ui-evidence/brain-ui-review-queue-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-review-queue.png`,
  `${reviewDir}/ui-evidence/brain-ui-local-memory-edit.png`,
  `${reviewDir}/ui-evidence/brain-ui-local-edit-overlay-browse.png`,
  `${reviewDir}/ui-evidence/brain-ui-local-memory-materialize.png`,
  `${reviewDir}/ui-evidence/brain-ui-dynamic-layout-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-dynamic-layout.png`,
  `${reviewDir}/ui-evidence/brain-ui-graph-navigation-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-graph-navigation.png`,
  `${reviewDir}/ui-evidence/brain-ui-edit-export-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-edit-export.png`,
  `${reviewDir}/ui-evidence/brain-ui-sync-report-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-sync-report.png`,
  `${reviewDir}/ui-evidence/brain-ui-container-health-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-container-health.png`,
  `${reviewDir}/ui-evidence/brain-ui-local-audit-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-local-audit.png`,
  `${reviewDir}/ui-evidence/brain-ui-selected-local-audit-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-selected-local-audit.png`,
  `${reviewDir}/ui-evidence/brain-ui-selected-audit-history-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-selected-audit-history.png`,
  `${reviewDir}/ui-evidence/brain-ui-selected-sync-dry-run-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-selected-sync-dry-run.png`,
  `${reviewDir}/ui-evidence/brain-ui-browser-dom-evidence.json`,
];

const requiredScripts = [
  "build",
  "test",
  "typecheck",
  "privacy:test",
  "smoke:openclaw",
  "smoke:hermes",
  "brain:smoke",
  "brain:smoke:built",
  "brain:interaction",
  "brain:interaction:built",
  "container:audit:smoke",
  "container:audit:smoke:built",
  "compaction:smoke",
  "compaction:smoke:built",
  "compaction:benchmark",
  "compaction:benchmark:built",
  "compaction:local-audit",
  "compaction:local-audit:built",
  "wiki:smoke",
  "wiki:smoke:built",
  "wiki:sync:smoke",
  "wiki:sync:smoke:built",
  "update:smoke",
  "consumer:smoke",
  "release:doctor",
  "release:handoff",
  "smoke",
  "release:check",
];

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const forbiddenRuntimeFilePattern =
  /(^|\/)(memories|raw_events|lossless_context|trace)\.jsonl$|(^|\/)\.env($|\.)|(^|\/)\.npmrc$|(^|\/)(?:pnpm-debug|npm-debug|yarn-error)\.log$|(^|\/)\.DS_Store$|(^|\/)local-configs\/|(^|\/)(?:auth|credentials|cookies|browser-state)\.(?:json|yaml|yml|txt)$|\.(?:sqlite|sqlite3|db|zip|pem|p12|key)$/i;
const textExtensions = new Set([
  "",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonl",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".toml",
  ".txt",
  ".yaml",
  ".yml",
  ".example",
]);

const checks = [];

check("required files exist", () => {
  for (const file of requiredFiles) {
    const path = join(root, file);
    assert.ok(existsSync(path), `${file} missing`);
    assert.ok(statSync(path).size > 0, `${file} empty`);
  }
});

check("required scripts exist", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const script of requiredScripts) {
    assert.equal(typeof pkg.scripts?.[script], "string", `missing script ${script}`);
  }
});

check("selfmem_update command is mapped", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.bin?.selfmem_update, "./bin/selfmem_update");
  const command = join(root, "bin/selfmem_update");
  assert.ok(statSync(command).mode & 0o111, "bin/selfmem_update must be executable");
  assert.match(readFileSync(command, "utf8"), /^#!\/usr\/bin\/env sh/);
  run(command, ["--help"]);
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-bin-check-"));
  try {
    const symlinkPath = join(tempRoot, "selfmem_update");
    symlinkSync(command, symlinkPath);
    run(symlinkPath, ["--help"]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("dom evidence is sane", () => {
  const vaultEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-vault-preview-dom-evidence.json"), "utf8"),
  );
  assert.equal(vaultEvidence.ok, true);
  assert.equal(vaultEvidence.evidence.hasVaultPreviewHeading, true);
  assert.match(vaultEvidence.evidence.vaultStatus, /Lint clean/);
  assert.equal(vaultEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(vaultEvidence.consoleMessages.length, 0);
  assert.ok(vaultEvidence.evidence.vaultOptionCount >= 10);

  const containerEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-container-health-dom-evidence.json"), "utf8"),
  );
  assert.equal(containerEvidence.ok, true);
  assert.equal(containerEvidence.evidence.hasContainerHeading, true);
  assert.equal(containerEvidence.evidence.status, "healthy-fixture");
  assert.equal(containerEvidence.evidence.localContainerVisible, true);
  assert.equal(containerEvidence.evidence.hostedReadVisible, true);
  assert.equal(containerEvidence.evidence.providerModeVisible, true);
  assert.equal(containerEvidence.evidence.writeModeLocalOnlyVisible, true);
  assert.equal(containerEvidence.evidence.leakCountZeroVisible, true);
  assert.equal(containerEvidence.evidence.redactionCountVisible, true);
  assert.equal(containerEvidence.evidence.retrievalTraceVisible, true);
  assert.equal(containerEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(containerEvidence.consoleMessages.length, 0);

  const auditEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-local-audit-dom-evidence.json"), "utf8"),
  );
  assert.equal(auditEvidence.ok, true);
  assert.equal(auditEvidence.evidence.hasLocalAuditHeading, true);
  assert.equal(auditEvidence.evidence.statusNeedsReviewVisible, true);
  assert.equal(auditEvidence.evidence.existingFilesVisible, true);
  assert.equal(auditEvidence.evidence.redactionCountVisible, true);
  assert.equal(auditEvidence.evidence.missingFileVisible, true);
  assert.equal(auditEvidence.evidence.privateReasonVisible, true);
  assert.equal(auditEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(auditEvidence.consoleMessages.length, 0);

  const selectedAuditEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-selected-local-audit-dom-evidence.json"), "utf8"),
  );
  assert.equal(selectedAuditEvidence.ok, true);
  assert.equal(selectedAuditEvidence.evidence.hasSelectedAuditControls, true);
  assert.match(selectedAuditEvidence.evidence.status, /^\.\.\.\//);
  assert.equal(selectedAuditEvidence.evidence.inputCleared, true);
  assert.equal(selectedAuditEvidence.evidence.visibleTextHasRawRoot, false);
  assert.equal(selectedAuditEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(selectedAuditEvidence.evidence.redactedRootVisible, true);
  assert.equal(selectedAuditEvidence.consoleMessages.length, 0);

  const auditHistoryEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-selected-audit-history-dom-evidence.json"), "utf8"),
  );
  assert.equal(auditHistoryEvidence.ok, true);
  assert.equal(auditHistoryEvidence.evidence.historyCount, 1);
  assert.match(auditHistoryEvidence.evidence.historyText, /local_container_audit_preview/);
  assert.equal(auditHistoryEvidence.evidence.storedEntry.writesRealFiles, false);
  assert.equal(auditHistoryEvidence.evidence.inputCleared, true);
  assert.equal(auditHistoryEvidence.evidence.visibleTextHasRawRoot, false);
  assert.equal(auditHistoryEvidence.evidence.storedHasRawRoot, false);
  assert.equal(auditHistoryEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(auditHistoryEvidence.evidence.storedHasPrivate, false);
  assert.equal(auditHistoryEvidence.evidence.redactedRootVisible, true);
  assert.equal(auditHistoryEvidence.consoleMessages.length, 0);

  const selectedSyncEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-selected-sync-dry-run-dom-evidence.json"), "utf8"),
  );
  assert.equal(selectedSyncEvidence.ok, true);
  assert.equal(selectedSyncEvidence.evidence.hasSelectedSyncControls, true);
  assert.equal(selectedSyncEvidence.evidence.actionCount, 8);
  assert.equal(selectedSyncEvidence.evidence.actionTextHasConflict, true);
  assert.equal(selectedSyncEvidence.evidence.inputCleared, true);
  assert.equal(selectedSyncEvidence.evidence.visibleTextHasRawRoot, false);
  assert.equal(selectedSyncEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(selectedSyncEvidence.evidence.redactedRootVisible, true);
  assert.equal(selectedSyncEvidence.evidence.noWritesEnabledText, true);
  assert.equal(selectedSyncEvidence.consoleMessages.length, 0);

  const nucleusEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-nucleus-snapshot-dom-evidence.json"), "utf8"),
  );
  assert.equal(nucleusEvidence.ok, true);
  assert.equal(nucleusEvidence.evidence.hasNucleusSnapshotHeading, true);
  assert.equal(nucleusEvidence.evidence.mode, "fixture-nucleus-snapshot");
  assert.equal(nucleusEvidence.evidence.writesRealFiles, false);
  assert.ok(nucleusEvidence.evidence.nodeCount >= 8);
  assert.ok(nucleusEvidence.evidence.edgeCount >= 8);
  assert.equal(nucleusEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(nucleusEvidence.consoleMessages.length, 0);

  const lineageEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-research-lineage-dom-evidence.json"), "utf8"),
  );
  assert.equal(lineageEvidence.ok, true);
  assert.equal(lineageEvidence.evidence.hasResearchLineageHeading, true);
  assert.equal(lineageEvidence.evidence.fixtureModeVisible, true);
  assert.equal(lineageEvidence.evidence.writesRealFilesFalseVisible, true);
  assert.ok(lineageEvidence.evidence.cardCount >= 1);
  assert.ok(lineageEvidence.evidence.stepCount >= 3);
  assert.equal(lineageEvidence.evidence.hasQuery, true);
  assert.equal(lineageEvidence.evidence.hasHypothesis, true);
  assert.equal(lineageEvidence.evidence.hasDecision, true);
  assert.equal(lineageEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(lineageEvidence.consoleMessages.length, 0);

  const sourceLockEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-research-source-lock-evidence.json"), "utf8"),
  );
  assert.equal(sourceLockEvidence.ok, true);
  assert.equal(sourceLockEvidence.mode, "fixture-brain-ui-research-source-lock");
  assert.equal(sourceLockEvidence.writesRealFiles, false);
  assert.equal(sourceLockEvidence.metricsOnly, true);
  assert.equal(sourceLockEvidence.heading, "Research Source Lock");
  assert.equal(sourceLockEvidence.statusText, "source locked");
  assert.equal(sourceLockEvidence.sourceCount, 11);
  assert.ok(sourceLockEvidence.sourceLockedCount >= 9);
  assert.ok(sourceLockEvidence.recentSourceCount >= 6);
  assert.equal(sourceLockEvidence.privacyLeakCount, 0);
  assert.equal(sourceLockEvidence.hasGBrain, true);
  assert.equal(sourceLockEvidence.hasLlmWiki, true);
  assert.equal(sourceLockEvidence.hasObsidian, true);
  assert.equal(sourceLockEvidence.hasMemoryBench, true);
  assert.equal(sourceLockEvidence.hasHermes, true);
  assert.equal(sourceLockEvidence.hasStorageWatch, true);
  assert.equal(sourceLockEvidence.implementationRuleCount, 8);
  assert.equal(sourceLockEvidence.benchmarkTargetCount, 3);
  assert.ok(sourceLockEvidence.copyButtons >= 3);
  assert.ok(sourceLockEvidence.sourceLinks >= 10);
  assert.equal(sourceLockEvidence.visibleSourceLock, true);
  assert.equal(sourceLockEvidence.visibleTextHasPrivate, false);
  assert.equal(sourceLockEvidence.containerShowsHumanLabels, true);
  assert.equal(sourceLockEvidence.technicalExportCollapsed, true);
  assert.equal(sourceLockEvidence.consoleErrorCount, 0);

  const modelMatrixEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-model-matrix-evidence.json"), "utf8"),
  );
  assert.equal(modelMatrixEvidence.ok, true);
  assert.equal(modelMatrixEvidence.mode, "fixture-brain-ui-model-matrix");
  assert.equal(modelMatrixEvidence.writesRealFiles, false);
  assert.equal(modelMatrixEvidence.metricsOnly, true);
  assert.equal(modelMatrixEvidence.heading, "Model Matrix");
  assert.equal(modelMatrixEvidence.statusText, "guarded");
  assert.ok(modelMatrixEvidence.summaryCount >= 4);
  assert.ok(modelMatrixEvidence.localCount >= 6);
  assert.equal(modelMatrixEvidence.armCount, 6);
  assert.ok(modelMatrixEvidence.cloudArmCount >= 4);
  assert.ok(modelMatrixEvidence.localArmCount >= 2);
  assert.equal(modelMatrixEvidence.gateCount, 5);
  assert.equal(modelMatrixEvidence.blockerCount, 3);
  assert.equal(modelMatrixEvidence.hasAppleSilicon, true);
  assert.equal(modelMatrixEvidence.hasQwenLocal, true);
  assert.equal(modelMatrixEvidence.hasLlamaCpp, true);
  assert.equal(modelMatrixEvidence.hasVoyage, true);
  assert.equal(modelMatrixEvidence.hasGemini, true);
  assert.equal(modelMatrixEvidence.hasNvidiaNim, true);
  assert.equal(modelMatrixEvidence.queryExpansionOff, true);
  assert.equal(modelMatrixEvidence.envOnlyCredentials, true);
  assert.equal(modelMatrixEvidence.matchedCanaryGateVisible, true);
  assert.equal(modelMatrixEvidence.reviewerGateVisible, true);
  assert.equal(modelMatrixEvidence.hostedBaselineBlockerVisible, true);
  assert.equal(modelMatrixEvidence.technicalExportCollapsed, true);
  assert.equal(modelMatrixEvidence.hasPrivateOrKeyText, false);
  assert.equal(modelMatrixEvidence.visibleTextHasPrivate, false);
  assert.equal(modelMatrixEvidence.consoleErrorCount, 0);

  const compactionAuditEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-compaction-audit-evidence.json"), "utf8"),
  );
  assert.equal(compactionAuditEvidence.ok, true);
  assert.equal(compactionAuditEvidence.mode, "fixture-brain-ui-compaction-audit");
  assert.equal(compactionAuditEvidence.writesRealFiles, false);
  assert.equal(compactionAuditEvidence.metricsOnly, true);
  assert.equal(compactionAuditEvidence.evidence.hasCompactionHeading, true);
  assert.equal(compactionAuditEvidence.evidence.mode, "fixture-local-session-compaction-audit");
  assert.equal(compactionAuditEvidence.evidence.writesRealFiles, false);
  assert.equal(compactionAuditEvidence.evidence.metricsOnly, true);
  assert.equal(compactionAuditEvidence.evidence.eventCount, 6);
  assert.ok(compactionAuditEvidence.evidence.redactionCount >= 2);
  assert.ok(compactionAuditEvidence.evidence.outputCandidates >= 4);
  assert.equal(compactionAuditEvidence.evidence.chronological, true);
  assert.equal(compactionAuditEvidence.evidence.privacyLeakCount, 0);
  assert.ok(compactionAuditEvidence.evidence.exactIdentifierCandidateCount >= 1);
  assert.ok(compactionAuditEvidence.evidence.fingerprintCount >= 4);
  assert.equal(compactionAuditEvidence.evidence.candidateTextVisible, false);
  assert.equal(compactionAuditEvidence.evidence.hasPrivateOrKeyText, false);
  assert.equal(compactionAuditEvidence.evidence.exportHasCandidateText, false);
  assert.equal(compactionAuditEvidence.evidence.exportHasPrivateOrKeyText, false);
  assert.equal(compactionAuditEvidence.consoleErrorCount, 0);

  const benchmarkDashboardEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-benchmark-dashboard-evidence.json"), "utf8"),
  );
  assert.equal(benchmarkDashboardEvidence.ok, true);
  assert.equal(benchmarkDashboardEvidence.mode, "fixture-brain-ui-benchmark-dashboard");
  assert.equal(benchmarkDashboardEvidence.writesRealFiles, false);
  assert.equal(benchmarkDashboardEvidence.evidence.hasBenchmarkHeading, true);
  assert.equal(benchmarkDashboardEvidence.evidence.mode, "fixture-local-compaction-benchmark-dashboard");
  assert.equal(benchmarkDashboardEvidence.evidence.writesRealFiles, false);
  assert.equal(benchmarkDashboardEvidence.evidence.metricsOnly, true);
  assert.equal(benchmarkDashboardEvidence.evidence.verdict, "PASS");
  assert.equal(benchmarkDashboardEvidence.evidence.statusDataVerdict, "PASS");
  assert.equal(benchmarkDashboardEvidence.evidence.passedScenarios, 5);
  assert.equal(benchmarkDashboardEvidence.evidence.failedScenarios, 0);
  assert.equal(benchmarkDashboardEvidence.evidence.privacyLeakCount, 0);
  assert.equal(benchmarkDashboardEvidence.evidence.exactIdentifierAccuracy, 1);
  assert.ok(benchmarkDashboardEvidence.evidence.averageNoiseReductionRatio >= 0.2);
  assert.equal(benchmarkDashboardEvidence.evidence.scenarioCount, 5);
  assert.ok(benchmarkDashboardEvidence.evidence.caveatCount >= 3);
  assert.equal(benchmarkDashboardEvidence.evidence.hasHostedBaselineCaveat, true);
  assert.equal(benchmarkDashboardEvidence.evidence.hasNoRawTextCaveat, true);
  assert.equal(benchmarkDashboardEvidence.evidence.hasPrivateOrKeyText, false);
  assert.equal(benchmarkDashboardEvidence.consoleErrorCount, 0);

  const canaryRolloutEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-canary-rollout-evidence.json"), "utf8"),
  );
  assert.equal(canaryRolloutEvidence.ok, true);
  assert.equal(canaryRolloutEvidence.mode, "fixture-brain-ui-canary-rollout");
  assert.equal(canaryRolloutEvidence.writesRealFiles, false);
  assert.equal(canaryRolloutEvidence.evidence.hasCanaryHeading, true);
  assert.equal(canaryRolloutEvidence.evidence.verdict, "READY_FOR_ONE_AGENT_CANARY");
  assert.equal(canaryRolloutEvidence.evidence.statusDataVerdict, "READY_FOR_ONE_AGENT_CANARY");
  assert.equal(canaryRolloutEvidence.evidence.mode, "fixture-one-agent-canary-rollout");
  assert.equal(canaryRolloutEvidence.evidence.writesRealFiles, false);
  assert.equal(canaryRolloutEvidence.evidence.metricsOnly, true);
  assert.equal(canaryRolloutEvidence.evidence.targetScope, "one-agent");
  assert.equal(canaryRolloutEvidence.evidence.hostedSupermemoryMode, "read-through-only");
  assert.equal(canaryRolloutEvidence.evidence.publicLaunchVerdict, "FAIL");
  assert.equal(canaryRolloutEvidence.evidence.publicLaunchStillBlocked, true);
  assert.equal(canaryRolloutEvidence.evidence.ownerApprovalRequired, true);
  assert.equal(canaryRolloutEvidence.evidence.privacyLeakCount, 0);
  assert.equal(canaryRolloutEvidence.evidence.prerequisiteCount, 4);
  assert.equal(canaryRolloutEvidence.evidence.failedPrerequisites, 0);
  assert.equal(canaryRolloutEvidence.evidence.stepCount, 5);
  assert.ok(canaryRolloutEvidence.evidence.metricCount >= 10);
  assert.ok(canaryRolloutEvidence.evidence.blockerCount >= 3);
  assert.equal(canaryRolloutEvidence.evidence.hasRollbackStep, true);
  assert.equal(canaryRolloutEvidence.evidence.hasDryRunStep, true);
  assert.equal(canaryRolloutEvidence.evidence.hasPrivacyMetric, true);
  assert.equal(canaryRolloutEvidence.evidence.hasLatencyMetric, true);
  assert.equal(canaryRolloutEvidence.evidence.hasHumanBlocker, true);
  assert.equal(canaryRolloutEvidence.evidence.hasCanaryNotLaunchCaveat, true);
  assert.equal(canaryRolloutEvidence.evidence.hasPrivateOrKeyText, false);
  assert.equal(canaryRolloutEvidence.consoleErrorCount, 0);

  const contextPreviewEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-context-preview-evidence.json"), "utf8"),
  );
  assert.equal(contextPreviewEvidence.ok, true);
  assert.equal(contextPreviewEvidence.mode, "fixture-brain-ui-context-preview");
  assert.equal(contextPreviewEvidence.writesRealFiles, false);
  assert.equal(contextPreviewEvidence.evidence.hasContextPreviewHeading, true);
  assert.equal(contextPreviewEvidence.evidence.mode, "fixture-prompt-context-preview");
  assert.equal(contextPreviewEvidence.evidence.writesRealFiles, false);
  assert.equal(contextPreviewEvidence.evidence.tokenBudget, 900);
  assert.equal(contextPreviewEvidence.evidence.totalTokens, 642);
  assert.equal(contextPreviewEvidence.evidence.budgetRemaining, 258);
  assert.equal(contextPreviewEvidence.evidence.selectedMemoryCount, 3);
  assert.equal(contextPreviewEvidence.evidence.sectionCount, 3);
  assert.equal(contextPreviewEvidence.evidence.omittedCount, 2);
  assert.equal(contextPreviewEvidence.evidence.privacyLeakCount, 0);
  assert.equal(contextPreviewEvidence.evidence.hostedReadThrough, "read-only");
  assert.equal(contextPreviewEvidence.evidence.writeMode, "local-only");
  assert.equal(contextPreviewEvidence.evidence.hasCompiledContext, true);
  assert.equal(contextPreviewEvidence.evidence.hasGuardrailsSection, true);
  assert.equal(contextPreviewEvidence.evidence.hasOmittedNoiseCandidate, true);
  assert.equal(contextPreviewEvidence.evidence.hasPrivateOrKeyText, false);
  assert.equal(contextPreviewEvidence.consoleErrorCount, 0);

  const releaseReadinessEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-release-readiness-evidence.json"), "utf8"),
  );
  assert.equal(releaseReadinessEvidence.ok, true);
  assert.equal(releaseReadinessEvidence.mode, "fixture-brain-ui-release-readiness");
  assert.equal(releaseReadinessEvidence.writesRealFiles, false);
  assert.equal(releaseReadinessEvidence.evidence.hasReleaseReadinessHeading, true);
  assert.equal(releaseReadinessEvidence.evidence.mode, "fixture-release-readiness-console");
  assert.equal(releaseReadinessEvidence.evidence.writesRealFiles, false);
  assert.equal(releaseReadinessEvidence.evidence.metricsOnly, true);
  assert.equal(releaseReadinessEvidence.evidence.verdict, "FAIL");
  assert.equal(releaseReadinessEvidence.evidence.statusDataVerdict, "FAIL");
  assert.equal(releaseReadinessEvidence.evidence.productionReady, false);
  assert.equal(releaseReadinessEvidence.evidence.codeCiConclusion, "success");
  assert.ok(releaseReadinessEvidence.evidence.blockerCount >= 4);
  assert.ok(releaseReadinessEvidence.evidence.surfaceCount >= 10);
  assert.ok(releaseReadinessEvidence.evidence.manualActionCount >= 4);
  assert.equal(releaseReadinessEvidence.evidence.privacyLeakCount, 0);
  assert.equal(releaseReadinessEvidence.evidence.fixtureOnly, true);
  assert.equal(releaseReadinessEvidence.evidence.hostedWriteBackDisabled, true);
  assert.equal(releaseReadinessEvidence.evidence.hasHumanApprovalBlocker, true);
  assert.equal(releaseReadinessEvidence.evidence.hasClaudeBlocker, true);
  assert.equal(releaseReadinessEvidence.evidence.hasManualCanaryAction, true);
  assert.equal(releaseReadinessEvidence.evidence.hasPrivateOrKeyText, false);
  assert.equal(releaseReadinessEvidence.consoleErrorCount, 0);

  const currentHeadLiveEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-current-head-live-evidence.json"), "utf8"),
  );
  assert.equal(currentHeadLiveEvidence.ok, true);
  assert.equal(currentHeadLiveEvidence.mode, "current-head-live-browser");
  assert.match(currentHeadLiveEvidence.head ?? "", /^[a-f0-9]{40}$/);
  assert.equal(currentHeadLiveEvidence.title, "RecallWeave Brain");
  assert.equal(currentHeadLiveEvidence.writesRealFiles, false);
  assert.equal(currentHeadLiveEvidence.fixtureOnly, true);
  assert.equal(currentHeadLiveEvidence.consoleErrorOrWarningCount, 0);
  assert.equal(currentHeadLiveEvidence.privateLeakCount, 0);
  assert.ok(currentHeadLiveEvidence.screenshotPixels?.width >= 1000);
  assert.ok(currentHeadLiveEvidence.screenshotPixels?.height >= 900);
  for (const [name, value] of Object.entries(currentHeadLiveEvidence.checks)) {
    if (name === "hasPrivateOrKeyText") {
      assert.equal(value, false, "current-head browser evidence must not show private or key-shaped text");
    } else {
      assert.equal(value, true, `current-head browser evidence missing ${name}`);
    }
  }

  const policyEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-lifecycle-policy-dom-evidence.json"), "utf8"),
  );
  assert.equal(policyEvidence.ok, true);
  assert.equal(policyEvidence.evidence.hasPolicyHeading, true);
  assert.equal(policyEvidence.evidence.hasPolicyControls, true);
  assert.equal(policyEvidence.evidence.draftMode, "fixture-lifecycle-policy-draft");
  assert.equal(policyEvidence.evidence.writesRealFiles, false);
  assert.equal(policyEvidence.evidence.forceEveryTurn, true);
  assert.equal(policyEvidence.evidence.maxAutoWritesPerSession, 8);
  assert.equal(policyEvidence.evidence.lowConfidenceAction, "suppress");
  assert.deepEqual(policyEvidence.evidence.changedFields, [
    "recall.forceEveryTurn",
    "writes.maxAutoWritesPerSession",
    "writes.lowConfidenceAction",
  ]);
  assert.equal(policyEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(policyEvidence.evidence.draftTextHasPrivate, false);
  assert.equal(policyEvidence.evidence.draftTextHasWritesRealFilesFalse, true);
  assert.equal(policyEvidence.consoleMessages.length, 0);

  const reviewQueueEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-review-queue-dom-evidence.json"), "utf8"),
  );
  assert.equal(reviewQueueEvidence.ok, true);
  assert.equal(reviewQueueEvidence.evidence.hasReviewQueueHeading, true);
  assert.equal(reviewQueueEvidence.evidence.hasReviewControls, true);
  assert.equal(reviewQueueEvidence.evidence.controlsHaveName, true);
  assert.equal(reviewQueueEvidence.evidence.draftMode, "fixture-memory-review-queue");
  assert.equal(reviewQueueEvidence.evidence.writesRealFiles, false);
  assert.equal(reviewQueueEvidence.evidence.candidateCount, 3);
  assert.equal(reviewQueueEvidence.evidence.changedCount, 1);
  assert.equal(reviewQueueEvidence.evidence.maintenanceAction, "needs_more_evidence");
  assert.equal(reviewQueueEvidence.evidence.duplicateAction, "merge");
  assert.equal(reviewQueueEvidence.evidence.highValueAction, "approve");
  assert.equal(reviewQueueEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(reviewQueueEvidence.evidence.draftTextHasPrivate, false);
  assert.equal(reviewQueueEvidence.evidence.draftTextHasWritesRealFilesFalse, true);
  assert.equal(reviewQueueEvidence.consoleMessages.length, 0);

  const editEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-edit-export-dom-evidence.json"), "utf8"),
  );
  assert.equal(editEvidence.ok, true);
  assert.equal(editEvidence.evidence.hasDraftExportHeading, true);
  assert.equal(editEvidence.evidence.writesRealFiles, false);
  assert.ok(editEvidence.evidence.editCount >= 1);
  assert.equal(editEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(editEvidence.consoleMessages.length, 0);

  const syncEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-sync-report-dom-evidence.json"), "utf8"),
  );
  assert.equal(syncEvidence.ok, true);
  assert.equal(syncEvidence.evidence.hasSyncReportHeading, true);
  assert.match(syncEvidence.evidence.syncStatus, /Dry run/i);
  assert.ok(syncEvidence.evidence.conflictActionCount >= 1);
  assert.equal(syncEvidence.evidence.visibleTextHasPrivate, false);
  assert.equal(syncEvidence.consoleMessages.length, 0);

  const browserEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-browser-dom-evidence.json"), "utf8"),
  );
  assert.equal(browserEvidence.ok, true);
  assert.match(browserEvidence.head ?? "", /^[a-f0-9]{40}$/);
  for (const [name, value] of Object.entries(browserEvidence.evidence.checks)) {
    if (name === "hasPrivateOrKeyText") {
      assert.equal(value, false, "browser evidence must not show private or key-shaped text");
    } else {
      assert.equal(value, true, `browser evidence missing ${name}`);
    }
  }
  assert.ok(browserEvidence.evidence.sectionCount >= 10);
  assert.ok(browserEvidence.evidence.inputs.some((input) => input.id === "selectedSyncPath"));
  assert.ok(browserEvidence.evidence.inputs.some((input) => input.id === "selectedSyncApplyPath"));
  assert.ok(browserEvidence.evidence.inputs.some((input) => input.id === "selectedAuditPath"));
  assert.ok(browserEvidence.evidence.inputs.some((input) => input.id === "localEditPath"));
  assert.ok(browserEvidence.evidence.inputs.some((input) => input.id === "localMaterializePath"));
  assert.equal(browserEvidence.evidence.checks.hasLocalEditOverlayBrowse, true);
  assert.equal(browserEvidence.evidence.checks.hasLocalEditOverlayPreview, true);
  assert.equal(browserEvidence.evidence.checks.hasLocalMemoryMaterialize, true);
  assert.equal(browserEvidence.evidence.checks.hasLocalMaterializeBackup, true);

  const layoutEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-dynamic-layout-evidence.json"), "utf8"),
  );
  assert.equal(layoutEvidence.ok, true);
  assert.equal(layoutEvidence.layoutMode, "dynamic-graph-layout");
  assert.equal(layoutEvidence.nodeCount, 9);
  assert.equal(layoutEvidence.edgeCount, 9);
  assert.ok(layoutEvidence.layoutColumns >= 2);
  assert.ok(layoutEvidence.layoutRows >= 4);
  assert.equal(layoutEvidence.overlapCount, 0);
  assert.equal(layoutEvidence.hasPrivateOrKeyText, false);
  assert.equal(layoutEvidence.consoleErrorCount, 0);

  const graphNavigationEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "ui-evidence/brain-ui-graph-navigation-evidence.json"), "utf8"),
  );
  assert.equal(graphNavigationEvidence.ok, true);
  assert.equal(graphNavigationEvidence.mode, "fixture-graph-navigation-controls");
  assert.equal(graphNavigationEvidence.writesRealFiles, false);
  assert.equal(graphNavigationEvidence.scope, "neighborhood");
  assert.ok(graphNavigationEvidence.visibleNodeCount >= 1);
  assert.ok(graphNavigationEvidence.jumpOptions >= graphNavigationEvidence.visibleNodeCount);
  assert.equal(graphNavigationEvidence.selectedVisible, true);
  assert.equal(graphNavigationEvidence.activeNeighborhood, true);
  assert.equal(graphNavigationEvidence.hasGraphToolbar, true);
  assert.equal(graphNavigationEvidence.hasJumpSelect, true);
  assert.equal(graphNavigationEvidence.hasCenterButton, true);
  assert.equal(graphNavigationEvidence.hasPrivateOrKeyText, false);
  assert.equal(graphNavigationEvidence.consoleErrorCount, 0);
});

check("release state is conservative", () => {
  const releaseState = JSON.parse(readFileSync(join(root, reviewDir, "release-state.json"), "utf8"));
  assert.equal(releaseState.schemaVersion, 1);
  assert.equal(releaseState.goalStatus, "active");
  assert.equal(releaseState.publicLaunchVerdict, "FAIL");
  assert.equal(releaseState.productionReady, false);
  assert.equal(releaseState.pullRequest?.number, 5);
  assert.equal(releaseState.pullRequest?.branch, "feat/nucleus-wiki-native-contract");
  assert.equal(releaseState.latestVerifiedCodeBaseline?.ciConclusion, "success");
  assert.match(releaseState.latestVerifiedCodeBaseline?.headSha ?? "", /^[a-f0-9]{40}$/);
  assert.equal(releaseState.latestVerifiedCodeBaseline?.localReleaseCheck, "passed");
  assert.equal(releaseState.latestVerifiedCodeBaseline?.secretScan, "zero_hits");
  assert.equal(releaseState.releaseStateGuard?.enabled, true);
  assert.equal(releaseState.releaseStateGuard?.checkedBy, "pnpm release:check");
  assert.equal(releaseState.releaseStateGuard?.requiresConservativeVerdict, true);
  assert.equal(releaseState.safetyBoundary?.usesFixtureUiEvidence, true);
  assert.equal(releaseState.safetyBoundary?.commitsRawMemories, false);
  assert.equal(releaseState.safetyBoundary?.commitsRawTranscripts, false);
  assert.equal(releaseState.safetyBoundary?.commitsCredentials, false);
  assert.equal(releaseState.safetyBoundary?.enablesHostedWriteBack, false);
  for (const surface of [
    "brain-ui-selected-vault-sync-dry-run",
    "brain-ui-selected-vault-sync-apply",
    "brain-ui-selected-local-container-browse",
    "brain-ui-lifecycle-policy-preview",
    "brain-ui-lifecycle-policy-apply",
    "brain-ui-memory-review-queue",
    "brain-ui-memory-review-queue-apply",
    "brain-ui-selected-local-memory-edit",
    "brain-ui-local-edit-overlay-browse",
    "brain-ui-selected-local-memory-materialize",
    "brain-ui-dynamic-graph-layout",
    "brain-ui-graph-navigation-controls",
    "brain-ui-session-compaction-audit",
    "brain-ui-benchmark-dashboard",
    "brain-ui-canary-rollout",
    "brain-ui-research-source-lock",
    "brain-ui-model-matrix",
    "brain-ui-prompt-context-preview",
    "brain-ui-release-readiness-console",
    "brain-ui-current-head-live-browser",
    "model-autoresearch-matrix",
    "session-compaction-benchmark",
    "session-compaction-local-audit",
    "clean-consumer-smoke",
    "release-blocker-doctor",
    "github-handoff-packet",
    "selfmem-update",
  ]) {
    assert.ok(releaseState.provenPreviewSurfaces?.includes(surface), `missing release surface ${surface}`);
  }
  for (const blocker of [
    "claude-reviewer-route-blocked",
    "github-pr-body-update-blocked",
    "github-issue-create-blocked",
    "human-public-launch-approval-required",
    "hosted-supermemory-baseline-not-current",
  ]) {
    assert.ok(releaseState.remainingBlockers?.includes(blocker), `missing release blocker ${blocker}`);
  }
});

check("release docs mention current preview surfaces", () => {
  const files = [
    "completion-audit.md",
    "production-readiness.md",
    "summary.md",
    "pr-body-update-draft.md",
    "public-live-update-draft.md",
  ];
  for (const file of files) {
    const text = readFileSync(join(root, reviewDir, file), "utf8");
    assert.match(text, /selected vault sync dry-run|selected local vault sync dry-run/i, `${file} missing selected sync`);
    assert.match(text, /selected vault sync apply|selected local vault sync apply/i, `${file} missing selected sync apply`);
    assert.match(text, /selected local-container browse|selected local container browse/i, `${file} missing selected browse`);
    assert.match(text, /lifecycle policy/i, `${file} missing lifecycle policy`);
    assert.match(text, /lifecycle policy apply|selected lifecycle policy apply/i, `${file} missing lifecycle policy apply`);
    assert.match(text, /memory review queue/i, `${file} missing memory review queue`);
    assert.match(text, /review queue apply|selected memory review queue apply|selected review queue apply/i, `${file} missing review queue apply`);
    assert.match(text, /local memory edit|selected local memory edit/i, `${file} missing local memory edit`);
    assert.match(text, /overlay browse|edit overlay.*browse|browse.*edit overlay/i, `${file} missing edit overlay browse`);
    assert.match(text, /materialize|materialization/i, `${file} missing local memory materialize`);
    assert.match(text, /dynamic graph layout|dynamic layout|graph layout/i, `${file} missing dynamic graph layout`);
    assert.match(text, /graph navigation|jump-to-node|neighborhood scope|all-vs-neighborhood/i, `${file} missing graph navigation`);
    assert.match(text, /compaction audit|local-session compaction/i, `${file} missing compaction audit`);
    assert.match(text, /benchmark dashboard|benchmark summary|compaction benchmark/i, `${file} missing benchmark dashboard`);
    assert.match(text, /canary rollout|one-agent canary|selfmem_update/i, `${file} missing canary rollout`);
    assert.match(text, /research source lock|source-lock|source lock/i, `${file} missing research source lock`);
    assert.match(text, /model matrix|model\/autoresearch|model-autoresearch/i, `${file} missing model matrix`);
    assert.match(text, /context preview|prompt context|recall packet/i, `${file} missing context preview`);
    assert.match(text, /release readiness|public launch verdict|production ready/i, `${file} missing release readiness`);
    assert.match(text, /current-head live|fresh.*browser|live browser/i, `${file} missing current-head live browser evidence`);
    assert.match(text, /clean consumer|consumer smoke|clean checkout/i, `${file} missing clean consumer smoke`);
    assert.match(text, /blocker doctor|release doctor|release blocker/i, `${file} missing release blocker doctor`);
    assert.match(text, /github handoff|handoff packet|manual GitHub/i, `${file} missing GitHub handoff packet`);
    assert.doesNotMatch(text, /run #43|5 files and 18 tests/, `${file} contains stale verification wording`);
  }
});

check("release handoff documents blocked launch path", () => {
  const text = readFileSync(join(root, "docs/RELEASE_HANDOFF.md"), "utf8");
  assert.match(text, /PR #5/);
  assert.match(text, /pr-body-update-draft\.md/);
  assert.match(text, /blocker-fresh-brain-ui-launch-and-release-gate\.md/);
  assert.match(text, /blocked Claude route|Claude CLI/i);
  assert.match(text, /public launch verdict as `FAIL`|publicLaunchVerdict: "FAIL"/);
  assert.match(text, /selfmem_update/);
  assert.match(text, /release:handoff/);
  assert.match(text, /handoff packet/i);
  assert.match(text, /one-agent canary/i);
  assert.match(text, /Do not paste private diagnostics/);
});

check("model matrix and autoresearch gate stay conservative", () => {
  const modelMatrix = readFileSync(join(root, "docs/MODEL_MATRIX.md"), "utf8");
  const autoresearchPlan = readFileSync(join(root, "docs/AUTORESEARCH_BENCHMARK_PLAN.md"), "utf8");
  const providerMatrix = readFileSync(join(root, "configs/provider-matrix.yaml"), "utf8");
  const budget = readFileSync(join(root, "configs/bench-budget.yaml"), "utf8");

  assert.match(modelMatrix, /Qwen3-Embedding-0\.6B-GGUF/);
  assert.match(modelMatrix, /llama\.cpp/);
  assert.match(modelMatrix, /Apple Silicon/i);
  assert.match(modelMatrix, /NVIDIA NIM/i);
  assert.match(modelMatrix, /Query expansion is off by default/i);
  assert.match(modelMatrix, /Opus 4\.7/i);
  assert.match(modelMatrix, /Codex GPT-5\.5/i);
  assert.match(autoresearchPlan, /matched source-locked canary/i);
  assert.match(autoresearchPlan, /Do not publish/i);
  assert.match(autoresearchPlan, /same dataset slice/i);
  assert.match(providerMatrix, /defaultLocalArm: local-apple-qwen3-0_6b/);
  assert.match(providerMatrix, /cloud-nvidia-nemotron-1b/);
  assert.match(providerMatrix, /cloud-gemini2-cohere4pro/);
  assert.match(providerMatrix, /defaultProvider: none/);
  assert.match(budget, /requireCleanLocalModelRuntimeForLatency: true/);
  assert.match(budget, /stopOnlyRecallWeaveOwnedProcesses: true/);
  for (const text of [modelMatrix, autoresearchPlan, providerMatrix, budget]) {
    assert.doesNotMatch(text, secretPattern);
  }
});

check("fresh local session compaction audit passes", () => {
  run("node", ["packages/bench/session-compaction-local-audit.mjs", "--strict"]);
});

check("fresh brain UI smoke passes", () => {
  run("node", ["packages/brain-ui/smoke.mjs"]);
});

check("fresh brain UI interaction smoke passes", () => {
  run("node", ["packages/brain-ui/interaction-smoke.mjs"]);
});

check("fresh local container audit smoke passes", () => {
  run("node", ["packages/bench/local-container-audit-smoke.mjs"]);
});

check("fresh clean consumer smoke passes", () => {
  run("node", ["packages/bench/consumer-install-smoke.mjs"]);
});

check("fresh release blocker doctor passes", () => {
  run("node", ["packages/bench/release-blocker-doctor.mjs"]);
});

check("fresh GitHub handoff packet passes", () => {
  const result = run("node", ["packages/bench/github-handoff-packet.mjs"]);
  const packet = JSON.parse(result.stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-github-handoff-packet-review.md"), "utf8");
  const releaseState = JSON.parse(readFileSync(join(root, reviewDir, "release-state.json"), "utf8"));
  assert.equal(packet.ok, true);
  assert.equal(packet.mode, "github-handoff-packet");
  assert.equal(packet.writesRealFiles, false);
  assert.equal(packet.repository, "radbroradbro/selfmem-agent-memory");
  assert.equal(packet.pullRequest, 5);
  assert.equal(packet.publicLaunchAllowed, false);
  assert.equal(packet.productionReady, false);
  assert.equal(packet.latestVerifiedCodeBaseline?.ciRunId, releaseState.latestVerifiedCodeBaseline?.ciRunId);
  assert.equal(packet.latestVerifiedCodeBaseline?.ciConclusion, "success");
  assert.equal(packet.safety?.privateLeakCount, 0);
  assert.equal(packet.safety?.hasSecretPattern, false);
  assert.equal(packet.safety?.fixtureOnly, true);
  assert.match(packet.prBody, /Current-head live browser evidence/i);
  assert.match(packet.prBody, /release blocker doctor/i);
  assert.match(packet.prBody, new RegExp(String(releaseState.latestVerifiedCodeBaseline?.ciRunId)));
  assert.match(packet.statusComment, /public launch verdict: FAIL/i);
  assert.match(packet.issueBody, /Acceptance Criteria/);
  assert.ok(packet.labels.includes("not-production-ready"));
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
});

check("git diff check passes", () => {
  run("git", ["diff", "--check"]);
});

check("remote url has no token", () => {
  const remote = run("git", ["remote", "get-url", "origin"]).stdout.trim();
  assert.doesNotMatch(remote, /:\/\/[^/\s]+@/);
  assert.doesNotMatch(remote, /(ghp_|github_pat_|[?&]token=)/);
});

check("core package dry-run pack passes", () => {
  run("npm", ["pack", "--dry-run"], { cwd: join(root, "packages/core") });
});

const files = await listFiles(root);

check("forbidden runtime files are absent", () => {
  const forbidden = files
    .map((file) => relative(root, file).replaceAll("\\", "/"))
    .filter((file) => forbiddenRuntimeFilePattern.test(file))
    .filter((file) => file !== ".env.example");
  assert.deepEqual(forbidden, []);
});

check("secret scan has zero hits", () => {
  const hits = [];
  for (const file of files) {
    if (!textExtensions.has(extname(file))) continue;
    const rel = relative(root, file).replaceAll("\\", "/");
    const text = readFileSync(file, "utf8");
    if (secretPattern.test(text)) hits.push(rel);
  }
  assert.deepEqual(hits, []);
});

const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed\n${result.stderr}\n${result.stdout}`);
  return result;
}

async function listFiles(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listFiles(path)));
      continue;
    }
    if (entry.isFile()) output.push(path);
  }
  return output;
}

function shouldSkip(name) {
  return [".git", ".goal-loop-review", "node_modules", "coverage"].includes(name);
}

async function latestReviewDir() {
  const entries = await readdir(join(root, "reviews"), { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `reviews/${entry.name}`)
    .sort();
  assert.ok(dirs.length > 0, "no review evidence directories found");
  return dirs.at(-1);
}
