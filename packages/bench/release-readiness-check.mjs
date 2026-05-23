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
  "packages/bench/canary-evidence-packet.mjs",
  "packages/bench/canary-evidence-packet-review.mjs",
  "packages/bench/canary-returned-packet-intake.mjs",
  "packages/bench/canary-diagnostic-batch-audit.mjs",
  "packages/bench/canary-next-agent-plan.mjs",
  "packages/bench/canary-next-agent-packet.mjs",
  "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
  "packages/bench/fixtures/hosted-baseline-search-responses.fixture.json",
  "packages/bench/fixtures/hosted-baseline-result.fixture.json",
  "packages/bench/fixtures/recallweave-baseline-result.fixture.json",
  "packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json",
  "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-container-map.fixture.json",
  "packages/bench/fixtures/canary-runtime-trace.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-raw.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-memories.fixture.jsonl",
  "packages/bench/fixtures/canary-runtime-report.fixture.json",
  "packages/bench/fixtures/canary-runtime-report-failing.fixture.json",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary_metadata/trace_metadata_only.jsonl",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/containers/selfmem_fixture_agent/container-map.json",
  "packages/bench/fixtures/canary-diagnostic-export.fixture/selfmem_canary/reliability_reports/latest.json",
  "packages/bench/fixtures/session-compaction-local-batch.fixture/codex-rollout.fixture.jsonl",
  "packages/bench/fixtures/session-compaction-local-batch.fixture/claude-transcript.fixture.json",
  "packages/bench/fixtures/session-compaction-local-batch.fixture/hermes-trace.fixture.jsonl",
  "packages/bench/session-compaction-local-batch-audit.mjs",
  "packages/bench/hosted-baseline-preflight.mjs",
  "packages/bench/hosted-baseline-discovery.mjs",
  "packages/bench/hosted-baseline-container-select.mjs",
  "packages/bench/hosted-baseline-queryset-author.mjs",
  "packages/bench/baseline-scoring-contract.mjs",
  "packages/bench/baseline-queryset-inspect.mjs",
  "packages/bench/hosted-baseline-collector.mjs",
  "packages/bench/recallweave-response-export.mjs",
  "packages/bench/recallweave-baseline-collector.mjs",
  "packages/bench/baseline-comparison.mjs",
  "packages/bench/hosted-baseline-operator-packet.mjs",
  "packages/bench/hosted-baseline-next-run.mjs",
  "packages/bench/baseline-evidence-packet.mjs",
  "packages/bench/baseline-evidence-packet-review.mjs",
  "packages/bench/baseline-returned-packet-intake.mjs",
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
  `${reviewDir}/session-compaction-local-batch-audit-evidence.md`,
  `${reviewDir}/gemini-session-compaction-local-audit-review.md`,
  `${reviewDir}/gemini-session-compaction-local-batch-audit-review.md`,
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
  `${reviewDir}/gemini-strict-real-fail-closed-intake-review.md`,
  `${reviewDir}/adapter-strict-canary-contract-evidence.md`,
  `${reviewDir}/gemini-adapter-strict-canary-contract-review.md`,
  `${reviewDir}/canary-remediation-evidence.md`,
  `${reviewDir}/gemini-canary-remediation-review.md`,
  `${reviewDir}/canary-operator-packet-evidence.md`,
  `${reviewDir}/gemini-canary-operator-packet-review.md`,
  `${reviewDir}/canary-evidence-packet-evidence.md`,
  `${reviewDir}/gemini-canary-evidence-packet-review.md`,
  `${reviewDir}/canary-evidence-packet-review-evidence.md`,
  `${reviewDir}/gemini-canary-evidence-packet-review-review.md`,
  `${reviewDir}/canary-returned-packet-intake-evidence.md`,
  `${reviewDir}/gemini-canary-returned-packet-intake-review.md`,
  `${reviewDir}/canary-diagnostic-batch-audit-evidence.md`,
  `${reviewDir}/gemini-canary-diagnostic-batch-audit-review.md`,
  `${reviewDir}/canary-next-agent-plan-evidence.md`,
  `${reviewDir}/real-next-agent-openclaw-canary-plan.md`,
  `${reviewDir}/gemini-canary-next-agent-plan-review.md`,
  `${reviewDir}/canary-next-agent-packet-evidence.md`,
  `${reviewDir}/gemini-canary-next-agent-packet-review.md`,
  `${reviewDir}/gemini-adapter-store-latency-review.md`,
  `${reviewDir}/gemini-fresh-canary-window-review.md`,
  `${reviewDir}/claude-fresh-canary-window-review-blocked.md`,
  `${reviewDir}/hosted-baseline-preflight-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-preflight-review.md`,
  `${reviewDir}/baseline-queryset-inspect-evidence.md`,
  `${reviewDir}/gemini-baseline-queryset-inspect-review.md`,
  `${reviewDir}/hosted-baseline-discovery-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-discovery-review.md`,
  `${reviewDir}/hosted-baseline-container-select-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-container-select-review.md`,
  `${reviewDir}/hosted-baseline-queryset-author-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-queryset-author-review.md`,
  `${reviewDir}/hosted-baseline-live-discovery.json`,
  `${reviewDir}/hosted-baseline-live-discovery-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-live-discovery-review.md`,
  `${reviewDir}/hosted-baseline-collector-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-collector-review.md`,
  `${reviewDir}/recallweave-response-export-evidence.md`,
  `${reviewDir}/gemini-recallweave-response-export-review.md`,
  `${reviewDir}/recallweave-baseline-collector-evidence.md`,
  `${reviewDir}/gemini-recallweave-baseline-collector-review.md`,
  `${reviewDir}/baseline-comparison-evidence.md`,
  `${reviewDir}/gemini-baseline-comparison-review.md`,
  `${reviewDir}/gemini-baseline-labeled-queryset-gate-review.md`,
  `${reviewDir}/hosted-baseline-operator-packet-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-operator-packet-review.md`,
  `${reviewDir}/hosted-baseline-next-run-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-next-run-review.md`,
  `${reviewDir}/baseline-evidence-packet-evidence.md`,
  `${reviewDir}/gemini-baseline-evidence-packet-review.md`,
  `${reviewDir}/baseline-returned-packet-intake-evidence.md`,
  `${reviewDir}/gemini-baseline-returned-packet-intake-review.md`,
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
  "compaction:batch-audit",
  "compaction:batch-audit:built",
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
  "canary:packet",
  "canary:packet:review",
  "canary:returned-packet",
  "canary:batch-audit",
  "canary:next-agent",
  "canary:next-agent-packet",
  "baseline:queryset",
  "baseline:discover",
  "baseline:select-container",
  "baseline:author-queryset",
  "baseline:preflight",
  "baseline:collect",
  "baseline:export:recallweave",
  "baseline:collect:recallweave",
  "baseline:compare",
  "baseline:operator-packet",
  "baseline:next-run",
  "baseline:packet",
  "baseline:packet:review",
  "baseline:returned-packet",
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
  assert.match(help, /--canary-intake-output/);
  assert.match(help, /--canary-diagnosis-output/);
  assert.match(help, /--canary-packet-output/);
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
    "canary-strict-fail-closed-intake",
    "adapter-strict-canary-contract",
    "canary-remediation-plan",
    "canary-operator-packet",
    "canary-evidence-packet",
    "canary-evidence-packet-review",
    "canary-diagnostic-batch-audit",
    "canary-next-agent-plan",
    "hosted-baseline-preflight",
    "hosted-baseline-collector",
    "recallweave-response-export",
    "recallweave-baseline-collector",
    "baseline-comparison-gate",
    "hosted-baseline-operator-packet",
    "hosted-baseline-next-run",
    "baseline-evidence-packet",
    "baseline-returned-packet-intake",
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

