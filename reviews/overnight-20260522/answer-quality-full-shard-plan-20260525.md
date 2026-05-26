# Full Answer-Quality Shard Plan

- Status: READY_FULL_ANSWER_QUALITY_SHARD_RUN
- Claim scope: full-sota
- Ready for answer-quality shard run: true
- Counts as full memory SOTA evidence: false
- Target: reviews/overnight-20260522/public-longmemeval-full-run-target.json
- Query count: 500
- Shard size: 25
- Shard count: 20
- Max memory bytes: 300000000
- Strategies: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, cloud-voyage4-voyage-lite-rerank, cloud-nvidia-nemotron-1b, local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank
- Raw sources retained privately: true

## Strategy Coverage
- BM25 control: true
- Full hybrid control: true
- Query expansion: true
- Voyage provider: true
- NVIDIA or Gemini provider: true
- Local Apple: true
- Local rerank: true

## Execution Lanes
- deterministic-control-proxy: ready; intake-compatible=false; providers=none
  - Run-path and shard-integrity proof only. This does not score local or provider model quality.
  - query-expansion=deterministic-fallback-only
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- local-apple-no-spend: ready; intake-compatible=false; providers=local-apple, local-rerank
  - Use first when validating the no-spend local method before cloud challenger spend.
  - query-expansion=local-model-or-deterministic-diagnostic
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- voyage-minimum-challenger: ready; intake-compatible=false; providers=voyage
  - Use when Voyage quota is available to unblock the same-data Voyage answer-quality comparison.
  - query-expansion=not-required
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- nvidia-minimum-challenger: ready; intake-compatible=false; providers=nvidia
  - Use for an NVIDIA challenger comparison without spending Voyage quota.
  - query-expansion=not-required
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- full-sota-accepted-shards: ready; intake-compatible=true; providers=local-apple, local-rerank, nvidia, voyage
  - Only this lane has the complete strategy set expected by shard intake and combine.
  - query-expansion=local-or-cloud-model-required
  - accepted only after every planned shard returns with this complete strategy set

## Shards
- shard-001: 0-25 (25)
- shard-002: 25-50 (25)
- shard-003: 50-75 (25)
- shard-004: 75-100 (25)
- shard-005: 100-125 (25)
- shard-006: 125-150 (25)
- shard-007: 150-175 (25)
- shard-008: 175-200 (25)
- shard-009: 200-225 (25)
- shard-010: 225-250 (25)
- shard-011: 250-275 (25)
- shard-012: 275-300 (25)
- shard-013: 300-325 (25)
- shard-014: 325-350 (25)
- shard-015: 350-375 (25)
- shard-016: 375-400 (25)
- shard-017: 400-425 (25)
- shard-018: 425-450 (25)
- shard-019: 450-475 (25)
- shard-020: 475-500 (25)

