import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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
  "packages/brain-ui/static-evidence.mjs",
  "packages/bench/canary-report-from-trace.mjs",
  "packages/bench/canary-evidence-intake.mjs",
  "packages/bench/canary-remediation.mjs",
  "packages/bench/canary-operator-packet.mjs",
  "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
  "packages/bench/fixtures/hosted-baseline-search-responses.fixture.json",
  "packages/bench/fixtures/hosted-baseline-result.fixture.json",
  "packages/bench/fixtures/canary-runtime-container-map.fixture.json",
  "packages/bench/fixtures/canary-runtime-trace.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-raw.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-memories.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-report.fixture.json",
  "packages/bench/fixtures/canary-runtime-report-failing.fixture.json",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary_metadata/trace_metadata_only.jsonl",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/containers/selfmem_fixture_agent/container-map.json",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/reliability_reports/latest.json",
  "packages/bench/hosted-baseline-preflight.mjs",
  "packages/bench/hosted-baseline-collector.mjs",
  "packages/bench/hosted-baseline-operator-packet.mjs",
  "packages/bench/release-blocker-doctor.mjs",
  "packages/bench/github-handoff-packet.mjs",
  "packages/bench/github-live-sync-check.mjs",
  "packages/bench/goal-completion-audit.mjs",
  `${reviewDir}/kickoff.md`,
  `${reviewDir}/summary.md`,
  `${reviewDir}/claude-pr5-review-blocked.md`,
  `${reviewDir}/claude-pr5-review.md`,
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
  `${reviewDir}/brain-ui-static-evidence.md`,
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
  `${reviewDir}/canary-report-generator-evidence.md`,
  `${reviewDir}/gemini-canary-report-generator-review.md`,
  `${reviewDir}/canary-evidence-intake-evidence.md`,
  `${reviewDir}/gemini-canary-evidence-intake-review.md`,
  `${reviewDir}/canary-remediation-evidence.md`,
  `${reviewDir}/gemini-canary-remediation-review.md`,
  `${reviewDir}/canary-operator-packet-evidence.md`,
  `${reviewDir}/gemini-canary-operator-packet-review.md`,
  `${reviewDir}/gemini-adapter-store-latency-review.md`,
  `${reviewDir}/gemini-fresh-canary-window-review.md`,
  `${reviewDir}/claude-fresh-canary-window-review-blocked.md`,
  `${reviewDir}/hosted-baseline-preflight-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-preflight-review.md`,
  `${reviewDir}/hosted-baseline-collector-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-collector-review.md`,
  `${reviewDir}/hosted-baseline-operator-packet-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-operator-packet-review.md`,
  `${reviewDir}/github-handoff-packet-evidence.md`,
  `${reviewDir}/gemini-github-handoff-packet-review.md`,
  `${reviewDir}/github-live-sync-evidence.md`,
  `${reviewDir}/goal-completion-audit-evidence.md`,
  `${reviewDir}/gemini-goal-completion-audit-review.md`,
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
  `${reviewDir}/github-write-route-evidence.md`,
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
  "brain:evidence:static",
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
  "canary:report",
  "canary:intake",
  "canary:diagnose",
  "canary:operator-packet",
  "baseline:preflight",
  "baseline:collect",
  "baseline:operator-packet",
  "goal:audit",
  "release:doctor",
  "release:handoff",
  "release:github-sync",
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
  const help = run(command, ["--help"]).stdout;
  assert.match(help, /--run-canary/);
  assert.match(help, /--canary-output/);
  assert.match(help, /--canary-since/);
  assert.match(help, /--canary-last-minutes/);
  assert.match(help, /--strict-real/);
  assert.match(help, /--rollback-tested/);
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
    "canary-report-generator",
    "canary-diagnostic-bundle-report",
    "canary-evidence-intake",
    "canary-remediation-plan",
    "canary-operator-packet",
    "hosted-baseline-preflight",
    "hosted-baseline-collector",
    "hosted-baseline-operator-packet",
    "claude-opus-pr5-review",
    "github-handoff-packet",
    "github-live-sync-check",
    "github-pr-body-live",
    "github-blocker-issue-live",
    "goal-completion-audit",
    "selfmem-update",
  ]) {
    assert.ok(releaseState.provenPreviewSurfaces?.includes(surface), `missing release surface ${surface}`);
  }
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.status, "completed_with_concerns");
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.verdict, "CONCERNS");
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.countsAsPublicLaunchApproval, false);
  for (const blocker of [
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
    assert.match(text, /canary report generator|canary:report|trace-derived canary/i, `${file} missing canary report generator`);
    assert.match(text, /canary evidence intake|canary:intake|runtime canary evidence/i, `${file} missing canary evidence intake`);
    assert.match(text, /canary diagnose|canary:diagnose|remediation/i, `${file} missing canary remediation`);
    assert.match(text, /operator packet|canary operator|strict-real.*packet/i, `${file} missing canary operator packet`);
    assert.match(text, /research source lock|source-lock|source lock/i, `${file} missing research source lock`);
    assert.match(text, /model matrix|model\/autoresearch|model-autoresearch/i, `${file} missing model matrix`);
    assert.match(text, /context preview|prompt context|recall packet/i, `${file} missing context preview`);
    assert.match(text, /release readiness|public launch verdict|production ready/i, `${file} missing release readiness`);
    assert.match(text, /current-head live|fresh.*browser|live browser/i, `${file} missing current-head live browser evidence`);
    assert.match(text, /clean consumer|consumer smoke|clean checkout/i, `${file} missing clean consumer smoke`);
    assert.match(text, /blocker doctor|release doctor|release blocker/i, `${file} missing release blocker doctor`);
    assert.match(text, /hosted baseline preflight|baseline preflight/i, `${file} missing hosted baseline preflight`);
    assert.match(text, /hosted baseline collector|baseline:collect|baseline collect/i, `${file} missing hosted baseline collector`);
    assert.match(text, /hosted baseline operator|baseline:operator-packet|baseline operator packet/i, `${file} missing hosted baseline operator packet`);
    assert.match(text, /github handoff|handoff packet|manual GitHub/i, `${file} missing GitHub handoff packet`);
    assert.match(text, /github live sync|release:github-sync|live GitHub sync/i, `${file} missing GitHub live sync`);
    assert.match(text, /goal completion audit|goal:audit|completion audit/i, `${file} missing goal completion audit`);
    assert.doesNotMatch(text, /run #43|5 files and 18 tests/, `${file} contains stale verification wording`);
  }
});

