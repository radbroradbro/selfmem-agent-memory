# Full Memory SOTA Doctor

- Status: BLOCKED_FULL_MEMORY_SOTA_EVIDENCE
- Public benchmark claims allowed: false
- Counts as full memory SOTA evidence: false
- Full target query count: 500
- Current canary query count: 30
- Current best score: 43.1667
- Current score delta vs reported target: -42.0333
- Reported target source evidence checked at: 2026-05-26
- Benchmark harness source locks: 1

## Gates
- source-locked-full-target: pass
- raw-source-retention: pass
- full-shard-private-inputs: pass
- accepted-sota-lane-launch-readiness: blocked (RECALLWEAVE_BASELINE_LIVE-not-enabled, RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed, RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled, RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed, RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled, RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed, answer-model-missing, judge-model-missing, local-apple-credentials-missing, local-rerank-credentials-missing, nvidia-credentials-missing, openai-compatible-base-url-missing, query-expansion-local-endpoint-or-cloud-consent-missing, voyage-credentials-missing, accepted-lane-response-export-not-ready, accepted-lane-answer-quality-scoring-not-ready, full-answer-quality-shard-results-not-returned, full-memory-sota-score-not-proven, public-sota-claim-not-allowed)
- full-shard-control-preflight: pass
- bm25-is-control-only: pass
- local-full-benchmark-lane: pass
- local-full-launch-readiness: blocked (RECALLWEAVE_BASELINE_LIVE-not-enabled, RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed, RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled, RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed, answer-model-missing, judge-model-missing, local-apple-credentials-missing, local-rerank-credentials-missing, openai-compatible-base-url-missing, query-expansion-local-endpoint-or-cloud-consent-missing, accepted-lane-response-export-not-ready, accepted-lane-answer-quality-scoring-not-ready, local-full-answer-quality-shard-results-not-returned)
- local-embedding-runtime: pass
- local-embedding-durability: pass
- local-full-shard-intake: blocked (answer-quality-shards-missing, full-shard-coverage-incomplete, local-full-coverage-incomplete)
- local-full-performance-snapshot: pass
- local-full-resume-env: pass
- local-full-resume-command-security: pass
- local-full-resume-result: pass
- full-shard-results: blocked (answer-quality-shard-runs-pending, shard-results-missing, answer-quality-shards-missing, full-shard-coverage-incomplete, RECALLWEAVE_BASELINE_LIVE-not-enabled, RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed, RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled, RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed, RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled, RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed, answer-model-missing, judge-model-missing, local-apple-credentials-missing, local-rerank-credentials-missing, nvidia-credentials-missing, openai-compatible-base-url-missing, query-expansion-local-endpoint-or-cloud-consent-missing, voyage-credentials-missing)
- same-data-provider-arms: blocked (missing-voyage-answer-quality-same-data-result)
- full-score-result-gate: blocked (reported-target-judge-model-does-not-match-result, missing-full-or-officially-comparable-memory-benchmark-run, best-end-to-end-score-below-primary-reported-memory-target)
- reported-target-beaten: blocked (best-end-to-end-score-below-reported-supermemory-target)
- independent-reviewers: blocked (two-independent-reviewer-approvals-missing)
- ui-docs-release-refresh: blocked (docs-release-notes-and-ui-evidence-must-refresh-after-full-result)
- owner-and-real-canary: blocked (human-public-launch-approval, full-memory-sota-benchmark-gate, real-container-production-rollout)

## Raw Source Retention
- Retains raw sources privately: true
- Public report is safe: true
- Private raw roles: queryset, memories, answer-labels, raw-dataset, selected-raw-rows, source-manifest, readme

## Private Inputs
- Status: READY_FULL_SHARD_PRIVATE_INPUTS
- Ready for shard run: true
- Private directory present: true
- Private directory inside repository: false
- Files present/hash-matched: 6/6
- Max memory bytes: 300000000

## Accepted Lane Launch
- Status: BLOCKED_ACCEPTED_LANE_SHARD_LAUNCH
- Ready for first accepted shard run: false
- Query expansion requirement: local-or-cloud-model-required
- Query expansion model-backed: false
- Response export ready: false
- Answer-quality scoring ready: false
- Operator inputs needed: 8

## Control Preflight
- Status: BLOCKED_ANSWER_QUALITY_ENV
- Same-data shard ready: true
- Live answer-quality can run: false
- Counts as full memory SOTA evidence: false
- Arms: bm25-lite:25, full-hybrid-rerank:25, query-expanded-full-hybrid-rerank:25

## Shards
- Plan status: READY_FULL_ANSWER_QUALITY_SHARD_RUN
- Intake status: BLOCKED_FULL_ANSWER_QUALITY_SHARDS
- Accepted shards: 0
- Missing shards: 20
- Full SOTA lane ready for response export: false
- Full SOTA lane ready for answer-quality scoring: false

