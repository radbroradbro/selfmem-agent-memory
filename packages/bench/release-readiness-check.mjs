import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = fileURLToPath(new URL("../..", import.meta.url));
const reviewDir = process.env.RECALLWEAVE_REVIEW_DIR ?? (await latestReviewDir());
const originalTmpDir = tmpdir();
const staleTempCleanupReport = cleanupStaleRecallWeaveTempRoots([originalTmpDir, "/private/tmp"], {
  maxAgeMs: Number(process.env.RECALLWEAVE_RELEASE_TEMP_MAX_AGE_MS ?? 30 * 60 * 1000),
});
const releaseTempRoot = mkdtempSync(join(originalTmpDir, "recallweave-release-check-root-"));
process.env.TMPDIR = releaseTempRoot;
process.env.TMP = releaseTempRoot;
process.env.TEMP = releaseTempRoot;

process.on("exit", () => {
  try {
    rmSync(releaseTempRoot, { recursive: true, force: true });
  } catch {
    // Best effort only. The next release check removes stale RecallWeave temp roots.
  }
});

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
  "docs/PUBLIC_BENCHMARK_TARGETS.md",
  "packages/brain-ui/fixtures/model-matrix.json",
  "packages/brain-ui/static-evidence.mjs",
  "packages/bench/canary-report-from-trace.mjs",
  "packages/bench/canary-evidence-intake.mjs",
  "packages/bench/canary-remediation.mjs",
  "packages/bench/canary-drill.mjs",
  "packages/bench/canary-operator-packet.mjs",
  "packages/bench/canary-evidence-packet.mjs",
  "packages/bench/canary-evidence-packet-review.mjs",
  "packages/bench/canary-returned-packet-intake.mjs",
  "packages/bench/canary-returned-workspace.mjs",
  "packages/bench/canary-returned-inbox.mjs",
  "packages/bench/canary-returned-watch.mjs",
  "packages/bench/canary-returned-downloads.mjs",
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
  "packages/bench/hosted-baseline-local-mirror.mjs",
  "packages/bench/baseline-scoring-contract.mjs",
  "packages/bench/baseline-queryset-inspect.mjs",
  "packages/bench/baseline-source-match-preflight.mjs",
  "packages/bench/baseline-source-alignment.mjs",
  "packages/bench/baseline-source-gap-plan.mjs",
  "packages/bench/hosted-baseline-collector.mjs",
  "packages/bench/recallweave-response-export.mjs",
  "packages/bench/recallweave-baseline-collector.mjs",
  "packages/bench/baseline-comparison.mjs",
  "packages/bench/hosted-baseline-operator-packet.mjs",
  "packages/bench/hosted-baseline-next-run.mjs",
  "packages/bench/hosted-baseline-run.mjs",
  "packages/bench/baseline-evidence-packet.mjs",
  "packages/bench/baseline-evidence-packet-review.mjs",
  "packages/bench/baseline-returned-packet-intake.mjs",
  "packages/bench/baseline-openai-compatible-reviewer.mjs",
  "packages/bench/baseline-reviewer-approval-intake.mjs",
  "packages/bench/public-benchmark-source-lock-check.mjs",
  "packages/bench/public-benchmark-slice-author.mjs",
  "packages/bench/public-benchmark-target-check.mjs",
  "packages/bench/public-benchmark-target-author.mjs",
  "packages/bench/public-benchmark-materialize-run.mjs",
  "packages/bench/public-benchmark-strategy-compare.mjs",
  "packages/bench/provider-benchmark-live-preflight.mjs",
  "packages/bench/memory-score-reviewer-approval-intake.mjs",
  "packages/bench/memory-score-openai-compatible-reviewer.mjs",
  "packages/bench/end-to-end-memory-score-gate.mjs",
  "packages/bench/public-benchmark-autoresearch-loop.mjs",
  "packages/bench/public-benchmark-answer-quality-arm-export.mjs",
  "packages/bench/public-benchmark-answer-quality-preflight.mjs",
  "packages/bench/public-benchmark-answer-quality.mjs",
  "packages/bench/public-benchmark-answer-quality-combine.mjs",
  "packages/bench/local-openai-rerank-sidecar.mjs",
  "packages/bench/fixtures/baseline-reviewer-approval-a.fixture.json",
  "packages/bench/fixtures/public-benchmark-target.fixture.json",
  `${reviewDir}/public-memorybench-source-lock.json`,
  `${reviewDir}/public-memorybench-source-lock-evidence.md`,
  `${reviewDir}/public-memorybench-source-lock-checkout-evidence.json`,
  `${reviewDir}/public-longmemeval-slice-evidence.json`,
  `${reviewDir}/public-longmemeval-slice-evidence.md`,
  `${reviewDir}/codex-public-longmemeval-slice-review.md`,
  `${reviewDir}/public-longmemeval-run-target.json`,
  `${reviewDir}/public-longmemeval-run-target-check.json`,
  `${reviewDir}/public-longmemeval-run-target-evidence.md`,
  `${reviewDir}/codex-public-longmemeval-run-target-review.md`,
  `${reviewDir}/public-longmemeval-materialize-run.json`,
  `${reviewDir}/public-longmemeval-materialize-run-evidence.md`,
  `${reviewDir}/public-longmemeval-recallweave-run-result.json`,
  `${reviewDir}/codex-public-longmemeval-materialize-run-review.md`,
  `${reviewDir}/public-longmemeval-strategy-compare.json`,
  `${reviewDir}/public-longmemeval-strategy-compare-evidence.md`,
  `${reviewDir}/codex-public-longmemeval-strategy-compare-review.md`,
  `${reviewDir}/public-longmemeval-hybrid-gate.json`,
  `${reviewDir}/public-longmemeval-hybrid-gate-evidence.md`,
  `${reviewDir}/codex-public-longmemeval-hybrid-gate-review.md`,
  `${reviewDir}/public-longmemeval-provider-gate-fixture.json`,
  `${reviewDir}/public-longmemeval-provider-gate-fixture-evidence.md`,
  `${reviewDir}/public-longmemeval-provider-live-preflight.json`,
  `${reviewDir}/public-longmemeval-provider-live-preflight-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-slice-evidence.json`,
  `${reviewDir}/public-longmemeval-expanded-slice-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-run-target.json`,
  `${reviewDir}/public-longmemeval-expanded-run-target-check.json`,
  `${reviewDir}/public-longmemeval-expanded-materialize-run.json`,
  `${reviewDir}/public-longmemeval-expanded-materialize-run-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-hybrid-gate.json`,
  `${reviewDir}/public-longmemeval-expanded-hybrid-gate-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight.json`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight-voyage.json`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight-voyage-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight-nvidia.json`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight-nvidia-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider-preflight.json`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider-preflight.md`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider.json`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider.md`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-autoresearch-loop.json`,
  `${reviewDir}/public-longmemeval-expanded-autoresearch-loop-evidence.md`,
  `${reviewDir}/public-longmemeval-full-slice-evidence.json`,
  `${reviewDir}/public-longmemeval-full-slice-evidence.md`,
  `${reviewDir}/public-longmemeval-full-run-target.json`,
  `${reviewDir}/public-longmemeval-full-run-target-check.json`,
  `${reviewDir}/public-longmemeval-full-materialize-run.json`,
  `${reviewDir}/public-longmemeval-full-materialize-run-evidence.md`,
  `${reviewDir}/sota-ladder-full-target-report-20260525.json`,
  `${reviewDir}/sota-ladder-full-target-report-20260525.md`,
  `${reviewDir}/sota-ladder-full-target-operator-packet-20260525.json`,
  `${reviewDir}/sota-ladder-full-target-operator-packet-20260525.md`,
  `${reviewDir}/memory-score-reviewer-intake-20260525.json`,
  `${reviewDir}/memory-score-reviewer-intake-20260525.md`,
  `${reviewDir}/end-to-end-memory-score-gate-20260525.json`,
  `${reviewDir}/end-to-end-memory-score-gate-20260525.md`,
  `${reviewDir}/end-to-end-memory-score-live-local-20260525.json`,
  `${reviewDir}/end-to-end-memory-score-live-local-20260525.md`,
  `${reviewDir}/end-to-end-memory-score-live-provider-20260525.json`,
  `${reviewDir}/end-to-end-memory-score-live-provider-20260525.md`,
  `${reviewDir}/end-to-end-memory-score-combined-20260525.json`,
  `${reviewDir}/end-to-end-memory-score-combined-20260525.md`,
  `${reviewDir}/answer-quality-arm-export-live-local-20260525.json`,
  `${reviewDir}/answer-quality-arm-export-live-local-20260525.md`,
  `${reviewDir}/answer-quality-preflight-live-local-20260525.json`,
  `${reviewDir}/answer-quality-preflight-live-local-20260525.md`,
  `${reviewDir}/answer-quality-preflight-live-provider-20260525.json`,
  `${reviewDir}/answer-quality-preflight-live-provider-20260525.md`,
  `${reviewDir}/live-local-materialize-20260525.json`,
  `${reviewDir}/live-local-materialize-20260525.md`,
  `${reviewDir}/live-provider-materialize-20260525.json`,
  `${reviewDir}/live-provider-materialize-20260525.md`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight-voyage-nvidia-20260525.json`,
  `${reviewDir}/public-longmemeval-expanded-provider-live-preflight-voyage-nvidia-20260525.md`,
  `${reviewDir}/voyage-provider-rate-limit-20260525.json`,
  `${reviewDir}/voyage-provider-rate-limit-20260525.md`,
  `${reviewDir}/query-expansion-local-qwen36-preflight-20260525.json`,
  `${reviewDir}/query-expansion-local-qwen36-preflight-20260525.md`,
  `${reviewDir}/answer-quality-arm-export-20260525.json`,
  `${reviewDir}/answer-quality-arm-export-20260525.md`,
  `${reviewDir}/answer-quality-preflight-20260525.json`,
  `${reviewDir}/answer-quality-preflight-20260525.md`,
  `${reviewDir}/returned-downloads-current-scan.json`,
  `${reviewDir}/returned-downloads-current-scan.md`,
  `${reviewDir}/public-longmemeval-autoresearch-loop.json`,
  `${reviewDir}/public-longmemeval-autoresearch-loop-evidence.md`,
  `${reviewDir}/codex-public-longmemeval-autoresearch-loop-review.md`,
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
  `${reviewDir}/canary-drill-evidence.md`,
  `${reviewDir}/gemini-canary-drill-review.md`,
  `${reviewDir}/canary-operator-packet-evidence.md`,
  `${reviewDir}/gemini-canary-operator-packet-review.md`,
  `${reviewDir}/canary-evidence-packet-evidence.md`,
  `${reviewDir}/gemini-canary-evidence-packet-review.md`,
  `${reviewDir}/canary-evidence-packet-review-evidence.md`,
  `${reviewDir}/gemini-canary-evidence-packet-review-review.md`,
  `${reviewDir}/canary-returned-packet-intake-evidence.md`,
  `${reviewDir}/gemini-canary-returned-packet-intake-review.md`,
  `${reviewDir}/canary-returned-workspace-evidence.md`,
  `${reviewDir}/canary-returned-inbox-evidence.md`,
  `${reviewDir}/canary-returned-downloads-evidence.md`,
  `${reviewDir}/gemini-canary-returned-inbox-review.md`,
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
  `${reviewDir}/baseline-source-match-preflight-evidence.md`,
  `${reviewDir}/gemini-baseline-source-match-preflight-review.md`,
  `${reviewDir}/baseline-source-alignment-evidence.md`,
  `${reviewDir}/gemini-baseline-source-alignment-review.md`,
  `${reviewDir}/baseline-source-gap-plan-evidence.md`,
  `${reviewDir}/gemini-baseline-source-gap-plan-review.md`,
  `${reviewDir}/hosted-baseline-discovery-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-discovery-review.md`,
  `${reviewDir}/hosted-baseline-container-select-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-container-select-review.md`,
  `${reviewDir}/hosted-baseline-queryset-author-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-queryset-author-review.md`,
  `${reviewDir}/hosted-baseline-local-mirror-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-local-mirror-review.md`,
  `${reviewDir}/codex-hosted-baseline-local-mirror-review.md`,
  `${reviewDir}/hosted-baseline-live-discovery.json`,
  `${reviewDir}/hosted-baseline-live-discovery-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-live-discovery-review.md`,
  `${reviewDir}/hosted-baseline-live-queryset-author.json`,
  `${reviewDir}/hosted-baseline-live-queryset-report.json`,
  `${reviewDir}/hosted-baseline-live-prep-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-live-prep-review.md`,
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
  `${reviewDir}/hosted-baseline-run-evidence.md`,
  `${reviewDir}/gemini-hosted-baseline-run-review.md`,
  `${reviewDir}/hosted-baseline-live-budgeted-run-evidence.md`,
  `${reviewDir}/hosted-baseline-live-budgeted-run.json`,
  `${reviewDir}/hosted-baseline-live-budgeted-packet.json`,
  `${reviewDir}/baseline-evidence-packet-evidence.md`,
  `${reviewDir}/gemini-baseline-evidence-packet-review.md`,
  `${reviewDir}/baseline-returned-packet-intake-evidence.md`,
  `${reviewDir}/gemini-baseline-returned-packet-intake-review.md`,
  `${reviewDir}/baseline-openai-compatible-reviewer-evidence.md`,
  `${reviewDir}/baseline-reviewer-approval-intake-evidence.md`,
  `${reviewDir}/public-benchmark-target-evidence.md`,
  `${reviewDir}/reviewer-work/reviewer-findings.md`,
  `${reviewDir}/reviewer-work/budgeted-baseline-reviewer-intake-evidence.md`,
  `${reviewDir}/reviewer-work/budgeted-baseline-reviewer-intake-two-of-two.json`,
  `${reviewDir}/reviewer-work/reviewed-baseline-owner-review-evidence.md`,
  `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-comparison.json`,
  `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-packet-review.json`,
  `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-returned-packet-intake.json`,
  `${reviewDir}/reviewer-work/budgeted-baseline-reviewed-next-run.json`,
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
  "canary:drill",
  "canary:operator-packet",
  "canary:packet",
  "canary:packet:review",
  "canary:returned-packet",
  "canary:returned-workspace",
  "canary:returned-inbox",
  "canary:returned-watch",
  "canary:returned-downloads",
  "canary:returned-downloads:strict",
  "canary:batch-audit",
  "canary:next-agent",
  "canary:next-agent-packet",
  "baseline:queryset",
  "baseline:source-match",
  "baseline:source-align",
  "baseline:source-gap",
  "baseline:discover",
  "baseline:select-container",
  "baseline:author-queryset",
  "baseline:mirror-hosted",
  "baseline:preflight",
  "baseline:collect",
  "baseline:export:recallweave",
  "baseline:collect:recallweave",
  "baseline:compare",
  "baseline:operator-packet",
  "baseline:next-run",
  "baseline:run",
  "baseline:packet",
  "baseline:packet:review",
  "baseline:returned-packet",
  "baseline:reviewer:openai-compatible",
  "baseline:reviewer-intake",
  "benchmark:source-lock",
  "benchmark:public-slice",
  "benchmark:public-target",
  "benchmark:public-target:author",
  "benchmark:public-materialize",
  "benchmark:public-strategy",
  "benchmark:public-provider:preflight",
  "benchmark:public-provider:packet",
  "benchmark:public-provider",
  "benchmark:public-autoresearch",
  "benchmark:answer-quality:arms",
  "benchmark:answer-quality:preflight",
  "benchmark:answer-quality",
  "benchmark:query-expansion:preflight",
  "benchmark:query-expansion:result-gate",
  "benchmark:local-rerank:result-gate",
  "benchmark:provider-challenger:result-gate",
  "benchmark:memory-score:result-gate",
  "benchmark:memory-score:reviewer-intake",
  "benchmark:memory-score:reviewer:openai-compatible",
  "benchmark:sota-ladder",
  "benchmark:sota-ladder:packet",
  "goal:audit",
  "release:doctor",
  "release:handoff",
  "release:github-sync",
  "smoke",
  "release:check",
];

const secretPattern =
  /(pa-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|sm_[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|jina_[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9._-]{20,})/;
const absolutePrivatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|[A-Za-z]:\\Users\\)/i;
const privatePathPattern =
  /(\/Users\/[^/\s"]+|\/Volumes\/[^/\s"]+|\/private\/[^/\s"]+|\/var\/folders\/[^/\s"]+|[A-Za-z]:\\Users\\|\.hermes\/profiles|\.openclaw[^/\s"]*|memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)/i;
const forbiddenRuntimeFilePattern =
  /(^|\/)(memories|raw_events|lossless_context|trace)\.jsonl$|(^|\/)\.env($|\.)|(^|\/)\.npmrc$|(^|\/)(?:pnpm-debug|npm-debug|yarn-error)\.log$|(^|\/)\.DS_Store$|(^|\/)local-configs\/|(^|\/)(?:auth|credentials|cookies|browser-state)\.(?:json|yaml|yml|txt)$|\.(?:sqlite|sqlite3|db|zip|pem|p12|key)$/i;
const publicTextPathPattern = /^(README\.md|docs\/|configs\/|reviews\/overnight-20260522\/)/;
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

check("stale RecallWeave temp cleanup guard passes", () => {
  assert.equal(staleTempCleanupReport.ok, true);
  assert.equal(staleTempCleanupReport.metricsOnly, true);
  assert.equal(staleTempCleanupReport.printsPaths, false);
  assert.equal(staleTempCleanupReport.onlyRecallWeavePrefix, true);
  assert.ok(staleTempCleanupReport.maxAgeMs >= 0);
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
  assert.match(help, /--expected-commit/);
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
  assert.match(releaseState.latestVerifiedRepositoryHead?.headSha ?? "", /^[a-f0-9]{40}$/);
  assert.equal(releaseState.latestVerifiedRepositoryHead?.ciConclusion, "success");
  assert.equal(releaseState.latestVerifiedRepositoryHead?.localReleaseCheck, "passed");
  assert.equal(releaseState.latestVerifiedRepositoryHead?.secretScan, "zero_hits");
  assert.match(releaseState.approvedRuntimeCanaryBaseline?.headSha ?? "", /^[a-f0-9]{40}$/);
  assert.equal(releaseState.approvedRuntimeCanaryBaseline?.role, "approved-runtime-canary-adapter");
  assert.equal(releaseState.approvedRuntimeCanaryBaseline?.expectedReportCommit, releaseState.approvedRuntimeCanaryBaseline?.headSha);
  assert.notEqual(releaseState.latestVerifiedRepositoryHead?.headSha, releaseState.approvedRuntimeCanaryBaseline?.headSha);
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
    "canary-returned-workspace",
    "canary-returned-downloads",
    "canary-diagnostic-batch-audit",
    "canary-next-agent-plan",
    "hosted-baseline-preflight",
    "baseline-queryset-inspect",
    "baseline-queryset-unique-gate",
    "baseline-source-match-preflight",
    "baseline-source-alignment-gate",
    "baseline-source-gap-plan",
    "hosted-baseline-discovery",
    "hosted-baseline-live-discovery",
    "hosted-baseline-container-select",
    "hosted-baseline-queryset-author",
    "hosted-baseline-live-prep",
    "hosted-baseline-collector",
    "recallweave-response-export",
    "recallweave-baseline-collector",
    "baseline-comparison-gate",
    "hosted-baseline-operator-packet",
    "hosted-baseline-next-run",
    "hosted-baseline-run-orchestrator",
    "baseline-evidence-packet",
    "baseline-returned-packet-intake",
    "claude-opus-pr5-review",
    "github-handoff-packet",
    "github-live-sync-check",
    "github-pr-body-live",
    "github-blocker-issue-live",
    "goal-completion-audit",
    "selfmem-update",
    "public-benchmark-source-lock",
    "public-benchmark-slice",
    "public-longmemeval-run-target",
    "public-benchmark-target-author",
    "public-benchmark-target-check",
    "public-longmemeval-materialize-run",
    "public-longmemeval-recallweave-run-result",
    "public-longmemeval-strategy-compare",
    "public-longmemeval-hybrid-gate",
    "public-longmemeval-provider-gate",
    "public-longmemeval-provider-live-preflight",
    "public-longmemeval-expanded-hybrid-gate",
    "public-longmemeval-expanded-provider-live-preflight",
    "public-longmemeval-expanded-autoresearch-loop",
    "public-longmemeval-autoresearch-loop",
  ]) {
    assert.ok(releaseState.provenPreviewSurfaces?.includes(surface), `missing release surface ${surface}`);
  }
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.status, "completed_with_concerns");
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.verdict, "CONCERNS");
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.countsAsPublicLaunchApproval, false);
  for (const blocker of [
    "human-public-launch-approval-required",
    "fresh-real-container-canary-not-current",
  ]) {
    assert.ok(releaseState.remainingBlockers?.includes(blocker), `missing release blocker ${blocker}`);
  }
  assert.equal(releaseState.remainingBlockers?.includes("hosted-supermemory-baseline-not-current"), false);
});

check("post-baseline public evidence guard is honored", () => {
  const releaseState = JSON.parse(readFileSync(join(root, reviewDir, "release-state.json"), "utf8"));
  assert.equal(releaseState.releaseStateGuard?.allowsDocsOnlyCommitsAfterCodeBaseline, true);
  if (releaseState.releaseStateGuard?.enforcePostBaselinePublicEvidenceOnly !== true) return;

  const baselineSha = releaseState.latestVerifiedCodeBaseline?.headSha ?? "";
  assert.match(baselineSha, /^[a-f0-9]{40}$/);
  run("git", ["merge-base", "--is-ancestor", baselineSha, "HEAD"]);
  const allowedCodePaths = new Set(releaseState.releaseStateGuard?.allowedPostBaselineCodePaths ?? []);
  if (allowedCodePaths.size > 0) {
    assert.match(releaseState.releaseStateGuard?.allowedPostBaselineCodeReason ?? "", /hosted baseline|returned canary inbox/i);
    const hasCleanAllowedReviewer = [
      releaseState.reviewerEvidence?.hostedBaselineLivePrep?.verdict,
      releaseState.reviewerEvidence?.baselineSourceMatchPreflight?.verdict,
      releaseState.reviewerEvidence?.baselineSourceGapPlan?.verdict,
      releaseState.reviewerEvidence?.canaryStrictRealDrill?.verdict,
      releaseState.reviewerEvidence?.canaryReturnedInbox?.verdict,
    ].includes("CLEAN");
    assert.equal(hasCleanAllowedReviewer, true);
  }
  const changedFiles = run("git", ["diff", "--name-only", `${baselineSha}..HEAD`])
    .stdout.split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  const disallowed = changedFiles.filter((file) => !isPublicEvidencePath(file) && !isAllowedPostBaselineCodePath(file, allowedCodePaths));
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
  const publicTargets = readFileSync(join(root, "docs/PUBLIC_BENCHMARK_TARGETS.md"), "utf8");
  const providerMatrix = readFileSync(join(root, "configs/provider-matrix.yaml"), "utf8");
  const budget = readFileSync(join(root, "configs/bench-budget.yaml"), "utf8");

  assert.match(modelMatrix, /Qwen3-Embedding-0\.6B-GGUF/);
  assert.match(modelMatrix, /consumer-hardware floor/i);
  assert.match(modelMatrix, /Qwen3 Embedding 4B or 8B/i);
  assert.match(modelMatrix, /EmbeddingGemma-class small embeddings/i);
  assert.match(modelMatrix, /llama\.cpp/);
  assert.match(modelMatrix, /Apple Silicon/i);
  assert.match(modelMatrix, /NVIDIA NIM/i);
  assert.match(modelMatrix, /Query expansion is off by default/i);
  assert.match(modelMatrix, /Opus 4\.7/i);
  assert.match(modelMatrix, /Codex GPT-5\.5/i);
  assert.match(autoresearchPlan, /matched source-locked canary/i);
  assert.match(autoresearchPlan, /Do not publish/i);
  assert.match(autoresearchPlan, /same dataset slice/i);
  assert.match(autoresearchPlan, /same public data, repository or dataset revision/i);
  assert.match(autoresearchPlan, /must not optimize a solo RecallWeave run in isolation/i);
  assert.match(autoresearchPlan, /Full Benchmark Rule/i);
  assert.match(autoresearchPlan, /full 500-row public set/i);
  assert.match(autoresearchPlan, /public-longmemeval-full-run-target\.json/i);
  assert.match(autoresearchPlan, /500 queries, 19,195 haystack sessions/i);
  assert.match(autoresearchPlan, /BM25-lite as the lexical floor/i);
  assert.match(publicTargets, /Component Benchmarks/i);
  assert.match(publicTargets, /Full Benchmark Gate/i);
  assert.match(publicTargets, /public-longmemeval-full-run-target\.json/i);
  assert.match(publicTargets, /19,195 haystack sessions/i);
  assert.match(publicTargets, /85\.2%/);
  assert.match(publicTargets, /Qwen3 Embedding 4B or 8B/i);
  assert.match(publicTargets, /EmbeddingGemma-class small\s+local embeddings/i);
  assert.match(publicTargets, /MTEB, MMTEB, BEIR, MIRACL, MS MARCO/i);
  assert.match(publicTargets, /Do not test RecallWeave alone for quality/i);
  assert.match(publicTargets, /Minimum same-data matrix/i);
  assert.match(publicTargets, /provider-backed hybrid arm/i);
  assert.match(publicTargets, /118209a746d97d0d85e5a7234267f0b6962857e9/);
  assert.match(autoresearchPlan, /benchmark:source-lock -- --strict/);
  assert.match(publicTargets, /same public benchmark source, repository or dataset revision/i);
  assert.match(publicTargets, /LongMemEval-V2/i);
  assert.match(providerMatrix, /defaultLocalArm: local-apple-qwen3-0_6b/);
  assert.match(providerMatrix, /cloud-nvidia-nemotron-1b/);
  assert.match(providerMatrix, /cloud-gemini2-cohere4pro/);
  assert.match(providerMatrix, /defaultProvider: none/);
  assert.match(budget, /requireCleanLocalModelRuntimeForLatency: true/);
  assert.match(budget, /stopOnlyRecallWeaveOwnedProcesses: true/);
  for (const text of [modelMatrix, autoresearchPlan, publicTargets, providerMatrix, budget]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
});

check("fresh public MemoryBench source lock passes", () => {
  const result = run("node", ["packages/bench/public-benchmark-source-lock-check.mjs", "--strict"]);
  const markdown = run("node", ["packages/bench/public-benchmark-source-lock-check.mjs", "--format", "markdown"]).stdout;
  const evidence = readFileSync(join(root, reviewDir, "public-memorybench-source-lock-evidence.md"), "utf8");
  const sourceLock = JSON.parse(readFileSync(join(root, reviewDir, "public-memorybench-source-lock.json"), "utf8"));
  const checkoutEvidence = JSON.parse(readFileSync(join(root, reviewDir, "public-memorybench-source-lock-checkout-evidence.json"), "utf8"));
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "public-benchmark-source-lock-check");
  assert.equal(report.metricsOnly, true);
  assert.equal(report.publicSafe, true);
  assert.equal(report.publicBenchmarkClaimsAllowed, false);
  assert.equal(report.sourceLockReadyForTargetAuthoring, true);
  assert.equal(report.checkoutVerification?.requested, false);
  assert.equal(report.checkoutVerification?.requiredFileCount, 15);
  assert.equal(checkoutEvidence.ok, true);
  assert.equal(checkoutEvidence.mode, "public-benchmark-source-lock-check");
  assert.equal(checkoutEvidence.checkoutVerification?.requested, true);
  assert.equal(checkoutEvidence.checkoutVerification?.ok, true);
  assert.equal(checkoutEvidence.checkoutVerification?.commitMatches, true);
  assert.equal(checkoutEvidence.checkoutVerification?.requiredFileCount, 15);
  assert.equal(checkoutEvidence.checkoutVerification?.checkedFileCount, 15);
  assert.equal(checkoutEvidence.checkoutVerification?.failedFileCount, 0);
  assert.equal(report.sourceSummary.commit, "118209a746d97d0d85e5a7234267f0b6962857e9");
  assert.deepEqual(report.failedChecks, []);
  assert.deepEqual(checkoutEvidence.failedChecks, []);
  assert.equal(sourceLock.source?.commit, "118209a746d97d0d85e5a7234267f0b6962857e9");
  assert.equal(sourceLock.datasetSources?.longmemeval?.datasetUrl, "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json");
  assert.ok(sourceLock.availableBenchmarks?.includes("locomo"));
  assert.ok(sourceLock.availableBenchmarks?.includes("longmemeval"));
  assert.ok(sourceLock.availableBenchmarks?.includes("convomem"));
  assert.match(markdown, /Public Benchmark Source Lock Check/);
  assert.match(markdown, /Checkout verified: not requested/);
  assert.match(evidence, /public-benchmark-source-lock-check/);
  assert.match(evidence, /Checkout verification requested by default: `false`/);
  assert.match(evidence, /Independent checkout verification command/);
  assert.match(evidence, /Checkout verification requested: `true`/);
  assert.match(evidence, /Commit matched: `true`/);
  assert.match(evidence, /Failed file count: 0/);
  assert.match(evidence, /Raw question ids included: `false`/);
  assert.doesNotMatch(result.stdout, secretPattern);
  assert.doesNotMatch(markdown, secretPattern);
  assert.doesNotMatch(evidence, secretPattern);
  assert.doesNotMatch(JSON.stringify(checkoutEvidence), secretPattern);
  assert.doesNotMatch(JSON.stringify(sourceLock), secretPattern);
  assert.doesNotMatch(result.stdout, privatePathPattern);
  assert.doesNotMatch(markdown, privatePathPattern);
  assert.doesNotMatch(evidence, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(checkoutEvidence), privatePathPattern);
  assert.doesNotMatch(JSON.stringify(sourceLock), privatePathPattern);
});

