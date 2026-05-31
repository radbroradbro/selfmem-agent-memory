import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  utimesSync,
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
const releaseCheckTempPrefix = "recallweave-release-check-root-";
const staleTempCleanupReport = cleanupStaleReleaseCheckTempRoots([originalTmpDir, "/private/tmp"], {
  maxAgeMs: Number(process.env.RECALLWEAVE_RELEASE_TEMP_MAX_AGE_MS ?? 30 * 60 * 1000),
});
const releaseTempRoot = mkdtempSync(join(originalTmpDir, releaseCheckTempPrefix));
process.env.TMPDIR = releaseTempRoot;
process.env.TMP = releaseTempRoot;
process.env.TEMP = releaseTempRoot;

process.on("exit", () => {
  try {
    rmSync(releaseTempRoot, { recursive: true, force: true });
  } catch {
    // Best effort only. The next release check removes stale release-check temp roots.
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
  "packages/bench/public-benchmark-reported-targets.mjs",
  "packages/bench/public-benchmark-materialize-run.mjs",
  "packages/bench/public-benchmark-strategy-compare.mjs",
  "packages/bench/provider-benchmark-live-preflight.mjs",
  "packages/bench/provider-wave-intake.mjs",
  "packages/bench/agentic-memory-target-watch.mjs",
  "packages/bench/agentic-memory-ingest-contract.mjs",
  "packages/bench/agentic-memory-source-lock-check.mjs",
  "packages/bench/agentic-memory-source-lock-decision.mjs",
  "packages/bench/agentic-memory-provider-autoresearch-plan.mjs",
  "packages/bench/memory-score-reviewer-approval-intake.mjs",
  "packages/bench/memory-score-openai-compatible-reviewer.mjs",
  "packages/bench/end-to-end-memory-score-gate.mjs",
  "packages/bench/public-benchmark-autoresearch-loop.mjs",
  "packages/bench/full-memory-sota-doctor.mjs",
  "packages/bench/public-benchmark-answer-quality-arm-export.mjs",
  "packages/bench/public-benchmark-answer-quality-preflight.mjs",
  "packages/bench/public-benchmark-answer-quality.mjs",
  "packages/bench/public-benchmark-answer-quality-combine.mjs",
  "packages/bench/public-benchmark-answer-quality-shard-plan.mjs",
  "packages/bench/public-benchmark-answer-quality-shard-workorder.mjs",
  "packages/bench/local-full-shard-resume-packet.mjs",
  "packages/bench/local-full-shard-resume-env-doctor.mjs",
  "packages/bench/local-full-shard-resume-command-materializer.mjs",
  "packages/bench/local-full-shard-resume-command-security-doctor.mjs",
  "packages/bench/local-full-shard-resume-result-doctor.mjs",
  "packages/bench/local-full-shard-performance-report.mjs",
  "packages/bench/public-benchmark-answer-quality-shard-intake.mjs",
  "packages/bench/full-shard-private-input-doctor.mjs",
  "packages/bench/full-shard-accepted-lane-launch-doctor.mjs",
  "packages/bench/full-shard-control-export-probe.mjs",
  "packages/bench/codex-lifecycle-audit.mjs",
  "packages/bench/local-embedding-runtime-doctor.mjs",
  "packages/bench/local-embedding-durability-smoke.mjs",
  "packages/bench/local-rerank-durability-smoke.mjs",
  "packages/bench/local-openai-rerank-sidecar.mjs",
  "packages/bench/fixtures/baseline-reviewer-approval-a.fixture.json",
  "packages/bench/fixtures/public-benchmark-target.fixture.json",
  `${reviewDir}/public-memorybench-source-lock.json`,
  `${reviewDir}/public-memorybench-source-lock-evidence.md`,
  `${reviewDir}/public-memorybench-source-lock-checkout-evidence.json`,
  `${reviewDir}/reported-memory-targets-20260525.json`,
  `${reviewDir}/reported-memory-targets-20260525.md`,
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
  `${reviewDir}/provider-wave-intake-20260531.json`,
  `${reviewDir}/provider-wave-intake-20260531.md`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider-preflight.json`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider-preflight.md`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider.json`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider.md`,
  `${reviewDir}/public-longmemeval-expanded-voyage-latency-live-provider-evidence.md`,
  `${reviewDir}/public-longmemeval-expanded-autoresearch-loop.json`,
  `${reviewDir}/public-longmemeval-expanded-autoresearch-loop-evidence.md`,
  `${reviewDir}/agentic-memory-target-watch-20260529.json`,
  `${reviewDir}/agentic-memory-target-watch-20260529.md`,
  `${reviewDir}/agentic-memory-ingest-contract-20260529.json`,
  `${reviewDir}/agentic-memory-ingest-contract-20260529.md`,
  `${reviewDir}/agentic-memory-source-lock-20260529.json`,
  `${reviewDir}/agentic-memory-source-lock-20260529.md`,
  `${reviewDir}/agentic-memory-source-lock-decision-20260529.json`,
  `${reviewDir}/agentic-memory-source-lock-decision-20260529.md`,
  `${reviewDir}/agentic-memory-source-lock-live-20260529.json`,
  `${reviewDir}/agentic-memory-source-lock-live-20260529.md`,
  `${reviewDir}/agentic-memory-provider-autoresearch-plan-20260529.json`,
  `${reviewDir}/agentic-memory-provider-autoresearch-plan-20260529.md`,
  `${reviewDir}/public-longmemeval-full-slice-evidence.json`,
  `${reviewDir}/public-longmemeval-full-slice-evidence.md`,
  `${reviewDir}/public-longmemeval-full-run-target.json`,
  `${reviewDir}/public-longmemeval-full-run-target-check.json`,
  `${reviewDir}/public-longmemeval-full-materialize-run.json`,
  `${reviewDir}/public-longmemeval-full-materialize-run-evidence.md`,
  `${reviewDir}/answer-quality-full-shard-plan-20260525.json`,
  `${reviewDir}/answer-quality-full-shard-plan-20260525.md`,
  `${reviewDir}/answer-quality-local-full-shard-plan-20260526.json`,
  `${reviewDir}/answer-quality-local-full-shard-plan-20260526.md`,
  `${reviewDir}/answer-quality-local-full-shard-workorder-20260526.json`,
  `${reviewDir}/answer-quality-local-full-shard-workorder-20260526.md`,
  `${reviewDir}/local-full-shard-002-resume-packet-20260526.json`,
  `${reviewDir}/local-full-shard-002-resume-packet-20260526.md`,
  `${reviewDir}/local-full-shard-002-resume-env-doctor-20260526.json`,
  `${reviewDir}/local-full-shard-002-resume-env-doctor-20260526.md`,
  `${reviewDir}/local-full-shard-002-resume-command-materializer-20260526.json`,
  `${reviewDir}/local-full-shard-002-resume-command-materializer-20260526.md`,
  `${reviewDir}/local-full-shard-002-resume-command-security-20260526.json`,
  `${reviewDir}/local-full-shard-002-resume-command-security-20260526.md`,
  `${reviewDir}/local-full-shard-002-resume-result-doctor-20260526.json`,
  `${reviewDir}/local-full-shard-002-resume-result-doctor-20260526.md`,
  `${reviewDir}/local-full-shard-003-resume-packet-20260526.json`,
  `${reviewDir}/local-full-shard-003-resume-packet-20260526.md`,
  `${reviewDir}/local-full-shard-003-resume-command-materializer-20260526.json`,
  `${reviewDir}/local-full-shard-003-resume-command-materializer-20260526.md`,
  `${reviewDir}/local-full-shard-003-resume-command-security-20260526.json`,
  `${reviewDir}/local-full-shard-003-resume-command-security-20260526.md`,
  `${reviewDir}/local-full-shard-003-resume-env-doctor-20260527.json`,
  `${reviewDir}/local-full-shard-003-resume-env-doctor-20260527.md`,
  `${reviewDir}/local-full-shard-performance-report-20260526.json`,
  `${reviewDir}/local-full-shard-performance-report-20260526.md`,
  `${reviewDir}/local-full-shard-performance-report-20260527.json`,
  `${reviewDir}/local-full-shard-performance-report-20260527.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-020-20260529.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-020-20260529.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-019-20260529.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-019-20260529.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-018-20260529.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-018-20260529.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-017-20260529.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-017-20260529.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-016-20260529.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-016-20260529.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-013-20260528.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-013-20260528.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-012-20260528.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-012-20260528.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-011-20260528.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-011-20260528.md`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-010-20260528.json`,
  `${reviewDir}/local-full-shard-performance-report-after-shard-010-20260528.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-20260526.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-20260526.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-001-20260526.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-001-20260526.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526.md`,
  `${reviewDir}/answer-quality-local-full-shard-002-runtime-blocker-20260526.json`,
  `${reviewDir}/answer-quality-local-full-shard-002-runtime-blocker-20260526.md`,
  `${reviewDir}/answer-quality-local-full-shard-003-runtime-blocker-20260526.json`,
  `${reviewDir}/answer-quality-local-full-shard-003-runtime-blocker-20260526.md`,
  `${reviewDir}/answer-quality-local-full-shard-003-arm-export-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-003-arm-export-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-003-preflight-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-003-preflight-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-003-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-003-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-003-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-003-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-020-arm-export-20260529.json`,
  `${reviewDir}/answer-quality-local-full-shard-020-arm-export-20260529.md`,
  `${reviewDir}/answer-quality-local-full-shard-020-20260529.json`,
  `${reviewDir}/answer-quality-local-full-shard-020-20260529.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-020-20260529.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-020-20260529.md`,
  `${reviewDir}/end-to-end-memory-score-local-full-shard-020-20260529.json`,
  `${reviewDir}/end-to-end-memory-score-local-full-shard-020-20260529.md`,
  `${reviewDir}/end-to-end-memory-score-local-full-combined-20260529.json`,
  `${reviewDir}/end-to-end-memory-score-local-full-combined-20260529.md`,
  `${reviewDir}/end-to-end-memory-score-local-full-combined-gate-20260529.json`,
  `${reviewDir}/end-to-end-memory-score-local-full-combined-gate-20260529.md`,
  `${reviewDir}/end-to-end-memory-score-local-full-combined-20260531.json`,
  `${reviewDir}/end-to-end-memory-score-local-full-combined-20260531.md`,
  `${reviewDir}/end-to-end-memory-score-local-full-gate-20260531.json`,
  `${reviewDir}/end-to-end-memory-score-local-full-gate-20260531.md`,
  `${reviewDir}/local-embedding-runtime-doctor-shard020-20260529.json`,
  `${reviewDir}/local-embedding-runtime-doctor-shard020-20260529.md`,
  `${reviewDir}/local-embedding-durability-smoke-shard020-20260529.json`,
  `${reviewDir}/local-embedding-durability-smoke-shard020-20260529.md`,
  `${reviewDir}/local-rerank-durability-smoke-shard020-20260529.json`,
  `${reviewDir}/local-rerank-durability-smoke-shard020-20260529.md`,
  `${reviewDir}/answer-quality-local-full-shard-005-common-arm-projection-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-005-common-arm-projection-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-005-common-arm-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-005-common-arm-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-006-arm-export-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-006-arm-export-20260527.md`,
  `${reviewDir}/answer-quality-local-full-preflight-shard-006-20260527.json`,
  `${reviewDir}/answer-quality-local-full-preflight-shard-006-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-006-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-006-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-006-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-006-20260527.md`,
  `${reviewDir}/local-embedding-runtime-doctor-shard006-20260527.json`,
  `${reviewDir}/local-embedding-runtime-doctor-shard006-20260527.md`,
  `${reviewDir}/local-embedding-durability-smoke-shard006-20260527.json`,
  `${reviewDir}/local-embedding-durability-smoke-shard006-20260527.md`,
  `${reviewDir}/local-rerank-durability-smoke-shard006-20260527.json`,
  `${reviewDir}/local-rerank-durability-smoke-shard006-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-007-arm-export-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-007-arm-export-20260527.md`,
  `${reviewDir}/answer-quality-local-full-preflight-shard-007-20260527.json`,
  `${reviewDir}/answer-quality-local-full-preflight-shard-007-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-007-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-007-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-007-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-007-20260527.md`,
  `${reviewDir}/local-embedding-runtime-doctor-shard007-20260527.json`,
  `${reviewDir}/local-embedding-runtime-doctor-shard007-20260527.md`,
  `${reviewDir}/local-embedding-durability-smoke-shard007-20260527.json`,
  `${reviewDir}/local-embedding-durability-smoke-shard007-20260527.md`,
  `${reviewDir}/local-rerank-durability-smoke-shard007-20260527.json`,
  `${reviewDir}/local-rerank-durability-smoke-shard007-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-008-arm-export-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-008-arm-export-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-008-preflight-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-008-preflight-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-008-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-008-20260527.md`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-008-20260527.json`,
  `${reviewDir}/answer-quality-local-full-shard-intake-after-shard-008-20260527.md`,
  `${reviewDir}/local-embedding-runtime-doctor-shard008-20260527.json`,
  `${reviewDir}/local-embedding-runtime-doctor-shard008-20260527.md`,
  `${reviewDir}/local-embedding-durability-smoke-shard008-20260527.json`,
  `${reviewDir}/local-embedding-durability-smoke-shard008-20260527.md`,
  `${reviewDir}/local-rerank-durability-smoke-shard008-20260527.json`,
  `${reviewDir}/local-rerank-durability-smoke-shard008-20260527.md`,
  `${reviewDir}/local-embedding-runtime-doctor-20260526.json`,
  `${reviewDir}/local-embedding-runtime-doctor-20260526.md`,
  `${reviewDir}/local-embedding-runtime-doctor-20260527.json`,
  `${reviewDir}/local-embedding-runtime-doctor-20260527.md`,
  `${reviewDir}/local-embedding-launch-diagnostic-20260526.json`,
  `${reviewDir}/local-embedding-launch-diagnostic-20260526.md`,
  `${reviewDir}/local-embedding-durability-smoke-20260526.json`,
  `${reviewDir}/local-embedding-durability-smoke-20260526.md`,
  `${reviewDir}/local-embedding-durability-smoke-20260527.json`,
  `${reviewDir}/local-embedding-durability-smoke-20260527.md`,
  `${reviewDir}/local-rerank-durability-smoke-20260526.json`,
  `${reviewDir}/local-rerank-durability-smoke-20260526.md`,
  `${reviewDir}/local-rerank-durability-smoke-20260527.json`,
  `${reviewDir}/local-rerank-durability-smoke-20260527.md`,
  `${reviewDir}/local-full-accepted-lane-launch-doctor-20260526.json`,
  `${reviewDir}/local-full-accepted-lane-launch-doctor-20260526.md`,
  `${reviewDir}/full-shard-private-input-doctor-current.json`,
  `${reviewDir}/full-shard-private-input-doctor-current.md`,
  `${reviewDir}/full-shard-bm25-control-export-probe-20260526.json`,
  `${reviewDir}/full-shard-bm25-control-export-probe-20260526.md`,
  `${reviewDir}/full-shard-control-export-probe-20260526.json`,
  `${reviewDir}/full-shard-control-export-probe-20260526.md`,
  `${reviewDir}/full-shard-control-answer-quality-preflight-20260526.json`,
  `${reviewDir}/full-shard-control-answer-quality-preflight-20260526.md`,
  `${reviewDir}/full-shard-accepted-lane-launch-doctor-20260526.json`,
  `${reviewDir}/full-shard-accepted-lane-launch-doctor-20260526.md`,
  `${reviewDir}/answer-quality-full-shard-workorder-20260525.json`,
  `${reviewDir}/answer-quality-full-shard-workorder-20260525.md`,
  `${reviewDir}/answer-quality-full-shard-intake-20260525.json`,
  `${reviewDir}/answer-quality-full-shard-intake-20260525.md`,
  `${reviewDir}/sota-ladder-full-target-report-20260525.json`,
  `${reviewDir}/sota-ladder-full-target-report-20260525.md`,
  `${reviewDir}/sota-ladder-full-target-operator-packet-20260525.json`,
  `${reviewDir}/sota-ladder-full-target-operator-packet-20260525.md`,
  `${reviewDir}/full-memory-sota-doctor-20260526.json`,
  `${reviewDir}/full-memory-sota-doctor-20260526.md`,
  `${reviewDir}/full-memory-sota-doctor-20260527.json`,
  `${reviewDir}/full-memory-sota-doctor-20260527.md`,
  `${reviewDir}/full-memory-sota-doctor-after-local-full-combine-20260531.json`,
  `${reviewDir}/full-memory-sota-doctor-after-local-full-combine-20260531.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-020-20260529.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-020-20260529.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-019-20260529.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-019-20260529.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-018-20260529.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-018-20260529.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-017-20260529.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-017-20260529.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-016-20260529.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-016-20260529.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-013-20260528.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-013-20260528.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-012-20260528.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-012-20260528.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-011-20260528.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-011-20260528.md`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-010-20260528.json`,
  `${reviewDir}/full-memory-sota-doctor-after-shard-010-20260528.md`,
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
  `${reviewDir}/codex-lifecycle-audit-20260526.json`,
  `${reviewDir}/codex-lifecycle-audit-20260526.md`,
  `${reviewDir}/public-longmemeval-wiki-amplification-fixture-20260526.json`,
  `${reviewDir}/public-longmemeval-wiki-amplification-fixture-20260526.md`,
  `${reviewDir}/brain-ui-sanity-20260526.png`,
  `${reviewDir}/brain-ui-mobile-overflow-evidence-20260526.md`,
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
  `${reviewDir}/local-wiki-method-report-20260527.json`,
  `${reviewDir}/local-wiki-method-report-20260527.md`,
  `${reviewDir}/local-wiki-method-report-after-shard-020-20260529.json`,
  `${reviewDir}/local-wiki-method-report-after-shard-020-20260529.md`,
  `${reviewDir}/local-wiki-method-report-after-shard-019-20260529.json`,
  `${reviewDir}/local-wiki-method-report-after-shard-019-20260529.md`,
  `${reviewDir}/local-wiki-method-report-after-shard-018-20260529.json`,
  `${reviewDir}/local-wiki-method-report-after-shard-018-20260529.md`,
  `${reviewDir}/local-wiki-method-report-after-shard-017-20260529.json`,
  `${reviewDir}/local-wiki-method-report-after-shard-017-20260529.md`,
  `${reviewDir}/local-wiki-method-report-after-shard-016-20260529.json`,
  `${reviewDir}/local-wiki-method-report-after-shard-016-20260529.md`,
  `${reviewDir}/local-wiki-method-report-20260528.json`,
  `${reviewDir}/local-wiki-method-report-20260528.md`,
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
  "codex:lifecycle:audit",
  "codex:lifecycle:audit:local",
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
  "benchmark:reported-targets",
  "benchmark:public-slice",
  "benchmark:public-target",
  "benchmark:public-target:author",
  "benchmark:public-materialize",
  "benchmark:public-strategy",
  "benchmark:public-wiki-amplification",
  "benchmark:public-wiki-amplification:live",
  "benchmark:public-provider:preflight",
  "benchmark:public-provider:packet",
  "benchmark:public-provider",
  "benchmark:provider-wave-intake",
  "benchmark:public-autoresearch",
  "benchmark:agentic-watch",
  "benchmark:agentic-ingest-contract",
  "benchmark:agentic-source-lock",
  "benchmark:agentic-source-lock-decision",
  "benchmark:agentic-provider-plan",
  "benchmark:answer-quality:arms",
  "benchmark:answer-quality:preflight",
  "benchmark:answer-quality",
  "benchmark:answer-quality:combine",
  "benchmark:answer-quality:shard-plan",
  "benchmark:answer-quality:local-shard-plan",
  "benchmark:answer-quality:local-wiki-shard-plan",
  "benchmark:answer-quality:shard-workorder",
  "benchmark:answer-quality:local-shard-workorder",
  "benchmark:answer-quality:local-shard-resume-packet",
  "benchmark:answer-quality:local-shard-resume-env",
  "benchmark:answer-quality:local-shard-resume-command",
  "benchmark:answer-quality:local-shard-resume-command-security",
  "benchmark:answer-quality:local-shard-resume-result",
  "benchmark:answer-quality:local-shard-performance",
  "benchmark:answer-quality:local-common-arm-projection",
  "benchmark:answer-quality:local-topic-ledger",
  "benchmark:answer-quality:local-wiki-method",
  "benchmark:answer-quality:shard-intake",
  "benchmark:answer-quality:local-shard-intake",
  "benchmark:answer-quality:private-input-doctor",
  "benchmark:answer-quality:accepted-lane-doctor",
  "benchmark:answer-quality:local-accepted-lane-doctor",
  "benchmark:answer-quality:control-probe",
  "benchmark:query-expansion:preflight",
  "benchmark:query-expansion:result-gate",
  "benchmark:local-embedding:runtime-doctor",
  "benchmark:local-embedding:durability",
  "benchmark:local-rerank:durability",
  "benchmark:local-rerank:result-gate",
  "benchmark:provider-challenger:result-gate",
  "benchmark:memory-score:result-gate",
  "benchmark:memory-score:reviewer-intake",
  "benchmark:memory-score:reviewer:openai-compatible",
  "benchmark:sota-ladder",
  "benchmark:sota-ladder:packet",
  "benchmark:sota-doctor",
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
  assert.equal(staleTempCleanupReport.onlyReleaseCheckRootPrefix, true);
  assert.equal(staleTempCleanupReport.cleanupPrefix, releaseCheckTempPrefix);
  assert.ok(staleTempCleanupReport.maxAgeMs >= 0);

  const guardRoot = mkdtempSync(join(tmpdir(), "recallweave-cleanup-guard-"));
  try {
    const protectedBenchmarkDir = join(guardRoot, "recallweave-sota-full-20260526T000000Z");
    const protectedPointerFile = join(guardRoot, "recallweave-sota-full-current-path");
    const staleReleaseRoot = join(guardRoot, `${releaseCheckTempPrefix}old`);
    mkdirSync(protectedBenchmarkDir, { recursive: true, mode: 0o700 });
    writeFileSync(protectedPointerFile, `${protectedBenchmarkDir}\n`, { encoding: "utf8", mode: 0o600 });
    mkdirSync(staleReleaseRoot, { recursive: true, mode: 0o700 });
    const oldDate = new Date(0);
    utimesSync(staleReleaseRoot, oldDate, oldDate);

    const cleanupProbe = cleanupStaleReleaseCheckTempRoots([guardRoot], { maxAgeMs: 0 });
    assert.equal(cleanupProbe.ok, true);
    assert.equal(cleanupProbe.candidates, 1);
    assert.equal(cleanupProbe.removed, 1);
    assert.equal(existsSync(staleReleaseRoot), false);
    assert.equal(existsSync(protectedBenchmarkDir), true);
    assert.equal(existsSync(protectedPointerFile), true);
  } finally {
    rmSync(guardRoot, { recursive: true, force: true });
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

check("query expansion response parser accepts local model rewrites", () => {
  const smoke = run("node", ["packages/bench/recallweave-response-export.mjs", "--query-expansion-parser-smoke"]);
  const report = JSON.parse(smoke.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "query-expansion-parser-smoke");
  assert.equal(report.acceptsJsonArrayPerLine, true);
  assert.equal(report.acceptsPlainLines, true);
  assert.ok(report.cases >= 5);
});

check("fresh Codex lifecycle audit fixture passes", () => {
  const checked = JSON.parse(readFileSync(join(root, reviewDir, "codex-lifecycle-audit-20260526.json"), "utf8"));
  const markdown = readFileSync(join(root, reviewDir, "codex-lifecycle-audit-20260526.md"), "utf8");
  const fresh = JSON.parse(run("node", ["packages/bench/codex-lifecycle-audit.mjs", "--fixture", "--strict"]).stdout);

  for (const report of [checked, fresh]) {
    assert.equal(report.ok, true);
    assert.equal(report.status, "READY_CODEX_PROMPT_STOP_LIFECYCLE_AUDIT");
    assert.equal(report.promptStopReady, true);
    assert.equal(report.fixtureOnly, true);
    assert.equal(report.hooks?.userPromptSubmitRecallHook, true);
    assert.equal(report.hooks?.stopFlushHook, true);
    assert.equal(report.lcm?.codexPreCompactHookObserved, false);
    assert.equal(report.lcm?.codexPreCompactStatus, "NOT_EXPOSED_BY_CURRENT_CODEX_HOOKS");
    assert.equal(report.lcm?.stopFlushPreservesRedactedSessionCopy, true);
    assert.equal(report.lcm?.defaultRecallUsesDistilledMemory, true);
    assert.equal(report.lcm?.rawSessionAuditLocalOnly, true);
    assert.equal(report.lcm?.deepseekFlashCompressionArm?.provider, "deepseek");
    assert.equal(report.lcm?.deepseekFlashCompressionArm?.model, "deepseek-v4-flash");
    assert.equal(report.lcm?.deepseekFlashCompressionArm?.defaultEnabled, false);
    assert.equal(report.lcm?.deepseekFlashCompressionArm?.countsAsBenchmarkEvidence, false);
    assert.equal(report.modifiesBenchmarkRetrieval, false);
    assert.equal(report.modifiesBenchmarkScoring, false);
    assert.equal(report.countsAsBenchmarkEvidence, false);
    assert.equal(report.publicBenchmarkClaimsAllowed, false);
    assert.equal(report.bridge?.hostedWriteBackDisabled, true);
    assert.equal(report.privacy?.privateLeakCount, 0);
    assert.deepEqual(report.blockers, []);
  }

  assert.match(markdown, /DeepSeek v4 flash/i);
  assert.match(markdown, /optional-offline-distillation-arm-after-redaction/i);
  assert.match(markdown, /Modifies benchmark retrieval: false/i);
  assert.match(markdown, /Counts as benchmark evidence: false/i);
  assert.match(markdown, /Blockers\s*\n- none/i);
});

check("fresh wiki amplification fixture keeps BM25 control honest", () => {
  const expectedStrategies = [
    "bm25-lite",
    "full-hybrid-rerank",
    "wiki-title-amplified-hybrid",
    "wiki-subtopic-amplified-hybrid",
    "wiki-summary-session-hybrid",
  ];
  const args = [
    "packages/bench/public-benchmark-strategy-compare.mjs",
    "--fixture",
    "--gate",
    "hybrid",
    "--strategies",
    expectedStrategies.join(","),
  ];
  const checked = JSON.parse(
    readFileSync(join(root, reviewDir, "public-longmemeval-wiki-amplification-fixture-20260526.json"), "utf8"),
  );
  const markdown = readFileSync(join(root, reviewDir, "public-longmemeval-wiki-amplification-fixture-20260526.md"), "utf8");
  const fresh = JSON.parse(run("node", args).stdout);

  for (const report of [checked, fresh]) {
    assert.equal(report.ok, true);
    assert.equal(report.fixtureOnly, true);
    assert.equal(report.gate, "hybrid");
    assert.equal(report.retrievalProxyOnly, true);
    assert.equal(report.memoryBenchAnswerQuality, false);
    assert.equal(report.publicBenchmarkClaimsAllowed, false);
    assert.equal(report.input?.queryCount, 3);
    assert.equal(report.input?.haystackSessionCount, 6);
    assert.equal(report.control?.strategy, "bm25-lite");
    assert.equal(report.promotion?.kind, "hybrid");
    assert.equal(report.comparisonContract?.sameDataControlsRequired, true);
    assert.equal(report.comparisonContract?.bm25ControlPresent, true);
    assert.equal(report.safety?.publicSafe, true);
    assert.equal(report.safety?.metricsOnly, true);
    for (const strategy of expectedStrategies) {
      assert.ok(report.strategies?.some((item) => item.strategy === strategy), `missing strategy ${strategy}`);
    }
    for (const strategy of report.strategies ?? []) {
      assert.equal(strategy.privacyLeakCount, 0, `${strategy.strategy} leaked private text`);
      assert.equal(strategy.redactionFailureCount, 0, `${strategy.strategy} had redaction failures`);
    }
  }

  assert.match(markdown, /wiki-title-amplified-hybrid/);
  assert.match(markdown, /wiki-subtopic-amplified-hybrid/);
  assert.match(markdown, /wiki-summary-session-hybrid/);
  assert.match(markdown, /Retrieval proxy only: true/i);
  assert.match(markdown, /Public benchmark claims allowed: false/i);
});

check("fresh local wiki shard plan is ready without SOTA overclaim", () => {
  const strategies = [
    "bm25-lite",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
    "wiki-title-amplified-hybrid",
    "wiki-subtopic-amplified-hybrid",
    "wiki-summary-session-hybrid",
    "local-apple-qwen3-0_6b",
    "local-apple-qwen3-0_6b-local-rerank",
  ];
  const report = JSON.parse(
    run("node", [
      "packages/bench/public-benchmark-answer-quality-shard-plan.mjs",
      "--claim-scope",
      "local-full",
      "--require-ready",
      "--strategies",
      strategies.join(","),
    ]).stdout,
  );
  assert.equal(report.ok, true);
  assert.equal(report.status, "READY_FULL_ANSWER_QUALITY_SHARD_RUN");
  assert.equal(report.claimScope, "local-full");
  assert.equal(report.readyForAnswerQualityShardRun, true);
  assert.equal(report.countsAsFullMemorySotaEvidence, false);
  assert.equal(report.publicBenchmarkClaimsAllowed, false);
  assert.equal(report.callsProviderApis, false);
  assert.equal(report.sendsBenchmarkTextToProvider, false);
  assert.equal(report.strategyCoverage?.hasBm25Lite, true);
  assert.equal(report.strategyCoverage?.hasFullHybridRerank, true);
  assert.equal(report.strategyCoverage?.hasQueryExpansion, true);
  assert.equal(report.strategyCoverage?.hasWikiAmplification, true);
  assert.equal(report.strategyCoverage?.hasLocalApple, true);
  assert.equal(report.strategyCoverage?.hasLocalRerank, true);
  assert.equal(report.strategyCoverage?.hasVoyageProvider, false);
  assert.equal(report.strategyCoverage?.hasNvidiaOrGeminiProvider, false);
  assert.equal(report.runPlan?.queryCount, 500);
  assert.equal(report.runPlan?.shardSize, 25);
  assert.equal(report.runPlan?.shardCount, 20);
  assert.deepEqual(report.runPlan?.strategies, strategies);
  const localLane = report.executionLanes?.find((lane) => lane.id === "local-full-accepted-shards");
  assert.equal(localLane?.coverageReady, true);
  assert.equal(localLane?.acceptedByFullShardIntake, true);
  assert.equal(localLane?.canReachFullSotaGateAfterShardIntake, false);
  assert.match(localLane?.shardIntakeCompatibility ?? "", /local full benchmark plan only/i);
  assert.deepEqual(report.blockers, []);
});

check("fresh local wiki method report preserves benchmark boundaries", () => {
  const checked = JSON.parse(readFileSync(join(root, reviewDir, "local-wiki-method-report-after-shard-020-20260529.json"), "utf8"));
  const markdown = readFileSync(join(root, reviewDir, "local-wiki-method-report-after-shard-020-20260529.md"), "utf8");
  const fresh = JSON.parse(run("node", ["packages/bench/local-wiki-method-report.mjs"]).stdout);

  for (const report of [checked, fresh]) {
    assert.equal(report.ok, true);
    assert.equal(report.mode, "local-wiki-method-report");
    assert.equal(report.status, "WIKI_METHOD_SHARD_EVALUATED");
    assert.equal(report.metricsOnly, true);
    assert.equal(report.publicSafe, true);
    assert.equal(report.callsHostedSupermemory, false);
    assert.equal(report.sendsBenchmarkTextToProvider, false);
    assert.equal(report.rawQuestionsIncluded, false);
    assert.equal(report.rawAnswersIncluded, false);
    assert.equal(report.rawMemoryIncluded, false);
    assert.equal(report.countsAsLocalFullBenchmarkEvidence, true);
    assert.equal(report.countsAsFullMemorySotaEvidence, false);
    assert.equal(report.publicBenchmarkClaimsAllowed, false);
    assert.equal(report.methodIsolation?.hostedSupermemorySearchDisabled, true);
    assert.equal(report.methodIsolation?.compatibleWithLegacyShardIntake, false);
    assert.equal(report.comparisons?.bestStrategy, "local-apple-qwen3-0_6b-local-rerank");
    assert.equal(report.comparisons?.localAppleLocalRerank?.winsVsBm25, true);
    assert.equal(report.comparisons?.wikiTitle?.winsVsBm25, false);
    assert.equal(report.comparisons?.wikiSubtopic?.winsVsBm25, false);
    assert.equal(report.comparisons?.wikiSummarySession?.winsVsBm25, false);
    assert.ok(report.decisions?.some((item) => item.id === "wiki-title-amplification" && item.status === "negative-signal"));
    assert.ok(report.decisions?.some((item) => item.id === "wiki-subtopic-amplification" && item.status === "not-yet-positive"));
    assert.ok(report.observedArmSnapshot?.some((item) => item.strategy === "bm25-lite" && item.scoredQueryCount === 500));
    assert.equal(report.comparisons?.wikiSubtopic?.strategy, "wiki-subtopic-amplified-hybrid");
    assert.equal(report.comparisons?.wikiSubtopic?.answerQuality, 28);
  }

  assert.match(markdown, /wiki-title-amplified-hybrid/);
  assert.match(markdown, /wiki-subtopic-amplified-hybrid/);
  assert.match(markdown, /Compatible with legacy shard intake: false/i);
  assert.match(markdown, /Counts as full memory SOTA evidence: false/i);
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
  assert.equal(compactionAuditEvidence.evidence.hasSessionMapTelemetry, true);
  assert.ok(compactionAuditEvidence.evidence.topicLinkCount >= 4);
  assert.equal(compactionAuditEvidence.evidence.lifecycleEventCount, 6);
  assert.equal(compactionAuditEvidence.evidence.unlinkedCandidateCount, 0);
  assert.ok(compactionAuditEvidence.evidence.sessionMapRowCount >= 6);
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
    "brain-ui-mobile-overflow-fix",
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
    "public-longmemeval-wiki-amplification-fixture",
    "public-longmemeval-provider-gate",
    "public-longmemeval-provider-live-preflight",
    "public-longmemeval-expanded-hybrid-gate",
    "public-longmemeval-expanded-provider-live-preflight",
    "public-longmemeval-expanded-autoresearch-loop",
    "public-longmemeval-autoresearch-loop",
    "codex-lifecycle-audit",
    "local-full-wiki-shard-plan",
  ]) {
    assert.ok(releaseState.provenPreviewSurfaces?.includes(surface), `missing release surface ${surface}`);
  }
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.status, "completed_with_concerns");
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.verdict, "CONCERNS");
  assert.equal(releaseState.reviewerEvidence?.claudeOpus?.countsAsPublicLaunchApproval, false);
  for (const blocker of [
    "human-public-launch-approval-required",
    "full-memory-sota-benchmark-gate-incomplete",
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
  assert.match(modelMatrix, /cloud-gemini2-voyage-rerank/);
  assert.match(modelMatrix, /Source Refresh/i);
  assert.match(modelMatrix, /May 26, 2026/);
  assert.match(modelMatrix, /Gemini Embedding 2 generally available/);
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
  assert.match(publicTargets, /benchmark:agentic-watch/);
  assert.match(publicTargets, /benchmark:agentic-ingest-contract/);
  assert.match(publicTargets, /benchmark:agentic-source-lock/);
  assert.match(publicTargets, /sourceLockReadyForMaterialization/);
  assert.match(publicTargets, /agentic-memory-source-lock-live-20260529\.json/);
  assert.match(publicTargets, /agentic-memory-ingest-contract-20260529\.json/);
  assert.match(providerMatrix, /defaultLocalArm: local-apple-qwen3-0_6b/);
  assert.match(providerMatrix, /personalAgentDefaultArm: cloud-voyage4-voyage/);
  assert.match(providerMatrix, /methodologyRefinementDefaultArm: local-apple-qwen3-0_6b/);
  assert.match(providerMatrix, /cloud-nvidia-nemotron-1b/);
  assert.match(providerMatrix, /cloud-gemini2-cohere4pro/);
  assert.match(providerMatrix, /cloud-gemini2-voyage-rerank/);
  assert.match(providerMatrix, /defaultProvider: none/);
  assert.match(budget, /requireCleanLocalModelRuntimeForLatency: true/);
  assert.match(budget, /searchDisabledForMethodologyBenchmarks: true/);
  assert.match(budget, /enableOnlyForHostedBaselineParity: true/);
  assert.match(budget, /stopOnlyRecallWeaveOwnedProcesses: true/);
  for (const text of [modelMatrix, autoresearchPlan, publicTargets, providerMatrix, budget]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
});

check("fresh agentic memory target watch passes", () => {
  const result = run("node", ["packages/bench/agentic-memory-target-watch.mjs", "--strict"]);
  const markdown = run("node", ["packages/bench/agentic-memory-target-watch.mjs", "--format", "markdown"]).stdout;
  const evidence = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-target-watch-20260529.json"), "utf8"));
  const evidenceMarkdown = readFileSync(join(root, reviewDir, "agentic-memory-target-watch-20260529.md"), "utf8");
  const report = JSON.parse(result.stdout);
  for (const item of [report, evidence]) {
    assert.equal(item.ok, true);
    assert.equal(item.mode, "agentic-memory-target-watch");
    assert.equal(item.metricsOnly, true);
    assert.equal(item.publicSafe, true);
    assert.equal(item.countsAsBenchmarkScore, false);
    assert.equal(item.sourceLockReady, false);
    assert.equal(item.publicBenchmarkClaimsAllowed, false);
    assert.equal(item.primaryCandidate?.id, "longmemeval-v2");
    assert.equal(item.primaryCandidate?.status, "NEXT_SOURCE_LOCK_CANDIDATE");
    assert.ok(item.primaryCandidate?.blockersBeforeRun?.includes("pin-small-or-medium-tier"));
    assert.ok(item.primaryCandidate?.blockersBeforeRun?.includes("hash-question-ids-labels-and-scoring-code"));
    assert.ok(item.candidates?.some((candidate) => candidate.id === "ama-bench"));
    assert.ok(item.candidates?.some((candidate) => candidate.id === "agent-memory-benchmark"));
    assert.deepEqual(item.failedChecks, []);
  }
  assert.match(markdown, /Agentic Memory Target Watch/);
  assert.match(evidenceMarkdown, /LongMemEval-V2: NEXT_SOURCE_LOCK_CANDIDATE/);
  for (const text of [JSON.stringify(report), markdown, JSON.stringify(evidence), evidenceMarkdown]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
});

check("fresh agentic memory ingest contract passes", () => {
  const result = run("node", ["packages/bench/agentic-memory-ingest-contract.mjs", "--strict"]);
  const markdown = run("node", ["packages/bench/agentic-memory-ingest-contract.mjs", "--format", "markdown"]).stdout;
  const evidence = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-ingest-contract-20260529.json"), "utf8"));
  const evidenceMarkdown = readFileSync(join(root, reviewDir, "agentic-memory-ingest-contract-20260529.md"), "utf8");
  const report = JSON.parse(result.stdout);
  for (const item of [report, evidence]) {
    assert.equal(item.ok, true);
    assert.equal(item.mode, "agentic-memory-ingest-contract");
    assert.equal(item.metricsOnly, true);
    assert.equal(item.publicSafe, true);
    assert.equal(item.countsAsBenchmarkScore, false);
    assert.equal(item.publicBenchmarkClaimsAllowed, false);
    assert.equal(item.readyForSourceLockProof, true);
    assert.match(item.contractHash, /^sha256:[a-f0-9]{64}$/);
    assert.equal(item.rawTrajectoryIncluded, false);
    assert.equal(item.contract?.sessionization?.sessionUnit, "one benchmark trajectory becomes one RecallWeave session");
    assert.equal(item.contract?.topicMapping?.multiTopicLinks, true);
    assert.equal(item.contract?.wikiLayer?.publicWikiStoresRawText, false);
    assert.equal(item.contract?.vectorLayer?.vectorizesFullSessionChunks, true);
    assert.equal(item.contract?.lifecycleAndCompaction?.preCompactCheckpointRequired, true);
    assert.equal(item.sourceLockProof?.proofField, "trajectoryIngestContractHash");
    assert.equal(item.sourceLockProof?.proofValue, item.contractHash);
    assert.deepEqual(item.failedChecks, []);
  }
  assert.match(markdown, /Agentic Memory Ingest Contract/);
  assert.match(evidenceMarkdown, /Ready for source-lock proof: true/);
  assert.match(evidenceMarkdown, /Pre-compact checkpoint: true/);
  for (const text of [JSON.stringify(report), markdown, JSON.stringify(evidence), evidenceMarkdown]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
});

check("fresh agentic memory source-lock contract passes", () => {
  const result = run("node", ["packages/bench/agentic-memory-source-lock-check.mjs", "--strict"]);
  const markdown = run("node", ["packages/bench/agentic-memory-source-lock-check.mjs", "--format", "markdown"]).stdout;
  const ingestContract = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-ingest-contract-20260529.json"), "utf8"));
  const evidence = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-source-lock-20260529.json"), "utf8"));
  const evidenceMarkdown = readFileSync(join(root, reviewDir, "agentic-memory-source-lock-20260529.md"), "utf8");
  const decision = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-source-lock-decision-20260529.json"), "utf8"));
  const liveEvidence = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-source-lock-live-20260529.json"), "utf8"));
  const liveEvidenceMarkdown = readFileSync(join(root, reviewDir, "agentic-memory-source-lock-live-20260529.md"), "utf8");
  const report = JSON.parse(result.stdout);
  for (const item of [report, evidence]) {
    assert.equal(item.ok, true);
    assert.equal(item.mode, "agentic-memory-source-lock-check");
    assert.equal(item.metricsOnly, true);
    assert.equal(item.publicSafe, true);
    assert.equal(item.countsAsBenchmarkScore, false);
    assert.equal(item.publicBenchmarkClaimsAllowed, false);
    assert.equal(item.sourceLockReadyForMaterialization, false);
    assert.equal(item.sourceLockReadyForPublicClaim, false);
    assert.equal(item.target?.id, "longmemeval-v2");
    assert.equal(item.target?.expectedPublicShape?.questionCount, 451);
    assert.ok(item.proofChecks?.some((proof) => proof.field === "trajectoryIngestContractHash"));
    assert.ok(item.blockersBeforeRun?.includes("missing-repoCommit"));
    assert.ok(item.blockersBeforeRun?.includes("missing-datasetRevision"));
    assert.ok(item.blockersBeforeRun?.includes("missing-judgeModel"));
    assert.deepEqual(item.failedChecks, []);
  }
  assert.equal(liveEvidence.ok, true);
  assert.equal(liveEvidence.mode, "agentic-memory-source-lock-check");
  assert.equal(liveEvidence.liveChecksRequested, true);
  assert.equal(liveEvidence.liveSourceSnapshot?.ok, true);
  assert.match(liveEvidence.liveSourceSnapshot?.repoCommit ?? "", /^[a-f0-9]{40}$/);
  assert.match(liveEvidence.liveSourceSnapshot?.datasetRevision ?? "", /^[a-f0-9]{40}$/);
  assert.match(liveEvidence.liveSourceSnapshot?.questionIdsHash ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.match(liveEvidence.liveSourceSnapshot?.answerLabelsHash ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.match(liveEvidence.liveSourceSnapshot?.scoringCodeHash ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.equal(liveEvidence.liveSourceSnapshot?.questionCount, 451);
  assert.ok(liveEvidence.liveSourceSnapshot?.scoringCodeBlobCount > 0);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "repoCommit")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "datasetRevision")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "questionIdsHash")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "answerLabelsHash")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "scoringCodeHash")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "leaderboardTier")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "leaderboardRowHash")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "trajectoryIngestContractHash")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "readerModel")?.provided, true);
  assert.equal(liveEvidence.proofChecks?.find((proof) => proof.field === "judgeModel")?.provided, true);
  assert.equal(
    liveEvidence.proofChecks?.find((proof) => proof.field === "trajectoryIngestContractHash")?.valueHash,
    `sha256:${stableHash(ingestContract.contractHash)}`,
  );
  assert.equal(liveEvidence.sourceLockReadyForMaterialization, true);
  assert.equal(liveEvidence.sourceLockReadyForPublicClaim, false);
  assert.deepEqual(liveEvidence.blockersBeforeRun, []);
  assert.equal(decision.sourceLockArguments?.tier, "small");
  assert.equal(decision.sourceLockArguments?.leaderboardRowHash, decision.officialRunContract?.referenceFrontier ? decision.sourceLockArguments.leaderboardRowHash : null);
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-trajectoryIngestContractHash"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-repoCommit"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-datasetRevision"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-questionIdsHash"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-answerLabelsHash"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-scoringCodeHash"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-leaderboardTier"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-leaderboardRowHash"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-readerModel"));
  assert.ok(!liveEvidence.blockersBeforeRun?.includes("missing-judgeModel"));
  assert.match(markdown, /Agentic Memory Source Lock Check/);
  assert.match(evidenceMarkdown, /Source-lock ready for materialization: false/);
  assert.match(evidenceMarkdown, /trajectoryIngestContractHash: missing/);
  assert.match(liveEvidenceMarkdown, /Source-lock ready for materialization: true/);
  assert.match(liveEvidenceMarkdown, /Missing proof fields: none/);
  assert.match(liveEvidenceMarkdown, /repoCommit: provided/);
  assert.match(liveEvidenceMarkdown, /datasetRevision: provided/);
  assert.match(liveEvidenceMarkdown, /leaderboardTier: provided/);
  assert.match(liveEvidenceMarkdown, /questionIdsHash: provided/);
  assert.match(liveEvidenceMarkdown, /answerLabelsHash: provided/);
  assert.match(liveEvidenceMarkdown, /scoringCodeHash: provided/);
  assert.match(liveEvidenceMarkdown, /leaderboardRowHash: provided/);
  assert.match(liveEvidenceMarkdown, /trajectoryIngestContractHash: provided/);
  assert.match(liveEvidenceMarkdown, /readerModel: provided/);
  assert.match(liveEvidenceMarkdown, /judgeModel: provided/);
  for (const text of [JSON.stringify(report), markdown, JSON.stringify(evidence), evidenceMarkdown, JSON.stringify(decision), JSON.stringify(liveEvidence), liveEvidenceMarkdown]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
});

check("fresh agentic memory source-lock decision passes", () => {
  const result = run("node", ["packages/bench/agentic-memory-source-lock-decision.mjs", "--strict"]);
  const markdown = run("node", ["packages/bench/agentic-memory-source-lock-decision.mjs", "--format", "markdown"]).stdout;
  const evidence = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-source-lock-decision-20260529.json"), "utf8"));
  const evidenceMarkdown = readFileSync(join(root, reviewDir, "agentic-memory-source-lock-decision-20260529.md"), "utf8");
  const report = JSON.parse(result.stdout);
  for (const item of [report, evidence]) {
    assert.equal(item.ok, true);
    assert.equal(item.mode, "agentic-memory-source-lock-decision");
    assert.equal(item.metricsOnly, true);
    assert.equal(item.publicSafe, true);
    assert.equal(item.countsAsBenchmarkScore, false);
    assert.equal(item.publicBenchmarkClaimsAllowed, false);
    assert.equal(item.sourceLockArguments?.tier, "small");
    assert.equal(item.sourceLockArguments?.readerModel, "Qwen/Qwen3.5-9B");
    assert.equal(item.sourceLockArguments?.judgeModel, "gpt-5.2");
    assert.match(item.sourceLockArguments?.leaderboardRowHash ?? "", /^sha256:[a-f0-9]{64}$/);
    assert.match(item.officialRunContract?.codexActorLane ?? "", /internal memory-controller or actor lane/);
    assert.deepEqual(item.failedChecks, []);
  }
  assert.match(markdown, /Agentic Memory Source-Lock Decision/);
  assert.match(evidenceMarkdown, /Reader model: Qwen\/Qwen3\.5-9B/);
  assert.match(evidenceMarkdown, /Judge model: gpt-5\.2/);
  for (const text of [JSON.stringify(report), markdown, JSON.stringify(evidence), evidenceMarkdown]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
});

check("fresh agentic provider autoresearch plan passes", () => {
  const result = run("node", ["packages/bench/agentic-memory-provider-autoresearch-plan.mjs", "--strict"]);
  const markdown = run("node", ["packages/bench/agentic-memory-provider-autoresearch-plan.mjs", "--format", "markdown"]).stdout;
  const evidence = JSON.parse(readFileSync(join(root, reviewDir, "agentic-memory-provider-autoresearch-plan-20260529.json"), "utf8"));
  const evidenceMarkdown = readFileSync(join(root, reviewDir, "agentic-memory-provider-autoresearch-plan-20260529.md"), "utf8");
  const report = JSON.parse(result.stdout);
  for (const item of [report, evidence]) {
    assert.equal(item.ok, true);
    assert.equal(item.mode, "agentic-memory-provider-autoresearch-plan");
    assert.equal(item.metricsOnly, true);
    assert.equal(item.publicSafe, true);
    assert.equal(item.callsProviderApis, false);
    assert.equal(item.sendsBenchmarkTextToProvider, false);
    assert.equal(item.cloudDefaultForPersonalUse, "cloud-voyage4-voyage");
    assert.equal(item.methodologyDefault, "local-apple-controlled-lanes");
    assert.equal(item.hostedSupermemorySearchForMethodology, "disabled");
    assert.equal(item.target?.sourceLockReadyForMaterialization, true);
    assert.deepEqual(item.target?.remainingSourceLockBlockers, []);
    assert.equal(item.watchdog?.enabled, true);
    assert.ok(item.providerMatrix?.some((provider) => provider.family === "voyage"));
    assert.ok(item.providerMatrix?.some((provider) => provider.family === "gemini"));
    assert.ok(item.providerMatrix?.some((provider) => provider.family === "nvidia"));
    assert.ok(item.providerMatrix?.some((provider) => provider.family === "openrouter"));
    assert.ok(item.providerMatrix?.some((provider) => provider.family === "local-apple"));
    assert.ok(item.runPolicy?.zeroDollarProviderFamiliesPreferred?.includes("nvidia"));
    assert.ok(item.runPolicy?.zeroDollarProviderFamiliesPreferred?.includes("openrouter"));
    assert.ok(item.phases?.some((phase) => phase.id === "source-lock-closeout" && phase.status === "ready"));
    assert.ok(item.phases?.some((phase) => phase.id === "cloud-challenger-run" && phase.status === "ready"));
    assert.ok(item.phases?.some((phase) => phase.id === "answer-quality-and-review" && phase.status === "ready"));
    assert.equal(item.runPolicy?.fullSetPreferred, true);
    assert.equal(item.rawQuestionsIncluded, false);
    assert.equal(item.rawAnswersIncluded, false);
    assert.equal(item.rawMemoryIncluded, false);
  }
  assert.match(markdown, /Agentic Provider Autoresearch Plan/);
  assert.match(evidenceMarkdown, /Provider Matrix/);
  assert.match(evidenceMarkdown, /cloud-voyage4-voyage/);
  assert.match(evidenceMarkdown, /cloud-gemini2-embed-rerank-proxy/);
  assert.match(evidenceMarkdown, /cloud-nvidia-nemotron-vl-1b/);
  for (const text of [JSON.stringify(report), markdown, JSON.stringify(evidence), evidenceMarkdown]) {
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
  const answerQualityShardPlanFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-answer-quality-shard-plan.mjs"]).stdout);
  const answerQualityShardPlanMarkdownFresh = run("node", [
    "packages/bench/public-benchmark-answer-quality-shard-plan.mjs",
    "--format",
    "markdown",
  ]).stdout;
  const answerQualityLocalShardPlanFresh = JSON.parse(
    run("node", ["packages/bench/public-benchmark-answer-quality-shard-plan.mjs", "--claim-scope", "local-full"]).stdout,
  );
  const answerQualityLocalShardPlanMarkdownFresh = run("node", [
    "packages/bench/public-benchmark-answer-quality-shard-plan.mjs",
    "--claim-scope",
    "local-full",
    "--format",
    "markdown",
  ]).stdout;
  const answerQualityShardWorkorderFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-answer-quality-shard-workorder.mjs"]).stdout);
  const answerQualityShardWorkorderMarkdownFresh = run("node", [
    "packages/bench/public-benchmark-answer-quality-shard-workorder.mjs",
    "--format",
    "markdown",
  ]).stdout;
  const answerQualityShardIntakeFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-answer-quality-shard-intake.mjs"]).stdout);
  const answerQualityShardIntakeMarkdownFresh = run("node", [
    "packages/bench/public-benchmark-answer-quality-shard-intake.mjs",
    "--format",
    "markdown",
  ]).stdout;
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
  const reportedTargetsFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-reported-targets.mjs"]).stdout);
  const reportedTargetsMarkdownFresh = run("node", ["packages/bench/public-benchmark-reported-targets.mjs", "--format", "markdown"]).stdout;
  const sotaLadderFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-sota-ladder.mjs"]).stdout);
  const sotaLadderMarkdownFresh = run("node", ["packages/bench/public-benchmark-sota-ladder.mjs", "--format", "markdown"]).stdout;
  const sotaOperatorPacketFresh = JSON.parse(run("node", ["packages/bench/public-benchmark-sota-operator-packet.mjs"]).stdout);
  const reportedTargetsEvidence = JSON.parse(readFileSync(join(root, reviewDir, "reported-memory-targets-20260525.json"), "utf8"));
  const reportedTargetsMarkdownEvidence = readFileSync(join(root, reviewDir, "reported-memory-targets-20260525.md"), "utf8");
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
  const providerWaveIntakeReport = JSON.parse(readFileSync(join(root, reviewDir, "provider-wave-intake-20260531.json"), "utf8"));
  const providerWaveIntakeEvidence = readFileSync(join(root, reviewDir, "provider-wave-intake-20260531.md"), "utf8");
  const providerWaveIntakeFresh = JSON.parse(run("node", ["packages/bench/provider-wave-intake.mjs"]).stdout);
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
  const fullAnswerQualityShardPlan = JSON.parse(readFileSync(join(root, reviewDir, "answer-quality-full-shard-plan-20260525.json"), "utf8"));
  const fullAnswerQualityShardPlanEvidence = readFileSync(join(root, reviewDir, "answer-quality-full-shard-plan-20260525.md"), "utf8");
  const localFullAnswerQualityShardPlan = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-plan-20260526.json"), "utf8"),
  );
  const localFullAnswerQualityShardPlanEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-plan-20260526.md"),
    "utf8",
  );
  const localFullAnswerQualityShardWorkorder = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-workorder-20260526.json"), "utf8"),
  );
  const localFullAnswerQualityShardWorkorderEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-workorder-20260526.md"),
    "utf8",
  );
  const localFullAnswerQualityShardIntake = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-intake-20260526.json"), "utf8"),
  );
  const localFullAnswerQualityShardIntakeEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-intake-20260526.md"),
    "utf8",
  );
  const localFullAnswerQualityShardIntakeAfterShard001 = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-001-20260526.json"), "utf8"),
  );
  const localFullAnswerQualityShardIntakeAfterShard001Evidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-001-20260526.md"),
    "utf8",
  );
  const localFullAnswerQualityShardIntakeAfterShard002Recovery = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526.json"), "utf8"),
  );
  const localFullAnswerQualityShardIntakeAfterShard002RecoveryEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526.md"),
    "utf8",
  );
  const localFullAnswerQualityShard005CommonArmProjection = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-005-common-arm-projection-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard005CommonArmProjectionEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-005-common-arm-projection-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShardIntakeAfterShard005CommonArm = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-005-common-arm-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShardIntakeAfterShard005CommonArmEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-005-common-arm-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShard006ArmExport = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-006-arm-export-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard006ArmExportEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-006-arm-export-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShard006Preflight = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-preflight-shard-006-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard006 = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-006-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard006Evidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-006-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShardIntakeAfterShard006 = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-006-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShardIntakeAfterShard006Evidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-006-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShard007ArmExport = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-007-arm-export-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard007ArmExportEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-007-arm-export-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShard007Preflight = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-preflight-shard-007-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard007 = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-007-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard007Evidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-007-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShardIntakeAfterShard007 = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-007-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShardIntakeAfterShard007Evidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-007-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShard008ArmExport = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-008-arm-export-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard008ArmExportEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-008-arm-export-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShard008Preflight = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-008-preflight-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard008 = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-008-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShard008Evidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-008-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShardIntakeAfterShard008 = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-008-20260527.json"), "utf8"),
  );
  const localFullAnswerQualityShardIntakeAfterShard008Evidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-intake-after-shard-008-20260527.md"),
    "utf8",
  );
  const localFullAnswerQualityShard002RuntimeBlocker = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-002-runtime-blocker-20260526.json"), "utf8"),
  );
  const localFullAnswerQualityShard002RuntimeBlockerEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-002-runtime-blocker-20260526.md"),
    "utf8",
  );
  const localFullAnswerQualityShard003RuntimeBlocker = JSON.parse(
    readFileSync(join(root, reviewDir, "answer-quality-local-full-shard-003-runtime-blocker-20260526.json"), "utf8"),
  );
  const localFullAnswerQualityShard003RuntimeBlockerEvidence = readFileSync(
    join(root, reviewDir, "answer-quality-local-full-shard-003-runtime-blocker-20260526.md"),
    "utf8",
  );
  const localEmbeddingRuntimeDoctor = JSON.parse(readFileSync(join(root, reviewDir, "local-embedding-runtime-doctor-20260526.json"), "utf8"));
  const localEmbeddingRuntimeDoctorEvidence = readFileSync(join(root, reviewDir, "local-embedding-runtime-doctor-20260526.md"), "utf8");
  const localEmbeddingLaunchDiagnostic = JSON.parse(readFileSync(join(root, reviewDir, "local-embedding-launch-diagnostic-20260526.json"), "utf8"));
  const localEmbeddingLaunchDiagnosticEvidence = readFileSync(join(root, reviewDir, "local-embedding-launch-diagnostic-20260526.md"), "utf8");
  const noLocalEmbeddingEnv = { ...process.env };
  for (const name of [
    "SELFMEM_LOCAL_EMBED_BASE_URL",
    "SELFMEM_LOCAL_EMBED_CONFIG_ENV",
    "SELFMEM_LOCAL_EMBED_EXPECTED_FAMILY",
    "SELFMEM_LOCAL_EMBED_HF_REPO",
    "SELFMEM_LOCAL_EMBED_MODEL",
    "SELFMEM_LOCAL_EMBED_MODEL_PATH",
    "SELFMEM_LOCAL_EMBED_SERVER_BIN",
    "SELFMEM_LOCAL_EMBED_STRATEGY",
  ]) {
    delete noLocalEmbeddingEnv[name];
  }
  const localEmbeddingRuntimeFreshStdout = run("node", ["packages/bench/local-embedding-runtime-doctor.mjs"], { env: noLocalEmbeddingEnv }).stdout;
  const localEmbeddingRuntimeFresh = JSON.parse(localEmbeddingRuntimeFreshStdout);
  const localEmbeddingRuntimeMarkdownFresh = run("node", ["packages/bench/local-embedding-runtime-doctor.mjs", "--format", "markdown"], {
    env: noLocalEmbeddingEnv,
  }).stdout;
  const localEmbeddingRuntimeHfNoEndpointStdout = run(
    "node",
    [
      "packages/bench/local-embedding-runtime-doctor.mjs",
      "--hf-repo",
      "Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0",
      "--base-url",
      "http://127.0.0.1:65530/v1",
    ],
    { env: noLocalEmbeddingEnv },
  ).stdout;
  const localEmbeddingRuntimeHfNoEndpoint = JSON.parse(localEmbeddingRuntimeHfNoEndpointStdout);
  const localEmbeddingLaunchDiagnosticFixture = JSON.parse(
    run("node", ["packages/bench/local-embedding-launch-diagnostic.mjs", "--fixture"]).stdout,
  );
  const localEmbeddingDurabilitySmoke = JSON.parse(readFileSync(join(root, reviewDir, "local-embedding-durability-smoke-20260526.json"), "utf8"));
  const localEmbeddingDurabilitySmokeEvidence = readFileSync(join(root, reviewDir, "local-embedding-durability-smoke-20260526.md"), "utf8");
  const localEmbeddingDurabilityFresh = JSON.parse(
    run("node", ["packages/bench/local-embedding-durability-smoke.mjs"], { env: noLocalEmbeddingEnv }).stdout,
  );
  const localEmbeddingDurabilityMarkdownFresh = run("node", ["packages/bench/local-embedding-durability-smoke.mjs", "--format", "markdown"], {
    env: noLocalEmbeddingEnv,
  }).stdout;
  const noLocalRerankEnv = { ...process.env };
  for (const name of [
    "SELFMEM_LOCAL_RERANK_API_KEY",
    "SELFMEM_LOCAL_RERANK_BASE_URL",
    "SELFMEM_LOCAL_RERANK_ENDPOINT",
    "SELFMEM_LOCAL_RERANK_MAX_DOCUMENT_CHARS",
    "SELFMEM_LOCAL_RERANK_MODEL",
    "SELFMEM_LOCAL_RERANK_STRATEGY",
    "SELFMEM_LOCAL_RERANK_TIMEOUT_MS",
  ]) {
    delete noLocalRerankEnv[name];
  }
  const localRerankDurabilitySmoke = JSON.parse(readFileSync(join(root, reviewDir, "local-rerank-durability-smoke-20260526.json"), "utf8"));
  const localRerankDurabilitySmokeEvidence = readFileSync(join(root, reviewDir, "local-rerank-durability-smoke-20260526.md"), "utf8");
  const localRerankDurabilityFresh = JSON.parse(
    run("node", ["packages/bench/local-rerank-durability-smoke.mjs"], { env: noLocalRerankEnv }).stdout,
  );
  const localRerankDurabilityMarkdownFresh = run("node", ["packages/bench/local-rerank-durability-smoke.mjs", "--format", "markdown"], {
    env: noLocalRerankEnv,
  }).stdout;
  const localRerankDurabilityFixture = JSON.parse(
    run("node", ["packages/bench/local-rerank-durability-smoke.mjs", "--fixture", "--require-ready"], { env: noLocalRerankEnv }).stdout,
  );
  const blockedLocalEmbeddingDurabilityReportPath = join(releaseTempRoot, "blocked-local-embedding-durability-smoke.json");
  writeFileSync(blockedLocalEmbeddingDurabilityReportPath, `${JSON.stringify(localEmbeddingDurabilityFresh, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  const fullAnswerQualityShardWorkorder = JSON.parse(readFileSync(join(root, reviewDir, "answer-quality-full-shard-workorder-20260525.json"), "utf8"));
  const fullAnswerQualityShardWorkorderEvidence = readFileSync(join(root, reviewDir, "answer-quality-full-shard-workorder-20260525.md"), "utf8");
  const fullAnswerQualityShardIntake = JSON.parse(readFileSync(join(root, reviewDir, "answer-quality-full-shard-intake-20260525.json"), "utf8"));
  const fullAnswerQualityShardIntakeEvidence = readFileSync(join(root, reviewDir, "answer-quality-full-shard-intake-20260525.md"), "utf8");
  const privateInputDoctorReady = JSON.parse(readFileSync(join(root, reviewDir, "full-shard-private-input-doctor-current.json"), "utf8"));
  const privateInputDoctorReadyEvidence = readFileSync(join(root, reviewDir, "full-shard-private-input-doctor-current.md"), "utf8");
  const privateInputDoctorBlocked = JSON.parse(run("node", ["packages/bench/full-shard-private-input-doctor.mjs"]).stdout);
  const acceptedLaneLaunchDoctorFresh = JSON.parse(run("node", ["packages/bench/full-shard-accepted-lane-launch-doctor.mjs"]).stdout);
  const acceptedLaneLaunchDoctorMarkdownFresh = run("node", [
    "packages/bench/full-shard-accepted-lane-launch-doctor.mjs",
    "--format",
    "markdown",
  ]).stdout;
  const acceptedLaneLaunchDoctorEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "full-shard-accepted-lane-launch-doctor-20260526.json"), "utf8"),
  );
  const acceptedLaneLaunchDoctorMarkdownEvidence = readFileSync(
    join(root, reviewDir, "full-shard-accepted-lane-launch-doctor-20260526.md"),
    "utf8",
  );
  const localAcceptedLaneLaunchDoctorFresh = JSON.parse(
    run("node", [
      "packages/bench/full-shard-accepted-lane-launch-doctor.mjs",
      "--plan",
      "reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json",
    ]).stdout,
  );
  const localAcceptedLaneLaunchDoctorMarkdownFresh = run("node", [
    "packages/bench/full-shard-accepted-lane-launch-doctor.mjs",
    "--plan",
    "reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json",
    "--format",
    "markdown",
  ]).stdout;
  const localAcceptedLaneLaunchDoctorEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "local-full-accepted-lane-launch-doctor-20260526.json"), "utf8"),
  );
  const localAcceptedLaneLaunchDoctorMarkdownEvidence = readFileSync(
    join(root, reviewDir, "local-full-accepted-lane-launch-doctor-20260526.md"),
    "utf8",
  );
  const localFullShardWorkorderFresh = JSON.parse(
    run("node", [
      "packages/bench/public-benchmark-answer-quality-shard-workorder.mjs",
      "--plan",
      "reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json",
      "--input",
      "reviews/overnight-20260522/answer-quality-local-full-shard-001-20260526.json,reviews/overnight-20260522/answer-quality-local-full-shard-002-recovery-20260526.json",
      "--runtime-blocker",
      "reviews/overnight-20260522/answer-quality-local-full-shard-003-runtime-blocker-20260526.json",
    ]).stdout,
  );
  const localFullShardResumePacket = JSON.parse(readFileSync(join(root, reviewDir, "local-full-shard-002-resume-packet-20260526.json"), "utf8"));
  const localFullShardResumePacketEvidence = readFileSync(join(root, reviewDir, "local-full-shard-002-resume-packet-20260526.md"), "utf8");
  const localFullShardResumePacketFresh = JSON.parse(run("node", ["packages/bench/local-full-shard-resume-packet.mjs"]).stdout);
  const localFullShardResumePacketMarkdownFresh = run("node", ["packages/bench/local-full-shard-resume-packet.mjs", "--format", "markdown"]).stdout;
  const localFullShardResumeEnvDoctor = JSON.parse(
    readFileSync(join(root, reviewDir, "local-full-shard-002-resume-env-doctor-20260526.json"), "utf8"),
  );
  const localFullShardResumeEnvDoctorEvidence = readFileSync(
    join(root, reviewDir, "local-full-shard-002-resume-env-doctor-20260526.md"),
    "utf8",
  );
  const noLocalFullResumeEnv = { ...process.env };
  for (const name of [
    "RECALLWEAVE_BASELINE_LIVE",
    "RECALLWEAVE_BASELINE_NO_RAW_TEXT",
    "RECALLWEAVE_FULL_SHARD_PRIVATE_DIR",
    "RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL",
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS",
    "RECALLWEAVE_MEMORYBENCH_BASE_URL",
    "RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA",
    "RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY",
    "SELFMEM_LOCAL_EMBED_BASE_URL",
    "SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS",
    "SELFMEM_LOCAL_EMBED_MAX_TOKENS",
    "SELFMEM_LOCAL_EMBED_MODEL",
    "SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT",
    "SELFMEM_LOCAL_RERANK_BASE_URL",
    "SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT",
    "SELFMEM_LOCAL_RERANK_MODEL",
  ]) {
    delete noLocalFullResumeEnv[name];
  }
  const localFullShardResumeEnvDoctorFresh = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-env-doctor.mjs"], { env: noLocalFullResumeEnv }).stdout,
  );
  const localFullShardResumeEnvDoctorTooShort = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-env-doctor.mjs", "--min-durability-token-count", "701"], {
      env: noLocalFullResumeEnv,
    }).stdout,
  );
  const localFullShardResumeEnvDoctorMarkdownFresh = run("node", ["packages/bench/local-full-shard-resume-env-doctor.mjs", "--format", "markdown"], {
    env: noLocalFullResumeEnv,
  }).stdout;
  const localFullShardResumeEnvDoctorFixture = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-env-doctor.mjs", "--fixture"]).stdout,
  );
  const localFullShardResumeEnvDoctorFixtureMarkdown = run("node", [
    "packages/bench/local-full-shard-resume-env-doctor.mjs",
    "--fixture",
    "--format",
    "markdown",
  ]).stdout;
  const localFullShardResumeCommandMaterializer = JSON.parse(
    readFileSync(join(root, reviewDir, "local-full-shard-003-resume-command-materializer-20260526.json"), "utf8"),
  );
  const localFullShardResumeCommandMaterializerEvidence = readFileSync(
    join(root, reviewDir, "local-full-shard-003-resume-command-materializer-20260526.md"),
    "utf8",
  );
  const localFullShardResumeCommandMaterializerFresh = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-command-materializer.mjs"], { env: noLocalFullResumeEnv }).stdout,
  );
  const localFullShardResumeCommandMaterializerMarkdownFresh = run(
    "node",
    ["packages/bench/local-full-shard-resume-command-materializer.mjs", "--format", "markdown"],
    { env: noLocalFullResumeEnv },
  ).stdout;
  const localFullShardResumeCommandSecurity = JSON.parse(
    readFileSync(join(root, reviewDir, "local-full-shard-003-resume-command-security-20260526.json"), "utf8"),
  );
  const localFullShardResumeCommandSecurityEvidence = readFileSync(
    join(root, reviewDir, "local-full-shard-003-resume-command-security-20260526.md"),
    "utf8",
  );
  const localFullShardResumeCommandSecurityFresh = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-command-security-doctor.mjs"]).stdout,
  );
  const localFullShardResumeCommandSecurityMarkdownFresh = run(
    "node",
    ["packages/bench/local-full-shard-resume-command-security-doctor.mjs", "--format", "markdown"],
  ).stdout;
  const localFullShardResumeCommandMaterializerFixture = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-command-materializer.mjs", "--fixture"]).stdout,
  );
  const localFullShardResumeCommandMaterializerReadyRoot = mkdtempSync(join(tmpdir(), "recallweave-local-full-resume-command-ready-"));
  const localFullShardResumeCommandMaterializerReadyPrivateDir = join(localFullShardResumeCommandMaterializerReadyRoot, "private");
  const localFullShardResumeCommandMaterializerReadyOutput = join(
    localFullShardResumeCommandMaterializerReadyRoot,
    "resume-shard-003.private.sh",
  );
  mkdirSync(localFullShardResumeCommandMaterializerReadyPrivateDir, { recursive: true, mode: 0o700 });
  const localFullShardResumeCommandMaterializerReadyEnv = {
    ...noLocalFullResumeEnv,
    SELFMEM_LOCAL_EMBED_BASE_URL: "http://127.0.0.1:65535/v1",
    SELFMEM_LOCAL_EMBED_MODEL: "fixture-local-embedding-model",
    SELFMEM_LOCAL_EMBED_MAX_TOKENS: "900",
    SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS: "700",
    SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT: "16",
    SELFMEM_LOCAL_RERANK_BASE_URL: "http://127.0.0.1:65534/v1",
    SELFMEM_LOCAL_RERANK_MODEL: "fixture-local-rerank-model",
    SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT: "8",
    RECALLWEAVE_MEMORYBENCH_BASE_URL: "http://127.0.0.1:65533/v1",
    RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "fixture-local-answer-model",
    RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "fixture-local-judge-model",
  };
  const localFullShardResumeCommandMaterializerReady = JSON.parse(
    run(
      "node",
      [
        "packages/bench/local-full-shard-resume-command-materializer.mjs",
        "--private-input-dir",
        localFullShardResumeCommandMaterializerReadyPrivateDir,
        "--private-command-output",
        localFullShardResumeCommandMaterializerReadyOutput,
      ],
      { env: localFullShardResumeCommandMaterializerReadyEnv },
    ).stdout,
  );
  const localFullShardResumeCommandMaterializerPrivateScript = readFileSync(localFullShardResumeCommandMaterializerReadyOutput, "utf8");
  const localFullShardResumeResultDoctor = JSON.parse(
    readFileSync(join(root, reviewDir, "local-full-shard-002-resume-result-doctor-20260526.json"), "utf8"),
  );
  const localFullShardResumeResultDoctorEvidence = readFileSync(
    join(root, reviewDir, "local-full-shard-002-resume-result-doctor-20260526.md"),
    "utf8",
  );
  const localFullShardResumeResultDoctorFresh = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-result-doctor.mjs"]).stdout,
  );
  const localFullShardResumeResultDoctorMarkdownFresh = run(
    "node",
    ["packages/bench/local-full-shard-resume-result-doctor.mjs", "--format", "markdown"],
  ).stdout;
  const localFullShardResumeResultDoctorFixture = JSON.parse(
    run("node", ["packages/bench/local-full-shard-resume-result-doctor.mjs", "--fixture"]).stdout,
  );
  const localFullShardPerformanceReport = JSON.parse(
    readFileSync(join(root, reviewDir, "local-full-shard-performance-report-after-shard-020-20260529.json"), "utf8"),
  );
  const localFullShardPerformanceReportEvidence = readFileSync(
    join(root, reviewDir, "local-full-shard-performance-report-after-shard-020-20260529.md"),
    "utf8",
  );
  const localFullShardPerformanceReportFresh = JSON.parse(
    run("node", ["packages/bench/local-full-shard-performance-report.mjs"]).stdout,
  );
  const localFullShardPerformanceReportMarkdownFresh = run(
    "node",
    ["packages/bench/local-full-shard-performance-report.mjs", "--format", "markdown"],
  ).stdout;
  const localFullShardIntakeFresh = JSON.parse(
    run("node", [
      "packages/bench/public-benchmark-answer-quality-shard-intake.mjs",
      "--plan",
      "reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json",
    ]).stdout,
  );
  const fullShardBm25ExportProbe = JSON.parse(readFileSync(join(root, reviewDir, "full-shard-bm25-control-export-probe-20260526.json"), "utf8"));
  const fullShardBm25ExportProbeEvidence = readFileSync(join(root, reviewDir, "full-shard-bm25-control-export-probe-20260526.md"), "utf8");
  const fullShardControlExportProbe = JSON.parse(readFileSync(join(root, reviewDir, "full-shard-control-export-probe-20260526.json"), "utf8"));
  const fullShardControlExportProbeEvidence = readFileSync(join(root, reviewDir, "full-shard-control-export-probe-20260526.md"), "utf8");
  const fullShardControlAnswerQualityPreflight = JSON.parse(
    readFileSync(join(root, reviewDir, "full-shard-control-answer-quality-preflight-20260526.json"), "utf8"),
  );
  const fullShardControlAnswerQualityPreflightEvidence = readFileSync(
    join(root, reviewDir, "full-shard-control-answer-quality-preflight-20260526.md"),
    "utf8",
  );
  const syntheticShardDir = mkdtempSync(join(tmpdir(), "recallweave-answer-quality-shard-intake-"));
  const syntheticShardInputs = writeSyntheticAnswerQualityShardReports(fullAnswerQualityShardPlan, syntheticShardDir);
  const syntheticLocalFullShardDir = mkdtempSync(join(tmpdir(), "recallweave-local-full-answer-quality-shard-intake-"));
  const syntheticLocalFullShardInputs = writeSyntheticAnswerQualityShardReports(localFullAnswerQualityShardPlan, syntheticLocalFullShardDir, {
    answerModel: "local-diagnostic-answer-model",
    judgeModel: "local-diagnostic-judge-model",
    endpointIsLocal: true,
  });
  const answerQualityShardWorkorderReady = JSON.parse(
    run("node", ["packages/bench/public-benchmark-answer-quality-shard-workorder.mjs", "--input", syntheticShardInputs.join(",")]).stdout,
  );
  const answerQualityShardIntakeReady = JSON.parse(
    run("node", ["packages/bench/public-benchmark-answer-quality-shard-intake.mjs", "--input", syntheticShardInputs.join(",")]).stdout,
  );
  const localFullAnswerQualityShardWorkorderReady = JSON.parse(
    run("node", [
      "packages/bench/public-benchmark-answer-quality-shard-workorder.mjs",
      "--plan",
      "reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json",
      "--input",
      syntheticLocalFullShardInputs.join(","),
    ]).stdout,
  );
  const localFullAnswerQualityShardIntakeReady = JSON.parse(
    run("node", [
      "packages/bench/public-benchmark-answer-quality-shard-intake.mjs",
      "--plan",
      "reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json",
      "--input",
      syntheticLocalFullShardInputs.join(","),
    ]).stdout,
  );
  const localFullCombinedSyntheticPath = join(syntheticLocalFullShardDir, "end-to-end-memory-score-local-full-combined.json");
  run("node", [
    "packages/bench/public-benchmark-answer-quality-combine.mjs",
    "--input",
    syntheticLocalFullShardInputs.join(","),
    "--combine-mode",
    "shards",
    "--output",
    localFullCombinedSyntheticPath,
  ]);
  const localFullResultGateReady = JSON.parse(
    run("node", [
      "packages/bench/end-to-end-memory-score-gate.mjs",
      "--claim-scope",
      "local-full",
      "--target",
      "reviews/overnight-20260522/public-longmemeval-full-run-target.json",
      "--result",
      localFullCombinedSyntheticPath,
      "--require-ready",
    ]).stdout,
  );
  const fullSotaLocalModelGateRun = spawnSync("node", [
    "packages/bench/end-to-end-memory-score-gate.mjs",
    "--claim-scope",
    "full-sota",
    "--target",
    "reviews/overnight-20260522/public-longmemeval-full-run-target.json",
    "--result",
    localFullCombinedSyntheticPath,
    "--require-ready",
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const modelChallengerGateReady = JSON.parse(
    run("node", [
      "packages/bench/end-to-end-memory-score-gate.mjs",
      "--claim-scope",
      "model-challenger",
      "--reported-target-id",
      "supermemory-production-research-gpt4o",
      "--target",
      "reviews/overnight-20260522/public-longmemeval-full-run-target.json",
      "--result",
      "packages/bench/fixtures/model-challenger-answer-quality.fixture.json",
      "--require-ready",
    ]).stdout,
  );
  const fullTargetSotaReport = JSON.parse(readFileSync(join(root, reviewDir, "sota-ladder-full-target-report-20260525.json"), "utf8"));
  const fullTargetOperatorPacket = JSON.parse(
    readFileSync(join(root, reviewDir, "sota-ladder-full-target-operator-packet-20260525.json"), "utf8"),
  );
  const fullMemorySotaDoctorFresh = JSON.parse(run("node", ["packages/bench/full-memory-sota-doctor.mjs"]).stdout);
  const fullMemorySotaDoctorMarkdownFresh = run("node", ["packages/bench/full-memory-sota-doctor.mjs", "--format", "markdown"]).stdout;
  const fullMemorySotaDoctorEvidence = JSON.parse(
    readFileSync(join(root, reviewDir, "full-memory-sota-doctor-after-local-full-combine-20260531.json"), "utf8"),
  );
  const fullMemorySotaDoctorMarkdownEvidence = readFileSync(
    join(root, reviewDir, "full-memory-sota-doctor-after-local-full-combine-20260531.md"),
    "utf8",
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
  assert.equal(materializeFixture.rawSourcesRetainedPrivate, true);
  assert.equal(materializeFixture.sourceRetention?.rawDatasetRetainedPrivate, true);
  assert.equal(materializeFixture.sourceRetention?.selectedRawRowsRetainedPrivate, true);
  assert.equal(materializeFixture.sourceRetention?.sourceManifestRetainedPrivate, true);
  assert.equal(materializeFixture.sourceRetention?.rawTextPubliclyIncluded, false);
  assert.ok(materializeFixture.sourceRetention?.rawDatasetHash?.startsWith("sha256:"));
  assert.ok(materializeFixture.sourceRetention?.selectedRawRowsHash?.startsWith("sha256:"));
  assert.ok(materializeFixture.sourceRetention?.sourceManifestHash?.startsWith("sha256:"));
  assert.ok(materializeFixture.privateOutputs?.files?.some((file) => file.role === "raw-dataset" && file.rawTextPrivate === true));
  assert.ok(materializeFixture.privateOutputs?.files?.some((file) => file.role === "selected-raw-rows" && file.rawTextPrivate === true));
  assert.ok(materializeFixture.privateOutputs?.files?.some((file) => file.role === "source-manifest" && file.rawTextPrivate === false));
  assert.equal(materializeFixture.privateOutputs?.directoryInsideRepository, false);
  assert.match(materializeMarkdown, /Source Retention/);
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
  assert.ok((hybridFixture.strategies?.length ?? 0) >= 10);
  for (const strategy of [
    "bm25-lite",
    "dense-proxy",
    "sparse-dense-rrf",
    "sparse-dense-temporal",
    "sparse-dense-graph-temporal",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
    "wiki-title-amplified-hybrid",
    "wiki-subtopic-amplified-hybrid",
    "wiki-summary-session-hybrid",
  ]) {
    assert.ok(hybridFixture.strategies?.some((item) => item.strategy === strategy), `missing hybrid fixture strategy ${strategy}`);
  }
  assert.equal(hybridFixture.control?.strategy, "bm25-lite");
  assert.equal(hybridFixture.comparisonContract?.bm25ControlPresent, true);
  assert.equal(hybridFixture.comparisonContract?.hybridFamilyPresent, true);
  assert.equal(hybridFixture.hybridPromotion?.kind, "hybrid");
  assert.match(hybridMarkdown, /Gate: hybrid/);
  assert.match(hybridMarkdown, /wiki-title-amplified-hybrid/);
  assert.match(hybridMarkdown, /wiki-subtopic-amplified-hybrid/);
  assert.match(hybridMarkdown, /wiki-summary-session-hybrid/);
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
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-gemini2-embed-rerank-proxy" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-gemini2-voyage-rerank" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "cloud-nvidia-nv-embed-v1-mistral-rerank" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerFixture.strategies?.some((item) => item.strategy === "local-apple-qwen3-0_6b" && item.provider?.fixtureProviderMock === true));
  assert.match(providerMarkdown, /Gate: provider/);
  assert.match(providerMarkdown, /cloud-voyage4-voyage/);
  assert.match(providerMarkdown, /cloud-gemini-voyage-rerank/);
  assert.match(providerMarkdown, /cloud-gemini2-voyage-rerank/);
  assert.match(providerMarkdown, /cloud-nvidia-nv-embed-v1-mistral-rerank/);
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
    assert.equal(armExport.queryShard?.requested, false);
    assert.equal(armExport.queryShard?.queryOffset, 0);
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
  assert.ok(answerQualityArmExportFixture.arms?.every((item) => item.queryShard?.completeDataset === true));
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
  assert.equal(memoryScoreReviewerIntakeEvidence.ok, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.mode, "memory-score-reviewer-approval-intake");
  assert.equal(memoryScoreReviewerIntakeEvidence.status, "BLOCKED_MEMORY_SCORE_REVIEWERS");
  assert.equal(memoryScoreReviewerIntakeEvidence.metricsOnly, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.publicSafe, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.callsProviderApis, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.sendsBenchmarkTextToProvider, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.publicBenchmarkApprovalReady, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.countsAsFullMemorySotaReview, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.reviewerApprovalCount, 0);
  assert.equal(memoryScoreReviewerIntakeEvidence.independentReviewerCount, 0);
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.memoryBenchAnswerQuality, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.fixtureOnly, false);
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.scoredQueryCount, 30);
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.answerModel, "qwen36-a3b-main-q8kv-8192");
  assert.equal(memoryScoreReviewerIntakeEvidence.target?.judgeModel, "qwen36-a3b-main-q8kv-8192");
  assert.match(String(memoryScoreReviewerIntakeEvidence.target?.resultHash), /^sha256:/);
  assert.ok(memoryScoreReviewerIntakeEvidence.blockers.includes("two-independent-reviewer-approvals-missing"));
  assert.ok(memoryScoreReviewerIntakeEvidence.reviews?.every((review) => review.targetBound === false));
  assert.ok(memoryScoreReviewerIntakeEvidence.reviews?.some((review) => review.provider === "deepseek-pro" && review.countable === false));
  assert.ok(memoryScoreReviewerIntakeEvidence.reviews?.some((review) => review.provider === "zai" && review.countable === false));
  assert.equal(memoryScoreReviewerIntakeEvidence.safety?.requiresResultBinding, true);
  assert.equal(memoryScoreReviewerIntakeEvidence.safety?.requiresTwoIndependentReviewersForClaims, true);
  assert.match(memoryScoreReviewerIntakeMarkdownFresh, /Memory Score Reviewer Approval Intake/);
  assert.match(memoryScoreReviewerIntakeMarkdownEvidence, /BLOCKED_MEMORY_SCORE_REVIEWERS/);
  assert.equal(answerQualityArmExportLiveLocalEvidence.mode, "public-benchmark-answer-quality-arm-export");
  assert.equal(answerQualityArmExportLiveLocalEvidence.status, "EXPORTED_RESPONSE_ARMS");
  assert.equal(answerQualityArmExportLiveLocalEvidence.fixtureOnly, false);
  assert.equal(answerQualityArmExportLiveLocalEvidence.readyForAnswerQualityPreflight, true);
  assert.equal(answerQualityArmExportLiveLocalEvidence.rawPrivateOutputPathIncluded, false);
  assert.equal(answerQualityArmExportLiveLocalEvidence.arms?.length, 5);
  assert.ok(answerQualityArmExportLiveLocalEvidence.arms?.some((item) => item.strategy === "local-apple-qwen3-0_6b-local-rerank"));
  assert.equal(answerQualityPreflightLiveLocalEvidence.mode, "public-benchmark-answer-quality-preflight");
  assert.equal(answerQualityPreflightLiveLocalEvidence.status, "BLOCKED_ANSWER_QUALITY_ENV");
  assert.equal(answerQualityPreflightLiveLocalEvidence.readiness?.sameDataReady, true);
  assert.equal(answerQualityPreflightLiveLocalEvidence.readiness?.readyForEndToEndMemoryScoreGate, false);
  assert.equal(answerQualityPreflightLiveLocalEvidence.models?.answerModelMatchesTarget, false);
  assert.equal(answerQualityPreflightLiveLocalEvidence.models?.judgeModelMatchesTarget, false);
  assert.ok(answerQualityPreflightLiveLocalEvidence.blockers.includes("answer-model-does-not-match-target"));
  assert.ok(answerQualityPreflightLiveLocalEvidence.blockers.includes("judge-model-does-not-match-target"));
  assert.equal(answerQualityLiveLocalEvidence.mode, "public-benchmark-answer-quality");
  assert.equal(answerQualityLiveLocalEvidence.fixtureOnly, false);
  assert.equal(answerQualityLiveLocalEvidence.readyForEndToEndMemoryScoreGate, true);
  assert.equal(answerQualityLiveLocalEvidence.provider?.callsMade, 300);
  assert.equal(answerQualityLiveLocalEvidence.winner?.strategy, "local-apple-qwen3-0_6b-local-rerank");
  assert.equal(answerQualityLiveLocalEvidence.winner?.answerQuality, 36);
  assert.equal(answerQualityPreflightLiveProviderEvidence.mode, "public-benchmark-answer-quality-preflight");
  assert.equal(answerQualityPreflightLiveProviderEvidence.status, "BLOCKED_ANSWER_QUALITY_ENV");
  assert.equal(answerQualityPreflightLiveProviderEvidence.readiness?.sameDataReady, true);
  assert.equal(answerQualityPreflightLiveProviderEvidence.readiness?.readyForEndToEndMemoryScoreGate, false);
  assert.equal(answerQualityPreflightLiveProviderEvidence.models?.answerModelMatchesTarget, false);
  assert.equal(answerQualityPreflightLiveProviderEvidence.models?.judgeModelMatchesTarget, false);
  assert.ok(answerQualityPreflightLiveProviderEvidence.blockers.includes("answer-model-does-not-match-target"));
  assert.ok(answerQualityPreflightLiveProviderEvidence.blockers.includes("judge-model-does-not-match-target"));
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
    assert.equal(shardCombined.artifactProfile?.fingerprintPolicy, "digest");
    assert.ok(shardCombined.strategies?.every((item) => !Array.isArray(item.resultFingerprints)));
    assert.ok(shardCombined.strategies?.every((item) => item.resultFingerprintDigest?.count === 2));

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
  assert.ok(endToEndMemoryScoreGateEvidence.blockers.includes("answer-model-does-not-match-target"));
  assert.ok(endToEndMemoryScoreGateEvidence.blockers.includes("judge-model-does-not-match-target"));
  assert.ok(endToEndMemoryScoreGateEvidence.blockers.includes("memory-score-reviewer-approval-report-not-ready"));
  assert.ok(endToEndMemoryScoreGateEvidence.blockers.includes("missing-two-independent-reviewer-approvals"));
  assert.equal(endToEndMemoryScoreGateEvidence.blockers.includes("missing-nvidia-or-gemini-provider-arm"), false);
  assert.ok(endToEndMemoryScoreGateEvidence.fullSotaBlockers.includes("reported-target-judge-model-does-not-match-result"));
  assert.ok(endToEndMemoryScoreGateEvidence.fullSotaBlockers.includes("missing-full-or-officially-comparable-memory-benchmark-run"));
  assert.ok(endToEndMemoryScoreGateEvidence.fullSotaBlockers.includes("best-end-to-end-score-below-primary-reported-memory-target"));
  assert.equal(endToEndMemoryScoreGateEvidence.reportedTargetsEvidence?.status, "READY_REPORTED_TARGETS");
  assert.equal(endToEndMemoryScoreGateEvidence.reportedTargetComparison?.primaryTarget?.id, "supermemory-production-research-gemini-3-pro");
  assert.equal(endToEndMemoryScoreGateEvidence.reportedTargetComparison?.scoreDelta, -42.0333);
  assert.equal(endToEndMemoryScoreGateEvidence.reportedTargetComparison?.meetsPrimaryReportedTarget, false);
  assert.equal(endToEndMemoryScoreGateEvidence.reportedTargetComparison?.sameJudgeModelAsPrimaryTarget, false);
  assert.equal(endToEndMemoryScoreGateEvidence.fullBenchmarkPolicy?.currentAnswerQualityQueryCount, 30);
  assert.equal(endToEndMemoryScoreGateEvidence.fullBenchmarkPolicy?.minimumFullQueryCount, 500);
  assert.equal(endToEndMemoryScoreGateEvidence.fullBenchmarkPolicy?.fullOrOfficiallyComparableRunPresent, false);
  assert.equal(endToEndMemoryScoreGateEvidence.reviewerApproval?.exists, true);
  assert.equal(endToEndMemoryScoreGateEvidence.reviewerApproval?.targetBound, true);
  assert.equal(endToEndMemoryScoreGateEvidence.reviewerApproval?.reviewerApprovalCount, 0);
  assert.equal(endToEndMemoryScoreGateEvidence.result?.answerModel, "qwen36-a3b-main-q8kv-8192");
  assert.equal(endToEndMemoryScoreGateEvidence.result?.judgeModel, "qwen36-a3b-main-q8kv-8192");
  assert.equal(endToEndMemoryScoreGateEvidence.target?.answerModel, "gpt-4o");
  assert.equal(endToEndMemoryScoreGateEvidence.target?.judgeModel, "gpt-4o");
  assert.equal(reportedTargetsFresh.mode, "public-benchmark-reported-targets");
  assert.equal(reportedTargetsFresh.status, "READY_REPORTED_TARGETS");
  assert.equal(reportedTargetsFresh.primaryReportedMemoryTarget?.id, "supermemory-production-research-gemini-3-pro");
  assert.equal(reportedTargetsFresh.primaryReportedMemoryTarget?.score, 85.2);
  assert.equal(reportedTargetsFresh.primaryReportedMemoryTarget?.judgeModel, "gemini-3-pro");
  assert.equal(reportedTargetsFresh.primaryReportedMemoryTarget?.eligibleAsPrimaryReportedTarget, true);
  assert.equal(reportedTargetsFresh.sourceEvidenceCheckedAt, "2026-05-26");
  assert.equal(reportedTargetsFresh.checks?.sourceEvidenceCheckedAtCurrent, true);
  assert.equal(reportedTargetsFresh.checks?.everyMemoryTargetHasSourceLock, true);
  assert.equal(reportedTargetsFresh.checks?.componentTargetsAreModelSelectionOnly, true);
  assert.equal(reportedTargetsFresh.checks?.requiredComponentTargetIdsCovered, true);
  assert.equal(reportedTargetsFresh.checks?.requiredBenchmarkHarnessTargetIdsCovered, true);
  assert.equal(reportedTargetsFresh.checks?.benchmarkHarnessTargetsAreSourceOnly, true);
  assert.ok(reportedTargetsFresh.memoryTargets?.some((item) => item.id === "supermemory-experimental-asmr" && item.eligibleAsPrimaryReportedTarget === false));
  assert.ok(reportedTargetsFresh.componentTargets?.some((item) => item.id === "qwen3-embedding-0_6b-mteb-english-v2"));
  assert.ok(reportedTargetsFresh.componentTargets?.some((item) => item.id === "qwen3-reranker-0_6b-mteb-r"));
  assert.ok(reportedTargetsFresh.componentTargets?.some((item) => item.id === "embeddinggemma-local-model-card"));
  assert.ok(reportedTargetsFresh.componentTargets?.some((item) => item.id === "gemini-embedding-2-model-card"));
  assert.ok(reportedTargetsFresh.benchmarkHarnessTargets?.some((item) => item.id === "memorybench-supermemory-unified-suite"));
  assert.match(reportedTargetsMarkdownFresh, /Reported Memory Targets/);
  assert.match(reportedTargetsMarkdownFresh, /Benchmark Harness Targets/);
  assert.match(reportedTargetsMarkdownFresh, /Missing component source locks: none/);
  assert.equal(reportedTargetsEvidence.schemaVersion, 1);
  assert.equal(reportedTargetsEvidence.sourceEvidenceCheckedAt, "2026-05-26");
  assert.match(reportedTargetsMarkdownEvidence, /Primary target: supermemory-production-research-gemini-3-pro/);
  assert.equal(sotaLadderFresh.mode, "public-benchmark-sota-ladder");
  assert.equal(sotaLadderFresh.status, "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE");
  assert.equal(sotaLadderFresh.reportedTargetsEvidence?.status, "READY_REPORTED_TARGETS");
  assert.equal(sotaLadderFresh.reportedTargetsEvidence?.primaryReportedMemoryTarget, "supermemory-production-research-gemini-3-pro");
  assert.equal(sotaLadderFresh.reportedTargetsEvidence?.sourceEvidenceCheckedAt, "2026-05-26");
  assert.equal(sotaLadderFresh.reportedTargetsEvidence?.benchmarkHarnessTargetCount, 1);
  assert.equal(sotaLadderFresh.checks?.benchmarkHarnessTargetsSourceLocked, true);
  assert.equal(sotaLadderFresh.fullBenchmarkPolicy?.currentAnswerQualityQueryCount, 30);
  assert.equal(sotaLadderFresh.fullBenchmarkPolicy?.minimumFullQueryCount, 500);
  assert.equal(sotaLadderFresh.fullBenchmarkPolicy?.fullOrOfficiallyComparableRunPresent, false);
  assert.ok(sotaLadderFresh.blockers.includes("missing-full-or-officially-comparable-memory-benchmark-run"));
  assert.ok(sotaLadderFresh.blockers.includes("end-to-end-gate:answer-model-does-not-match-target"));
  assert.ok(sotaLadderFresh.blockers.includes("end-to-end-gate:judge-model-does-not-match-target"));
  assert.equal(sotaLadderFresh.reportedTargetComparison?.sameJudgeModelAsPrimaryTarget, false);
  assert.ok(sotaLadderFresh.componentEvidence?.some((item) => item.id === "embeddinggemma-local-model-card"));
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
    assert.equal(preflight.models?.answerModelMatchesTarget, false);
    assert.equal(preflight.models?.judgeModelMatchesTarget, false);
    assert.equal(preflight.target?.answerModel, "gpt-4o");
    assert.equal(preflight.target?.judgeModel, "gpt-4o");
    assert.ok(preflight.blockers.includes("private-queryset-missing"));
    assert.ok(preflight.blockers.includes("response-arm-exports-missing"));
    assert.equal(preflight.requiredStrategyCoverage?.hasBm25Lite, false);
    assert.equal(preflight.requiredStrategyCoverage?.hasFullHybridRerank, false);
    assert.equal(preflight.requiredStrategyCoverage?.hasChallenger, false);
  }
  const answerQualityModelMismatchPreflight = JSON.parse(
    run("node", ["packages/bench/public-benchmark-answer-quality-preflight.mjs"], {
      env: {
        ...process.env,
        RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS: "1",
        RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA: "1",
        RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT: "1",
        RECALLWEAVE_MEMORYBENCH_BASE_URL: "http://127.0.0.1:8080",
        RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "fixture-wrong-answer",
        RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "fixture-wrong-judge",
      },
    }).stdout,
  );
  assert.equal(answerQualityModelMismatchPreflight.status, "BLOCKED_ANSWER_QUALITY_ENV");
  assert.equal(answerQualityModelMismatchPreflight.models?.answerModelMatchesTarget, false);
  assert.equal(answerQualityModelMismatchPreflight.models?.judgeModelMatchesTarget, false);
  assert.ok(answerQualityModelMismatchPreflight.blockers.includes("answer-model-does-not-match-target"));
  assert.ok(answerQualityModelMismatchPreflight.blockers.includes("judge-model-does-not-match-target"));
  const localDiagnosticMismatchPreflight = JSON.parse(
    run("node", ["packages/bench/public-benchmark-answer-quality-preflight.mjs", "--claim-scope", "local-full"], {
      env: {
        ...process.env,
        RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS: "1",
        RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA: "1",
        RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT: "1",
        RECALLWEAVE_MEMORYBENCH_BASE_URL: "http://127.0.0.1:8080",
        RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "local-diagnostic-answer",
        RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "local-diagnostic-judge",
      },
    }).stdout,
  );
  assert.equal(localDiagnosticMismatchPreflight.claimScope, "local-full");
  assert.equal(localDiagnosticMismatchPreflight.scoringPolicy?.modelMatchPolicy, "local-diagnostic-allowed");
  assert.equal(localDiagnosticMismatchPreflight.scoringPolicy?.scoringModelPolicySatisfied, true);
  assert.equal(localDiagnosticMismatchPreflight.blockers.includes("answer-model-does-not-match-target"), false);
  assert.equal(localDiagnosticMismatchPreflight.blockers.includes("judge-model-does-not-match-target"), false);
  const localDiagnosticCloudEndpointPreflight = JSON.parse(
    run("node", ["packages/bench/public-benchmark-answer-quality-preflight.mjs", "--claim-scope", "local-full"], {
      env: {
        ...process.env,
        RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS: "1",
        RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA: "1",
        RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT: "1",
        RECALLWEAVE_MEMORYBENCH_BASE_URL: "https://api.example.invalid/v1",
        RECALLWEAVE_MEMORYBENCH_API_KEY: "dummy-local-diagnostic-key",
        RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "local-diagnostic-answer",
        RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "local-diagnostic-judge",
      },
    }).stdout,
  );
  assert.equal(localDiagnosticCloudEndpointPreflight.scoringPolicy?.scoringModelPolicySatisfied, false);
  assert.ok(localDiagnosticCloudEndpointPreflight.blockers.includes("local-diagnostic-scoring-requires-local-endpoint"));
  assert.match(answerQualityPreflightMarkdownFresh, /Answer-Quality Benchmark Preflight/);
  assert.match(answerQualityPreflightMarkdownEvidence, /BLOCKED_ANSWER_QUALITY_ENV/);
  const shardPreflightFixture = writeSyntheticShardPreflightFixture(mkdtempSync(join(tmpdir(), "recallweave-shard-preflight-")));
  const shardPreflightEnv = {
    ...process.env,
    RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS: "1",
    RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA: "1",
    RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT: "1",
    RECALLWEAVE_MEMORYBENCH_BASE_URL: "http://127.0.0.1:8080",
    RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL: "gpt-4o",
    RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL: "gpt-4o",
  };
  const shardPreflightReady = JSON.parse(
    run(
      "node",
      [
        "packages/bench/public-benchmark-answer-quality-preflight.mjs",
        "--require-ready",
        "--target",
        shardPreflightFixture.targetPath,
        "--queryset",
        shardPreflightFixture.querySetPath,
        "--memories",
        shardPreflightFixture.memoriesPath,
        "--answer-labels",
        shardPreflightFixture.answerLabelsPath,
        "--query-offset",
        "1",
        "--max-queries",
        "1",
        ...shardPreflightFixture.armArgs,
      ],
      { env: shardPreflightEnv },
    ).stdout,
  );
  assert.equal(shardPreflightReady.status, "READY_FOR_LIVE_ANSWER_QUALITY");
  assert.equal(shardPreflightReady.queryShard?.startIndex, 1);
  assert.equal(shardPreflightReady.queryShard?.endIndexExclusive, 2);
  assert.equal(shardPreflightReady.queryShard?.selectedQueryCount, 1);
  assert.equal(shardPreflightReady.readiness?.responseArmsCoverSelectedShard, true);
  assert.equal(shardPreflightReady.readiness?.sameDataReady, true);
  assert.ok(shardPreflightReady.arms.every((arm) => arm.querySetMatches === true));
  assert.ok(shardPreflightReady.arms.every((arm) => arm.selectedShardCoverage?.ready === true));
  assert.ok(shardPreflightReady.arms.every((arm) => arm.selectedShardCoverage?.responseCount === 1));
  const shardPreflightMismatch = JSON.parse(
    run(
      "node",
      [
        "packages/bench/public-benchmark-answer-quality-preflight.mjs",
        "--target",
        shardPreflightFixture.targetPath,
        "--queryset",
        shardPreflightFixture.querySetPath,
        "--memories",
        shardPreflightFixture.memoriesPath,
        "--answer-labels",
        shardPreflightFixture.answerLabelsPath,
        "--query-offset",
        "0",
        "--max-queries",
        "1",
        ...shardPreflightFixture.armArgs,
      ],
      { env: shardPreflightEnv },
    ).stdout,
  );
  assert.equal(shardPreflightMismatch.status, "BLOCKED_ANSWER_QUALITY_ENV");
  assert.equal(shardPreflightMismatch.readiness?.responseArmsCoverSelectedShard, false);
  assert.ok(shardPreflightMismatch.blockers.includes("response-arm-selected-shard-coverage-mismatch"));
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
    "cloud-gemini2-embed-rerank-proxy",
    "cloud-gemini2-voyage-rerank",
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
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-gemini2-embed-rerank-proxy" && item.provider?.fixtureProviderMock === true));
  assert.ok(providerGateFixtureReport.strategies?.some((item) => item.strategy === "cloud-gemini2-voyage-rerank" && item.provider?.fixtureProviderMock === true));
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
    "cloud-gemini2-embed-rerank-proxy",
    "cloud-gemini2-voyage-rerank",
    "cloud-nvidia-retriever-500m",
    "cloud-nvidia-nemotron-1b",
    "cloud-nvidia-e5-mistral",
    "local-apple-qwen3-0_6b",
  ]);
  assert.match(providerLivePreflightEvidence, /Provider Benchmark Live Preflight/);
  assert.match(providerLivePreflightEvidence, /Live run allowed: false/);
  assert.match(providerLivePreflightEvidence, /cloud-gemini-voyage-rerank/);
  assert.match(providerLivePreflightEvidence, /cloud-gemini2-voyage-rerank/);
  assert.match(providerLivePreflightEvidence, /cloud-nvidia-nemotron-1b/);
  assert.match(providerLivePreflightEvidence, /local-apple-qwen3-0_6b/);
  assert.equal(providerWaveIntakeReport.ok, true);
  assert.equal(providerWaveIntakeReport.mode, "provider-wave-intake");
  assert.equal(providerWaveIntakeReport.status, "READY_PROVIDER_WAVE_INTAKE");
  assert.equal(providerWaveIntakeReport.metricsOnly, true);
  assert.equal(providerWaveIntakeReport.publicSafe, true);
  assert.equal(providerWaveIntakeReport.callsProviderApis, false);
  assert.equal(providerWaveIntakeReport.publicBenchmarkClaimsAllowed, false);
  assert.equal(providerWaveIntakeReport.countsAsFullMemorySotaEvidence, false);
  assert.equal(providerWaveIntakeReport.countsAsEndToEndMemoryBenchmark, false);
  assert.equal(providerWaveIntakeReport.controls?.allHaveBm25, true);
  assert.equal(providerWaveIntakeReport.controls?.allHaveFullHybrid, true);
  assert.ok(providerWaveIntakeReport.providers?.completedProviderFamilies?.includes("gemini"));
  assert.ok(providerWaveIntakeReport.providers?.completedProviderFamilies?.includes("nvidia"));
  assert.ok(providerWaveIntakeReport.providers?.completedProviderFamilies?.includes("voyage"));
  assert.match(providerWaveIntakeEvidence, /Provider Wave Intake/);
  assert.match(providerWaveIntakeEvidence, /All waves include BM25: true/);
  assert.match(providerWaveIntakeEvidence, /All waves include full hybrid: true/);
  assert.match(providerWaveIntakeEvidence, /Counts as full memory SOTA evidence: false/);
  assert.equal(providerWaveIntakeFresh.ok, true);
  assert.equal(providerWaveIntakeFresh.controls?.allHaveBm25, true);
  assert.equal(providerWaveIntakeFresh.controls?.allHaveFullHybrid, true);
  assert.equal(providerWaveIntakeFresh.publicBenchmarkClaimsAllowed, false);
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
  assert.equal(fullMaterializeReport.rawSourcesRetainedPrivate, true);
  assert.equal(fullMaterializeReport.sourceRetention?.rawDatasetRetainedPrivate, true);
  assert.equal(fullMaterializeReport.sourceRetention?.selectedRawRowsRetainedPrivate, true);
  assert.equal(fullMaterializeReport.sourceRetention?.sourceManifestRetainedPrivate, true);
  assert.equal(fullMaterializeReport.sourceRetention?.rawTextPubliclyIncluded, false);
  assert.equal(fullMaterializeReport.sourceRetention?.rawDatasetItemCount, 500);
  assert.equal(fullMaterializeReport.sourceRetention?.selectedRawRowsCount, 500);
  assert.equal(fullMaterializeReport.selection?.redactionStats?.keyShapedTokenRedactionCount, 4);
  assert.match(fullMaterializeEvidence, /Query count: 500/);
  assert.match(fullMaterializeEvidence, /Source Retention/);
  for (const shardPlan of [answerQualityShardPlanFresh, fullAnswerQualityShardPlan]) {
    assert.equal(shardPlan.mode, "public-benchmark-answer-quality-shard-plan");
    assert.equal(shardPlan.status, "READY_FULL_ANSWER_QUALITY_SHARD_RUN");
    assert.equal(shardPlan.claimScope, "full-sota");
    assert.equal(shardPlan.publicSafe, true);
    assert.equal(shardPlan.metricsOnly, true);
    assert.equal(shardPlan.publicBenchmarkClaimsAllowed, false);
    assert.equal(shardPlan.readyForAnswerQualityShardRun, true);
    assert.equal(shardPlan.readyForEndToEndMemoryScoreGate, false);
    assert.equal(shardPlan.countsAsFullMemorySotaEvidence, false);
    assert.equal(shardPlan.rawQuestionIdsIncluded, false);
    assert.equal(shardPlan.rawQuestionsIncluded, false);
    assert.equal(shardPlan.rawAnswersIncluded, false);
    assert.equal(shardPlan.rawMemoryIncluded, false);
    assert.equal(shardPlan.rawTranscriptIncluded, false);
    assert.equal(shardPlan.rawPrivateOutputPathIncluded, false);
    assert.equal(shardPlan.runPlan?.queryCount, 500);
    assert.equal(shardPlan.runPlan?.shardSize, 25);
    assert.equal(shardPlan.runPlan?.shardCount, 20);
    assert.equal(shardPlan.runPlan?.maxMemoryBytes, 300000000);
    assert.equal(shardPlan.shards?.[0]?.startIndex, 0);
    assert.equal(shardPlan.shards?.at(-1)?.endIndexExclusive, 500);
    assert.equal(shardPlan.strategyCoverage?.hasBm25Lite, true);
    assert.equal(shardPlan.strategyCoverage?.hasFullHybridRerank, true);
    assert.equal(shardPlan.strategyCoverage?.hasQueryExpansion, true);
    assert.equal(shardPlan.strategyCoverage?.hasVoyageProvider, true);
    assert.equal(shardPlan.strategyCoverage?.hasNvidiaOrGeminiProvider, true);
    assert.equal(shardPlan.strategyCoverage?.hasLocalApple, true);
    assert.equal(shardPlan.strategyCoverage?.hasLocalRerank, true);
    assert.ok(Array.isArray(shardPlan.executionLanes));
    assert.ok(shardPlan.executionLanes.length >= 5);
    const executionLanes = new Map(shardPlan.executionLanes.map((lane) => [lane.id, lane]));
    const deterministicLane = executionLanes.get("deterministic-control-proxy");
    const localAppleLane = executionLanes.get("local-apple-no-spend");
    const voyageLane = executionLanes.get("voyage-minimum-challenger");
    const geminiLane = executionLanes.get("gemini2-minimum-challenger");
    const nvidiaLane = executionLanes.get("nvidia-minimum-challenger");
    const fullLane = executionLanes.get("full-sota-accepted-shards");
    assert.equal(deterministicLane?.coverageReady, true);
    assert.equal(deterministicLane?.acceptedByFullShardIntake, false);
    assert.deepEqual(deterministicLane?.providerRequirements, []);
    assert.equal(deterministicLane?.queryExpansionEvidenceRequirement, "deterministic-fallback-only");
    assert.equal(deterministicLane?.queryExpansionDiagnosticFallbackAllowed, true);
    assert.equal(deterministicLane?.queryExpansionSotaEligible, false);
    assert.equal(localAppleLane?.coverageReady, true);
    assert.equal(localAppleLane?.acceptedByFullShardIntake, false);
    assert.deepEqual(localAppleLane?.providerRequirements, ["local-apple", "local-rerank"]);
    assert.equal(localAppleLane?.queryExpansionEvidenceRequirement, "local-model-or-deterministic-diagnostic");
    assert.equal(localAppleLane?.queryExpansionDiagnosticFallbackAllowed, true);
    assert.equal(localAppleLane?.queryExpansionSotaEligible, false);
    assert.equal(voyageLane?.coverageReady, true);
    assert.equal(voyageLane?.acceptedByFullShardIntake, false);
    assert.deepEqual(voyageLane?.providerRequirements, ["voyage"]);
    assert.equal(voyageLane?.queryExpansionEvidenceRequirement, "not-required");
    assert.equal(geminiLane?.coverageReady, true);
    assert.equal(geminiLane?.acceptedByFullShardIntake, false);
    assert.deepEqual(geminiLane?.providerRequirements, ["gemini"]);
    assert.equal(geminiLane?.queryExpansionEvidenceRequirement, "not-required");
    assert.equal(nvidiaLane?.coverageReady, true);
    assert.equal(nvidiaLane?.acceptedByFullShardIntake, false);
    assert.deepEqual(nvidiaLane?.providerRequirements, ["nvidia"]);
    assert.equal(nvidiaLane?.queryExpansionEvidenceRequirement, "not-required");
    assert.equal(fullLane?.coverageReady, true);
    assert.equal(fullLane?.acceptedByFullShardIntake, true);
    assert.equal(fullLane?.canReachFullSotaGateAfterShardIntake, true);
    assert.deepEqual(fullLane?.strategies, shardPlan.runPlan?.strategies);
    assert.deepEqual(fullLane?.providerRequirements, ["gemini", "local-apple", "local-rerank", "nvidia", "voyage"]);
    assert.equal(fullLane?.queryExpansionEvidenceRequirement, "local-or-cloud-model-required");
    assert.equal(fullLane?.queryExpansionDiagnosticFallbackAllowed, false);
    assert.equal(fullLane?.queryExpansionSotaEligible, true);
    assert.equal(fullLane?.answerQualityEndpoint?.answerModel, fullRunTarget.benchmark?.answerModel);
    assert.equal(fullLane?.answerQualityEndpoint?.judgeModel, fullRunTarget.benchmark?.judgeModel);
    assert.equal(fullLane?.answerQualityEndpoint?.modelMatchPolicy, "exact-target-required");
    assert.equal(fullLane?.answerQualityEndpoint?.exactTargetModelsRequired, true);
    assert.equal(fullLane?.answerQualityEndpoint?.localDiagnosticModelAllowed, false);
    assert.equal(shardPlan.scoringPolicy?.modelMatchPolicy, "exact-target-required");
    assert.deepEqual(shardPlan.blockers, []);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /--query-offset \{startIndex\}/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /--max-memory-bytes 300000000/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-base-url>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_EMBED_MAX_TOKENS=<safe-local-embedding-max-token-limit>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT=<safe-local-dense-candidate-limit>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-base-url>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_EMBED_DURABILITY_REPORT=reviews\/overnight-20260522\/local-embedding-durability-smoke-20260526\.json/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /--require-local-embedding-durability/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /--local-embedding-durability-report reviews\/overnight-20260522\/local-embedding-durability-smoke-20260526\.json/);
    assert.match(shardPlan.runPlan?.preflightTemplate ?? "", /benchmark:answer-quality:preflight/);
    assert.match(shardPlan.runPlan?.preflightTemplate ?? "", /--query-offset \{startIndex\}/);
    assert.match(shardPlan.runPlan?.preflightTemplate ?? "", /--max-queries \{queryCount\}/);
    assert.match(shardPlan.runPlan?.answerQualityTemplate ?? "", /--max-queries \{queryCount\}/);
    assert.match(shardPlan.runPlan?.combineCommand ?? "", /--combine-mode shards/);
  }
  for (const shardPlan of [answerQualityLocalShardPlanFresh, localFullAnswerQualityShardPlan]) {
    assert.equal(shardPlan.mode, "public-benchmark-answer-quality-shard-plan");
    assert.equal(shardPlan.status, "READY_FULL_ANSWER_QUALITY_SHARD_RUN");
    assert.equal(shardPlan.claimScope, "local-full");
    assert.equal(shardPlan.readyForAnswerQualityShardRun, true);
    assert.equal(shardPlan.countsAsFullMemorySotaEvidence, false);
    assert.equal(shardPlan.publicBenchmarkClaimsAllowed, false);
    assert.equal(shardPlan.strategyCoverage?.hasBm25Lite, true);
    assert.equal(shardPlan.strategyCoverage?.hasFullHybridRerank, true);
    assert.equal(shardPlan.strategyCoverage?.hasQueryExpansion, true);
    assert.equal(shardPlan.strategyCoverage?.hasLocalApple, true);
    assert.equal(shardPlan.strategyCoverage?.hasLocalRerank, true);
    assert.equal(shardPlan.strategyCoverage?.hasVoyageProvider, false);
    assert.equal(shardPlan.strategyCoverage?.hasNvidiaOrGeminiProvider, false);
    assert.equal(shardPlan.coverageRequirements?.localApplePresent, true);
    assert.equal(shardPlan.coverageRequirements?.localRerankPresent, true);
    assert.equal(Object.hasOwn(shardPlan.coverageRequirements ?? {}, "voyageProviderPresent"), false);
    assert.equal(Object.hasOwn(shardPlan.coverageRequirements ?? {}, "nvidiaOrGeminiProviderPresent"), false);
    assert.deepEqual(shardPlan.blockers, []);
    const executionLanes = new Map(shardPlan.executionLanes.map((lane) => [lane.id, lane]));
    const acceptedLocalLane = executionLanes.get("local-full-accepted-shards");
    assert.equal(acceptedLocalLane?.coverageReady, true);
    assert.equal(acceptedLocalLane?.acceptedByFullShardIntake, true);
    assert.equal(acceptedLocalLane?.canReachFullSotaGateAfterShardIntake, false);
    assert.deepEqual(acceptedLocalLane?.providerRequirements, ["local-apple", "local-rerank"]);
    assert.equal(acceptedLocalLane?.queryExpansionEvidenceRequirement, "local-or-cloud-model-required");
    assert.equal(acceptedLocalLane?.queryExpansionDiagnosticFallbackAllowed, false);
    assert.equal(acceptedLocalLane?.queryExpansionSotaEligible, false);
    assert.equal(acceptedLocalLane?.answerQualityEndpoint?.modelMatchPolicy, "local-diagnostic-allowed");
    assert.equal(acceptedLocalLane?.answerQualityEndpoint?.exactTargetModelsRequired, false);
    assert.equal(acceptedLocalLane?.answerQualityEndpoint?.localDiagnosticModelAllowed, true);
    assert.equal(acceptedLocalLane?.answerQualityEndpoint?.answerModel, "<local-answer-model>");
    assert.equal(acceptedLocalLane?.answerQualityEndpoint?.judgeModel, "<local-judge-model>");
    assert.equal(shardPlan.scoringPolicy?.modelMatchPolicy, "local-diagnostic-allowed");
    assert.equal(shardPlan.runPlan?.supermemorySearchPolicy, "disabled-for-benchmark-methodology");
    assert.deepEqual(shardPlan.runPlan?.supermemorySearchDisabledEnv, [
      "RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1",
      "SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1",
    ]);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-base-url>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_EMBED_MAX_TOKENS=<safe-local-embedding-max-token-limit>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT=<safe-local-dense-candidate-limit>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-base-url>/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_LOCAL_EMBED_DURABILITY_REPORT=reviews\/overnight-20260522\/local-embedding-durability-smoke-20260526\.json/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /--require-local-embedding-durability/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /--local-embedding-durability-report reviews\/overnight-20260522\/local-embedding-durability-smoke-20260526\.json/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /SELFMEM_QUERY_EXPANSION_BASE_URL/);
    assert.match(shardPlan.runPlan?.preflightTemplate ?? "", /--claim-scope local-full/);
    assert.match(shardPlan.runPlan?.preflightTemplate ?? "", /--model-match-policy local-diagnostic-allowed/);
    assert.match(shardPlan.runPlan?.preflightTemplate ?? "", /RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1/);
    assert.match(shardPlan.runPlan?.preflightTemplate ?? "", /SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1/);
    assert.match(shardPlan.runPlan?.answerQualityTemplate ?? "", /RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<local-answer-model>/);
    assert.match(shardPlan.runPlan?.answerQualityTemplate ?? "", /RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1/);
    assert.match(shardPlan.runPlan?.answerQualityTemplate ?? "", /SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1/);
    assert.match(shardPlan.runPlan?.responseArmExportTemplate ?? "", /RECALLWEAVE_QUERY_EXPANSION_CALLS/);
    assert.doesNotMatch(shardPlan.runPlan?.responseArmExportTemplate ?? "", /RECALLWEAVE_PROVIDER_BENCHMARK_CALLS/);
    assert.match(shardPlan.runPlan?.combineCommand ?? "", /end-to-end-memory-score-local-full-combined/);
  }
  assert.match(answerQualityShardPlanMarkdownFresh, /Full Answer-Quality Shard Plan/);
  assert.match(answerQualityLocalShardPlanMarkdownFresh, /Claim scope: local-full/);
  assert.match(answerQualityShardPlanMarkdownFresh, /Execution Lanes/);
  assert.match(fullAnswerQualityShardPlanEvidence, /Shard count: 20/);
  assert.match(fullAnswerQualityShardPlanEvidence, /Max memory bytes: 300000000/);
  assert.match(fullAnswerQualityShardPlanEvidence, /full-sota-accepted-shards/);
  assert.match(localFullAnswerQualityShardPlanEvidence, /Claim scope: local-full/);
  assert.match(localFullAnswerQualityShardPlanEvidence, /local-full-accepted-shards/);
  assert.equal(privateInputDoctorBlocked.mode, "full-shard-private-input-doctor");
  assert.equal(privateInputDoctorBlocked.status, "BLOCKED_FULL_SHARD_PRIVATE_INPUTS");
  assert.equal(privateInputDoctorBlocked.readyForAnswerQualityShardRun, false);
  assert.equal(privateInputDoctorBlocked.countsAsFullMemorySotaEvidence, false);
  assert.equal(privateInputDoctorBlocked.publicBenchmarkClaimsAllowed, false);
  assert.equal(privateInputDoctorBlocked.rawPrivateOutputPathIncluded, false);
  assert.ok(privateInputDoctorBlocked.blockers?.includes("private-input-dir-provided"));
  assert.ok(privateInputDoctorBlocked.blockers?.includes("max-memory-bytes-covers-private-memories"));
  assert.equal(privateInputDoctorBlocked.checks?.responseArmTemplateCarriesMemoryLimit, true);
  assert.equal(privateInputDoctorReady.mode, "full-shard-private-input-doctor");
  assert.equal(privateInputDoctorReady.status, "READY_FULL_SHARD_PRIVATE_INPUTS");
  assert.equal(privateInputDoctorReady.readyForAnswerQualityShardRun, true);
  assert.equal(privateInputDoctorReady.countsAsFullMemorySotaEvidence, false);
  assert.equal(privateInputDoctorReady.publicBenchmarkClaimsAllowed, false);
  assert.equal(privateInputDoctorReady.rawPrivateOutputPathIncluded, false);
  assert.equal(privateInputDoctorReady.privateInput?.directoryInsideRepository, false);
  assert.equal(privateInputDoctorReady.plan?.maxMemoryBytes, 300000000);
  assert.equal(privateInputDoctorReady.checks?.allPrivateFilesHashMatched, true);
  assert.equal(privateInputDoctorReady.checks?.allPrivateFilesMode0600, true);
  assert.equal(privateInputDoctorReady.checks?.maxMemoryBytesCoversPrivateMemories, true);
  assert.match(privateInputDoctorReadyEvidence, /READY_FULL_SHARD_PRIVATE_INPUTS/);
  for (const launchDoctor of [acceptedLaneLaunchDoctorFresh, acceptedLaneLaunchDoctorEvidence]) {
    assert.equal(launchDoctor.mode, "full-shard-accepted-lane-launch-doctor");
    assert.equal(launchDoctor.status, "BLOCKED_ACCEPTED_LANE_SHARD_LAUNCH");
    assert.equal(launchDoctor.claimScope, "full-sota");
    assert.equal(launchDoctor.publicSafe, true);
    assert.equal(launchDoctor.metricsOnly, true);
    assert.equal(launchDoctor.callsProviderApis, false);
    assert.equal(launchDoctor.sendsBenchmarkTextToProvider, false);
    assert.equal(launchDoctor.countsAsFullMemorySotaEvidence, false);
    assert.equal(launchDoctor.publicBenchmarkClaimsAllowed, false);
    assert.equal(launchDoctor.rawPrivateOutputPathIncluded, false);
    assert.equal(launchDoctor.plan?.queryCount, 500);
    assert.equal(launchDoctor.plan?.shardCount, 20);
    assert.equal(launchDoctor.plan?.claimScope, "full-sota");
    assert.deepEqual(launchDoctor.plan?.acceptedLaneIds, ["full-sota-accepted-shards"]);
    assert.ok(launchDoctor.plan?.diagnosticLaneIds?.includes("deterministic-control-proxy"));
    assert.equal(launchDoctor.launchGate?.privateInputsReady, true);
    assert.equal(launchDoctor.launchGate?.acceptedLaneReadyForResponseArmExport, false);
    assert.equal(launchDoctor.launchGate?.acceptedLaneReadyForAnswerQualityScoring, false);
    assert.equal(launchDoctor.launchGate?.readyForFirstAcceptedShardRun, false);
    assert.equal(launchDoctor.launchGate?.readyForPublicSotaClaim, false);
    assert.equal(launchDoctor.privateInput?.source, "checked-in-private-input-doctor");
    assert.equal(launchDoctor.privateInput?.readyForAnswerQualityShardRun, true);
    assert.equal(launchDoctor.privateInput?.rawSourcesRetainedPrivate, true);
    assert.equal(launchDoctor.privateInput?.privateDirectoryInsideRepository, false);
    assert.equal(launchDoctor.acceptedLane?.laneId, "full-sota-accepted-shards");
    assert.equal(launchDoctor.acceptedLane?.acceptedByFullShardIntake, true);
    assert.equal(launchDoctor.acceptedLane?.diagnosticOnly, false);
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.evidenceRequirement, "local-or-cloud-model-required");
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.countsAsFullSotaQueryExpansionEvidence, false);
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.diagnosticFallbackAllowed, false);
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.readyForAcceptedShardIntake, false);
    assert.equal(launchDoctor.shardProgress?.pendingShardCount, 20);
    assert.equal(launchDoctor.shardProgress?.firstPendingShardId, "shard-001");
    assert.ok(launchDoctor.operatorInputsNeeded?.some((item) => item.id === "query-expansion-evidence"));
    assert.ok(launchDoctor.operatorInputsNeeded?.some((item) => item.id === "local-apple-readiness"));
    assert.ok(launchDoctor.operatorInputsNeeded?.some((item) => item.id === "local-rerank-readiness"));
    assert.ok(launchDoctor.blockers?.includes("query-expansion-local-endpoint-or-cloud-consent-missing"));
    assert.ok(launchDoctor.blockers?.includes("accepted-lane-answer-quality-scoring-not-ready"));
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("--query-offset 0"));
    assert.ok(launchDoctor.nextCommands?.answerQuality?.includes("--query-offset 0"));
  }
  assert.match(acceptedLaneLaunchDoctorMarkdownFresh, /Accepted Lane Launch Doctor/);
  assert.match(acceptedLaneLaunchDoctorMarkdownFresh, /Ready for first accepted shard run: false/);
  assert.match(acceptedLaneLaunchDoctorMarkdownEvidence, /Query expansion requirement: local-or-cloud-model-required/);
  for (const launchDoctor of [localAcceptedLaneLaunchDoctorFresh, localAcceptedLaneLaunchDoctorEvidence]) {
    assert.equal(launchDoctor.mode, "full-shard-accepted-lane-launch-doctor");
    assert.equal(launchDoctor.status, "BLOCKED_ACCEPTED_LANE_SHARD_LAUNCH");
    assert.equal(launchDoctor.claimScope, "local-full");
    assert.equal(launchDoctor.publicSafe, true);
    assert.equal(launchDoctor.metricsOnly, true);
    assert.equal(launchDoctor.callsProviderApis, false);
    assert.equal(launchDoctor.sendsBenchmarkTextToProvider, false);
    assert.equal(launchDoctor.countsAsFullMemorySotaEvidence, false);
    assert.equal(launchDoctor.publicBenchmarkClaimsAllowed, false);
    assert.equal(launchDoctor.rawPrivateOutputPathIncluded, false);
    assert.equal(launchDoctor.plan?.claimScope, "local-full");
    assert.equal(launchDoctor.plan?.queryCount, 500);
    assert.equal(launchDoctor.plan?.shardCount, 20);
    assert.deepEqual(launchDoctor.plan?.acceptedLaneIds, ["local-full-accepted-shards"]);
    assert.ok(launchDoctor.plan?.diagnosticLaneIds?.includes("deterministic-control-proxy"));
    assert.equal(launchDoctor.launchGate?.privateInputsReady, true);
    assert.equal(launchDoctor.launchGate?.acceptedLaneReadyForResponseArmExport, false);
    assert.equal(launchDoctor.launchGate?.acceptedLaneReadyForAnswerQualityScoring, false);
    assert.equal(launchDoctor.launchGate?.readyForFirstAcceptedShardRun, false);
    assert.equal(launchDoctor.launchGate?.readyForPublicSotaClaim, false);
    assert.equal(launchDoctor.launchGate?.readyForLocalFullBenchmarkResult, false);
    assert.equal(launchDoctor.acceptedLane?.laneId, "local-full-accepted-shards");
    assert.equal(launchDoctor.acceptedLane?.acceptedByFullShardIntake, true);
    assert.equal(launchDoctor.acceptedLane?.canReachFullSotaGateAfterShardIntake, false);
    assert.deepEqual(launchDoctor.acceptedLane?.providerRequirements, ["local-apple", "local-rerank"]);
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.evidenceRequirement, "local-or-cloud-model-required");
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.countsAsFullSotaQueryExpansionEvidence, false);
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.diagnosticFallbackAllowed, false);
    assert.equal(launchDoctor.acceptedLane?.queryExpansion?.readyForAcceptedShardIntake, false);
    assert.equal(launchDoctor.acceptedLane?.answerQuality?.modelMatchPolicy, "local-diagnostic-allowed");
    assert.equal(launchDoctor.acceptedLane?.answerQuality?.exactTargetModelsRequired, false);
    assert.equal(launchDoctor.acceptedLane?.answerQuality?.localDiagnosticModelAllowed, true);
    assert.equal(launchDoctor.acceptedLane?.answerQuality?.scoringModelPolicySatisfied, false);
    assert.equal(launchDoctor.acceptedLane?.responseArmExport?.providerCallsRequired, false);
    assert.equal(Object.hasOwn(launchDoctor.acceptedLane?.providerReadiness ?? {}, "voyage"), false);
    assert.equal(Object.hasOwn(launchDoctor.acceptedLane?.providerReadiness ?? {}, "nvidia"), false);
    assert.equal(launchDoctor.shardProgress?.progressSource, "checked-in-progress-intake");
    assert.match(launchDoctor.shardProgress?.progressIntakePath ?? "", /answer-quality-local-full-shard-intake-after-shard-002-recovery-20260526\.json$/);
    assert.equal(launchDoctor.shardProgress?.progressInputCount, 2);
    assert.deepEqual(launchDoctor.shardProgress?.progressInputFiles, [
      "answer-quality-local-full-shard-001-20260526.json",
      "answer-quality-local-full-shard-002-recovery-20260526.json",
    ]);
    assert.equal(launchDoctor.shardProgress?.acceptedShardCount, 2);
    assert.equal(launchDoctor.shardProgress?.pendingShardCount, 18);
    assert.equal(launchDoctor.shardProgress?.firstPendingShardId, "shard-003");
    assert.equal(launchDoctor.shardProgress?.firstPendingShardRange, "50-75");
    assert.ok(launchDoctor.operatorInputsNeeded?.some((item) => item.id === "query-expansion-evidence"));
    assert.ok(launchDoctor.operatorInputsNeeded?.some((item) => item.id === "local-apple-readiness"));
    assert.ok(launchDoctor.operatorInputsNeeded?.some((item) => item.id === "local-rerank-readiness"));
    assert.equal(launchDoctor.operatorInputsNeeded?.some((item) => item.id === "provider-response-arms"), false);
    assert.ok(launchDoctor.blockers?.includes("query-expansion-local-endpoint-or-cloud-consent-missing"));
    assert.ok(launchDoctor.blockers?.includes("local-apple-credentials-missing"));
    assert.ok(launchDoctor.blockers?.includes("local-rerank-credentials-missing"));
    assert.equal(launchDoctor.blockers?.includes("voyage-credentials-missing"), false);
    assert.equal(launchDoctor.blockers?.includes("nvidia-credentials-missing"), false);
    assert.equal(launchDoctor.blockers?.includes("full-memory-sota-score-not-proven"), false);
    assert.equal(launchDoctor.blockers?.includes("public-sota-claim-not-allowed"), false);
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("SELFMEM_LOCAL_EMBED_BASE_URL"));
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("SELFMEM_LOCAL_EMBED_MAX_TOKENS"));
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("SELFMEM_LOCAL_DENSE_CANDIDATE_LIMIT"));
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("SELFMEM_LOCAL_RERANK_BASE_URL"));
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("--require-local-embedding-durability"));
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("SELFMEM_QUERY_EXPANSION_BASE_URL"));
    assert.ok(launchDoctor.nextCommands?.responseArmExport?.includes("--query-offset 50"));
    assert.doesNotMatch(launchDoctor.nextCommands?.responseArmExport ?? "", /RECALLWEAVE_PROVIDER_BENCHMARK_CALLS/);
    assert.ok(launchDoctor.nextCommands?.answerQuality?.includes("answer-quality-local-full-shard-003.json"));
    assert.ok(launchDoctor.nextCommands?.answerQuality?.includes("--query-offset 50"));
  }
  assert.match(localAcceptedLaneLaunchDoctorMarkdownFresh, /Local-Full Accepted Lane Launch Doctor/);
  assert.match(localAcceptedLaneLaunchDoctorMarkdownFresh, /Claim scope: local-full/);
  assert.match(localAcceptedLaneLaunchDoctorMarkdownEvidence, /Ready for local-full benchmark result: false/);
  assert.equal(fullShardBm25ExportProbe.mode, "full-shard-bm25-control-export-probe");
  assert.equal(fullShardBm25ExportProbe.status, "READY_FULL_SHARD_BM25_CONTROL_EXPORT_PROBE");
  assert.equal(fullShardBm25ExportProbe.strategy, "bm25-lite");
  assert.equal(fullShardBm25ExportProbe.target?.shardId, "shard-001");
  assert.equal(fullShardBm25ExportProbe.target?.startIndex, 0);
  assert.equal(fullShardBm25ExportProbe.target?.endIndexExclusive, 25);
  assert.equal(fullShardBm25ExportProbe.target?.responseCount, 25);
  assert.equal(fullShardBm25ExportProbe.inputStats?.candidates, 19195);
  assert.equal(fullShardBm25ExportProbe.featureProfile?.tokens, true);
  assert.equal(fullShardBm25ExportProbe.featureProfile?.tokenSet, true);
  assert.equal(fullShardBm25ExportProbe.featureProfile?.semanticVector, false);
  assert.equal(fullShardBm25ExportProbe.featureProfile?.topicTermSet, false);
  assert.equal(fullShardBm25ExportProbe.featureProfile?.dateMs, false);
  assert.equal(fullShardBm25ExportProbe.privateResponseFileCommitted, false);
  assert.equal(fullShardBm25ExportProbe.countsAsFullMemorySotaEvidence, false);
  assert.equal(fullShardBm25ExportProbe.publicBenchmarkClaimsAllowed, false);
  assert.equal(fullShardBm25ExportProbe.safety?.privacyLeakCount, 0);
  assert.equal(fullShardBm25ExportProbe.safety?.redactionFailureCount, 0);
  assert.ok(Number(fullShardBm25ExportProbe.timingMs?.observedWallSeconds ?? 0) > 0);
  assert.ok(Number(fullShardBm25ExportProbe.timingMs?.average ?? 0) > 0);
  assert.match(fullShardBm25ExportProbeEvidence, /Full-Shard BM25 Control Export Probe/);
  assert.match(fullShardBm25ExportProbeEvidence, /Private response file committed: false/);
  assert.equal(fullShardControlExportProbe.mode, "full-shard-control-export-probe");
  assert.equal(fullShardControlExportProbe.status, "READY_FULL_SHARD_CONTROL_EXPORT_PROBE");
  assert.equal(fullShardControlExportProbe.ok, true);
  assert.equal(fullShardControlExportProbe.publicSafe, true);
  assert.equal(fullShardControlExportProbe.metricsOnly, true);
  assert.equal(fullShardControlExportProbe.callsProviderApis, false);
  assert.equal(fullShardControlExportProbe.sendsBenchmarkTextToProvider, false);
  assert.equal(fullShardControlExportProbe.privateResponseFileCommitted, false);
  assert.equal(fullShardControlExportProbe.countsAsFullMemorySotaEvidence, false);
  assert.equal(fullShardControlExportProbe.publicBenchmarkClaimsAllowed, false);
  assert.equal(fullShardControlExportProbe.target?.shardId, "shard-001");
  assert.equal(fullShardControlExportProbe.target?.queryCount, 500);
  assert.equal(fullShardControlExportProbe.target?.startIndex, 0);
  assert.equal(fullShardControlExportProbe.target?.endIndexExclusive, 25);
  assert.equal(fullShardControlExportProbe.target?.responseCount, 25);
  assert.deepEqual(
    (fullShardControlExportProbe.arms ?? []).map((arm) => arm.strategy),
    ["bm25-lite", "full-hybrid-rerank", "query-expanded-full-hybrid-rerank"],
  );
  const fullShardControlArms = new Map((fullShardControlExportProbe.arms ?? []).map((arm) => [arm.strategy, arm]));
  for (const strategy of ["bm25-lite", "full-hybrid-rerank", "query-expanded-full-hybrid-rerank"]) {
    const arm = fullShardControlArms.get(strategy);
    assert.ok(arm, `missing full shard control arm ${strategy}`);
    assert.equal(arm.responseCount, 25);
    assert.equal(arm.queryShard?.startIndex, 0);
    assert.equal(arm.queryShard?.endIndexExclusive, 25);
    assert.equal(arm.queryShard?.totalQueryCount, 500);
    assert.equal(arm.inputStats?.candidates, 19195);
    assert.equal(arm.inputStats?.linesRead, 19195);
    assert.equal(arm.inputStats?.parsed, 19195);
    assert.equal(arm.providerCallsMade, 0);
    assert.equal(arm.providerMockCalls, 0);
    assert.equal(arm.privacyLeakCount, 0);
    assert.equal(arm.redactionFailureCount, 0);
    assert.equal(arm.privateResponseFileOutsideRepo, true);
    assert.equal(arm.privateResponseFileMode0600, true);
    assert.match(arm.privateResponseFileHash ?? "", /^sha256:[a-f0-9]{64}$/);
  }
  assert.equal(fullShardControlArms.get("bm25-lite")?.featureProfile?.semanticVector, false);
  assert.equal(fullShardControlArms.get("bm25-lite")?.featureProfile?.topicTermSet, false);
  assert.equal(fullShardControlArms.get("bm25-lite")?.featureProfile?.dateMs, false);
  assert.equal(fullShardControlArms.get("full-hybrid-rerank")?.featureProfile?.semanticVector, true);
  assert.equal(fullShardControlArms.get("full-hybrid-rerank")?.featureProfile?.topicTermSet, true);
  assert.equal(fullShardControlArms.get("full-hybrid-rerank")?.featureProfile?.dateMs, true);
  assert.equal(fullShardControlArms.get("query-expanded-full-hybrid-rerank")?.featureProfile?.semanticVector, true);
  assert.equal(fullShardControlArms.get("query-expanded-full-hybrid-rerank")?.featureProfile?.topicTermSet, true);
  assert.equal(fullShardControlArms.get("query-expanded-full-hybrid-rerank")?.featureProfile?.dateMs, true);
  assert.equal(fullShardControlArms.get("query-expanded-full-hybrid-rerank")?.queryExpansionCalls, 0);
  assert.equal(fullShardControlArms.get("query-expanded-full-hybrid-rerank")?.queryExpansionFallbacks, 25);
  assert.equal(fullShardControlExportProbe.controls?.queryExpansionMode, "deterministic-proxy");
  assert.equal(fullShardControlExportProbe.controls?.localModelEvidence, false);
  assert.equal(fullShardControlExportProbe.controls?.answerQualityEvidence, false);
  assert.equal(fullShardControlExportProbe.aggregate?.allResponseCountsMatch, true);
  assert.equal(fullShardControlExportProbe.aggregate?.allProviderCallsZero, true);
  assert.equal(fullShardControlExportProbe.aggregate?.allPrivateFilesOutsideRepo, true);
  assert.equal(fullShardControlExportProbe.aggregate?.allPrivateFilesMode0600, true);
  assert.equal(fullShardControlExportProbe.aggregate?.allPrivacyClean, true);
  assert.equal(fullShardControlExportProbe.safety?.privacyLeakCount, 0);
  assert.equal(fullShardControlExportProbe.safety?.redactionFailureCount, 0);
  assert.match(fullShardControlExportProbeEvidence, /Full-Shard Control Export Probe/);
  assert.match(fullShardControlExportProbeEvidence, /Counts as full memory SOTA evidence: false/);
  assert.match(fullShardControlExportProbeEvidence, /All provider calls zero: true/);
  assert.equal(fullShardControlAnswerQualityPreflight.mode, "public-benchmark-answer-quality-preflight");
  assert.equal(fullShardControlAnswerQualityPreflight.status, "BLOCKED_ANSWER_QUALITY_ENV");
  assert.equal(fullShardControlAnswerQualityPreflight.publicSafe, true);
  assert.equal(fullShardControlAnswerQualityPreflight.metricsOnly, true);
  assert.equal(fullShardControlAnswerQualityPreflight.callsProviderApis, false);
  assert.equal(fullShardControlAnswerQualityPreflight.sendsBenchmarkTextToProvider, false);
  assert.equal(fullShardControlAnswerQualityPreflight.target?.benchmark, "longmemeval");
  assert.equal(fullShardControlAnswerQualityPreflight.target?.answerModel, "gpt-4o");
  assert.equal(fullShardControlAnswerQualityPreflight.target?.judgeModel, "gpt-4o");
  assert.equal(fullShardControlAnswerQualityPreflight.privateInputs?.querySet?.present, true);
  assert.equal(fullShardControlAnswerQualityPreflight.privateInputs?.querySet?.matchesTarget, true);
  assert.equal(fullShardControlAnswerQualityPreflight.privateInputs?.memories?.present, true);
  assert.equal(fullShardControlAnswerQualityPreflight.privateInputs?.answerLabels?.present, true);
  assert.equal(fullShardControlAnswerQualityPreflight.privateInputs?.answerLabels?.matchesTarget, true);
  assert.equal(fullShardControlAnswerQualityPreflight.queryShard?.startIndex, 0);
  assert.equal(fullShardControlAnswerQualityPreflight.queryShard?.endIndexExclusive, 25);
  assert.equal(fullShardControlAnswerQualityPreflight.queryShard?.totalQueryCount, 500);
  assert.equal(fullShardControlAnswerQualityPreflight.queryShard?.selectedQueryCount, 25);
  assert.equal(fullShardControlAnswerQualityPreflight.readiness?.privateInputsReady, true);
  assert.equal(fullShardControlAnswerQualityPreflight.readiness?.armsReady, true);
  assert.equal(fullShardControlAnswerQualityPreflight.readiness?.responseArmsCoverSelectedShard, true);
  assert.equal(fullShardControlAnswerQualityPreflight.readiness?.sameDataReady, true);
  assert.equal(fullShardControlAnswerQualityPreflight.readiness?.liveAnswerQualityCanRun, false);
  assert.equal(fullShardControlAnswerQualityPreflight.readiness?.readyForEndToEndMemoryScoreGate, false);
  assert.equal(fullShardControlAnswerQualityPreflight.readiness?.countsAsFullMemorySotaEvidence, false);
  assert.equal(fullShardControlAnswerQualityPreflight.requiredStrategyCoverage?.hasBm25Lite, true);
  assert.equal(fullShardControlAnswerQualityPreflight.requiredStrategyCoverage?.hasFullHybridRerank, true);
  assert.equal(fullShardControlAnswerQualityPreflight.requiredStrategyCoverage?.hasChallenger, true);
  assert.deepEqual(
    (fullShardControlAnswerQualityPreflight.arms ?? []).map((arm) => arm.strategy),
    ["bm25-lite", "full-hybrid-rerank", "query-expanded-full-hybrid-rerank"],
  );
  for (const arm of fullShardControlAnswerQualityPreflight.arms ?? []) {
    assert.equal(arm.responseCount, 25);
    assert.equal(arm.querySetMatches, true);
    assert.equal(arm.selectedShardCoverage?.ready, true);
    assert.equal(arm.selectedShardCoverage?.selectedQueryIdHashMatches, true);
    assert.equal(arm.selectedShardCoverage?.missingSelectedCount, 0);
    assert.equal(arm.selectedShardCoverage?.extraResponseCount, 0);
    assert.equal(arm.selectedShardCoverage?.responseStartIndex, 0);
    assert.equal(arm.selectedShardCoverage?.responseEndIndexExclusive, 25);
    assert.match(arm.selectedShardCoverage?.responseSelectedQueryIdHash ?? "", /^sha256:[a-f0-9]{64}$/);
    assert.equal(arm.selectedShardCoverage?.responseSelectedQueryIdHash, arm.selectedShardCoverage?.expectedSelectedQueryIdHash);
  }
  for (const blocker of [
    "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled",
    "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed",
    "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed",
    "answer-model-missing",
    "judge-model-missing",
    "openai-compatible-base-url-missing",
  ]) {
    assert.ok(fullShardControlAnswerQualityPreflight.blockers?.includes(blocker), `missing control preflight blocker ${blocker}`);
  }
  assert.match(fullShardControlAnswerQualityPreflightEvidence, /Answer-Quality Benchmark Preflight/);
  assert.match(fullShardControlAnswerQualityPreflightEvidence, /Same-data hashes ready: true/);
  assert.match(fullShardControlAnswerQualityPreflightEvidence, /Live answer-quality can run: false/);
  for (const shardWorkorder of [answerQualityShardWorkorderFresh, fullAnswerQualityShardWorkorder]) {
    assert.equal(shardWorkorder.mode, "public-benchmark-answer-quality-shard-workorder");
    assert.equal(shardWorkorder.status, "PENDING_FULL_ANSWER_QUALITY_SHARD_RUNS");
    assert.equal(shardWorkorder.publicSafe, true);
    assert.equal(shardWorkorder.metricsOnly, true);
    assert.equal(shardWorkorder.publicBenchmarkClaimsAllowed, false);
    assert.equal(shardWorkorder.readyForShardIntake, false);
    assert.equal(shardWorkorder.readyForShardCombine, false);
    assert.equal(shardWorkorder.readyForEndToEndMemoryScoreGate, false);
    assert.equal(shardWorkorder.countsAsFullMemorySotaEvidence, false);
    assert.equal(shardWorkorder.rawQuestionIdsIncluded, false);
    assert.equal(shardWorkorder.rawQuestionsIncluded, false);
    assert.equal(shardWorkorder.rawAnswersIncluded, false);
    assert.equal(shardWorkorder.rawMemoryIncluded, false);
    assert.equal(shardWorkorder.rawTranscriptIncluded, false);
    assert.equal(shardWorkorder.rawPrivateOutputPathIncluded, false);
    assert.equal(shardWorkorder.plan?.shardCount, 20);
    assert.equal(shardWorkorder.progress?.inputCount, 0);
    assert.equal(shardWorkorder.progress?.acceptedShardCount, 0);
    assert.equal(shardWorkorder.progress?.pendingShardCount, 20);
    assert.equal(shardWorkorder.progress?.rejectedResultCount, 0);
    assert.equal(shardWorkorder.progress?.duplicateResultCount, 0);
    assert.equal(shardWorkorder.progress?.workorderCount, 20);
    assert.equal(shardWorkorder.executionLanes?.length >= 5, true);
    assert.ok(shardWorkorder.executionLanes?.some((lane) => lane.id === "local-apple-no-spend" && lane.acceptedByFullShardIntake === false));
    assert.ok(shardWorkorder.executionLanes?.some((lane) => lane.id === "full-sota-accepted-shards" && lane.acceptedByFullShardIntake === true));
    assert.equal(shardWorkorder.executionLaneReadiness?.length >= 5, true);
    const laneReadiness = new Map(shardWorkorder.executionLaneReadiness?.map((lane) => [lane.laneId, lane]));
    const deterministicReadiness = laneReadiness.get("deterministic-control-proxy");
    const localAppleReadiness = laneReadiness.get("local-apple-no-spend");
    const voyageReadiness = laneReadiness.get("voyage-minimum-challenger");
    const nvidiaReadiness = laneReadiness.get("nvidia-minimum-challenger");
    const fullSotaReadiness = laneReadiness.get("full-sota-accepted-shards");
    assert.equal(deterministicReadiness?.diagnosticOnly, true);
    assert.equal(deterministicReadiness?.queryExpansion?.evidenceRequirement, "deterministic-fallback-only");
    assert.equal(deterministicReadiness?.queryExpansion?.readyForResponseArmExport, true);
    assert.equal(deterministicReadiness?.queryExpansion?.diagnosticFallbackAllowed, true);
    assert.equal(deterministicReadiness?.queryExpansion?.countsAsFullSotaQueryExpansionEvidence, false);
    assert.deepEqual(deterministicReadiness?.queryExpansion?.blockers, []);
    assert.equal(localAppleReadiness?.providerReadiness?.["local-apple"]?.ready, false);
    assert.equal(localAppleReadiness?.providerReadiness?.["local-rerank"]?.ready, false);
    assert.equal(localAppleReadiness?.queryExpansion?.evidenceRequirement, "local-model-or-deterministic-diagnostic");
    assert.equal(localAppleReadiness?.queryExpansion?.readyForResponseArmExport, true);
    assert.equal(localAppleReadiness?.queryExpansion?.countsAsFullSotaQueryExpansionEvidence, false);
    assert.equal(voyageReadiness?.providerReadiness?.voyage?.ready, false);
    assert.equal(nvidiaReadiness?.providerReadiness?.nvidia?.ready, false);
    assert.equal(fullSotaReadiness?.acceptedByFullShardIntake, true);
    assert.equal(fullSotaReadiness?.queryExpansion?.evidenceRequirement, "local-or-cloud-model-required");
    assert.equal(fullSotaReadiness?.queryExpansion?.readyForResponseArmExport, false);
    assert.equal(fullSotaReadiness?.queryExpansion?.readyForAcceptedShardIntake, false);
    assert.ok(fullSotaReadiness?.queryExpansion?.blockers?.includes("query-expansion-local-endpoint-or-cloud-consent-missing"));
    assert.equal(fullSotaReadiness?.readyForResponseArmExport, false);
    assert.equal(fullSotaReadiness?.readyForAnswerQualityScoring, false);
    assert.equal(fullSotaReadiness?.readyForAcceptedShardIntakeCandidate, false);
    assert.equal(fullSotaReadiness?.countsAsFullMemorySotaEvidence, false);
    assert.equal(shardWorkorder.fullSotaLaneReadyForResponseArmExport, false);
    assert.equal(shardWorkorder.fullSotaLaneReadyForAnswerQualityScoring, false);
    for (const blocker of [
      "RECALLWEAVE_BASELINE_LIVE-not-enabled",
      "RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed",
      "RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled",
      "RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed",
      "RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed",
      "RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled",
      "RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed",
      "local-apple-credentials-missing",
      "local-rerank-credentials-missing",
      "nvidia-credentials-missing",
      "voyage-credentials-missing",
      "query-expansion-local-endpoint-or-cloud-consent-missing",
      "answer-model-missing",
      "judge-model-missing",
      "openai-compatible-base-url-missing",
    ]) {
      assert.ok(shardWorkorder.fullSotaLaneEnvironmentBlockers?.includes(blocker), `missing full SOTA lane blocker ${blocker}`);
    }
    assert.ok(shardWorkorder.blockers?.includes("answer-quality-shard-runs-pending"));
    assert.match(shardWorkorder.gatedCommands?.shardIntake ?? "", /--require-ready/);
    assert.match(shardWorkorder.gatedCommands?.combineAfterIntakePasses ?? "", /--combine-mode shards/);
    assert.match(shardWorkorder.gatedCommands?.resultGateAfterCombine ?? "", /benchmark:memory-score:result-gate/);
    assert.match(shardWorkorder.gatedCommands?.reviewerIntakeAfterCombine ?? "", /benchmark:memory-score:reviewer-intake/);
  }
  assert.equal(localFullAnswerQualityShardWorkorder.mode, "public-benchmark-answer-quality-shard-workorder");
  assert.equal(localFullAnswerQualityShardWorkorder.status, "PENDING_FULL_ANSWER_QUALITY_SHARD_RUNS");
  assert.equal(localFullShardWorkorderFresh.mode, "public-benchmark-answer-quality-shard-workorder");
  assert.equal(localFullShardWorkorderFresh.status, "PENDING_FULL_ANSWER_QUALITY_SHARD_RUNS");
  assert.equal(localFullShardWorkorderFresh.plan?.claimScope, "local-full");
  assert.equal(localFullAnswerQualityShardWorkorder.plan?.claimScope, "local-full");
  for (const workorder of [localFullAnswerQualityShardWorkorder, localFullShardWorkorderFresh]) {
    assert.equal(workorder.progress?.inputCount, 2);
    assert.equal(workorder.progress?.acceptedShardCount, 2);
    assert.equal(workorder.progress?.pendingShardCount, 18);
    assert.equal(workorder.progress?.workorderCount, 18);
    assert.equal(workorder.workorders?.[0]?.shardId, "shard-003");
    assert.equal(workorder.runtimeBlockers?.inputCount, 1);
    assert.equal(workorder.runtimeBlockers?.matchedCount, 1);
    assert.equal(workorder.runtimeBlockers?.rejectedCount, 0);
    assert.equal(workorder.runtimeBlockers?.resumeAvailableCount, 1);
    assert.equal(workorder.workorders?.[0]?.runtimeResume?.resumeAvailable, true);
    assert.deepEqual(workorder.workorders?.[0]?.runtimeResume?.completedStrategies, [
      "bm25-lite",
      "full-hybrid-rerank",
      "query-expanded-full-hybrid-rerank",
      "local-apple-qwen3-0_6b",
    ]);
    assert.deepEqual(workorder.workorders?.[0]?.runtimeResume?.missingStrategies, [
      "local-apple-qwen3-0_6b-local-rerank",
    ]);
    assert.match(workorder.workorders?.[0]?.commands?.missingArmResponseExport ?? "", /--strategies local-apple-qwen3-0_6b-local-rerank/);
    assert.match(workorder.workorders?.[0]?.commands?.missingArmResponseExport ?? "", /--query-offset 50/);
    assert.match(workorder.workorders?.[0]?.commands?.preflight ?? "", /benchmark:answer-quality:preflight/);
  }
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneReadiness?.laneId, "local-full-accepted-shards");
  assert.equal(localFullAnswerQualityShardWorkorder.fullSotaLaneReadiness, null);
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneReadyForResponseArmExport, false);
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneReadyForAnswerQualityScoring, false);
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneReadiness?.answerQuality?.modelMatchPolicy, "local-diagnostic-allowed");
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneReadiness?.answerQuality?.scoringModelPolicySatisfied, false);
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneReadiness?.canReachFullSotaGateAfterShardIntake, false);
  assert.ok(localFullAnswerQualityShardWorkorder.acceptedLaneEnvironmentBlockers?.includes("local-apple-credentials-missing"));
  assert.ok(localFullAnswerQualityShardWorkorder.acceptedLaneEnvironmentBlockers?.includes("local-rerank-credentials-missing"));
  assert.ok(localFullAnswerQualityShardWorkorder.acceptedLaneEnvironmentBlockers?.includes("query-expansion-local-endpoint-or-cloud-consent-missing"));
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneEnvironmentBlockers?.includes("voyage-credentials-missing"), false);
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneEnvironmentBlockers?.includes("nvidia-credentials-missing"), false);
  assert.equal(localFullAnswerQualityShardWorkorder.acceptedLaneEnvironmentBlockers?.includes("RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled"), false);
  assert.match(localFullAnswerQualityShardWorkorder.gatedCommands?.shardIntake ?? "", /benchmark:answer-quality:local-shard-intake/);
  assert.match(localFullAnswerQualityShardWorkorder.gatedCommands?.shardIntake ?? "", /answer-quality-local-full-shard-intake/);
  assert.match(localFullAnswerQualityShardWorkorder.gatedCommands?.combineAfterIntakePasses ?? "", /end-to-end-memory-score-local-full-combined/);
  assert.match(localFullAnswerQualityShardWorkorderEvidence, /local-full-accepted-shards/);
  assert.match(localFullAnswerQualityShardWorkorderEvidence, /query-expansion=local-or-cloud-model-required/);
  assert.match(localFullAnswerQualityShardWorkorderEvidence, /scoring-policy=local-diagnostic-allowed/);
  assert.match(localFullAnswerQualityShardWorkorderEvidence, /Runtime resume plans: 1/);
  assert.match(localFullAnswerQualityShardWorkorderEvidence, /missing=local-apple-qwen3-0_6b-local-rerank/);
  const assertResumePacketCommon = (resumePacket) => {
    assert.equal(resumePacket.mode, "local-full-shard-resume-packet");
    assert.equal(resumePacket.status, "READY_FOR_LOCAL_FULL_SHARD_RESUME");
    assert.equal(resumePacket.metricsOnly, true);
    assert.equal(resumePacket.publicSafe, true);
    assert.equal(resumePacket.callsProviderApis, false);
    assert.equal(resumePacket.callsHostedSupermemory, false);
    assert.equal(resumePacket.sendsBenchmarkTextToProvider, false);
    assert.equal(resumePacket.rawQuestionsIncluded, false);
    assert.equal(resumePacket.rawAnswersIncluded, false);
    assert.equal(resumePacket.rawMemoryIncluded, false);
    assert.equal(resumePacket.rawTranscriptIncluded, false);
    assert.equal(resumePacket.rawPromptIncluded, false);
    assert.equal(resumePacket.rawPrivateOutputPathIncluded, false);
    assert.equal(resumePacket.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(resumePacket.countsAsFullMemorySotaEvidence, false);
    assert.equal(resumePacket.readyForShardIntake, false);
    assert.equal(resumePacket.readyForShardCombine, false);
    assert.equal(resumePacket.publicBenchmarkClaimsAllowed, false);
    assert.equal(resumePacket.progress?.runtimeBlockerResumeAvailableCount, 1);
    assert.equal(resumePacket.targetShard?.maxQueries, 25);
    assert.equal(resumePacket.localRuntime?.runtimeReady, true);
    assert.equal(resumePacket.localRuntime?.durabilityReady, true);
    assert.deepEqual(resumePacket.localRuntime?.blockers, []);
    assert.deepEqual(resumePacket.blockers, []);
    assert.match(resumePacket.commands?.missingArmResponseExport ?? "", /--require-local-embedding-durability/);
    assert.match(resumePacket.commands?.resumeEnvDoctor ?? "", /benchmark:answer-quality:local-shard-resume-env/);
    assert.match(resumePacket.commands?.resumeCommandMaterializer ?? "", /benchmark:answer-quality:local-shard-resume-command/);
    assert.match(resumePacket.commands?.resumeCommandMaterializer ?? "", /--private-command-output/);
    assert.match(resumePacket.commands?.resumeResultDoctor ?? "", /benchmark:answer-quality:local-shard-resume-result/);
    assert.match(resumePacket.commands?.preflight ?? "", /benchmark:answer-quality:preflight/);
    assert.match(resumePacket.commands?.answerQuality ?? "", /benchmark:answer-quality/);
    assert.match(resumePacket.commands?.localShardIntake ?? "", /benchmark:answer-quality:local-shard-intake/);
  };
  for (const resumePacket of [localFullShardResumePacket, localFullShardResumePacketFresh]) {
    assertResumePacketCommon(resumePacket);
  }
  assert.equal(localFullShardResumePacket.progress?.acceptedShardCount, 1);
  assert.equal(localFullShardResumePacket.progress?.pendingShardCount, 19);
  assert.equal(localFullShardResumePacket.targetShard?.shardId, "shard-002");
  assert.equal(localFullShardResumePacket.targetShard?.startIndex, 25);
  assert.equal(localFullShardResumePacket.targetShard?.endIndexExclusive, 50);
  assert.equal(localFullShardResumePacket.targetShard?.queryOffset, 25);
  assert.deepEqual(localFullShardResumePacket.resumeState?.completedStrategies, [
    "bm25-lite",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
  ]);
  assert.deepEqual(localFullShardResumePacket.resumeState?.missingStrategies, [
    "local-apple-qwen3-0_6b",
    "local-apple-qwen3-0_6b-local-rerank",
  ]);
  assert.equal(localFullShardResumePacket.resumeState?.completedArmCount, 3);
  assert.equal(localFullShardResumePacket.resumeState?.missingArmCount, 2);
  assert.equal(localFullShardResumePacket.resumeState?.previousFailureClass, "local-embedding-server-socket-close");
  assert.equal(localFullShardResumePacket.resumeState?.publicSyntheticReproduced, true);
  assert.match(localFullShardResumePacket.commands?.missingArmResponseExport ?? "", /--strategies local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank/);
  assert.match(localFullShardResumePacket.commands?.missingArmResponseExport ?? "", /--query-offset 25/);
  assert.match(localFullShardResumePacket.commands?.resumeEnvDoctor ?? "", /local-full-shard-002-resume-env-doctor-20260526\.json/);
  assert.match(localFullShardResumePacket.commands?.resumeCommandMaterializer ?? "", /local-full-shard-002-resume-command-materializer-20260526\.json/);
  assert.match(localFullShardResumePacket.commands?.resumeResultDoctor ?? "", /local-full-shard-002-resume-result-doctor-20260526\.json/);
  assert.equal(localFullShardResumePacketFresh.progress?.acceptedShardCount, 2);
  assert.equal(localFullShardResumePacketFresh.progress?.pendingShardCount, 18);
  assert.equal(localFullShardResumePacketFresh.targetShard?.shardId, "shard-003");
  assert.equal(localFullShardResumePacketFresh.targetShard?.startIndex, 50);
  assert.equal(localFullShardResumePacketFresh.targetShard?.endIndexExclusive, 75);
  assert.equal(localFullShardResumePacketFresh.targetShard?.queryOffset, 50);
  assert.deepEqual(localFullShardResumePacketFresh.resumeState?.completedStrategies, [
    "bm25-lite",
    "full-hybrid-rerank",
    "query-expanded-full-hybrid-rerank",
    "local-apple-qwen3-0_6b",
  ]);
  assert.deepEqual(localFullShardResumePacketFresh.resumeState?.missingStrategies, [
    "local-apple-qwen3-0_6b-local-rerank",
  ]);
  assert.equal(localFullShardResumePacketFresh.resumeState?.completedArmCount, 4);
  assert.equal(localFullShardResumePacketFresh.resumeState?.missingArmCount, 1);
  assert.equal(localFullShardResumePacketFresh.resumeState?.previousFailureClass, "local-rerank-response-body-stall");
  assert.equal(localFullShardResumePacketFresh.resumeState?.publicSyntheticReproduced, false);
  assert.match(localFullShardResumePacketFresh.commands?.missingArmResponseExport ?? "", /--strategies local-apple-qwen3-0_6b-local-rerank/);
  assert.match(localFullShardResumePacketFresh.commands?.missingArmResponseExport ?? "", /--query-offset 50/);
  assert.match(localFullShardResumePacketFresh.commands?.resumeEnvDoctor ?? "", /local-full-shard-003-resume-env-doctor-20260526\.json/);
  assert.match(localFullShardResumePacketFresh.commands?.resumeCommandMaterializer ?? "", /local-full-shard-003-resume-command-materializer-20260526\.json/);
  assert.match(localFullShardResumePacketFresh.commands?.resumeResultDoctor ?? "", /local-full-shard-003-resume-result-doctor-20260526\.json/);
  assert.match(localFullShardResumePacketFresh.commands?.localShardIntake ?? "", /answer-quality-local-full-shard-003\.json/);
  assert.equal(localFullShardResumePacketFresh.safety?.supermemorySearchPolicy, "disabled-for-benchmark-methodology");
  assert.deepEqual(localFullShardResumePacketFresh.safety?.supermemorySearchDisabledEnv, [
    "RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1",
    "SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1",
  ]);
  for (const command of [
    localFullShardResumePacketFresh.commands?.resumeEnvDoctor,
    localFullShardResumePacketFresh.commands?.missingArmResponseExport,
    localFullShardResumePacketFresh.commands?.preflight,
    localFullShardResumePacketFresh.commands?.answerQuality,
    localFullShardResumePacketFresh.commands?.localShardIntake,
  ]) {
    assert.match(command ?? "", /RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1/);
    assert.match(command ?? "", /SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1/);
  }
  assert.equal(localFullShardResumePacket.writesRealFiles, true);
  assert.equal(localFullShardResumePacketFresh.writesRealFiles, false);
  assert.match(localFullShardResumePacketEvidence, /Local-Full Shard Resume Packet/);
  assert.match(localFullShardResumePacketEvidence, /Status: READY_FOR_LOCAL_FULL_SHARD_RESUME/);
  assert.match(localFullShardResumePacketEvidence, /Missing arms: local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank/);
  assert.match(localFullShardResumePacketEvidence, /Resume command materializer: .*benchmark:answer-quality:local-shard-resume-command/);
  assert.match(localFullShardResumePacketEvidence, /Resume result doctor: .*benchmark:answer-quality:local-shard-resume-result/);
  assert.match(localFullShardResumePacketEvidence, /Counts as local-full benchmark evidence: false/);
  assert.match(localFullShardResumePacketEvidence, /Run the local-full shard resume command materializer to write a private shell script outside the repository/);
  assert.match(localFullShardResumePacketEvidence, /Run the local-full shard resume result doctor before accepting shard 002/);
  assert.match(localFullShardResumePacketEvidence, /Do not combine, publish, or claim local-full benchmark evidence until all twenty local-full shards are accepted/);
  assert.match(localFullShardResumePacketMarkdownFresh, /Local embedding runtime ready: true/);
  assert.match(localFullShardResumePacketMarkdownFresh, /Raw memory included: false/);
  for (const text of [
    JSON.stringify(localFullShardResumePacket),
    JSON.stringify(localFullShardResumePacketFresh),
    localFullShardResumePacketEvidence,
    localFullShardResumePacketMarkdownFresh,
  ]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
  for (const envDoctor of [localFullShardResumeEnvDoctor, localFullShardResumeEnvDoctorFresh]) {
    assert.equal(envDoctor.mode, "local-full-shard-resume-env-doctor");
    assert.equal(envDoctor.fixtureOnly, false);
    assert.equal(envDoctor.status, "BLOCKED_LOCAL_FULL_SHARD_RESUME_ENV");
    assert.equal(envDoctor.metricsOnly, true);
    assert.equal(envDoctor.publicSafe, true);
    assert.equal(envDoctor.callsProviderApis, false);
    assert.equal(envDoctor.callsHostedSupermemory, false);
    assert.equal(envDoctor.sendsBenchmarkTextToProvider, false);
    assert.equal(envDoctor.rawQuestionsIncluded, false);
    assert.equal(envDoctor.rawAnswersIncluded, false);
    assert.equal(envDoctor.rawMemoryIncluded, false);
    assert.equal(envDoctor.rawPrivateOutputPathIncluded, false);
    assert.equal(envDoctor.printsEnvValues, false);
    assert.equal(envDoctor.printsPrivatePaths, false);
    assert.equal(envDoctor.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(envDoctor.countsAsFullMemorySotaEvidence, false);
    assert.equal(envDoctor.publicBenchmarkClaimsAllowed, false);
    assert.equal(envDoctor.readyForMissingArmExport, false);
    assert.equal(envDoctor.readyForAnswerQualityPreflight, false);
    assert.equal(envDoctor.readyForLocalShardIntake, false);
    assert.equal(envDoctor.readyForCommandMaterialization, false);
    assert.equal(envDoctor.resumePacketCommandsRunnableAsPrinted, false);
    assert.equal(envDoctor.privateDir?.pathPrinted, false);
    assert.equal(envDoctor.sourceRetention?.contractReady, true);
    assert.equal(envDoctor.sourceRetention?.rawSourcesRetainedPrivately, true);
    assert.equal(envDoctor.sourceRetention?.publicReportIsSafe, true);
    assert.equal(envDoctor.sourceRetention?.compressedDefaultRetrievalAllowed, true);
    assert.equal(envDoctor.sourceRetention?.uiMayUseCompressedDefaultButAuditRetainsRawSource, true);
    assert.equal(envDoctor.sourceRetention?.directoryInsideRepository, false);
    assert.deepEqual(envDoctor.sourceRetention?.requiredPrivateAuditRoles, [
      "raw-dataset",
      "selected-raw-rows",
      "source-manifest",
    ]);
    assert.deepEqual(envDoctor.sourceRetention?.missingMaterializeRoles, []);
    assert.equal(envDoctor.sourceRetention?.rawDatasetItemCount, 500);
    assert.equal(envDoctor.sourceRetention?.selectedRawRowsCount, 500);
    assert.equal(envDoctor.sourceRetention?.rawSourcePrivateFiles?.length, 3);
    assert.ok(envDoctor.sourceRetention?.rawSourcePrivateFiles?.every((file) => file.pathLabel === "external-private-file"));
    assert.equal(envDoctor.localEmbeddingDurability?.reportReady, true);
    assert.equal(envDoctor.localEmbeddingDurability?.longProbeReady, true);
    assert.equal(envDoctor.localEmbeddingDurability?.generatedAfterRuntimeBlocker, true);
    assert.equal(envDoctor.localEmbeddingDurability?.readyForLocalFullResume, true);
    assert.equal(envDoctor.localEmbeddingDurability?.minRequiredTokenCount, 700);
    assert.equal(envDoctor.localEmbeddingDurability?.maxProbeTokenCount, 700);
    assert.equal(envDoctor.localEmbeddingDurability?.probeCount, 4);
    assert.equal(envDoctor.localEmbeddingDurability?.passProbeCount, 4);
    assert.deepEqual(envDoctor.localEmbeddingDurability?.failedProbeClasses, []);
    assert.equal(envDoctor.localEmbeddingDurability?.rawSyntheticInputIncluded, false);
    assert.equal(envDoctor.localEmbeddingDurability?.baseUrlPrinted, false);
    assert.equal(envDoctor.localEmbeddingDurability?.endpointPrinted, false);
    assert.equal(envDoctor.localEmbeddingDurability?.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(envDoctor.localEmbeddingDurability?.countsAsFullMemorySotaEvidence, false);
    assert.equal(envDoctor.localEmbeddingDurability?.runtimeBlocker?.failureClass, "local-embedding-server-socket-close");
    assert.deepEqual(envDoctor.resumePacket?.missingStrategies, [
      "local-apple-qwen3-0_6b",
      "local-apple-qwen3-0_6b-local-rerank",
    ]);
    assert.ok(envDoctor.env?.localEmbedding?.missingNames?.includes("SELFMEM_LOCAL_EMBED_BASE_URL"));
    assert.ok(envDoctor.env?.localRerank?.missingNames?.includes("SELFMEM_LOCAL_RERANK_BASE_URL"));
    assert.ok(envDoctor.env?.answerQuality?.missingNames?.includes("RECALLWEAVE_MEMORYBENCH_BASE_URL"));
    assert.ok(envDoctor.blockers?.includes("local-embedding-env-missing"));
    assert.ok(envDoctor.blockers?.includes("local-rerank-env-missing"));
    assert.ok(envDoctor.blockers?.includes("local-safety-env-missing"));
    assert.ok(envDoctor.blockers?.includes("answer-quality-env-missing"));
    assert.equal(envDoctor.commandPlaceholders?.privateOutputDirPlaceholderPresent, true);
    assert.equal(envDoctor.commandPlaceholders?.publicReviewDirPlaceholderPresent, true);
    assert.equal(envDoctor.commandMaterialization?.templatePlaceholdersPresent, true);
    assert.equal(envDoctor.commandMaterialization?.commandsRunnableAsPrinted, false);
    assert.equal(envDoctor.commandMaterialization?.requiresOperatorPlaceholderSubstitution, true);
    assert.equal(envDoctor.commandMaterialization?.requiredPlaceholdersReady, false);
    assert.equal(envDoctor.commandMaterialization?.readyForCommandMaterialization, false);
    assert.equal(envDoctor.commandMaterialization?.printsMaterializedCommands, false);
    assert.equal(envDoctor.commandMaterialization?.printsPrivatePaths, false);
    assert.equal(envDoctor.commandMaterialization?.printsEnvValues, false);
    assert.ok(envDoctor.commandMaterialization?.unresolvedRequiredPlaceholderNames?.includes("local-embedding-base-url"));
    assert.ok(envDoctor.commandMaterialization?.unresolvedRequiredPlaceholderNames?.includes("openai-compatible-base-url"));
    assert.ok(envDoctor.commandMaterialization?.optionalPlaceholderNames?.includes("env-only-if-cloud-endpoint"));
  }
  assert.equal(localFullShardResumeEnvDoctor.privateDir?.provided, true);
  assert.equal(localFullShardResumeEnvDoctor.privateDir?.present, true);
  assert.equal(localFullShardResumeEnvDoctor.privateDir?.outsideRepository, true);
  assert.equal(localFullShardResumeEnvDoctor.sourceRetention?.readyForPrivateAudit, true);
  assert.ok(localFullShardResumeEnvDoctor.sourceRetention?.rawSourcePrivateFiles?.every((file) => file.present === true));
  assert.ok(localFullShardResumeEnvDoctor.sourceRetention?.rawSourcePrivateFiles?.every((file) => file.hashMatches === true));
  assert.equal(localFullShardResumeEnvDoctor.requiredInputFiles?.length, 3);
  assert.ok(localFullShardResumeEnvDoctor.requiredInputFiles?.every((file) => file.present === true && file.nonEmpty === true));
  assert.equal(localFullShardResumeEnvDoctor.privateInputFilesReady, true);
  assert.equal(localFullShardResumeEnvDoctor.completedPrivateArmFilesReady, true);
  assert.equal(localFullShardResumeEnvDoctor.readyForMissingArmExportExceptEnv, true);
  assert.equal(localFullShardResumeEnvDoctor.localResumeExecutionEnvReady, false);
  assert.equal(localFullShardResumeEnvDoctor.answerQualityEnvReady, false);
  assert.deepEqual(
    localFullShardResumeEnvDoctor.requiredInputFiles?.map((file) => [file.role, file.hashKind, file.hashMatches]),
    [
      ["queryset", "collector-compatible-queryset", true],
      ["memories", "file-sha256", null],
      ["answer-labels", "embedded-answer-labels", true],
    ],
  );
  assert.ok(localFullShardResumeEnvDoctor.requiredInputFiles?.every((file) => file.parseOk !== false));
  assert.ok(localFullShardResumeEnvDoctor.requiredInputFiles?.every((file) => file.contractPresent !== false));
  assert.equal(localFullShardResumeEnvDoctor.completedArmFiles?.length, 3);
  assert.ok(localFullShardResumeEnvDoctor.completedArmFiles?.every((file) => file.present === true && file.hashMatches === true));
  assert.ok(!localFullShardResumeEnvDoctor.blockers?.includes("private-dir-not-provided"));
  assert.ok(!localFullShardResumeEnvDoctor.blockers?.includes("required-private-input-file-hash-mismatch"));
  assert.ok(!localFullShardResumeEnvDoctor.blockers?.includes("completed-private-arm-files-missing"));
  assert.ok(!localFullShardResumeEnvDoctor.commandMaterialization?.unresolvedRequiredPlaceholderNames?.includes("private-output-dir"));
  assert.deepEqual(localFullShardResumeEnvDoctor.nextActions, [
    "Set the local embedding, local rerank, and safety environment variables for the two missing local Apple arms.",
    "Set local answer-quality endpoint and model environment variables before preflight/scoring.",
    "Regenerate this doctor before running the next resume packet command.",
  ]);
  assert.equal(localFullShardResumeEnvDoctorFresh.privateDir?.provided, false);
  assert.equal(localFullShardResumeEnvDoctorFresh.privateDir?.present, false);
  assert.equal(localFullShardResumeEnvDoctorFresh.sourceRetention?.readyForPrivateAudit, false);
  assert.ok(localFullShardResumeEnvDoctorFresh.sourceRetention?.rawSourcePrivateFiles?.every((file) => file.present === false));
  assert.ok(localFullShardResumeEnvDoctorFresh.blockers?.includes("private-dir-not-provided"));
  assert.ok(localFullShardResumeEnvDoctorFresh.commandMaterialization?.unresolvedRequiredPlaceholderNames?.includes("private-output-dir"));
  assert.ok(localFullShardResumeEnvDoctorFresh.nextActions?.includes(
    "Provide RECALLWEAVE_FULL_SHARD_PRIVATE_DIR or --private-input-dir for the outside-repository private materialization directory.",
  ));
  assert.equal(localFullShardResumeEnvDoctor.writesRealFiles, true);
  assert.equal(localFullShardResumeEnvDoctorFresh.writesRealFiles, false);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Local-Full Shard Resume Environment Doctor/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Status: BLOCKED_LOCAL_FULL_SHARD_RESUME_ENV/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Raw Source Retention/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Compressed default retrieval allowed: true/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Local Embedding Durability/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Generated after runtime blocker: true/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Ready for missing-arm export except env: true/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Private input files ready: true/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Completed private arm files ready: true/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Local resume execution env ready: false/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Ready for command materialization: false/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Resume packet commands runnable as printed: false/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /SELFMEM_LOCAL_EMBED_BASE_URL/);
  assert.match(localFullShardResumeEnvDoctorEvidence, /Set the local embedding, local rerank, and safety environment variables/);
  assert.match(localFullShardResumeEnvDoctorMarkdownFresh, /Private directory provided: false/);
  assert.match(localFullShardResumeEnvDoctorMarkdownFresh, /Local embedding durability long probe ready: true/);
  assert.equal(localFullShardResumeEnvDoctorTooShort.localEmbeddingDurability?.longProbeReady, false);
  assert.ok(localFullShardResumeEnvDoctorTooShort.blockers?.includes("local-embedding-durability-long-probe-not-ready"));
  assert.equal(localFullShardResumeEnvDoctorFixture.mode, "local-full-shard-resume-env-doctor");
  assert.equal(localFullShardResumeEnvDoctorFixture.fixtureOnly, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.status, "READY_LOCAL_FULL_SHARD_RESUME_ENV");
  assert.equal(localFullShardResumeEnvDoctorFixture.metricsOnly, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.publicSafe, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.callsProviderApis, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.callsHostedSupermemory, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.sendsBenchmarkTextToProvider, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.rawQuestionsIncluded, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.rawAnswersIncluded, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.rawMemoryIncluded, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.rawPrivateOutputPathIncluded, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.printsEnvValues, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.printsPrivatePaths, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.countsAsLocalFullBenchmarkEvidence, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.countsAsFullMemorySotaEvidence, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.publicBenchmarkClaimsAllowed, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.readyForMissingArmExport, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.readyForAnswerQualityPreflight, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.readyForLocalShardIntake, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.readyForCommandMaterialization, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.privateInputFilesReady, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.completedPrivateArmFilesReady, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.readyForMissingArmExportExceptEnv, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.localResumeExecutionEnvReady, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.answerQualityEnvReady, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.resumePacketCommandsRunnableAsPrinted, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.privateDir?.provided, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.privateDir?.present, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.privateDir?.outsideRepository, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.privateDir?.pathPrinted, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.sourceRetention?.readyForPrivateAudit, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.sourceRetention?.publicReportIsSafe, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.localEmbeddingDurability?.readyForLocalFullResume, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.env?.localEmbedding?.ready, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.env?.localRerank?.ready, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.env?.localSafety?.ready, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.env?.answerQuality?.ready, true);
  assert.ok(localFullShardResumeEnvDoctorFixture.requiredInputFiles?.every((file) => file.present && file.hashMatches === true));
  assert.ok(localFullShardResumeEnvDoctorFixture.completedArmFiles?.every((file) => file.present && file.hashMatches === true));
  assert.ok(localFullShardResumeEnvDoctorFixture.missingArmFiles?.every((file) => file.present && file.nonEmpty));
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.templatePlaceholdersPresent, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.commandsRunnableAsPrinted, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.requiresOperatorPlaceholderSubstitution, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.requiredPlaceholdersReady, true);
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.readyForCommandMaterialization, true);
  assert.deepEqual(localFullShardResumeEnvDoctorFixture.commandMaterialization?.unresolvedRequiredPlaceholderNames, []);
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.printsMaterializedCommands, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.printsPrivatePaths, false);
  assert.equal(localFullShardResumeEnvDoctorFixture.commandMaterialization?.printsEnvValues, false);
  assert.deepEqual(localFullShardResumeEnvDoctorFixture.blockers, []);
  assert.match(localFullShardResumeEnvDoctorFixtureMarkdown, /Status: READY_LOCAL_FULL_SHARD_RESUME_ENV/);
  assert.match(localFullShardResumeEnvDoctorFixtureMarkdown, /Fixture only: true/);
  assert.match(localFullShardResumeEnvDoctorFixtureMarkdown, /Ready for missing-arm export except env: true/);
  assert.match(localFullShardResumeEnvDoctorFixtureMarkdown, /Ready for answer-quality preflight: true/);
  assert.match(localFullShardResumeEnvDoctorFixtureMarkdown, /Ready for command materialization: true/);
  assert.match(localFullShardResumeEnvDoctorFixtureMarkdown, /Commands runnable as printed: false/);
  for (const text of [
    JSON.stringify(localFullShardResumeEnvDoctor),
    JSON.stringify(localFullShardResumeEnvDoctorFresh),
    JSON.stringify(localFullShardResumeEnvDoctorTooShort),
    JSON.stringify(localFullShardResumeEnvDoctorFixture),
    localFullShardResumeEnvDoctorEvidence,
    localFullShardResumeEnvDoctorMarkdownFresh,
    localFullShardResumeEnvDoctorFixtureMarkdown,
  ]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
  const expectedResumePrivateScriptCommandOrder = [
    "rerunRuntimeDoctor",
    "rerunDurabilitySmoke",
    "rerunLocalRerankDurabilitySmoke",
    "resumeEnvDoctor",
    "missingArmResponseExport",
    "preflight",
    "answerQuality",
    "localShardIntake",
    "fullSotaDoctor",
  ];
  for (const materializer of [
    localFullShardResumeCommandMaterializer,
    localFullShardResumeCommandMaterializerFresh,
  ]) {
    assert.equal(materializer.mode, "local-full-shard-resume-command-materializer");
    assert.equal(materializer.fixtureOnly, false);
    assert.equal(materializer.status, "BLOCKED_LOCAL_FULL_RESUME_PRIVATE_COMMANDS");
    assert.equal(materializer.metricsOnly, true);
    assert.equal(materializer.publicSafe, true);
    assert.equal(materializer.callsProviderApis, false);
    assert.equal(materializer.callsHostedSupermemory, false);
    assert.equal(materializer.callsLocalEndpoint, false);
    assert.equal(materializer.sendsBenchmarkTextToProvider, false);
    assert.equal(materializer.rawQuestionsIncluded, false);
    assert.equal(materializer.rawAnswersIncluded, false);
    assert.equal(materializer.rawMemoryIncluded, false);
    assert.equal(materializer.rawPrivateOutputPathIncluded, false);
    assert.equal(materializer.printsMaterializedCommands, false);
    assert.equal(materializer.printsEnvValues, false);
    assert.equal(materializer.printsPrivatePaths, false);
    assert.equal(materializer.supermemorySearchPolicy, "disabled-for-benchmark-methodology");
    assert.equal(materializer.privateScriptExportsSupermemorySearchDisabled, true);
    assert.equal(materializer.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(materializer.countsAsFullMemorySotaEvidence, false);
    assert.equal(materializer.publicBenchmarkClaimsAllowed, false);
    assert.equal(materializer.readyForMaterialization, false);
    assert.equal(materializer.writesRealPrivateCommandFile, false);
    assert.equal(materializer.privateCommandFile?.pathPrinted, false);
    assert.equal(materializer.commandPlan?.commandCount, 9);
    assert.deepEqual(materializer.commandPlan?.commandIds, expectedResumePrivateScriptCommandOrder);
    assert.deepEqual(materializer.commandPlan?.privateScriptCommandOrder, expectedResumePrivateScriptCommandOrder);
    assert.equal(materializer.commandPlan?.materializedCommandCount, 0);
    assert.equal(materializer.commandPlan?.commandsPrinted, false);
    assert.deepEqual(materializer.commandPlan?.privateScriptExports, [
      "RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH",
      "SELFMEM_SUPERMEMORY_SEARCH_DISABLED",
    ]);
    assert.equal(materializer.guardPlan?.ready, true);
    assert.equal(materializer.guardPlan?.startsWithFreshLocalRuntimeGuards, true);
    assert.equal(materializer.guardPlan?.runtimeBeforeDurability, true);
    assert.equal(materializer.guardPlan?.runtimeBeforeMissingArm, true);
    assert.equal(materializer.guardPlan?.durabilityBeforeMissingArm, true);
    assert.equal(materializer.guardPlan?.rerankDurabilityAfterEmbeddingDurability, true);
    assert.equal(materializer.guardPlan?.rerankDurabilityBeforeMissingArm, true);
    assert.equal(materializer.guardPlan?.resumeEnvAfterFreshGuards, true);
    assert.equal(materializer.guardPlan?.missingArmAfterResumeEnv, true);
    assert.deepEqual(materializer.guardPlan?.missingRequiredCommandIds, []);
    assert.equal(materializer.guardPlan?.firstCommandId, "rerunRuntimeDoctor");
    assert.equal(materializer.guardPlan?.secondCommandId, "rerunDurabilitySmoke");
    assert.equal(materializer.guardPlan?.thirdCommandId, "rerunLocalRerankDurabilitySmoke");
    assert.equal(materializer.guardPlan?.guardedCommandId, "missingArmResponseExport");
    assert.equal(materializer.replacementPlan?.requiredPlaceholdersReady, false);
    assert.ok(materializer.replacementPlan?.unresolvedRequiredPlaceholderNames?.includes("private-output-dir"));
    assert.ok(materializer.replacementPlan?.unresolvedRequiredPlaceholderNames?.includes("local-embedding-base-url"));
    assert.ok(materializer.replacementPlan?.optionalDefaultsApplied?.includes("env-only-if-cloud-endpoint"));
    assert.ok(materializer.blockers?.includes("private-dir-not-provided"));
    assert.ok(materializer.blockers?.includes("private-command-output-not-provided"));
  }
  assert.equal(localFullShardResumeCommandMaterializer.writesRealFiles, true);
  assert.equal(localFullShardResumeCommandMaterializerFresh.writesRealFiles, false);
  assert.match(localFullShardResumeCommandMaterializerEvidence, /Local-Full Shard Resume Command Materializer/);
  assert.match(localFullShardResumeCommandMaterializerEvidence, /Status: BLOCKED_LOCAL_FULL_RESUME_PRIVATE_COMMANDS/);
  assert.match(localFullShardResumeCommandMaterializerEvidence, /Prints materialized commands: false/);
  assert.match(localFullShardResumeCommandMaterializerEvidence, /Fresh local runtime guard order ready: true/);
  assert.match(localFullShardResumeCommandMaterializerEvidence, /First private command: rerunRuntimeDoctor/);
  assert.match(localFullShardResumeCommandMaterializerEvidence, /Second private command: rerunDurabilitySmoke/);
  assert.match(localFullShardResumeCommandMaterializerEvidence, /Third private command: rerunLocalRerankDurabilitySmoke/);
  assert.match(localFullShardResumeCommandMaterializerMarkdownFresh, /Ready for materialization: false/);
  for (const materializer of [
    localFullShardResumeCommandMaterializerFixture,
    localFullShardResumeCommandMaterializerReady,
  ]) {
    assert.equal(materializer.mode, "local-full-shard-resume-command-materializer");
    assert.equal(materializer.status, "READY_LOCAL_FULL_RESUME_PRIVATE_COMMANDS");
    assert.equal(materializer.readyForMaterialization, true);
    assert.equal(materializer.writesRealPrivateCommandFile, true);
    assert.equal(materializer.privateCommandFile?.pathPrinted, false);
    assert.equal(materializer.privateCommandFile?.outsideRepository, true);
    assert.equal(materializer.privateCommandFile?.mode, "0700");
    assert.match(materializer.privateCommandFile?.hash ?? "", /^sha256:[a-f0-9]{64}$/);
    assert.equal(materializer.commandPlan?.commandCount, 9);
    assert.deepEqual(materializer.commandPlan?.commandIds, expectedResumePrivateScriptCommandOrder);
    assert.deepEqual(materializer.commandPlan?.privateScriptCommandOrder, expectedResumePrivateScriptCommandOrder);
    assert.equal(materializer.commandPlan?.materializedCommandCount, 9);
    assert.equal(materializer.commandPlan?.commandsPrinted, false);
    assert.equal(materializer.guardPlan?.ready, true);
    assert.equal(materializer.guardPlan?.firstCommandId, "rerunRuntimeDoctor");
    assert.equal(materializer.guardPlan?.secondCommandId, "rerunDurabilitySmoke");
    assert.equal(materializer.guardPlan?.thirdCommandId, "rerunLocalRerankDurabilitySmoke");
    assert.equal(materializer.guardPlan?.guardedCommandId, "missingArmResponseExport");
    assert.equal(materializer.replacementPlan?.requiredPlaceholdersReady, true);
    assert.deepEqual(materializer.replacementPlan?.unresolvedRequiredPlaceholderNames, []);
    assert.ok(materializer.replacementPlan?.optionalDefaultsApplied?.includes("env-only-if-cloud-endpoint"));
    assert.deepEqual(materializer.blockers, []);
    assert.equal(materializer.printsMaterializedCommands, false);
    assert.equal(materializer.printsEnvValues, false);
    assert.equal(materializer.printsPrivatePaths, false);
    assert.equal(materializer.privateScriptExportsSupermemorySearchDisabled, true);
    assert.deepEqual(materializer.commandPlan?.privateScriptExports, [
      "RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH",
      "SELFMEM_SUPERMEMORY_SEARCH_DISABLED",
    ]);
    assert.equal(materializer.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(materializer.countsAsFullMemorySotaEvidence, false);
  }
  assert.match(localFullShardResumeCommandMaterializerPrivateScript, /^#!\/usr\/bin\/env bash/);
  assert.ok(
    localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 1. rerunRuntimeDoctor") <
      localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 2. rerunDurabilitySmoke"),
  );
  assert.ok(
    localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 2. rerunDurabilitySmoke") <
      localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 3. rerunLocalRerankDurabilitySmoke"),
  );
  assert.ok(
    localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 3. rerunLocalRerankDurabilitySmoke") <
      localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 4. resumeEnvDoctor"),
  );
  assert.ok(
    localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 4. resumeEnvDoctor") <
      localFullShardResumeCommandMaterializerPrivateScript.indexOf("# 5. missingArmResponseExport"),
  );
  assert.match(localFullShardResumeCommandMaterializerPrivateScript, /benchmark:local-rerank:durability/);
  assert.match(localFullShardResumeCommandMaterializerPrivateScript, /benchmark:answer-quality:arms/);
  assert.match(localFullShardResumeCommandMaterializerPrivateScript, /^export RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1$/m);
  assert.match(localFullShardResumeCommandMaterializerPrivateScript, /^export SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1$/m);
  assert.match(localFullShardResumeCommandMaterializerPrivateScript, /benchmark:answer-quality:preflight/);
  assert.match(localFullShardResumeCommandMaterializerPrivateScript, /benchmark:answer-quality:local-shard-intake/);
  assert.doesNotMatch(localFullShardResumeCommandMaterializerPrivateScript, /<[^>]+>/);
  for (const text of [
    JSON.stringify(localFullShardResumeCommandMaterializer),
    JSON.stringify(localFullShardResumeCommandMaterializerFresh),
    JSON.stringify(localFullShardResumeCommandMaterializerFixture),
    JSON.stringify(localFullShardResumeCommandMaterializerReady),
    localFullShardResumeCommandMaterializerEvidence,
    localFullShardResumeCommandMaterializerMarkdownFresh,
  ]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
  for (const securityDoctor of [
    localFullShardResumeCommandSecurity,
    localFullShardResumeCommandSecurityFresh,
  ]) {
    assert.equal(securityDoctor.mode, "local-full-shard-resume-command-security-doctor");
    assert.equal(securityDoctor.status, "READY_LOCAL_FULL_RESUME_COMMAND_SECURITY");
    assert.equal(securityDoctor.securityReady, true);
    assert.equal(securityDoctor.metricsOnly, true);
    assert.equal(securityDoctor.publicSafe, true);
    assert.equal(securityDoctor.callsProviderApis, false);
    assert.equal(securityDoctor.callsHostedSupermemory, false);
    assert.equal(securityDoctor.callsLocalEndpoint, false);
    assert.equal(securityDoctor.sendsBenchmarkTextToProvider, false);
    assert.equal(securityDoctor.rawQuestionIdsIncluded, false);
    assert.equal(securityDoctor.rawQuestionsIncluded, false);
    assert.equal(securityDoctor.rawAnswersIncluded, false);
    assert.equal(securityDoctor.rawMemoryIncluded, false);
    assert.equal(securityDoctor.rawTranscriptIncluded, false);
    assert.equal(securityDoctor.rawPromptIncluded, false);
    assert.equal(securityDoctor.rawPrivateOutputPathIncluded, false);
    assert.equal(securityDoctor.printsMaterializedCommands, false);
    assert.equal(securityDoctor.printsEnvValues, false);
    assert.equal(securityDoctor.printsPrivatePaths, false);
    assert.equal(securityDoctor.privateCommandPathPrinted, false);
    assert.equal(securityDoctor.privateScriptContentPrinted, false);
    assert.equal(securityDoctor.supermemorySearchPolicy, "disabled-for-benchmark-methodology");
    assert.equal(securityDoctor.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(securityDoctor.countsAsFullMemorySotaEvidence, false);
    assert.equal(securityDoctor.publicBenchmarkClaimsAllowed, false);
    assert.equal(securityDoctor.materializerReport?.publicReportSafe, true);
    assert.equal(securityDoctor.materializerReport?.commandsPrinted, false);
    assert.equal(securityDoctor.materializerReport?.guardPlan?.ready, true);
    assert.equal(securityDoctor.materializerReport?.privateScriptExportsSupermemorySearchDisabled, true);
    assert.deepEqual(securityDoctor.materializerReport?.privateScriptExports, [
      "RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH",
      "SELFMEM_SUPERMEMORY_SEARCH_DISABLED",
    ]);
    assert.deepEqual(securityDoctor.materializerReport?.privateScriptCommandOrder, expectedResumePrivateScriptCommandOrder);
    assert.equal(securityDoctor.fixtureProbe?.ready, true);
    assert.equal(securityDoctor.fixtureProbe?.publicOutputSafe, true);
    assert.equal(securityDoctor.fixtureProbe?.privateCommandFileWritten, true);
    assert.equal(securityDoctor.fixtureProbe?.privateCommandFileOutsideRepository, true);
    assert.equal(securityDoctor.fixtureProbe?.privateCommandFileMode, "0700");
    assert.equal(securityDoctor.fixtureProbe?.privateCommandFilePathPrinted, false);
    assert.match(securityDoctor.fixtureProbe?.privateCommandFileHash ?? "", /^sha256:[a-f0-9]{64}$/);
    assert.match(securityDoctor.fixtureProbe?.privateScriptHash ?? "", /^sha256:[a-f0-9]{64}$/);
    assert.equal(securityDoctor.fixtureProbe?.privateScriptContentPrinted, false);
    assert.equal(securityDoctor.fixtureProbe?.privateScriptExportsSupermemorySearchDisabled, true);
    assert.equal(securityDoctor.fixtureProbe?.privateScriptContainsRuntimeValues, true);
    assert.equal(securityDoctor.fixtureProbe?.privateScriptPlaceholderCount, 0);
    assert.equal(securityDoctor.fixtureProbe?.privateScriptOrderReady, true);
    assert.deepEqual(securityDoctor.fixtureProbe?.commandOrder, expectedResumePrivateScriptCommandOrder);
    assert.equal(securityDoctor.fixtureProbe?.firstCommandId, "rerunRuntimeDoctor");
    assert.equal(securityDoctor.fixtureProbe?.secondCommandId, "rerunDurabilitySmoke");
    assert.equal(securityDoctor.fixtureProbe?.thirdCommandId, "rerunLocalRerankDurabilitySmoke");
    assert.equal(securityDoctor.fixtureProbe?.guardedCommandId, "missingArmResponseExport");
    assert.equal(securityDoctor.fixtureProbe?.materializedCommandCount, 9);
    assert.equal(securityDoctor.fixtureProbe?.printsMaterializedCommands, false);
    assert.equal(securityDoctor.fixtureProbe?.printsPrivatePaths, false);
    assert.equal(securityDoctor.fixtureProbe?.printsEnvValues, false);
    assert.deepEqual(securityDoctor.blockers, []);
  }
  assert.match(localFullShardResumeCommandSecurityEvidence, /Local-Full Resume Command Security Doctor/);
  assert.match(localFullShardResumeCommandSecurityEvidence, /Status: READY_LOCAL_FULL_RESUME_COMMAND_SECURITY/);
  assert.match(localFullShardResumeCommandSecurityEvidence, /Fixture private command mode: 0700/);
  assert.match(localFullShardResumeCommandSecurityEvidence, /Fixture exports Supermemory search disable: true/);
  assert.match(localFullShardResumeCommandSecurityEvidence, /Fixture private script order ready: true/);
  assert.match(localFullShardResumeCommandSecurityEvidence, /Fixture first command: rerunRuntimeDoctor/);
  assert.match(localFullShardResumeCommandSecurityMarkdownFresh, /Security ready: true/);
  for (const text of [
    JSON.stringify(localFullShardResumeCommandSecurity),
    JSON.stringify(localFullShardResumeCommandSecurityFresh),
    localFullShardResumeCommandSecurityEvidence,
    localFullShardResumeCommandSecurityMarkdownFresh,
  ]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
  for (const resultDoctor of [
    localFullShardResumeResultDoctor,
    localFullShardResumeResultDoctorFresh,
  ]) {
    assert.equal(resultDoctor.mode, "local-full-shard-resume-result-doctor");
    assert.equal(resultDoctor.fixtureOnly, false);
    assert.equal(resultDoctor.status, "BLOCKED_LOCAL_FULL_SHARD_002_RESULT");
    assert.equal(resultDoctor.metricsOnly, true);
    assert.equal(resultDoctor.publicSafe, true);
    assert.equal(resultDoctor.callsProviderApis, false);
    assert.equal(resultDoctor.callsHostedSupermemory, false);
    assert.equal(resultDoctor.callsLocalEndpoint, false);
    assert.equal(resultDoctor.rawQuestionsIncluded, false);
    assert.equal(resultDoctor.rawAnswersIncluded, false);
    assert.equal(resultDoctor.rawMemoryIncluded, false);
    assert.equal(resultDoctor.rawPrivateOutputPathIncluded, false);
    assert.equal(resultDoctor.printsPrivatePaths, false);
    assert.equal(resultDoctor.printsEnvValues, false);
    assert.equal(resultDoctor.printsMaterializedCommands, false);
    assert.equal(resultDoctor.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(resultDoctor.countsAsFullMemorySotaEvidence, false);
    assert.equal(resultDoctor.publicBenchmarkClaimsAllowed, false);
    assert.equal(resultDoctor.readyForLocalShardIntake, false);
    assert.equal(resultDoctor.readyForShardCombine, false);
    assert.equal(resultDoctor.plan?.claimScope, "local-full");
    assert.equal(resultDoctor.commandMaterializer?.status, "BLOCKED_LOCAL_FULL_RESUME_PRIVATE_COMMANDS");
    assert.equal(resultDoctor.commandMaterializer?.ready, false);
    assert.equal(resultDoctor.commandMaterializer?.writesPrivateCommandFile, false);
    assert.equal(resultDoctor.previousShard?.present, true);
    assert.equal(resultDoctor.previousShard?.accepted, true);
    assert.equal(resultDoctor.shardResult?.present, false);
    assert.equal(resultDoctor.shardResult?.accepted, false);
    assert.ok(resultDoctor.blockers?.includes("resume-command-materializer-not-ready"));
    assert.ok(resultDoctor.blockers?.includes("resume-private-command-file-not-written"));
    assert.ok(resultDoctor.blockers?.includes("shard-002-result-missing"));
  }
  assert.equal(localFullShardResumeResultDoctor.writesRealFiles, true);
  assert.equal(localFullShardResumeResultDoctorFresh.writesRealFiles, false);
  assert.match(localFullShardResumeResultDoctorEvidence, /Local-Full Shard Resume Result Doctor/);
  assert.match(localFullShardResumeResultDoctorEvidence, /Status: BLOCKED_LOCAL_FULL_SHARD_002_RESULT/);
  assert.match(localFullShardResumeResultDoctorEvidence, /Ready for local shard intake: false/);
  assert.match(localFullShardResumeResultDoctorMarkdownFresh, /shard-002-result-missing/);
  assert.equal(localFullShardResumeResultDoctorFixture.mode, "local-full-shard-resume-result-doctor");
  assert.equal(localFullShardResumeResultDoctorFixture.fixtureOnly, true);
  assert.equal(localFullShardResumeResultDoctorFixture.status, "READY_LOCAL_FULL_SHARD_002_RESULT_FOR_INTAKE");
  assert.equal(localFullShardResumeResultDoctorFixture.readyForLocalShardIntake, true);
  assert.equal(localFullShardResumeResultDoctorFixture.readyForShardCombine, false);
  assert.equal(localFullShardResumeResultDoctorFixture.commandMaterializer?.ready, true);
  assert.equal(localFullShardResumeResultDoctorFixture.commandMaterializer?.writesPrivateCommandFile, true);
  assert.equal(localFullShardResumeResultDoctorFixture.previousShard?.accepted, true);
  assert.equal(localFullShardResumeResultDoctorFixture.shardResult?.accepted, true);
  assert.deepEqual(localFullShardResumeResultDoctorFixture.blockers, []);
  assert.equal(localFullShardResumeResultDoctorFixture.shardResult?.strategyNames?.includes("cloud-voyage4-voyage-lite-rerank"), false);
  assert.equal(localFullShardResumeResultDoctorFixture.shardResult?.strategyNames?.includes("cloud-nvidia-nemotron-1b"), false);
  for (const text of [
    JSON.stringify(localFullShardResumeResultDoctor),
    JSON.stringify(localFullShardResumeResultDoctorFresh),
    JSON.stringify(localFullShardResumeResultDoctorFixture),
    localFullShardResumeResultDoctorEvidence,
    localFullShardResumeResultDoctorMarkdownFresh,
  ]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
  for (const performanceReport of [
    localFullShardPerformanceReport,
    localFullShardPerformanceReportFresh,
  ]) {
    assert.equal(performanceReport.mode, "local-full-shard-performance-report");
    assert.equal(performanceReport.status, "COMPLETE_LOCAL_FULL_PERFORMANCE_SNAPSHOT");
    assert.equal(performanceReport.metricsOnly, true);
    assert.equal(performanceReport.publicSafe, true);
    assert.equal(performanceReport.callsProviderApis, false);
    assert.equal(performanceReport.callsHostedSupermemory, false);
    assert.equal(performanceReport.callsLocalEndpoint, false);
    assert.equal(performanceReport.rawQuestionIdsIncluded, false);
    assert.equal(performanceReport.rawQuestionsIncluded, false);
    assert.equal(performanceReport.rawAnswersIncluded, false);
    assert.equal(performanceReport.rawMemoryIncluded, false);
    assert.equal(performanceReport.rawPrivateOutputPathIncluded, false);
    assert.equal(performanceReport.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(performanceReport.countsAsFullMemorySotaEvidence, false);
    assert.equal(performanceReport.publicBenchmarkClaimsAllowed, false);
    assert.equal(performanceReport.readyForShardCombine, false);
    assert.equal(performanceReport.readyForEndToEndMemoryScoreGate, false);
    assert.equal(performanceReport.performanceSnapshotMature, true);
    assert.equal(performanceReport.coverage?.acceptedShardCount, 20);
    assert.equal(performanceReport.coverage?.missingShardCount, 0);
    assert.equal(performanceReport.coverage?.acceptedQueryCount, 500);
    assert.equal(performanceReport.coverage?.queryCount, 500);
    assert.equal(performanceReport.coverage?.coveragePercent, 100);
    assert.equal(performanceReport.coverage?.nextPendingShardId, null);
    assert.equal(performanceReport.coverage?.nextPendingShardRange, null);
    assert.equal(performanceReport.bestAnswerQuality?.strategy, "local-apple-qwen3-0_6b-local-rerank");
    assert.equal(performanceReport.bestAnswerQuality?.answerQuality, 24.9);
    assert.equal(performanceReport.bestAnswerQuality?.deltaVsBm25?.answerQuality, 2.738);
    assert.equal(performanceReport.lowestLatency?.strategy, "bm25-lite");
    assert.equal(performanceReport.localApple?.base?.answerQuality, 20.67);
    assert.equal(performanceReport.localApple?.rerank?.answerQuality, 24.9);
    assert.equal(performanceReport.localApple?.rerankDeltaVsBase?.answerQuality, 4.23);
    assert.equal(performanceReport.runtime?.runtimeBlockerStatus, "BLOCKED_LOCAL_FULL_SHARD_RUNTIME");
    assert.equal(performanceReport.runtime?.runtimeRecoveryStatus, "RETRIEVAL_AND_SCORING_READY");
    assert.equal(performanceReport.runtime?.runtimeBlockedShardCount, 0);
    assert.equal(performanceReport.runtime?.historicalRuntimeBlockedShardCount, 1);
    assert.equal(performanceReport.runtime?.recovery?.retrievalRecovered, true);
    assert.equal(performanceReport.runtime?.recovery?.answerQualityEnvReady, true);
    assert.equal(performanceReport.runtime?.failedArm, "local-apple-qwen3-0_6b-local-rerank");
    assert.equal(performanceReport.runtime?.resumeResultDoctorStatus, "BLOCKED_LOCAL_FULL_SHARD_002_RESULT");
    assert.equal(performanceReport.blockers?.includes("local-full-coverage-incomplete"), false);
    assert.equal(performanceReport.blockers?.includes("local-full-shard-003-scoring-env-missing"), false);
    assert.equal(performanceReport.blockers?.includes("local-full-runtime-blocker-present"), false);
  }
  assert.equal(localFullShardPerformanceReport.writesRealFiles, true);
  assert.equal(localFullShardPerformanceReportFresh.writesRealFiles, false);
  assert.match(localFullShardPerformanceReportEvidence, /Local-Full Shard Performance Report/);
  assert.match(localFullShardPerformanceReportEvidence, /Coverage: 100%/);
  assert.match(localFullShardPerformanceReportEvidence, /Strategy: local-apple-qwen3-0_6b-local-rerank/);
  assert.match(localFullShardPerformanceReportMarkdownFresh, /Runtime blocker status: BLOCKED_LOCAL_FULL_SHARD_RUNTIME/);
  assert.match(localFullShardPerformanceReportMarkdownFresh, /Runtime recovery status: RETRIEVAL_AND_SCORING_READY/);
  assert.match(localFullShardPerformanceReportMarkdownFresh, /Active runtime-blocked shards: 0/);
  for (const text of [
    JSON.stringify(localFullShardPerformanceReport),
    JSON.stringify(localFullShardPerformanceReportFresh),
    localFullShardPerformanceReportEvidence,
    localFullShardPerformanceReportMarkdownFresh,
  ]) {
    assert.doesNotMatch(text, secretPattern);
    assert.doesNotMatch(text, absolutePrivatePathPattern);
  }
  for (const localShardIntake of [localFullShardIntakeFresh, localFullAnswerQualityShardIntake]) {
    assert.equal(localShardIntake.mode, "public-benchmark-answer-quality-shard-intake");
    assert.equal(localShardIntake.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
    assert.equal(localShardIntake.plan?.claimScope, "local-full");
    assert.equal(localShardIntake.publicSafe, true);
    assert.equal(localShardIntake.metricsOnly, true);
    assert.equal(localShardIntake.publicBenchmarkClaimsAllowed, false);
    assert.equal(localShardIntake.readyForShardCombine, false);
    assert.equal(localShardIntake.readyForEndToEndMemoryScoreGate, false);
    assert.equal(localShardIntake.countsAsFullMemorySotaEvidence, false);
    assert.equal(localShardIntake.rawQuestionsIncluded, false);
    assert.equal(localShardIntake.rawAnswersIncluded, false);
    assert.equal(localShardIntake.rawMemoryIncluded, false);
    assert.equal(localShardIntake.rawPrivateOutputPathIncluded, false);
    assert.equal(localShardIntake.plan?.shardCount, 20);
    assert.equal(localShardIntake.intake?.inputCount, 0);
    assert.equal(localShardIntake.intake?.missingShardCount, 20);
    assert.deepEqual(localShardIntake.plan?.strategies, localFullAnswerQualityShardPlan.runPlan?.strategies);
    assert.equal(localShardIntake.plan?.strategies?.includes("cloud-voyage4-voyage-lite-rerank"), false);
    assert.equal(localShardIntake.plan?.strategies?.includes("cloud-nvidia-nemotron-1b"), false);
    assert.ok(localShardIntake.blockers?.includes("shard-results-missing"));
    assert.ok(localShardIntake.blockers?.includes("answer-quality-shards-missing"));
  }
  assert.match(localFullAnswerQualityShardIntakeEvidence, /Claim scope: local-full/);
  assert.match(localFullAnswerQualityShardIntakeEvidence, /Missing shards: 20/);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.mode, "public-benchmark-answer-quality-shard-intake");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.plan?.claimScope, "local-full");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.readyForShardCombine, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.countsAsFullMemorySotaEvidence, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.publicBenchmarkClaimsAllowed, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.intake?.inputCount, 1);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.intake?.acceptedShardCount, 1);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard001.intake?.missingShardCount, 19);
  assert.ok(localFullAnswerQualityShardIntakeAfterShard001.blockers?.includes("answer-quality-shards-missing"));
  assert.ok(localFullAnswerQualityShardIntakeAfterShard001.blockers?.includes("full-shard-coverage-incomplete"));
  assert.match(localFullAnswerQualityShardIntakeAfterShard001Evidence, /Accepted shards: 1/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard001Evidence, /Missing shards: 19/);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.mode, "public-benchmark-answer-quality-shard-intake");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.plan?.claimScope, "local-full");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.readyForShardCombine, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.countsAsFullMemorySotaEvidence, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.publicBenchmarkClaimsAllowed, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.intake?.inputCount, 2);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.intake?.acceptedShardCount, 2);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard002Recovery.intake?.missingShardCount, 18);
  assert.ok(localFullAnswerQualityShardIntakeAfterShard002Recovery.blockers?.includes("answer-quality-shards-missing"));
  assert.ok(localFullAnswerQualityShardIntakeAfterShard002Recovery.blockers?.includes("full-shard-coverage-incomplete"));
  assert.match(localFullAnswerQualityShardIntakeAfterShard002RecoveryEvidence, /Accepted shards: 2/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard002RecoveryEvidence, /Missing shards: 18/);
  {
    const requiredStrategies = localFullAnswerQualityShardPlan.runPlan?.strategies ?? [];
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.mode, "public-benchmark-answer-quality");
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.fixtureOnly, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.metricsOnly, true);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.publicSafe, true);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.rawQuestionsIncluded, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.rawAnswersIncluded, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.rawMemoryIncluded, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.rawTranscriptIncluded, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.mode, "local-full-shard-common-arm-projection");
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.exactStrategySetProjected, true);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.sourceWasStrategySuperset, true);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.sourceStrategyCount, 8);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.projectedStrategyCount, 5);
    assert.deepEqual(localFullAnswerQualityShard005CommonArmProjection.projection?.requiredStrategies, requiredStrategies);
    assert.deepEqual(
      localFullAnswerQualityShard005CommonArmProjection.strategies?.map((item) => item.strategy),
      requiredStrategies,
    );
    assert.deepEqual(localFullAnswerQualityShard005CommonArmProjection.projection?.droppedStrategies, [
      "wiki-title-amplified-hybrid",
      "wiki-subtopic-amplified-hybrid",
      "wiki-summary-session-hybrid",
    ]);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.droppedStrategiesCountAsEvidence, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.countsAsLocalFullBenchmarkEvidence, true);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.countsAsFullMemorySotaEvidence, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.projection?.publicBenchmarkClaimsAllowed, false);
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.winner?.strategy, "local-apple-qwen3-0_6b-local-rerank");
    assert.equal(localFullAnswerQualityShard005CommonArmProjection.winner?.answerQuality, 36);
    assert.match(localFullAnswerQualityShard005CommonArmProjectionEvidence, /Dropped Diagnostic Strategies/);
    assert.match(localFullAnswerQualityShard005CommonArmProjectionEvidence, /wiki-title-amplified-hybrid/);
    assert.match(localFullAnswerQualityShard005CommonArmProjectionEvidence, /Counts as full memory SOTA evidence: false/);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.mode, "public-benchmark-answer-quality-shard-intake");
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.plan?.claimScope, "local-full");
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.readyForShardCombine, false);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.countsAsFullMemorySotaEvidence, false);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.publicBenchmarkClaimsAllowed, false);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.intake?.inputCount, 5);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.intake?.acceptedShardCount, 5);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.intake?.missingShardCount, 15);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.intake?.sameStrategySet, true);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.missingShards?.[0]?.shardId, "shard-006");
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.missingShards?.[0]?.startIndex, 125);
    assert.equal(localFullAnswerQualityShardIntakeAfterShard005CommonArm.missingShards?.[0]?.endIndexExclusive, 150);
    assert.ok(localFullAnswerQualityShardIntakeAfterShard005CommonArm.blockers?.includes("answer-quality-shards-missing"));
    assert.ok(localFullAnswerQualityShardIntakeAfterShard005CommonArm.blockers?.includes("full-shard-coverage-incomplete"));
    assert.match(localFullAnswerQualityShardIntakeAfterShard005CommonArmEvidence, /Accepted shards: 5/);
    assert.match(localFullAnswerQualityShardIntakeAfterShard005CommonArmEvidence, /Missing shards: 15/);
    assert.match(localFullAnswerQualityShardIntakeAfterShard005CommonArmEvidence, /shard-006/);
  }
  assert.equal(localFullAnswerQualityShard006ArmExport.status, "EXPORTED_RESPONSE_ARMS");
  assert.equal(localFullAnswerQualityShard006ArmExport.readyForAnswerQualityPreflight, true);
  assert.match(localFullAnswerQualityShard006ArmExportEvidence, /EXPORTED_RESPONSE_ARMS/);
  assert.equal(localFullAnswerQualityShard006Preflight.status, "READY_FOR_LIVE_ANSWER_QUALITY");
  assert.equal(localFullAnswerQualityShard006Preflight.readiness?.liveAnswerQualityCanRun, true);
  assert.equal(localFullAnswerQualityShard006.ok, true);
  assert.equal(localFullAnswerQualityShard006.winner?.strategy, "local-apple-qwen3-0_6b-local-rerank");
  assert.equal(localFullAnswerQualityShard006.winner?.answerQuality, 31.2);
  assert.equal(localFullAnswerQualityShard006.publicBenchmarkClaimsAllowed, false);
  assert.match(localFullAnswerQualityShard006Evidence, /local-apple-qwen3-0_6b-local-rerank/);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.mode, "public-benchmark-answer-quality-shard-intake");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.readyForShardCombine, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.intake?.inputCount, 6);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.intake?.acceptedShardCount, 6);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.intake?.missingShardCount, 14);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.missingShards?.[0]?.shardId, "shard-007");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.missingShards?.[0]?.startIndex, 150);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard006.missingShards?.[0]?.endIndexExclusive, 175);
  assert.match(localFullAnswerQualityShardIntakeAfterShard006Evidence, /Accepted shards: 6/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard006Evidence, /Missing shards: 14/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard006Evidence, /shard-007/);
  assert.equal(localFullAnswerQualityShard007ArmExport.status, "EXPORTED_RESPONSE_ARMS");
  assert.equal(localFullAnswerQualityShard007ArmExport.readyForAnswerQualityPreflight, true);
  assert.match(localFullAnswerQualityShard007ArmExportEvidence, /EXPORTED_RESPONSE_ARMS/);
  assert.equal(localFullAnswerQualityShard007Preflight.status, "READY_FOR_LIVE_ANSWER_QUALITY");
  assert.equal(localFullAnswerQualityShard007Preflight.readiness?.liveAnswerQualityCanRun, true);
  assert.equal(localFullAnswerQualityShard007.ok, true);
  assert.equal(localFullAnswerQualityShard007.winner?.strategy, "local-apple-qwen3-0_6b-local-rerank");
  assert.equal(localFullAnswerQualityShard007.winner?.answerQuality, 32);
  assert.equal(localFullAnswerQualityShard007.publicBenchmarkClaimsAllowed, false);
  assert.match(localFullAnswerQualityShard007Evidence, /local-apple-qwen3-0_6b-local-rerank/);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.mode, "public-benchmark-answer-quality-shard-intake");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.readyForShardCombine, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.intake?.inputCount, 7);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.intake?.acceptedShardCount, 7);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.intake?.missingShardCount, 13);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.missingShards?.[0]?.shardId, "shard-008");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.missingShards?.[0]?.startIndex, 175);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard007.missingShards?.[0]?.endIndexExclusive, 200);
  assert.match(localFullAnswerQualityShardIntakeAfterShard007Evidence, /Accepted shards: 7/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard007Evidence, /Missing shards: 13/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard007Evidence, /shard-008/);
  assert.equal(localFullAnswerQualityShard008ArmExport.status, "EXPORTED_RESPONSE_ARMS");
  assert.equal(localFullAnswerQualityShard008ArmExport.readyForAnswerQualityPreflight, true);
  assert.match(localFullAnswerQualityShard008ArmExportEvidence, /EXPORTED_RESPONSE_ARMS/);
  assert.equal(localFullAnswerQualityShard008Preflight.status, "READY_FOR_LIVE_ANSWER_QUALITY");
  assert.equal(localFullAnswerQualityShard008Preflight.readiness?.liveAnswerQualityCanRun, true);
  assert.equal(localFullAnswerQualityShard008.ok, true);
  assert.equal(localFullAnswerQualityShard008.winner?.strategy, "local-apple-qwen3-0_6b-local-rerank");
  assert.equal(localFullAnswerQualityShard008.winner?.answerQuality, 22.4);
  assert.equal(localFullAnswerQualityShard008.publicBenchmarkClaimsAllowed, false);
  assert.match(localFullAnswerQualityShard008Evidence, /local-apple-qwen3-0_6b-local-rerank/);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.mode, "public-benchmark-answer-quality-shard-intake");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.readyForShardCombine, false);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.intake?.inputCount, 8);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.intake?.acceptedShardCount, 8);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.intake?.missingShardCount, 12);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.missingShards?.[0]?.shardId, "shard-009");
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.missingShards?.[0]?.startIndex, 200);
  assert.equal(localFullAnswerQualityShardIntakeAfterShard008.missingShards?.[0]?.endIndexExclusive, 225);
  assert.match(localFullAnswerQualityShardIntakeAfterShard008Evidence, /Accepted shards: 8/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard008Evidence, /Missing shards: 12/);
  assert.match(localFullAnswerQualityShardIntakeAfterShard008Evidence, /shard-009/);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.mode, "answer-quality-local-full-shard-runtime-blocker");
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.status, "BLOCKED_LOCAL_FULL_SHARD_RUNTIME");
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.claimScope, "local-full");
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.acceptedShard, false);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.countsAsLocalFullBenchmarkEvidence, false);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.countsAsFullMemorySotaEvidence, false);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.publicBenchmarkClaimsAllowed, false);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.queryShard?.queryOffset, 25);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.queryShard?.maxQueries, 25);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.partialAttempt?.completedArmCount, 3);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.partialAttempt?.missingArmCount, 2);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.partialAttempt?.acceptedShardCountAfterAttempt, 1);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.partialAttempt?.missingShardCountAfterAttempt, 19);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.failedArm?.strategy, "local-apple-qwen3-0_6b");
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.failedArm?.failureClass, "local-embedding-server-socket-close");
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.publicSyntheticReproduction?.reproduced, true);
  assert.equal(localFullAnswerQualityShard002RuntimeBlocker.completedPrivateArmEvidence?.length, 3);
  assert.ok(localFullAnswerQualityShard002RuntimeBlocker.blockers?.includes("local-full-shard-002-incomplete"));
  assert.match(localFullAnswerQualityShard002RuntimeBlockerEvidence, /Counts as local-full benchmark evidence: false/);
  assert.match(localFullAnswerQualityShard002RuntimeBlockerEvidence, /local-embedding-server-socket-close/);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.mode, "answer-quality-local-full-shard-runtime-blocker");
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.status, "BLOCKED_LOCAL_FULL_SHARD_RUNTIME");
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.claimScope, "local-full");
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.acceptedShard, false);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.countsAsLocalFullBenchmarkEvidence, false);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.countsAsFullMemorySotaEvidence, false);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.publicBenchmarkClaimsAllowed, false);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.queryShard?.queryOffset, 50);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.queryShard?.maxQueries, 25);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.partialAttempt?.completedArmCount, 4);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.partialAttempt?.missingArmCount, 1);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.failedArm?.strategy, "local-apple-qwen3-0_6b-local-rerank");
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.failedArm?.failureClass, "local-rerank-response-body-stall");
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.runtimeMitigation?.timeoutPatchApplied, true);
  assert.equal(localFullAnswerQualityShard003RuntimeBlocker.completedPrivateArmEvidence?.length, 4);
  assert.ok(localFullAnswerQualityShard003RuntimeBlocker.blockers?.includes("local-full-shard-003-incomplete"));
  assert.match(localFullAnswerQualityShard003RuntimeBlockerEvidence, /local-rerank-response-body-stall/);
  assert.match(localFullAnswerQualityShard003RuntimeBlockerEvidence, /cloud Voyage as the default/);
  for (const runtimeReport of [localEmbeddingRuntimeDoctor, localEmbeddingRuntimeFresh, localEmbeddingRuntimeHfNoEndpoint]) {
    assert.equal(runtimeReport.mode, "local-embedding-runtime-doctor");
    assert.equal(runtimeReport.metricsOnly, true);
    assert.equal(runtimeReport.publicSafe, true);
    assert.equal(runtimeReport.callsProviderApis, false);
    assert.equal(runtimeReport.sendsBenchmarkTextToProvider, false);
    assert.equal(runtimeReport.rawBenchmarkInputIncluded, false);
    assert.equal(runtimeReport.rawConfigIncluded, false);
    assert.equal(runtimeReport.rawServerHelpIncluded, false);
    assert.equal(runtimeReport.configEnvPathPrinted, false);
    assert.equal(runtimeReport.privatePathPrinted, false);
    assert.equal(runtimeReport.endpointPrinted, false);
    assert.equal(runtimeReport.modelPathPrinted, false);
    assert.equal(runtimeReport.serverBinPrinted, false);
    assert.equal(runtimeReport.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(runtimeReport.countsAsFullMemorySotaEvidence, false);
    assert.equal(runtimeReport.publicBenchmarkClaimsAllowed, false);
  }
  assert.equal(localEmbeddingRuntimeDoctor.status, "READY_LOCAL_EMBEDDING_RUNTIME");
  assert.equal(localEmbeddingRuntimeDoctor.configEnvProvided, false);
  assert.equal(localEmbeddingRuntimeDoctor.hfRepoConfigured, true);
  assert.equal(localEmbeddingRuntimeDoctor.serverBinary?.present, true);
  assert.equal(localEmbeddingRuntimeDoctor.serverBinary?.helpSupportsEmbedding, true);
  assert.equal(localEmbeddingRuntimeDoctor.modelArtifact?.source, "hf-repo");
  assert.equal(localEmbeddingRuntimeDoctor.modelArtifact?.resolvable, true);
  assert.equal(localEmbeddingRuntimeDoctor.modelArtifact?.likelyDedicatedEmbedding, true);
  assert.equal(localEmbeddingRuntimeDoctor.modelArtifact?.expectedFamilyMatched, true);
  assert.equal(localEmbeddingRuntimeDoctor.localEndpoint?.modelsEndpointReachable, true);
  assert.equal(localEmbeddingRuntimeDoctor.readyForLocalEmbeddingDurabilitySmoke, true);
  assert.equal(localEmbeddingRuntimeDoctor.readyForLocalAppleArmExport, true);
  assert.deepEqual(localEmbeddingRuntimeDoctor.blockers, []);
  assert.equal(localEmbeddingRuntimeFresh.status, "BLOCKED_LOCAL_EMBEDDING_RUNTIME");
  assert.equal(localEmbeddingRuntimeFresh.readyForLocalEmbeddingDurabilitySmoke, false);
  assert.equal(localEmbeddingRuntimeFresh.readyForLocalAppleArmExport, false);
  assert.equal(localEmbeddingRuntimeFresh.configEnvProvided, false);
  assert.ok(localEmbeddingRuntimeFresh.blockers?.includes("local-embedding-server-bin-missing"));
  assert.ok(localEmbeddingRuntimeFresh.blockers?.includes("local-embedding-model-path-missing"));
  assert.ok(localEmbeddingRuntimeFresh.blockers?.includes("local-embedding-endpoint-missing"));
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.status, "BLOCKED_LOCAL_EMBEDDING_RUNTIME");
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.hfRepoConfigured, true);
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.modelArtifact?.source, "hf-repo");
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.modelArtifact?.resolvable, true);
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.modelArtifact?.likelyDedicatedEmbedding, true);
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.modelArtifact?.expectedFamilyMatched, true);
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.localEndpoint?.configured, true);
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.localEndpoint?.localOnly, true);
  assert.equal(localEmbeddingRuntimeHfNoEndpoint.localEndpoint?.modelsEndpointReachable, false);
  assert.ok(localEmbeddingRuntimeHfNoEndpoint.blockers?.includes("local-embedding-server-bin-missing"));
  assert.ok(localEmbeddingRuntimeHfNoEndpoint.blockers?.includes("local-embedding-endpoint-not-reachable"));
  assert.match(localEmbeddingRuntimeDoctorEvidence, /Local Embedding Runtime Doctor/);
  assert.match(localEmbeddingRuntimeDoctorEvidence, /Likely dedicated embedding model: true/);
  assert.match(localEmbeddingRuntimeDoctorEvidence, /HF repo configured: true/);
  assert.match(localEmbeddingRuntimeMarkdownFresh, /Local Embedding Runtime Doctor/);
  assert.doesNotMatch(localEmbeddingRuntimeFreshStdout, /http:\/\/|127\.0\.0\.1|localhost|\/Users\/|\/private\/|\/tmp\//);
  assert.doesNotMatch(localEmbeddingRuntimeHfNoEndpointStdout, /http:\/\/|127\.0\.0\.1|localhost|\/Users\/|\/private\/|\/tmp\//);
  for (const launchReport of [localEmbeddingLaunchDiagnostic, localEmbeddingLaunchDiagnosticFixture]) {
    assert.equal(launchReport.mode, "local-embedding-launch-diagnostic");
    assert.equal(launchReport.metricsOnly, true);
    assert.equal(launchReport.publicSafe, true);
    assert.equal(launchReport.callsProviderApis, false);
    assert.equal(launchReport.callsHostedSupermemory, false);
    assert.equal(launchReport.callsLocalEndpoint, false);
    assert.equal(launchReport.sendsBenchmarkTextToProvider, false);
    assert.equal(launchReport.rawLogIncluded, false);
    assert.equal(launchReport.rawConfigIncluded, false);
    assert.equal(launchReport.rawBenchmarkInputIncluded, false);
    assert.equal(launchReport.rawPrivateOutputPathIncluded, false);
    assert.equal(launchReport.privatePathPrinted, false);
    assert.equal(launchReport.endpointPrinted, false);
    assert.equal(launchReport.modelPathPrinted, false);
    assert.equal(launchReport.serverBinPrinted, false);
    assert.equal(launchReport.printsEnvValues, false);
    assert.equal(launchReport.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(launchReport.countsAsFullMemorySotaEvidence, false);
    assert.equal(launchReport.publicBenchmarkClaimsAllowed, false);
    assert.ok(Array.isArray(launchReport.attempts));
    assert.ok(launchReport.attempts.every((attempt) => attempt.rawLogPrinted === false && attempt.privatePathPrinted === false));
  }
  assert.equal(localEmbeddingLaunchDiagnostic.status, "BLOCKED_LOCAL_EMBEDDING_LAUNCH");
  assert.equal(localEmbeddingLaunchDiagnostic.fixtureOnly, false);
  assert.equal(localEmbeddingLaunchDiagnostic.readyForShard002Resume, false);
  assert.equal(localEmbeddingLaunchDiagnostic.launchRecovered, false);
  assert.equal(localEmbeddingLaunchDiagnostic.launchBlocked, true);
  assert.equal(localEmbeddingLaunchDiagnostic.attemptCount, 2);
  assert.ok(localEmbeddingLaunchDiagnostic.blockers?.includes("local-embedding-launch-exited-before-endpoint-ready"));
  assert.ok(localEmbeddingLaunchDiagnostic.attempts?.some((attempt) => attempt.failureClass === "local-embedding-launch-exited-during-model-load"));
  assert.match(localEmbeddingLaunchDiagnosticEvidence, /Local Embedding Launch Diagnostic/);
  assert.match(localEmbeddingLaunchDiagnosticEvidence, /Ready for shard 002 resume: false/);
  assert.match(localEmbeddingLaunchDiagnosticEvidence, /raw log printed false/);
  for (const smokeReport of [localEmbeddingDurabilitySmoke, localEmbeddingDurabilityFresh]) {
    assert.equal(smokeReport.mode, "local-embedding-durability-smoke");
    assert.equal(smokeReport.syntheticOnly, true);
    assert.equal(smokeReport.metricsOnly, true);
    assert.equal(smokeReport.publicSafe, true);
    assert.equal(smokeReport.rawSyntheticInputIncluded, false);
    assert.equal(smokeReport.baseUrlPrinted, false);
    assert.equal(smokeReport.endpointPrinted, false);
    assert.equal(smokeReport.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(smokeReport.countsAsFullMemorySotaEvidence, false);
    assert.equal(smokeReport.publicBenchmarkClaimsAllowed, false);
    assert.ok(Number(smokeReport.probes?.length ?? 0) >= 3);
  }
  assert.equal(localEmbeddingDurabilitySmoke.status, "READY_LOCAL_EMBEDDING_DURABILITY");
  assert.equal(localEmbeddingDurabilitySmoke.readyForLocalAppleArmExport, true);
  assert.ok(localEmbeddingDurabilitySmoke.probes?.every((probe) => probe.status === "pass"));
  assert.deepEqual(localEmbeddingDurabilitySmoke.blockers, []);
  assert.equal(localEmbeddingDurabilityFresh.status, "BLOCKED_LOCAL_EMBEDDING_DURABILITY");
  assert.equal(localEmbeddingDurabilityFresh.readyForLocalAppleArmExport, false);
  assert.ok(localEmbeddingDurabilityFresh.blockers?.includes("local-embedding-base-url-missing"));
  assert.match(localEmbeddingDurabilitySmokeEvidence, /Local Embedding Durability Smoke/);
  assert.match(localEmbeddingDurabilitySmokeEvidence, /Ready for local Apple arm export: true/);
  assert.match(localEmbeddingDurabilityMarkdownFresh, /Local Embedding Durability Smoke/);
  for (const smokeReport of [localRerankDurabilitySmoke, localRerankDurabilityFresh, localRerankDurabilityFixture]) {
    assert.equal(smokeReport.mode, "local-rerank-durability-smoke");
    assert.equal(smokeReport.syntheticOnly, true);
    assert.equal(smokeReport.metricsOnly, true);
    assert.equal(smokeReport.publicSafe, true);
    assert.equal(smokeReport.rawSyntheticInputIncluded, false);
    assert.equal(smokeReport.baseUrlPrinted, false);
    assert.equal(smokeReport.endpointPrinted, false);
    assert.equal(smokeReport.responseBodyTimeoutBounded, true);
    assert.equal(smokeReport.countsAsLocalFullBenchmarkEvidence, false);
    assert.equal(smokeReport.countsAsFullMemorySotaEvidence, false);
    assert.equal(smokeReport.publicBenchmarkClaimsAllowed, false);
    assert.ok(Number(smokeReport.probes?.length ?? 0) >= 3);
  }
  if (localRerankDurabilitySmoke.status === "READY_LOCAL_RERANK_DURABILITY") {
    assert.equal(localRerankDurabilitySmoke.fixtureOnly, false);
    assert.equal(localRerankDurabilitySmoke.callsLocalEndpoint, true);
    assert.equal(localRerankDurabilitySmoke.readyForLocalRerankArmExport, true);
    assert.ok(localRerankDurabilitySmoke.probes?.every((probe) => probe.status === "pass"));
    assert.deepEqual(localRerankDurabilitySmoke.blockers, []);
  } else {
    assert.equal(localRerankDurabilitySmoke.status, "BLOCKED_LOCAL_RERANK_DURABILITY");
    assert.equal(localRerankDurabilitySmoke.readyForLocalRerankArmExport, false);
    assert.ok(localRerankDurabilitySmoke.blockers?.includes("local-rerank-endpoint-missing"));
  }
  assert.equal(localRerankDurabilityFresh.status, "BLOCKED_LOCAL_RERANK_DURABILITY");
  assert.equal(localRerankDurabilityFresh.readyForLocalRerankArmExport, false);
  assert.ok(localRerankDurabilityFresh.blockers?.includes("local-rerank-endpoint-missing"));
  assert.equal(localRerankDurabilityFixture.status, "READY_LOCAL_RERANK_DURABILITY");
  assert.equal(localRerankDurabilityFixture.fixtureOnly, true);
  assert.equal(localRerankDurabilityFixture.readyForLocalRerankArmExport, true);
  assert.deepEqual(localRerankDurabilityFixture.blockers, []);
  assert.match(localRerankDurabilitySmokeEvidence, /Local Rerank Durability Smoke/);
  assert.match(localRerankDurabilitySmokeEvidence, /Response body timeout bounded: true/);
  assert.match(localRerankDurabilityMarkdownFresh, /Local Rerank Durability Smoke/);
  const localEmbeddingDurabilityArmExport = spawnSync(
    "node",
    [
      "packages/bench/public-benchmark-answer-quality-arm-export.mjs",
      "--fixture",
      "--require-ready",
      "--require-local-embedding-durability",
      "--local-embedding-durability-report",
      blockedLocalEmbeddingDurabilityReportPath,
      "--strategies",
      "bm25-lite,full-hybrid-rerank,query-expanded-full-hybrid-rerank,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank",
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: noLocalEmbeddingEnv,
    },
  );
  assert.notEqual(localEmbeddingDurabilityArmExport.status, 0, "arm export must fail closed when durability report is blocked");
  const localEmbeddingDurabilityArmExportReport = JSON.parse(localEmbeddingDurabilityArmExport.stdout);
  assert.equal(localEmbeddingDurabilityArmExportReport.localEmbeddingDurability?.required, true);
  assert.equal(localEmbeddingDurabilityArmExportReport.localEmbeddingDurability?.ready, false);
  assert.ok(localEmbeddingDurabilityArmExportReport.blockers?.includes("local-embedding-durability-report-not-ready"));
  assert.doesNotMatch(localEmbeddingDurabilityArmExport.stdout, /http:\/\/|127\.0\.0\.1|localhost|\/Users\/|\/private\/|\/tmp\//);
  const localEmbeddingReadyDurabilityArmExport = spawnSync(
    "node",
    [
      "packages/bench/public-benchmark-answer-quality-arm-export.mjs",
      "--fixture",
      "--require-ready",
      "--require-local-embedding-durability",
      "--local-embedding-durability-report",
      "reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json",
      "--strategies",
      "bm25-lite,full-hybrid-rerank,query-expanded-full-hybrid-rerank,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank",
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: noLocalEmbeddingEnv,
    },
  );
  assert.notEqual(localEmbeddingReadyDurabilityArmExport.status, 0, "arm export still needs private response output even with ready durability");
  const localEmbeddingReadyDurabilityArmExportReport = JSON.parse(localEmbeddingReadyDurabilityArmExport.stdout);
  assert.equal(localEmbeddingReadyDurabilityArmExportReport.localEmbeddingDurability?.required, true);
  assert.equal(localEmbeddingReadyDurabilityArmExportReport.localEmbeddingDurability?.ready, true);
  assert.ok(!localEmbeddingReadyDurabilityArmExportReport.blockers?.includes("local-embedding-durability-report-not-ready"));
  assert.ok(localEmbeddingReadyDurabilityArmExportReport.blockers?.includes("private-response-output-dir-missing"));
  assert.doesNotMatch(localEmbeddingReadyDurabilityArmExport.stdout, /http:\/\/|127\.0\.0\.1|localhost|\/Users\/|\/private\/|\/tmp\//);
  assert.equal(answerQualityShardWorkorderReady.status, "READY_TO_RUN_FULL_ANSWER_QUALITY_SHARD_INTAKE");
  assert.equal(answerQualityShardWorkorderReady.readyForShardIntake, true);
  assert.equal(answerQualityShardWorkorderReady.readyForShardCombine, false);
  assert.equal(answerQualityShardWorkorderReady.progress?.inputCount, 20);
  assert.equal(answerQualityShardWorkorderReady.progress?.acceptedShardCount, 20);
  assert.equal(answerQualityShardWorkorderReady.progress?.pendingShardCount, 0);
  assert.equal(answerQualityShardWorkorderReady.progress?.rejectedResultCount, 0);
  assert.equal(answerQualityShardWorkorderReady.progress?.duplicateResultCount, 0);
  assert.equal(answerQualityShardWorkorderReady.progress?.workorderCount, 0);
  assert.deepEqual(answerQualityShardWorkorderReady.blockers, []);
  assert.match(answerQualityShardWorkorderMarkdownFresh, /Full Answer-Quality Shard Workorder/);
  assert.match(answerQualityShardWorkorderMarkdownFresh, /Execution Lanes/);
  assert.match(answerQualityShardWorkorderMarkdownFresh, /Execution Lane Readiness/);
  assert.match(fullAnswerQualityShardWorkorderEvidence, /Pending shards: 20/);
  assert.match(fullAnswerQualityShardWorkorderEvidence, /full-sota-accepted-shards/);
  assert.match(fullAnswerQualityShardWorkorderEvidence, /answer-quality=false/);
  for (const shardIntake of [answerQualityShardIntakeFresh, fullAnswerQualityShardIntake]) {
    assert.equal(shardIntake.mode, "public-benchmark-answer-quality-shard-intake");
    assert.equal(shardIntake.status, "BLOCKED_FULL_ANSWER_QUALITY_SHARDS");
    assert.equal(shardIntake.publicSafe, true);
    assert.equal(shardIntake.metricsOnly, true);
    assert.equal(shardIntake.publicBenchmarkClaimsAllowed, false);
    assert.equal(shardIntake.readyForShardCombine, false);
    assert.equal(shardIntake.readyForEndToEndMemoryScoreGate, false);
    assert.equal(shardIntake.countsAsFullMemorySotaEvidence, false);
    assert.equal(shardIntake.rawQuestionsIncluded, false);
    assert.equal(shardIntake.rawAnswersIncluded, false);
    assert.equal(shardIntake.rawMemoryIncluded, false);
    assert.equal(shardIntake.rawTranscriptIncluded, false);
    assert.equal(shardIntake.rawPrivateOutputPathIncluded, false);
    assert.equal(shardIntake.plan?.shardCount, 20);
    assert.equal(shardIntake.intake?.inputCount, 0);
    assert.equal(shardIntake.intake?.missingShardCount, 20);
    assert.equal(shardIntake.intake?.sameSourceLock, true);
    assert.ok(shardIntake.blockers?.includes("shard-results-missing"));
    assert.ok(shardIntake.blockers?.includes("answer-quality-shards-missing"));
  }
  assert.equal(answerQualityShardIntakeReady.status, "READY_TO_COMBINE_FULL_ANSWER_QUALITY_SHARDS");
  assert.equal(answerQualityShardIntakeReady.readyForShardCombine, true);
  assert.equal(answerQualityShardIntakeReady.intake?.acceptedShardCount, 20);
  assert.equal(answerQualityShardIntakeReady.intake?.missingShardCount, 0);
  assert.equal(answerQualityShardIntakeReady.intake?.completeCoverage, true);
  assert.equal(answerQualityShardIntakeReady.intake?.sameSourceLock, true);
  assert.deepEqual(answerQualityShardIntakeReady.blockers, []);
  assert.match(answerQualityShardIntakeReady.combineCommand ?? "", /--combine-mode shards/);
  assert.equal(localFullAnswerQualityShardWorkorderReady.readyForShardIntake, true);
  assert.equal(localFullAnswerQualityShardWorkorderReady.acceptedLaneReadyForAnswerQualityScoring, false);
  assert.equal(localFullAnswerQualityShardWorkorderReady.acceptedLaneReadiness?.canReachFullSotaGateAfterShardIntake, false);
  assert.equal(localFullAnswerQualityShardIntakeReady.status, "READY_TO_COMBINE_FULL_ANSWER_QUALITY_SHARDS");
  assert.equal(localFullAnswerQualityShardIntakeReady.readyForShardCombine, true);
  assert.equal(localFullAnswerQualityShardIntakeReady.intake?.acceptedShardCount, 20);
  assert.equal(localFullAnswerQualityShardIntakeReady.intake?.sameModels, true);
  assert.equal(localFullAnswerQualityShardIntakeReady.intake?.scoringModelPolicySatisfied, true);
  assert.deepEqual(localFullAnswerQualityShardIntakeReady.blockers, []);
  assert.equal(localFullResultGateReady.status, "READY_LOCAL_FULL_MEMORY_SCORE");
  assert.equal(localFullResultGateReady.claimScope, "local-full");
  assert.equal(localFullResultGateReady.countsAsEndToEndMemoryBenchmark, true);
  assert.equal(localFullResultGateReady.countsAsLocalFullBenchmarkEvidence, true);
  assert.equal(localFullResultGateReady.countsAsFullMemorySotaEvidence, false);
  assert.equal(localFullResultGateReady.scoringPolicy?.modelMatchPolicy, "local-diagnostic-allowed");
  assert.equal(localFullResultGateReady.scoringPolicy?.scoringModelPolicySatisfied, true);
  assert.ok(localFullResultGateReady.fullSotaBlockers?.includes("local-full-diagnostic-result-not-sota-comparable"));
  assert.equal(modelChallengerGateReady.status, "READY_MODEL_CHALLENGER_MEMORY_SCORE");
  assert.equal(modelChallengerGateReady.claimScope, "model-challenger");
  assert.equal(modelChallengerGateReady.countsAsEndToEndMemoryBenchmark, true);
  assert.equal(modelChallengerGateReady.countsAsModelChallengerReportedScoreEvidence, true);
  assert.equal(modelChallengerGateReady.countsAsFullMemorySotaEvidence, false);
  assert.equal(modelChallengerGateReady.scoringPolicy?.modelMatchPolicy, "challenger-model-allowed");
  assert.equal(modelChallengerGateReady.reportedTargetComparison?.primaryTarget?.id, "supermemory-production-research-gpt4o");
  assert.equal(modelChallengerGateReady.reportedTargetComparison?.scoreMeetsPrimaryReportedTarget, true);
  assert.equal(modelChallengerGateReady.reportedTargetComparison?.meetsReportedScoreComparison, true);
  assert.equal(modelChallengerGateReady.reportedTargetComparison?.meetsPrimaryReportedTarget, false);
  assert.equal(modelChallengerGateReady.reportedTargetComparison?.sameJudgeModelAsPrimaryTarget, false);
  assert.equal(modelChallengerGateReady.modelChallengerClaim?.ready, true);
  assert.match(modelChallengerGateReady.modelChallengerClaim?.statement ?? "", /ran LongMemEval-S answer-quality with deepseek-v4-pro/);
  assert.match(modelChallengerGateReady.modelChallengerClaim?.statement ?? "", /surpassed Supermemory's reported gpt-4o score \(81\.6 percent\)/);
  assert.match(modelChallengerGateReady.modelChallengerClaim?.statement ?? "", /\+0\.4 point delta/);
  assert.equal(modelChallengerGateReady.modelChallengerClaim?.strictSameModelSotaEvidence, false);
  assert.ok(modelChallengerGateReady.fullSotaBlockers?.includes("model-challenger-result-not-strict-sota-comparable"));
  assert.deepEqual(modelChallengerGateReady.modelChallengerBlockers, []);
  assert.notEqual(fullSotaLocalModelGateRun.status, 0, "full-SOTA gate must reject local diagnostic scoring under --require-ready");
  assert.match(
    `${fullSotaLocalModelGateRun.stdout}\n${fullSotaLocalModelGateRun.stderr}`,
    /result-claim-scope-does-not-match-requested-gate|answer-model-does-not-match-target|judge-model-does-not-match-target/,
  );
  const shardIntakeMismatchRoot = mkdtempSync(join(tmpdir(), "recallweave-answer-quality-shard-intake-mismatch-"));
  const shardIntakeMismatchInputs = syntheticShardInputs.map((inputPath, index) => {
    const clone = JSON.parse(readFileSync(inputPath, "utf8"));
    if (index === 0) clone.input.querySetHash = `sha256:${"0".repeat(64)}`;
    const outputPath = join(shardIntakeMismatchRoot, `answer-quality-shard-${String(index + 1).padStart(3, "0")}.json`);
    writeFileSync(outputPath, `${JSON.stringify(clone, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    return outputPath;
  });
  const shardIntakeMismatchRun = spawnSync("node", [
    "packages/bench/public-benchmark-answer-quality-shard-intake.mjs",
    "--require-ready",
    "--input",
    shardIntakeMismatchInputs.join(","),
  ], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.notEqual(shardIntakeMismatchRun.status, 0, "shard intake must fail closed on query-set hash mismatch");
  assert.match(`${shardIntakeMismatchRun.stdout}\n${shardIntakeMismatchRun.stderr}`, /query-set-hash-mismatch|shard-source-lock-mismatch/);
  assert.match(answerQualityShardIntakeMarkdownFresh, /Full Answer-Quality Shard Intake/);
  assert.match(fullAnswerQualityShardIntakeEvidence, /Missing shards: 20/);
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
  assert.equal(fullShardFlow.shardContract?.shardSize, 25);
  assert.equal(fullShardFlow.shardContract?.expectedShardCount, 20);
  assert.equal(fullShardFlow.shardContract?.expectedFullQueryCount, 500);
  assert.equal(fullShardFlow.shardContract?.strategySetMatchesShardPlan, true);
  assert.equal(fullShardFlow.shardContract?.responseArmExportPerShardRequired, true);
  assert.equal(fullShardFlow.shardContract?.preflightPerShardRequired, true);
  assert.deepEqual(fullShardFlow.shardContract?.strategySet, fullAnswerQualityShardPlan.runPlan?.strategies);
  assert.equal(fullShardFlow.shardContract?.workorderRequiredBeforeIntake, true);
  assert.match(fullShardFlow.shardContract?.publicShardResultPattern ?? "", /answer-quality-shard-001\.json/);
  assert.equal(fullShardFlow.shardContract?.combineMode, "query-shard-answer-quality-union");
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("--query-offset")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("benchmark:answer-quality:arms") && String(line).includes("full-answer-quality-arms/$shard_id")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("GEMINI_API_KEYS_FILE")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("benchmark:answer-quality:preflight") && String(line).includes("full-answer-quality-preflights")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("benchmark:answer-quality:shard-workorder")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("answer-quality-$shard_id.json")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("answer-quality-shard-020.json")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("benchmark:answer-quality:shard-intake") && String(line).includes("--require-ready")));
  assert.ok(fullShardFlow.commands?.some((line) => String(line).includes("--combine-mode shards")));
  assert.ok(fullShardFlow.commands?.every((line) => !String(line).includes("full-response-arms")));
  for (const doctorReport of [fullMemorySotaDoctorFresh, fullMemorySotaDoctorEvidence]) {
    const expectedLocalFull = {
      acceptedShardCount: 20,
      missingShardCount: 0,
      acceptedQueryCount: 500,
      coveragePercent: 100,
      nextPendingShardId: null,
      nextPendingShardRange: null,
      bestAnswerQuality: 24.9,
      bestDeltaVsBm25: 2.738,
      bm25AnswerQuality: 22.162,
      localAppleBaseAnswerQuality: 20.67,
      localAppleRerankAnswerQuality: 24.9,
      localAppleRerankDeltaVsBase: 4.23,
      reportedTargetScore: 85.2,
      reportedTargetDelta: -60.3,
      intakePathPattern: /answer-quality-local-full-shard-intake-after-shard-020-20260529\.json$/,
    };
    assert.equal(doctorReport.mode, "full-memory-sota-doctor");
    assert.equal(doctorReport.status, "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE");
    assert.equal(doctorReport.publicBenchmarkClaimsAllowed, false);
    assert.equal(doctorReport.countsAsFullMemorySotaEvidence, false);
    assert.equal(doctorReport.benchmarkContract?.bm25IsLexicalFloorOnly, true);
    assert.equal(doctorReport.benchmarkContract?.retrievalProxyOnlyIsNotEnough, true);
    assert.equal(doctorReport.benchmarkContract?.componentBenchmarksAreModelSelectionOnly, true);
    assert.equal(doctorReport.benchmarkContract?.benchmarkHarnessSourceOnlyIsNotAScore, true);
    assert.equal(doctorReport.reportedTargets?.sourceEvidenceCheckedAt, "2026-05-26");
    assert.equal(doctorReport.reportedTargets?.benchmarkHarnessTargetsSourceLocked, true);
    assert.equal(doctorReport.reportedTargets?.benchmarkHarnessTargetCount, 1);
    assert.equal(doctorReport.fullTarget?.queryCount, 500);
    assert.equal(doctorReport.rawSourceRetention?.retainsRawSourcesPrivately, true);
    assert.equal(doctorReport.rawSourceRetention?.publicReportIsSafe, true);
    assert.equal(doctorReport.privateInputState?.readyForAnswerQualityShardRun, true);
    assert.equal(doctorReport.privateInputState?.privateDirectoryInsideRepository, false);
    assert.equal(doctorReport.privateInputState?.filesPresent, 6);
    assert.equal(doctorReport.privateInputState?.filesHashMatched, 6);
    assert.equal(doctorReport.privateInputState?.maxMemoryBytes, 300000000);
    assert.ok(doctorReport.gates?.some((item) => item.id === "full-shard-private-inputs" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "full-shard-control-preflight" && item.status === "pass"));
    assert.equal(doctorReport.controlPreflightState?.sameDataShardReady, true);
    assert.equal(doctorReport.controlPreflightState?.liveAnswerQualityCanRun, false);
    assert.equal(doctorReport.controlPreflightState?.countsAsFullMemorySotaEvidence, false);
    assert.equal(doctorReport.controlPreflightState?.arms?.length, 3);
    assert.ok(doctorReport.controlPreflightState?.arms?.some((item) => item.strategy === "bm25-lite" && item.selectedShardCoverageReady === true));
    assert.ok(doctorReport.controlPreflightState?.arms?.every((item) => item.selectedQueryIdHashMatches === true));
    assert.ok(
      doctorReport.controlPreflightState?.arms?.some((item) => item.strategy === "query-expanded-full-hybrid-rerank" && item.responseCount === 25),
    );
    assert.equal(doctorReport.shardState?.acceptedShardCount, 0);
    assert.equal(doctorReport.shardState?.missingShardCount, 20);
    assert.equal(doctorReport.shardState?.fullSotaLaneReadyForResponseArmExport, false);
    assert.equal(doctorReport.shardState?.fullSotaLaneReadyForAnswerQualityScoring, false);
    assert.ok(
      doctorReport.shardState?.executionLaneReadiness?.some(
        (lane) =>
          lane.laneId === "full-sota-accepted-shards" &&
          lane.acceptedByFullShardIntake === true &&
          lane.readyForAnswerQualityScoring === false,
      ),
    );
    assert.ok(doctorReport.shardState?.fullSotaLaneEnvironmentBlockers?.includes("voyage-credentials-missing"));
    assert.ok(doctorReport.shardState?.fullSotaLaneEnvironmentBlockers?.includes("query-expansion-local-endpoint-or-cloud-consent-missing"));
    assert.equal(doctorReport.localFullLaneState?.intakeStatus, "READY_TO_COMBINE_FULL_ANSWER_QUALITY_SHARDS");
    assert.equal(doctorReport.localFullLaneState?.readyForShardCombine, true);
    assert.equal(doctorReport.localFullLaneState?.acceptedShardCount, expectedLocalFull.acceptedShardCount);
    assert.equal(doctorReport.localFullLaneState?.missingShardCount, expectedLocalFull.missingShardCount);
    assert.equal(doctorReport.localFullLaneState?.launchProgressSource, "checked-in-progress-intake");
    assert.equal(doctorReport.localFullLaneState?.launchProgressInputCount, 2);
    assert.equal(doctorReport.localFullLaneState?.launchAcceptedShardCount, 2);
    assert.equal(doctorReport.localFullLaneState?.launchPendingShardCount, 18);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.safe, true);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.evidenceReady, true);
    assert.deepEqual(doctorReport.localFullLaneState?.performanceReport?.evidenceBlockers, []);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.freshForIntake, true);
    assert.ok(
      Date.parse(doctorReport.localFullLaneState?.performanceReport?.generatedAt ?? "") >=
        Date.parse(doctorReport.localFullLaneState?.performanceReport?.intakeGeneratedAt ?? ""),
    );
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.expectedAcceptedShardCount, expectedLocalFull.acceptedShardCount);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.expectedAcceptedQueryCount, expectedLocalFull.acceptedQueryCount);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.expectedCoveragePercent, expectedLocalFull.coveragePercent);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.expectedNextPendingShardId, expectedLocalFull.nextPendingShardId);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.expectedNextPendingShardRange, expectedLocalFull.nextPendingShardRange);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.status, "COMPLETE_LOCAL_FULL_PERFORMANCE_SNAPSHOT");
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.acceptedShardCount, expectedLocalFull.acceptedShardCount);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.acceptedQueryCount, expectedLocalFull.acceptedQueryCount);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.queryCount, 500);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.coveragePercent, expectedLocalFull.coveragePercent);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.nextPendingShardId, expectedLocalFull.nextPendingShardId);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.nextPendingShardRange, expectedLocalFull.nextPendingShardRange);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.bestStrategy, "local-apple-qwen3-0_6b-local-rerank");
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.bestAnswerQuality, expectedLocalFull.bestAnswerQuality);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.bestDeltaVsBm25, expectedLocalFull.bestDeltaVsBm25);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.localAppleBaseAnswerQuality, expectedLocalFull.localAppleBaseAnswerQuality);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.localAppleRerankAnswerQuality, expectedLocalFull.localAppleRerankAnswerQuality);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.localAppleRerankDeltaVsBase, expectedLocalFull.localAppleRerankDeltaVsBase);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.runtimeBlockerStatus, "BLOCKED_LOCAL_FULL_SHARD_RUNTIME");
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.runtimeFailedArm, "local-apple-qwen3-0_6b-local-rerank");
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.runtimeRecoveryStatus, "RETRIEVAL_AND_SCORING_READY");
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.runtimeRecoveryRetrievalRecovered, true);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.runtimeRecoveryAnswerQualityEnvReady, true);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.activeRuntimeBlockedShardCount, 0);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.historicalRuntimeBlockedShardCount, 1);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.countsAsFullMemorySotaEvidence, false);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.publicBenchmarkClaimsAllowed, false);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.blockers?.includes("local-full-coverage-incomplete"), false);
    assert.equal(doctorReport.localFullLaneState?.performanceReport?.blockers?.includes("local-full-shard-003-scoring-env-missing"), false);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.status, "READY_LOCAL_FULL_COMBINED_SCORE");
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.evidenceReady, true);
    assert.deepEqual(doctorReport.localFullLaneState?.combinedScore?.evidenceBlockers, []);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.safe, true);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.coverageReady, true);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.claimScope, "local-full");
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.acceptedShardCount, expectedLocalFull.acceptedShardCount);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.scoredQueryCount, expectedLocalFull.acceptedQueryCount);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.totalQueryCount, 500);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.winnerStrategy, "local-apple-qwen3-0_6b-local-rerank");
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.winnerAnswerQuality, expectedLocalFull.bestAnswerQuality);
    assert.equal(doctorReport.localFullLaneState?.combinedScore?.bm25AnswerQuality, expectedLocalFull.bm25AnswerQuality);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.status, "READY_LOCAL_FULL_MEMORY_SCORE");
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.evidenceReady, true);
    assert.deepEqual(doctorReport.localFullLaneState?.memoryScoreGate?.evidenceBlockers, []);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.safe, true);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.countsAsEndToEndMemoryBenchmark, true);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.countsAsLocalFullBenchmarkEvidence, true);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.countsAsFullMemorySotaEvidence, false);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.observedScore, expectedLocalFull.bestAnswerQuality);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.reportedTargetScore, expectedLocalFull.reportedTargetScore);
    assert.equal(doctorReport.localFullLaneState?.memoryScoreGate?.scoreDelta, expectedLocalFull.reportedTargetDelta);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.status, "READY_LOCAL_FULL_SHARD_RESUME_ENV");
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.evidenceReady, true);
    assert.deepEqual(doctorReport.localFullLaneState?.resumeEnv?.evidenceBlockers, []);
    assert.ok(!doctorReport.localFullLaneState?.resumeEnv?.evidenceBlockers?.includes("private-dir-not-provided"));
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.evidenceBlockers?.includes("local-embedding-env-missing"), false);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.evidenceBlockers?.includes("answer-quality-env-missing"), false);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.readyForMissingArmExport, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.readyForAnswerQualityPreflight, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.readyForShardAnswerQuality, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.readyForLocalShardIntake, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.readyForCommandMaterialization, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.privateInputFilesReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.completedPrivateArmFilesReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.readyForMissingArmExportExceptEnv, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.localResumeExecutionEnvReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.privateDirectoryProvided, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.privateDirectoryPresent, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.privateDirectoryOutsideRepository, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.rawSourceRetentionContractReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.rawSourcesRetainedPrivately, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.rawSourcePrivateAuditReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.compressedDefaultRetrievalAllowed, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.uiMayUseCompressedDefaultButAuditRetainsRawSource, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.localEmbeddingDurabilityReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.localEmbeddingEnvReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.localRerankEnvReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.localSafetyEnvReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.answerQualityEnvReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.missingEnvironmentNameCount, 0);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.requiredPrivateInputFileCount, 3);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.presentPrivateInputFileCount, 3);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.completedArmFileCount, 4);
    assert.equal(doctorReport.localFullLaneState?.resumeEnv?.presentCompletedArmFileCount, 4);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.evidenceReady, true);
    assert.deepEqual(doctorReport.localFullLaneState?.resumeCommandSecurity?.evidenceBlockers, []);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.privateCommandFileMode, "0700");
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.privateCommandFileOutsideRepository, true);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.privateScriptPlaceholderCount, 0);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.privateScriptOrderReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.firstCommandId, "rerunRuntimeDoctor");
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.secondCommandId, "rerunDurabilitySmoke");
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.thirdCommandId, "rerunLocalRerankDurabilitySmoke");
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.guardedCommandId, "missingArmResponseExport");
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.materializedCommandCount, 9);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.printsMaterializedCommands, false);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.printsPrivatePaths, false);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.printsEnvValues, false);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.countsAsFullMemorySotaEvidence, false);
    assert.equal(doctorReport.localFullLaneState?.resumeCommandSecurity?.publicBenchmarkClaimsAllowed, false);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.status, "BLOCKED_LOCAL_FULL_SHARD_002_RESULT");
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.evidenceReady, false);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.evidenceGateReady, true);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.gateSatisfiedByAcceptedShardIntake, true);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.readyForLocalShardIntake, false);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.previousShardAccepted, true);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.shard002ResultPresent, false);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.shard002ResultAccepted, false);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.commandMaterializerReady, false);
    assert.equal(doctorReport.localFullLaneState?.resumeResult?.commandMaterializerWrotePrivateCommandFile, false);
    assert.ok(doctorReport.localFullLaneState?.resumeResult?.blockers?.includes("shard-002-result-missing"));
    assert.equal(doctorReport.localFullLaneState?.nextPendingShardId, expectedLocalFull.nextPendingShardId);
    assert.equal(doctorReport.localFullLaneState?.nextPendingShardRange, expectedLocalFull.nextPendingShardRange);
    assert.equal(doctorReport.localFullLaneState?.runtimeBlockedShardCount, 0);
    assert.equal(doctorReport.localFullLaneState?.historicalRuntimeBlockedShardCount, 2);
    assert.equal(doctorReport.localFullLaneState?.recoveredRuntimeBlockedShardCount, 2);
    assert.equal(doctorReport.localFullLaneState?.runtimeRecoveryStatus, "RETRIEVAL_AND_SCORING_READY");
    assert.equal(doctorReport.localFullLaneState?.runtimeRecoveryRetrievalRecovered, true);
    assert.equal(doctorReport.localFullLaneState?.runtimeRecoveryAnswerQualityEnvReady, true);
    assert.equal(doctorReport.localFullLaneState?.runtimeBlockerWorkorderInputCount, 1);
    assert.equal(doctorReport.localFullLaneState?.runtimeBlockerResumeAvailableCount, 1);
    assert.deepEqual(doctorReport.localFullLaneState?.nextPendingShardResumeMissingStrategies, []);
    assert.deepEqual(doctorReport.localFullLaneState?.historicalNextPendingShardResumeMissingStrategies, [
      "local-apple-qwen3-0_6b-local-rerank",
    ]);
    assert.equal(doctorReport.localFullLaneState?.latestRuntimeBlockedShard, null);
    assert.equal(doctorReport.localFullLaneState?.latestRuntimeBlockedArm, null);
    assert.equal(doctorReport.localFullLaneState?.localEmbeddingRuntimeStatus, "READY_LOCAL_EMBEDDING_RUNTIME");
    assert.equal(doctorReport.localFullLaneState?.localEmbeddingRuntimeReady, true);
    assert.equal(doctorReport.localFullLaneState?.localEmbeddingRuntimeModelLooksDedicated, true);
    assert.equal(doctorReport.localFullLaneState?.localEmbeddingRuntimeEndpointReachable, true);
    assert.deepEqual(doctorReport.localFullLaneState?.localEmbeddingRuntimeBlockers, []);
    assert.equal(doctorReport.localFullLaneState?.localEmbeddingDurabilityStatus, "READY_LOCAL_EMBEDDING_DURABILITY");
    assert.equal(doctorReport.localFullLaneState?.localEmbeddingDurabilityReady, true);
    assert.ok(Number(doctorReport.localFullLaneState?.localEmbeddingDurabilityProbeCount ?? 0) >= 4);
    assert.deepEqual(doctorReport.localFullLaneState?.localEmbeddingDurabilityBlockers, []);
    assert.equal(doctorReport.localFullLaneState?.shardIntakeBlockers?.includes("local-apple-embedding-server-socket-close"), false);
    assert.equal(doctorReport.localFullLaneState?.shardIntakeBlockers?.includes("local-rerank-response-body-stall"), false);
    assert.equal(doctorReport.localFullLaneState?.shardIntakeBlockers?.includes("local-full-shard-003-scoring-env-missing"), false);
    assert.ok(!doctorReport.localFullLaneState?.shardIntakeBlockers?.includes("local-embedding-runtime-not-ready"));
    assert.ok(!doctorReport.localFullLaneState?.shardIntakeBlockers?.includes("local-embedding-durability-smoke-not-ready"));
    assert.match(doctorReport.localFullLaneState?.intakePath ?? "", expectedLocalFull.intakePathPattern);
    assert.equal(doctorReport.localFullLaneState?.shardIntakeBlockers?.includes("answer-quality-shards-missing"), false);
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-embedding-runtime" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-embedding-durability" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-full-performance-snapshot" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-full-combined-memory-score" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-full-resume-env" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-full-resume-command-security" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-full-resume-result" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "local-full-shard-intake" && item.status === "pass"));
    assert.equal(doctorReport.currentCanary?.queryCount, 30);
    assert.equal(doctorReport.currentCanary?.scoreDelta, -42.0333);
    assert.equal(doctorReport.goalAudit?.goalComplete, false);
    assert.equal(doctorReport.goalAudit?.mayCallUpdateGoalComplete, false);
    assert.ok(doctorReport.gates?.some((item) => item.id === "raw-source-retention" && item.status === "pass"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "full-shard-results" && item.status === "blocked"));
    assert.ok(doctorReport.gates?.some((item) => item.id === "owner-and-real-canary" && item.status === "blocked"));
    assert.ok(doctorReport.blockers?.includes("shard-results-missing"));
    assert.ok(doctorReport.blockers?.includes("voyage-credentials-missing"));
    assert.ok(doctorReport.blockers?.includes("missing-voyage-answer-quality-same-data-result"));
    assert.ok(!doctorReport.blockers?.includes("private-dir-not-provided"));
    assert.equal(doctorReport.blockers?.includes("shard-002-result-missing"), false);
    assert.equal(doctorReport.blockers?.includes("local-full-shard-003-incomplete"), false);
    assert.equal(doctorReport.blockers?.includes("local-full-shard-003-scoring-env-missing"), false);
    assert.ok(doctorReport.blockers?.includes("human-public-launch-approval"));
    assert.ok(doctorReport.nextRunPlan?.strategySet?.includes("query-expanded-full-hybrid-rerank"));
    assert.ok(doctorReport.nextRunPlan?.executionLanes?.some((lane) => lane.id === "local-apple-no-spend" && lane.acceptedByFullShardIntake === false));
    assert.deepEqual(doctorReport.nextRunPlan?.acceptedShardIntakeLaneIds, ["full-sota-accepted-shards"]);
    assert.ok(doctorReport.nextRunPlan?.diagnosticLaneIds?.includes("deterministic-control-proxy"));
    assert.equal(doctorReport.nextRunPlan?.rawSourcesStayOutsideRepo, true);
  }
  assert.match(fullMemorySotaDoctorMarkdownFresh, /Full Memory SOTA Doctor/);
  assert.match(fullMemorySotaDoctorMarkdownFresh, /BM25|bm25/i);
  assert.match(fullMemorySotaDoctorMarkdownFresh, /Control Preflight/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Same-data shard ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Full SOTA lane ready for answer-quality scoring: false/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Missing local-full shards: 0/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Performance coverage: 100%/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Performance best strategy: local-apple-qwen3-0_6b-local-rerank/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Performance counts as SOTA evidence: false/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Combined score winner: local-apple-qwen3-0_6b-local-rerank/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Combined score answer quality: 24\.9/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Memory score gate status: READY_LOCAL_FULL_MEMORY_SCORE/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Memory score gate counts as SOTA evidence: false/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /local-full-performance-snapshot: pass/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /local-full-combined-memory-score: pass/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /local-full-resume-env: pass/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env ready for missing-arm export: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env ready for missing-arm export except env: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env private input files ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env completed private arm files ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env private directory provided: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env raw-source private audit ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env compressed default retrieval allowed: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env local execution env ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env local embedding env ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env local rerank env ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume env answer-quality env ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /local-full-resume-command-security: pass/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume command security ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume command private file mode: 0700/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume command first guard: rerunRuntimeDoctor/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume command second guard: rerunDurabilitySmoke/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume command guarded command: missingArmResponseExport/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume command counts as SOTA evidence: false/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /local-full-resume-result: pass/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume result gate satisfied by accepted shard intake: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume result ready for local shard intake: false/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume result previous shard accepted: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Resume result shard 002 present: false/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Next local-full shard: n\/a \(n\/a\)/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Runtime-blocked local-full shards: 0/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Historical runtime-blocked local-full shards: 2/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Recovered runtime-blocked local-full shards: 2/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Runtime recovery status: RETRIEVAL_AND_SCORING_READY/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Runtime blocker resume plans: 1/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Next shard missing resume arms: none/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Historical next shard missing resume arms: local-apple-qwen3-0_6b-local-rerank/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Local embedding runtime ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Local embedding durability ready: true/);
  assert.match(fullMemorySotaDoctorMarkdownEvidence, /Raw Source Retention/);
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
  assert.doesNotMatch(JSON.stringify(providerWaveIntakeReport), secretPattern);
  assert.doesNotMatch(providerWaveIntakeEvidence, secretPattern);
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
  assert.doesNotMatch(JSON.stringify(providerWaveIntakeReport), privatePathPattern);
  assert.doesNotMatch(providerWaveIntakeEvidence, privatePathPattern);
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
    const expectedCommit = "0123456789abcdef0123456789abcdef01234567";
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
      "--expected-commit",
      expectedCommit,
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
      "--expected-commit",
      expectedCommit,
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
    assert.equal(downloadsReport.sourceControl.expectedCommit, expectedCommit);
    assert.equal(downloadsReport.returnedWatch?.sourceControl?.expectedCommit, expectedCommit);
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
    assert.match(findings, new RegExp(`Expected report commit: \`${expectedCommit}\``));
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
  const benchmarkBlocker = report.blockers.find((item) => item.id === "full-memory-sota-benchmark-gate-incomplete");
  assert.ok(canaryBlocker, "missing fresh canary release blocker");
  assert.ok(benchmarkBlocker, "missing full-memory SOTA benchmark release blocker");
  assert.equal(report.blockers.some((item) => item.id === "hosted-supermemory-baseline-not-current"), false);
  assert.equal(report.checks.fullMemorySotaDoctor.status, "BLOCKED_FULL_MEMORY_SOTA_EVIDENCE");
  assert.equal(report.checks.fullMemorySotaDoctor.publicBenchmarkClaimsAllowed, false);
  assert.equal(report.checks.fullMemorySotaDoctor.countsAsFullMemorySotaEvidence, false);
  assert.equal(report.checks.fullMemorySotaDoctor.bm25IsLexicalFloorOnly, true);
  assert.equal(report.checks.fullMemorySotaDoctor.rawSourcesRetainedPrivately, true);
  assert.equal(report.checks.fullMemorySotaDoctor.rawPublicReportSafe, true);
  assert.equal(report.checks.fullMemorySotaDoctor.nextLocalFullShard, null);
  assert.equal(report.checks.fullMemorySotaDoctor.nextLocalFullShardRange, null);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullPendingShardCount, 0);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullAcceptedShardCount, 20);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullCombinedScoreReady, true);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullCombinedWinner, "local-apple-qwen3-0_6b-local-rerank");
  assert.equal(report.checks.fullMemorySotaDoctor.localFullCombinedAnswerQuality, 24.9);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullCombinedBm25AnswerQuality, 22.162);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullMemoryScoreGateStatus, "READY_LOCAL_FULL_MEMORY_SCORE");
  assert.equal(report.checks.fullMemorySotaDoctor.localFullMemoryScoreGateReady, true);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullMemoryScoreCountsAsLocalFullEvidence, true);
  assert.equal(report.checks.fullMemorySotaDoctor.localFullMemoryScoreCountsAsSotaEvidence, false);
  assert.equal(report.checks.fullMemorySotaDoctor.localEmbeddingRuntimeReady, true);
  assert.equal(report.checks.fullMemorySotaDoctor.localEmbeddingDurabilityReady, true);
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
  const currentReturnedCanaryExpectedCommit = report.currentReturnedCanaryExpectedCommit ?? "";
  assert.match(approvedAdapterCommit, /^[a-f0-9]{40}$/);
  assert.match(currentReturnedCanaryExpectedCommit, /^[a-f0-9]{40}$/);
  assert.match(report.latestVerifiedRepositoryHead?.headSha ?? "", /^[a-f0-9]{40}$/);
  assert.notEqual(report.latestVerifiedRepositoryHead?.headSha, approvedAdapterCommit);
  assert.notEqual(currentReturnedCanaryExpectedCommit, approvedAdapterCommit);
  assert.equal(report.checks.realDiagnosticsPostwatch.returnedDownloadsExpectedCommit, currentReturnedCanaryExpectedCommit);
  assert.equal(report.checks.realDiagnosticsPostwatch.postwatchPlanExpectedCommit, currentReturnedCanaryExpectedCommit);
  assert.match(benchmarkBlocker.nextAction, /full same-data answer-quality shard ladder/);
  assert.match(benchmarkBlocker.nextAction, /local-full diagnostic lane is complete/);
  assert.match(benchmarkBlocker.nextAction, /real canary gate/);
  assert.match(canaryBlocker.nextAction, /postwatch OpenClaw next-agent handoff packet/);
  assert.match(canaryBlocker.nextAction, /fresh 15-minute runtime window/);
  assert.match(canaryBlocker.nextAction, new RegExp(`canary:returned-(?:inbox|packet).*--require-production-canary.*--expected-commit ${currentReturnedCanaryExpectedCommit}`));
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
  assert.ok(report.manualCommands.some((item) => /canary:next-agent-packet/.test(item) && /--allow-failed-inputs/.test(item) && /--require-ready/.test(item) && item.includes(currentReturnedCanaryExpectedCommit)));
  assert.ok(report.manualCommands.some((item) => /canary:drill/.test(item) && /--format markdown/.test(item)));
  assert.ok(report.manualCommands.some((item) => /canary:returned-inbox/.test(item) && /--require-production-canary/.test(item) && item.includes(currentReturnedCanaryExpectedCommit)));
  assert.ok(report.manualCommands.some((item) => /canary:returned-packet/.test(item) && /--require-production-canary/.test(item) && item.includes(currentReturnedCanaryExpectedCommit)));
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
  const recallWeaveShardExportPath = join(collectorTmp, "recallweave-shard-export.json");
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
  const recallWeaveHybridExportResult = run("node", [
    "packages/bench/recallweave-response-export.mjs",
    "--fixture",
    "--strategy",
    "full-hybrid-rerank",
    "--max-queries",
    "1",
  ]);
  const recallWeaveShardExportResult = run("node", [
    "packages/bench/recallweave-response-export.mjs",
    "--fixture",
    "--query-offset",
    "1",
    "--max-queries",
    "1",
    "--output",
    recallWeaveShardExportPath,
  ]);
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
  const recallWeaveHybridExportReport = JSON.parse(recallWeaveHybridExportResult.stdout);
  const recallWeaveShardExportReport = JSON.parse(recallWeaveShardExportResult.stdout);
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
  assert.equal(recallWeaveExportReport.inputStats?.featureProfile?.tokens, true);
  assert.equal(recallWeaveExportReport.inputStats?.featureProfile?.tokenSet, true);
  assert.equal(recallWeaveExportReport.inputStats?.featureProfile?.semanticVector, false);
  assert.equal(recallWeaveExportReport.inputStats?.featureProfile?.topicTermSet, false);
  assert.equal(recallWeaveExportReport.inputStats?.featureProfile?.dateMs, false);
  assert.equal(recallWeaveExportReport.source?.preserveIds, true);
  assert.equal(Object.keys(recallWeaveExportReport.responses ?? {}).length, 3);
  assert.equal(recallWeaveExportReport.queryShard?.completeDataset, true);
  assert.equal(recallWeaveExportReport.queryShard?.responseCount, 3);
  assert.equal(recallWeaveHybridExportReport.source?.rankingStrategy, "full-hybrid-rerank");
  assert.equal(recallWeaveHybridExportReport.inputStats?.featureProfile?.semanticVector, true);
  assert.equal(recallWeaveHybridExportReport.inputStats?.featureProfile?.topicTermSet, true);
  assert.equal(recallWeaveHybridExportReport.inputStats?.featureProfile?.dateMs, true);
  assert.equal(recallWeaveHybridExportReport.privacyLeakCount, 0);
  assert.equal(recallWeaveShardExportReport.evidenceType, "fixture-recallweave-response-export");
  assert.equal(recallWeaveShardExportReport.queryShard?.startIndex, 1);
  assert.equal(recallWeaveShardExportReport.queryShard?.endIndexExclusive, 2);
  assert.equal(recallWeaveShardExportReport.queryShard?.totalQueryCount, 3);
  assert.equal(recallWeaveShardExportReport.queryShard?.responseCount, 1);
  assert.equal(recallWeaveShardExportReport.queryShard?.completeDataset, false);
  assert.equal(Object.keys(recallWeaveShardExportReport.responses ?? {}).length, 1);
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

function cleanupStaleReleaseCheckTempRoots(roots, { maxAgeMs }) {
  const now = Date.now();
  const seen = new Set();
  const report = {
    ok: true,
    mode: "release-temp-cleanup-guard",
    metricsOnly: true,
    printsPaths: false,
    cleanupPrefix: releaseCheckTempPrefix,
    onlyReleaseCheckRootPrefix: true,
    maxAgeMs,
    rootCount: 0,
    candidates: 0,
    removed: 0,
    skippedYoung: 0,
    skippedSymlink: 0,
    skippedNonDirectory: 0,
    skippedError: 0,
  };

  for (const rootPath of roots) {
    if (!rootPath || seen.has(rootPath) || !existsSync(rootPath)) continue;
    seen.add(rootPath);
    report.rootCount += 1;
    for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
      if (!entry.name.startsWith(releaseCheckTempPrefix)) continue;
      report.candidates += 1;
      const candidate = join(rootPath, entry.name);
      try {
        const stat = lstatSync(candidate);
        if (stat.isSymbolicLink()) {
          report.skippedSymlink += 1;
          continue;
        }
        if (!stat.isDirectory()) {
          report.skippedNonDirectory += 1;
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

function writeSyntheticAnswerQualityShardReports(plan, outputDir, options = {}) {
  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const paths = [];
  const querySetHash = plan.materializeReport?.collectorCompatibleQuerySetHash ?? "sha256:synthetic-query-set";
  const materializerHash = plan.materializeReport?.materializerHash ?? "sha256:synthetic-materializer";
  const answerLabelsHash = plan.target?.answerLabelsHash ?? "sha256:synthetic-answer-labels";
  const scoringCodeHash = plan.target?.scoringCodeHash ?? "sha256:synthetic-scoring";
  const answerModel = options.answerModel ?? plan.target?.answerModel;
  const judgeModel = options.judgeModel ?? plan.target?.judgeModel;
  const endpointIsLocal = options.endpointIsLocal === true;
  for (const shard of plan.shards ?? []) {
    const path = join(outputDir, `answer-quality-${shard.id}.json`);
    const strategies = (plan.runPlan?.strategies ?? []).map((strategy, index) => ({
      strategy,
      metrics: {
        answerQuality: 10 + index,
        memoryScore: 10 + index,
        longmemevalScore: 10 + index,
        quality: Number(((10 + index) / 100).toFixed(4)),
        judgeCorrectRate: 0.1,
        answerLatencyP50Ms: 10,
        answerLatencyP95Ms: 10,
        contextTokensAvg: 100,
      },
      provider: {
        answerCalls: shard.queryCount,
        judgeCalls: shard.queryCount,
        answerFailures: 0,
        judgeFailures: 0,
      },
      privacyLeakCount: 0,
      redactionFailureCount: 0,
      scoredQueryCount: shard.queryCount,
      resultFingerprints: Array.from({ length: shard.queryCount }, (_, queryIndex) => ({
        queryIdHash: `synthetic-${shard.id}-${String(queryIndex).padStart(2, "0")}`,
        score: 10 + index,
        correct: true,
        elapsedMs: 10,
        contextTokens: 100,
      })),
    }));
    const report = {
      schemaVersion: 1,
      ok: true,
      mode: "public-benchmark-answer-quality",
      fixtureOnly: false,
      benchmark: plan.target?.benchmark ?? "longmemeval",
      metricsOnly: true,
      publicSafe: true,
      retrievalProxyOnly: false,
      memoryBenchAnswerQuality: true,
      readyForEndToEndMemoryScoreGate: true,
      publicBenchmarkClaimsAllowed: false,
      callsProviderApis: true,
      sendsBenchmarkTextToProvider: true,
      rawQuestionIdsIncluded: false,
      rawQuestionsIncluded: false,
      rawAnswersIncluded: false,
      rawMemoryIncluded: false,
      rawTranscriptIncluded: false,
      rawPromptIncluded: false,
      target: {
        hash: plan.target?.hash,
        benchmark: plan.target?.benchmark,
        answerLabelsHash,
        scoringCodeHash,
        answerModel: plan.target?.answerModel,
        judgeModel: plan.target?.judgeModel,
      },
      input: {
        source: "materialized-source-locked-longmemeval",
        targetHash: plan.target?.hash,
        querySetHash,
        materializerHash,
        answerLabelsHash,
        scoringCodeHash,
        totalQueryCount: plan.runPlan?.queryCount,
        queryCount: plan.runPlan?.queryCount,
        scoredQueryCount: shard.queryCount,
        scoredQueryStart: shard.startIndex,
        scoredQueryEndExclusive: shard.endIndexExclusive,
        queryShard: {
          startIndex: shard.startIndex,
          endIndexExclusive: shard.endIndexExclusive,
          totalQueryCount: plan.runPlan?.queryCount,
          scoredQueryCount: shard.queryCount,
          selectedQueryIdHash: shard.rangeHash,
        },
      },
      provider: {
        answerModel,
        judgeModel,
        callsMade: shard.queryCount * strategies.length * 2,
        answerQualityCallsAllowed: true,
        publicDataConfirmed: true,
        endpointLabel: "synthetic-release-check",
        endpointIsLocal,
      },
      scoringPolicy: {
        claimScope: plan.runPlan?.claimScope ?? "full-sota",
        modelMatchPolicy: plan.scoringPolicy?.modelMatchPolicy ?? "exact-target-required",
        exactTargetModelsRequired: plan.scoringPolicy?.exactTargetModelsRequired === true,
        localDiagnosticModelAllowed: plan.scoringPolicy?.localDiagnosticModelAllowed === true,
        localDiagnosticEndpointSatisfied: endpointIsLocal,
        modelMismatchAllowed: plan.scoringPolicy?.localDiagnosticModelAllowed === true,
        countsAsFullMemorySotaEvidence: false,
        countsAsLocalFullBenchmarkEvidence: plan.runPlan?.claimScope === "local-full" && endpointIsLocal,
      },
      metrics: strategies.at(-1)?.metrics ?? null,
      strategies,
      winner: {
        strategy: strategies.at(-1)?.strategy ?? null,
        answerQuality: strategies.at(-1)?.metrics?.answerQuality ?? null,
        judgeCorrectRate: strategies.at(-1)?.metrics?.judgeCorrectRate ?? null,
        answerLatencyP50Ms: strategies.at(-1)?.metrics?.answerLatencyP50Ms ?? null,
      },
      reviewerApprovalCount: 0,
      privacyLeakCount: 0,
      redactionFailureCount: 0,
      safety: {
        metricsOnly: true,
        publicSafe: true,
        rawQuestionsIncluded: false,
        rawAnswersIncluded: false,
        rawMemoryIncluded: false,
        rawTranscriptIncluded: false,
        privateInputsStoredOutsideRepository: true,
      },
    };
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    paths.push(path);
  }
  return paths;
}

function writeSyntheticShardPreflightFixture(tempRoot) {
  mkdirSync(tempRoot, { recursive: true, mode: 0o700 });
  const targetPath = join(tempRoot, "target.json");
  const querySetPath = join(tempRoot, "longmemeval-queryset.private.json");
  const memoriesPath = join(tempRoot, "longmemeval-memories.private.jsonl");
  const answerLabelsPath = join(tempRoot, "longmemeval-answer-labels.private.json");
  const armsDir = join(tempRoot, "arms", "shard-001");
  mkdirSync(armsDir, { recursive: true, mode: 0o700 });
  const answerLabelsHash = "sha256:synthetic-answer-labels";
  const scoringCodeHash = "sha256:synthetic-scoring-code";
  const strategies = ["bm25-lite", "full-hybrid-rerank", "local-fixture-challenger"];
  const querySet = {
    schemaVersion: 1,
    datasetSlice: "synthetic-shard-preflight",
    authoring: {
      answerLabelsHash,
      scoringCodeHash,
    },
    queries: [
      { id: "query-one", q: "synthetic first query", expectedResultIds: ["memory-one"] },
      { id: "query-two", q: "synthetic second query", expectedResultIds: ["memory-two"] },
    ],
  };
  const querySetHash = `sha256:${stableHash(collectorQuerySetHashPayload(querySet))}`;
  const queryShard = {
    startIndex: 1,
    endIndexExclusive: 2,
    totalQueryCount: 2,
    selectedQueryCount: 1,
  };

  writeJson(targetPath, {
    schemaVersion: 1,
    fixtureOnly: false,
    claimTier: "run-only",
    benchmark: {
      family: "longmemeval",
      answerModel: "gpt-4o",
      judgeModel: "gpt-4o",
      answerLabelsHash,
      scoringCodeHash,
    },
  });
  writeJson(querySetPath, querySet);
  writeFileSync(
    memoriesPath,
    `${JSON.stringify({ id: "memory-one", source: "synthetic" })}\n${JSON.stringify({ id: "memory-two", source: "synthetic" })}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  writeJson(answerLabelsPath, {
    schemaVersion: 1,
    answerLabelsHash,
    scoringCodeHash,
    labels: [{ queryId: "query-one" }, { queryId: "query-two" }],
  });

  const armArgs = [];
  for (const strategy of strategies) {
    const armPath = join(armsDir, `${strategy}-responses.private.json`);
    writeJson(armPath, {
      schemaVersion: 1,
      mode: "public-benchmark-answer-quality-arm-export",
      strategy,
      querySetHash,
      queryShard,
      responses: {
        "query-two": {
          resultCount: 1,
          resultIds: ["memory-two"],
        },
      },
    });
    armArgs.push("--arm", `${strategy}=${armPath}`);
  }

  return { targetPath, querySetPath, memoriesPath, answerLabelsPath, armArgs };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function collectorQuerySetHashPayload(querySet) {
  return {
    schemaVersion: querySet.schemaVersion ?? 1,
    datasetSlice: querySet.datasetSlice ?? null,
    queries: (querySet.queries ?? []).map((query) => ({
      id: query.id,
      q: query.q,
      expectedResultIds: query.expectedResultIds ?? [],
      expectedResultHashes: query.expectedResultHashes ?? [],
    })),
  };
}

function stableHash(value) {
  return sha256(typeof value === "string" ? value : JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
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
    file === "vault-template/wiki/longmemeval-benchmark-topics.md" ||
    file === "CHANGELOG.md" ||
    file === "README.md" ||
    file === "SECURITY.md" ||
    file === "GITHUB_RULES.md"
  );
}

function isAllowedPostBaselineCodePath(file, allowedCodePaths) {
  return allowedCodePaths.has(file) && (
    file === ".gitignore" ||
    file === ".env.example" ||
    file === "configs/bench-budget.yaml" ||
    file === "configs/default.local.yaml" ||
    file === "configs/provider-matrix.yaml" ||
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "packages/adapters/hermes/selfmem_canary/__init__.py" ||
    file === "packages/adapters/hermes/selfmem_canary_standalone_smoke.py" ||
    file === "packages/adapters/openclaw/selfmem_canary/index.mjs" ||
    file === "packages/adapters/openclaw/selfmem_canary_standalone_smoke.mjs" ||
    file === "packages/brain-ui/fixtures/model-matrix.json" ||
    file === "packages/brain-ui/fixtures/session-compaction-local-audit.json" ||
    file === "packages/brain-ui/interaction-smoke.mjs" ||
    file === "packages/brain-ui/smoke.mjs" ||
    file === "packages/brain-ui/static-evidence.mjs" ||
    file === "packages/brain-ui/src/app.js" ||
    file === "packages/brain-ui/src/index.html" ||
    file === "packages/brain-ui/src/model.js" ||
    file === "packages/brain-ui/src/styles.css" ||
    file === "packages/core/dist/compaction/session.d.ts" ||
    file === "packages/core/dist/compaction/session.d.ts.map" ||
    file === "packages/core/dist/compaction/session.js" ||
    file === "packages/core/dist/compaction/session.js.map" ||
    file === "packages/core/dist/nucleus/index.d.ts" ||
    file === "packages/core/dist/nucleus/index.d.ts.map" ||
    file === "packages/core/dist/nucleus/index.js" ||
    file === "packages/core/dist/nucleus/index.js.map" ||
    file === "packages/core/src/compaction/session.ts" ||
    file === "packages/core/src/nucleus/index.ts" ||
    file.startsWith("packages/bench/") ||
    file.startsWith("tests/bench/") ||
    file === "tests/compaction/session-compaction.test.ts" ||
    file === "tests/nucleus/nucleus-snapshot.test.ts" ||
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