check("post-baseline public evidence guard is honored", () => {
  const releaseState = JSON.parse(readFileSync(join(root, reviewDir, "release-state.json"), "utf8"));
  assert.equal(releaseState.releaseStateGuard?.allowsDocsOnlyCommitsAfterCodeBaseline, true);
  if (releaseState.releaseStateGuard?.enforcePostBaselinePublicEvidenceOnly !== true) return;

  const baselineSha = releaseState.latestVerifiedCodeBaseline?.headSha ?? "";
  assert.match(baselineSha, /^[a-f0-9]{40}$/);
  run("git", ["merge-base", "--is-ancestor", baselineSha, "HEAD"]);
  const changedFiles = run("git", ["diff", "--name-only", `${baselineSha}..HEAD`])
    .stdout.split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  const disallowed = changedFiles.filter((file) => !isPublicEvidencePath(file));
  assert.deepEqual(disallowed, []);
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
    assert.match(text, /canary evidence packet|canary:packet|metrics-only.*zip/i, `${file} missing canary evidence packet`);
    assert.match(text, /research source lock|source-lock|source lock/i, `${file} missing research source lock`);
    assert.match(text, /model matrix|model\/autoresearch|model-autoresearch/i, `${file} missing model matrix`);
    assert.match(text, /context preview|prompt context|recall packet/i, `${file} missing context preview`);
    assert.match(text, /release readiness|public launch verdict|production ready/i, `${file} missing release readiness`);
    assert.match(text, /current-head live|fresh.*browser|live browser/i, `${file} missing current-head live browser evidence`);
    assert.match(text, /clean consumer|consumer smoke|clean checkout/i, `${file} missing clean consumer smoke`);
    assert.match(text, /blocker doctor|release doctor|release blocker/i, `${file} missing release blocker doctor`);
    assert.match(text, /hosted baseline preflight|baseline preflight/i, `${file} missing hosted baseline preflight`);
    assert.match(text, /hosted baseline collector|baseline:collect|baseline collect/i, `${file} missing hosted baseline collector`);
    assert.match(text, /baseline compare|baseline:compare|matched.*comparison/i, `${file} missing baseline comparison`);
    assert.match(text, /hosted baseline operator|baseline:operator-packet|baseline operator packet/i, `${file} missing hosted baseline operator packet`);
    assert.match(text, /baseline evidence packet|baseline:packet|hosted baseline.*metrics-only.*zip/i, `${file} missing baseline evidence packet`);
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
  assert.match(text, /baseline:select-container/);
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

check("fresh local session batch compaction audit passes", () => {
  const report = JSON.parse(run("node", ["packages/bench/session-compaction-local-batch-audit.mjs", "--strict"]).stdout);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "local-session-compaction-batch-audit");
  assert.equal(report.metricsOnly, true);
  assert.equal(report.writesRealFiles, false);
  assert.ok(report.aggregate.sessionCount >= 3);
  assert.ok(report.aggregate.eventCount >= 8);
  assert.ok(report.aggregate.outputCandidates >= 7);
  assert.ok(report.aggregate.averageNoiseReductionRatio >= 0.2);
  assert.equal(report.quality.privacyLeakCount, 0);
  assert.equal(report.quality.chronologicalFailureCount, 0);
  assert.ok(report.quality.sourceCounts.codex >= 1);
  assert.ok(report.quality.sourceCounts.claude >= 1);
  assert.ok(report.quality.sourceCounts.hermes >= 1);
  assert.ok(report.quality.exactIdentifierCandidateCount >= 2);
  assert.equal(JSON.stringify(report).includes("fixture claude private note"), false);
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
  const contractReview = readFileSync(join(root, reviewDir, "gemini-adapter-strict-canary-contract-review.md"), "utf8");
  for (const report of [openclaw, hermes]) {
    assert.equal(report.ok, true);
    assert.equal(report.adapterContractCovered, true);
    assert.equal(report.searchLatencyInstrumentationCovered, true);
    assert.equal(report.storeLatencyInstrumentationCovered, true);
    assert.equal(Number(report.storeLatencySampleCount) > 0, true);
    assert.equal(report.privacyLeakCount, 0);
  }
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  assert.match(geminiReview, /positive `elapsed_ms`|positive elapsed_ms/i);
  assert.match(contractReview, /Verdict:\s*CLEAN/i);
  assert.match(contractReview, /strict.*canary.*contract|adapter.*contract/i);
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
    assert.equal(generatedReport.adapter.name, "recallweave-selfmem-canary");
    assert.equal(generatedReport.adapter.strictCanaryContract, "v1");
    assert.equal(generatedReport.adapter.searchLatencyInstrumentation, true);
    assert.equal(generatedReport.adapter.storeLatencyInstrumentation, true);
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
    const diagnosticZipStrictReport = JSON.parse(diagnosticZipStrict.stdout);
    assert.equal(diagnosticZipStrictReport.ok, false);
    assert.equal(diagnosticZipStrictReport.strictReal, true);
    assert.match(diagnosticZipStrictReport.strictFailureReason, /strict-real cannot use.*fixture/i);
    assert.equal(diagnosticZipStrictReport.fixtureOnly, true);

    const windowFixtureDir = join(tempRoot, "fresh-window-diagnostic");
    mkdirSync(join(windowFixtureDir, "reliability_reports"), { recursive: true });
    writeFileSync(
      join(windowFixtureDir, "container-map.json"),
      JSON.stringify({
        host: "hermes",
        agent_identity: "window-real-agent",
        source_supermemory_container: "window_source_history",
        local_container: "selfmem_window_source_history",
        adapter_contract: {
          name: "recallweave-selfmem-canary",
          version: "2026.05.23.store-latency-v1",
          strictCanaryContract: "v1",
          searchLatencyInstrumentation: true,
          storeLatencyInstrumentation: true,
        },
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
    const weakRealReportPath = join(tempRoot, "weak-real-report.json");
    const weakRealReport = {
      ...windowedReport,
      latencyMs: {
        ...windowedReport.latencyMs,
        storeP50: 0,
        storeP95: 0,
      },
      instrumentation: {
        ...windowedReport.instrumentation,
        storeLatencySampleCount: 0,
        missingStoreLatencyCount: 1,
      },
    };
    writeFileSync(weakRealReportPath, JSON.stringify(weakRealReport), { encoding: "utf8" });
    const summaryStrict = spawnSync("node", ["packages/bench/canary-evidence-intake.mjs", "--report", weakRealReportPath, "--strict-real"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(summaryStrict.status, 0, "weak real report must fail --strict-real");
    const summaryStrictReport = JSON.parse(summaryStrict.stdout);
    assert.equal(summaryStrictReport.ok, false);
    assert.equal(summaryStrictReport.strictReal, true);
    assert.equal(summaryStrictReport.strictRealPassed, false);
    assert.match(summaryStrictReport.strictFailureReason, /real canary report failed checks/i);
    assert.ok(summaryStrictReport.failedChecks.includes("store-latency-instrumented"));
    assert.ok(summaryStrictReport.failedChecks.includes("store-p95"));
    assert.doesNotMatch(summaryStrict.stdout, secretPattern);
    assert.doesNotMatch(summaryStrict.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
    const strict = spawnSync("node", ["packages/bench/canary-evidence-intake.mjs", "--report", reportPath, "--strict-real"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(strict.status, 0, "fixture-derived report must fail --strict-real");
    const strictReport = JSON.parse(strict.stdout);
    assert.equal(strictReport.ok, false);
    assert.equal(strictReport.strictReal, true);
    assert.match(strictReport.strictFailureReason, /strict-real cannot use.*fixture/i);
    assert.equal(strictReport.fixtureOnly, true);
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
  assert.ok(report.commands.some((item) => item.id === "package-passing-evidence" && /canary:packet/.test(item.command) && /--strict-real/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "package-diagnostic-evidence" && /canary:packet/.test(item.command) && /--diagnosis/.test(item.command)));
  for (const command of report.commands.map((item) => item.command).filter((command) => /canary:(intake|diagnose)/.test(command))) {
    const toolSegment = command.slice(command.indexOf("canary:"));
    assert.match(toolSegment, /--output\s+\/tmp\/recallweave-canary-/);
    assert.doesNotMatch(toolSegment, /\s>\s/, "canary JSON evidence commands must use --output instead of shell redirection");
  }
  assert.ok(report.acceptanceCriteria.includes("countsAsRealRolloutEvidence is true"));
  assert.ok(report.acceptanceCriteria.includes("fixtureOnly is false"));
  assert.ok(report.acceptanceCriteria.includes("adapter.strictCanaryContract is v1"));
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

check("fresh canary evidence packet passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-packet-check-"));
  try {
    const packetPath = join(tempRoot, "packet.zip");
    const intakePath = join(tempRoot, "intake.json");
    const fixtureReportPath = join(root, "packages/bench/fixtures/canary-runtime-report.fixture.json");
    writeFileSync(intakePath, run("node", ["packages/bench/canary-evidence-intake.mjs"]).stdout, { encoding: "utf8", mode: 0o600 });
    const packetRun = run("node", [
      "packages/bench/canary-evidence-packet.mjs",
      "--output",
      packetPath,
    ]);
    const packetWithIntakePath = join(tempRoot, "packet-with-intake.zip");
    const packetWithIntakeRun = run("node", [
      "packages/bench/canary-evidence-packet.mjs",
      "--report",
      fixtureReportPath,
      "--intake",
      intakePath,
      "--output",
      packetWithIntakePath,
    ]);
    const strictFixture = spawnSync("node", [
      "packages/bench/canary-evidence-packet.mjs",
      "--report",
      fixtureReportPath,
      "--intake",
      intakePath,
      "--strict-real",
      "--output",
      join(tempRoot, "strict-fixture.zip"),
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const packet = JSON.parse(packetRun.stdout);
    const packetWithIntake = JSON.parse(packetWithIntakeRun.stdout);
    const zipEntries = run("unzip", ["-Z1", packetPath]).stdout.split(/\r?\n/).filter(Boolean).sort();
    const zipWithIntakeEntries = run("unzip", ["-Z1", packetWithIntakePath]).stdout.split(/\r?\n/).filter(Boolean).sort();
    const evidence = readFileSync(join(root, reviewDir, "canary-evidence-packet-evidence.md"), "utf8");
    const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-evidence-packet-review.md"), "utf8");
    assert.equal(packet.ok, true);
    assert.equal(packet.mode, "canary-evidence-packet");
    assert.equal(packet.writesRealFiles, true);
    assert.equal(packet.metricsOnly, true);
    assert.equal(packet.fixtureOnly, true);
    assert.equal(packet.countsAsRealRolloutEvidence, false);
    assert.equal(packet.publicLaunchAllowed, false);
    assert.equal(packet.fleetRolloutAllowed, false);
    assert.deepEqual(zipEntries, ["README.md", "canary-report.json", "manifest.json"]);
    assert.deepEqual(packet.packet.entries, zipEntries);
    assert.equal(packetWithIntake.countsAsRealRolloutEvidence, false);
    assert.deepEqual(zipWithIntakeEntries, ["README.md", "canary-intake.json", "canary-report.json", "manifest.json"]);
    assert.notEqual(strictFixture.status, 0, "strict-real fixture packet must fail closed");
    assert.match(strictFixture.stderr, /strict-real packet requires passing live canary intake evidence/);
    assert.match(evidence, /canary evidence packet/i);
    assert.match(evidence, /canary:packet/i);
    assert.match(evidence, /metrics-only zip/i);
    assert.match(geminiReview, /Verdict:\s*CLEAN/i);
    assert.doesNotMatch(packetRun.stdout, secretPattern);
    assert.doesNotMatch(packetRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("fresh canary evidence packet review passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-packet-review-check-"));
  try {
    const packetPath = join(tempRoot, "packet.zip");
    const packetRun = run("node", [
      "packages/bench/canary-evidence-packet.mjs",
      "--output",
      packetPath,
    ]);
    const reviewRun = run("node", [
      "packages/bench/canary-evidence-packet-review.mjs",
      "--packet",
      packetPath,
    ]);
    const strictReview = spawnSync("node", [
      "packages/bench/canary-evidence-packet-review.mjs",
      "--packet",
      packetPath,
      "--strict-real",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const generatedFixtureReview = run("node", ["packages/bench/canary-evidence-packet-review.mjs"]);
    const packet = JSON.parse(packetRun.stdout);
    const review = JSON.parse(reviewRun.stdout);
    const fixtureReview = JSON.parse(generatedFixtureReview.stdout);
    const strictOutput = JSON.parse(strictReview.stdout);
    const evidence = readFileSync(join(root, reviewDir, "canary-evidence-packet-review-evidence.md"), "utf8");
    const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-evidence-packet-review-review.md"), "utf8");
    assert.equal(packet.mode, "canary-evidence-packet");
    assert.equal(review.ok, true);
    assert.equal(review.mode, "canary-evidence-packet-review");
    assert.equal(review.writesRealFiles, false);
    assert.equal(review.metricsOnly, true);
    assert.equal(review.fixtureOnly, true);
    assert.equal(review.countsAsRealRolloutEvidence, false);
    assert.equal(review.countsAsProductionCanaryEvidence, false);
    assert.equal(review.publicLaunchAllowed, false);
    assert.equal(review.fleetRolloutAllowed, false);
    assert.deepEqual(review.packet.entries, ["README.md", "canary-report.json", "manifest.json"]);
    assert.equal(fixtureReview.generatedFixturePacket, true);
    assert.equal(fixtureReview.writesRealFiles, true);
    assert.notEqual(strictReview.status, 0, "strict-real packet review must fail closed for fixture packets");
    assert.equal(strictOutput.ok, false);
    assert.match(strictOutput.strictFailureReason, /non-fixture packet with passing strict-real intake evidence/);
    assert.ok(strictOutput.failedChecks.includes("strict-real-passed"));
    assert.match(evidence, /canary evidence packet review/i);
    assert.match(evidence, /canary:packet:review/i);
    assert.match(evidence, /strict-real/i);
    assert.match(geminiReview, /Verdict:\s*CLEAN/i);
    assert.doesNotMatch(reviewRun.stdout, secretPattern);
    assert.doesNotMatch(reviewRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("fresh returned canary packet intake passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-returned-canary-packet-check-"));
  try {
    const packetPath = join(tempRoot, "packet.zip");
    const outputPath = join(tempRoot, "returned-intake.json");
    run("node", [
      "packages/bench/canary-evidence-packet.mjs",
      "--output",
      packetPath,
    ]);
    const defaultRun = run("node", ["packages/bench/canary-returned-packet-intake.mjs"]);
    const packetRun = run("node", [
      "packages/bench/canary-returned-packet-intake.mjs",
      "--packet",
      packetPath,
      "--output",
      outputPath,
    ]);
    const requiredRun = spawnSync("node", [
      "packages/bench/canary-returned-packet-intake.mjs",
      "--packet",
      packetPath,
      "--require-production-canary",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const defaultReport = JSON.parse(defaultRun.stdout);
    const packetReport = JSON.parse(packetRun.stdout);
    const outputReport = JSON.parse(readFileSync(outputPath, "utf8"));
    const requiredReport = JSON.parse(requiredRun.stdout);
    const evidence = readFileSync(join(root, reviewDir, "canary-returned-packet-intake-evidence.md"), "utf8");
    const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-returned-packet-intake-review.md"), "utf8");
    assert.equal(defaultReport.mode, "canary-returned-packet-intake");
    assert.equal(defaultReport.status, "NOT_PRODUCTION_EVIDENCE");
    assert.equal(defaultReport.countsAsProductionCanaryEvidence, false);
    assert.equal(defaultReport.publicLaunchAllowed, false);
    assert.equal(defaultReport.fleetRolloutAllowed, false);
    assert.equal(packetReport.mode, "canary-returned-packet-intake");
    assert.equal(packetReport.reviewStrictReal, true);
    assert.equal(packetReport.status, "NOT_PRODUCTION_EVIDENCE");
    assert.equal(packetReport.countsAsProductionCanaryEvidence, false);
    assert.equal(outputReport.mode, "canary-returned-packet-intake");
    assert.notEqual(requiredRun.status, 0, "required production canary must fail closed for fixture packets");
    assert.equal(requiredReport.ok, false);
    assert.equal(requiredReport.requireProductionCanary, true);
    assert.match(evidence, /canary:returned-packet/i);
    assert.match(evidence, /returned evidence packet/i);
    assert.match(evidence, /require-production-canary/i);
    assert.match(geminiReview, /Verdict:\s*CLEAN/i);
    for (const text of [defaultRun.stdout, packetRun.stdout, requiredRun.stdout, evidence]) {
      assert.doesNotMatch(text, secretPattern);
      assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("fresh canary diagnostic batch audit passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-batch-output-check-"));
  const batchOutputPath = join(tempRoot, "batch-audit.json");
  const batchRun = run("node", ["packages/bench/canary-diagnostic-batch-audit.mjs"]);
  const batchOutputRun = run("node", ["packages/bench/canary-diagnostic-batch-audit.mjs", "--output", batchOutputPath]);
  const mixedBadInputPath = join(tempRoot, "selfmem-bad-diagnostic.zip");
  writeFileSync(mixedBadInputPath, "not a zip");
  const mixedStrictRun = spawnSync("node", [
    "packages/bench/canary-diagnostic-batch-audit.mjs",
    "--input",
    "packages/bench/fixtures/canary-diagnostic-export.fixture",
    "--input",
    mixedBadInputPath,
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const mixedAllowedRun = run("node", [
    "packages/bench/canary-diagnostic-batch-audit.mjs",
    "--input",
    "packages/bench/fixtures/canary-diagnostic-export.fixture",
    "--input",
    mixedBadInputPath,
    "--allow-failed-inputs",
  ]);
  const requireRealPassRun = spawnSync("node", [
    "packages/bench/canary-diagnostic-batch-audit.mjs",
    "--require-real-pass",
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const report = JSON.parse(batchRun.stdout);
  const outputReport = JSON.parse(readFileSync(batchOutputPath, "utf8"));
  const outputStdout = JSON.parse(batchOutputRun.stdout);
  const mixedStrictOutput = JSON.parse(mixedStrictRun.stdout);
  const mixedAllowedOutput = JSON.parse(mixedAllowedRun.stdout);
  const strictOutput = JSON.parse(requireRealPassRun.stdout);
  const evidence = readFileSync(join(root, reviewDir, "canary-diagnostic-batch-audit-evidence.md"), "utf8");
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-diagnostic-batch-audit-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "canary-diagnostic-batch-audit");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.inputCount, 1);
  assert.equal(report.parsedInputCount, 1);
  assert.equal(report.failedInputCount, 0);
  assert.equal(report.strictRealPassCount, 0);
  assert.equal(report.countsAsRealRolloutEvidence, false);
  assert.equal(report.publicLaunchAllowed, false);
  assert.equal(report.fleetRolloutAllowed, false);
  assert.equal(outputReport.mode, "canary-diagnostic-batch-audit");
  assert.equal(outputStdout.mode, "canary-diagnostic-batch-audit");
  assert.equal(outputReport.metricsOnly, true);
  assert.notEqual(mixedStrictRun.status, 0, "mixed batch without --allow-failed-inputs must report nonzero status");
  assert.equal(mixedStrictOutput.ok, false);
  assert.equal(mixedStrictOutput.parsedInputCount, 1);
  assert.equal(mixedStrictOutput.failedInputCount, 1);
  assert.equal(mixedStrictOutput.allowFailedInputs, false);
  assert.equal(mixedAllowedOutput.ok, true);
  assert.equal(mixedAllowedOutput.parsedInputCount, 1);
  assert.equal(mixedAllowedOutput.failedInputCount, 1);
  assert.equal(mixedAllowedOutput.allowFailedInputs, true);
  assert.equal(mixedAllowedOutput.countsAsRealRolloutEvidence, false);
  assert.equal(report.bestCandidate.fixtureOnly, true);
  assert.equal(report.bestCandidate.canaryPass, true);
  assert.equal(report.bestCandidate.countsAsRealRolloutEvidence, false);
  assert.equal(report.bestCandidate.privacy.privacyLeakCount, 0);
  assert.equal(report.bestCandidate.privacy.secretPatternHits, 0);
  assert.equal(report.bestCandidate.quality.lifecycleCovered, true);
  assert.equal(report.bestCandidate.quality.hybridSearchCovered, true);
  assert.equal(report.bestCandidate.instrumentation.storeLatencySampleCount > 0, true);
  assert.notEqual(requireRealPassRun.status, 0, "fixture batch must fail --require-real-pass");
  assert.equal(strictOutput.ok, false);
  assert.equal(strictOutput.requireRealPass, true);
  assert.equal(strictOutput.countsAsRealRolloutEvidence, false);
  assert.match(evidence, /canary diagnostic batch audit/i);
  assert.match(evidence, /canary:batch-audit/i);
  assert.match(evidence, /allow-failed-inputs/i);
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  assert.doesNotMatch(batchRun.stdout, secretPattern);
  assert.doesNotMatch(batchRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(mixedAllowedRun.stdout, secretPattern);
  assert.doesNotMatch(mixedAllowedRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(requireRealPassRun.stdout, secretPattern);
  assert.doesNotMatch(requireRealPassRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  rmSync(tempRoot, { recursive: true, force: true });
});

check("fresh canary next-agent plan passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-next-agent-output-check-"));
  const planOutputPath = join(tempRoot, "next-agent-plan.json");
  const planRun = run("node", ["packages/bench/canary-next-agent-plan.mjs"]);
  const planOutputRun = run("node", ["packages/bench/canary-next-agent-plan.mjs", "--output", planOutputPath]);
  const markdownRun = run("node", ["packages/bench/canary-next-agent-plan.mjs", "--format", "markdown"]);
  const report = JSON.parse(planRun.stdout);
  const outputReport = JSON.parse(readFileSync(planOutputPath, "utf8"));
  const outputStdout = JSON.parse(planOutputRun.stdout);
  const evidence = readFileSync(join(root, reviewDir, "canary-next-agent-plan-evidence.md"), "utf8");
  const realPlanEvidence = readFileSync(join(root, reviewDir, "real-next-agent-openclaw-canary-plan.md"), "utf8");
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-next-agent-plan-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "canary-next-agent-plan");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.publicLaunchAllowed, false);
  assert.equal(report.fleetRolloutAllowed, false);
  assert.equal(outputReport.mode, "canary-next-agent-plan");
  assert.equal(outputStdout.mode, "canary-next-agent-plan");
  assert.equal(outputReport.metricsOnly, true);
  assert.equal(report.operatorPacketAvailable, true);
  assert.equal(report.oneAgentCanaryAllowed, false);
  assert.equal(report.selectedCandidate.fixtureOnly, true);
  assert.equal(report.decision.status, "FIXTURE_PLAN_ONLY");
  assert.equal(report.decision.requiredFreshWindowMinutes, 15);
  assert.equal(report.decision.recommendedScope, "one-agent-fresh-canary");
  assert.ok(report.decision.blockReasons.some((item) => item.reason.includes("fixture-only")));
  assert.ok(report.commandPlan.some((item) => item.id === "apply-current-adapter"));
  assert.ok(report.commandPlan.some((item) => item.id === "collect-live-window" && /--canary-packet-output/.test(item.command)));
  assert.ok(report.commandPlan.some((item) => item.id === "diagnose-if-failed"));
  assert.ok(report.commandPlan.some((item) => item.id === "package-passing-evidence"));
  for (const command of report.commandPlan.map((item) => item.command).filter((command) => /canary:(intake|diagnose)/.test(command))) {
    const toolSegment = command.slice(command.indexOf("canary:"));
    assert.match(toolSegment, /--output\s+\/tmp\/recallweave-canary-/);
    assert.doesNotMatch(toolSegment, /\s>\s/, "next-agent JSON evidence commands must use --output instead of shell redirection");
  }
  assert.match(markdownRun.stdout, /RecallWeave Next Agent Canary Plan/);
  assert.match(markdownRun.stdout, /FRESH_WINDOW_START/);
  assert.match(evidence, /canary:next-agent/i);
  assert.match(evidence, /one-agent/i);
  assert.match(realPlanEvidence, /READY_FOR_ONE_AGENT_FRESH_CANARY/);
  assert.match(realPlanEvidence, /Host:\s*`?openclaw`?/i);
  assert.match(realPlanEvidence, /adapter-contract/);
  assert.match(realPlanEvidence, /store-latency-instrumented/);
  assert.match(realPlanEvidence, /Recall p95:\s*1567\.346 ms/i);
  assert.match(realPlanEvidence, /FRESH_WINDOW_START/);
  assert.match(realPlanEvidence, /--strict-real/);
  assert.match(realPlanEvidence, /--canary-intake-output\s+\/tmp\/recallweave-canary-intake\.json/);
  assert.match(realPlanEvidence, /--canary-packet-output\s+\/tmp\/recallweave-canary-evidence-packet\.zip/);
  assert.match(realPlanEvidence, /Do not attach raw logs/i);
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  assert.doesNotMatch(planRun.stdout, secretPattern);
  assert.doesNotMatch(planRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(markdownRun.stdout, secretPattern);
  assert.doesNotMatch(markdownRun.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(realPlanEvidence, secretPattern);
  assert.doesNotMatch(realPlanEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  rmSync(tempRoot, { recursive: true, force: true });
});

check("fresh canary next-agent handoff packet passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-canary-next-agent-packet-check-"));
  const packetPath = join(tempRoot, "next-agent-handoff.zip");
  const packetRun = run("node", ["packages/bench/canary-next-agent-packet.mjs", "--output", packetPath]);
  const requireReadyFixtureRun = spawnSync(
    "node",
    ["packages/bench/canary-next-agent-packet.mjs", "--require-ready", "--output", join(tempRoot, "fixture-should-not-pass.zip")],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const report = JSON.parse(packetRun.stdout);
  const requireReadyFixtureReport = JSON.parse(requireReadyFixtureRun.stdout);
  const entries = run("unzip", ["-Z1", packetPath]).stdout.split(/\r?\n/).filter(Boolean).sort();
  const manifest = JSON.parse(run("unzip", ["-p", packetPath, "manifest.json"]).stdout);
  const readme = run("unzip", ["-p", packetPath, "README.md"]).stdout;
  const markdown = run("unzip", ["-p", packetPath, "next-agent-plan.md"]).stdout;
  const operator = run("unzip", ["-p", packetPath, "strict-real-operator-packet.md"]).stdout;
  const evidence = readFileSync(join(root, reviewDir, "canary-next-agent-packet-evidence.md"), "utf8");
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-next-agent-packet-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "canary-next-agent-handoff-packet");
  assert.equal(report.writesRealFiles, true);
  assert.equal(report.publicSafe, true);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.publicLaunchAllowed, false);
  assert.equal(report.fleetRolloutAllowed, false);
  assert.equal(report.readyForLiveHandoff, false);
  assert.equal(report.requireReadyPassed, true);
  assert.equal(report.host, "hermes");
  assert.equal(report.status, "FIXTURE_PLAN_ONLY");
  assert.notEqual(requireReadyFixtureRun.status, 0);
  assert.equal(requireReadyFixtureReport.ok, false);
  assert.equal(requireReadyFixtureReport.requireReadyPassed, false);
  assert.equal(requireReadyFixtureReport.readyForLiveHandoff, false);
  assert.match(requireReadyFixtureReport.reason, /--require-ready needs READY_FOR_ONE_AGENT_FRESH_CANARY/);
  assert.deepEqual(entries, [
    "README.md",
    "manifest.json",
    "next-agent-plan.json",
    "next-agent-plan.md",
    "strict-real-operator-packet.md",
  ]);
  assert.equal(manifest.mode, "canary-next-agent-handoff-packet");
  assert.equal(manifest.publicSafe, true);
  assert.equal(manifest.metricsOnly, true);
  assert.equal(manifest.publicLaunchAllowed, false);
  assert.equal(manifest.fleetRolloutAllowed, false);
  assert.equal(manifest.readyForLiveHandoff, false);
  assert.equal(manifest.requireReadyPassed, true);
  assert.equal(manifest.blockerPreserved, true);
  assert.equal(manifest.host, "hermes");
  assert.equal(manifest.freshWindowContract.minimumMinutes, 15);
  assert.equal(manifest.freshWindowContract.requiresFreshPostUpdateWindow, true);
  assert.equal(manifest.freshWindowContract.requiresStrictReal, true);
  assert.equal(manifest.freshWindowContract.requiresNonFixtureEvidence, true);
  assert.equal(manifest.freshWindowContract.requiresRollbackTested, true);
  assert.match(manifest.freshWindowContract.returnedPacketIntakeCommand, /--require-production-canary/);
  assert.ok(manifest.returnChecklist.some((item) => /FRESH_WINDOW_START/.test(item)));
  assert.ok(manifest.returnChecklist.some((item) => /metrics-only/.test(item)));
  assert.match(readme, /one selected agent operator/i);
  assert.match(readme, /Canary means a bounded validation window/i);
  assert.match(readme, /Fresh-window contract/i);
  assert.match(readme, /Ready for live handoff: no/i);
  assert.match(readme, /Do not attach raw memories/i);
  assert.match(markdown, /RecallWeave Next Agent Canary Plan/);
  assert.match(markdown, /FRESH_WINDOW_START/);
  assert.match(operator, /RecallWeave Strict-Real Canary Packet/);
  assert.match(operator, /canary:intake/);
  assert.match(evidence, /canary:next-agent-packet/i);
  assert.match(evidence, /single public-safe zip/i);
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  for (const text of [packetRun.stdout, requireReadyFixtureRun.stdout, requireReadyFixtureRun.stderr, readme, markdown, operator, evidence]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

check("current canary handoff packet identity is consistent", () => {
  const packetEvidence = readFileSync(join(root, reviewDir, "canary-next-agent-packet-evidence.md"), "utf8");
  const planEvidence = readFileSync(join(root, reviewDir, "canary-next-agent-plan-evidence.md"), "utf8");
  const diagnosticEvidence = readFileSync(join(root, reviewDir, "real-canary-diagnostic-evidence.md"), "utf8");
  const prBodyDraft = readFileSync(join(root, reviewDir, "pr-body-update-draft.md"), "utf8");
  const issueDraft = readFileSync(join(root, reviewDir, "issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md"), "utf8");
  const identity = currentCanaryPacketIdentity(packetEvidence);
  assert.match(identity.label, /^recallweave-openclaw-next-agent-canary-\d{8}.*\.zip$/);
  assert.match(identity.sha256, /^[a-f0-9]{64}$/);
  for (const text of [packetEvidence, planEvidence, diagnosticEvidence, prBodyDraft, issueDraft]) {
    assert.match(text, new RegExp(escapeRegExp(identity.label)));
    assert.match(text, new RegExp(identity.sha256));
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  }
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
  const doctorRun = run("node", ["packages/bench/release-blocker-doctor.mjs"]);
  const report = JSON.parse(doctorRun.stdout);
  const hostedBlocker = report.blockers.find((item) => item.id === "hosted-supermemory-baseline-not-current");
  const canaryBlocker = report.blockers.find((item) => item.id === "fresh-real-container-canary-not-current");
  assert.match(hostedBlocker.nextAction, /baseline:select-container/);
  assert.match(hostedBlocker.nextAction, /baseline:author-queryset/);
  assert.match(hostedBlocker.nextAction, /baseline:next-run -- --hosted[\s\S]*--require-ready/);
  assert.ok(report.manualCommands.some((item) => /baseline:select-container/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:author-queryset/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:next-run/.test(item) && /--require-ready/.test(item)));
  assert.match(canaryBlocker.nextAction, /canary:next-agent-packet -- --require-ready/);
  assert.ok(report.manualCommands.some((item) => /canary:next-agent-packet/.test(item) && /--require-ready/.test(item)));
});

check("fresh hosted baseline preflight passes", () => {
  const collectorTmp = mkdtempSync(join(tmpdir(), "recallweave-hosted-baseline-"));
  const querySetReportPath = join(collectorTmp, "queryset-report.json");
  const discoveryResultPath = join(collectorTmp, "hosted-baseline-discovery.json");
  const discoveryPrivateMapPath = join(collectorTmp, "hosted-baseline-container-map.private.jsonl");
  const selectedContainerEnvPath = join(collectorTmp, "hosted-baseline.private.env");
  const selectedContainerReportPath = join(collectorTmp, "hosted-baseline-container-select.json");
  const selectedContainerInsideRepoPath = join(root, ".tmp-hosted-baseline.private.env");
  const authoredQuerySetPath = join(collectorTmp, "hosted-baseline-queryset.private.json");
  const authoredQuerySetReportPath = join(collectorTmp, "hosted-baseline-queryset-author-report.json");
  const authoredQuerySetInspectPath = join(collectorTmp, "hosted-baseline-authored-queryset-inspect.json");
  const authoredQuerySetInsideRepoPath = join(root, ".tmp-hosted-baseline-queryset.private.json");
  const collectorResultPath = join(collectorTmp, "collector-result.json");
  const recallWeaveResultPath = join(collectorTmp, "recallweave-result.json");
  const recallWeaveExportPath = join(collectorTmp, "recallweave-export.json");
  const recallWeaveExportCollectorResultPath = join(collectorTmp, "recallweave-export-collector-result.json");
  const recallWeaveLiveExportPath = join(collectorTmp, "recallweave-live-export.json");
  const recallWeaveLiveResponsesPath = join(collectorTmp, "recallweave-live-responses.json");
  const recallWeaveRawResponsesPath = join(collectorTmp, "recallweave-raw-responses.json");
  const recallWeaveLiveResultPath = join(collectorTmp, "recallweave-live-result.json");
  const forcedHostedPath = join(collectorTmp, "forced-hosted-live.json");
  const forcedRecallWeavePath = join(collectorTmp, "forced-recallweave-live.json");
  const missingCounterpartRunPath = join(collectorTmp, "missing-counterpart-run.json");
  const missingMetricPath = join(collectorTmp, "missing-metric.json");
  const missingQuerySetEvidencePath = join(collectorTmp, "missing-query-set-evidence.json");
  const unlabeledQuerySetPath = join(collectorTmp, "unlabeled-queryset.json");
  const baselinePacketPath = join(collectorTmp, "baseline-evidence-packet.zip");
  const strictFixtureBaselinePacketPath = join(collectorTmp, "strict-fixture-baseline-evidence-packet.zip");
  const returnedBaselineIntakePath = join(collectorTmp, "returned-baseline-packet-intake.json");
  const result = run("node", ["packages/bench/hosted-baseline-preflight.mjs"]);
  const querySetInspectResult = run("node", [
    "packages/bench/baseline-queryset-inspect.mjs",
    "--queryset",
    "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
    "--strict",
    "--output",
    querySetReportPath,
  ]);
  writeFileSync(
    unlabeledQuerySetPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        datasetSlice: "unlabeled-fixture-slice",
        judgeModel: "fixture-judge",
        answerModel: "fixture-answer",
        queries: [{ id: "unlabeled", q: "This query has no expected result references." }],
      },
      null,
      2,
    ),
  );
  const discoveryResult = run("node", ["packages/bench/hosted-baseline-discovery.mjs", "--output", discoveryResultPath]);
  const privateMapDiscoveryResult = run(
    "node",
    ["packages/bench/hosted-baseline-discovery.mjs", "--private-map-output", discoveryPrivateMapPath],
    {
      env: {
        ...process.env,
        RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS: "1",
      },
    },
  );
  const containerSelectResult = run("node", [
    "packages/bench/hosted-baseline-container-select.mjs",
    "--discovery",
    discoveryResultPath,
    "--private-map",
    discoveryPrivateMapPath,
    "--env-output",
    selectedContainerEnvPath,
    "--output",
    selectedContainerReportPath,
  ]);
  const containerSelectInsideRepoResult = spawnSync(
    "node",
    [
      "packages/bench/hosted-baseline-container-select.mjs",
      "--discovery",
      discoveryResultPath,
      "--private-map",
      discoveryPrivateMapPath,
      "--env-output",
      selectedContainerInsideRepoPath,
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const querySetAuthorResult = run("node", [
    "packages/bench/hosted-baseline-queryset-author.mjs",
    "--fixture",
    "--queryset-output",
    authoredQuerySetPath,
    "--output",
    authoredQuerySetReportPath,
  ]);
  const authoredQuerySetInspectResult = run("node", [
    "packages/bench/baseline-queryset-inspect.mjs",
    "--queryset",
    authoredQuerySetPath,
    "--strict",
    "--output",
    authoredQuerySetInspectPath,
  ]);
  const querySetAuthorInsideRepoResult = spawnSync(
    "node",
    [
      "packages/bench/hosted-baseline-queryset-author.mjs",
      "--fixture",
      "--queryset-output",
      authoredQuerySetInsideRepoPath,
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const fixtureResult = run("node", ["packages/bench/hosted-baseline-preflight.mjs", "--fixture"]);
  const templateResult = run("node", ["packages/bench/hosted-baseline-preflight.mjs", "--print-template"]);
  const collectorResult = run("node", ["packages/bench/hosted-baseline-collector.mjs", "--fixture", "--output", collectorResultPath]);
  const recallWeaveExportResult = run("node", ["packages/bench/recallweave-response-export.mjs", "--fixture", "--output", recallWeaveExportPath]);
  const recallWeaveCollectorResult = run("node", ["packages/bench/recallweave-baseline-collector.mjs", "--fixture", "--output", recallWeaveResultPath]);
  const recallWeaveExportCollectorResult = run("node", [
    "packages/bench/recallweave-baseline-collector.mjs",
    "--fixture",
    "--responses",
    recallWeaveExportPath,
    "--output",
    recallWeaveExportCollectorResultPath,
  ]);
  const recallWeaveLiveExportResult = run(
    "node",
    [
      "packages/bench/recallweave-response-export.mjs",
      "--live",
      "--queryset",
      "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
      "--memories",
      "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl",
      "--output",
      recallWeaveLiveExportPath,
    ],
    {
      env: {
        ...process.env,
        RECALLWEAVE_BASELINE_LIVE: "1",
        RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
      },
    },
  );
  const sanitizedRecallWeaveResponses = JSON.parse(readFileSync(join(root, "packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json"), "utf8"));
  sanitizedRecallWeaveResponses.fixtureOnly = false;
  sanitizedRecallWeaveResponses.evidenceType = "sanitized-recallweave-response-export";
  for (const response of Object.values(sanitizedRecallWeaveResponses.responses)) {
    for (const result of response.results ?? []) {
      result.score = result.similarity ?? result.score ?? 0;
      result.estimatedTokens = Math.max(1, Math.ceil(String(result.memory ?? "").length / 4));
      delete result.memory;
      delete result.content;
      delete result.chunk;
      delete result.text;
    }
  }
  writeFileSync(recallWeaveLiveResponsesPath, JSON.stringify(sanitizedRecallWeaveResponses, null, 2));
  writeFileSync(recallWeaveRawResponsesPath, readFileSync(join(root, "packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json"), "utf8"));
  const recallWeaveLiveResult = run(
    "node",
    [
      "packages/bench/recallweave-baseline-collector.mjs",
      "--live",
      "--queryset",
      "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
      "--responses",
      recallWeaveLiveResponsesPath,
      "--output",
      recallWeaveLiveResultPath,
    ],
    {
      env: {
        ...process.env,
        RECALLWEAVE_BASELINE_LIVE: "1",
        RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
        RECALLWEAVE_BASELINE_JUDGE_MODEL: "fixture-judge",
        RECALLWEAVE_BASELINE_ANSWER_MODEL: "fixture-answer",
      },
    },
  );
  const rawResponseResult = spawnSync(
    "node",
    [
      "packages/bench/recallweave-baseline-collector.mjs",
      "--live",
      "--queryset",
      "packages/bench/fixtures/hosted-baseline-queryset.fixture.json",
      "--responses",
      recallWeaveRawResponsesPath,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        RECALLWEAVE_BASELINE_LIVE: "1",
        RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
        RECALLWEAVE_BASELINE_JUDGE_MODEL: "fixture-judge",
        RECALLWEAVE_BASELINE_ANSWER_MODEL: "fixture-answer",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const unlabeledHostedCollectorResult = spawnSync(
    "node",
    ["packages/bench/hosted-baseline-collector.mjs", "--fixture", "--queryset", unlabeledQuerySetPath],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const unlabeledRecallWeaveCollectorResult = spawnSync(
    "node",
    [
      "packages/bench/recallweave-baseline-collector.mjs",
      "--fixture",
      "--queryset",
      unlabeledQuerySetPath,
      "--responses",
      "packages/bench/fixtures/recallweave-baseline-search-responses.fixture.json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const collectorPreflightResult = run("node", ["packages/bench/hosted-baseline-preflight.mjs", "--result", collectorResultPath]);
  const comparisonResult = run("node", ["packages/bench/baseline-comparison.mjs", "--fixture"]);
  const matchedCollectorComparison = run("node", [
    "packages/bench/baseline-comparison.mjs",
    "--hosted",
    collectorResultPath,
    "--recallweave",
    recallWeaveResultPath,
  ]);
  const operatorResult = run("node", ["packages/bench/hosted-baseline-operator-packet.mjs"]);
  const operatorDiscoveryResult = run("node", [
    "packages/bench/hosted-baseline-operator-packet.mjs",
    "--discovery",
    "reviews/overnight-20260522/hosted-baseline-live-discovery.json",
  ]);
  const operatorMarkdown = run("node", ["packages/bench/hosted-baseline-operator-packet.mjs", "--format", "markdown"]);
  const nextRunResult = run("node", ["packages/bench/hosted-baseline-next-run.mjs"]);
  const nextRunMarkdown = run("node", ["packages/bench/hosted-baseline-next-run.mjs", "--format", "markdown"]);
  const nextRunRequireReadyFixture = spawnSync(
    "node",
    ["packages/bench/hosted-baseline-next-run.mjs", "--fixture", "--require-ready"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const baselinePacketResult = run("node", ["packages/bench/baseline-evidence-packet.mjs", "--output", baselinePacketPath]);
  const baselinePacketReviewResult = run("node", ["packages/bench/baseline-evidence-packet-review.mjs"]);
  const returnedBaselinePacketResult = run("node", ["packages/bench/baseline-returned-packet-intake.mjs"]);
  const returnedBaselinePacketPathResult = run("node", [
    "packages/bench/baseline-returned-packet-intake.mjs",
    "--packet",
    baselinePacketPath,
    "--output",
    returnedBaselineIntakePath,
  ]);
  const strictFixtureBaselinePacket = spawnSync(
    "node",
    ["packages/bench/baseline-evidence-packet.mjs", "--strict-real", "--output", strictFixtureBaselinePacketPath],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const strictFixtureBaselinePacketReview = spawnSync(
    "node",
    ["packages/bench/baseline-evidence-packet-review.mjs", "--packet", baselinePacketPath, "--strict-real"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const requireProductionBaselinePacket = spawnSync(
    "node",
    [
      "packages/bench/baseline-returned-packet-intake.mjs",
      "--packet",
      baselinePacketPath,
      "--require-production-baseline",
      "--output",
      join(collectorTmp, "returned-baseline-packet-required.json"),
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const report = JSON.parse(result.stdout);
  const querySetReport = JSON.parse(querySetInspectResult.stdout);
  const discoveryReport = JSON.parse(discoveryResult.stdout);
  const privateMapDiscoveryReport = JSON.parse(privateMapDiscoveryResult.stdout);
  const containerSelectReport = JSON.parse(containerSelectResult.stdout);
  const querySetAuthorReport = JSON.parse(querySetAuthorResult.stdout);
  const authoredQuerySetInspectReport = JSON.parse(authoredQuerySetInspectResult.stdout);
  const fixtureReport = JSON.parse(fixtureResult.stdout);
  const templateReport = JSON.parse(templateResult.stdout);
  const collectorReport = JSON.parse(collectorResult.stdout);
  const recallWeaveExportReport = JSON.parse(recallWeaveExportResult.stdout);
  const recallWeaveCollectorReport = JSON.parse(recallWeaveCollectorResult.stdout);
  const recallWeaveExportCollectorReport = JSON.parse(recallWeaveExportCollectorResult.stdout);
  const recallWeaveLiveExportReport = JSON.parse(recallWeaveLiveExportResult.stdout);
  const recallWeaveLiveReport = JSON.parse(recallWeaveLiveResult.stdout);
  const collectorPreflightReport = JSON.parse(collectorPreflightResult.stdout);
  const comparisonReport = JSON.parse(comparisonResult.stdout);
  const matchedCollectorComparisonReport = JSON.parse(matchedCollectorComparison.stdout);
  const operatorPacket = JSON.parse(operatorResult.stdout);
  const operatorDiscoveryPacket = JSON.parse(operatorDiscoveryResult.stdout);
  const nextRunPlan = JSON.parse(nextRunResult.stdout);
  const nextRunRequireReadyFixtureReport = JSON.parse(nextRunRequireReadyFixture.stdout);
  const baselinePacket = JSON.parse(baselinePacketResult.stdout);
  const baselinePacketReview = JSON.parse(baselinePacketReviewResult.stdout);
  const returnedBaselinePacket = JSON.parse(returnedBaselinePacketResult.stdout);
  const returnedBaselinePacketFromPath = JSON.parse(returnedBaselinePacketPathResult.stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-preflight-review.md"), "utf8");
  const querySetEvidence = readFileSync(join(root, reviewDir, "baseline-queryset-inspect-evidence.md"), "utf8");
  const querySetGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-queryset-inspect-review.md"), "utf8");
  const discoveryEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-discovery-evidence.md"), "utf8");
  const discoveryGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-discovery-review.md"), "utf8");
  const containerSelectEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-container-select-evidence.md"), "utf8");
  const containerSelectGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-container-select-review.md"), "utf8");
  const querySetAuthorEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-queryset-author-evidence.md"), "utf8");
  const querySetAuthorGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-queryset-author-review.md"), "utf8");
  const liveDiscoveryReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-discovery.json"), "utf8"));
  const liveDiscoveryEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-live-discovery-evidence.md"), "utf8");
  const liveDiscoveryGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-live-discovery-review.md"), "utf8");
  const collectorEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-collector-evidence.md"), "utf8");
  const collectorGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-collector-review.md"), "utf8");
  const recallWeaveExportEvidence = readFileSync(join(root, reviewDir, "recallweave-response-export-evidence.md"), "utf8");
  const recallWeaveExportGeminiReview = readFileSync(join(root, reviewDir, "gemini-recallweave-response-export-review.md"), "utf8");
  const recallWeaveCollectorEvidence = readFileSync(join(root, reviewDir, "recallweave-baseline-collector-evidence.md"), "utf8");
  const recallWeaveCollectorGeminiReview = readFileSync(join(root, reviewDir, "gemini-recallweave-baseline-collector-review.md"), "utf8");
  const comparisonEvidence = readFileSync(join(root, reviewDir, "baseline-comparison-evidence.md"), "utf8");
  const comparisonGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-comparison-review.md"), "utf8");
  const labeledQuerySetGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-labeled-queryset-gate-review.md"), "utf8");
  const operatorEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-operator-packet-evidence.md"), "utf8");
  const operatorGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-operator-packet-review.md"), "utf8");
  const nextRunEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-next-run-evidence.md"), "utf8");
  const nextRunGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-next-run-review.md"), "utf8");
  const baselinePacketEvidence = readFileSync(join(root, reviewDir, "baseline-evidence-packet-evidence.md"), "utf8");
  const baselinePacketGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-evidence-packet-review.md"), "utf8");
  const baselineReturnedPacketEvidence = readFileSync(join(root, reviewDir, "baseline-returned-packet-intake-evidence.md"), "utf8");
  const baselineReturnedPacketGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-returned-packet-intake-review.md"), "utf8");
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
  assert.equal(querySetReport.mode, "baseline-queryset-inspect");
  assert.equal(querySetReport.metricsOnly, true);
  assert.equal(querySetReport.publicSafe, true);
  assert.equal(querySetReport.rawQueryIncluded, false);
  assert.equal(querySetReport.rawExpectedIdsIncluded, false);
  assert.equal(querySetReport.rawExpectedHashesIncluded, false);
  assert.equal(querySetReport.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(querySetReport.querySetEvidence?.unlabeledQueryCount, 0);
  assert.equal(querySetReport.queryFingerprints?.length, 3);
  assert.ok(querySetReport.source?.querySetHash?.startsWith("sha256:"));
  assert.doesNotMatch(querySetInspectResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.doesNotMatch(readFileSync(querySetReportPath, "utf8"), /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.equal(discoveryReport.mode, "hosted-baseline-discovery");
  assert.equal(discoveryReport.fixtureOnly, true);
  assert.equal(discoveryReport.callsHostedProvider, false);
  assert.equal(discoveryReport.metricsOnly, true);
  assert.equal(discoveryReport.rawLabelsIncluded, false);
  assert.equal(discoveryReport.rawMemoryIncluded, false);
  assert.equal(discoveryReport.privateMap?.written, false);
  assert.equal(discoveryReport.containerCandidateCount, 2);
  assert.match(discoveryReport.containerCandidates?.[0]?.candidateId ?? "", /^c_[a-f0-9]{16}$/);
  assert.equal(privateMapDiscoveryReport.privateMap?.written, true);
  assert.equal(privateMapDiscoveryReport.privateMap?.basename, "hosted-baseline-container-map.private.jsonl");
  assert.equal(privateMapDiscoveryReport.privateMap?.mode, "0600");
  assert.equal(statSync(discoveryPrivateMapPath).mode & 0o777, 0o600);
  const privateMap = readFileSync(discoveryPrivateMapPath, "utf8");
  assert.match(privateMap, /fixture-personal/);
  assert.doesNotMatch(discoveryResult.stdout, /fixture-personal|fixture-agent/);
  assert.doesNotMatch(privateMapDiscoveryResult.stdout, /fixture-personal|fixture-agent/);
  assert.doesNotMatch(discoveryResult.stdout, secretPattern);
  assert.doesNotMatch(privateMapDiscoveryResult.stdout, secretPattern);
  assert.equal(containerSelectReport.mode, "hosted-baseline-container-select");
  assert.equal(containerSelectReport.fixtureOnly, true);
  assert.equal(containerSelectReport.callsHostedProvider, false);
  assert.equal(containerSelectReport.metricsOnly, true);
  assert.equal(containerSelectReport.publicSafe, true);
  assert.equal(containerSelectReport.rawLabelsIncluded, false);
  assert.equal(containerSelectReport.rawMemoryIncluded, false);
  assert.equal(containerSelectReport.privateEnv?.written, true);
  assert.equal(containerSelectReport.privateEnv?.mode, "0600");
  assert.equal(containerSelectReport.privateEnv?.containsRawLabels, true);
  assert.equal(containerSelectReport.privateEnv?.attachToPublicEvidence, false);
  assert.equal(containerSelectReport.selectedCandidate?.candidateId, discoveryReport.recommendedCandidateId);
  assert.equal(containerSelectReport.selectedCandidate?.rawLabelLength, "fixture-personal".length);
  assert.equal(statSync(selectedContainerEnvPath).mode & 0o777, 0o600);
  const selectedContainerEnv = readFileSync(selectedContainerEnvPath, "utf8");
  assert.match(selectedContainerEnv, /RECALLWEAVE_BASELINE_CONTAINER='fixture-personal'/);
  assert.match(selectedContainerEnv, /RECALLWEAVE_BASELINE_LIVE=1/);
  assert.doesNotMatch(containerSelectResult.stdout, /fixture-personal|fixture-agent/);
  assert.doesNotMatch(readFileSync(selectedContainerReportPath, "utf8"), /fixture-personal|fixture-agent/);
  assert.doesNotMatch(containerSelectResult.stdout, secretPattern);
  assert.doesNotMatch(containerSelectResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.notEqual(containerSelectInsideRepoResult.status, 0);
  assert.match(`${containerSelectInsideRepoResult.stderr}\n${containerSelectInsideRepoResult.stdout}`, /outside the repository/);
  assert.equal(querySetAuthorReport.mode, "hosted-baseline-queryset-author");
  assert.equal(querySetAuthorReport.fixtureOnly, true);
  assert.equal(querySetAuthorReport.callsHostedProvider, false);
  assert.equal(querySetAuthorReport.publicSafe, true);
  assert.equal(querySetAuthorReport.metricsOnly, true);
  assert.equal(querySetAuthorReport.rawLabelsIncluded, false);
  assert.equal(querySetAuthorReport.rawQueryIncluded, false);
  assert.equal(querySetAuthorReport.rawExpectedIdsIncluded, false);
  assert.equal(querySetAuthorReport.rawExpectedHashesIncluded, false);
  assert.equal(querySetAuthorReport.rawMemoryIncluded, false);
  assert.equal(querySetAuthorReport.privateQuerySet?.written, true);
  assert.equal(querySetAuthorReport.privateQuerySet?.mode, "0600");
  assert.equal(querySetAuthorReport.privateQuerySet?.containsRawQueries, true);
  assert.equal(querySetAuthorReport.privateQuerySet?.containsExpectedResultRefs, true);
  assert.equal(querySetAuthorReport.privateQuerySet?.attachToPublicEvidence, false);
  assert.equal(querySetAuthorReport.countsAsBenchmarkEvidence, false);
  assert.equal(querySetAuthorReport.authoringReviewRequired, true);
  assert.equal(querySetAuthorReport.querySetEvidence?.queryCount, 3);
  assert.ok(Number(querySetAuthorReport.querySetEvidence?.minExpectedRefsPerQuery) >= 1);
  assert.ok(querySetAuthorReport.querySetEvidence?.querySetHash?.startsWith("sha256:"));
  assert.equal(statSync(authoredQuerySetPath).mode & 0o777, 0o600);
  assert.equal(authoredQuerySetInspectReport.mode, "baseline-queryset-inspect");
  assert.equal(authoredQuerySetInspectReport.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(authoredQuerySetInspectReport.querySetEvidence?.unlabeledQueryCount, 0);
  assert.doesNotMatch(querySetAuthorResult.stdout, /fixture-personal|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma/);
  assert.doesNotMatch(readFileSync(authoredQuerySetReportPath, "utf8"), /fixture-personal|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma/);
  assert.doesNotMatch(querySetAuthorResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.doesNotMatch(readFileSync(authoredQuerySetReportPath, "utf8"), /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.notEqual(querySetAuthorInsideRepoResult.status, 0);
  assert.match(`${querySetAuthorInsideRepoResult.stderr}\n${querySetAuthorInsideRepoResult.stdout}`, /outside the repository/);
  assert.equal(fixtureReport.resultInspection?.fixtureOnly, true);
  assert.deepEqual(fixtureReport.resultInspection?.failedResultChecks, ["not-fixture"]);
  assert.equal(fixtureReport.countsAsHostedBaselineEvidence, false);
  assert.equal(fixtureReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(templateReport.resultTemplateIncluded, true);
  assert.equal(templateReport.baselineResultTemplate?.provider, "hosted-supermemory");
  assert.equal(templateReport.baselineResultTemplate?.metricsOnly, true);
  assert.equal(templateReport.baselineResultTemplate?.querySetEvidence?.publicBenchmarkReady, false);
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
  assert.equal(collectorReport.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(collectorReport.querySetEvidence?.unlabeledQueryCount, 0);
  assert.equal(collectorReport.querySetEvidence?.minExpectedRefsPerQuery, 1);
  assert.equal(collectorReport.searchConfig?.endpoint, "fixture");
  assert.ok(Number(collectorReport.metrics?.pAt1) > 0);
  assert.equal(recallWeaveExportReport.evidenceType, "fixture-recallweave-response-export");
  assert.equal(recallWeaveExportReport.metricsOnly, true);
  assert.equal(recallWeaveExportReport.rawMemoryIncluded, false);
  assert.equal(recallWeaveExportReport.rawTranscriptIncluded, false);
  assert.equal(recallWeaveExportReport.rawPromptIncluded, false);
  assert.equal(recallWeaveExportReport.rawAnswerIncluded, false);
  assert.equal(recallWeaveExportReport.privacyLeakCount, 0);
  assert.equal(recallWeaveExportReport.redactionFailureCount, 0);
  assert.equal(recallWeaveExportReport.inputStats?.skippedFullyPrivate, 1);
  assert.equal(recallWeaveExportReport.source?.preserveIds, true);
  assert.equal(Object.keys(recallWeaveExportReport.responses ?? {}).length, 3);
  assert.doesNotMatch(recallWeaveExportResult.stdout, /\b(memory|content|chunk|text|raw|rawText|document)"\s*:/);
  assert.equal(recallWeaveExportCollectorReport.provider, "recallweave");
  assert.equal(recallWeaveExportCollectorReport.metricsOnly, true);
  assert.equal(recallWeaveExportCollectorReport.rawMemoryIncluded, false);
  assert.equal(recallWeaveExportCollectorReport.querySetHash, collectorReport.querySetHash);
  assert.equal(recallWeaveExportCollectorReport.scoringCodeHash, collectorReport.scoringCodeHash);
  assert.equal(recallWeaveExportCollectorReport.querySetEvidence?.publicBenchmarkReady, true);
  assert.ok(Number(recallWeaveExportCollectorReport.metrics?.pAt1) > 0);
  assert.equal(recallWeaveCollectorReport.provider, "recallweave");
  assert.equal(recallWeaveCollectorReport.metricsOnly, true);
  assert.equal(recallWeaveCollectorReport.fixtureOnly, true);
  assert.equal(recallWeaveCollectorReport.rawMemoryIncluded, false);
  assert.equal(recallWeaveCollectorReport.rawTranscriptIncluded, false);
  assert.equal(recallWeaveCollectorReport.rawPromptIncluded, false);
  assert.equal(recallWeaveCollectorReport.rawAnswerIncluded, false);
  assert.equal(recallWeaveCollectorReport.privacyLeakCount, 0);
  assert.ok(recallWeaveCollectorReport.querySetHash?.startsWith("sha256:"));
  assert.ok(recallWeaveCollectorReport.scoringCodeHash?.startsWith("sha256:"));
  assert.equal(recallWeaveCollectorReport.querySetHash, collectorReport.querySetHash);
  assert.equal(recallWeaveCollectorReport.scoringCodeHash, collectorReport.scoringCodeHash);
  assert.equal(recallWeaveCollectorReport.resultFingerprints?.length, 3);
  assert.equal(recallWeaveCollectorReport.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(recallWeaveCollectorReport.querySetEvidence?.unlabeledQueryCount, 0);
  assert.equal(recallWeaveCollectorReport.querySetEvidence?.minExpectedRefsPerQuery, 1);
  assert.equal(recallWeaveCollectorReport.retrievalConfig?.source, "fixture");
  assert.equal(recallWeaveCollectorReport.retrievalConfig?.rawResponseTextAllowed, false);
  assert.ok(Number(recallWeaveCollectorReport.metrics?.pAt1) > 0);
  assert.equal(recallWeaveLiveExportReport.evidenceType, "live-recallweave-response-export");
  assert.equal(recallWeaveLiveExportReport.metricsOnly, true);
  assert.equal(recallWeaveLiveExportReport.rawMemoryIncluded, false);
  assert.equal(recallWeaveLiveExportReport.source?.kind, "local-container-memories-jsonl");
  assert.equal(recallWeaveLiveExportReport.source?.preserveIds, false);
  assert.ok(recallWeaveLiveExportReport.source?.memoriesFileHash?.startsWith("sha256:"));
  assert.equal(recallWeaveLiveExportReport.inputStats?.skippedFullyPrivate, 1);
  assert.doesNotMatch(recallWeaveLiveExportResult.stdout, /\b(memory|content|chunk|text|raw|rawText|document)"\s*:/);
  assert.equal(recallWeaveLiveReport.provider, "recallweave");
  assert.equal(recallWeaveLiveReport.fixtureOnly, true);
  assert.equal(recallWeaveLiveReport.metricsOnly, true);
  assert.equal(recallWeaveLiveReport.rawMemoryIncluded, false);
  assert.equal(recallWeaveLiveReport.querySetHash, collectorReport.querySetHash);
  assert.equal(recallWeaveLiveReport.scoringCodeHash, collectorReport.scoringCodeHash);
  assert.equal(recallWeaveLiveReport.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(recallWeaveLiveReport.retrievalConfig?.source, "recallweave-response-export");
  assert.equal(recallWeaveLiveReport.retrievalConfig?.rawResponseTextAllowed, false);
  assert.notEqual(rawResponseResult.status, 0);
  assert.match(`${rawResponseResult.stderr}\n${rawResponseResult.stdout}`, /contains raw response text/);
  assert.notEqual(unlabeledHostedCollectorResult.status, 0);
  assert.match(`${unlabeledHostedCollectorResult.stderr}\n${unlabeledHostedCollectorResult.stdout}`, /needs at least one expectedResultId or expectedResultHash/);
  assert.notEqual(unlabeledRecallWeaveCollectorResult.status, 0);
  assert.match(`${unlabeledRecallWeaveCollectorResult.stderr}\n${unlabeledRecallWeaveCollectorResult.stdout}`, /needs at least one expectedResultId or expectedResultHash/);
  const unlabeledQuerySetInspectResult = spawnSync(
    "node",
    ["packages/bench/baseline-queryset-inspect.mjs", "--queryset", unlabeledQuerySetPath, "--strict"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.notEqual(unlabeledQuerySetInspectResult.status, 0);
  const unlabeledQuerySetReport = JSON.parse(unlabeledQuerySetInspectResult.stdout);
  assert.equal(unlabeledQuerySetReport.mode, "baseline-queryset-inspect");
  assert.equal(unlabeledQuerySetReport.querySetEvidence?.publicBenchmarkReady, false);
  assert.equal(unlabeledQuerySetReport.querySetEvidence?.unlabeledQueryCount, 1);
  assert.ok(unlabeledQuerySetReport.failedChecks?.includes("labeled-query-set"));
  assert.equal(collectorPreflightReport.resultInspection?.fixtureOnly, true);
  assert.equal(collectorPreflightReport.resultInspection?.provider, "hosted-supermemory");
  assert.equal(collectorPreflightReport.resultInspection?.metricsOnly, true);
  assert.equal(collectorPreflightReport.resultInspection?.querySetEvidence?.publicBenchmarkReady, true);
  assert.deepEqual(collectorPreflightReport.resultInspection?.failedResultChecks, ["not-fixture"]);
  assert.equal(collectorPreflightReport.countsAsHostedBaselineEvidence, false);
  assert.equal(comparisonReport.ok ?? true, true);
  assert.equal(comparisonReport.mode, "baseline-comparison");
  assert.equal(comparisonReport.writesRealFiles, false);
  assert.equal(comparisonReport.callsHostedProvider, false);
  assert.equal(comparisonReport.metricsOnly, true);
  assert.equal(comparisonReport.fixtureOnly, true);
  assert.equal(comparisonReport.hosted?.provider, "hosted-supermemory");
  assert.equal(comparisonReport.recallWeave?.provider, "recallweave");
  assert.equal(comparisonReport.comparability?.sameDataset, true);
  assert.equal(comparisonReport.comparability?.sameQuerySet, true);
  assert.equal(comparisonReport.comparability?.sameScoringCode, true);
  assert.equal(comparisonReport.comparability?.sameJudge, true);
  assert.equal(comparisonReport.comparability?.sameAnswerModel, true);
  assert.equal(comparisonReport.comparability?.matchedCounterpartRuns, true);
  assert.equal(comparisonReport.hosted?.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(comparisonReport.recallWeave?.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(comparisonReport.privacy?.privacyLeakCount, 0);
  assert.equal(comparisonReport.privacy?.redactionFailureCount, 0);
  assert.equal(comparisonReport.recallWeaveWin, true);
  assert.equal(comparisonReport.countsAsComparisonEvidence, false);
  assert.equal(comparisonReport.publicBenchmarkClaimsAllowed, false);
  assert.ok(comparisonReport.failedChecks?.includes("hosted-not-fixture"));
  assert.ok(comparisonReport.failedChecks?.includes("recallweave-not-fixture"));
  assert.ok(Number(comparisonReport.deltas?.quality) > 0);
  assert.equal(matchedCollectorComparisonReport.mode, "baseline-comparison");
  assert.equal(matchedCollectorComparisonReport.comparability?.sameDataset, true);
  assert.equal(matchedCollectorComparisonReport.comparability?.sameQuerySet, true);
  assert.equal(matchedCollectorComparisonReport.comparability?.sameScoringCode, true);
  assert.equal(matchedCollectorComparisonReport.comparability?.sameJudge, true);
  assert.equal(matchedCollectorComparisonReport.comparability?.sameAnswerModel, true);
  assert.equal(matchedCollectorComparisonReport.countsAsComparisonEvidence, false);
  assert.equal(matchedCollectorComparisonReport.publicBenchmarkClaimsAllowed, false);
  assert.ok(matchedCollectorComparisonReport.failedChecks?.includes("hosted-not-fixture"));
  assert.ok(matchedCollectorComparisonReport.failedChecks?.includes("recallweave-not-fixture"));
  const forcedHosted = JSON.parse(readFileSync(join(root, "packages/bench/fixtures/hosted-baseline-result.fixture.json"), "utf8"));
  const forcedRecallWeave = JSON.parse(readFileSync(join(root, "packages/bench/fixtures/recallweave-baseline-result.fixture.json"), "utf8"));
  forcedHosted.fixtureOnly = false;
  forcedHosted.evidenceType = "live-hosted-baseline-result";
  forcedRecallWeave.fixtureOnly = false;
  forcedRecallWeave.evidenceType = "live-recallweave-result";
  writeFileSync(forcedHostedPath, JSON.stringify(forcedHosted, null, 2));
  writeFileSync(forcedRecallWeavePath, JSON.stringify(forcedRecallWeave, null, 2));
  const forcedFixtureComparison = JSON.parse(
    run("node", ["packages/bench/baseline-comparison.mjs", "--fixture", "--hosted", forcedHostedPath, "--recallweave", forcedRecallWeavePath]).stdout,
  );
  assert.equal(forcedFixtureComparison.fixtureOnly, true);
  assert.equal(forcedFixtureComparison.countsAsComparisonEvidence, false);
  assert.equal(forcedFixtureComparison.publicBenchmarkClaimsAllowed, false);
  const missingCounterpartRun = structuredClone(forcedHosted);
  missingCounterpartRun.matchedRecallWeaveRunPresent = false;
  writeFileSync(missingCounterpartRunPath, JSON.stringify(missingCounterpartRun, null, 2));
  const missingCounterpartRunComparison = JSON.parse(
    run(
      "node",
      ["packages/bench/baseline-comparison.mjs", "--hosted", missingCounterpartRunPath, "--recallweave", forcedRecallWeavePath],
      { env: { ...process.env, RECALLWEAVE_REVIEWER_APPROVAL_COUNT: "2" } },
    ).stdout,
  );
  assert.equal(missingCounterpartRunComparison.comparability?.matchedCounterpartRuns, false);
  assert.equal(missingCounterpartRunComparison.countsAsComparisonEvidence, false);
  assert.equal(missingCounterpartRunComparison.publicBenchmarkClaimsAllowed, false);
  assert.ok(missingCounterpartRunComparison.failedChecks?.includes("matched-counterpart-runs"));
  const missingMetric = structuredClone(forcedRecallWeave);
  delete missingMetric.metrics.quality;
  writeFileSync(missingMetricPath, JSON.stringify(missingMetric, null, 2));
  const missingMetricResult = spawnSync("node", ["packages/bench/baseline-comparison.mjs", "--hosted", forcedHostedPath, "--recallweave", missingMetricPath], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.notEqual(missingMetricResult.status, 0);
  assert.match(`${missingMetricResult.stderr}\n${missingMetricResult.stdout}`, /metrics\.quality must be present and finite/);
  const missingQuerySetEvidence = structuredClone(forcedRecallWeave);
  delete missingQuerySetEvidence.querySetEvidence;
  writeFileSync(missingQuerySetEvidencePath, JSON.stringify(missingQuerySetEvidence, null, 2));
  const missingQuerySetEvidenceResult = spawnSync(
    "node",
    ["packages/bench/baseline-comparison.mjs", "--hosted", forcedHostedPath, "--recallweave", missingQuerySetEvidencePath],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.notEqual(missingQuerySetEvidenceResult.status, 0);
  assert.match(`${missingQuerySetEvidenceResult.stderr}\n${missingQuerySetEvidenceResult.stdout}`, /missing querySetEvidence/);
  assert.equal(operatorPacket.ok, true);
  assert.equal(operatorPacket.mode, "hosted-baseline-operator-packet");
  assert.equal(operatorPacket.writesRealFiles, false);
  assert.equal(operatorPacket.callsHostedProvider, false);
  assert.equal(operatorPacket.publicSafe, true);
  assert.equal(operatorDiscoveryPacket.mode, "hosted-baseline-operator-packet");
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.fixtureOnly, false);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.callsHostedProvider, true);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.documentsSeen, 100);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.containerCandidateCount, 4);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.rawLabelsIncluded, false);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.rawMemoryIncluded, false);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.privacyLeakCount, 0);
  assert.match(operatorDiscoveryPacket.liveDiscovery?.recommendedCandidateId ?? "", /^c_[a-f0-9]{16}$/);
  assert.ok(operatorDiscoveryPacket.liveDiscovery?.candidateIds?.includes(operatorDiscoveryPacket.liveDiscovery?.recommendedCandidateId));
  assert.ok(operatorDiscoveryPacket.liveDiscovery?.candidateIds?.every((id) => /^c_[a-f0-9]{16}$/.test(id)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "discover-hosted-containers" && /baseline:discover/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "write-private-container-map" && /RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "select-private-container" && /baseline:select-container/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "author-private-query-set" && /baseline:author-queryset/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "print-template" && /baseline:preflight/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "validate-query-set" && /baseline:queryset/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "export-recallweave-responses" && /baseline:export:recallweave/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "collect-live-result" && /baseline:collect/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "package-baseline-evidence" && /baseline:packet/.test(item.command) && /--strict-real/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "validate-live-result" && /RECALLWEAVE_BASELINE_NO_RAW_TEXT=1/.test(item.command)));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-author-report.json"));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-report.json"));
  for (const command of operatorPacket.commands.map((item) => item.command).filter((command) => /baseline:(preflight|compare)/.test(command))) {
    if (/--fixture/.test(command)) continue;
    const toolSegment = command.slice(command.indexOf("baseline:"));
    assert.match(toolSegment, /--output\s+\/tmp\/recallweave-/);
    assert.doesNotMatch(toolSegment, /\s>\s/, "hosted baseline JSON evidence commands must use --output instead of shell redirection");
  }
  assert.ok(operatorPacket.acceptanceCriteria.includes("reviewerApprovalCount is at least 2 before comparison claims"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("querySetEvidence.publicBenchmarkReady is true"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("every query has at least one expectedResultId or expectedResultHash"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("private query set, if auto-authored, was reviewed locally before collection"));
  assert.ok(operatorPacket.forbidden.includes("provider keys"));
  assert.ok(operatorPacket.forbidden.includes("private container map"));
  assert.ok(operatorPacket.forbidden.some((item) => /private.*query set/i.test(item)));
  assert.match(operatorMarkdown.stdout, /RecallWeave Hosted Baseline Packet/);
  assert.match(operatorMarkdown.stdout, /baseline:discover/);
  assert.match(operatorMarkdown.stdout, /private raw-label map/i);
  assert.match(operatorMarkdown.stdout, /baseline:select-container/);
  assert.match(operatorMarkdown.stdout, /baseline:author-queryset/);
  assert.match(operatorMarkdown.stdout, /baseline:queryset/);
  assert.match(operatorMarkdown.stdout, /baseline:export:recallweave/);
  assert.match(operatorMarkdown.stdout, /baseline:packet/);
  assert.match(operatorMarkdown.stdout, /Attach Only/);
  assert.equal(nextRunPlan.ok, true);
  assert.equal(nextRunPlan.mode, "hosted-baseline-next-run");
  assert.equal(nextRunPlan.writesRealFiles, false);
  assert.equal(nextRunPlan.callsHostedProvider, false);
  assert.equal(nextRunPlan.metricsOnly, true);
  assert.equal(nextRunPlan.plannerAuthorizesPublicClaims, false);
  assert.equal(nextRunPlan.publicLaunchAllowed, false);
  assert.equal(nextRunPlan.readyForOwnerReview, false);
  assert.equal(nextRunPlan.requireReadyPassed, true);
  assert.equal(nextRunPlan.blockerPreserved, true);
  assert.equal(nextRunPlan.status, "FIXTURE_PLAN_ONLY");
  assert.equal(nextRunPlan.evidence?.hosted?.provider, "hosted-supermemory");
  assert.equal(nextRunPlan.evidence?.recallWeave?.provider, "recallweave");
  assert.equal(nextRunPlan.evidence?.preflight?.countsAsHostedBaselineEvidence, false);
  assert.equal(nextRunPlan.evidence?.comparison?.recallWeaveWin, true);
  assert.equal(nextRunPlan.evidence?.comparison?.countsAsComparisonEvidence, false);
  assert.equal(nextRunPlan.privacy?.privacyLeakCount, 0);
  assert.equal(nextRunPlan.comparability?.sameQuerySet, true);
  assert.equal(nextRunPlan.strictRealEvidenceRequired?.hostedNonFixture, false);
  assert.equal(nextRunPlan.strictRealEvidenceRequired?.recallWeaveNonFixture, false);
  assert.equal(nextRunPlan.strictRealEvidenceRequired?.reviewersRequired, 2);
  assert.ok(nextRunPlan.acceptanceCriteria?.includes("querySetEvidence.publicBenchmarkReady is true for both runs"));
  assert.ok(nextRunPlan.acceptanceCriteria?.includes("every query has at least one expected result id or expected content hash"));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "discover-hosted-containers" && /baseline:discover/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "write-private-container-map" && /RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "select-private-container" && /baseline:select-container/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "author-private-query-set" && /baseline:author-queryset/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "validate-query-set" && /baseline:queryset/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "collect-hosted-baseline" && /baseline:collect/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "export-recallweave-responses" && /baseline:export:recallweave/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "compare-matched-results" && /baseline:compare/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "package-review-evidence" && /baseline:packet/.test(item.command)));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-author-report.json"));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-report.json"));
  for (const command of nextRunPlan.commandPlan.map((item) => item.command).filter((command) => /baseline:(preflight|compare)/.test(command))) {
    if (/--fixture/.test(command)) continue;
    const toolSegment = command.slice(command.indexOf("baseline:"));
    assert.match(toolSegment, /--output\s+\/tmp\/recallweave-/);
    assert.doesNotMatch(toolSegment, /\s>\s/, "baseline next-run JSON evidence commands must use --output instead of shell redirection");
  }
  assert.match(nextRunMarkdown.stdout, /RecallWeave Hosted Baseline Next Run/);
  assert.match(nextRunMarkdown.stdout, /Ready for owner review: no/);
  assert.match(nextRunMarkdown.stdout, /Planner authorizes public claims: no/);
  assert.match(nextRunMarkdown.stdout, /baseline:next-run/);
  assert.match(nextRunMarkdown.stdout, /baseline:discover/);
  assert.match(nextRunMarkdown.stdout, /baseline:select-container/);
  assert.match(nextRunMarkdown.stdout, /baseline:author-queryset/);
  assert.match(nextRunMarkdown.stdout, /private container maps/i);
  assert.notEqual(nextRunRequireReadyFixture.status, 0);
  assert.equal(nextRunRequireReadyFixtureReport.ok, false);
  assert.equal(nextRunRequireReadyFixtureReport.mode, "hosted-baseline-next-run");
  assert.equal(nextRunRequireReadyFixtureReport.readyForOwnerReview, false);
  assert.equal(nextRunRequireReadyFixtureReport.requireReadyPassed, false);
  assert.equal(nextRunRequireReadyFixtureReport.blockerPreserved, true);
  assert.match(nextRunRequireReadyFixtureReport.reason, /--require-ready needs READY_FOR_OWNER_REVIEW/);
  assert.doesNotMatch(`${nextRunRequireReadyFixture.stdout}\n${nextRunRequireReadyFixture.stderr}`, secretPattern);
  assert.doesNotMatch(`${nextRunRequireReadyFixture.stdout}\n${nextRunRequireReadyFixture.stderr}`, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.equal(baselinePacket.mode, "baseline-evidence-packet");
  assert.equal(baselinePacket.metricsOnly, true);
  assert.equal(baselinePacket.fixtureOnly, true);
  assert.equal(baselinePacket.countsAsHostedBaselineEvidence, false);
  assert.equal(baselinePacket.countsAsComparisonEvidence, false);
  assert.equal(baselinePacket.publicLaunchAllowed, false);
  assert.equal(baselinePacket.packet?.entries?.length, 6);
  assert.deepEqual(baselinePacket.packet?.entries, [
    "README.md",
    "baseline-comparison.json",
    "hosted-baseline-preflight.json",
    "hosted-baseline-result.json",
    "manifest.json",
    "recallweave-result.json",
  ]);
  assert.notEqual(strictFixtureBaselinePacket.status, 0);
  assert.match(
    `${strictFixtureBaselinePacket.stderr}\n${strictFixtureBaselinePacket.stdout}`,
    /strict-real baseline packet requires (?:--preflight|real hosted, RecallWeave, comparison, and preflight evidence)/,
  );
  assert.equal(baselinePacketReview.mode, "baseline-evidence-packet-review");
  assert.equal(baselinePacketReview.metricsOnly, true);
  assert.equal(baselinePacketReview.fixtureOnly, true);
  assert.equal(baselinePacketReview.countsAsProductionBaselineEvidence, false);
  assert.equal(baselinePacketReview.countsAsPublicBenchmarkEvidence, false);
  assert.equal(returnedBaselinePacket.mode, "baseline-returned-packet-intake");
  assert.equal(returnedBaselinePacket.status, "NOT_BASELINE_EVIDENCE");
  assert.equal(returnedBaselinePacket.countsAsProductionBaselineEvidence, false);
  assert.equal(returnedBaselinePacket.publicLaunchAllowed, false);
  assert.equal(returnedBaselinePacketFromPath.reviewStrictReal, true);
  assert.equal(returnedBaselinePacketFromPath.status, "NOT_BASELINE_EVIDENCE");
  assert.notEqual(strictFixtureBaselinePacketReview.status, 0);
  assert.match(`${strictFixtureBaselinePacketReview.stderr}\n${strictFixtureBaselinePacketReview.stdout}`, /strict-real review requires/i);
  assert.notEqual(requireProductionBaselinePacket.status, 0);
  assert.match(`${requireProductionBaselinePacket.stderr}\n${requireProductionBaselinePacket.stdout}`, /NOT_BASELINE_EVIDENCE|strict-real review requires/i);
  assert.match(discoveryEvidence, /hosted baseline discovery/i);
  assert.match(discoveryEvidence, /Raw labels included.*no/i);
  assert.match(discoveryEvidence, /Private map mode:\s*`0600`/i);
  assert.match(discoveryGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(containerSelectEvidence, /hosted baseline container selector/i);
  assert.match(containerSelectEvidence, /baseline:select-container/i);
  assert.match(containerSelectEvidence, /Private env mode:\s*`0600`/i);
  assert.match(containerSelectEvidence, /Raw labels included.*no/i);
  assert.match(containerSelectGeminiReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.match(querySetAuthorEvidence, /hosted baseline query-set author/i);
  assert.match(querySetAuthorEvidence, /baseline:author-queryset/i);
  assert.match(querySetAuthorEvidence, /Private query set mode:\s*`0600`/i);
  assert.match(querySetAuthorEvidence, /Raw queries included.*no/i);
  assert.match(querySetAuthorGeminiReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.equal(liveDiscoveryReport.mode, "hosted-baseline-discovery");
  assert.equal(liveDiscoveryReport.fixtureOnly, false);
  assert.equal(liveDiscoveryReport.callsHostedProvider, true);
  assert.equal(liveDiscoveryReport.publicSafe, true);
  assert.equal(liveDiscoveryReport.metricsOnly, true);
  assert.equal(liveDiscoveryReport.rawLabelsIncluded, false);
  assert.equal(liveDiscoveryReport.rawMemoryIncluded, false);
  assert.equal(liveDiscoveryReport.privacyLeakCount, 0);
  assert.equal(liveDiscoveryReport.redactionFailureCount, 0);
  assert.ok(Number(liveDiscoveryReport.sourceStats?.documentsSeen) > 0);
  assert.ok(Number(liveDiscoveryReport.containerCandidateCount) > 0);
  assert.deepEqual(liveDiscoveryReport.sourceStats?.errors ?? [], []);
  assert.match(liveDiscoveryEvidence, /does not close the hosted-baseline blocker/i);
  assert.match(liveDiscoveryGeminiReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.match(collectorEvidence, /hosted baseline collector/i);
  assert.match(collectorGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(recallWeaveExportEvidence, /RecallWeave response export/i);
  assert.match(recallWeaveExportGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(recallWeaveCollectorEvidence, /RecallWeave baseline collector/i);
  assert.match(recallWeaveCollectorGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(comparisonEvidence, /baseline comparison/i);
  assert.match(comparisonGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(labeledQuerySetGeminiReview, /Verdict:\s*`?PASS`?/i);
  assert.match(operatorEvidence, /hosted baseline operator packet/i);
  assert.match(operatorGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(nextRunEvidence, /hosted baseline next-run/i);
  assert.match(nextRunEvidence, /baseline:next-run/i);
  assert.match(nextRunGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(baselinePacketEvidence, /baseline evidence packet/i);
  assert.match(baselinePacketEvidence, /baseline:packet/i);
  assert.match(baselinePacketGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(baselineReturnedPacketEvidence, /returned baseline evidence packet|returned hosted baseline packet/i);
  assert.match(baselineReturnedPacketEvidence, /baseline:returned-packet/i);
  assert.match(baselineReturnedPacketGeminiReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.match(querySetEvidence, /baseline:queryset/i);
  assert.match(querySetEvidence, /publicBenchmarkReady/i);
  assert.match(querySetGeminiReview, /Verdict:\s*CLEAN|Verdict:\s*`?PASS`?|^CLEAN/m);
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
  assert.doesNotMatch(querySetInspectResult.stdout, secretPattern);
  assert.doesNotMatch(querySetEvidence, secretPattern);
  assert.doesNotMatch(querySetGeminiReview, secretPattern);
  assert.doesNotMatch(collectorResult.stdout, secretPattern);
  assert.doesNotMatch(recallWeaveExportResult.stdout, secretPattern);
  assert.doesNotMatch(recallWeaveExportCollectorResult.stdout, secretPattern);
  assert.doesNotMatch(recallWeaveLiveExportResult.stdout, secretPattern);
  assert.doesNotMatch(recallWeaveCollectorResult.stdout, secretPattern);
  assert.doesNotMatch(recallWeaveLiveResult.stdout, secretPattern);
  assert.doesNotMatch(collectorPreflightResult.stdout, secretPattern);
  assert.doesNotMatch(discoveryEvidence, secretPattern);
  assert.doesNotMatch(discoveryGeminiReview, secretPattern);
  assert.doesNotMatch(containerSelectResult.stdout, secretPattern);
  assert.doesNotMatch(containerSelectEvidence, secretPattern);
  assert.doesNotMatch(containerSelectGeminiReview, secretPattern);
  assert.doesNotMatch(containerSelectEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(containerSelectGeminiReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(querySetAuthorResult.stdout, secretPattern);
  assert.doesNotMatch(querySetAuthorResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(querySetAuthorEvidence, secretPattern);
  assert.doesNotMatch(querySetAuthorGeminiReview, secretPattern);
  assert.doesNotMatch(querySetAuthorEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(querySetAuthorGeminiReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(JSON.stringify(liveDiscoveryReport), secretPattern);
  assert.doesNotMatch(JSON.stringify(liveDiscoveryReport), /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(liveDiscoveryEvidence, secretPattern);
  assert.doesNotMatch(liveDiscoveryGeminiReview, secretPattern);
  assert.doesNotMatch(collectorEvidence, secretPattern);
  assert.doesNotMatch(collectorGeminiReview, secretPattern);
  assert.doesNotMatch(recallWeaveExportEvidence, secretPattern);
  assert.doesNotMatch(recallWeaveExportGeminiReview, secretPattern);
  assert.doesNotMatch(recallWeaveCollectorEvidence, secretPattern);
  assert.doesNotMatch(recallWeaveCollectorGeminiReview, secretPattern);
  assert.doesNotMatch(comparisonResult.stdout, secretPattern);
  assert.doesNotMatch(matchedCollectorComparison.stdout, secretPattern);
  assert.doesNotMatch(comparisonEvidence, secretPattern);
  assert.doesNotMatch(comparisonGeminiReview, secretPattern);
  assert.doesNotMatch(labeledQuerySetGeminiReview, secretPattern);
  assert.doesNotMatch(operatorResult.stdout, secretPattern);
  assert.doesNotMatch(operatorMarkdown.stdout, secretPattern);
  assert.doesNotMatch(operatorEvidence, secretPattern);
  assert.doesNotMatch(operatorGeminiReview, secretPattern);
  assert.doesNotMatch(nextRunResult.stdout, secretPattern);
  assert.doesNotMatch(nextRunMarkdown.stdout, secretPattern);
  assert.doesNotMatch(nextRunEvidence, secretPattern);
  assert.doesNotMatch(nextRunGeminiReview, secretPattern);
  assert.doesNotMatch(nextRunResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(nextRunMarkdown.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(baselinePacketResult.stdout, secretPattern);
  assert.doesNotMatch(baselinePacketReviewResult.stdout, secretPattern);
  assert.doesNotMatch(returnedBaselinePacketResult.stdout, secretPattern);
  assert.doesNotMatch(returnedBaselinePacketPathResult.stdout, secretPattern);
  assert.doesNotMatch(baselinePacketEvidence, secretPattern);
  assert.doesNotMatch(baselinePacketGeminiReview, secretPattern);
  assert.doesNotMatch(baselineReturnedPacketEvidence, secretPattern);
  assert.doesNotMatch(baselineReturnedPacketGeminiReview, secretPattern);
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
    report.requirements.some(
      (item) =>
        item.id === "hosted-baseline-live-discovery" &&
        item.status === "proven" &&
        item.evidence.includes("packages/bench/hosted-baseline-discovery.mjs") &&
        item.evidence.includes("reviews/overnight-20260522/hosted-baseline-live-discovery.json") &&
        item.evidence.includes("reviews/overnight-20260522/gemini-hosted-baseline-live-discovery-review.md"),
    ),
  );
  assert.ok(
    report.requirements.some(
      (item) =>
        item.id === "local-only-compaction-benchmark" &&
        item.status === "proven" &&
        item.evidence.includes("packages/bench/session-compaction-local-batch-audit.mjs") &&
        item.evidence.includes("reviews/overnight-20260522/session-compaction-local-batch-audit-evidence.md") &&
        item.evidence.includes("reviews/overnight-20260522/gemini-session-compaction-local-batch-audit-review.md"),
    ),
  );
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

function currentCanaryPacketIdentity(text) {
  const section = text.match(/## Current Returned Diagnostics Packet Result\s+([\s\S]*?)(?:\n## |\n$)/i)?.[1] ?? "";
  assert.ok(section, "current canary packet evidence must include a current returned-diagnostics section");
  const match = section.match(/Packet label:\s*`([^`]+)`[\s\S]*?Packet SHA256:\s*\n\s*`([a-f0-9]{64})`/i);
  assert.ok(match, "current canary packet evidence must include packet label and SHA256");
  return {
    label: match[1],
    sha256: match[2],
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPublicEvidencePath(file) {
  return (
    file.startsWith("reviews/") ||
    file.startsWith("docs/") ||
    file === "README.md" ||
    file === "SECURITY.md" ||
    file === "GITHUB_RULES.md"
  );
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