check("fresh public LongMemEval slice manifest passes", () => {
  const fixture = JSON.parse(run("node", ["packages/bench/public-benchmark-slice-author.mjs"]).stdout);
  const markdown = run("node", ["packages/bench/public-benchmark-slice-author.mjs", "--format", "markdown"]).stdout;
  const evidence = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-slice-evidence.json"), "utf8"));
  const evidenceMarkdown = readFileSync(join(root, reviewDir, "public-longmemeval-slice-evidence.md"), "utf8");
  const review = readFileSync(join(root, reviewDir, "codex-public-longmemeval-slice-review.md"), "utf8");
  assert.equal(fixture.mode, "public-benchmark-slice-manifest");
  assert.equal(fixture.fixtureOnly, true);
  assert.equal(fixture.publicSafety?.rawQuestionsIncluded, false);
  assert.equal(fixture.publicSafety?.rawAnswersIncluded, false);
  assert.equal(evidence.mode, "public-benchmark-slice-manifest");
  assert.equal(evidence.fixtureOnly, false);
  assert.equal(evidence.benchmark, "longmemeval");
  assert.equal(evidence.sourceCommit, "118209a746d97d0d85e5a7234267f0b6962857e9");
  assert.equal(evidence.dataset?.hash, "sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442");
  assert.equal(evidence.dataset?.itemCount, 500);
  assert.equal(evidence.dataset?.selectedCount, 6);
  assert.equal(evidence.dataset?.questionTypeCount, 6);
  assert.equal(evidence.dataset?.selectedQuestionIdsHash, "sha256:686da163b61d343549768cdccd890a46ce775b653414932bdd07aec2ccdd3a23");
  assert.equal(evidence.labels?.answerLabelsHash, "sha256:423098446f2953b45fe049fbd9da0b8d806050d4aed6cdec2a349f167ce1fa3e");
  assert.equal(evidence.scoring?.scoringCodeHash, "sha256:f9d889e173f83b68e64d7221121f51bb3cf289bb921aacf36d95080d4b0a9518");
  assert.equal(evidence.publicSafety?.metricsOnly, true);
  assert.equal(evidence.publicSafety?.rawQuestionIdsIncluded, false);
  assert.equal(evidence.publicSafety?.rawQuestionsIncluded, false);
  assert.equal(evidence.publicSafety?.rawAnswersIncluded, false);
  assert.match(evidence.dataset?.questionIdPolicy ?? "", /selection=first-per-type-round-robin/);
  assert.match(markdown, /Public Benchmark Slice Manifest/);
  assert.match(evidenceMarkdown, /Public Benchmark Slice Manifest/);
  assert.match(evidenceMarkdown, /Selected count: 6/);
  assert.match(review, /Verdict: PASS WITH CONCERNS/);
  assert.match(review, /does not prove a RecallWeave quality score/i);
  for (const text of [JSON.stringify(fixture), markdown, JSON.stringify(evidence), evidenceMarkdown, review]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, privatePathPattern);
    assert.doesNotMatch(text, /What degree did I|Business Administration/);
  }
});

