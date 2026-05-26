# Full Memory SOTA Doctor

- Status: BLOCKED_FULL_MEMORY_SOTA_EVIDENCE
- Public benchmark claims allowed: false
- Counts as full memory SOTA evidence: false
- Full target query count: 500
- Current canary query count: 30
- Current best score: 43.1667
- Current score delta vs reported target: -42.0333

## Gates
- source-locked-full-target: pass
- raw-source-retention: pass
- full-shard-private-inputs: pass
- full-shard-control-preflight: pass
- bm25-is-control-only: pass
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

## Blockers
- answer-quality-shard-runs-pending
- shard-results-missing
- answer-quality-shards-missing
- full-shard-coverage-incomplete
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
- Required after shard runs: benchmark:answer-quality:shard-workorder; benchmark:answer-quality:shard-intake --require-ready; benchmark:answer-quality:combine -- --combine-mode shards; benchmark:memory-score:reviewer-intake -- --strict-target; benchmark:memory-score:result-gate -- --require-ready; benchmark:sota-ladder; UI evidence, docs, release notes, owner approval, and real canary refresh