check("release handoff documents blocked launch path", () => {
  const text = readFileSync(join(root, "docs/RELEASE_HANDOFF.md"), "utf8");
  assert.match(text, /PR #5/);
  assert.match(text, /pr-body-update-draft\.md/);
  assert.match(text, /issue #6|GitHub issue #6/i);
  assert.match(text, /blocker-fresh-brain-ui-launch-and-release-gate\.md/);
  assert.match(text, /Claude Opus review|Claude CLI|Claude concerns/i);
  assert.match(text, /public launch verdict as `FAIL`|publicLaunchVerdict: "FAIL"/);
  assert.match(text, /selfmem_update/);
  assert.match(text, /release:handoff/);
  assert.match(text, /handoff packet/i);
  assert.match(text, /release:github-sync/);
  assert.match(text, /live GitHub sync|GitHub live sync/i);
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

check("fresh static brain UI evidence passes", () => {
  const report = JSON.parse(run("node", ["packages/brain-ui/static-evidence.mjs"]).stdout);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "fixture-brain-ui-static-evidence");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.hostedWriteBackEnabled, false);
  assert.equal(report.privacyLeakCount, 0);
  assert.equal(report.productionReady, false);
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

check("fresh adapter store latency instrumentation passes", () => {
  const openclaw = JSON.parse(run("node", ["packages/adapters/openclaw/selfmem_canary_standalone_smoke.mjs"]).stdout);
  const hermes = JSON.parse(run("python3", ["packages/adapters/hermes/selfmem_canary_standalone_smoke.py"]).stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-adapter-store-latency-review.md"), "utf8");
  for (const report of [openclaw, hermes]) {
    assert.equal(report.ok, true);
    assert.equal(report.searchLatencyInstrumentationCovered, true);
    assert.equal(report.storeLatencyInstrumentationCovered, true);
    assert.equal(Number(report.storeLatencySampleCount) > 0, true);
    assert.equal(report.privacyLeakCount, 0);
  }
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  assert.match(geminiReview, /positive `elapsed_ms`|positive elapsed_ms/i);
});

check("fresh canary report generator passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-report-"));
  try {
    const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-report-generator-review.md"), "utf8");
    const reportPath = join(tempRoot, "report.json");
    const generator = run("node", ["packages/bench/canary-report-from-trace.mjs", "--fixture", "--output", reportPath]);
    const generatedReport = JSON.parse(generator.stdout);
    const fileReport = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.deepEqual(fileReport, generatedReport);
    assert.equal(generatedReport.mode, "one-agent-canary-runtime-report");
    assert.equal(generatedReport.fixtureOnly, true);
    assert.equal(generatedReport.evidenceType, "fixture-trace-derived-canary-report");
    assert.match(generatedReport.agent.agentIdentityHash, /^agent_[a-f0-9]{8,}$/);
    assert.equal(generatedReport.provider.hostedSupermemoryMode, "read-through-only");
    assert.equal(generatedReport.counts.sessionStart > 0, true);
    assert.equal(generatedReport.counts.beforePromptBuild > 0, true);
    assert.equal(generatedReport.counts.preCompress > 0, true);
    assert.equal(generatedReport.counts.agentEnd > 0, true);
    assert.equal(generatedReport.counts.search > 0, true);
    assert.equal(generatedReport.counts.store > 0, true);
    assert.equal(generatedReport.counts.errors, 0);
    assert.equal(generatedReport.latencyMs.recallP95 > 0, true);
    assert.equal(generatedReport.latencyMs.storeP95 > 0, true);
    assert.equal(generatedReport.instrumentation.searchLatencySampleCount > 0, true);
    assert.equal(generatedReport.instrumentation.storeLatencySampleCount > 0, true);
    assert.equal(generatedReport.instrumentation.missingStoreLatencyCount, 0);
    assert.equal(generatedReport.quality.lifecycleCovered, true);
    assert.equal(generatedReport.quality.hybridSearchCovered, true);
    assert.equal(generatedReport.privacy.privacyLeakCount, 0);
    assert.equal(generatedReport.privacy.secretPatternHits, 0);
    assert.equal(generatedReport.privacy.rawMemoryIncluded, false);
    assert.doesNotMatch(generator.stdout, secretPattern);
    assert.doesNotMatch(generator.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
    const intake = run("node", ["packages/bench/canary-evidence-intake.mjs", "--report", reportPath]);
    const intakeReport = JSON.parse(intake.stdout);
    assert.equal(intakeReport.fixtureOnly, true);
    assert.equal(intakeReport.countsAsRealRolloutEvidence, false);
    assert.equal(intakeReport.canaryPass, true);
    const diagnosticReportPath = join(tempRoot, "diagnostic-report.json");
    const diagnostic = run("node", [
      "packages/bench/canary-report-from-trace.mjs",
      "--diagnostic-dir",
      "packages/bench/fixtures/canary-diagnostic-export.fixture",
      "--output",
      diagnosticReportPath,
    ]);
    const diagnosticReport = JSON.parse(diagnostic.stdout);
    assert.deepEqual(JSON.parse(readFileSync(diagnosticReportPath, "utf8")), diagnosticReport);
    assert.equal(diagnosticReport.fixtureOnly, true);
    assert.equal(diagnosticReport.evidenceSource.inputKind, "diagnostic-dir");
    assert.equal(diagnosticReport.evidenceSource.traceKind, "trace_metadata_only.jsonl");
    assert.equal(diagnosticReport.evidenceSource.metadataOnly, true);
    assert.equal(diagnosticReport.provider.hostedSupermemoryMode, "read-through-only");
    assert.equal(diagnosticReport.counts.sessionStart, 1);
    assert.equal(diagnosticReport.counts.beforePromptBuild, 1);
    assert.equal(diagnosticReport.counts.preCompress, 1);
    assert.equal(diagnosticReport.counts.agentEnd, 1);
    assert.equal(diagnosticReport.counts.search, 1);
    assert.equal(diagnosticReport.counts.store, 1);
    assert.equal(diagnosticReport.latencyMs.recallP95, 220);
    assert.equal(diagnosticReport.latencyMs.storeP95, 145);
    assert.equal(diagnosticReport.instrumentation.searchLatencySampleCount, 1);
    assert.equal(diagnosticReport.instrumentation.storeLatencySampleCount, 1);
    assert.equal(diagnosticReport.instrumentation.missingStoreLatencyCount, 0);
    assert.equal(diagnosticReport.quality.hybridSearchCovered, true);
    assert.equal(diagnosticReport.quality.hostedReadThroughObserved, true);
    assert.equal(diagnosticReport.privacy.privacyLeakCount, 0);
    assert.doesNotMatch(diagnostic.stdout, secretPattern);
    assert.doesNotMatch(diagnostic.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
    const diagnosticIntake = run("node", ["packages/bench/canary-evidence-intake.mjs", "--report", diagnosticReportPath]);
    const diagnosticIntakeReport = JSON.parse(diagnosticIntake.stdout);
    assert.equal(diagnosticIntakeReport.fixtureOnly, true);
    assert.equal(diagnosticIntakeReport.countsAsRealRolloutEvidence, false);
    assert.equal(diagnosticIntakeReport.canaryPass, true);
    const diagnosticZip = join(tempRoot, "diagnostic-fixture.zip");
    const zipCreate = spawnSync("python3", [
      "-m",
      "zipfile",
      "-c",
      diagnosticZip,
      "packages/bench/fixtures/canary-diagnostic-export.fixture",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(zipCreate.status, 0, "failed to build diagnostic zip fixture");
    const diagnosticZipReportPath = join(tempRoot, "diagnostic-zip-report.json");
    const diagnosticZipRun = run("node", [
      "packages/bench/canary-report-from-trace.mjs",
      "--zip",
      diagnosticZip,
      "--output",
      diagnosticZipReportPath,
    ]);
    const diagnosticZipReport = JSON.parse(diagnosticZipRun.stdout);
    assert.equal(diagnosticZipReport.fixtureOnly, true);
    assert.equal(diagnosticZipReport.evidenceSource.inputKind, "diagnostic-zip");
    assert.equal(diagnosticZipReport.evidenceSource.traceKind, "trace_metadata_only.jsonl");
    assert.equal(diagnosticZipReport.latencyMs.storeP95, 145);
    assert.equal(diagnosticZipReport.instrumentation.storeLatencySampleCount, 1);
    assert.doesNotMatch(diagnosticZipRun.stdout, secretPattern);
    assert.doesNotMatch(diagnosticZipRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
    const diagnosticZipStrict = spawnSync("node", [
      "packages/bench/canary-evidence-intake.mjs",
      "--report",
      diagnosticZipReportPath,
      "--strict-real",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(diagnosticZipStrict.status, 0, "relocated fixture zip must fail --strict-real");
    assert.match(diagnosticZipStrict.stderr, /strict-real cannot use.*fixture/i);

    const windowFixtureDir = join(tempRoot, "fresh-window-diagnostic");
    mkdirSync(join(windowFixtureDir, "reliability_reports"), { recursive: true });
    writeFileSync(
      join(windowFixtureDir, "container-map.json"),
      JSON.stringify({
        host: "hermes",
        agent_identity: "window-real-agent",
        source_supermemory_container: "window_source_history",
        local_container: "selfmem_window_source_history",
        provider_mode: "voyage-4-large+rerank-2.5+supermemory-read-through",
      }),
    );
    writeFileSync(
      join(windowFixtureDir, "reliability_reports/latest.json"),
      JSON.stringify({
        event_counts: { search: 100, store: 100, memory_write_failed: 2 },
        issues: ["old pre-patch issue outside fresh canary window"],
        privacy_leak_count: 0,
        reliability_metrics: { zero_result_rate: 0.9 },
      }),
    );
    writeFileSync(
      join(windowFixtureDir, "trace.jsonl"),
      [
        {
          ts: "2026-05-22T19:50:00.000Z",
          event: "store",
          data: { result_count: 1 },
        },
        {
          ts: "2026-05-22T19:51:00.000Z",
          event: "memory_write_failed",
          data: { error_class: "old_pre_patch_failure" },
        },
        {
          ts: "2026-05-22T20:00:00.000Z",
          event: "session_start",
          data: { provider_mode: "voyage-4-large+rerank-2.5+supermemory-read-through" },
        },
        {
          ts: "2026-05-22T20:01:00.000Z",
          event: "before_prompt_build",
          data: { result_count: 3 },
        },
        {
          ts: "2026-05-22T20:02:00.000Z",
          event: "search",
          data: {
            elapsed_ms: 180,
            result_count: 4,
            local_result_count: 2,
            supermemory_result_count: 2,
            supermemory_read_through: true,
          },
        },
        {
          ts: "2026-05-22T20:05:00.000Z",
          event: "pre_compress",
          data: { reason: "fresh-window-fixture" },
        },
        {
          ts: "2026-05-22T20:15:00.000Z",
          event: "agent_end",
          data: { result_count: 1 },
        },
        {
          ts: "2026-05-22T20:16:00.000Z",
          event: "store",
          data: { elapsed_ms: 140, result_count: 1 },
        },
      ].map((item) => JSON.stringify(item)).join("\n"),
    );
    const windowedReportPath = join(tempRoot, "fresh-window-report.json");
    const windowedRun = run("node", [
      "packages/bench/canary-report-from-trace.mjs",
      "--diagnostic-dir",
      windowFixtureDir,
      "--host",
      "hermes",
      "--since",
      "2026-05-22T20:00:00.000Z",
      "--rollback-tested",
      "--output",
      windowedReportPath,
    ]);
    const windowedReport = JSON.parse(windowedRun.stdout);
    assert.equal(windowedReport.fixtureOnly, false);
    assert.equal(windowedReport.evidenceSource.windowFilter.since, "2026-05-22T20:00:00.000Z");
    assert.equal(windowedReport.counts.store, 1);
    assert.equal(windowedReport.counts.errors, 0);
    assert.equal(windowedReport.quality.zeroResultRate, 0);
    assert.equal(windowedReport.instrumentation.storeLatencySampleCount, 1);
    assert.equal(windowedReport.instrumentation.missingStoreLatencyCount, 0);
    assert.equal(windowedReport.quality.hybridSearchCovered, true);
    assert.equal(windowedReport.quality.hostedReadThroughObserved, true);
    assert.equal(windowedReport.window.durationMinutes >= 15, true);
    const windowedIntake = run("node", ["packages/bench/canary-evidence-intake.mjs", "--report", windowedReportPath, "--strict-real"]);
    const windowedIntakeReport = JSON.parse(windowedIntake.stdout);
    assert.equal(windowedIntakeReport.canaryPass, true);
    assert.equal(windowedIntakeReport.countsAsRealRolloutEvidence, true);
    assert.doesNotMatch(windowedRun.stdout, secretPattern);
    assert.doesNotMatch(windowedRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);

    const summaryDiagnosticReportPath = join(tempRoot, "summary-diagnostic-report.json");
    const summaryDiagnostic = run("node", [
      "packages/bench/canary-report-from-trace.mjs",
      "--diagnostic-dir",
      "packages/bench/fixtures/canary-summary-diagnostic.fixture",
      "--output",
      summaryDiagnosticReportPath,
    ]);
    const summaryReport = JSON.parse(summaryDiagnostic.stdout);
    assert.equal(summaryReport.fixtureOnly, true);
    assert.equal(summaryReport.evidenceSource.traceKind, "trace_summary_sanitized.json");
    assert.equal(summaryReport.instrumentation.summaryOnlyTrace, true);
    assert.equal(summaryReport.instrumentation.searchLatencySampleCount, 0);
    assert.equal(summaryReport.instrumentation.missingSearchLatencyCount, 5);
    assert.equal(summaryReport.instrumentation.missingStoreLatencyCount, 3);
    assert.equal(summaryReport.counts.errors, 1);
    assert.equal(summaryReport.privacy.privacyLeakCount, 0);
    assert.doesNotMatch(summaryDiagnostic.stdout, secretPattern);
    assert.doesNotMatch(summaryDiagnostic.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
    const summaryDiagnosis = run("node", [
      "packages/bench/canary-remediation.mjs",
      "--report",
      summaryDiagnosticReportPath,
    ]);
    const summaryDiagnosisReport = JSON.parse(summaryDiagnosis.stdout);
    assert.equal(summaryDiagnosisReport.canaryPass, false);
    assert.ok(summaryDiagnosisReport.failedChecks.includes("search-latency-instrumented"));
    assert.ok(summaryDiagnosisReport.failedChecks.includes("store-latency-instrumented"));
    assert.ok(summaryDiagnosisReport.actions.some((item) => item.check === "search-latency-instrumented"));
    assert.ok(summaryDiagnosisReport.actions.some((item) => item.check === "store-latency-instrumented"));
    const strict = spawnSync("node", ["packages/bench/canary-evidence-intake.mjs", "--report", reportPath, "--strict-real"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(strict.status, 0, "fixture-derived report must fail --strict-real");
    assert.match(strict.stderr, /strict-real cannot use.*fixture/i);
    assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
    assert.doesNotMatch(geminiReview, /pending external review/i);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("fresh canary evidence intake passes", () => {
  const result = run("node", ["packages/bench/canary-evidence-intake.mjs"]);
  const report = JSON.parse(result.stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-evidence-intake-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "canary-evidence-intake");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.fixtureOnly, true);
  assert.equal(report.countsAsRealRolloutEvidence, false);
  assert.equal(report.canaryPass, true);
  assert.equal(report.fleetRolloutAllowed, false);
  assert.equal(report.publicLaunchAllowed, false);
  assert.equal(report.privacy?.privacyLeakCount, 0);
  assert.equal(report.privacy?.secretPatternHits, 0);
  assert.equal(report.privacy?.rawMemoryIncluded, false);
  assert.equal(report.lifecycle?.beforePromptBuild > 0, true);
  assert.equal(report.lifecycle?.store > 0, true);
  assert.equal(report.instrumentation?.searchLatencySampleCount > 0, true);
  assert.equal(report.instrumentation?.storeLatencySampleCount > 0, true);
  assert.equal(report.instrumentation?.missingStoreLatencyCount, 0);
  assert.equal(report.quality?.lifecycleCovered, true);
  assert.equal(report.quality?.hybridSearchCovered, true);
  assert.deepEqual(report.failedChecks, []);
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
});

check("fresh canary remediation passes", () => {
  const failingResult = run("node", ["packages/bench/canary-remediation.mjs"]);
  const failingReport = JSON.parse(failingResult.stdout);
  const passingResult = run("node", [
    "packages/bench/canary-remediation.mjs",
    "--report",
    "packages/bench/fixtures/canary-runtime-report.fixture.json",
  ]);
  const passingReport = JSON.parse(passingResult.stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-remediation-review.md"), "utf8");
  assert.equal(failingReport.ok, true);
  assert.equal(failingReport.mode, "canary-remediation-plan");
  assert.equal(failingReport.writesRealFiles, false);
  assert.equal(failingReport.metricsOnly, true);
  assert.equal(failingReport.fixtureOnly, true);
  assert.equal(failingReport.canaryPass, false);
  assert.equal(failingReport.severity, "blocked");
  assert.equal(failingReport.publicLaunchAllowed, false);
  assert.equal(failingReport.fleetRolloutAllowed, false);
  assert.deepEqual(failingReport.failedChecks, ["store-latency-instrumented", "recall-p95", "store-p95"]);
  assert.equal(failingReport.measurements.recallP95Ms, 3894);
  assert.equal(failingReport.measurements.storeP95Ms, 0);
  assert.equal(failingReport.measurements.storeLatencySampleCount, 0);
  assert.equal(failingReport.measurements.missingStoreLatencyCount, 12);
  assert.ok(failingReport.actions.some((item) => item.check === "store-latency-instrumented" && item.category === "instrumentation"));
  assert.ok(failingReport.actions.some((item) => item.check === "recall-p95" && item.category === "latency"));
  assert.ok(failingReport.actions.some((item) => item.check === "store-p95" && item.category === "instrumentation"));
  assert.equal(failingReport.recollectWindow.needsFreshWindow, true);
  assert.equal(passingReport.canaryPass, true);
  assert.equal(passingReport.fixtureOnly, true);
  assert.deepEqual(passingReport.failedChecks, []);
  assert.doesNotMatch(failingResult.stdout, secretPattern);
  assert.doesNotMatch(failingResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
});

check("fresh canary operator packet passes", () => {
  const hermesResult = run("node", ["packages/bench/canary-operator-packet.mjs", "--host", "hermes"]);
  const openclawMarkdown = run("node", ["packages/bench/canary-operator-packet.mjs", "--host", "openclaw", "--format", "markdown"]);
  const report = JSON.parse(hermesResult.stdout);
  const evidence = readFileSync(join(root, reviewDir, "canary-operator-packet-evidence.md"), "utf8");
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-operator-packet-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "strict-real-canary-operator-packet");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.publicSafe, true);
  assert.equal(report.host, "hermes");
  assert.match(report.requiredSource, /live mapped container/i);
  assert.equal(report.freshWindow?.minimumMinutes, 15);
  assert.ok(report.commands.some((item) => item.id === "apply-live-container" && /FRESH_WINDOW_START/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "collect-live-container-after-window" && /--canary-since <fresh-window-start-iso>/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "apply-and-collect-live-container" && /--strict-real/.test(item.command) && /--canary-since/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "collect-from-redacted-diagnostic-dir" && /--canary-diagnostic-dir/.test(item.command) && /--canary-since/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "collect-from-redacted-diagnostic-zip" && /--canary-diagnostic-zip/.test(item.command) && /--canary-since/.test(item.command)));
  assert.ok(report.acceptanceCriteria.includes("countsAsRealRolloutEvidence is true"));
  assert.ok(report.acceptanceCriteria.includes("fixtureOnly is false"));
  assert.ok(report.acceptanceCriteria.includes("window.durationMinutes is at least 15"));
  assert.ok(report.acceptanceCriteria.includes("instrumentation.missingStoreLatencyCount is 0"));
  assert.ok(report.forbidden.includes("raw memories"));
  assert.ok(report.forbidden.includes("provider keys"));
  assert.match(openclawMarkdown.stdout, /RecallWeave Strict-Real Canary Packet \(OpenClaw\)/);
  assert.match(openclawMarkdown.stdout, /--host openclaw/);
  assert.match(openclawMarkdown.stdout, /fresh-window timestamp/i);
  assert.match(openclawMarkdown.stdout, /--canary-since "\$FRESH_WINDOW_START"/);
  assert.match(openclawMarkdown.stdout, /Attach Only/);
  assert.doesNotMatch(hermesResult.stdout, secretPattern);
  assert.doesNotMatch(openclawMarkdown.stdout, secretPattern);
  assert.doesNotMatch(hermesResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(openclawMarkdown.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.match(evidence, /strict-real canary operator packet/i);
  assert.match(evidence, /canary:operator-packet/i);
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
});

check("fresh canary window reviewer evidence is explicit", () => {
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-fresh-canary-window-review.md"), "utf8");
  const claudeBlocked = readFileSync(join(root, reviewDir, "claude-fresh-canary-window-review-blocked.md"), "utf8");
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  assert.match(geminiReview, /strict, bounded canary windows/i);
  assert.match(claudeBlocked, /not counted as reviewer approval/i);
  assert.match(claudeBlocked, /empty stdout/i);
  assert.doesNotMatch(geminiReview, secretPattern);
  assert.doesNotMatch(claudeBlocked, secretPattern);
});

check("fresh release blocker doctor passes", () => {
  run("node", ["packages/bench/release-blocker-doctor.mjs"]);
});

check("fresh hosted baseline preflight passes", () => {
  const collectorTmp = mkdtempSync(join(tmpdir(), "recallweave-hosted-baseline-"));
  const collectorResultPath = join(collectorTmp, "collector-result.json");
  const result = run("node", ["packages/bench/hosted-baseline-preflight.mjs"]);
  const fixtureResult = run("node", ["packages/bench/hosted-baseline-preflight.mjs", "--fixture"]);
  const templateResult = run("node", ["packages/bench/hosted-baseline-preflight.mjs", "--print-template"]);
  const collectorResult = run("node", ["packages/bench/hosted-baseline-collector.mjs", "--fixture", "--output", collectorResultPath]);
  const collectorPreflightResult = run("node", ["packages/bench/hosted-baseline-preflight.mjs", "--result", collectorResultPath]);
  const operatorResult = run("node", ["packages/bench/hosted-baseline-operator-packet.mjs"]);
  const operatorMarkdown = run("node", ["packages/bench/hosted-baseline-operator-packet.mjs", "--format", "markdown"]);
  const report = JSON.parse(result.stdout);
  const fixtureReport = JSON.parse(fixtureResult.stdout);
  const templateReport = JSON.parse(templateResult.stdout);
  const collectorReport = JSON.parse(collectorResult.stdout);
  const collectorPreflightReport = JSON.parse(collectorPreflightResult.stdout);
  const operatorPacket = JSON.parse(operatorResult.stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-preflight-review.md"), "utf8");
  const collectorEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-collector-evidence.md"), "utf8");
  const collectorGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-collector-review.md"), "utf8");
  const operatorEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-operator-packet-evidence.md"), "utf8");
  const operatorGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-operator-packet-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "hosted-baseline-preflight");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.callsHostedProvider, false);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.releaseBlockerPresent, true);
  assert.equal(report.hostedBaselineFresh, false);
  assert.equal(report.benchmarkClaimsAllowed, false);
  assert.equal(report.publicBenchmarkClaimsAllowed, false);
  assert.equal(report.countsAsHostedBaselineEvidence, false);
  assert.equal(report.safety?.permitsHostedWriteBack, false);
  assert.equal(report.safety?.permitsRawMemoryOutput, false);
  assert.ok(report.liveRunContract?.requiredMetrics?.includes("P@1"));
  assert.ok(report.liveRunContract?.requiredComparability?.includes("same dataset slice"));
  assert.equal(fixtureReport.resultInspection?.fixtureOnly, true);
  assert.deepEqual(fixtureReport.resultInspection?.failedResultChecks, ["not-fixture"]);
  assert.equal(fixtureReport.countsAsHostedBaselineEvidence, false);
  assert.equal(fixtureReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(templateReport.resultTemplateIncluded, true);
  assert.equal(templateReport.baselineResultTemplate?.provider, "hosted-supermemory");
  assert.equal(templateReport.baselineResultTemplate?.metricsOnly, true);
  assert.equal(templateReport.baselineResultTemplate?.rawMemoryIncluded, false);
  assert.equal(collectorReport.provider, "hosted-supermemory");
  assert.equal(collectorReport.metricsOnly, true);
  assert.equal(collectorReport.fixtureOnly, true);
  assert.equal(collectorReport.rawMemoryIncluded, false);
  assert.equal(collectorReport.rawTranscriptIncluded, false);
  assert.equal(collectorReport.rawPromptIncluded, false);
  assert.equal(collectorReport.rawAnswerIncluded, false);
  assert.equal(collectorReport.privacyLeakCount, 0);
  assert.ok(collectorReport.querySetHash?.startsWith("sha256:"));
  assert.ok(collectorReport.scoringCodeHash?.startsWith("sha256:"));
  assert.equal(collectorReport.resultFingerprints?.length, 3);
  assert.equal(collectorReport.searchConfig?.endpoint, "fixture");
  assert.ok(Number(collectorReport.metrics?.pAt1) > 0);
  assert.equal(collectorPreflightReport.resultInspection?.fixtureOnly, true);
  assert.equal(collectorPreflightReport.resultInspection?.provider, "hosted-supermemory");
  assert.equal(collectorPreflightReport.resultInspection?.metricsOnly, true);
  assert.deepEqual(collectorPreflightReport.resultInspection?.failedResultChecks, ["not-fixture"]);
  assert.equal(collectorPreflightReport.countsAsHostedBaselineEvidence, false);
  assert.equal(operatorPacket.ok, true);
  assert.equal(operatorPacket.mode, "hosted-baseline-operator-packet");
  assert.equal(operatorPacket.writesRealFiles, false);
  assert.equal(operatorPacket.callsHostedProvider, false);
  assert.equal(operatorPacket.publicSafe, true);
  assert.ok(operatorPacket.commands.some((item) => item.id === "print-template" && /baseline:preflight/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "collect-live-result" && /baseline:collect/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "validate-live-result" && /RECALLWEAVE_BASELINE_NO_RAW_TEXT=1/.test(item.command)));
  assert.ok(operatorPacket.acceptanceCriteria.includes("reviewerApprovalCount is at least 2 before comparison claims"));
  assert.ok(operatorPacket.forbidden.includes("provider keys"));
  assert.match(operatorMarkdown.stdout, /RecallWeave Hosted Baseline Packet/);
  assert.match(operatorMarkdown.stdout, /Attach Only/);
  assert.match(collectorEvidence, /hosted baseline collector/i);
  assert.match(collectorGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(operatorEvidence, /hosted baseline operator packet/i);
  assert.match(operatorGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
  assert.doesNotMatch(collectorResult.stdout, secretPattern);
  assert.doesNotMatch(collectorPreflightResult.stdout, secretPattern);
  assert.doesNotMatch(collectorEvidence, secretPattern);
  assert.doesNotMatch(collectorGeminiReview, secretPattern);
  assert.doesNotMatch(operatorResult.stdout, secretPattern);
  assert.doesNotMatch(operatorMarkdown.stdout, secretPattern);
  assert.doesNotMatch(operatorEvidence, secretPattern);
  assert.doesNotMatch(operatorGeminiReview, secretPattern);
  rmSync(collectorTmp, { recursive: true, force: true });
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
  assert.match(packet.prBody, /hosted baseline preflight|baseline:preflight/i);
  assert.match(packet.prBody, new RegExp(String(releaseState.latestVerifiedCodeBaseline?.ciRunId)));
  assert.match(packet.statusComment, /public launch verdict: FAIL/i);
  assert.match(packet.issueBody, /Acceptance Criteria/);
  assert.ok(packet.labels.includes("not-production-ready"));
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
});

check("fresh GitHub live sync passes", () => {
  const result = run("node", ["packages/bench/github-live-sync-check.mjs"]);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "github-live-sync-check");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.callsGitHubApi, true);
  assert.equal(report.repository, "radbroradbro/selfmem-agent-memory");
  assert.equal(report.pullRequest, 5);
  assert.equal(report.issueNumber, 6);
  assert.equal(report.livePrOpen, true);
  assert.equal(report.liveIssueOpen, true);
  assert.equal(report.livePrHeadMatches, true);
  assert.equal(report.prBodyMatches, true);
  assert.equal(report.issueTitleMatches, true);
  assert.equal(report.issueBodyMatches, true);
  assert.match(report.prBodyHash, /^[a-f0-9]{64}$/);
  assert.match(report.issueBodyHash, /^[a-f0-9]{64}$/);
  assert.equal(report.safety?.printsBodyText, false);
  assert.equal(report.safety?.printsCredentials, false);
  assert.equal(report.safety?.privateLeakCount, 0);
  assert.equal(report.safety?.hasSecretPattern, false);
  assert.equal(report.safety?.hasPrivatePathPattern, false);
});

check("fresh goal completion audit passes", () => {
  const result = run("node", ["packages/bench/goal-completion-audit.mjs"]);
  const report = JSON.parse(result.stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-goal-completion-audit-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "goal-completion-audit");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.goalComplete, false);
  assert.equal(report.mayCallUpdateGoalComplete, false);
  assert.ok(report.counts?.proven >= 8);
  assert.ok(report.counts?.blocked >= 2);
  assert.ok(report.counts?.incomplete >= 1);
  assert.equal(report.safety?.privateLeakCount, 0);
  assert.equal(report.safety?.hasSecretPattern, false);
  assert.ok(report.requirements.some((item) => item.id === "claude-council-review" && item.status === "proven"));
  assert.ok(report.requirements.some((item) => item.id === "github-pr-body-current" && item.status === "proven"));
  assert.ok(report.requirements.some((item) => item.id === "github-blocker-issue-created" && item.status === "proven"));
  assert.ok(report.requirements.some((item) => item.id === "github-live-sync-current" && item.status === "proven"));
  assert.ok(
    report.requirements.some((item) => item.id === "real-container-production-rollout" && item.status === "incomplete"),
  );
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
  const npmCache = mkdtempSync(join(tmpdir(), "recallweave-release-npm-cache-"));
  try {
    run("npm", ["pack", "--dry-run"], {
      cwd: join(root, "packages/core"),
      env: { ...process.env, npm_config_cache: npmCache },
    });
  } finally {
    rmSync(npmCache, { recursive: true, force: true });
  }
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
    env: options.env ?? process.env,
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