check("fresh public benchmark target check passes", () => {
  const authored = run("node", ["packages/bench/public-benchmark-target-author.mjs"]);
  const authoredMarkdown = run("node", ["packages/bench/public-benchmark-target-author.mjs", "--format", "markdown"]).stdout;
  const result = run("node", ["packages/bench/public-benchmark-target-check.mjs"]);
  const markdown = run("node", ["packages/bench/public-benchmark-target-check.mjs", "--format", "markdown"]).stdout;
  const evidence = readFileSync(join(root, reviewDir, "public-benchmark-target-evidence.md"), "utf8");
  const liveRunTargetPath = join(root, reviewDir, "public-longmemeval-run-target.json");
  const liveRunTargetEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-run-target-evidence.md"), "utf8");
  const liveRunTargetReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-run-target-check.json"), "utf8"));
  const liveRunTargetReview = readFileSync(join(root, reviewDir, "codex-public-longmemeval-run-target-review.md"), "utf8");
  const materializeFixture = JSON.parse(run("node", ["packages/bench/public-benchmark-materialize-run.mjs"]).stdout);
  const materializeMarkdown = run("node", ["packages/bench/public-benchmark-materialize-run.mjs", "--format", "markdown"]).stdout;
  const strategyFixture = JSON.parse(run("node", ["packages/bench/public-benchmark-strategy-compare.mjs"]).stdout);
  const strategyMarkdown = run("node", ["packages/bench/public-benchmark-strategy-compare.mjs", "--format", "markdown"]).stdout;
  const hybridFixture = JSON.parse(
    run("node", ["packages/bench/public-benchmark-strategy-compare.mjs", "--gate", "hybrid", "--context-token-budget", "800", "--limit", "5"]).stdout,
  );
  const hybridMarkdown = run("node", [
    "packages/bench/public-benchmark-strategy-compare.mjs",
    "--gate",
    "hybrid",
    "--context-token-budget",
    "800",
    "--limit",
    "5",
    "--format",
    "markdown",
  ]).stdout;
  const providerFixture = JSON.parse(
    run("node", ["packages/bench/public-benchmark-strategy-compare.mjs", "--gate", "provider", "--context-token-budget", "800", "--limit", "5"]).stdout,
  );
  const providerMarkdown = run("node", [
    "packages/bench/public-benchmark-strategy-compare.mjs",
    "--gate",
    "provider",
    "--context-token-budget",
    "800",
    "--limit",
    "5",
    "--format",
    "markdown",
  ]).stdout;
  const autoresearchFixture = JSON.parse(
    run("node", ["packages/bench/public-benchmark-autoresearch-loop.mjs", "--context-token-budgets", "800,1600", "--limits", "5,10"]).stdout,
  );
  const autoresearchMarkdown = run("node", [
    "packages/bench/public-benchmark-autoresearch-loop.mjs",
    "--context-token-budgets",
    "800,1600",
    "--limits",
    "5,10",
    "--format",
    "markdown",
  ]).stdout;
  const answerQualityArmExportFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-answer-quality-arm-export.mjs"]).stdout);
  const answerQualityArmExportMarkdownFresh = run("node", [
    "packages/bench/public-benchmark-answer-quality-arm-export.mjs",
    "--format",
    "markdown",
  ]).stdout;
  const answerQualityArmExportFixture = JSON.parse(
    run("node", ["packages/bench/public-benchmark-answer-quality-arm-export.mjs", "--fixture", "--execute"]).stdout,
  );
  const answerQualityPreflightFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-answer-quality-preflight.mjs"]).stdout);
  const answerQualityPreflightMarkdownFresh = run("node", [
    "packages/bench/public-benchmark-answer-quality-preflight.mjs",
    "--format",
    "markdown",
  ]).stdout;
  const answerQualityFixture = JSON.parse(run("node", ["packages/bench/public-benchmark-answer-quality.mjs", "--fixture"]).stdout);
  const answerQualityMarkdown = run("node", ["packages/bench/public-benchmark-answer-quality.mjs", "--fixture", "--format", "markdown"]).stdout;
  const memoryScoreReviewerIntakeFresh = JSON.parse(
    run("node", [
      "packages/bench/memory-score-reviewer-approval-intake.mjs",
      "--result",
      "reviews/overnight-20260522/answer-quality-harness-smoke-20260525.json",
    ]).stdout,
  );
  const memoryScoreReviewerIntakeMarkdownFresh = run("node", [
    "packages/bench/memory-score-reviewer-approval-intake.mjs",
    "--result",
    "reviews/overnight-20260522/answer-quality-harness-smoke-20260525.json",
    "--format",
    "markdown",
  ]).stdout;
  const sotaLadderFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-sota-ladder.mjs"]).stdout);
  const sotaLadderMarkdownFresh = run("node", ["packages/bench/public-benchmark-sota-ladder.mjs", "--format", "markdown"]).stdout;
  const sotaOperatorPacketFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-sota-operator-packet.mjs"]).stdout);
  const answerQualityArmExportEvidence = JSON.parse(readFileSync(join(root, reviewDir, "answer-quality-arm-export-20260525.json"), "utf8"));
  const answerQualityArmExportMarkdownEvidence = readFileSync(join(root, reviewDir, "answer-quality-arm-export-20260525.md"), "utf8");
  const answerQualityArmExportLiveLocalEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-arm-export-live-local-20260525.json"), "utf8"),
  );
  const answerQualityPreflightLiveLocalEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-preflight-live-local-20260525.json"), "utf8"),
  );
  const answerQualityLiveLocalEvidence = JSON.parse(readFileSync(join(root, reviewDir, "end-to-end-memory-score-live-local-20260525.json"), "utf8"));
  const answerQualityPreflightLiveProviderEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-preflight-live-provider-20260525.json"), "utf8"),
  );
  const answerQualityLiveProviderEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "end-to-end-memory-score-live-provider-20260525.json"), "utf8"),
  );
  const answerQualityCombinedEvidence = JSON.parse(readFileSync(join(root, reviewDir, "end-to-end-memory-score-combined-20260525.json"), "utf8"));
  const voyageProviderRateLimitEvidence = JSON.parse(readFileSync(join(root, reviewDir, "voyage-provider-rate-limit-20260525.json"), "utf8"));
  const endToEndMemoryScoreGateEvidence = JSON.parse(readFileSync(join(root, reviewDir, "end-to-end-memory-score-gate-20260525.json"), "utf8"));
  const memoryScoreReviewerIntakeEvidence = JSON.parse(readFileSync(join(root, reviewDir, "memory-score-reviewer-intake-20260525.json"), "utf8"));
  const memoryScoreReviewerIntakeMarkdownEvidence = readFileSync(join(root, reviewDir, "memory-score-reviewer-intake-20260525.md"), "utf8");
  const answerQualityPreflightEvidence = JSON.parse(readFileSync(join(root, reviewDir, "answer-quality-preflight-20260525.json"), "utf8"));
  const answerQualityPreflightMarkdownEvidence = readFileSync(join(root, reviewDir, "answer-quality-preflight-20260525.md"), "utf8");
  const liveMaterializeReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-materialize-run.json"), "utf8"));
  const liveMaterializeEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-materialize-run-evidence.md"), "utf8");
  const liveRecallWeaveRun = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-recallweave-run-result.json"), "utf8"));
  const liveMaterializeReview = readFileSync(join(root, reviewDir, "codex-public-longmemeval-materialize-run-review.md"), "utf8");
  const liveStrategyReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-strategy-compare.json"), "utf8"));
  const liveStrategyEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-strategy-compare-evidence.md"), "utf8");
  const liveStrategyReview = readFileSync(join(root, reviewDir, "codex-public-longmemeval-strategy-compare-review.md"), "utf8");
  const liveHybridReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-hybrid-gate.json"), "utf8"));
  const liveHybridEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-hybrid-gate-evidence.md"), "utf8");
  const liveHybridReview = readFileSync(join(root, reviewDir, "codex-public-longmemeval-hybrid-gate-review.md"), "utf8");
  const providerGateFixtureReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-provider-gate-fixture.json"), "utf8"));
  const providerGateFixtureEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-provider-gate-fixture-evidence.md"), "utf8");
  const providerLivePreflightReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-provider-live-preflight.json"), "utf8"));
  const providerLivePreflightEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-provider-live-preflight-evidence.md"), "utf8");
  const providerLivePreflightFresh = JSON.parse(run("node", ["packages/bench/provider-benchmark-live-preflight.mjs"]).stdout);
  const expandedSliceReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-expanded-slice-evidence.json"), "utf8"));
  const expandedSliceEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-expanded-slice-evidence.md"), "utf8");
  const expandedRunTarget = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-expanded-run-target.json"), "utf8"));
  const expandedRunTargetReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-expanded-run-target-check.json"), "utf8"));
  const expandedMaterializeReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-expanded-materialize-run.json"), "utf8"));
  const expandedMaterializeEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-expanded-materialize-run-evidence.md"), "utf8");
  const expandedHybridReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-expanded-hybrid-gate.json"), "utf8"));
  const expandedHybridEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-expanded-hybrid-gate-evidence.md"), "utf8");
  const expandedAutoresearchReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-expanded-autoresearch-loop.json"), "utf8"));
  const expandedAutoresearchEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-expanded-autoresearch-loop-evidence.md"), "utf8");
  const expandedProviderLivePreflightReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-expanded-provider-live-preflight.json"), "utf8"));
  const expandedProviderLivePreflightEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-expanded-provider-live-preflight-evidence.md"), "utf8");
  const expandedProviderLivePreflightVoyageReport = JSON.parse(
    readFileSync(join(root, reviewDir, "public-longmemeval-expanded-provider-live-preflight-voyage.json"), "utf8"),
  );
  const expandedProviderLivePreflightVoyageEvidence = readFileSync(
    join(root, reviewDir, "public-longmemeval-expanded-provider-live-preflight-voyage-evidence.md"),
    "utf8",
  );
  const expandedProviderLivePreflightNvidiaReport = JSON.parse(
    readFileSync(join(root, reviewDir, "public-longmemeval-expanded-provider-live-preflight-nvidia.json"), "utf8"),
  );
  const expandedProviderLivePreflightNvidiaEvidence = readFileSync(
    join(root, reviewDir, "public-longmemeval-expanded-provider-live-preflight-nvidia-evidence.md"),
    "utf8",
  );
  const expandedVoyageLatencyPreflightReport = JSON.parse(
    readFileSync(join(root, reviewDir, "public-longmemeval-expanded-voyage-latency-live-provider-preflight.json"), "utf8"),
  );
  const expandedVoyageLatencyReport = JSON.parse(
    readFileSync(join(root, reviewDir, "public-longmemeval-expanded-voyage-latency-live-provider.json"), "utf8"),
  );
  const expandedVoyageLatencyEvidence = readFileSync(
    join(root, reviewDir, "public-longmemeval-expanded-voyage-latency-live-provider-evidence.md"),
    "utf8",
  );
  const fullSliceReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-full-slice-evidence.json"), "utf8"));
  const fullSliceEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-full-slice-evidence.md"), "utf8");
  const fullRunTarget = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-full-run-target.json"), "utf8"));
  const fullRunTargetReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-full-run-target-check.json"), "utf8"));
  const fullMaterializeReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-full-materialize-run.json"), "utf8"));
  const fullMaterializeEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-full-materialize-run-evidence.md"), "utf8");
  const fullTargetSotaReport = JSON.parse(readFileSync(join(root, reviewDir, "sota-ladder-full-target-report-20260525.json"), "utf8"));
  const fullTargetOperatorPacket = JSON.parse(
    readFileSync(join(root, reviewDir, "sota-ladder-full-target-operator-packet-20260525.json"), "utf8"),
  );
  const providerOperatorPacket = JSON.parse(run("node", ["packages/bench/provider-benchmark-operator-packet.mjs", "--provider", "voyage"]).stdout);
  const providerOperatorPacketMarkdown = run("node", [
    "packages/bench/provider-benchmark-operator-packet.mjs",
    "--provider",
    "voyage",
    "--format",
    "markdown",
  ]).stdout;
  const providerOperatorPacketEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-expanded-provider-operator-packet.md"), "utf8");
  const expandedProviderLivePreflightFresh = JSON.parse(
    run("node", [
      "packages/bench/provider-benchmark-live-preflight.mjs",
      "--target",
      "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json",
    ]).stdout,
  );
  const liveAutoresearchReport = JSON.parse(readFileSync(join(root, reviewDir, "public-longmemeval-autoresearch-loop.json"), "utf8"));
  const liveAutoresearchEvidence = readFileSync(join(root, reviewDir, "public-longmemeval-autoresearch-loop-evidence.md"), "utf8");
  const liveAutoresearchReview = readFileSync(join(root, reviewDir, "codex-public-longmemeval-autoresearch-loop-review.md"), "utf8");
  const authoredTarget = JSON.parse(authored.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(authoredTarget.fixtureOnly, true);
  assert.equal(authoredTarget.benchmark?.family, "longmemeval");
  assert.match(authoredMarkdown, /Public Benchmark Target/);
  assert.match(authoredMarkdown, /benchmark:public-target/);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "public-benchmark-target-check");
  assert.equal(report.fixtureOnly, true);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.publicSafe, true);
  assert.equal(report.rawQuestionIdsIncluded, false);
  assert.equal(report.rawLabelsIncluded, false);
  assert.equal(report.publicBenchmarkClaimsAllowed, false);
  assert.equal(report.targetReadyForCanary, false);
  assert.equal(report.contract?.benchmarkType, "memory");
  assert.equal(report.contract?.benchmarkFamily, "longmemeval");
  assert.equal(report.contract?.sameDataReady, true);
  assert.equal(report.contract?.componentEvidenceOnly, true);
  assert.equal(report.contract?.metricDefinitionsMatch, true);
  assert.equal(report.contract?.sameJudgeModel, true);
  assert.equal(report.contract?.sameAnswerModel, true);
  assert.deepEqual(report.failedChecks, []);
  assert.match(markdown, /Public Benchmark Target Check/);
  assert.match(markdown, /Target ready for canary: false/);
  assert.match(evidence, /benchmark:public-target/);
  assert.match(evidence, /Component evidence is model-selection only/);
  assert.match(evidence, /same data, revision, split, labels, judge model, answer model, judge rule, and scoring setup/i);
  assert.equal(liveRunTargetReport.ok, true);
  assert.equal(liveRunTargetReport.fixtureOnly, false);
  assert.equal(liveRunTargetReport.publicSliceRunReady, true);
  assert.equal(liveRunTargetReport.targetReadyForCanary, false);
  assert.equal(liveRunTargetReport.contract?.claimTier, "run-only");
  assert.equal(liveRunTargetReport.contract?.benchmarkFamily, "longmemeval");
  assert.equal(liveRunTargetReport.contract?.sameDataReady, true);
  assert.equal(liveRunTargetReport.contract?.usesQuestionIdPolicy, true);
  assert.equal(liveRunTargetReport.contract?.reportedTargetRequired, false);
  assert.equal(liveRunTargetReport.contract?.reportedTargetReady, false);
  assert.match(liveRunTargetEvidence, /Public slice run ready: true/);
  assert.match(liveRunTargetEvidence, /Public benchmark claims allowed: false/);
  assert.match(liveRunTargetEvidence, /same-data/i);
  assert.match(liveRunTargetReview, /PASS WITH CONCERNS/);
  assert.match(liveRunTargetReview, /fails `--strict`/);
  assert.match(liveRunTargetReview, /Do not claim release readiness/i);
  assert.equal(materializeFixture.ok, true);
  assert.equal(materializeFixture.mode, "public-benchmark-materialize-run");
  assert.equal(materializeFixture.fixtureOnly, true);
  assert.equal(materializeFixture.metricsOnly, true);
  assert.equal(materializeFixture.publicSafe, true);
  assert.equal(materializeFixture.rawQuestionIdsIncluded, false);
  assert.equal(materializeFixture.rawQuestionsIncluded, false);
  assert.equal(materializeFixture.rawAnswersIncluded, false);
  assert.equal(materializeFixture.rawMemoryIncluded, false);
  assert.equal(materializeFixture.privateOutputs?.directoryInsideRepository, false);
  assert.match(materializeMarkdown, /Public Benchmark Materialize Run/);
  assert.equal(strategyFixture.ok, true);
  assert.equal(strategyFixture.mode, "public-benchmark-strategy-compare");
  assert.equal(strategyFixture.fixtureOnly, true);
  assert.equal(strategyFixture.metricsOnly, true);
  assert.equal(strategyFixture.retrievalProxyOnly, true);
  assert.equal(strategyFixture.memoryBenchAnswerQuality, false);
  assert.equal(strategyFixture.publicBenchmarkClaimsAllowed, false);
  assert.equal(strategyFixture.publicSafe, true);
  assert.equal(strategyFixture.rawQuestionsIncluded, false);
  assert.equal(strategyFixture.rawAnswersIncluded, false);
  assert.equal(strategyFixture.rawMemoryIncluded, false);
  assert.equal(strategyFixture.strategies?.length, 3);
  assert.equal(strategyFixture.comparisonContract?.soloRunsAreSmokeOnly, true);
  assert.equal(strategyFixture.comparisonContract?.sameDataControlsRequired, true);
  assert.equal(strategyFixture.comparisonContract?.bm25ControlPresent, true);
  assert.ok(strategyFixture.winner?.strategy);
  assert.match(strategyMarkdown, /Public Benchmark Strategy Compare/);
  assert.equal(hybridFixture.ok, true);
  assert.equal(hybridFixture.mode, "public-benchmark-hybrid-gate");
  assert.equal(hybridFixture.gate, "hybrid");
  assert.equal(hybridFixture.fixtureOnly, true);
  assert.equal(hybridFixture.metricsOnly, true);
  assert.equal(hybridFixture.retrievalProxyOnly, true);
  assert.equal(hybridFixture.memoryBenchAnswerQuality, false);
  assert.equal(hybridFixture.publicBenchmarkClaimsAllowed, false);
  assert.equal(hybridFixture.publicSafe, true);
  assert.equal(hybridFixture.rawQuestionsIncluded, false);
  assert.equal(hybridFixture.rawAnswersIncluded, false);
  assert.equal(hybridFixture.rawMemoryIncluded, false);
  assert.equal(hybridFixture.strategies?.length, 7);
  assert.equal(hybridFixture.control?.strategy, "bm25-lite");
  assert.equal(hybridFixture.comparisonContract?.bm25ControlPresent, true);
  assert.equal(hybridFixture.comparisonContract?.hybridFamilyPresent, true);
  assert.equal(hybridFixture.hybridPromotion?.promoteHybrid, false);
  assert.match(hybridMarkdown, /Gate: hybrid/);
  assert.equal(providerFixture.ok, true);
  assert.equal(providerFixture.mode, "public-benchmark-provider-gate");
  assert.equal(providerFixture.gate, "provider");
  assert.equal(providerFixture.fixtureOnly, true);
  assert.equal(providerFixture.metricsOnly, true);
  assert.equal(providerFixture.retrievalProxyOnly, true);
  assert.equal(providerFixture.memoryBenchAnswerQuality, false);
  assert.equal(providerFixture.publicBenchmarkClaimsAllowed, false);
  assert.equal(providerFixture.publicSafe, true);
  assert.equal(providerFixture.rawQuestionsIncluded, false);
  assert.equal(providerFixture.rawAnswersIncluded, false);
  assert.equal(providerFixture.rawMemoryIncluded, false);
  assert.equal(providerFixture.comparisonContract?.bm25ControlPresent, true);
  assert.equal(providerFixture.comparisonContract?.fullHybridControlPresent, true);
  assert.equal(providerFixture.comparisonContract?.providerArmPresent, true);
  assert.equal(providerFixture.promotion?.kind, "provider");
  assert.ok(providerFixture.promotion?.bestProviderStrategy, "provider gate must report a provider-backed best arm");
  assert.ok(String(providerFixture.promotion?.bestProviderStrategy).startsWith("cloud-") || String(providerFixture.promotion?.bestProviderStrategy).startsWith("local-apple-"));
  assert.notEqual(providerFixture.promotion?.bestProviderStrategy, "full-hybrid-rerank");
  assert.match(providerFixture.promotion?.reason ?? "", /provider-backed arm/i);
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-voyage4-voyage" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-voyage-rerank-only" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-gemini-embed-rerank-proxy" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-gemini-voyage-rerank" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-nvidia-nemotron-1b" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "local-apple-qwen3-0_6b" && item.provider?.fixtureProviderMock === true));
  assert.match(providerMarkdown, /Gate: provider/);
  assert.match(providerMarkdown, /cloud-voyage4-voyage/);
  assert.match(providerMarkdown, /cloud-gemini-voyage-rerank/);
  assert.match(providerMarkdown, /cloud-nvidia-nemotron-1b/);
  assert.match(providerMarkdown, /local-apple-qwen3-0_6b/);
  assert.equal(autoresearchFixture.ok, true);
  assert.equal(autoresearchFixture.mode, "public-benchmark-autoresearch-loop");
  assert.equal(autoresearchFixture.fixtureOnly, true);
  assert.equal(autoresearchFixture.metricsOnly, true);
  assert.equal(autoresearchFixture.retrievalProxyOnly, true);
  assert.equal(autoresearchFixture.memoryBenchAnswerQuality, false);
  assert.equal(autoresearchFixture.publicBenchmarkClaimsAllowed, false);
  assert.equal(autoresearchFixture.publicSafe, true);
  assert.equal(autoresearchFixture.rawQuestionsIncluded, false);
  assert.equal(autoresearchFixture.rawAnswersIncluded, false);
  assert.equal(autoresearchFixture.rawMemoryIncluded, false);
  assert.equal(autoresearchFixture.comparisonContract?.soloRunsAreSmokeOnly, true);
  assert.equal(autoresearchFixture.comparisonContract?.sameDataControlsRequired, true);
  assert.equal(autoresearchFixture.comparisonContract?.bm25ControlPresent, true);
  assert.equal(autoresearchFixture.comparisonContract?.hybridFamilyPresent, true);
  assert.ok(Number(autoresearchFixture.loop?.armCount ?? 0) >= 12);
  assert.ok(autoresearchFixture.winner?.armId);
  assert.match(autoresearchMarkdown, /Public Benchmark Autoresearch Loop/);
  for (const armExport of [answerQualityArmExportFresh, answerQualityArmExportEvidence]) {
    assert.equal(armExport.ok, true);
    assert.equal(armExport.mode, "public-benchmark-answer-quality-arm-export");
    assert.equal(armExport.status, "BLOCKED_RESPONSE_ARM_EXPORT_ENV");
    assert.equal(armExport.metricsOnly, true);
    assert.equal(armExport.publicSafe, true);
    assert.equal(armExport.retrievalProxyOnly, true);
    assert.equal(armExport.memoryBenchAnswerQuality, false);
    assert.equal(armExport.readyForAnswerQualityPreflight, false);
    assert.equal(armExport.readyForEndToEndMemoryScoreGate, false);
    assert.equal(armExport.countsAsFullMemorySotaEvidence, false);
    assert.equal(armExport.callsProviderApis, false);
    assert.equal(armExport.sendsBenchmarkTextToProvider, false);
    assert.equal(armExport.rawQuestionsIncluded, false);
    assert.equal(armExport.rawAnswersIncluded, false);
    assert.equal(armExport.rawMemoryIncluded, false);
    assert.equal(armExport.rawTranscriptIncluded, false);
    assert.equal(armExport.rawPrivateOutputPathIncluded, false);
    assert.equal(armExport.strategyCoverage?.hasBm25Lite, true);
    assert.equal(armExport.strategyCoverage?.hasFullHybridRerank, true);
    assert.equal(armExport.strategyCoverage?.hasQueryExpansion, true);
    assert.equal(armExport.strategyCoverage?.hasProviderChallenger, true);
    assert.equal(armExport.strategyCoverage?.hasLocalApple, true);
    assert.equal(armExport.strategyCoverage?.hasLocalRerank, true);
    assert.ok(armExport.blockers.includes("private-queryset-missing"));
    assert.ok(armExport.blockers.includes("private-response-output-dir-missing"));
    assert.ok(armExport.blockers.includes("RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed"));
    assert.ok(armExport.blockers.includes("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled"));
    assert.ok(armExport.blockers.includes("query-expansion-endpoint-or-consent-missing"));
  }
  assert.match(answerQualityArmExportMarkdownFresh, /Answer-Quality Response Arm Export/);
  assert.match(answerQualityArmExportMarkdownEvidence, /BLOCKED_RESPONSE_ARM_EXPORT_ENV/);
  assert.equal(answerQualityArmExportFixture.status, "EXPORTED_RESPONSE_ARMS");
  assert.equal(answerQualityArmExportFixture.fixtureOnly, true);
  assert.equal(answerQualityArmExportFixture.executesExports, true);
  assert.equal(answerQualityArmExportFixture.writesPrivateResponseFiles, true);
  assert.equal(answerQualityArmExportFixture.readyForAnswerQualityPreflight, false);
  assert.equal(answerQualityArmExportFixture.countsAsFullMemorySotaEvidence, false);
  assert.equal(answerQualityArmExportFixture.callsProviderApis, false);
  assert.equal(answerQualityArmExportFixture.rawPrivateOutputPathIncluded, false);
  assert.ok(answerQualityArmExportFixture.arms?.length >= 7);
  assert.ok(answerQualityArmExportFixture.arms?.some((item) => item.strategy === "query-expanded-full-hybrid-rerank"));
  assert.ok(answerQualityArmExportFixture.arms?.some((item) => item.strategy === "cloud-voyage4-voyage-lite-rerank" && item.providerMockCalls > 0));
  assert.ok(answerQualityArmExportFixture.arms?.every((item) => item.privacyLeakCount === 0 && item.redactionFailureCount === 0));
  for (const reviewerIntake of [memoryScoreReviewerIntakeFresh]) {
    assert.equal(reviewerIntake.ok, true);
    assert.equal(reviewerIntake.mode, "memory-score-reviewer-approval-intake");
    assert.equal(reviewerIntake.status, "BLOCKED_MEMORY_SCORE_REVIEWERS");
    assert.equal(reviewerIntake.metricsOnly, true);
    assert.equal(reviewerIntake.publicSafe, true);
    assert.equal(reviewerIntake.callsProviderApis, false);
    assert.equal(reviewerIntake.sendsBenchmarkTextToProvider, false);
    assert.equal(reviewerIntake.publicBenchmarkApprovalReady, false);
    assert.equal(reviewerIntake.countsAsFullMemorySotaReview, false);
    assert.equal(reviewerIntake.reviewerApprovalCount, 0);
    assert.equal(reviewerIntake.independentReviewerCount, 0);
    assert.equal(reviewerIntake.target?.memoryBenchAnswerQuality, true);
    assert.equal(reviewerIntake.target?.fixtureOnly, true);
    assert.ok(reviewerIntake.blockers.includes("fixture-result-cannot-be-reviewed-for-sota"));
    assert.ok(reviewerIntake.blockers.includes("two-independent-reviewer-approvals-missing"));
    assert.equal(reviewerIntake.safety?.requiresResultBinding, true);
    assert.equal(reviewerIntake.safety?.requiresTwoIndependentReviewersForClaims, true);
  }
  assert.equal(memoryScoreReviewerIntakeEvidence.ok, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.mode, "memory-score-reviewer-approval-intake");
  assert.equal(memoryScoreReviewerIntakeEvidence.status, "READY_MEMORY_SCORE_REVIEWERS");
  assert.equal(memoryScoreReviewerIntakeEvidence.metricsOnly, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.publicSafe, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.callsProviderApis, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.sendsBenchmarkTextToProvider, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.publicBenchmarkApprovalReady, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.countsAsFullMemorySotaReview, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.reviewerApprovalCount, 2);
  assert.equal(memoryScoreReviewerIntakeEvidence.independentReviewerCount, 2);
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.memoryBenchAnswerQuality, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.fixtureOnly, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.scoredQueryCount, 30);
  assert.match(String(memoryScoreReviewerIntakeEvidence.target?.resultHash), /^sha256:/);
  assert.deepEqual(memoryScoreReviewerIntakeEvidence.blockers, []);
  assert.ok(memoryScoreReviewerIntakeEvidence.reviews?.some((review) => review.provider === "deepseek-pro" && review.countable === true));
  assert.ok(memoryScoreReviewerIntakeEvidence.reviews?.some((review) => review.provider === "zai" && review.countable === true));
  assert.equal(memoryScoreReviewerIntakeEvidence.safety?.requiresResultBinding, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.safety?.requiresTwoIndependentReviewersForClaims, true);
  assert.match(memoryScoreReviewerIntakeMarkdownFresh, /Memory Score Reviewer Approval Intake/);
  assert.match(memoryScoreReviewerIntakeMarkdownEvidence, /READY_MEMORY_SCORE_REVIEWERS/);
  assert.equal(answerQualityArmExportLiveLocalEvidence.mode, "public-benchmark-answer-quality-arm-export");
  assert.equal(answerQualityArmExportLiveLocalEvidence.status, "EXPORTED_RESPONSE_ARMS");
  assert.equal(answerQualityArmExportLiveLocalEvidence.fixtureOnly, false);
  assert.equal(answerQualityArmExportLiveLocalEvidence.readyForAnswerQualityPreflight, true);
  assert.equal(answerQualityArmExportLiveLocalEvidence.rawPrivateOutputPathIncluded, false);
  assert.equal(answerQualityArmExportLiveLocalEvidence.arms?.length, 5);
  assert.ok(answerQualityArmExportLiveLocalEvidence.arms?.some((item) => item.strategy === "local-apple-qwen3-0_6b-local-rerank"));
  assert.equal(answerQualityPreflightLiveLocalEvidence.mode, "public-benchmark-answer-quality-preflight");
  assert.equal(answerQualityPreflightLiveLocalEvidence.status, "READY_FOR_LIVE_ANSWER_QUALITY");
  assert.equal(answerQualityPreflightLiveLocalEvidence.readiness?.sameDataReady, true);
  assert.equal(answerQualityPreflightLiveLocalEvidence.readiness?.readyForEndToEndMemoryScoreGate, true);
  assert.equal(answerQualityLiveLocalEvidence.mode, "public-benchmark-answer-quality");
  assert.equal(answerQualityLiveLocalEvidence.fixtureOnly, false);
  assert.equal(answerQualityLiveLocalEvidence.readyForEndToEndMemoryScoreGate, true);
  assert.equal(answerQualityLiveLocalEvidence.provider?.callsMade, 300);
  assert.equal(answerQualityLiveLocalEvidence.winner?.strategy, "local-apple-qwen3-0_6b-local-rerank");
  assert.equal(answerQualityLiveLocalEvidence.winner?.answerQuality, 36);
  assert.equal(answerQualityPreflightLiveProviderEvidence.mode, "public-benchmark-answer-quality-preflight");
  assert.equal(answerQualityPreflightLiveProviderEvidence.status, "READY_FOR_LIVE_ANSWER_QUALITY");
  assert.equal(answerQualityPreflightLiveProviderEvidence.readiness?.sameDataReady, true);
  assert.equal(answerQualityPreflightLiveProviderEvidence.readiness?.readyForEndToEndMemoryScoreGate, true);
  assert.equal(answerQualityLiveProviderEvidence.mode, "public-benchmark-answer-quality");
  assert.equal(answerQualityLiveProviderEvidence.fixtureOnly, false);
  assert.equal(answerQualityLiveProviderEvidence.readyForEndToEndMemoryScoreGate, true);
  assert.equal(answerQualityLiveProviderEvidence.provider?.callsMade, 180);
  assert.equal(answerQualityLiveProviderEvidence.winner?.strategy, "cloud-nvidia-nemotron-1b");
  assert.equal(answerQualityLiveProviderEvidence.winner?.answerQuality, 43.1667);
  assert.ok(answerQualityLiveProviderEvidence.strategies?.some((item) => item.strategy === "cloud-nvidia-nemotron-1b"));
  assert.equal(answerQualityCombinedEvidence.mode, "public-benchmark-answer-quality");
  assert.equal(answerQualityCombinedEvidence.combineMode, "same-data-answer-quality-union");
  assert.equal(answerQualityCombinedEvidence.fixtureOnly, false);
  assert.equal(answerQualityCombinedEvidence.readyForEndToEndMemoryScoreGate, true);
  assert.equal(answerQualityCombinedEvidence.provider?.callsMade, 480);
  assert.equal(answerQualityCombinedEvidence.winner?.strategy, "cloud-nvidia-nemotron-1b");
  assert.equal(answerQualityCombinedEvidence.winner?.answerQuality, 43.1667);
  assert.equal(answerQualityCombinedEvidence.sourceLock?.sameAnswerModel, true);
  assert.equal(answerQualityCombinedEvidence.sourceLock?.sameJudgeModel, true);
  assert.ok(answerQualityCombinedEvidence.strategies?.some((item) => item.strategy === "local-apple-qwen3-0_6b-local-rerank"));
  assert.ok(answerQualityCombinedEvidence.strategies?.some((item) => item.strategy === "query-expanded-full-hybrid-rerank"));
  const combineMismatchRoot = mkdtempSync(join(tmpdir(), "recallweave-answer-quality-combine-mismatch-"));
  try {
    const mismatchedProvider = structuredClone(answerQualityLiveProviderEvidence);
    mismatchedProvider.input.querySetHash = `sha256:${"0".repeat(64)}`;
    const mismatchProviderPath = join(combineMismatchRoot, "provider-queryset-mismatch.json");
    writeFileSync(mismatchProviderPath, `${JSON.stringify(mismatchedProvider, null, 2)}\n`);
    const mismatchRun = spawnSync("node", [
      "packages/bench/public-benchmark-answer-quality-combine.mjs",
      "--input",
      `reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json,${mismatchProviderPath}`,
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(mismatchRun.status, 0, "answer-quality combine must fail closed on query-set hash mismatch");
    assert.match(`${mismatchRun.stdout}\n${mismatchRun.stderr}`, /query-set hash/i);
    const mismatchedJudge = structuredClone(answerQualityLiveProviderEvidence);
    mismatchedJudge.provider.judgeModel = "different-judge-model";
    const mismatchJudgePath = join(combineMismatchRoot, "provider-judge-mismatch.json");
    writeFileSync(mismatchJudgePath, `${JSON.stringify(mismatchedJudge, null, 2)}\n`);
    const mismatchJudgeRun = spawnSync("node", [
      "packages/bench/public-benchmark-answer-quality-combine.mjs",
      "--input",
      `reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json,${mismatchJudgePath}`,
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(mismatchJudgeRun.status, 0, "answer-quality combine must fail closed on judge model mismatch");
    assert.match(`${mismatchJudgeRun.stdout}\n${mismatchJudgeRun.stderr}`, /judge model/i);
    const mismatchedAnswer = structuredClone(answerQualityLiveProviderEvidence);
    mismatchedAnswer.provider.answerModel = "different-answer-model";
    const mismatchAnswerPath = join(combineMismatchRoot, "provider-answer-mismatch.json");
    writeFileSync(mismatchAnswerPath, `${JSON.stringify(mismatchedAnswer, null, 2)}\n`);
    const mismatchAnswerRun = spawnSync("node", [
      "packages/bench/public-benchmark-answer-quality-combine.mjs",
      "--input",
      `reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json,${mismatchAnswerPath}`,
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(mismatchAnswerRun.status, 0, "answer-quality combine must fail closed on answer model mismatch");
    assert.match(`${mismatchAnswerRun.stdout}\n${mismatchAnswerRun.stderr}`, /answer model/i);

    const shardBase = structuredClone(answerQualityFixture);
    shardBase.fixtureOnly = false;
    shardBase.readyForEndToEndMemoryScoreGate = true;
    shardBase.callsProviderApis = true;
    shardBase.sendsBenchmarkTextToProvider = true;
    shardBase.provider.answerQualityCallsAllowed = true;
    shardBase.provider.publicDataConfirmed = true;
    shardBase.provider.callsMade = 12;
    const writeShard = (name, startIndex, endIndexExclusive, selectedIndexes, overrides = {}, totalQueryCount = 2) => {
      const shard = structuredClone(shardBase);
      shard.input.queryCount = totalQueryCount;
      shard.input.totalQueryCount = totalQueryCount;
      shard.input.scoredQueryCount = selectedIndexes.length;
      shard.input.queryOffset = startIndex;
      shard.input.queryLimit = endIndexExclusive - startIndex;
      shard.input.scoredQueryStart = startIndex;
      shard.input.scoredQueryEndExclusive = endIndexExclusive;
      shard.input.queryShard = {
        startIndex,
        endIndexExclusive,
        totalQueryCount,
        scoredQueryCount: selectedIndexes.length,
        requestedLimit: endIndexExclusive - startIndex,
        completeDataset: false,
        selectedQueryIdHash: `sha256:${name}${"a".repeat(Math.max(0, 64 - name.length))}`.slice(0, 71),
      };
      for (const arm of shard.strategies) {
        arm.scoredQueryCount = selectedIndexes.length;
        arm.resultFingerprints = selectedIndexes.map((index) => arm.resultFingerprints[index]);
      }
      Object.assign(shard, overrides);
      const path = join(combineMismatchRoot, `${name}.json`);
      writeFileSync(path, `${JSON.stringify(shard, null, 2)}\n`);
      return path;
    };

    const shard0 = writeShard("shard0", 0, 1, [0]);
    const shard1 = writeShard("shard1", 1, 2, [1]);
    const shardCombineRun = spawnSync("node", [
      "packages/bench/public-benchmark-answer-quality-combine.mjs",
      "--combine-mode",
      "shards",
      "--input",
      `${shard0},${shard1}`,
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(shardCombineRun.status, 0, `answer-quality shard combine should pass\n${shardCombineRun.stderr}`);
    const shardCombined = JSON.parse(shardCombineRun.stdout);
    assert.equal(shardCombined.combineMode, "query-shard-answer-quality-union");
    assert.equal(shardCombined.input?.scoredQueryCount, 2);
    assert.equal(shardCombined.sourceLock?.queryShardCoverage?.complete, true);
    assert.ok(shardCombined.strategies?.every((item) => item.scoredQueryCount === 2));

    const overlapShard = writeShard("overlap", 0, 1, [0]);
    const overlapRun = spawnSync("node", [
      "packages/bench/public-benchmark-answer-quality-combine.mjs",
      "--combine-mode",
      "shards",
      "--input",
      `${shard0},${overlapShard}`,
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(overlapRun.status, 0, "answer-quality shard combine must fail closed on overlap");
    assert.match(`${overlapRun.stdout}\n${overlapRun.stderr}`, /gap or overlap/i);

    const gapStart = writeShard("gapstart", 0, 1, [0], {}, 3);
    const gapShard = writeShard("gap", 2, 3, [1], {}, 3);
    const gapRun = spawnSync("node", [
      "packages/bench/public-benchmark-answer-quality-combine.mjs",
      "--combine-mode",
      "shards",
      "--input",
      `${gapStart},${gapShard}`,
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(gapRun.status, 0, "answer-quality shard combine must fail closed on coverage gaps");
    assert.match(`${gapRun.stdout}\n${gapRun.stderr}`, /gap or overlap/i);
  } finally {
    rmSync(combineMismatchRoot, { recursive: true, force: true });
  }
  assert.equal(voyageProviderRateLimitEvidence.mode, "provider-benchmark-blocker");
  assert.equal(voyageProviderRateLimitEvidence.status, "BLOCKED_VOYAGE_RATE_LIMIT");
  assert.equal(voyageProviderRateLimitEvidence.httpStatus, 429);
  assert.ok(voyageProviderRateLimitEvidence.attemptedStrategies?.includes("cloud-voyage4-voyage"));
  assert.equal(endToEndMemoryScoreGateEvidence.mode, "end-to-end-memory-score-gate");
  assert.equal(endToEndMemoryScoreGateEvidence.status, "BLOCKED_END_TO_END_MEMORY_SCORE");
  assert.equal(endToEndMemoryScoreGateEvidence.result?.answerQualityMetric?.value, 43.1667);
  assert.ok(endToEndMemoryScoreGateEvidence.result?.arms?.includes("cloud-nvidia-nemotron-1b"));
  assert.ok(endToEndMemoryScoreGateEvidence.result?.arms?.includes("local-apple-qwen3-0_6b-local-rerank"));
  assert.ok(endToEndMemoryScoreGateEvidence.blockers.includes("missing-voyage-provider-arm"));
  assert.equal(endToEndMemoryScoreGateEvidence.blockers.includes("missing-nvidia-or-gemini-provider-arm"), false);
  assert.equal(endToEndMemoryScoreGateEvidence.blockers.includes("memory-score-reviewer-approval-report-not-ready"), false);
  assert.equal(endToEndMemoryScoreGateEvidence.blockers.includes("missing-two-independent-reviewer-approvals"), false);
  assert.equal(endToEndMemoryScoreGateEvidence.reviewerApproval?.exists, true);
  assert.equal(endToEndMemoryScoreGateEvidence.reviewerApproval?.targetBound, true);
  assert.equal(endToEndMemoryScoreGateEvidence.reviewerApproval?.reviewerApprovalCount, 2);
  assert.equal(sotaLadderFresh.mode, "public-benchmark-sota-ladder");
  assert.equal(sotaLadderFresh.status, "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE");
  assert.equal(sotaLadderFresh.fullBenchmarkPolicy?.currentAnswerQualityQueryCount, 30);
  assert.equal(sotaLadderFresh.fullBenchmarkPolicy?.minimumFullQueryCount, 500);
  assert.equal(sotaLadderFresh.fullBenchmarkPolicy?.fullOrOfficiallyComparableRunPresent, false);
  assert.ok(sotaLadderFresh.blockers.includes("missing-full-or-officially-comparable-memory-benchmark-run"));
  assert.ok(sotaLadderFresh.componentEvidence?.some((item) => item.id === "embeddinggemma"));
  assert.match(sotaLadderMarkdownFresh, /Full Benchmark Policy/);
  assert.equal(sotaOperatorPacketFresh.mode, "public-benchmark-sota-operator-packet");
  assert.equal(sotaOperatorPacketFresh.sameDataContract?.fullOrOfficiallyComparableBenchmarkRequiredForBroadSota, true);
  assert.equal(sotaOperatorPacketFresh.currentEvidence?.sotaLadder?.fullBenchmarkPolicy?.fullOrOfficiallyComparableRunPresent, false);
  assert.ok(sotaOperatorPacketFresh.passCriteria?.some((item) => /full benchmark or officially comparable/i.test(item)));
  for (const preflight of [answerQualityPreflightFresh, answerQualityPreflightEvidence]) {
    assert.equal(preflight.ok, true);
    assert.equal(preflight.mode, "public-benchmark-answer-quality-preflight");
    assert.equal(preflight.status, "BLOCKED_ANSWER_QUALITY_ENV");
    assert.equal(preflight.metricsOnly, true);
    assert.equal(preflight.publicSafe, true);
    assert.equal(preflight.callsProviderApis, false);
    assert.equal(preflight.sendsBenchmarkTextToProvider, false);
    assert.equal(preflight.rawQuestionsIncluded, false);
    assert.equal(preflight.rawAnswersIncluded, false);
    assert.equal(preflight.rawMemoryIncluded, false);
    assert.equal(preflight.rawTranscriptIncluded, false);
    assert.equal(preflight.readiness?.liveAnswerQualityCanRun, false);
    assert.equal(preflight.readiness?.readyForEndToEndMemoryScoreGate, false);
    assert.ok(preflight.blockers.includes("private-queryset-missing"));
    assert.ok(preflight.blockers.includes("response-arm-exports-missing"));
    assert.equal(preflight.requiredStrategyCoverage?.hasBm25Lite, false);
    assert.equal(preflight.requiredStrategyCoverage?.hasFullHybridRerank, false);
    assert.equal(preflight.requiredStrategyCoverage?.hasChallenger, false);
  }
  assert.match(answerQualityPreflightMarkdownFresh, /Answer-Quality Benchmark Preflight/);
  assert.match(answerQualityPreflightMarkdownEvidence, /BLOCKED_ANSWER_QUALITY_ENV/);
  assert.equal(answerQualityFixture.ok, true);
  assert.equal(answerQualityFixture.mode, "public-benchmark-answer-quality");
  assert.equal(answerQualityFixture.fixtureOnly, true);
  assert.equal(answerQualityFixture.metricsOnly, true);
  assert.equal(answerQualityFixture.retrievalProxyOnly, false);
  assert.equal(answerQualityFixture.memoryBenchAnswerQuality, true);
  assert.equal(answerQualityFixture.readyForEndToEndMemoryScoreGate, false);
  assert.equal(answerQualityFixture.publicBenchmarkClaimsAllowed, false);
  assert.equal(answerQualityFixture.rawQuestionsIncluded, false);
  assert.equal(answerQualityFixture.rawAnswersIncluded, false);
  assert.equal(answerQualityFixture.rawMemoryIncluded, false);
  assert.equal(answerQualityFixture.rawTranscriptIncluded, false);
  assert.ok(answerQualityFixture.strategies?.some((item) => item.strategy === "bm25-lite"));
  assert.match(answerQualityMarkdown, /Public Benchmark Answer Quality/);
  assert.equal(liveMaterializeReport.ok, true);
  assert.equal(liveMaterializeReport.fixtureOnly, false);
  assert.equal(liveMaterializeReport.claimTier, "run-only");
  assert.equal(liveMaterializeReport.source?.datasetHash, "sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442");
  assert.equal(liveMaterializeReport.selection?.queryCount, 6);
  assert.equal(liveMaterializeReport.selection?.haystackSessionCount, 287);
  assert.equal(liveMaterializeReport.selection?.expectedResultRefCount, 18);
  assert.equal(liveMaterializeReport.selection?.selectedQuestionIdsHash, "sha256:686da163b61d343549768cdccd890a46ce775b653414932bdd07aec2ccdd3a23");
  assert.equal(liveMaterializeReport.selection?.answerLabelsHash, "sha256:423098446f2953b45fe049fbd9da0b8d806050d4aed6cdec2a349f167ce1fa3e");
  assert.ok(liveMaterializeReport.selection?.collectorCompatibleQuerySetHash?.startsWith("sha256:"));
  assert.equal(liveMaterializeReport.target?.retrievalStrategy, "bm25-lite");
  assert.equal(liveMaterializeReport.target?.contextTokenBudget, 800);
  assert.equal(liveMaterializeReport.target?.limit, 5);
  assert.equal(liveMaterializeReport.privateOutputs?.directoryInsideRepository, false);
  assert.equal(liveMaterializeReport.rawPrivateOutputPathIncluded, false);
  assert.match(liveMaterializeEvidence, /Public Benchmark Materialize Run/);
  assert.match(liveMaterializeEvidence, /Query count: 6/);
  assert.equal(liveRecallWeaveRun.evidenceType, "live-recallweave-baseline-collector-result");
  assert.equal(liveRecallWeaveRun.provider, "recallweave");
  assert.equal(liveRecallWeaveRun.fixtureOnly, false);
  assert.equal(liveRecallWeaveRun.metricsOnly, true);
  assert.equal(liveRecallWeaveRun.retrievalProxyOnly, true);
  assert.equal(liveRecallWeaveRun.memoryBenchAnswerQuality, false);
  assert.equal(liveRecallWeaveRun.publicBenchmarkClaimsAllowed, false);
  assert.equal(liveRecallWeaveRun.datasetSlice, "longmemeval-s-cleaned-canary-6-first-per-type-2026-05-23");
  assert.equal(liveRecallWeaveRun.querySetHash, liveMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  assert.equal(liveRecallWeaveRun.queryCount, 6);
  assert.equal(liveRecallWeaveRun.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(liveRecallWeaveRun.querySetEvidence?.expectedResultRefCount, 18);
  assert.equal(liveRecallWeaveRun.privacyLeakCount, 0);
  assert.equal(liveRecallWeaveRun.redactionFailureCount, 0);
  assert.equal(liveRecallWeaveRun.rawMemoryIncluded, false);
  assert.equal(liveRecallWeaveRun.rawTranscriptIncluded, false);
  assert.equal(liveRecallWeaveRun.rawPromptIncluded, false);
  assert.equal(liveRecallWeaveRun.rawAnswerIncluded, false);
  assert.equal(liveRecallWeaveRun.retrievalConfig?.retrievalMode, "strategy:bm25-lite");
  assert.equal(liveRecallWeaveRun.retrievalConfig?.rankingStrategy, "bm25-lite");
  assert.equal(liveRecallWeaveRun.retrievalConfig?.limit, 5);
  assert.equal(liveRecallWeaveRun.retrievalConfig?.contextBudget?.tokenBudget, 800);
  assert.equal(liveRecallWeaveRun.matchedHostedRunPresent, false);
  assert.equal(liveRecallWeaveRun.reviewerApprovalCount, 0);
  assert.ok(Number(liveRecallWeaveRun.metrics?.quality) > 0);
  assert.ok(Number(liveRecallWeaveRun.metrics?.quality) < 1);
  assert.match(liveMaterializeReview, /PASS WITH CONCERNS/);
  assert.match(liveMaterializeReview, /retrieval proxy/i);
  assert.match(liveMaterializeReview, /not a MemoryBench quality win/i);
  assert.equal(liveStrategyReport.ok, true);
  assert.equal(liveStrategyReport.fixtureOnly, false);
  assert.equal(liveStrategyReport.benchmark, "longmemeval");
  assert.equal(liveStrategyReport.metricsOnly, true);
  assert.equal(liveStrategyReport.retrievalProxyOnly, true);
  assert.equal(liveStrategyReport.memoryBenchAnswerQuality, false);
  assert.equal(liveStrategyReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(liveStrategyReport.rawQuestionIdsIncluded, false);
  assert.equal(liveStrategyReport.rawQuestionsIncluded, false);
  assert.equal(liveStrategyReport.rawAnswersIncluded, false);
  assert.equal(liveStrategyReport.rawMemoryIncluded, false);
  assert.equal(liveStrategyReport.input?.querySetHash, liveMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  assert.equal(liveStrategyReport.input?.queryCount, 6);
  assert.equal(liveStrategyReport.input?.expectedResultRefCount, 18);
  assert.equal(liveStrategyReport.input?.haystackSessionCount, 287);
  const strategyNames = new Set((liveStrategyReport.strategies ?? []).map((item) => item.strategy));
  for (const strategyName of ["jaccard", "bm25-lite", "hybrid-v1"]) assert.ok(strategyNames.has(strategyName), `missing strategy ${strategyName}`);
  const strategyByName = new Map((liveStrategyReport.strategies ?? []).map((item) => [item.strategy, item]));
  const jaccard = strategyByName.get("jaccard");
  const bm25Lite = strategyByName.get("bm25-lite");
  assert.ok(Number(bm25Lite?.metrics?.quality ?? 0) > Number(jaccard?.metrics?.quality ?? 0));
  assert.ok(Number(bm25Lite?.metrics?.pAt1 ?? 0) > Number(jaccard?.metrics?.pAt1 ?? 0));
  assert.equal(liveStrategyReport.winner?.strategy, "bm25-lite");
  assert.equal(liveRecallWeaveRun.metrics?.quality, liveStrategyReport.winner?.quality);
  assert.equal(liveRecallWeaveRun.metrics?.pAt1, liveStrategyReport.winner?.pAt1);
  assert.equal(liveRecallWeaveRun.metrics?.recallAt5, liveStrategyReport.winner?.recallAt5);
  assert.equal(liveRecallWeaveRun.metrics?.recallAt10, liveStrategyReport.winner?.recallAt10);
  assert.equal(liveRecallWeaveRun.metrics?.ndcgAt10, liveStrategyReport.winner?.ndcgAt10);
  for (const item of liveStrategyReport.strategies ?? []) {
    assert.equal(item.privacyLeakCount, 0);
    assert.equal(item.redactionFailureCount, 0);
    assert.equal(item.querySetHash, liveMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  }
  assert.match(liveStrategyEvidence, /Public Benchmark Strategy Compare/);
  assert.match(liveStrategyEvidence, /Winner: bm25-lite/);
  assert.match(liveStrategyReview, /PASS WITH CONCERNS/);
  assert.match(liveStrategyReview, /same-data/i);
  assert.match(liveStrategyReview, /not a MemoryBench answer-quality/i);
  assert.equal(liveHybridReport.ok, true);
  assert.equal(liveHybridReport.mode, "public-benchmark-hybrid-gate");
  assert.equal(liveHybridReport.gate, "hybrid");
  assert.equal(liveHybridReport.fixtureOnly, false);
  assert.equal(liveHybridReport.benchmark, "longmemeval");
  assert.equal(liveHybridReport.metricsOnly, true);
  assert.equal(liveHybridReport.retrievalProxyOnly, true);
  assert.equal(liveHybridReport.memoryBenchAnswerQuality, false);
  assert.equal(liveHybridReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(liveHybridReport.rawQuestionIdsIncluded, false);
  assert.equal(liveHybridReport.rawQuestionsIncluded, false);
  assert.equal(liveHybridReport.rawAnswersIncluded, false);
  assert.equal(liveHybridReport.rawMemoryIncluded, false);
  assert.equal(liveHybridReport.input?.querySetHash, liveMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  assert.equal(liveHybridReport.input?.queryCount, 6);
  assert.equal(liveHybridReport.input?.expectedResultRefCount, 18);
  assert.equal(liveHybridReport.input?.haystackSessionCount, 287);
  const hybridNames = new Set((liveHybridReport.strategies ?? []).map((item) => item.strategy));
  for (const strategyName of [
    "bm25-lite",
    "dense-proxy",
    "sparse-dense-rrf",
    "sparse-dense-temporal",
    "sparse-dense-graph-temporal",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
  ]) {
    assert.ok(hybridNames.has(strategyName), `missing hybrid gate strategy ${strategyName}`);
  }
  assert.equal(liveHybridReport.control?.strategy, "bm25-lite");
  assert.equal(liveHybridReport.winner?.strategy, "bm25-lite");
  assert.equal(liveHybridReport.hybridPromotion?.promoteHybrid, false);
  assert.equal(liveHybridReport.control?.quality, liveRecallWeaveRun.metrics?.quality);
  for (const item of liveHybridReport.strategies ?? []) {
    assert.equal(item.privacyLeakCount, 0);
    assert.equal(item.redactionFailureCount, 0);
    assert.equal(item.querySetHash, liveMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  }
  assert.match(liveHybridEvidence, /Gate: hybrid/);
  assert.match(liveHybridEvidence, /Hybrid promotion: false/);
  assert.match(liveHybridReview, /PASS WITH CONCERNS/);
  assert.match(liveHybridReview, /bm25-lite/i);
  assert.match(liveHybridReview, /not MemoryBench answer-quality/i);
  assert.equal(expandedSliceReport.mode, "public-benchmark-slice-manifest");
  assert.equal(expandedSliceReport.fixtureOnly, false);
  assert.equal(expandedSliceReport.dataset?.hash, liveMaterializeReport.source?.datasetHash);
  assert.equal(expandedSliceReport.dataset?.selectedCount, 30);
  assert.equal(expandedSliceReport.dataset?.questionTypeCount, 6);
  assert.equal(expandedSliceReport.dataset?.selectedQuestionIdsHash, "sha256:94a21a5744089b9716874f8a4b5eb587a62c8e5671086021d38b5668ec0ce856");
  assert.equal(expandedSliceReport.labels?.answerLabelsHash, "sha256:1463b12802582c0bf0dcf1ba9d080bb1bf0a85bad15fd7dd0f4e528342ebae9a");
  assert.equal(expandedSliceReport.publicSafety?.rawQuestionsIncluded, false);
  assert.match(expandedSliceEvidence, /Selected count: 30/);
  assert.equal(expandedRunTarget.claimTier, "run-only");
  assert.match(expandedRunTarget.benchmark?.questionIdPolicy ?? "", /perType=5; limit=30/);
  assert.equal(expandedRunTargetReport.ok, true);
  assert.equal(expandedRunTargetReport.fixtureOnly, false);
  assert.equal(expandedRunTargetReport.publicSliceRunReady, true);
  assert.equal(expandedRunTargetReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(expandedMaterializeReport.ok, true);
  assert.equal(expandedMaterializeReport.fixtureOnly, false);
  assert.equal(expandedMaterializeReport.selection?.queryCount, 30);
  assert.equal(expandedMaterializeReport.selection?.haystackSessionCount, 1420);
  assert.equal(expandedMaterializeReport.selection?.expectedResultRefCount, 92);
  assert.equal(expandedMaterializeReport.rawPrivateOutputPathIncluded, false);
  assert.match(expandedMaterializeEvidence, /Query count: 30/);
  assert.equal(expandedHybridReport.ok, true);
  assert.equal(expandedHybridReport.mode, "public-benchmark-hybrid-gate");
  assert.equal(expandedHybridReport.fixtureOnly, false);
  assert.equal(expandedHybridReport.input?.queryCount, 30);
  assert.equal(expandedHybridReport.input?.expectedResultRefCount, 92);
  assert.equal(expandedHybridReport.input?.haystackSessionCount, 1420);
  assert.equal(expandedHybridReport.input?.querySetHash, expandedMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  assert.equal(expandedHybridReport.winner?.strategy, "bm25-lite");
  assert.equal(expandedHybridReport.control?.strategy, "bm25-lite");
  assert.equal(expandedHybridReport.hybridPromotion?.bestHybridStrategy, "full-hybrid-rerank");
  assert.equal(expandedHybridReport.hybridPromotion?.promoteHybrid, false);
  assert.ok(Number(expandedHybridReport.hybridPromotion?.qualityDeltaVsBm25 ?? 0) < 0);
  assert.ok(Number(expandedHybridReport.winner?.quality ?? 0) > Number(liveHybridReport.winner?.quality ?? 0) * 0.5);
  assert.ok(Number(expandedHybridReport.winner?.quality ?? 0) < Number(liveHybridReport.winner?.quality ?? 0));
  assert.match(expandedHybridEvidence, /Query count: 30/);
  assert.match(expandedHybridEvidence, /Hybrid promotion: false/);
  for (const item of expandedHybridReport.strategies ?? []) {
    assert.equal(item.privacyLeakCount, 0);
    assert.equal(item.redactionFailureCount, 0);
    assert.equal(item.querySetHash, expandedMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  }
  assert.equal(expandedAutoresearchReport.ok, true);
  assert.equal(expandedAutoresearchReport.fixtureOnly, false);
  assert.equal(expandedAutoresearchReport.benchmark, "longmemeval");
  assert.equal(expandedAutoresearchReport.metricsOnly, true);
  assert.equal(expandedAutoresearchReport.retrievalProxyOnly, true);
  assert.equal(expandedAutoresearchReport.memoryBenchAnswerQuality, false);
  assert.equal(expandedAutoresearchReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(expandedAutoresearchReport.rawQuestionIdsIncluded, false);
  assert.equal(expandedAutoresearchReport.rawQuestionsIncluded, false);
  assert.equal(expandedAutoresearchReport.rawAnswersIncluded, false);
  assert.equal(expandedAutoresearchReport.rawMemoryIncluded, false);
  assert.equal(expandedAutoresearchReport.input?.querySetHash, expandedMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  assert.equal(expandedAutoresearchReport.input?.queryCount, 30);
  assert.equal(expandedAutoresearchReport.input?.expectedResultRefCount, 92);
  assert.equal(expandedAutoresearchReport.input?.haystackSessionCount, 1420);
  assert.equal(expandedAutoresearchReport.loop?.variables?.maxMemoryBytes, 80000000);
  assert.equal(expandedAutoresearchReport.winner?.strategy, "bm25-lite");
  assert.equal(expandedAutoresearchReport.winner?.contextTokenBudget, 800);
  assert.equal(expandedAutoresearchReport.winner?.metrics?.quality, expandedHybridReport.winner?.quality);
  assert.equal(expandedAutoresearchReport.winner?.privacyLeakCount, 0);
  assert.equal(expandedAutoresearchReport.winner?.redactionFailureCount, 0);
  assert.match(expandedAutoresearchEvidence, /Public Benchmark Autoresearch Loop/);
  assert.match(expandedAutoresearchEvidence, /Query set hash: sha256:4386f6fa3280951bffd59b5ae81f067905b1905be3575eff56e2b4168c0ccda7/);
  assert.match(expandedAutoresearchEvidence, /Winner: bm25-lite-b800-k5/);
  assert.equal(providerGateFixtureReport.ok, true);
  assert.equal(providerGateFixtureReport.mode, "public-benchmark-provider-gate");
  assert.equal(providerGateFixtureReport.gate, "provider");
  assert.equal(providerGateFixtureReport.fixtureOnly, true);
  assert.equal(providerGateFixtureReport.metricsOnly, true);
  assert.equal(providerGateFixtureReport.retrievalProxyOnly, true);
  assert.equal(providerGateFixtureReport.memoryBenchAnswerQuality, false);
  assert.equal(providerGateFixtureReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(providerGateFixtureReport.rawQuestionsIncluded, false);
  assert.equal(providerGateFixtureReport.rawAnswersIncluded, false);
  assert.equal(providerGateFixtureReport.rawMemoryIncluded, false);
  const providerGateNames = new Set((providerGateFixtureReport.strategies ?? []).map((item) => item.strategy));
  for (const strategyName of [
    "bm25-lite",
    "full-hybrid-rerank",
    "cloud-voyage-rerank-only",
    "cloud-voyage4-voyage",
    "cloud-voyage4-voyage-lite-rerank",
    "cloud-voyage4-lite-voyage-lite",
    "cloud-gemini-embed-rerank-proxy",
    "cloud-gemini-voyage-rerank",
    "cloud-nvidia-retriever-500m",
    "cloud-nvidia-nemotron-1b",
    "cloud-nvidia-e5-mistral",
    "local-apple-qwen3-0_6b",
  ]) {
    assert.ok(providerGateNames.has(strategyName), `missing provider gate strategy ${strategyName}`);
  }
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-voyage4-voyage" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-voyage4-voyage-lite-rerank" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-voyage4-lite-voyage-lite" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-voyage-rerank-only" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-gemini-embed-rerank-proxy" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-gemini-voyage-rerank" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-nvidia-nemotron-1b" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "local-apple-qwen3-0_6b" && item.provider?.fixtureProviderMock === true));
  assert.match(providerGateFixtureEvidence, /Gate: provider/);
  assert.match(providerGateFixtureEvidence, /cloud-voyage4-voyage/);
  assert.match(providerGateFixtureEvidence, /cloud-voyage4-lite-voyage-lite/);
  assert.match(providerGateFixtureEvidence, /cloud-gemini-voyage-rerank/);
  assert.match(providerGateFixtureEvidence, /cloud-nvidia-nemotron-1b/);
  assert.match(providerGateFixtureEvidence, /local-apple-qwen3-0_6b/);
  const providerGateWithoutControls = spawnSync(
    "node",
    ["packages/bench/public-benchmark-strategy-compare.mjs", "--gate", "provider", "--fixture", "--strategies", "cloud-voyage4-voyage"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.notEqual(providerGateWithoutControls.status, 0, "provider gate must reject solo provider-arm runs");
  const hybridGateWithoutControl = spawnSync(
    "node",
    ["packages/bench/public-benchmark-strategy-compare.mjs", "--gate", "hybrid", "--fixture", "--strategies", "full-hybrid-rerank"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.notEqual(hybridGateWithoutControl.status, 0, "hybrid gate must reject runs without bm25-lite control");
  const strategyGateWithoutControl = spawnSync(
    "node",
    ["packages/bench/public-benchmark-strategy-compare.mjs", "--fixture", "--strategies", "hybrid-v1"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.notEqual(strategyGateWithoutControl.status, 0, "strategy gate must reject solo benchmark runs without explicit smoke labeling");
  const strategyGateSoloSmoke = JSON.parse(
    run("node", ["packages/bench/public-benchmark-strategy-compare.mjs", "--fixture", "--strategies", "bm25-lite", "--allow-solo-smoke"]).stdout,
  );
  assert.equal(strategyGateSoloSmoke.comparisonContract?.allowSoloSmoke, true);
  assert.equal(strategyGateSoloSmoke.comparisonContract?.sameDataControlsRequired, false);
  assert.equal(providerLivePreflightReport.ok, true);
  assert.equal(providerLivePreflightReport.mode, "provider-benchmark-live-preflight");
  assert.equal(providerLivePreflightReport.metricsOnly, true);
  assert.equal(providerLivePreflightReport.callsProviderApis, false);
  assert.equal(providerLivePreflightReport.sendsBenchmarkTextToProvider, false);
  assert.equal(providerLivePreflightReport.publicSafe, true);
  assert.equal(providerLivePreflightReport.liveRunAllowed, false);
  assert.equal(providerLivePreflightReport.status, "BLOCKED_PROVIDER_ENV");
  assert.equal(providerLivePreflightFresh.status, "BLOCKED_PROVIDER_ENV");
  assert.equal(providerLivePreflightFresh.liveRunAllowed, false);
  assert.ok(providerLivePreflightReport.blockers?.includes("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled"));
  assert.ok(providerLivePreflightReport.blockers?.includes("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed"));
  assert.ok(providerLivePreflightReport.missingCredentialProviders?.includes("gemini"));
  assert.ok(providerLivePreflightReport.missingCredentialProviders?.includes("voyage"));
  assert.ok(providerLivePreflightReport.missingCredentialProviders?.includes("nvidia"));
  assert.ok(providerLivePreflightReport.missingCredentialProviders?.includes("local-apple"));
  assert.deepEqual(providerLivePreflightReport.strategies, [
    "bm25-lite",
    "full-hybrid-rerank",
    "cloud-voyage-rerank-only",
    "cloud-voyage4-voyage",
    "cloud-gemini-embed-rerank-proxy",
    "cloud-gemini-voyage-rerank",
    "cloud-nvidia-retriever-500m",
    "cloud-nvidia-nemotron-1b",
    "cloud-nvidia-e5-mistral",
    "local-apple-qwen3-0_6b",
  ]);
  assert.match(providerLivePreflightEvidence, /Provider Benchmark Live Preflight/);
  assert.match(providerLivePreflightEvidence, /Live run allowed: false/);
  assert.match(providerLivePreflightEvidence, /cloud-gemini-voyage-rerank/);
  assert.match(providerLivePreflightEvidence, /cloud-nvidia-nemotron-1b/);
  assert.match(providerLivePreflightEvidence, /local-apple-qwen3-0_6b/);
  assert.equal(expandedProviderLivePreflightReport.ok, true);
  assert.equal(expandedProviderLivePreflightReport.mode, "provider-benchmark-live-preflight");
  assert.equal(expandedProviderLivePreflightReport.status, "BLOCKED_PROVIDER_ENV");
  assert.equal(expandedProviderLivePreflightReport.liveRunAllowed, false);
  assert.equal(expandedProviderLivePreflightReport.callsProviderApis, false);
  assert.equal(expandedProviderLivePreflightReport.sendsBenchmarkTextToProvider, false);
  assert.equal(expandedProviderLivePreflightReport.target?.path, "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
  assert.equal(expandedProviderLivePreflightReport.target?.hash, "sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c");
  assert.equal(expandedProviderLivePreflightFresh.target?.hash, expandedProviderLivePreflightReport.target?.hash);
  assert.equal(expandedProviderLivePreflightFresh.status, "BLOCKED_PROVIDER_ENV");
  assert.equal(expandedProviderLivePreflightFresh.liveRunAllowed, false);
  assert.deepEqual(expandedProviderLivePreflightReport.strategies, providerLivePreflightReport.strategies);
  assert.ok(expandedProviderLivePreflightReport.blockers?.includes("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled"));
  assert.ok(expandedProviderLivePreflightReport.blockers?.includes("RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed"));
  assert.ok(expandedProviderLivePreflightReport.missingCredentialProviders?.includes("gemini"));
  assert.ok(expandedProviderLivePreflightReport.missingCredentialProviders?.includes("voyage"));
  assert.ok(expandedProviderLivePreflightReport.missingCredentialProviders?.includes("nvidia"));
  assert.ok(expandedProviderLivePreflightReport.missingCredentialProviders?.includes("local-apple"));
  assert.ok(
    expandedProviderLivePreflightReport.liveCommandTemplate?.some((line) =>
      String(line).includes("reviews/overnight-20260522/public-longmemeval-expanded-run-target.json"),
    ),
  );
  assert.ok(expandedProviderLivePreflightReport.liveCommandTemplate?.some((line) => String(line).includes("--strategies bm25-lite,full-hybrid-rerank")));
  assert.match(expandedProviderLivePreflightEvidence, /Provider Benchmark Live Preflight/);
  assert.match(expandedProviderLivePreflightEvidence, /Live run allowed: false/);
  assert.match(expandedProviderLivePreflightEvidence, /cloud-voyage4-voyage/);
  assert.match(expandedProviderLivePreflightEvidence, /cloud-nvidia-nemotron-1b/);
  assert.match(expandedProviderLivePreflightEvidence, /local-apple-qwen3-0_6b/);
  assert.equal(expandedProviderLivePreflightVoyageReport.ok, true);
  assert.equal(expandedProviderLivePreflightVoyageReport.mode, "provider-benchmark-live-preflight");
  assert.equal(expandedProviderLivePreflightVoyageReport.status, "BLOCKED_PROVIDER_ENV");
  assert.equal(expandedProviderLivePreflightVoyageReport.liveRunAllowed, false);
  assert.equal(expandedProviderLivePreflightVoyageReport.callsProviderApis, false);
  assert.equal(expandedProviderLivePreflightVoyageReport.sendsBenchmarkTextToProvider, false);
  assert.equal(expandedProviderLivePreflightVoyageReport.target?.path, "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
  assert.deepEqual(expandedProviderLivePreflightVoyageReport.requiredProviders, ["voyage"]);
  assert.deepEqual(expandedProviderLivePreflightVoyageReport.missingCredentialProviders, ["voyage"]);
  assert.equal(expandedProviderLivePreflightVoyageReport.singleProviderArmReady, true);
  assert.deepEqual(expandedProviderLivePreflightVoyageReport.strategies, ["bm25-lite", "full-hybrid-rerank", "cloud-voyage4-voyage"]);
  assert.ok(expandedProviderLivePreflightVoyageReport.blockers?.includes("voyage-credentials-missing"));
  assert.ok(expandedProviderLivePreflightVoyageReport.liveCommandTemplate?.some((line) => String(line).includes("VOYAGE_API_KEY=<env-only-voyage-key>")));
  assert.ok(!expandedProviderLivePreflightVoyageReport.liveCommandTemplate?.some((line) => String(line).includes("NVIDIA_API_KEY=<env-only-nvidia-key>")));
  assert.ok(!expandedProviderLivePreflightVoyageReport.liveCommandTemplate?.some((line) => String(line).includes("GEMINI_API_KEY=<env-only-gemini-key>")));
  assert.match(expandedProviderLivePreflightVoyageEvidence, /Provider Benchmark Live Preflight/);
  assert.match(expandedProviderLivePreflightVoyageEvidence, /cloud-voyage4-voyage/);
  assert.match(expandedProviderLivePreflightVoyageEvidence, /VOYAGE_API_KEY=<env-only-voyage-key>/);
  assert.match(expandedProviderLivePreflightVoyageEvidence, /VOYAGE_API_KEYS_FILE=<optional-private-voyage-key-file>/);
  assert.equal(expandedVoyageLatencyPreflightReport.ok, true);
  assert.equal(expandedVoyageLatencyPreflightReport.mode, "provider-benchmark-live-preflight");
  assert.equal(expandedVoyageLatencyPreflightReport.liveRunAllowed, true);
  assert.deepEqual(expandedVoyageLatencyPreflightReport.requiredProviders, ["voyage"]);
  assert.deepEqual(expandedVoyageLatencyPreflightReport.strategies, [
    "bm25-lite",
    "full-hybrid-rerank",
    "cloud-voyage4-voyage",
    "cloud-voyage4-voyage-lite-rerank",
    "cloud-voyage4-lite-voyage-lite",
  ]);
  assert.equal(expandedVoyageLatencyReport.ok, true);
  assert.equal(expandedVoyageLatencyReport.fixtureOnly, false);
  assert.equal(expandedVoyageLatencyReport.retrievalProxyOnly, true);
  assert.equal(expandedVoyageLatencyReport.memoryBenchAnswerQuality, false);
  assert.equal(expandedVoyageLatencyReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(expandedVoyageLatencyReport.input?.queryCount, 30);
  assert.equal(expandedVoyageLatencyReport.input?.expectedResultRefCount, 92);
  assert.equal(expandedVoyageLatencyReport.winner?.strategy, "cloud-voyage4-lite-voyage-lite");
  assert.equal(expandedVoyageLatencyReport.winner?.quality, 0.304);
  assert.equal(expandedVoyageLatencyReport.control?.strategy, "bm25-lite");
  assert.equal(expandedVoyageLatencyReport.control?.quality, 0.2506);
  assert.equal(expandedVoyageLatencyReport.hybridPromotion?.promoteHybrid, true);
  assert.equal(expandedVoyageLatencyReport.privacyLeakCount ?? 0, 0);
  assert.ok(
    expandedVoyageLatencyReport.strategies?.some(
      (item) =>
        item.strategy === "cloud-voyage4-lite-voyage-lite" &&
        item.provider?.embedModel === "voyage-4-lite" &&
        item.provider?.rerankModel === "rerank-2.5-lite" &&
        item.privacyLeakCount === 0 &&
        item.redactionFailureCount === 0,
    ),
  );
  assert.match(expandedVoyageLatencyEvidence, /cloud-voyage4-lite-voyage-lite/);
  assert.match(expandedVoyageLatencyEvidence, /Public LongMemEval-S Voyage Latency Provider Evidence/);
  assert.equal(fullSliceReport.mode, "public-benchmark-slice-manifest");
  assert.equal(fullSliceReport.fixtureOnly, false);
  assert.equal(fullSliceReport.dataset?.hash, liveMaterializeReport.source?.datasetHash);
  assert.equal(fullSliceReport.dataset?.itemCount, 500);
  assert.equal(fullSliceReport.dataset?.selectedCount, 500);
  assert.equal(fullSliceReport.dataset?.questionTypeCount, 6);
  assert.equal(fullSliceReport.dataset?.selectedQuestionIdsHash, "sha256:702287feda46afbb122e7d61f8fb1530e6b571b8172e248376c4f887d0527f42");
  assert.equal(fullSliceReport.labels?.answerLabelsHash, "sha256:50a91736969984d01a67dfc20daf3f1e62ecfcd658b8f5bafb2513f1e60b6388");
  assert.match(fullSliceReport.dataset?.questionIdPolicy ?? "", /selection=full-dataset/);
  assert.match(fullSliceEvidence, /Selected count: 500/);
  assert.equal(fullRunTarget.claimTier, "run-only");
  assert.equal(fullRunTarget.benchmark?.split, "longmemeval-s-cleaned-full-500-2026-05-25");
  assert.match(fullRunTarget.benchmark?.questionIdPolicy ?? "", /limit=500; sort=question_id-ascending; selection=full-dataset/);
  assert.equal(fullRunTarget.benchmark?.answerLabelsHash, fullSliceReport.labels?.answerLabelsHash);
  assert.equal(fullRunTargetReport.ok, true);
  assert.equal(fullRunTargetReport.publicSliceRunReady, true);
  assert.equal(fullRunTargetReport.targetSummary?.usesQuestionIdPolicy, true);
  assert.equal(fullRunTargetReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(fullMaterializeReport.ok, true);
  assert.equal(fullMaterializeReport.fixtureOnly, false);
  assert.equal(fullMaterializeReport.selection?.selectedCount, 500);
  assert.equal(fullMaterializeReport.selection?.queryCount, 500);
  assert.equal(fullMaterializeReport.selection?.haystackSessionCount, 19195);
  assert.equal(fullMaterializeReport.selection?.expectedResultRefCount, 1896);
  assert.equal(fullMaterializeReport.selection?.answerLabelsHash, fullRunTarget.benchmark?.answerLabelsHash);
  assert.equal(fullMaterializeReport.rawPrivateOutputPathIncluded, false);
  assert.equal(fullMaterializeReport.rawQuestionsIncluded, false);
  assert.equal(fullMaterializeReport.rawAnswersIncluded, false);
  assert.equal(fullMaterializeReport.rawMemoryIncluded, false);
  assert.equal(fullMaterializeReport.selection?.redactionStats?.keyShapedTokenRedactionCount, 4);
  assert.match(fullMaterializeEvidence, /Query count: 500/);
  assert.equal(fullTargetSotaReport.mode, "public-benchmark-sota-ladder");
  assert.equal(fullTargetSotaReport.status, "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE");
  assert.equal(fullTargetSotaReport.fullBenchmarkPolicy?.datasetSlice, "longmemeval-s-cleaned-full-500-2026-05-25");
  assert.equal(fullTargetSotaReport.fullBenchmarkPolicy?.currentAnswerQualityQueryCount, 30);
  assert.equal(fullTargetSotaReport.fullBenchmarkPolicy?.minimumFullQueryCount, 500);
  assert.equal(fullTargetSotaReport.fullBenchmarkPolicy?.fullOrOfficiallyComparableRunPresent, false);
  assert.ok(fullTargetSotaReport.blockers?.includes("missing-full-or-officially-comparable-memory-benchmark-run"));
  assert.equal(fullTargetOperatorPacket.mode, "public-benchmark-sota-operator-packet");
  assert.equal(fullTargetOperatorPacket.target?.path, "reviews/overnight-20260522/public-longmemeval-full-run-target.json");
  assert.equal(fullTargetOperatorPacket.currentEvidence?.sotaLadder?.fullBenchmarkPolicy?.datasetSlice, "longmemeval-s-cleaned-full-500-2026-05-25");
  assert.ok(fullTargetOperatorPacket.operatorFlow?.some((item) => item.id === "author-full-longmemeval-target"));
  const fullShardFlow = fullTargetOperatorPacket.operatorFlow?.find((item) => item.id === "full-longmemeval-answer-quality-shards");
  assert.ok(fullShardFlow, "full target operator packet must include sharded answer-quality flow");
  assert.equal(fullShardFlow.shardContract?.expectedFullQueryCount, 500);
  assert.equal(fullShardFlow.shardContract?.combineMode, "query-shard-answer-quality-union");
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("--query-offset")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("--combine-mode shards")));
  {
    const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-provider-key-file-check-"));
    const keyFile = join(tempRoot, "voyage.keys");
    writeFileSync(keyFile, "fixture-voyage-key\n", { mode: 0o600 });
    const keyFilePreflight = spawnSync(
      "node",
      [
        "packages/bench/provider-benchmark-live-preflight.mjs",
        "--target",
        join(reviewDir, "public-longmemeval-expanded-run-target.json"),
        "--strategies",
        "bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage",
      ],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          RECALLWEAVE_PROVIDER_BENCHMARK_CALLS: "1",
          RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA: "1",
          VOYAGE_API_KEYS_FILE: keyFile,
        },
      },
    );
    assert.equal(keyFilePreflight.status, 0, keyFilePreflight.stderr || keyFilePreflight.stdout);
    assert.doesNotMatch(keyFilePreflight.stdout, /fixture-voyage-key/);
    assert.doesNotMatch(keyFilePreflight.stdout, /recallweave-provider-key-file-check/);
    const keyFilePreflightReport = JSON.parse(keyFilePreflight.stdout);
    assert.equal(keyFilePreflightReport.status, "READY_FOR_LIVE_PROVIDER_BENCHMARK");
    assert.equal(keyFilePreflightReport.liveRunAllowed, true);
    assert.equal(keyFilePreflightReport.credentialPresence?.voyage?.keyCount, 1);
    assert.deepEqual(keyFilePreflightReport.missingCredentialProviders, []);
    rmSync(tempRoot, { recursive: true, force: true });
  }
  assert.equal(expandedProviderLivePreflightNvidiaReport.ok, true);
  assert.equal(expandedProviderLivePreflightNvidiaReport.mode, "provider-benchmark-live-preflight");
  assert.equal(expandedProviderLivePreflightNvidiaReport.status, "BLOCKED_PROVIDER_ENV");
  assert.equal(expandedProviderLivePreflightNvidiaReport.liveRunAllowed, false);
  assert.equal(expandedProviderLivePreflightNvidiaReport.callsProviderApis, false);
  assert.equal(expandedProviderLivePreflightNvidiaReport.sendsBenchmarkTextToProvider, false);
  assert.equal(expandedProviderLivePreflightNvidiaReport.target?.path, "reviews/overnight-20260522/public-longmemeval-expanded-run-target.json");
  assert.deepEqual(expandedProviderLivePreflightNvidiaReport.requiredProviders, ["nvidia"]);
  assert.deepEqual(expandedProviderLivePreflightNvidiaReport.missingCredentialProviders, ["nvidia"]);
  assert.equal(expandedProviderLivePreflightNvidiaReport.singleProviderArmReady, true);
  assert.deepEqual(expandedProviderLivePreflightNvidiaReport.strategies, ["bm25-lite", "full-hybrid-rerank", "cloud-nvidia-nemotron-1b"]);
  assert.ok(expandedProviderLivePreflightNvidiaReport.blockers?.includes("nvidia-credentials-missing"));
  assert.ok(expandedProviderLivePreflightNvidiaReport.liveCommandTemplate?.some((line) => String(line).includes("NVIDIA_API_KEY=<env-only-nvidia-key>")));
  assert.ok(!expandedProviderLivePreflightNvidiaReport.liveCommandTemplate?.some((line) => String(line).includes("VOYAGE_API_KEY=<env-only-voyage-key>")));
  assert.ok(!expandedProviderLivePreflightNvidiaReport.liveCommandTemplate?.some((line) => String(line).includes("GEMINI_API_KEY=<env-only-gemini-key>")));
  assert.match(expandedProviderLivePreflightNvidiaEvidence, /Provider Benchmark Live Preflight/);
  assert.match(expandedProviderLivePreflightNvidiaEvidence, /cloud-nvidia-nemotron-1b/);
  assert.match(expandedProviderLivePreflightNvidiaEvidence, /NVIDIA_API_KEY=<env-only-nvidia-key>/);
  assert.equal(providerOperatorPacket.ok, true);
  assert.equal(providerOperatorPacket.mode, "provider-benchmark-operator-packet");
  assert.equal(providerOperatorPacket.provider, "voyage");
  assert.equal(providerOperatorPacket.callsProviderApis, false);
  assert.equal(providerOperatorPacket.sendsBenchmarkTextToProvider, false);
  assert.equal(providerOperatorPacket.publicBenchmarkClaimsAllowed, false);
  assert.equal(providerOperatorPacket.preflight?.status, "BLOCKED_PROVIDER_ENV");
  assert.equal(providerOperatorPacket.preflight?.liveRunAllowedNow, false);
  assert.deepEqual(providerOperatorPacket.strategies, ["bm25-lite", "full-hybrid-rerank", "cloud-voyage4-voyage"]);
  assert.equal(providerOperatorPacket.sameDataContract?.bm25ControlRequired, true);
  assert.equal(providerOperatorPacket.sameDataContract?.fullHybridControlRequired, true);
  assert.equal(providerOperatorPacket.sameDataContract?.providerArmRequired, true);
  assert.equal(providerOperatorPacket.sameDataContract?.soloProviderRunsAreSmokeOnly, true);
  assert.ok(providerOperatorPacket.passCriteria?.some((item) => /READY_FOR_LIVE_PROVIDER_BENCHMARK/.test(item)));
  assert.match(providerOperatorPacketMarkdown, /Provider lane: voyage/);
  assert.match(providerOperatorPacketMarkdown, /bm25-lite/);
  assert.match(providerOperatorPacketMarkdown, /full-hybrid-rerank/);
  assert.match(providerOperatorPacketMarkdown, /cloud-voyage4-voyage/);
  assert.match(providerOperatorPacketMarkdown, /publicBenchmarkClaimsAllowed remains false/i);
  assert.match(providerOperatorPacketEvidence, /RecallWeave Provider Benchmark Operator Packet/);
  assert.match(providerOperatorPacketEvidence, /Provider lane: voyage/);
  assert.match(providerOperatorPacketEvidence, /preflight reports READY_FOR_LIVE_PROVIDER_BENCHMARK/i);
  assert.match(providerOperatorPacketEvidence, /result includes bm25-lite, full-hybrid-rerank, and the selected provider arm/i);
  assert.equal(liveAutoresearchReport.ok, true);
  assert.equal(liveAutoresearchReport.fixtureOnly, false);
  assert.equal(liveAutoresearchReport.benchmark, "longmemeval");
  assert.equal(liveAutoresearchReport.metricsOnly, true);
  assert.equal(liveAutoresearchReport.retrievalProxyOnly, true);
  assert.equal(liveAutoresearchReport.memoryBenchAnswerQuality, false);
  assert.equal(liveAutoresearchReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(liveAutoresearchReport.rawQuestionIdsIncluded, false);
  assert.equal(liveAutoresearchReport.rawQuestionsIncluded, false);
  assert.equal(liveAutoresearchReport.rawAnswersIncluded, false);
  assert.equal(liveAutoresearchReport.rawMemoryIncluded, false);
  assert.equal(liveAutoresearchReport.comparisonContract?.bm25ControlPresent, true);
  assert.equal(liveAutoresearchReport.comparisonContract?.hybridFamilyPresent, true);
  assert.equal(liveAutoresearchReport.comparisonContract?.sameDataControlsRequired, true);
  assert.equal(liveAutoresearchReport.input?.querySetHash, liveMaterializeReport.selection?.collectorCompatibleQuerySetHash);
  assert.equal(liveAutoresearchReport.input?.queryCount, 6);
  assert.equal(liveAutoresearchReport.input?.expectedResultRefCount, 18);
  assert.equal(liveAutoresearchReport.input?.haystackSessionCount, 287);
  assert.ok(Number(liveAutoresearchReport.loop?.armCount ?? 0) >= 24);
  assert.equal(liveAutoresearchReport.winner?.strategy, "bm25-lite");
  assert.equal(liveAutoresearchReport.winner?.contextTokenBudget, 800);
  assert.equal(liveAutoresearchReport.winner?.limit, 5);
  assert.equal(liveAutoresearchReport.winner?.metrics?.quality, liveRecallWeaveRun.metrics?.quality);
  assert.equal(liveAutoresearchReport.winner?.metrics?.pAt1, liveRecallWeaveRun.metrics?.pAt1);
  assert.equal(liveAutoresearchReport.winner?.privacyLeakCount, 0);
  assert.equal(liveAutoresearchReport.winner?.redactionFailureCount, 0);
  assert.match(liveAutoresearchEvidence, /Public Benchmark Autoresearch Loop/);
  assert.match(liveAutoresearchEvidence, /Winner: bm25-lite-b800-k5/);
  assert.match(liveAutoresearchReview, /PASS WITH CONCERNS/);
  assert.match(liveAutoresearchReview, /same-data/i);
  assert.match(liveAutoresearchReview, /not MemoryBench answer-quality/i);
  const autoresearchSolo = spawnSync(
    "node",
    ["packages/bench/public-benchmark-autoresearch-loop.mjs", "--fixture", "--strategies", "bm25-lite"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.notEqual(autoresearchSolo.status, 0, "autoresearch benchmark must reject solo runs without explicit smoke labeling");
  const autoresearchSoloSmoke = JSON.parse(
    run("node", ["packages/bench/public-benchmark-autoresearch-loop.mjs", "--fixture", "--strategies", "bm25-lite", "--allow-solo-smoke"]).stdout,
  );
  assert.equal(autoresearchSoloSmoke.comparisonContract?.allowSoloSmoke, true);
  assert.equal(autoresearchSoloSmoke.comparisonContract?.sameDataControlsRequired, false);
  const liveRunTargetStrict = JSON.parse(
    run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", liveRunTargetPath, "--strict-run"]).stdout,
  );
  assert.equal(liveRunTargetStrict.publicSliceRunReady, true);
  const strictRunOnlyComparison = spawnSync("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", liveRunTargetPath, "--strict"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.notEqual(strictRunOnlyComparison.status, 0, "comparison strict mode must reject run-only targets");
  const strictFixture = spawnSync("node", ["packages/bench/public-benchmark-target-check.mjs", "--strict"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.notEqual(strictFixture.status, 0, "strict mode must reject fixture-only targets");

  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-public-target-check-"));
  try {
    const baseTarget = JSON.parse(readFileSync(join(root, "packages/bench/fixtures/public-benchmark-target.fixture.json"), "utf8"));
    const authoredTargetPath = join(tempRoot, "authored-fixture-target.json");
    writeFileSync(authoredTargetPath, authored.stdout);
    const authoredCheck = JSON.parse(run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", authoredTargetPath]).stdout);
    assert.equal(authoredCheck.ok, true);
    assert.equal(authoredCheck.fixtureOnly, true);
    assert.equal(authoredCheck.targetReadyForCanary, false);

    const questionIdsPath = join(tempRoot, "question-ids.txt");
    const labelsPath = join(tempRoot, "labels.json");
    const scorerPath = join(tempRoot, "scorer.js");
    const authoredReadyPath = join(tempRoot, "authored-ready-target.json");
    const authoredRunOnlyPath = join(tempRoot, "authored-run-only-target.json");
    run("node", [
      "packages/bench/public-benchmark-target-author.mjs",
      "--slice-manifest",
      join(root, reviewDir, "public-longmemeval-slice-evidence.json"),
      "--claim-tier",
      "run-only",
      "--judge-model",
      "gpt-4o",
      "--answer-model",
      "gpt-4o",
      "--judge-rule",
      "MemoryBench LongMemEval source-locked judge and scoring contract at commit 118209a746d97d0d85e5a7234267f0b6962857e9",
      "--output",
      authoredRunOnlyPath,
    ]);
    const authoredRunOnly = JSON.parse(
      run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", authoredRunOnlyPath, "--strict-run"]).stdout,
    );
    assert.equal(authoredRunOnly.ok, true);
    assert.equal(authoredRunOnly.fixtureOnly, false);
    assert.equal(authoredRunOnly.publicSliceRunReady, true);
    assert.equal(authoredRunOnly.targetReadyForCanary, false);
    assert.equal(authoredRunOnly.contract?.usesQuestionIdPolicy, true);
    writeFileSync(questionIdsPath, "lme-001\nlme-002\n");
    writeFileSync(labelsPath, "{\"labels\":[\"a\",\"b\"]}\n");
    writeFileSync(scorerPath, "score_v1\n");
    run("node", [
      "packages/bench/public-benchmark-target-author.mjs",
      "--benchmark",
      "longmemeval",
      "--source-url",
      "https://github.com/supermemoryai/memorybench",
      "--dataset-revision",
      "memorybench-main-test-revision",
      "--split",
      "longmemeval-s-canary",
      "--question-ids-file",
      questionIdsPath,
      "--answer-labels-ref",
      "longmemeval-labels-public-test",
      "--answer-labels-file",
      labelsPath,
      "--judge-model",
      "gpt-4o",
      "--answer-model",
      "gpt-4o",
      "--source-lock-note",
      "same public MemoryBench data, labels, judge rule, and scoring script are source-locked for this test target",
      "--judge-rule",
      "exact-source-locked-memorybench-judge-rule",
      "--scoring-script-ref",
      "memorybench-official-scorer-test",
      "--scoring-path",
      scorerPath,
      "--reported-source-name",
      "supermemory-readme-reported-row",
      "--reported-source-url",
      "https://github.com/supermemoryai/supermemory",
      "--reported-metric-name",
      "quality",
      "--reported-score",
      "0.816",
      "--reported-caveat",
      "source-lock-required-before-public-claim",
      "--output",
      authoredReadyPath,
    ]);
    const authoredReady = JSON.parse(
      run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", authoredReadyPath, "--strict"]).stdout,
    );
    assert.equal(authoredReady.ok, true);
    assert.equal(authoredReady.fixtureOnly, false);
    assert.equal(authoredReady.targetReadyForCanary, true);

    const privateQuestionIdsPath = join(tempRoot, "private-question-ids.txt");
    const rejectedPrivatePath = join(tempRoot, "rejected-private-target.json");
    writeFileSync(privateQuestionIdsPath, "/tmp/private-agent-source\n");
    const privatePathAttempt = spawnSync(
      "node",
      [
        "packages/bench/public-benchmark-target-author.mjs",
        "--benchmark",
        "longmemeval",
        "--source-url",
        "https://github.com/supermemoryai/memorybench",
        "--dataset-revision",
        "memorybench-main-test-revision",
        "--split",
        "longmemeval-s-canary",
        "--question-ids-file",
        privateQuestionIdsPath,
        "--answer-labels-ref",
        "longmemeval-labels-public-test",
        "--answer-labels-file",
        labelsPath,
        "--judge-model",
        "gpt-4o",
        "--answer-model",
        "gpt-4o",
        "--source-lock-note",
        "same data attestation",
        "--judge-rule",
        "exact-source-locked-memorybench-judge-rule",
        "--scoring-script-ref",
        "memorybench-official-scorer-test",
        "--scoring-path",
        scorerPath,
        "--reported-source-name",
        "supermemory-readme-reported-row",
        "--reported-source-url",
        "https://github.com/supermemoryai/supermemory",
        "--reported-metric-name",
        "quality",
        "--reported-score",
        "0.816",
        "--reported-caveat",
        "source-lock-required-before-public-claim",
        "--output",
        rejectedPrivatePath,
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.notEqual(privatePathAttempt.status, 0, "author must reject private paths in public question ids");

    baseTarget.fixtureOnly = false;
    baseTarget.claimTier = "canary-trending-win";
    baseTarget.sourceLock = {
      authorTool: "benchmark:public-target:author",
      checkedAt: "2026-05-23",
      sameDataAttestation: "same public benchmark data, labels, judge rule, and scoring script are source-locked for this test target",
    };
    const readyTargetPath = join(tempRoot, "ready-target.json");
    writeFileSync(readyTargetPath, JSON.stringify(baseTarget, null, 2));
    const readyTarget = JSON.parse(
      run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", readyTargetPath, "--strict"]).stdout,
    );
    assert.equal(readyTarget.ok, true);
    assert.equal(readyTarget.fixtureOnly, false);
    assert.equal(readyTarget.targetReadyForCanary, true);
    assert.equal(readyTarget.contract?.claimTier, "canary-trend");
    assert.equal(readyTarget.contract?.sourceLockReady, true);

    const missingSourceLockTarget = structuredClone(baseTarget);
    delete missingSourceLockTarget.sourceLock;
    const missingSourceLockPath = join(tempRoot, "missing-source-lock-target.json");
    writeFileSync(missingSourceLockPath, JSON.stringify(missingSourceLockTarget, null, 2));
    const missingSourceLock = JSON.parse(run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", missingSourceLockPath]).stdout);
    assert.equal(missingSourceLock.ok, false);
    assert.equal(missingSourceLock.targetReadyForCanary, false);
    assert.ok(missingSourceLock.failedChecks.includes("source-lock-attestation"));

    const publicBenchmarkTarget = structuredClone(baseTarget);
    publicBenchmarkTarget.claimTier = "public-benchmark";
    const publicBenchmarkPath = join(tempRoot, "public-benchmark-target.json");
    writeFileSync(publicBenchmarkPath, JSON.stringify(publicBenchmarkTarget, null, 2));
    const publicBenchmark = JSON.parse(run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", publicBenchmarkPath]).stdout);
    assert.equal(publicBenchmark.ok, true);
    assert.equal(publicBenchmark.targetReadyForCanary, false);

    const componentTarget = structuredClone(baseTarget);
    componentTarget.benchmarkType = "component";
    componentTarget.benchmark.family = "mteb";
    const componentPath = join(tempRoot, "component-target.json");
    writeFileSync(componentPath, JSON.stringify(componentTarget, null, 2));
    const component = JSON.parse(run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", componentPath]).stdout);
    assert.equal(component.ok, false);
    assert.equal(component.targetReadyForCanary, false);
    assert.ok(component.failedChecks.includes("component-benchmark-not-memory-claim"));

    const placeholderTarget = structuredClone(baseTarget);
    placeholderTarget.benchmark.answerLabelsHash = "todo";
    placeholderTarget.benchmark.scoringCodeHash = "todo";
    delete placeholderTarget.benchmark.judgeModel;
    const placeholderPath = join(tempRoot, "placeholder-target.json");
    writeFileSync(placeholderPath, JSON.stringify(placeholderTarget, null, 2));
    const placeholder = JSON.parse(run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", placeholderPath]).stdout);
    assert.equal(placeholder.ok, false);
    assert.equal(placeholder.targetReadyForCanary, false);
    assert.ok(placeholder.failedChecks.includes("same-data-fields"));

    const modelMismatchTarget = structuredClone(baseTarget);
    modelMismatchTarget.reportedTarget.judgeModel = "different-judge-model";
    modelMismatchTarget.reportedTarget.answerModel = "different-answer-model";
    const modelMismatchPath = join(tempRoot, "model-mismatch-target.json");
    writeFileSync(modelMismatchPath, JSON.stringify(modelMismatchTarget, null, 2));
    const modelMismatch = JSON.parse(run("node", ["packages/bench/public-benchmark-target-check.mjs", "--target", modelMismatchPath]).stdout);
    assert.equal(modelMismatch.ok, false);
    assert.equal(modelMismatch.targetReadyForCanary, false);
    assert.ok(modelMismatch.failedChecks.includes("same-judge-model"));
    assert.ok(modelMismatch.failedChecks.includes("same-answer-model"));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  assert.doesNotMatch(result.stdout, secretPattern);
  assert.doesNotMatch(authored.stdout, secretPattern);
  assert.doesNotMatch(markdown, secretPattern);
  assert.doesNotMatch(authoredMarkdown, secretPattern);
  assert.doesNotMatch(evidence, secretPattern);
  assert.doesNotMatch(JSON.stringify(liveRunTargetReport), secretPattern);
  assert.doesNotMatch(liveRunTargetEvidence, secretPattern);
  assert.doesNotMatch(liveRunTargetReview, secretPattern);
  assert.doesNotMatch(JSON.stringify(materializeFixture), secretPattern);
  assert.doesNotMatch(materializeMarkdown, secretPattern);
  assert.doesNotMatch(JSON.stringify(strategyFixture), secretPattern);
  assert.doesNotMatch(strategyMarkdown, secretPattern);
  assert.doesNotMatch(JSON.stringify(hybridFixture), secretPattern);
  assert.doesNotMatch(hybridMarkdown, secretPattern);
  assert.doesNotMatch(JSON.stringify(providerFixture), secretPattern);
  assert.doesNotMatch(providerMarkdown, secretPattern);
  assert.doesNotMatch(JSON.stringify(autoresearchFixture), secretPattern);
  assert.doesNotMatch(autoresearchMarkdown, secretPattern);
  assert.doesNotMatch(JSON.stringify(liveMaterializeReport), secretPattern);
  assert.doesNotMatch(liveMaterializeEvidence, secretPattern);
  assert.doesNotMatch(JSON.stringify(liveRecallWeaveRun), secretPattern);
  assert.doesNotMatch(liveMaterializeReview, secretPattern);
  assert.doesNotMatch(JSON.stringify(liveStrategyReport), secretPattern);
  assert.doesNotMatch(liveStrategyEvidence, secretPattern);
  assert.doesNotMatch(liveStrategyReview, secretPattern);
  assert.doesNotMatch(JSON.stringify(liveHybridReport), secretPattern);
  assert.doesNotMatch(liveHybridEvidence, secretPattern);
  assert.doesNotMatch(liveHybridReview, secretPattern);
  assert.doesNotMatch(JSON.stringify(providerGateFixtureReport), secretPattern);
  assert.doesNotMatch(providerGateFixtureEvidence, secretPattern);
  assert.doesNotMatch(JSON.stringify(liveAutoresearchReport), secretPattern);
  assert.doesNotMatch(JSON.stringify(expandedAutoresearchReport), secretPattern);
  assert.doesNotMatch(liveAutoresearchEvidence, secretPattern);
  assert.doesNotMatch(liveAutoresearchReview, secretPattern);
  assert.doesNotMatch(result.stdout, privatePathPattern);
  assert.doesNotMatch(authored.stdout, privatePathPattern);
  assert.doesNotMatch(markdown, privatePathPattern);
  assert.doesNotMatch(authoredMarkdown, privatePathPattern);
  assert.doesNotMatch(evidence, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(liveRunTargetReport), privatePathPattern);
  assert.doesNotMatch(liveRunTargetEvidence, privatePathPattern);
  assert.doesNotMatch(liveRunTargetReview, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(materializeFixture), privatePathPattern);
  assert.doesNotMatch(materializeMarkdown, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(strategyFixture), privatePathPattern);
  assert.doesNotMatch(strategyMarkdown, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(hybridFixture), privatePathPattern);
  assert.doesNotMatch(hybridMarkdown, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(providerFixture), privatePathPattern);
  assert.doesNotMatch(providerMarkdown, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(autoresearchFixture), privatePathPattern);
  assert.doesNotMatch(autoresearchMarkdown, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(liveMaterializeReport), privatePathPattern);
  assert.doesNotMatch(liveMaterializeEvidence, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(liveRecallWeaveRun), privatePathPattern);
  assert.doesNotMatch(liveMaterializeReview, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(liveStrategyReport), privatePathPattern);
  assert.doesNotMatch(liveStrategyEvidence, privatePathPattern);
  assert.doesNotMatch(liveStrategyReview, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(liveHybridReport), privatePathPattern);
  assert.doesNotMatch(liveHybridEvidence, privatePathPattern);
  assert.doesNotMatch(liveHybridReview, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(providerGateFixtureReport), privatePathPattern);
  assert.doesNotMatch(providerGateFixtureEvidence, privatePathPattern);
  assert.doesNotMatch(JSON.stringify(liveAutoresearchReport), privatePathPattern);
  assert.doesNotMatch(JSON.stringify(expandedAutoresearchReport), privatePathPattern);
  assert.doesNotMatch(liveAutoresearchEvidence, privatePathPattern);
  assert.doesNotMatch(liveAutoresearchReview, privatePathPattern);
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
    assertNativeMemory(generatedReport.nativeMemory);
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
    assertNativeMemory(intakeReport.nativeMemory);
    const expectedCommit = "65ef223f9def19312e679dc7b13ae3a2fb961daa";
    const commitReportPath = join(tempRoot, "commit-report.json");
    run("node", ["packages/bench/canary-report-from-trace.mjs", "--fixture", "--commit", expectedCommit, "--output", commitReportPath]);
    const commitMatchedIntake = JSON.parse(
      run("node", ["packages/bench/canary-evidence-intake.mjs", "--report", commitReportPath, "--expected-commit", expectedCommit.slice(0, 12)]).stdout,
    );
    const commitMismatchIntake = JSON.parse(
      run("node", ["packages/bench/canary-evidence-intake.mjs", "--report", commitReportPath, "--expected-commit", "deadbeef"]).stdout,
    );
    assert.equal(commitMatchedIntake.sourceControl.commitMatchesExpected, true);
    assert.equal(commitMatchedIntake.canaryPass, true);
    assert.equal(commitMismatchIntake.sourceControl.commitMatchesExpected, false);
    assert.equal(commitMismatchIntake.canaryPass, false);
    assert.ok(commitMismatchIntake.failedChecks.includes("expected-commit"));
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
    assertNativeMemory(diagnosticReport.nativeMemory);
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
    assertNativeMemory(diagnosticIntakeReport.nativeMemory);
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
    assertNativeMemory(diagnosticZipReport.nativeMemory);
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
        native_memory: {
          provider_id: "selfmem_canary",
          slot: "memory.provider",
          default_active: true,
        },
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
    assertNativeMemory(windowedReport.nativeMemory);
    const windowedIntake = run("node", ["packages/bench/canary-evidence-intake.mjs", "--report", windowedReportPath, "--strict-real"]);
    const windowedIntakeReport = JSON.parse(windowedIntake.stdout);
    assert.equal(windowedIntakeReport.canaryPass, true);
    assert.equal(windowedIntakeReport.countsAsRealRolloutEvidence, true);
    assertNativeMemory(windowedIntakeReport.nativeMemory);
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
    assertNativeMemory(report.nativeMemory);
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
  assertNativeMemory(failingReport.nativeMemory);
  assert.ok(failingReport.actions.some((item) => item.check === "store-latency-instrumented" && item.category === "instrumentation"));
  assert.ok(failingReport.actions.some((item) => item.check === "recall-p95" && item.category === "latency"));
  assert.ok(failingReport.actions.some((item) => item.check === "store-p95" && item.category === "instrumentation"));
  assert.equal(failingReport.recollectWindow.needsFreshWindow, true);
  assert.equal(passingReport.canaryPass, true);
  assert.equal(passingReport.fixtureOnly, true);
  assertNativeMemory(passingReport.nativeMemory);
  assert.deepEqual(passingReport.failedChecks, []);
  assert.doesNotMatch(failingResult.stdout, secretPattern);
  assert.doesNotMatch(failingResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
});

check("fresh canary drill passes", () => {
  const hermesResult = run("node", ["packages/bench/canary-drill.mjs", "--host", "hermes"]);
  const openclawMarkdown = run("node", ["packages/bench/canary-drill.mjs", "--host", "openclaw", "--format", "markdown"]);
  const report = JSON.parse(hermesResult.stdout);
  const evidence = readFileSync(join(root, reviewDir, "canary-drill-evidence.md"), "utf8");
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-drill-review.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "strict-real-canary-drill");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.publicSafe, true);
  assert.equal(report.publicLaunchAllowed, false);
  assert.equal(report.fleetRolloutAllowed, false);
  assert.equal(report.host, "hermes");
  assert.equal(report.minimumFreshWindowMinutes, 15);
  assert.equal(report.drillContract.oneAgentOnly, true);
  assert.equal(report.drillContract.requiresLocalWrite, true);
  assert.equal(report.drillContract.requiresExpectedAdapterCommit, true);
  assert.equal(report.drillContract.requiresHostedReadThrough, true);
  assert.equal(report.drillContract.requiresLcmOrCompressionCoverage, true);
  assert.equal(report.drillContract.requiresMetricsOnlyReturn, true);
  assert.ok(report.setupCommands.some((item) => item.id === "dry-run-update"));
  assert.ok(report.setupCommands.some((item) => item.id === "apply-and-mark-window" && /FRESH_WINDOW_START/.test(item.command)));
  assert.ok(report.operatorSteps.some((item) => item.id === "store-public-canary-fact" && /cobalt/.test(item.prompt)));
  assert.ok(report.operatorSteps.some((item) => item.id === "recall-local-canary-fact" && /native memory recall/i.test(item.prompt)));
  assert.ok(report.operatorSteps.some((item) => item.id === "exercise-hosted-read-through" && /result count/i.test(item.prompt)));
  assert.ok(report.operatorSteps.some((item) => item.id === "exercise-lifecycle-compression" && /compression/i.test(item.prompt)));
  assert.ok(report.operatorSteps.some((item) => item.id === "rollback-drill" && /--rollback --dry-run/.test(item.command)));
  assert.ok(report.operatorSteps.some((item) => item.id === "collect-strict-real-evidence" && /--strict-real/.test(item.command) && /--canary-since/.test(item.command) && /--expected-commit <approved-commit>/.test(item.command)));
  assert.ok(report.acceptanceCriteria.some((item) => /report commit matches/i.test(item)));
  assert.ok(report.acceptanceCriteria.some((item) => /hosted read-through is attempted/i.test(item)));
  assert.ok(report.acceptanceCriteria.some((item) => /strict-real intake passes/i.test(item)));
  assert.equal(report.expectedStrictIntakeFields["quality.hybridSearchCovered"], true);
  assert.equal(report.expectedStrictIntakeFields["rollback.tested"], true);
  assert.ok(report.forbidden.includes("raw memories"));
  assert.ok(report.forbidden.includes("provider keys"));
  assert.match(openclawMarkdown.stdout, /RecallWeave Strict-Real Canary Drill \(OpenClaw\)/);
  assert.match(openclawMarkdown.stdout, /store-public-canary-fact/);
  assert.match(openclawMarkdown.stdout, /exercise-hosted-read-through/);
  assert.match(openclawMarkdown.stdout, /Attach Only/);
  assert.match(evidence, /canary:drill/i);
  assert.match(evidence, /strict-real canary drill/i);
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  for (const text of [hermesResult.stdout, openclawMarkdown.stdout, evidence, geminiReview]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  }
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
  assert.equal(report.freshWindow?.expectedAdapterCommit, "<approved-commit>");
  assert.ok(report.commands.some((item) => item.id === "apply-live-container" && /FRESH_WINDOW_START/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "generate-drill" && /canary:drill/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "collect-live-container-after-window" && /--canary-since <fresh-window-start-iso>/.test(item.command) && /--expected-commit <approved-commit>/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "apply-and-collect-live-container" && /--strict-real/.test(item.command) && /--canary-since/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "collect-from-redacted-diagnostic-dir" && /--canary-diagnostic-dir/.test(item.command) && /--canary-since/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "collect-from-redacted-diagnostic-zip" && /--canary-diagnostic-zip/.test(item.command) && /--canary-since/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "package-passing-evidence" && /canary:packet/.test(item.command) && /--strict-real/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "package-passing-evidence" && /--expected-commit <approved-commit>/.test(item.command)));
  assert.ok(report.commands.some((item) => item.id === "package-diagnostic-evidence" && /canary:packet/.test(item.command) && /--diagnosis/.test(item.command)));
  for (const command of report.commands.map((item) => item.command).filter((command) => /canary:(intake|diagnose)/.test(command))) {
    const toolSegment = command.slice(command.indexOf("canary:"));
    assert.match(toolSegment, /--output\s+\/tmp\/recallweave-canary-/);
    assert.doesNotMatch(toolSegment, /\s>\s/, "canary JSON evidence commands must use --output instead of shell redirection");
  }
  assert.ok(report.acceptanceCriteria.includes("countsAsRealRolloutEvidence is true"));
  assert.ok(report.acceptanceCriteria.includes("sourceControl.commitMatchesExpected is true for the approved adapter commit"));
  assert.ok(report.acceptanceCriteria.includes("fixtureOnly is false"));
  assert.ok(report.acceptanceCriteria.includes("adapter.strictCanaryContract is v1"));
  assert.ok(report.acceptanceCriteria.includes("window.durationMinutes is at least 15"));
  assert.ok(report.acceptanceCriteria.includes("instrumentation.missingStoreLatencyCount is 0"));
  assert.ok(report.forbidden.includes("raw memories"));
  assert.ok(report.forbidden.includes("provider keys"));
  assert.match(openclawMarkdown.stdout, /RecallWeave Strict-Real Canary Packet \(OpenClaw\)/);
  assert.match(openclawMarkdown.stdout, /--host openclaw/);
  assert.match(openclawMarkdown.stdout, /fresh-window timestamp/i);
  assert.match(openclawMarkdown.stdout, /canary:drill/);
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
    const mismatchReviewRun = run("node", [
      "packages/bench/canary-evidence-packet-review.mjs",
      "--packet",
      packetPath,
      "--expected-commit",
      "deadbeef",
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
    const mismatchReview = JSON.parse(mismatchReviewRun.stdout);
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
    assertNativeMemory(review.nativeMemory);
    assert.equal(mismatchReview.ok, false);
    assert.equal(mismatchReview.sourceControl.expectedCommit, "deadbeef");
    assert.equal(mismatchReview.sourceControl.commitMatchesExpected, false);
    assert.ok(mismatchReview.failedChecks.includes("expected-commit"));
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

check("fresh returned canary workspace generator passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-returned-workspace-check-"));
  try {
    const workspace = join(tempRoot, "workspace");
    const outputPath = join(tempRoot, "workspace-result.json");
    const scriptRun = run("node", [
      "packages/bench/canary-returned-workspace.mjs",
      "--workspace",
      workspace,
      "--output",
      outputPath,
    ]);
    const requiredRun = spawnSync("node", [
      "packages/bench/canary-returned-workspace.mjs",
      "--workspace",
      join(tempRoot, "required-workspace"),
      "--require-production-canary",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const report = JSON.parse(scriptRun.stdout);
    const outputReport = JSON.parse(readFileSync(outputPath, "utf8"));
    const requiredReport = JSON.parse(requiredRun.stdout);
    const operatorMarkdown = readFileSync(join(workspace, "operator-findings-returned.md"), "utf8");
    const intakeMarkdown = readFileSync(join(workspace, "returned-packet-intake.md"), "utf8");
    const intakeJson = JSON.parse(readFileSync(join(workspace, "returned-packet-intake.json"), "utf8"));
    const evidence = readFileSync(join(root, reviewDir, "canary-returned-workspace-evidence.md"), "utf8");

    assert.equal(report.mode, "canary-returned-workspace");
    assert.equal(report.writesRealFiles, true);
    assert.equal(report.metricsOnly, true);
    assert.equal(report.generatedFixturePacket, true);
    assert.equal(report.countsAsProductionCanaryEvidence, false);
    assert.equal(report.publicLaunchAllowed, false);
    assert.equal(report.fleetRolloutAllowed, false);
    assert.deepEqual(report.workspace.files, [
      "operator-findings-returned.md",
      "returned-packet-intake.md",
      "returned-packet-intake.json",
    ]);
    assert.equal(outputReport.mode, "canary-returned-workspace");
    assert.equal(intakeJson.mode, "canary-returned-packet-intake");
    assert.equal(intakeJson.countsAsProductionCanaryEvidence, false);
    assert.notEqual(requiredRun.status, 0, "required production workspace must fail closed for fixture packets");
    assert.equal(requiredReport.ok, false);
    assert.equal(requiredReport.countsAsProductionCanaryEvidence, false);
    assert.match(operatorMarkdown, /# Operator Findings/);
    assert.match(operatorMarkdown, /not production canary evidence/i);
    assert.match(intakeMarkdown, /# Returned Packet Intake/);
    assert.match(intakeMarkdown, /Close real rollout blocker: no/i);
    assert.match(evidence, /canary:returned-workspace/i);
    assert.match(evidence, /Fixture packets never count as production canary evidence/i);
    for (const text of [scriptRun.stdout, requiredRun.stdout, operatorMarkdown, intakeMarkdown, JSON.stringify(intakeJson), evidence]) {
      assert.doesNotMatch(text, secretPattern);
      assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("fresh returned canary inbox scanner passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-returned-canary-inbox-check-"));
  try {
    const fixturePacketPath = join(tempRoot, "fixture-canary-evidence-packet.zip");
    const handoffPacketPath = join(tempRoot, "recallweave-openclaw-handoff-packet.zip");
    const unknownPacketPath = join(tempRoot, "random-memory-export.zip");
    const badPacketPath = join(tempRoot, "selfmem-bad-return.zip");
    const outputPath = join(tempRoot, "returned-inbox.json");
    writeFileSync(badPacketPath, "not a zip");
    run("node", [
      "packages/bench/canary-evidence-packet.mjs",
      "--output",
      fixturePacketPath,
    ]);
    run("node", [
      "packages/bench/canary-next-agent-packet.mjs",
      "--output",
      handoffPacketPath,
    ]);
    writeUnknownZip(tempRoot, unknownPacketPath);
    const defaultRun = run("node", ["packages/bench/canary-returned-inbox.mjs"]);
    const inboxRun = run("node", [
      "packages/bench/canary-returned-inbox.mjs",
      "--input-root",
      tempRoot,
      "--include-all-zips",
      "--output",
      outputPath,
    ]);
    const requiredRun = spawnSync("node", [
      "packages/bench/canary-returned-inbox.mjs",
      "--input-root",
      tempRoot,
      "--include-all-zips",
      "--require-production-canary",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const defaultReport = JSON.parse(defaultRun.stdout);
    const inboxReport = JSON.parse(inboxRun.stdout);
    const outputReport = JSON.parse(readFileSync(outputPath, "utf8"));
    const requiredReport = JSON.parse(requiredRun.stdout);
    const evidence = readFileSync(join(root, reviewDir, "canary-returned-inbox-evidence.md"), "utf8");
    const geminiReview = readFileSync(join(root, reviewDir, "gemini-canary-returned-inbox-review.md"), "utf8");
    assert.equal(defaultReport.mode, "canary-returned-inbox");
    assert.equal(defaultReport.input.generatedFixture, true);
    assert.equal(defaultReport.counts.returnedEvidencePackets, 1);
    assert.equal(defaultReport.counts.productionEvidencePackets, 0);
    assert.equal(defaultReport.publicLaunchAllowed, false);
    assert.equal(defaultReport.fleetRolloutAllowed, false);
    assert.equal(inboxReport.mode, "canary-returned-inbox");
    assert.equal(inboxReport.counts.returnedEvidencePackets, 1);
    assert.equal(inboxReport.counts.handoffPackets, 1);
    assert.equal(inboxReport.counts.unreadablePackets, 1);
    assert.equal(inboxReport.counts.unknownPackets, 1);
    assert.equal(inboxReport.counts.productionEvidencePackets, 0);
    assert.equal(inboxReport.triage?.metricsOnly, true);
    assert.equal(inboxReport.triage?.labelMode, "hash-redacted");
    assert.equal(inboxReport.triage?.unknown?.count, 1);
    assert.equal(inboxReport.triage?.unreadable?.count, 1);
    assert.match(inboxReport.triage?.unknown?.sampleIds?.[0] ?? "", /^zip-[a-f0-9]{12}$/);
    assert.match(inboxReport.triage?.unreadable?.sampleIds?.[0] ?? "", /^zip-[a-f0-9]{12}$/);
    assert.equal(outputReport.mode, "canary-returned-inbox");
    assert.notEqual(requiredRun.status, 0, "required production canary inbox must fail closed for fixture packets");
    assert.equal(requiredReport.ok, false);
    assert.equal(requiredReport.requireProductionCanary, true);
    assert.match(evidence, /canary:returned-inbox/i);
    assert.match(evidence, /inbox/i);
    assert.match(evidence, /handoff packet/i);
    assert.match(evidence, /require-production-canary/i);
    assert.match(geminiReview, /Verdict:\s*CLEAN/i);
    for (const text of [defaultRun.stdout, inboxRun.stdout, requiredRun.stdout, evidence]) {
      assert.doesNotMatch(text, secretPattern);
      assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
      assert.doesNotMatch(text, /random-memory-export|selfmem-bad-return|recallweave-openclaw-handoff-packet/);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("fresh returned canary inbox watcher passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-returned-canary-watch-check-"));
  try {
    const handoffPacketPath = join(tempRoot, "recallweave-openclaw-handoff-packet.zip");
    const unknownPacketPath = join(tempRoot, "random-memory-export.zip");
    const badPacketPath = join(tempRoot, "selfmem-bad-return.zip");
    const outputPath = join(tempRoot, "returned-watch.json");
    writeFileSync(badPacketPath, "not a zip");
    run("node", [
      "packages/bench/canary-next-agent-packet.mjs",
      "--output",
      handoffPacketPath,
    ]);
    writeUnknownZip(tempRoot, unknownPacketPath);
    const defaultRun = run("node", ["packages/bench/canary-returned-watch.mjs"]);
    const watchRun = run("node", [
      "packages/bench/canary-returned-watch.mjs",
      "--input-root",
      tempRoot,
      "--include-all-zips",
      "--expected-commit",
      "65ef223",
      "--iterations",
      "1",
      "--output",
      outputPath,
    ]);
    const requiredRun = spawnSync("node", [
      "packages/bench/canary-returned-watch.mjs",
      "--input-root",
      tempRoot,
      "--include-all-zips",
      "--require-found",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const defaultReport = JSON.parse(defaultRun.stdout);
    const watchReport = JSON.parse(watchRun.stdout);
    const outputReport = JSON.parse(readFileSync(outputPath, "utf8"));
    const requiredReport = JSON.parse(requiredRun.stdout);
    assert.equal(defaultReport.mode, "canary-returned-watch");
    assert.equal(defaultReport.status, "AWAITING_RETURNED_PRODUCTION_CANARY");
    assert.equal(watchReport.mode, "canary-returned-watch");
    assert.equal(watchReport.status, "AWAITING_RETURNED_PRODUCTION_CANARY");
    assert.equal(watchReport.sourceControl?.expectedCommit, "65ef223");
    assert.equal(watchReport.counts.handoffPackets, 1);
    assert.equal(watchReport.counts.unknownPackets, 1);
    assert.equal(watchReport.counts.unreadablePackets, 1);
    assert.equal(watchReport.counts.productionEvidencePackets, 0);
    assert.equal(watchReport.latestScans?.[0]?.triage?.unknown?.count, 1);
    assert.equal(watchReport.latestScans?.[0]?.triage?.unreadable?.count, 1);
    assert.match(watchReport.latestScans?.[0]?.triage?.unknown?.sampleIds?.[0] ?? "", /^zip-[a-f0-9]{12}$/);
    assert.equal(outputReport.mode, "canary-returned-watch");
    assert.notEqual(requiredRun.status, 0, "watcher must fail closed with --require-found when no production canary exists");
    assert.equal(requiredReport.ok, false);
    assert.equal(requiredReport.requireFound, true);
    for (const text of [defaultRun.stdout, watchRun.stdout, requiredRun.stdout]) {
      assert.doesNotMatch(text, secretPattern);
      assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
      assert.doesNotMatch(text, /random-memory-export|selfmem-bad-return|recallweave-openclaw-handoff-packet/);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

check("fresh returned downloads scanner passes", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "recallweave-returned-downloads-check-"));
  try {
    const handoffPacketPath = join(tempRoot, "recallweave-openclaw-handoff-packet.zip");
    const unknownPacketPath = join(tempRoot, "random-memory-export.zip");
    const badPacketPath = join(tempRoot, "selfmem-bad-return.zip");
    const outputPath = join(tempRoot, "returned-downloads.json");
    const findingsPath = join(tempRoot, "returned-downloads-findings.md");
    writeFileSync(badPacketPath, "not a zip");
    run("node", [
      "packages/bench/canary-next-agent-packet.mjs",
      "--output",
      handoffPacketPath,
    ]);
    writeUnknownZip(tempRoot, unknownPacketPath);
    const noDefaultsRun = run("node", [
      "packages/bench/canary-returned-downloads.mjs",
      "--skip-defaults",
    ]);
    const downloadsRun = run("node", [
      "packages/bench/canary-returned-downloads.mjs",
      "--skip-defaults",
      "--input-root",
      tempRoot,
      "--iterations",
      "1",
      "--output",
      outputPath,
      "--findings-output",
      findingsPath,
    ]);
    const requiredRun = spawnSync("node", [
      "packages/bench/canary-returned-downloads.mjs",
      "--skip-defaults",
      "--input-root",
      tempRoot,
      "--require-found",
    ], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const noDefaultsReport = JSON.parse(noDefaultsRun.stdout);
    const downloadsReport = JSON.parse(downloadsRun.stdout);
    const outputReport = JSON.parse(readFileSync(outputPath, "utf8"));
    const requiredReport = JSON.parse(requiredRun.stdout);
    const findings = readFileSync(findingsPath, "utf8");
    const evidence = readFileSync(join(root, reviewDir, "canary-returned-downloads-evidence.md"), "utf8");
    const currentScan = JSON.parse(readFileSync(join(root, reviewDir, "returned-downloads-current-scan.json"), "utf8"));
    const currentScanFindings = readFileSync(join(root, reviewDir, "returned-downloads-current-scan.md"), "utf8");
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

    assert.equal(noDefaultsReport.mode, "canary-returned-downloads");
    assert.equal(noDefaultsReport.status, "NO_DEFAULT_INBOXES");
    assert.equal(noDefaultsReport.defaultInboxScan, false);
    assert.equal(noDefaultsReport.ok, true);
    assert.equal(downloadsReport.mode, "canary-returned-downloads");
    assert.equal(downloadsReport.status, "AWAITING_RETURNED_PRODUCTION_CANARY");
    assert.equal(downloadsReport.defaultInboxScan, false);
    assert.equal(downloadsReport.metricsOnly, true);
    assert.equal(downloadsReport.counts.handoffPackets, 1);
    assert.equal(downloadsReport.counts.unknownPackets, 1);
    assert.equal(downloadsReport.counts.unreadablePackets, 1);
    assert.equal(downloadsReport.counts.productionEvidencePackets, 0);
    assert.equal(downloadsReport.returnedWatch?.latestScans?.[0]?.triage?.unknown?.count, 1);
    assert.equal(downloadsReport.returnedWatch?.latestScans?.[0]?.triage?.unreadable?.count, 1);
    assert.match(downloadsReport.returnedWatch?.latestScans?.[0]?.triage?.unknown?.sampleIds?.[0] ?? "", /^zip-[a-f0-9]{12}$/);
    assert.equal(downloadsReport.publicLaunchAllowed, false);
    assert.equal(downloadsReport.fleetRolloutAllowed, false);
    assert.equal(outputReport.mode, "canary-returned-downloads");
    assert.match(findings, /Returned Downloads Findings/);
    assert.match(findings, /Production evidence packets: 0/);
    assert.match(findings, /Safe Triage/);
    assert.match(findings, /zip-[a-f0-9]{12}/);
    assert.notEqual(requiredRun.status, 0, "downloads scanner must fail closed with --require-found when no production canary exists");
    assert.equal(requiredReport.ok, false);
    assert.equal(requiredReport.requireFound, true);
    assert.match(packageJson.scripts?.["canary:returned-downloads:strict"] ?? "", /--require-found/);
    assert.match(evidence, /canary:returned-downloads/i);
    assert.match(evidence, /Downloads/);
    assert.match(evidence, /markdown findings/i);
    assert.equal(currentScan.mode, "canary-returned-downloads");
    assert.equal(currentScan.status, "AWAITING_RETURNED_PRODUCTION_CANARY");
    assert.equal(currentScan.metricsOnly, true);
    assert.equal(currentScan.publicLaunchAllowed, false);
    assert.equal(currentScan.fleetRolloutAllowed, false);
    assert.equal(currentScan.counts?.productionEvidencePackets, 0);
    assert.equal(Number(currentScan.counts?.handoffPackets ?? 0), 1);
    assert.ok(Number(currentScan.counts?.diagnosticBundles ?? 0) >= 1);
    assert.match(currentScanFindings, /Returned Downloads Findings/);
    assert.match(currentScanFindings, /Production evidence packets: 0/);
    assert.match(currentScanFindings, /Handoff packets: 1/);
    assert.match(currentScanFindings, /No production canary evidence was found/);
    for (const text of [noDefaultsRun.stdout, downloadsRun.stdout, requiredRun.stdout, findings, evidence, JSON.stringify(currentScan), currentScanFindings]) {
      assert.doesNotMatch(text, secretPattern);
      assert.doesNotMatch(text, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
      assert.doesNotMatch(text, /random-memory-export|selfmem-bad-return|recallweave-openclaw-handoff-packet/);
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
  assert.ok(report.commandPlan.some((item) => item.id === "run-deterministic-drill" && /canary:drill/.test(item.command)));
  assert.ok(report.commandPlan.some((item) => item.id === "collect-live-window" && /--canary-packet-output/.test(item.command) && /--expected-commit <approved-commit>/.test(item.command)));
  assert.ok(report.commandPlan.some((item) => item.id === "diagnose-if-failed"));
  assert.ok(report.commandPlan.some((item) => item.id === "package-passing-evidence" && /--expected-commit <approved-commit>/.test(item.command)));
  assert.equal(report.nativeDefaultContract.required, true);
  assert.equal(report.nativeDefaultContract.shadowOnlyAllowed, false);
  assert.equal(report.nativeDefaultContract.hostedWriteBackAllowed, false);
  assert.ok(report.acceptanceCriteria.some((item) => /native\/default memory lane/i.test(item)));
  assert.ok(report.acceptanceCriteria.some((item) => /shadow-only/i.test(item)));
  assert.ok(report.acceptanceCriteria.some((item) => /write-back is disabled/i.test(item)));
  assert.ok(report.acceptanceCriteria.some((item) => /deterministic drill/i.test(item)));
  for (const command of report.commandPlan.map((item) => item.command).filter((command) => /canary:(intake|diagnose)/.test(command))) {
    const toolSegment = command.slice(command.indexOf("canary:"));
    assert.match(toolSegment, /--output\s+\/tmp\/recallweave-canary-/);
    assert.doesNotMatch(toolSegment, /\s>\s/, "next-agent JSON evidence commands must use --output instead of shell redirection");
  }
  assert.match(markdownRun.stdout, /RecallWeave Next Agent Canary Plan/);
  assert.match(markdownRun.stdout, /Native\/Default Memory Lane/);
  assert.match(markdownRun.stdout, /shadow-only or optional sidecar/i);
  assert.match(markdownRun.stdout, /FRESH_WINDOW_START/);
  assert.match(evidence, /canary:next-agent/i);
  assert.match(evidence, /one-agent/i);
  assert.match(realPlanEvidence, /READY_FOR_ONE_AGENT_FRESH_CANARY/);
  assert.match(realPlanEvidence, /Host:\s*`?openclaw`?/i);
  assert.match(realPlanEvidence, /adapter-contract/);
  assert.match(realPlanEvidence, /store-latency-instrumented/);
  assert.match(realPlanEvidence, /Recall p95:\s*1567\.346 ms/i);
  assert.match(realPlanEvidence, /FRESH_WINDOW_START/);
  assert.match(realPlanEvidence, /run-deterministic-drill/);
  assert.match(realPlanEvidence, /canary:drill/);
  assert.match(realPlanEvidence, /--strict-real/);
  assert.match(realPlanEvidence, /--canary-intake-output\s+\/tmp\/recallweave-canary-intake\.json/);
  assert.match(realPlanEvidence, /--canary-packet-output\s+\/tmp\/recallweave-canary-evidence-packet\.zip/);
  assert.match(realPlanEvidence, /native\/default memory provider or OpenClaw memory slot/i);
  assert.match(realPlanEvidence, /OpenClaw plugins\.slots\.memory is selfmem_canary/i);
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
  const expectedCommitPacketPath = join(tempRoot, "next-agent-handoff-expected-commit.zip");
  const allowFailedPacketPath = join(tempRoot, "next-agent-handoff-allow-failed.zip");
  const noCandidateRoot = join(tempRoot, "empty-diagnostics");
  const noCandidatePacketPath = join(tempRoot, "no-candidate.zip");
  const requireReadyPacketPath = join(tempRoot, "fixture-should-not-pass.zip");
  mkdirSync(noCandidateRoot, { recursive: true });
  const packetRun = run("node", ["packages/bench/canary-next-agent-packet.mjs", "--output", packetPath]);
  const expectedCommit = "0123456789abcdef0123456789abcdef01234567";
  const expectedCommitPacketRun = run("node", [
    "packages/bench/canary-next-agent-packet.mjs",
    "--expected-commit",
    expectedCommit,
    "--output",
    expectedCommitPacketPath,
  ]);
  const allowFailedPacketRun = run("node", [
    "packages/bench/canary-next-agent-packet.mjs",
    "--input-root",
    "packages/bench/fixtures/canary-diagnostic-export.fixture",
    "--allow-failed-inputs",
    "--output",
    allowFailedPacketPath,
  ]);
  const requireReadyFixtureRun = spawnSync(
    "node",
    ["packages/bench/canary-next-agent-packet.mjs", "--require-ready", "--output", requireReadyPacketPath],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const noCandidateRun = spawnSync(
    "node",
    [
      "packages/bench/canary-next-agent-packet.mjs",
      "--input-root",
      noCandidateRoot,
      "--allow-failed-inputs",
      "--output",
      noCandidatePacketPath,
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const report = JSON.parse(packetRun.stdout);
  const allowFailedReport = JSON.parse(allowFailedPacketRun.stdout);
  const requireReadyFixtureReport = JSON.parse(requireReadyFixtureRun.stdout);
  const noCandidateReport = JSON.parse(noCandidateRun.stdout);
  const entries = run("unzip", ["-Z1", packetPath]).stdout.split(/\r?\n/).filter(Boolean).sort();
  const manifest = JSON.parse(run("unzip", ["-p", packetPath, "manifest.json"]).stdout);
  const expectedCommitManifest = JSON.parse(run("unzip", ["-p", expectedCommitPacketPath, "manifest.json"]).stdout);
  const expectedCommitReadme = run("unzip", ["-p", expectedCommitPacketPath, "README.md"]).stdout;
  const allowFailedManifest = JSON.parse(run("unzip", ["-p", allowFailedPacketPath, "manifest.json"]).stdout);
  const allowFailedPlan = JSON.parse(run("unzip", ["-p", allowFailedPacketPath, "next-agent-plan.json"]).stdout);
  const readme = run("unzip", ["-p", packetPath, "README.md"]).stdout;
  const markdown = run("unzip", ["-p", packetPath, "next-agent-plan.md"]).stdout;
  const operator = run("unzip", ["-p", packetPath, "strict-real-operator-packet.md"]).stdout;
  const drill = run("unzip", ["-p", packetPath, "strict-real-canary-drill.md"]).stdout;
  const currentHead = run("git", ["rev-parse", "HEAD"]).stdout.trim();
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
  assert.equal(allowFailedReport.ok, true);
  assert.equal(allowFailedReport.mode, "canary-next-agent-handoff-packet");
  assert.equal(allowFailedManifest.batch.allowFailedInputs, true);
  assert.equal(allowFailedPlan.batch.allowFailedInputs, true);
  assert.notEqual(requireReadyFixtureRun.status, 0);
  assert.equal(requireReadyFixtureReport.ok, false);
  assert.equal(requireReadyFixtureReport.requireReadyPassed, false);
  assert.equal(requireReadyFixtureReport.readyForLiveHandoff, false);
  assert.match(requireReadyFixtureReport.reason, /--require-ready needs READY_FOR_ONE_AGENT_FRESH_CANARY/);
  assert.equal(existsSync(requireReadyPacketPath), false);
  assert.notEqual(noCandidateRun.status, 0);
  assert.equal(noCandidateReport.ok, false);
  assert.equal(noCandidateReport.mode, "canary-next-agent-handoff-packet");
  assert.equal(noCandidateReport.packetCreated, false);
  assert.equal(noCandidateReport.writesRealFiles, false);
  assert.equal(noCandidateReport.publicLaunchAllowed, false);
  assert.equal(noCandidateReport.fleetRolloutAllowed, false);
  assert.equal(noCandidateReport.blockerPreserved, true);
  assert.match(noCandidateReport.reason, /No parsed canary candidate/);
  assert.equal(existsSync(noCandidatePacketPath), false);
  assert.doesNotMatch(`${noCandidateRun.stdout}\n${noCandidateRun.stderr}`, /AssertionError|triggerUncaughtException|node:internal/);
  assert.deepEqual(entries, [
    "README.md",
    "manifest.json",
    "next-agent-plan.json",
    "next-agent-plan.md",
    "strict-real-canary-drill.md",
    "strict-real-operator-packet.md",
  ]);
  assert.equal(manifest.mode, "canary-next-agent-handoff-packet");
  assert.equal(manifest.publicSafe, true);
  assert.equal(manifest.metricsOnly, true);
  assert.equal(manifest.publicLaunchAllowed, false);
  assert.equal(manifest.fleetRolloutAllowed, false);
  assert.equal(manifest.sourceControl.headSha, currentHead);
  assert.equal(manifest.sourceControl.approvedAdapterCommit, currentHead);
  assert.equal(manifest.sourceControl.expectedReportCommit, currentHead);
  assert.equal(manifest.sourceControl.expectedCommitProvided, false);
  assert.equal(manifest.sourceControl.commitRequiredForProductionCanary, true);
  assert.equal(manifest.nativeDefaultContract.required, true);
  assert.equal(manifest.nativeDefaultContract.shadowOnlyAllowed, false);
  assert.equal(manifest.nativeDefaultContract.hostedWriteBackAllowed, false);
  assert.match(manifest.nativeDefaultContract.runtimeIdMeaning, /native memory provider or memory slot/i);
  assert.equal(expectedCommitManifest.sourceControl.headSha, currentHead);
  assert.equal(expectedCommitManifest.sourceControl.approvedAdapterCommit, expectedCommit);
  assert.equal(expectedCommitManifest.sourceControl.expectedReportCommit, expectedCommit);
  assert.equal(expectedCommitManifest.sourceControl.expectedCommitProvided, true);
  assert.equal(expectedCommitManifest.sourceControl.commitRequiredForProductionCanary, true);
  assert.match(expectedCommitManifest.freshWindowContract.returnedPacketIntakeCommand, new RegExp(`--expected-commit ${expectedCommit}`));
  assert.match(expectedCommitPacketRun.stdout, new RegExp(`"expectedReportCommit": "${expectedCommit}"`));
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
  assert.match(manifest.freshWindowContract.returnedPacketIntakeCommand, new RegExp(`--expected-commit ${currentHead}`));
  assert.ok(manifest.returnChecklist.some((item) => /FRESH_WINDOW_START/.test(item)));
  assert.ok(manifest.returnChecklist.some((item) => item.includes(currentHead)));
  assert.ok(manifest.returnChecklist.some((item) => /strict-real-canary-drill\.md/.test(item)));
  assert.ok(manifest.returnChecklist.some((item) => /metrics-only/.test(item)));
  assert.ok(manifest.returnChecklist.some((item) => /native\/default memory provider or memory slot/.test(item)));
  assert.ok(manifest.returnChecklist.some((item) => /shadow-only/.test(item)));
  assert.ok(manifest.returnChecklist.some((item) => /hosted Supermemory read-through\/history only/.test(item)));
  assert.match(readme, /one selected agent operator/i);
  assert.match(readme, /Canary means a bounded validation window/i);
  assert.match(readme, /native\/default memory provider or memory slot/i);
  assert.match(readme, /not permission to keep RecallWeave shadow-only/i);
  assert.match(readme, /Hosted Supermemory is read-through\/history only/i);
  assert.match(readme, /Native\/default memory contract/i);
  assert.match(readme, /deterministic drill/i);
  assert.match(readme, /Fresh-window contract/i);
  assert.match(readme, new RegExp(`Packet generated from controller commit: ${currentHead}`));
  assert.match(readme, new RegExp(`Approved adapter commit: ${currentHead}`));
  assert.match(readme, new RegExp(`Expected canary report commit: ${currentHead}`));
  assert.match(expectedCommitReadme, new RegExp(`Packet generated from controller commit: ${currentHead}`));
  assert.match(expectedCommitReadme, new RegExp(`Approved adapter commit: ${expectedCommit}`));
  assert.match(expectedCommitReadme, new RegExp(`Expected canary report commit: ${expectedCommit}`));
  assert.match(expectedCommitReadme, /regenerate this handoff packet with that commit first/i);
  assert.match(readme, /Ready for live handoff: no/i);
  assert.match(readme, /Do not attach raw memories/i);
  assert.match(markdown, /RecallWeave Next Agent Canary Plan/);
  assert.match(markdown, /Native\/Default Memory Lane/);
  assert.match(markdown, /OpenClaw plugins\.slots\.memory is selfmem_canary|Hermes active memory\.provider is selfmem_canary/);
  assert.match(markdown, /New writes during this canary must land locally in RecallWeave\/selfmem/i);
  assert.match(markdown, /FRESH_WINDOW_START/);
  assert.match(operator, /RecallWeave Strict-Real Canary Packet/);
  assert.match(operator, /canary:intake/);
  assert.match(drill, /RecallWeave Strict-Real Canary Drill/);
  assert.match(drill, /exercise-hosted-read-through/);
  assert.match(drill, /store-public-canary-fact/);
  assert.match(evidence, /canary:next-agent-packet/i);
  assert.match(evidence, /single public-safe zip/i);
  assert.match(evidence, /--allow-failed-inputs/i);
  assert.match(geminiReview, /Verdict:\s*CLEAN/i);
  for (const text of [packetRun.stdout, expectedCommitPacketRun.stdout, allowFailedPacketRun.stdout, requireReadyFixtureRun.stdout, requireReadyFixtureRun.stderr, noCandidateRun.stdout, noCandidateRun.stderr, readme, expectedCommitReadme, markdown, operator, drill, evidence]) {
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
  const canaryBlocker = report.blockers.find((item) => item.id === "fresh-real-container-canary-not-current");
  assert.equal(report.blockers.some((item) => item.id === "hosted-supermemory-baseline-not-current"), false);
  assert.equal(report.checks.hostedBaselineLiveBudgetedRun.status, "READY_FOR_BASELINE_REVIEW");
  assert.equal(report.checks.hostedBaselineLiveBudgetedRun.callsHostedProvider, true);
  assert.equal(report.checks.hostedBaselineLiveBudgetedRun.recallWeaveWin, true);
  assert.equal(report.checks.hostedBaselineLiveBudgetedRun.reviewerApprovalCount, 0);
  assert.equal(report.checks.hostedBaselineLiveBudgetedRun.recallWeaveContextTokensAvg, 1600);
  assert.equal(report.checks.hostedBaselineLiveBudgetedRun.contextBudget.applied, true);
  assert.equal(report.checks.hostedBaselineLiveBudgetedRun.contextBudget.tokenBudget, 1600);
  assert.ok(report.checks.hostedBaselineLiveBudgetedRun.failedChecks.includes("two-reviewer-approvals"));
  assert.equal(report.checks.budgetedBaselineReviewerIntake.publicBenchmarkApprovalReady, true);
  assert.equal(report.checks.budgetedBaselineReviewerIntake.reviewerApprovalCount, 2);
  assert.equal(report.checks.budgetedBaselineReviewerIntake.independentReviewerCount, 2);
  assert.deepEqual(report.checks.budgetedBaselineReviewerIntake.failedChecks, []);
  assert.equal(report.checks.budgetedBaselineReviewedComparison.countsAsComparisonEvidence, true);
  assert.equal(report.checks.budgetedBaselineReviewedComparison.publicBenchmarkClaimsAllowed, true);
  assert.equal(report.checks.budgetedBaselineReviewedComparison.reviewerApprovalCount, 2);
  assert.deepEqual(report.checks.budgetedBaselineReviewedComparison.failedChecks, []);
  assert.equal(report.checks.budgetedBaselineReviewedPacketReview.countsAsPublicBenchmarkEvidence, true);
  assert.equal(report.checks.budgetedBaselineReviewedPacketReview.publicBenchmarkClaimsAllowed, true);
  assert.equal(report.checks.budgetedBaselineReviewedPacketReview.publicLaunchAllowed, false);
  assert.equal(report.checks.budgetedBaselineReviewedNextRun.readyForOwnerReview, true);
  assert.equal(report.checks.budgetedBaselineReviewedNextRun.requireReadyPassed, true);
  assert.equal(report.checks.budgetedBaselineReviewedNextRun.status, "READY_FOR_OWNER_REVIEW");
  assert.equal(report.checks.budgetedBaselineReviewedNextRun.publicLaunchAllowed, false);
  assert.ok(report.manualCommands.some((item) => /baseline:select-container/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:author-queryset/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:mirror-hosted/.test(item) && /--output-dir/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:source-match/.test(item) && /--preserve-ids/.test(item) && /--strict/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:source-align/.test(item) && /--strict/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:run/.test(item) && /recallweave-hosted-local-mirror/.test(item) && /--preserve-ids/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:source-gap/.test(item) && /--output/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:run/.test(item) && /--reviewed-queryset/.test(item)));
  assert.ok(report.manualCommands.some((item) => /baseline:next-run/.test(item) && /--require-ready/.test(item)));
  const approvedAdapterCommit =
    report.approvedRuntimeCanaryBaseline?.expectedReportCommit ?? report.approvedRuntimeCanaryBaseline?.headSha ?? "";
  assert.match(approvedAdapterCommit, /^[a-f0-9]{40}$/);
  assert.match(report.latestVerifiedRepositoryHead?.headSha ?? "", /^[a-f0-9]{40}$/);
  assert.notEqual(report.latestVerifiedRepositoryHead?.headSha, approvedAdapterCommit);
  assert.match(canaryBlocker.nextAction, /postwatch OpenClaw next-agent handoff packet/);
  assert.match(canaryBlocker.nextAction, /fresh 15-minute runtime window/);
  assert.match(canaryBlocker.nextAction, new RegExp(`canary:returned-(?:inbox|packet).*--require-production-canary.*--expected-commit ${approvedAdapterCommit}`));
  assert.equal(report.checks.realDiagnosticsPostwatch.returnedWatchStatus, "AWAITING_RETURNED_PRODUCTION_CANARY");
  assert.equal(report.checks.realDiagnosticsPostwatch.productionEvidencePackets, 0);
  assert.equal(report.checks.realDiagnosticsPostwatch.diagnosticInputCount, 9);
  assert.equal(report.checks.realDiagnosticsPostwatch.parsedInputCount, 8);
  assert.equal(report.checks.realDiagnosticsPostwatch.strictRealPassCount, 0);
  assert.equal(report.checks.realDiagnosticsPostwatch.selectedHost, "openclaw");
  assert.deepEqual(report.checks.realDiagnosticsPostwatch.selectedFailedChecks, [
    "adapter-contract",
    "store-latency-instrumented",
    "store-p95",
  ]);
  assert.equal(report.checks.realDiagnosticsPostwatch.oneAgentCanaryAllowed, true);
  assert.equal(report.checks.realDiagnosticsPostwatch.status, "READY_FOR_ONE_AGENT_FRESH_CANARY");
  assert.equal(report.checks.realDiagnosticsPostwatch.publicLaunchAllowed, false);
  assert.ok(report.manualCommands.some((item) => /canary:next-agent-packet/.test(item) && /--allow-failed-inputs/.test(item) && /--require-ready/.test(item) && item.includes(approvedAdapterCommit)));
  assert.ok(report.manualCommands.some((item) => /canary:drill/.test(item) && /--format markdown/.test(item)));
  assert.ok(report.manualCommands.some((item) => /canary:returned-inbox/.test(item) && /--require-production-canary/.test(item) && item.includes(approvedAdapterCommit)));
  assert.ok(report.manualCommands.some((item) => /canary:returned-packet/.test(item) && /--require-production-canary/.test(item) && item.includes(approvedAdapterCommit)));
});

check("fresh hosted baseline preflight passes", () => {
  const collectorTmp = mkdtempSync(join(tmpdir(), "recallweave-hosted-baseline-"));
  const querySetReportPath = join(collectorTmp, "queryset-report.json");
  const sourceMatchReportPath = join(collectorTmp, "baseline-source-match.json");
  const sourceAlignmentReportPath = join(collectorTmp, "baseline-source-alignment.json");
  const sourceGapReportPath = join(collectorTmp, "baseline-source-gap.json");
  const discoveryResultPath = join(collectorTmp, "hosted-baseline-discovery.json");
  const discoveryPrivateMapPath = join(collectorTmp, "hosted-baseline-container-map.private.jsonl");
  const selectedContainerEnvPath = join(collectorTmp, "hosted-baseline.private.env");
  const selectedContainerReportPath = join(collectorTmp, "hosted-baseline-container-select.json");
  const selectedContainerInsideRepoPath = join(root, ".tmp-hosted-baseline.private.env");
  const authoredQuerySetPath = join(collectorTmp, "hosted-baseline-queryset.private.json");
  const authoredQuerySetReportPath = join(collectorTmp, "hosted-baseline-queryset-author-report.json");
  const authoredQuerySetInspectPath = join(collectorTmp, "hosted-baseline-authored-queryset-inspect.json");
  const authoredQuerySetInsideRepoPath = join(root, ".tmp-hosted-baseline-queryset.private.json");
  const hostedMirrorDir = join(collectorTmp, "hosted-baseline-local-mirror");
  const hostedMirrorReportPath = join(collectorTmp, "hosted-baseline-local-mirror.json");
  const hostedMirrorSourceMatchPath = join(collectorTmp, "hosted-mirror-source-match.json");
  const hostedMirrorSourceAlignmentPath = join(collectorTmp, "hosted-mirror-source-alignment.json");
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
  const bloatedRecallWeavePath = join(collectorTmp, "bloated-recallweave-live.json");
  const missingCounterpartRunPath = join(collectorTmp, "missing-counterpart-run.json");
  const missingMetricPath = join(collectorTmp, "missing-metric.json");
  const missingQuerySetEvidencePath = join(collectorTmp, "missing-query-set-evidence.json");
  const unlabeledQuerySetPath = join(collectorTmp, "unlabeled-queryset.json");
  const privatePathSourceMatchQuerySetPath = join(collectorTmp, "private-path-source-match-queryset.json");
  const privatePathSourceMatchMemoriesPath = join(collectorTmp, "private-path-source-match-memories.jsonl");
  const privatePathSourceMatchReportPath = join(collectorTmp, "private-path-source-match.json");
  const missingSourceMatchQuerySetPath = join(collectorTmp, "missing-source-match-queryset.json");
  const missingSourceAlignmentReportPath = join(collectorTmp, "missing-source-alignment.json");
  const missingSourceGapReportPath = join(collectorTmp, "missing-source-gap.json");
  const baselinePacketPath = join(collectorTmp, "baseline-evidence-packet.zip");
  const baselineReviewerApprovalReportPath = join(collectorTmp, "baseline-reviewer-approval-template.json");
  const baselineOpenAiReviewerDryRunPath = join(collectorTmp, "baseline-openai-compatible-reviewer-dry-run.json");
  const baselineOpenAiReviewerIntakePath = join(collectorTmp, "baseline-openai-compatible-reviewer-intake.json");
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
  const sourceMatchResult = run("node", [
    "packages/bench/baseline-source-match-preflight.mjs",
    "--fixture",
    "--output",
    sourceMatchReportPath,
  ]);
  writeFileSync(
    privatePathSourceMatchQuerySetPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        fixtureOnly: true,
        datasetSlice: "private-path-source-match-fixture-slice",
        judgeModel: "fixture-judge",
        answerModel: "fixture-answer",
        queries: [
          {
            id: "private-path-source-match",
            q: "Which memory proves private path redaction in source matching?",
            expectedResultIds: ["privacy-path-memory"],
          },
        ],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    privatePathSourceMatchMemoriesPath,
    `${JSON.stringify({
      id: "privacy-path-memory",
      text: `The source-match preflight should redact local paths such as ${[
        "/Users",
        "example",
        ".codex",
        "selfmem-bridge",
        "store",
        "transcripts",
        "session.jsonl",
      ].join("/")} before hashing or reporting.`,
      sourceId: ["/Users", "example", ".codex", "selfmem-bridge", "store", "transcripts", "session.jsonl"].join("/"),
    })}\n`,
  );
  const privatePathSourceMatchResult = run(
    "node",
    [
      "packages/bench/baseline-source-match-preflight.mjs",
      "--queryset",
      privatePathSourceMatchQuerySetPath,
      "--memories",
      privatePathSourceMatchMemoriesPath,
      "--preserve-ids",
      "--output",
      privatePathSourceMatchReportPath,
    ],
    {
      env: {
        ...process.env,
        RECALLWEAVE_BASELINE_LIVE: "1",
        RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
      },
    },
  );
  const sourceAlignmentResult = run("node", [
    "packages/bench/baseline-source-alignment.mjs",
    "--source-match",
    sourceMatchReportPath,
    "--output",
    sourceAlignmentReportPath,
  ]);
  const sourceGapResult = run("node", [
    "packages/bench/baseline-source-gap-plan.mjs",
    "--source-match",
    sourceMatchReportPath,
    "--source-alignment",
    sourceAlignmentReportPath,
    "--output",
    sourceGapReportPath,
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
  writeFileSync(
    missingSourceMatchQuerySetPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        fixtureOnly: true,
        datasetSlice: "missing-source-match-fixture-slice",
        judgeModel: "fixture-judge",
        answerModel: "fixture-answer",
        queries: [
          {
            id: "missing-source-match",
            q: "Which memory proves missing source-match gating?",
            expectedResultIds: ["missing-source-match-memory"],
          },
        ],
      },
      null,
      2,
    ),
  );
  const missingSourceMatchResult = spawnSync(
    "node",
    [
      "packages/bench/baseline-source-match-preflight.mjs",
      "--fixture",
      "--queryset",
      missingSourceMatchQuerySetPath,
      "--memories",
      "packages/bench/fixtures/recallweave-local-container.fixture/local-memories.fixture.jsonl",
      "--strict",
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const missingSourceMatchReportPath = join(collectorTmp, "missing-source-match.json");
  writeFileSync(missingSourceMatchReportPath, missingSourceMatchResult.stdout);
  const missingSourceAlignmentResult = run("node", [
    "packages/bench/baseline-source-alignment.mjs",
    "--source-match",
    missingSourceMatchReportPath,
    "--output",
    missingSourceAlignmentReportPath,
  ]);
  const missingSourceGapResult = run("node", [
    "packages/bench/baseline-source-gap-plan.mjs",
    "--source-match",
    missingSourceMatchReportPath,
    "--source-alignment",
    missingSourceAlignmentReportPath,
    "--output",
    missingSourceGapReportPath,
  ]);
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
  const hostedMirrorResult = run("node", [
    "packages/bench/hosted-baseline-local-mirror.mjs",
    "--fixture",
    "--discovery",
    discoveryResultPath,
    "--private-map",
    discoveryPrivateMapPath,
    "--output-dir",
    hostedMirrorDir,
    "--output",
    hostedMirrorReportPath,
  ]);
  const hostedMirrorSourceMatchResult = run(
    "node",
    [
      "packages/bench/baseline-source-match-preflight.mjs",
      "--live",
      "--queryset",
      authoredQuerySetPath,
      "--container-dir",
      hostedMirrorDir,
      "--preserve-ids",
      "--strict",
      "--output",
      hostedMirrorSourceMatchPath,
    ],
    {
      env: {
        ...process.env,
        RECALLWEAVE_BASELINE_LIVE: "1",
        RECALLWEAVE_BASELINE_NO_RAW_TEXT: "1",
      },
    },
  );
  const hostedMirrorSourceAlignmentResult = run("node", [
    "packages/bench/baseline-source-alignment.mjs",
    "--source-match",
    hostedMirrorSourceMatchPath,
    "--local-map",
    join(hostedMirrorDir, "container-map.json"),
    "--private-map",
    discoveryPrivateMapPath,
    "--strict",
    "--output",
    hostedMirrorSourceAlignmentPath,
  ]);
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
      "--context-token-budget",
      "40",
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
  const looseReviewerComparisonResult = run("node", ["packages/bench/baseline-comparison.mjs", "--fixture"], {
    env: { ...process.env, RECALLWEAVE_REVIEWER_APPROVAL_COUNT: "2" },
  });
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
  const operatorSourceGapResult = run("node", [
    "packages/bench/hosted-baseline-operator-packet.mjs",
    "--source-gap",
    missingSourceGapReportPath,
  ]);
  const operatorMarkdown = run("node", ["packages/bench/hosted-baseline-operator-packet.mjs", "--format", "markdown"]);
  const operatorSourceGapMarkdown = run("node", [
    "packages/bench/hosted-baseline-operator-packet.mjs",
    "--source-gap",
    missingSourceGapReportPath,
    "--format",
    "markdown",
  ]);
  const nextRunResult = run("node", ["packages/bench/hosted-baseline-next-run.mjs"]);
  const nextRunMarkdown = run("node", ["packages/bench/hosted-baseline-next-run.mjs", "--format", "markdown"]);
  const baselineRunDir = mkdtempSync(join(tmpdir(), "recallweave-release-baseline-run-"));
  const baselineRunResult = run("node", [
    "packages/bench/hosted-baseline-run.mjs",
    "--fixture",
    "--out-dir",
    baselineRunDir,
  ]);
  const baselineRunEnvDir = mkdtempSync(join(tmpdir(), "recallweave-baseline-env-"));
  const baselineRunEnvQuerySetPath = join(baselineRunEnvDir, "queryset.json");
  const baselineRunEnvPath = join(baselineRunEnvDir, "container.env");
  writeFileSync(
    baselineRunEnvQuerySetPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        fixtureOnly: true,
        datasetSlice: "fixture-baseline-env-export-slice",
        judgeModel: "fixture-judge",
        answerModel: "fixture-answer",
        queries: [
          {
            id: "local-first-policy",
            q: "What is the RecallWeave write policy for hosted Supermemory?",
            expectedResultIds: ["mem_local_first_policy"],
          },
        ],
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  writeFileSync(
    baselineRunEnvPath,
    `# fixture private env\nexport RECALLWEAVE_BASELINE_QUERYSET='${baselineRunEnvQuerySetPath}'\n`,
    { mode: 0o600 },
  );
  const baselineRunExportEnvResult = run("node", [
    "packages/bench/hosted-baseline-run.mjs",
    "--fixture",
    "--container-env",
    baselineRunEnvPath,
    "--out-dir",
    join(baselineRunEnvDir, "run"),
  ]);
  const baselineRunMarkdown = run("node", ["packages/bench/hosted-baseline-run.mjs", "--fixture", "--format", "markdown"]);
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
  const baselineReviewerIntakeResult = run("node", ["packages/bench/baseline-reviewer-approval-intake.mjs"]);
  const baselineReviewerTemplateResult = run("node", [
    "packages/bench/baseline-reviewer-approval-intake.mjs",
    "--template",
    "--packet",
    baselinePacketPath,
    "--output",
    baselineReviewerApprovalReportPath,
  ]);
  const baselineOpenAiReviewerDryRunResult = run("node", [
    "packages/bench/baseline-openai-compatible-reviewer.mjs",
    "--dry-run",
    "--packet",
    baselinePacketPath,
    "--output",
    baselineOpenAiReviewerDryRunPath,
  ]);
  const baselineOpenAiReviewerIntakeResult = run("node", [
    "packages/bench/baseline-reviewer-approval-intake.mjs",
    "--packet",
    baselinePacketPath,
    "--review",
    baselineOpenAiReviewerDryRunPath,
    "--strict-target",
    "--output",
    baselineOpenAiReviewerIntakePath,
  ]);
  const baselineOpenAiReviewerMissingKey = spawnSync(
    "node",
    [
      "packages/bench/baseline-openai-compatible-reviewer.mjs",
      "--packet",
      baselinePacketPath,
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        RECALLWEAVE_REVIEW_OPENAI_API_KEY: "",
        RECALLWEAVE_REVIEW_DEEPSEEK_API_KEY: "",
        DEEPSEEK_API_KEY: "",
      },
    },
  );
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
  const sourceMatchReport = JSON.parse(sourceMatchResult.stdout);
  const sourceAlignmentReport = JSON.parse(sourceAlignmentResult.stdout);
  const sourceGapReport = JSON.parse(sourceGapResult.stdout);
  const missingSourceMatchReport = JSON.parse(missingSourceMatchResult.stdout);
  const missingSourceAlignmentReport = JSON.parse(missingSourceAlignmentResult.stdout);
  const missingSourceGapReport = JSON.parse(missingSourceGapResult.stdout);
  const discoveryReport = JSON.parse(discoveryResult.stdout);
  const privateMapDiscoveryReport = JSON.parse(privateMapDiscoveryResult.stdout);
  const containerSelectReport = JSON.parse(containerSelectResult.stdout);
  const querySetAuthorReport = JSON.parse(querySetAuthorResult.stdout);
  const authoredQuerySetInspectReport = JSON.parse(authoredQuerySetInspectResult.stdout);
  const hostedMirrorReport = JSON.parse(hostedMirrorResult.stdout);
  const hostedMirrorSourceMatchReport = JSON.parse(hostedMirrorSourceMatchResult.stdout);
  const hostedMirrorSourceAlignmentReport = JSON.parse(hostedMirrorSourceAlignmentResult.stdout);
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
  const looseReviewerComparisonReport = JSON.parse(looseReviewerComparisonResult.stdout);
  const matchedCollectorComparisonReport = JSON.parse(matchedCollectorComparison.stdout);
  const operatorPacket = JSON.parse(operatorResult.stdout);
  const operatorDiscoveryPacket = JSON.parse(operatorDiscoveryResult.stdout);
  const operatorSourceGapPacket = JSON.parse(operatorSourceGapResult.stdout);
  const nextRunPlan = JSON.parse(nextRunResult.stdout);
  const baselineRunPlan = JSON.parse(baselineRunResult.stdout);
  const baselineRunExportEnvPlan = JSON.parse(baselineRunExportEnvResult.stdout);
  const nextRunRequireReadyFixtureReport = JSON.parse(nextRunRequireReadyFixture.stdout);
  const baselinePacket = JSON.parse(baselinePacketResult.stdout);
  const baselinePacketReview = JSON.parse(baselinePacketReviewResult.stdout);
  const baselineReviewerIntake = JSON.parse(baselineReviewerIntakeResult.stdout);
  const baselineReviewerTemplate = JSON.parse(baselineReviewerTemplateResult.stdout);
  const baselineOpenAiReviewerDryRun = JSON.parse(baselineOpenAiReviewerDryRunResult.stdout);
  const baselineOpenAiReviewerIntake = JSON.parse(baselineOpenAiReviewerIntakeResult.stdout);
  const returnedBaselinePacket = JSON.parse(returnedBaselinePacketResult.stdout);
  const returnedBaselinePacketFromPath = JSON.parse(returnedBaselinePacketPathResult.stdout);
  const geminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-preflight-review.md"), "utf8");
  const querySetEvidence = readFileSync(join(root, reviewDir, "baseline-queryset-inspect-evidence.md"), "utf8");
  const querySetGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-queryset-inspect-review.md"), "utf8");
  const sourceMatchEvidence = readFileSync(join(root, reviewDir, "baseline-source-match-preflight-evidence.md"), "utf8");
  const sourceMatchGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-source-match-preflight-review.md"), "utf8");
  const sourceAlignmentEvidence = readFileSync(join(root, reviewDir, "baseline-source-alignment-evidence.md"), "utf8");
  const sourceAlignmentGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-source-alignment-review.md"), "utf8");
  const sourceGapEvidence = readFileSync(join(root, reviewDir, "baseline-source-gap-plan-evidence.md"), "utf8");
  const sourceGapGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-source-gap-plan-review.md"), "utf8");
  const discoveryEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-discovery-evidence.md"), "utf8");
  const discoveryGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-discovery-review.md"), "utf8");
  const containerSelectEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-container-select-evidence.md"), "utf8");
  const containerSelectGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-container-select-review.md"), "utf8");
  const querySetAuthorEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-queryset-author-evidence.md"), "utf8");
  const querySetAuthorGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-queryset-author-review.md"), "utf8");
  const hostedMirrorEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-local-mirror-evidence.md"), "utf8");
  const hostedMirrorGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-local-mirror-review.md"), "utf8");
  const hostedMirrorCodexReview = readFileSync(join(root, reviewDir, "codex-hosted-baseline-local-mirror-review.md"), "utf8");
  const liveDiscoveryReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-discovery.json"), "utf8"));
  const liveDiscoveryEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-live-discovery-evidence.md"), "utf8");
  const liveDiscoveryGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-live-discovery-review.md"), "utf8");
  const livePrepEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-live-prep-evidence.md"), "utf8");
  const livePrepGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-live-prep-review.md"), "utf8");
  const liveQuerySetAuthorReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-queryset-author.json"), "utf8"));
  const liveQuerySetReport = JSON.parse(readFileSync(join(root, reviewDir, "hosted-baseline-live-queryset-report.json"), "utf8"));
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
  const baselineRunEvidence = readFileSync(join(root, reviewDir, "hosted-baseline-run-evidence.md"), "utf8");
  const baselineRunGeminiReview = readFileSync(join(root, reviewDir, "gemini-hosted-baseline-run-review.md"), "utf8");
  const baselinePacketEvidence = readFileSync(join(root, reviewDir, "baseline-evidence-packet-evidence.md"), "utf8");
  const baselinePacketGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-evidence-packet-review.md"), "utf8");
  const baselineReturnedPacketEvidence = readFileSync(join(root, reviewDir, "baseline-returned-packet-intake-evidence.md"), "utf8");
  const baselineReturnedPacketGeminiReview = readFileSync(join(root, reviewDir, "gemini-baseline-returned-packet-intake-review.md"), "utf8");
  const baselineOpenAiReviewerEvidence = readFileSync(join(root, reviewDir, "baseline-openai-compatible-reviewer-evidence.md"), "utf8");
  const baselineReviewerApprovalIntakeEvidence = readFileSync(join(root, reviewDir, "baseline-reviewer-approval-intake-evidence.md"), "utf8");
  assert.equal(report.ok, true);
  assert.equal(report.mode, "hosted-baseline-preflight");
  assert.equal(report.writesRealFiles, false);
  assert.equal(report.callsHostedProvider, false);
  assert.equal(report.metricsOnly, true);
  assert.equal(report.releaseBlockerPresent, false);
  assert.equal(report.reviewedHostedBaselineReady, true);
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
  assert.equal(querySetReport.querySetEvidence?.uniqueQueryCount, 3);
  assert.equal(querySetReport.querySetEvidence?.duplicateQueryCount, 0);
  assert.equal(querySetReport.querySetEvidence?.unlabeledQueryCount, 0);
  assert.equal(querySetReport.queryFingerprints?.length, 3);
  assert.ok(querySetReport.source?.querySetHash?.startsWith("sha256:"));
  assert.doesNotMatch(querySetInspectResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.doesNotMatch(readFileSync(querySetReportPath, "utf8"), /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.equal(sourceMatchReport.mode, "baseline-source-match-preflight");
  assert.equal(sourceMatchReport.metricsOnly, true);
  assert.equal(sourceMatchReport.publicSafe, true);
  assert.equal(sourceMatchReport.rawQueryIncluded, false);
  assert.equal(sourceMatchReport.rawExpectedIdsIncluded, false);
  assert.equal(sourceMatchReport.rawExpectedHashesIncluded, false);
  assert.equal(sourceMatchReport.rawMemoryIncluded, false);
  assert.equal(sourceMatchReport.sourceMatchReady, true);
  assert.equal(sourceMatchReport.sourceMatchEvidence?.sourceMatchedQueryCount, 3);
  assert.equal(sourceMatchReport.sourceMatchEvidence?.collectableQueryCount, 3);
  assert.equal(sourceMatchReport.sourceMatchEvidence?.missingQueryCount, 0);
  assert.equal(sourceMatchReport.failedChecks?.length, 0);
  assert.doesNotMatch(sourceMatchResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  assert.doesNotMatch(readFileSync(sourceMatchReportPath, "utf8"), /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  const privatePathSourceMatchReport = JSON.parse(privatePathSourceMatchResult.stdout);
  assert.equal(privatePathSourceMatchReport.mode, "baseline-source-match-preflight");
  assert.equal(privatePathSourceMatchReport.sourceMatchReady, true);
  assert.equal(privatePathSourceMatchReport.localSourceEvidence?.privatePathRedactionCount >= 1, true);
  assert.equal(privatePathSourceMatchReport.localSourceEvidence?.unsafeIdRedactionCount, 0);
  assert.equal(privatePathSourceMatchReport.privateLeakCount, 0);
  assert.doesNotMatch(privatePathSourceMatchResult.stdout, /\/Users\/example|transcripts\/session\.jsonl/);
  assert.doesNotMatch(readFileSync(privatePathSourceMatchReportPath, "utf8"), /\/Users\/example|transcripts\/session\.jsonl/);
  assert.equal(sourceAlignmentReport.mode, "baseline-source-alignment");
  assert.equal(sourceAlignmentReport.metricsOnly, true);
  assert.equal(sourceAlignmentReport.publicSafe, true);
  assert.equal(sourceAlignmentReport.rawLabelsIncluded, false);
  assert.equal(sourceAlignmentReport.rawMemoryIncluded, false);
  assert.equal(sourceAlignmentReport.labelAlignment?.labelAligned, true);
  assert.equal(sourceAlignmentReport.contentAlignment?.sourceMatchReady, true);
  assert.equal(sourceAlignmentReport.benchmarkGate?.matchedBaselineRunAllowed, true);
  assert.equal(sourceAlignmentReport.benchmarkGate?.publicBenchmarkClaimsAllowed, false);
  assert.doesNotMatch(sourceAlignmentResult.stdout, /rawContainerTag|source_supermemory_container|sourceSupermemoryContainer|expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  assert.doesNotMatch(readFileSync(sourceAlignmentReportPath, "utf8"), /rawContainerTag|source_supermemory_container|sourceSupermemoryContainer|expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  assert.equal(sourceGapReport.mode, "baseline-source-gap-plan");
  assert.equal(sourceGapReport.metricsOnly, true);
  assert.equal(sourceGapReport.publicSafe, true);
  assert.equal(sourceGapReport.rawLabelsIncluded, false);
  assert.equal(sourceGapReport.rawMemoryIncluded, false);
  assert.equal(sourceGapReport.baselineRunBlocked, false);
  assert.equal(sourceGapReport.repairPlan?.status, "READY_FOR_MATCHED_BASELINE");
  assert.equal(sourceGapReport.repairPlan?.repairSummary?.repairQueueCount, 0);
  assert.equal(sourceGapReport.repairPlan?.repairSummary?.readyQueryCount, 3);
  assert.deepEqual(sourceGapReport.repairPlan?.repairQueue, []);
  assert.equal(sourceGapReport.benchmarkGate?.matchedBaselineRunAllowed, true);
  assert.equal(sourceGapReport.benchmarkGate?.publicBenchmarkClaimsAllowed, false);
  assert.ok(sourceGapReport.operatorCommands?.some((item) => item.id === "plan-source-gap" && /baseline:source-gap/.test(item.command)));
  assert.ok(sourceGapReport.attachOnly?.includes("/tmp/recallweave-baseline-source-gap.json"));
  assert.doesNotMatch(sourceGapResult.stdout, /rawContainerTag|source_supermemory_container|sourceSupermemoryContainer|expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  assert.doesNotMatch(readFileSync(sourceGapReportPath, "utf8"), /rawContainerTag|source_supermemory_container|sourceSupermemoryContainer|expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  assert.notEqual(missingSourceMatchResult.status, 0);
  assert.equal(missingSourceMatchReport.mode, "baseline-source-match-preflight");
  assert.equal(missingSourceMatchReport.sourceMatchReady, false);
  assert.ok(missingSourceMatchReport.failedChecks?.includes("local-source-missing-expected-refs"));
  assert.ok(missingSourceMatchReport.failedChecks?.includes("local-export-cannot-score-every-query"));
  assert.equal(missingSourceAlignmentReport.status, "BLOCKED_CONTENT_DIVERGENT");
  assert.equal(missingSourceAlignmentReport.benchmarkGate?.matchedBaselineRunAllowed, false);
  assert.equal(missingSourceGapReport.repairPlan?.status, "BLOCKED_CONTENT_DIVERGENT");
  assert.equal(missingSourceGapReport.baselineRunBlocked, true);
  assert.equal(missingSourceGapReport.repairPlan?.repairSummary?.repairQueueCount, 1);
  assert.equal(missingSourceGapReport.repairPlan?.repairSummary?.statusCounts?.["missing-source-match"], 1);
  assert.equal(missingSourceGapReport.repairPlan?.repairQueue?.[0]?.repairStatus, "missing-source-match");
  assert.match(missingSourceGapReport.repairPlan?.repairQueue?.[0]?.recommendedAction ?? "", /mirror|rebuild/i);
  assert.doesNotMatch(missingSourceMatchResult.stdout, secretPattern);
  assert.doesNotMatch(missingSourceMatchResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  assert.doesNotMatch(missingSourceGapResult.stdout, secretPattern);
  assert.doesNotMatch(missingSourceGapResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
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
  assert.equal(authoredQuerySetInspectReport.querySetEvidence?.uniqueQueryCount, 3);
  assert.equal(authoredQuerySetInspectReport.querySetEvidence?.duplicateQueryCount, 0);
  assert.equal(authoredQuerySetInspectReport.querySetEvidence?.unlabeledQueryCount, 0);
  assert.doesNotMatch(querySetAuthorResult.stdout, /fixture-personal|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma/);
  assert.doesNotMatch(readFileSync(authoredQuerySetReportPath, "utf8"), /fixture-personal|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma/);
  assert.doesNotMatch(querySetAuthorResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.doesNotMatch(readFileSync(authoredQuerySetReportPath, "utf8"), /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*id"\s*:/);
  assert.notEqual(querySetAuthorInsideRepoResult.status, 0);
  assert.match(`${querySetAuthorInsideRepoResult.stderr}\n${querySetAuthorInsideRepoResult.stdout}`, /outside the repository/);
  assert.equal(hostedMirrorReport.mode, "hosted-baseline-local-mirror");
  assert.equal(hostedMirrorReport.fixtureOnly, true);
  assert.equal(hostedMirrorReport.callsHostedProvider, false);
  assert.equal(hostedMirrorReport.publicSafe, true);
  assert.equal(hostedMirrorReport.metricsOnly, true);
  assert.equal(hostedMirrorReport.rawLabelsIncluded, false);
  assert.equal(hostedMirrorReport.rawMemoryIncluded, false);
  assert.equal(hostedMirrorReport.localMirror?.containsRedactedMemoryText, true);
  assert.equal(hostedMirrorReport.localMirror?.attachToPublicEvidence, false);
  assert.equal(hostedMirrorReport.localMirror?.outputIdMode, "preserve-hosted-ids");
  assert.equal(hostedMirrorReport.sourceStats?.mirroredMemoryCount, 3);
  assert.equal(statSync(join(hostedMirrorDir, "memories.jsonl")).mode & 0o777, 0o600);
  assert.equal(statSync(join(hostedMirrorDir, "container-map.json")).mode & 0o777, 0o600);
  assert.match(readFileSync(join(hostedMirrorDir, "container-map.json"), "utf8"), /fixture-personal/);
  assert.match(readFileSync(join(hostedMirrorDir, "memories.jsonl"), "utf8"), /RecallWeave keeps local writes/);
  assert.doesNotMatch(hostedMirrorResult.stdout, /fixture-personal|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma|RecallWeave keeps local writes/);
  assert.doesNotMatch(readFileSync(hostedMirrorReportPath, "utf8"), /fixture-personal|fixture-doc-alpha|fixture-doc-beta|fixture-doc-gamma|RecallWeave keeps local writes/);
  assert.equal(hostedMirrorSourceMatchReport.mode, "baseline-source-match-preflight");
  assert.equal(hostedMirrorSourceMatchReport.sourceMatchReady, true);
  assert.equal(hostedMirrorSourceMatchReport.sourceMatchEvidence?.collectableQueryCount, 3);
  assert.equal(hostedMirrorSourceMatchReport.sourceMatchEvidence?.missingQueryCount, 0);
  assert.equal(hostedMirrorSourceMatchReport.failedChecks?.length, 0);
  assert.equal(hostedMirrorSourceAlignmentReport.mode, "baseline-source-alignment");
  assert.equal(hostedMirrorSourceAlignmentReport.status, "READY_FOR_MATCHED_BASELINE_FIXTURE");
  assert.equal(hostedMirrorSourceAlignmentReport.benchmarkGate?.matchedBaselineRunAllowed, true);
  assert.equal(hostedMirrorSourceAlignmentReport.benchmarkGate?.publicBenchmarkClaimsAllowed, false);
  const duplicateQuerySetPath = join(collectorTmp, "duplicate-queryset.json");
  writeFileSync(
    duplicateQuerySetPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        datasetSlice: "duplicate-query-fixture-slice",
        judgeModel: "fixture-judge",
        answerModel: "fixture-answer",
        queries: [
          { id: "duplicate-a", q: "Which memory describes duplicate query gating?", expectedResultIds: ["duplicate-a"] },
          { id: "duplicate-b", q: "Which memory describes duplicate query gating?", expectedResultIds: ["duplicate-b"] },
        ],
      },
      null,
      2,
    ),
  );
  const duplicateQuerySetResult = spawnSync(
    "node",
    ["packages/bench/baseline-queryset-inspect.mjs", "--queryset", duplicateQuerySetPath, "--strict"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const duplicateQuerySetReport = JSON.parse(duplicateQuerySetResult.stdout);
  assert.notEqual(duplicateQuerySetResult.status, 0);
  assert.equal(duplicateQuerySetReport.querySetEvidence?.publicBenchmarkReady, false);
  assert.equal(duplicateQuerySetReport.querySetEvidence?.duplicateQueryCount, 1);
  assert.ok(duplicateQuerySetReport.failedChecks?.includes("unique-query-text"));
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
  assert.equal(recallWeaveLiveExportReport.contextBudget?.applied, true);
  assert.equal(recallWeaveLiveExportReport.contextBudget?.tokenBudget, 40);
  assert.ok(Number(recallWeaveLiveExportReport.contextBudget?.exportedContextTokensAvg) <= 40);
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
  assert.equal(looseReviewerComparisonReport.legacyReviewerApprovalCount, 2);
  assert.equal(looseReviewerComparisonReport.reviewerApprovalCount, 0);
  assert.equal(looseReviewerComparisonReport.publicBenchmarkClaimsAllowed, false);
  assert.ok(looseReviewerComparisonReport.failedChecks?.includes("two-reviewer-approvals"));
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
  const bloatedRecallWeave = structuredClone(forcedRecallWeave);
  bloatedRecallWeave.metrics.contextTokensAvg = forcedHosted.metrics.contextTokensAvg * 10;
  writeFileSync(bloatedRecallWeavePath, JSON.stringify(bloatedRecallWeave, null, 2));
  const bloatedComparison = JSON.parse(
    run("node", ["packages/bench/baseline-comparison.mjs", "--hosted", forcedHostedPath, "--recallweave", bloatedRecallWeavePath]).stdout,
  );
  assert.equal(bloatedComparison.contextBudget?.ok, false);
  assert.equal(bloatedComparison.countsAsComparisonEvidence, false);
  assert.ok(bloatedComparison.failedChecks?.includes("context-token-parity"));
  assert.ok(Number(bloatedComparison.contextBudget?.overageTokensAvg) > 0);
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
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.documentsSeen, 200);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.containerCandidateCount, 14);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.rawLabelsIncluded, false);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.rawMemoryIncluded, false);
  assert.equal(operatorDiscoveryPacket.liveDiscovery?.privacyLeakCount, 0);
  assert.match(operatorDiscoveryPacket.liveDiscovery?.recommendedCandidateId ?? "", /^c_[a-f0-9]{16}$/);
  assert.ok(operatorDiscoveryPacket.liveDiscovery?.candidateIds?.includes(operatorDiscoveryPacket.liveDiscovery?.recommendedCandidateId));
  assert.ok(operatorDiscoveryPacket.liveDiscovery?.candidateIds?.every((id) => /^c_[a-f0-9]{16}$/.test(id)));
  assert.equal(operatorSourceGapPacket.mode, "hosted-baseline-operator-packet");
  assert.equal(operatorSourceGapPacket.sourceGapSummary?.status, "BLOCKED_CONTENT_DIVERGENT");
  assert.equal(operatorSourceGapPacket.sourceGapSummary?.baselineRunBlocked, true);
  assert.equal(operatorSourceGapPacket.sourceGapSummary?.repairSummary?.repairQueueCount, 1);
  assert.equal(operatorSourceGapPacket.sourceGapSummary?.repairSummary?.readyQueryCount, 0);
  assert.equal(operatorSourceGapPacket.sourceGapSummary?.repairQueue?.[0]?.repairStatus, "missing-source-match");
  assert.match(operatorSourceGapPacket.sourceGapSummary?.repairQueue?.[0]?.queryIdHash ?? "", /^[a-f0-9]{16}$/);
  assert.match(operatorSourceGapPacket.sourceGapSummary?.repairQueue?.[0]?.queryHash ?? "", /^[a-f0-9]{16}$/);
  assert.doesNotMatch(operatorSourceGapResult.stdout, /expectedResultIds|expectedResultHashes|"\s*q"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
  assert.ok(operatorPacket.commands.some((item) => item.id === "discover-hosted-containers" && /baseline:discover/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "write-private-container-map" && /RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "select-private-container" && /baseline:select-container/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "author-private-query-set" && /baseline:author-queryset/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "mirror-hosted-source-local" && /baseline:mirror-hosted/.test(item.command) && /--output-dir/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "print-template" && /baseline:preflight/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "validate-query-set" && /baseline:queryset/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "preflight-local-source-match" && /baseline:source-match/.test(item.command) && /--preserve-ids/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "preflight-source-alignment" && /baseline:source-align/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "plan-source-gap" && /baseline:source-gap/.test(item.command) && /--output/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "reload-source-gap-repair" && /baseline:operator-packet/.test(item.command) && /--source-gap/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "run-matched-baseline-chain" && /baseline:run/.test(item.command) && /--reviewed-queryset/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "run-matched-baseline-chain" && /--local-map/.test(item.command) && /--private-map/.test(item.command) && /--preserve-ids/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "export-recallweave-responses" && /baseline:export:recallweave/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "collect-live-result" && /baseline:collect/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "package-baseline-evidence" && /baseline:packet/.test(item.command) && /--strict-real/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "collect-reviewer-approvals" && /baseline:reviewer-intake/.test(item.command) && /--strict-target/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "rerun-reviewed-comparison" && /--reviewer-approval-report/.test(item.command)));
  assert.ok(operatorPacket.commands.some((item) => item.id === "validate-live-result" && /RECALLWEAVE_BASELINE_NO_RAW_TEXT=1/.test(item.command)));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-author-report.json"));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-report.json"));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-hosted-local-mirror.json"));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-baseline-source-match.json"));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-baseline-source-alignment.json"));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-baseline-source-gap.json"));
  assert.ok(operatorPacket.attachOnly?.includes("/tmp/recallweave-reviewer-approval-report.json"));
  for (const command of operatorPacket.commands.map((item) => item.command).filter((command) => /baseline:(preflight|compare|source-match|source-align|source-gap)/.test(command))) {
    if (/--fixture/.test(command)) continue;
    const toolSegment = command.slice(command.indexOf("baseline:"));
    assert.match(toolSegment, /--output\s+\/tmp\/recallweave-/);
    assert.doesNotMatch(toolSegment, /\s>\s/, "hosted baseline JSON evidence commands must use --output instead of shell redirection");
  }
  assert.ok(operatorPacket.acceptanceCriteria.includes("baseline:reviewer-intake records at least two independent reviewer approvals before comparison claims"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("querySetEvidence.publicBenchmarkReady is true"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("every query has at least one expectedResultId or expectedResultHash"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("source-match preflight proves every reviewed query has at least one collectable expected ref in the local RecallWeave source"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("source-alignment gate proves the hosted label and local container map align and matchedBaselineRunAllowed is true"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("source-gap plan reports READY_FOR_MATCHED_BASELINE before hosted collection, or a blocked repair path if not ready"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("blocked source-gap reports are reloaded with --source-gap before repair handoff, showing only hashed repair labels and counts"));
  assert.ok(operatorPacket.acceptanceCriteria.includes("private query set, if auto-authored, was reviewed locally before collection"));
  assert.ok(operatorPacket.forbidden.includes("provider keys"));
  assert.ok(operatorPacket.forbidden.includes("private container map"));
  assert.ok(operatorPacket.forbidden.some((item) => /private.*query set/i.test(item)));
  assert.match(operatorMarkdown.stdout, /RecallWeave Hosted Baseline Packet/);
  assert.match(operatorMarkdown.stdout, /baseline:discover/);
  assert.match(operatorMarkdown.stdout, /private raw-label map/i);
  assert.match(operatorMarkdown.stdout, /baseline:select-container/);
  assert.match(operatorMarkdown.stdout, /baseline:author-queryset/);
  assert.match(operatorMarkdown.stdout, /baseline:mirror-hosted/);
  assert.match(operatorMarkdown.stdout, /private hosted mirror|hosted mirror/i);
  assert.match(operatorMarkdown.stdout, /baseline:queryset/);
  assert.match(operatorMarkdown.stdout, /baseline:source-match/);
  assert.match(operatorMarkdown.stdout, /baseline:source-align/);
  assert.match(operatorMarkdown.stdout, /baseline:source-gap/);
  assert.match(operatorMarkdown.stdout, /--source-gap/);
  assert.match(operatorMarkdown.stdout, /baseline:run/);
  assert.match(operatorMarkdown.stdout, /baseline:export:recallweave/);
  assert.match(operatorMarkdown.stdout, /baseline:packet/);
  assert.match(operatorMarkdown.stdout, /baseline:reviewer-intake/);
  assert.match(operatorMarkdown.stdout, /Attach Only/);
  assert.match(operatorSourceGapMarkdown.stdout, /Current Source-Gap Repair Queue/);
  assert.match(operatorSourceGapMarkdown.stdout, /BLOCKED_CONTENT_DIVERGENT/);
  assert.match(operatorSourceGapMarkdown.stdout, /missing-source-match/);
  assert.match(operatorSourceGapMarkdown.stdout, /mirror the selected hosted source locally or rebuild this query from the local source/);
  assert.doesNotMatch(operatorSourceGapMarkdown.stdout, /expectedResultIds|expectedResultHashes|Which memory proves|missing-source-match-memory|"\s*q"\s*:|"\s*(?:content|memory|text|raw|rawText|document)"\s*:/);
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
  assert.ok(nextRunPlan.acceptanceCriteria?.includes("source-match preflight proves every reviewed query has at least one collectable expected ref in the local RecallWeave source"));
  assert.ok(nextRunPlan.acceptanceCriteria?.includes("source-alignment gate proves the hosted label and local container map align and matchedBaselineRunAllowed is true"));
  assert.ok(nextRunPlan.acceptanceCriteria?.includes("source-gap plan reports READY_FOR_MATCHED_BASELINE before hosted collection, or a blocked repair path if not ready"));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "discover-hosted-containers" && /baseline:discover/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "write-private-container-map" && /RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "select-private-container" && /baseline:select-container/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "author-private-query-set" && /baseline:author-queryset/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "mirror-hosted-source-local" && /baseline:mirror-hosted/.test(item.command) && /--output-dir/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "validate-query-set" && /baseline:queryset/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "preflight-local-source-match" && /baseline:source-match/.test(item.command) && /--preserve-ids/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "preflight-source-alignment" && /baseline:source-align/.test(item.command) && /--strict/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "plan-source-gap" && /baseline:source-gap/.test(item.command) && /--output/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "run-matched-baseline-chain" && /baseline:run/.test(item.command) && /RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "run-matched-baseline-chain" && /--local-map/.test(item.command) && /--private-map/.test(item.command) && /--preserve-ids/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "collect-hosted-baseline" && /baseline:collect/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "export-recallweave-responses" && /baseline:export:recallweave/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "compare-matched-results" && /baseline:compare/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "package-review-evidence" && /baseline:packet/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "collect-reviewer-approvals" && /baseline:reviewer-intake/.test(item.command) && /--strict-target/.test(item.command)));
  assert.ok(nextRunPlan.commandPlan?.some((item) => item.id === "rerun-reviewed-comparison" && /--reviewer-approval-report/.test(item.command)));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-author-report.json"));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-hosted-baseline-queryset-report.json"));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-hosted-local-mirror.json"));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-baseline-source-match.json"));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-baseline-source-alignment.json"));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-baseline-source-gap.json"));
  assert.ok(nextRunPlan.attachOnly?.includes("/tmp/recallweave-reviewer-approval-report.json"));
  for (const command of nextRunPlan.commandPlan.map((item) => item.command).filter((command) => /baseline:(preflight|compare|source-match|source-align|source-gap)/.test(command))) {
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
  assert.match(nextRunMarkdown.stdout, /baseline:mirror-hosted/);
  assert.match(nextRunMarkdown.stdout, /baseline:source-match/);
  assert.match(nextRunMarkdown.stdout, /baseline:source-align/);
  assert.match(nextRunMarkdown.stdout, /baseline:source-gap/);
  assert.match(nextRunMarkdown.stdout, /baseline:run/);
  assert.match(nextRunMarkdown.stdout, /baseline:reviewer-intake/);
  assert.match(nextRunMarkdown.stdout, /private container maps/i);
  assert.equal(baselineRunPlan.ok, true);
  assert.equal(baselineRunPlan.mode, "hosted-baseline-run");
  assert.equal(baselineRunPlan.fixtureOnly, true);
  assert.equal(baselineRunPlan.callsHostedProvider, false);
  assert.equal(baselineRunPlan.metricsOnly, true);
  assert.equal(baselineRunPlan.publicLaunchAllowed, false);
  assert.equal(baselineRunPlan.countsAsProductionBaselineEvidence, false);
  assert.equal(baselineRunPlan.status, "NOT_BASELINE_EVIDENCE");
  assert.equal(baselineRunPlan.steps?.length, 12);
  assert.ok(baselineRunPlan.steps?.some((item) => item.id === "preflight-local-source-match" && item.mode === "baseline-source-match-preflight"));
  assert.ok(baselineRunPlan.steps?.some((item) => item.id === "preflight-source-alignment" && item.mode === "baseline-source-alignment"));
  assert.ok(baselineRunPlan.steps?.some((item) => item.id === "plan-source-gap" && item.mode === "baseline-source-gap-plan"));
  assert.ok(baselineRunPlan.steps?.some((item) => item.id === "collect-hosted-baseline" && item.mode === "fixture-hosted-baseline-collector-result"));
  assert.ok(baselineRunPlan.steps?.some((item) => item.id === "export-recallweave-responses" && item.mode === "fixture-recallweave-response-export"));
  assert.ok(baselineRunPlan.steps?.some((item) => item.id === "review-returned-packet" && item.mode === "baseline-returned-packet-intake"));
  assert.equal(baselineRunPlan.evidence?.querySet?.publicBenchmarkReady, true);
  assert.equal(baselineRunPlan.evidence?.sourceMatch?.sourceMatchReady, true);
  assert.equal(baselineRunPlan.evidence?.sourceAlignment?.matchedBaselineRunAllowed, true);
  assert.equal(baselineRunPlan.evidence?.sourceGap?.baselineRunBlocked, false);
  assert.equal(baselineRunPlan.evidence?.hosted?.provider, "hosted-supermemory");
  assert.equal(baselineRunPlan.evidence?.recallWeave?.provider, "recallweave");
  assert.equal(baselineRunPlan.evidence?.preflight?.countsAsHostedBaselineEvidence, false);
  assert.equal(baselineRunPlan.evidence?.comparison?.recallWeaveWin, true);
  assert.equal(baselineRunPlan.evidence?.packet?.entries?.length, 6);
  assert.equal(baselineRunPlan.evidence?.intake?.countsAsProductionBaselineEvidence, false);
  assert.ok(baselineRunPlan.liveRequirements?.includes("RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1 or --reviewed-queryset"));
  assert.ok(baselineRunPlan.liveRequirements?.includes("local container map is supplied through --local-map or RECALLWEAVE_BASELINE_LOCAL_MAP"));
  assert.ok(baselineRunPlan.liveRequirements?.includes("private hosted container map is supplied through --private-map or RECALLWEAVE_BASELINE_PRIVATE_MAP"));
  assert.ok(baselineRunPlan.forbidden?.includes("private query sets"));
  assert.equal(baselineRunExportEnvPlan.ok, true);
  assert.equal(baselineRunExportEnvPlan.fixtureOnly, true);
  assert.equal(baselineRunExportEnvPlan.evidence?.querySet?.queryCount, 1);
  assert.equal(baselineRunExportEnvPlan.callsHostedProvider, false);
  assert.match(baselineRunMarkdown.stdout, /RecallWeave Hosted Baseline Run/);
  assert.match(baselineRunMarkdown.stdout, /Production baseline evidence: no/);
  assert.match(baselineRunMarkdown.stdout, /Public launch allowed: no/);
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
  assert.equal(baselineReviewerIntake.mode, "baseline-reviewer-approval-intake");
  assert.equal(baselineReviewerIntake.metricsOnly, true);
  assert.equal(baselineReviewerIntake.publicLaunchAllowed, false);
  assert.equal(baselineReviewerIntake.reviewerApprovalCount, 0);
  assert.equal(baselineReviewerIntake.publicBenchmarkApprovalReady, false);
  assert.ok(baselineReviewerIntake.failedChecks?.includes("two-independent-approvals"));
  assert.equal(baselineReviewerTemplate.mode, "baseline-reviewer-approval-template");
  assert.equal(baselineReviewerTemplate.metricsOnly, true);
  assert.equal(baselineReviewerTemplate.publicLaunchAllowed, false);
  assert.equal(baselineReviewerTemplate.target?.packetSha256, baselinePacket.packet?.sha256);
  assert.equal(baselineReviewerTemplate.template?.attestations?.contextTokenCaveatReviewed, true);
  assert.equal(baselineOpenAiReviewerDryRun.mode, "baseline-openai-compatible-reviewer");
  assert.equal(baselineOpenAiReviewerDryRun.dryRun, true);
  assert.equal(baselineOpenAiReviewerDryRun.callsReviewerProvider, false);
  assert.equal(baselineOpenAiReviewerDryRun.metricsOnly, true);
  assert.equal(baselineOpenAiReviewerDryRun.publicLaunchAllowed, false);
  assert.equal(baselineOpenAiReviewerDryRun.provider, "deepseek");
  assert.equal(baselineOpenAiReviewerDryRun.model, "deepseek-v4-pro");
  assert.equal(baselineOpenAiReviewerDryRun.target?.packetSha256, baselinePacket.packet?.sha256);
  assert.equal(baselineOpenAiReviewerDryRun.reviewArtifact?.fixtureOnly, true);
  assert.equal(baselineOpenAiReviewerDryRun.reviewArtifact?.countsAsBenchmarkApproval, false);
  assert.equal(baselineOpenAiReviewerIntake.mode, "baseline-reviewer-approval-intake");
  assert.equal(baselineOpenAiReviewerIntake.reviewerApprovalCount, 0);
  assert.equal(baselineOpenAiReviewerIntake.publicBenchmarkApprovalReady, false);
  assert.ok(baselineOpenAiReviewerIntake.reviews?.[0]?.failedChecks?.includes("not-fixture"));
  assert.notEqual(baselineOpenAiReviewerMissingKey.status, 0);
  assert.match(
    `${baselineOpenAiReviewerMissingKey.stderr}\n${baselineOpenAiReviewerMissingKey.stdout}`,
    /set RECALLWEAVE_REVIEW_OPENAI_API_KEY or the provider-specific key/i,
  );
  assert.doesNotMatch(`${baselineOpenAiReviewerMissingKey.stderr}\n${baselineOpenAiReviewerMissingKey.stdout}`, secretPattern);
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
  assert.match(hostedMirrorEvidence, /hosted baseline local mirror/i);
  assert.match(hostedMirrorEvidence, /baseline:mirror-hosted/i);
  assert.match(hostedMirrorEvidence, /Private mirror files mode:\s*`0600`/i);
  assert.match(hostedMirrorEvidence, /Raw memory included.*no/i);
  assert.match(hostedMirrorEvidence, /source-match.*collectable/i);
  assert.match(hostedMirrorCodexReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.equal(liveDiscoveryReport.mode, "hosted-baseline-discovery");
  assert.equal(liveDiscoveryReport.fixtureOnly, false);
  assert.equal(liveDiscoveryReport.callsHostedProvider, true);
  assert.equal(liveDiscoveryReport.publicSafe, true);
  assert.equal(liveDiscoveryReport.metricsOnly, true);
  assert.equal(liveDiscoveryReport.rawLabelsIncluded, false);
  assert.equal(liveDiscoveryReport.rawMemoryIncluded, false);
  assert.equal(liveDiscoveryReport.privacyLeakCount, 0);
  assert.equal(liveDiscoveryReport.redactionFailureCount, 0);
  assert.equal(Number(liveDiscoveryReport.sourceStats?.documentsSeen), 200);
  assert.equal(Number(liveDiscoveryReport.containerCandidateCount), 14);
  assert.deepEqual(liveDiscoveryReport.sourceStats?.errors ?? [], []);
  assert.match(liveDiscoveryEvidence, /does not close the hosted-baseline blocker/i);
  assert.match(liveDiscoveryGeminiReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.match(livePrepEvidence, /Unique drafted query count:\s*8/i);
  assert.match(livePrepEvidence, /Duplicate drafted query count:\s*0/i);
  assert.match(livePrepGeminiReview, /Verdict:\s*`?CLEAN`?/i);
  assert.equal(liveQuerySetAuthorReport.mode, "hosted-baseline-queryset-author");
  assert.equal(liveQuerySetAuthorReport.fixtureOnly, false);
  assert.equal(liveQuerySetAuthorReport.callsHostedProvider, true);
  assert.equal(liveQuerySetAuthorReport.publicSafe, true);
  assert.equal(liveQuerySetAuthorReport.metricsOnly, true);
  assert.equal(liveQuerySetAuthorReport.rawLabelsIncluded, false);
  assert.equal(liveQuerySetAuthorReport.rawQueryIncluded, false);
  assert.equal(liveQuerySetAuthorReport.rawExpectedIdsIncluded, false);
  assert.equal(liveQuerySetAuthorReport.rawExpectedHashesIncluded, false);
  assert.equal(liveQuerySetAuthorReport.privacyLeakCount, 0);
  assert.equal(liveQuerySetAuthorReport.querySetEvidence?.queryCount, 8);
  assert.equal(liveQuerySetAuthorReport.querySetEvidence?.uniqueQueryCount, 8);
  assert.equal(liveQuerySetAuthorReport.querySetEvidence?.duplicateQueryCount, 0);
  assert.equal(liveQuerySetReport.mode, "baseline-queryset-inspect");
  assert.equal(liveQuerySetReport.fixtureOnly, false);
  assert.equal(liveQuerySetReport.publicSafe, true);
  assert.equal(liveQuerySetReport.metricsOnly, true);
  assert.equal(liveQuerySetReport.rawQueryIncluded, false);
  assert.equal(liveQuerySetReport.rawExpectedIdsIncluded, false);
  assert.equal(liveQuerySetReport.rawExpectedHashesIncluded, false);
  assert.equal(liveQuerySetReport.querySetEvidence?.publicBenchmarkReady, true);
  assert.equal(liveQuerySetReport.querySetEvidence?.queryCount, 8);
  assert.equal(liveQuerySetReport.querySetEvidence?.uniqueQueryCount, 8);
  assert.equal(liveQuerySetReport.querySetEvidence?.duplicateQueryCount, 0);
  assert.equal(liveQuerySetReport.querySetEvidence?.unlabeledQueryCount, 0);
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
  assert.match(baselineRunEvidence, /hosted baseline run/i);
  assert.match(baselineRunEvidence, /baseline:run/i);
  assert.match(baselineRunEvidence, /reviewed-queryset|RECALLWEAVE_BASELINE_QUERYSET_REVIEWED/i);
  assert.match(baselineRunGeminiReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.match(baselinePacketEvidence, /baseline evidence packet/i);
  assert.match(baselinePacketEvidence, /baseline:packet/i);
  assert.match(baselinePacketGeminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.match(baselineReturnedPacketEvidence, /returned baseline evidence packet|returned hosted baseline packet/i);
  assert.match(baselineReturnedPacketEvidence, /baseline:returned-packet/i);
  assert.match(baselineReturnedPacketGeminiReview, /Verdict:\s*CLEAN|Verdict: `CLEAN`|^CLEAN/m);
  assert.match(baselineOpenAiReviewerEvidence, /OpenAI-compatible reviewer/i);
  assert.match(baselineOpenAiReviewerEvidence, /baseline:reviewer:openai-compatible/i);
  assert.match(baselineOpenAiReviewerEvidence, /env-only/i);
  assert.match(baselineReviewerApprovalIntakeEvidence, /reviewer approval intake/i);
  assert.match(baselineReviewerApprovalIntakeEvidence, /baseline-reviewer-approval-intake|baseline:reviewer-intake/i);
  assert.match(querySetEvidence, /baseline:queryset/i);
  assert.match(querySetEvidence, /publicBenchmarkReady/i);
  assert.match(querySetGeminiReview, /Verdict:\s*CLEAN|Verdict:\s*`?PASS`?|^CLEAN/m);
  assert.match(sourceMatchEvidence, /baseline:source-match/i);
  assert.match(sourceMatchEvidence, /sourceMatchReady/i);
  assert.match(sourceMatchGeminiReview, /Verdict:\s*`?CLEAN`?|Verdict:\s*`?PASS`?|^CLEAN/m);
  assert.match(sourceAlignmentEvidence, /baseline:source-align/i);
  assert.match(sourceAlignmentEvidence, /BLOCKED_CONTENT_DIVERGENT|matchedBaselineRunAllowed/i);
  assert.match(sourceAlignmentGeminiReview, /Verdict:\s*`?CLEAN`?|Verdict:\s*`?PASS`?|^CLEAN/m);
  assert.match(sourceGapEvidence, /baseline:source-gap/i);
  assert.match(sourceGapEvidence, /READY_FOR_MATCHED_BASELINE|BLOCKED_CONTENT_DIVERGENT|BLOCKED_SOURCE_ID_ONLY|BLOCKED_LABEL_MISMATCH/i);
  assert.match(sourceGapGeminiReview, /Verdict:\s*`?CLEAN`?|Verdict:\s*`?PASS`?|^CLEAN/m);
  assert.match(geminiReview, /Verdict: `CLEAN`|^CLEAN/m);
  assert.doesNotMatch(geminiReview, /pending external review/i);
  assert.doesNotMatch(querySetInspectResult.stdout, secretPattern);
  assert.doesNotMatch(querySetEvidence, secretPattern);
  assert.doesNotMatch(querySetGeminiReview, secretPattern);
  assert.doesNotMatch(sourceMatchResult.stdout, secretPattern);
  assert.doesNotMatch(sourceMatchEvidence, secretPattern);
  assert.doesNotMatch(sourceMatchGeminiReview, secretPattern);
  assert.doesNotMatch(sourceAlignmentResult.stdout, secretPattern);
  assert.doesNotMatch(sourceAlignmentEvidence, secretPattern);
  assert.doesNotMatch(sourceAlignmentGeminiReview, secretPattern);
  assert.doesNotMatch(sourceGapResult.stdout, secretPattern);
  assert.doesNotMatch(sourceGapEvidence, secretPattern);
  assert.doesNotMatch(sourceGapGeminiReview, secretPattern);
  assert.doesNotMatch(sourceMatchResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceMatchEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceMatchGeminiReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceAlignmentResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceAlignmentEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceAlignmentGeminiReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceGapResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceGapEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(sourceGapGeminiReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
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
  assert.doesNotMatch(hostedMirrorResult.stdout, secretPattern);
  assert.doesNotMatch(hostedMirrorResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(hostedMirrorEvidence, secretPattern);
  assert.doesNotMatch(hostedMirrorGeminiReview, secretPattern);
  assert.doesNotMatch(hostedMirrorCodexReview, secretPattern);
  assert.doesNotMatch(hostedMirrorEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(hostedMirrorGeminiReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(hostedMirrorCodexReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(JSON.stringify(liveDiscoveryReport), secretPattern);
  assert.doesNotMatch(JSON.stringify(liveDiscoveryReport), /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(JSON.stringify(liveQuerySetAuthorReport), secretPattern);
  assert.doesNotMatch(JSON.stringify(liveQuerySetAuthorReport), /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(JSON.stringify(liveQuerySetReport), secretPattern);
  assert.doesNotMatch(JSON.stringify(liveQuerySetReport), /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(liveDiscoveryEvidence, secretPattern);
  assert.doesNotMatch(livePrepEvidence, secretPattern);
  assert.doesNotMatch(livePrepGeminiReview, secretPattern);
  assert.doesNotMatch(liveDiscoveryGeminiReview, secretPattern);
  assert.doesNotMatch(collectorEvidence, secretPattern);
  assert.doesNotMatch(collectorGeminiReview, secretPattern);
  assert.doesNotMatch(recallWeaveExportEvidence, secretPattern);
  assert.doesNotMatch(recallWeaveExportGeminiReview, secretPattern);
  assert.doesNotMatch(recallWeaveCollectorEvidence, secretPattern);
  assert.doesNotMatch(recallWeaveCollectorGeminiReview, secretPattern);
  assert.doesNotMatch(comparisonResult.stdout, secretPattern);
  assert.doesNotMatch(looseReviewerComparisonResult.stdout, secretPattern);
  assert.doesNotMatch(matchedCollectorComparison.stdout, secretPattern);
  assert.doesNotMatch(comparisonEvidence, secretPattern);
  assert.doesNotMatch(comparisonGeminiReview, secretPattern);
  assert.doesNotMatch(labeledQuerySetGeminiReview, secretPattern);
  assert.doesNotMatch(operatorResult.stdout, secretPattern);
  assert.doesNotMatch(operatorMarkdown.stdout, secretPattern);
  assert.doesNotMatch(baselineRunResult.stdout, secretPattern);
  assert.doesNotMatch(baselineRunExportEnvResult.stdout, secretPattern);
  assert.doesNotMatch(baselineRunMarkdown.stdout, secretPattern);
  assert.doesNotMatch(baselineRunResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(baselineRunExportEnvResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(baselineRunMarkdown.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(operatorEvidence, secretPattern);
  assert.doesNotMatch(operatorGeminiReview, secretPattern);
  assert.doesNotMatch(baselineRunEvidence, secretPattern);
  assert.doesNotMatch(baselineRunGeminiReview, secretPattern);
  assert.doesNotMatch(baselineRunEvidence, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(baselineRunGeminiReview, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(nextRunResult.stdout, secretPattern);
  assert.doesNotMatch(nextRunMarkdown.stdout, secretPattern);
  assert.doesNotMatch(nextRunEvidence, secretPattern);
  assert.doesNotMatch(nextRunGeminiReview, secretPattern);
  assert.doesNotMatch(nextRunResult.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(nextRunMarkdown.stdout, /\/Users\/|\/Volumes\/|\/private\/|\/var\/folders\//);
  assert.doesNotMatch(baselinePacketResult.stdout, secretPattern);
  assert.doesNotMatch(baselinePacketReviewResult.stdout, secretPattern);
  assert.doesNotMatch(baselineReviewerIntakeResult.stdout, secretPattern);
  assert.doesNotMatch(baselineReviewerTemplateResult.stdout, secretPattern);
  assert.doesNotMatch(returnedBaselinePacketResult.stdout, secretPattern);
  assert.doesNotMatch(returnedBaselinePacketPathResult.stdout, secretPattern);
  assert.doesNotMatch(baselinePacketEvidence, secretPattern);
  assert.doesNotMatch(baselinePacketGeminiReview, secretPattern);
  assert.doesNotMatch(baselineReturnedPacketEvidence, secretPattern);
  assert.doesNotMatch(baselineReturnedPacketGeminiReview, secretPattern);
  assert.doesNotMatch(baselineOpenAiReviewerEvidence, secretPattern);
  assert.doesNotMatch(baselineReviewerApprovalIntakeEvidence, secretPattern);
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
  assert.ok(report.counts?.blocked >= 1);
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
        item.id === "hosted-baseline-live-prep" &&
        item.status === "proven" &&
        item.evidence.includes("packages/bench/hosted-baseline-queryset-author.mjs") &&
        item.evidence.includes("packages/bench/baseline-queryset-inspect.mjs") &&
        item.evidence.includes("reviews/overnight-20260522/hosted-baseline-live-prep-evidence.md"),
    ),
  );
  assert.ok(
    report.requirements.some(
      (item) =>
        item.id === "baseline-source-match-preflight" &&
        item.status === "proven" &&
        item.evidence.includes("packages/bench/baseline-source-match-preflight.mjs") &&
        item.evidence.includes("reviews/overnight-20260522/baseline-source-match-preflight-evidence.md") &&
        item.evidence.includes("reviews/overnight-20260522/gemini-baseline-source-match-preflight-review.md"),
    ),
  );
  assert.ok(
    report.requirements.some(
      (item) =>
        item.id === "baseline-source-gap-plan" &&
        item.status === "proven" &&
        item.evidence.includes("packages/bench/baseline-source-gap-plan.mjs") &&
        item.evidence.includes("reviews/overnight-20260522/baseline-source-gap-plan-evidence.md") &&
        item.evidence.includes("reviews/overnight-20260522/gemini-baseline-source-gap-plan-review.md"),
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
    report.requirements.some(
      (item) =>
        item.id === "canary-strict-real-drill" &&
        item.status === "proven" &&
        item.evidence.includes("packages/bench/canary-drill.mjs") &&
        item.evidence.includes("reviews/overnight-20260522/canary-drill-evidence.md") &&
        item.evidence.includes("reviews/overnight-20260522/gemini-canary-drill-review.md"),
    ),
  );
  assert.ok(
    report.requirements.some(
      (item) =>
        item.id === "hosted-baseline-reviewed-comparison" &&
        item.status === "proven" &&
        item.evidence.includes("reviews/overnight-20260522/reviewer-work/budgeted-baseline-reviewed-comparison.json") &&
        item.evidence.includes("reviews/overnight-20260522/reviewer-work/budgeted-baseline-reviewed-packet-review.json") &&
        item.evidence.includes("reviews/overnight-20260522/reviewer-work/budgeted-baseline-reviewed-next-run.json"),
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

check("public docs and evidence private path scan has zero hits", () => {
  const hits = [];
  for (const file of files) {
    if (!textExtensions.has(extname(file))) continue;
    const rel = relative(root, file).replaceAll("\\", "/");
    if (!publicTextPathPattern.test(rel)) continue;
    const text = readFileSync(file, "utf8");
    if (absolutePrivatePathPattern.test(text)) hits.push(rel);
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

function cleanupStaleRecallWeaveTempRoots(roots, { maxAgeMs }) {
  const now = Date.now();
  const seen = new Set();
  const report = {
    ok: true,
    mode: "release-temp-cleanup-guard",
    metricsOnly: true,
    printsPaths: false,
    onlyRecallWeavePrefix: true,
    maxAgeMs,
    rootCount: 0,
    candidates: 0,
    removed: 0,
    skippedYoung: 0,
    skippedSymlink: 0,
    skippedError: 0,
  };

  for (const rootPath of roots) {
    if (!rootPath || seen.has(rootPath) || !existsSync(rootPath)) continue;
    seen.add(rootPath);
    report.rootCount += 1;
    for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
      if (!entry.name.startsWith("recallweave-")) continue;
      report.candidates += 1;
      const candidate = join(rootPath, entry.name);
      try {
        const stat = lstatSync(candidate);
        if (stat.isSymbolicLink()) {
          report.skippedSymlink += 1;
          continue;
        }
        if (now - stat.mtimeMs < maxAgeMs) {
          report.skippedYoung += 1;
          continue;
        }
        rmSync(candidate, { recursive: true, force: true });
        report.removed += 1;
      } catch {
        report.skippedError += 1;
      }
    }
  }

  return report;
}

function assertNativeMemory(value) {
  assert.equal(value?.providerId, "selfmem_canary");
  assert.equal(value?.defaultActive, true);
  assert.equal(value?.shadowOnly, false);
  assert.equal(value?.newWrites, "local");
  assert.equal(value?.hostedWriteBack, false);
  assert.ok(Array.isArray(value?.proof), "native memory proof must be present");
  assert.ok(value.proof.includes("explicit-native-default-config"));
  assert.ok(value.proof.includes("before-prompt-lifecycle-fired"));
  assert.ok(value.proof.includes("local-store-events-observed"));
}

function writeUnknownZip(tempRoot, outputPath) {
  writeFileSync(join(tempRoot, "plain-export.txt"), "plain diagnostic export, not a returned canary packet\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  const result = spawnSync("zip", ["-q", "-X", outputPath, "plain-export.txt"], {
    cwd: tempRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, `zip failed\n${result.stderr}\n${result.stdout}`);
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

function isAllowedPostBaselineCodePath(file, allowedCodePaths) {
  return allowedCodePaths.has(file) && (
    file === ".gitignore" ||
    file === ".env.example" ||
    file === "configs/default.local.yaml" ||
    file === "configs/provider-matrix.yaml" ||
    file === "package.json" ||
    file === "packages/brain-ui/fixtures/model-matrix.json" ||
    file === "packages/brain-ui/interaction-smoke.mjs" ||
    file === "packages/brain-ui/smoke.mjs" ||
    file.startsWith("packages/bench/") ||
    file.startsWith("tests/bench/") ||
    file === "plugins/selfmem-fallback/scripts/selfmem_update.py"
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
  return [".git", ".goal-loop-review", ".automation-worktrees", "node_modules", "coverage"].includes(name);
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