## Commands
```bash
RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=<1-when-provider-arms-run> RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=<1-when-provider-arms-run> SELFMEM_QUERY_EXPANSION_BASE_URL=<local-query-expansion-base-url-if-used> SELFMEM_QUERY_EXPANSION_MODEL=<query-expansion-model-if-used> RECALLWEAVE_QUERY_EXPANSION_CALLS=<1-when-cloud-query-expansion-runs> RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=<1-when-cloud-query-expansion-runs> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --live --execute --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/longmemeval-queryset.private.json --memories <private-output-dir>/longmemeval-memories.private.jsonl --private-output-dir <private-output-dir>/arms/{shardId} --strategies bm25-lite,full-hybrid-rerank,query-expanded-full-hybrid-rerank,cloud-voyage4-voyage-lite-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank --context-token-budget 800 --limit 5 --max-memory-bytes 300000000 --query-offset {startIndex} --max-queries {queryCount}
RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=gpt-4o RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=gpt-4o npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/longmemeval-queryset.private.json --memories <private-output-dir>/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/longmemeval-answer-labels.private.json --query-offset {startIndex} --max-queries {queryCount} --arm bm25-lite=<private-output-dir>/arms/{shardId}/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/arms/{shardId}/full-hybrid-rerank-responses.private.json --arm query-expanded-full-hybrid-rerank=<private-output-dir>/arms/{shardId}/query-expanded-full-hybrid-rerank-responses.private.json --arm cloud-voyage4-voyage-lite-rerank=<private-output-dir>/arms/{shardId}/cloud-voyage4-voyage-lite-rerank-responses.private.json --arm cloud-nvidia-nemotron-1b=<private-output-dir>/arms/{shardId}/cloud-nvidia-nemotron-1b-responses.private.json --arm local-apple-qwen3-0_6b=<private-output-dir>/arms/{shardId}/local-apple-qwen3-0_6b-responses.private.json --arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/arms/{shardId}/local-apple-qwen3-0_6b-local-rerank-responses.private.json --output <public-review-dir>/answer-quality-preflight-{shardId}.json --markdown-output <public-review-dir>/answer-quality-preflight-{shardId}.md
RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=gpt-4o RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=gpt-4o npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/longmemeval-queryset.private.json --memories <private-output-dir>/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/longmemeval-answer-labels.private.json --query-offset {startIndex} --max-queries {queryCount} --arm bm25-lite=<private-output-dir>/arms/{shardId}/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/arms/{shardId}/full-hybrid-rerank-responses.private.json --arm query-expanded-full-hybrid-rerank=<private-output-dir>/arms/{shardId}/query-expanded-full-hybrid-rerank-responses.private.json --arm cloud-voyage4-voyage-lite-rerank=<private-output-dir>/arms/{shardId}/cloud-voyage4-voyage-lite-rerank-responses.private.json --arm cloud-nvidia-nemotron-1b=<private-output-dir>/arms/{shardId}/cloud-nvidia-nemotron-1b-responses.private.json --arm local-apple-qwen3-0_6b=<private-output-dir>/arms/{shardId}/local-apple-qwen3-0_6b-responses.private.json --arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/arms/{shardId}/local-apple-qwen3-0_6b-local-rerank-responses.private.json --output <public-review-dir>/answer-quality-{shardId}.json --markdown-output <public-review-dir>/answer-quality-{shardId}.md
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:combine -- --input <public-review-dir>/answer-quality-shard-001.json,<public-review-dir>/answer-quality-shard-002.json,<public-review-dir>/answer-quality-shard-003.json,<public-review-dir>/answer-quality-shard-004.json,<public-review-dir>/answer-quality-shard-005.json,<public-review-dir>/answer-quality-shard-006.json,<public-review-dir>/answer-quality-shard-007.json,<public-review-dir>/answer-quality-shard-008.json,<public-review-dir>/answer-quality-shard-009.json,<public-review-dir>/answer-quality-shard-010.json,<public-review-dir>/answer-quality-shard-011.json,<public-review-dir>/answer-quality-shard-012.json,<public-review-dir>/answer-quality-shard-013.json,<public-review-dir>/answer-quality-shard-014.json,<public-review-dir>/answer-quality-shard-015.json,<public-review-dir>/answer-quality-shard-016.json,<public-review-dir>/answer-quality-shard-017.json,<public-review-dir>/answer-quality-shard-018.json,<public-review-dir>/answer-quality-shard-019.json,<public-review-dir>/answer-quality-shard-020.json --combine-mode shards --output <public-review-dir>/end-to-end-memory-score-full-combined.json --markdown-output <public-review-dir>/end-to-end-memory-score-full-combined.md
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --result <public-review-dir>/end-to-end-memory-score-full-combined.json --reviewer-approval-report <public-review-dir>/memory-score-reviewer-intake-full.json --require-ready
```

## Blockers
- none

## Next Actions
- Run response arm exports shard-by-shard with explicit provider and query-expansion consent.
- Run shard-aware answer-quality preflight for each shard before model-scored answer quality.
- Run answer-quality scoring for each shard with the target answer and judge models.
- Combine the full query-shard result set, then run the memory-score gate and reviewer intake on the combined metrics-only packet.
- Treat the completed result as SOTA-candidate evidence only after result gate, reviewer intake, UI/docs, owner approval, and real canary also pass.
