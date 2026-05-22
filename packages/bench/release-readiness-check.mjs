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
  `${reviewDir}/kickoff.md`,
  `${reviewDir}/summary.md`,
  `${reviewDir}/claude-pr5-review-blocked.md`,
  `${reviewDir}/session-compaction-evidence.md`,
  `${reviewDir}/session-compaction-benchmark-evidence.md`,
  `${reviewDir}/wiki-vault-evidence.md`,
  `${reviewDir}/wiki-vault-sync-evidence.md`,
  `${reviewDir}/gemini-wiki-sync-audit-log-review.md`,
  `${reviewDir}/update-flow-evidence.md`,
  `${reviewDir}/local-container-audit-evidence.md`,
  `${reviewDir}/gemini-local-container-audit-review.md`,
  `${reviewDir}/brain-ui-vault-preview-evidence.md`,
  `${reviewDir}/brain-ui-nucleus-snapshot-evidence.md`,
  `${reviewDir}/gemini-brain-ui-nucleus-snapshot-review.md`,
  `${reviewDir}/brain-ui-research-lineage-evidence.md`,
  `${reviewDir}/gemini-brain-ui-research-lineage-review.md`,
  `${reviewDir}/brain-ui-lifecycle-policy-evidence.md`,
  `${reviewDir}/gemini-brain-ui-lifecycle-policy-review.md`,
  `${reviewDir}/brain-ui-review-queue-evidence.md`,
  `${reviewDir}/gemini-brain-ui-review-queue-review.md`,
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
  `${reviewDir}/ui-evidence/brain-ui-lifecycle-policy-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-lifecycle-policy.png`,
  `${reviewDir}/ui-evidence/brain-ui-review-queue-dom-evidence.json`,
  `${reviewDir}/ui-evidence/brain-ui-review-queue.png`,
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
  "wiki:smoke",
  "wiki:smoke:built",
  "wiki:sync:smoke",
  "wiki:sync:smoke:built",
  "update:smoke",
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
  assert.equal(policyEvidence.evidence.noRealApplyLanguage, true);
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
  assert.equal(reviewQueueEvidence.evidence.noRealApplyLanguage, true);
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
    "brain-ui-memory-review-queue",
    "session-compaction-benchmark",
    "selfmem-update",
  ]) {
    assert.ok(releaseState.provenPreviewSurfaces?.includes(surface), `missing release surface ${surface}`);
  }
  for (const blocker of [
    "claude-reviewer-route-blocked",
    "github-pr-body-update-blocked",
    "human-public-launch-approval-required",
    "brain-ui-real-local-container-edit-not-enabled",
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
    assert.match(text, /memory review queue/i, `${file} missing memory review queue`);
    assert.doesNotMatch(text, /run #43|5 files and 18 tests/, `${file} contains stale verification wording`);
  }
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