## Local Full Lane
- Status: READY_LOCAL_FULL_BENCHMARK_PLAN
- Claim scope: local-full
- Accepted lane: local-full-accepted-shards
- Query count: 500
- Shard count: 20
- Ready for response export: false
- Ready for first shard run: false
- Intake status: BLOCKED_FULL_ANSWER_QUALITY_SHARDS
- Ready for shard combine: false
- Accepted local-full shards: 14
- Missing local-full shards: 6
- Launch progress source: checked-in-progress-intake
- Performance coverage: 70%
- Performance best strategy: local-apple-qwen3-0_6b-local-rerank
- Performance best answer quality: 29.3429
- Performance counts as SOTA evidence: false
- Resume env ready for missing-arm export: true
- Resume env ready for missing-arm export except env: true
- Resume env ready for command materialization: true
- Resume env private input files ready: true
- Resume env completed private arm files ready: true
- Resume env private directory provided: true
- Resume env raw-source private audit ready: true
- Resume env compressed default retrieval allowed: true
- Resume env local execution env ready: true
- Resume env local embedding env ready: true
- Resume env local rerank env ready: true
- Resume env answer-quality env ready: true
- Resume command security ready: true
- Resume command private file mode: 0700
- Resume command first guard: rerunRuntimeDoctor
- Resume command second guard: rerunDurabilitySmoke
- Resume command third guard: rerunLocalRerankDurabilitySmoke
- Resume command guarded command: missingArmResponseExport
- Resume command counts as SOTA evidence: false
- Resume result gate satisfied by accepted shard intake: true
- Resume result ready for local shard intake: false
- Resume result previous shard accepted: true
- Resume result shard 002 present: false
- Resume result shard 002 accepted: false
- Next local-full shard: shard-015 (350-375)
- Runtime-blocked local-full shards: 0
- Historical runtime-blocked local-full shards: 2
- Recovered runtime-blocked local-full shards: 2
- Runtime recovery status: RETRIEVAL_AND_SCORING_READY
- Runtime recovery retrieval recovered: true
- Runtime recovery answer-quality env ready: true
- Runtime blocker resume plans: 1
- Next shard missing resume arms: none
- Historical next shard missing resume arms: local-apple-qwen3-0_6b-local-rerank
- Latest runtime-blocked shard: n/a
- Latest runtime-blocked arm: n/a
- Local embedding runtime status: READY_LOCAL_EMBEDDING_RUNTIME
- Local embedding runtime ready: true
- Local embedding durability status: READY_LOCAL_EMBEDDING_DURABILITY
- Local embedding durability ready: true
- Cloud provider blocker count: 0
- Operator inputs needed: 5
- Counts as full memory SOTA evidence: false

## Blockers
- RECALLWEAVE_BASELINE_LIVE-not-enabled
- RECALLWEAVE_BASELINE_NO_RAW_TEXT-not-confirmed
- RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled
- RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed
- RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed
- RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled
- RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed
- answer-model-missing
- judge-model-missing
- local-apple-credentials-missing
- local-rerank-credentials-missing
- nvidia-credentials-missing
- openai-compatible-base-url-missing
- query-expansion-local-endpoint-or-cloud-consent-missing
- voyage-credentials-missing
- accepted-lane-response-export-not-ready
- accepted-lane-answer-quality-scoring-not-ready
- full-answer-quality-shard-results-not-returned
- full-memory-sota-score-not-proven
- public-sota-claim-not-allowed
- local-full-answer-quality-shard-results-not-returned
- answer-quality-shards-missing
- full-shard-coverage-incomplete
- local-full-coverage-incomplete
- answer-quality-shard-runs-pending
- shard-results-missing
- missing-voyage-answer-quality-same-data-result
- reported-target-judge-model-does-not-match-result
- missing-full-or-officially-comparable-memory-benchmark-run
- best-end-to-end-score-below-primary-reported-memory-target
- best-end-to-end-score-below-reported-supermemory-target
- two-independent-reviewer-approvals-missing
- docs-release-notes-and-ui-evidence-must-refresh-after-full-result
- human-public-launch-approval
- full-memory-sota-benchmark-gate
- real-container-production-rollout
- all-current-result-files-keep-public-claims-disabled
- missing-two-independent-memory-score-reviewer-approvals
- end-to-end-gate:answer-model-does-not-match-target
- end-to-end-gate:judge-model-does-not-match-target
- end-to-end-gate:missing-voyage-provider-arm
- end-to-end-gate:memory-score-reviewer-approval-report-not-ready
- end-to-end-gate:missing-two-independent-reviewer-approvals
- memory-score-reviewers:two-independent-reviewer-approvals-missing
- voyage-provider-rate-limited

## Next Run
- Primary stage: full-longmemeval-answer-quality-shards
- Strategy set: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, cloud-voyage4-voyage-lite-rerank, cloud-nvidia-nemotron-1b, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank
- Required after shard runs: benchmark:answer-quality:shard-workorder; benchmark:local-embedding:runtime-doctor before local Apple embedding durability; benchmark:local-embedding:durability before local Apple response-arm export; benchmark:answer-quality:shard-intake --require-ready; benchmark:answer-quality:combine -- --combine-mode shards; benchmark:memory-score:reviewer-intake -- --strict-target; benchmark:memory-score:result-gate -- --require-ready; benchmark:sota-ladder; UI evidence, docs, release notes, owner approval, and real canary refresh
