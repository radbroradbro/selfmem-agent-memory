# Full Answer-Quality Shard Plan

- Status: READY_FULL_ANSWER_QUALITY_SHARD_RUN
- Claim scope: model-challenger
- Model match policy: challenger-model-allowed
- Ready for answer-quality shard run: true
- Counts as full memory SOTA evidence: false
- Target: reviews/overnight-20260522/public-longmemeval-full-run-target.json
- Query count: 500
- Shard size: 25
- Shard count: 20
- Max memory bytes: 400000000
- Strategies: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank, cloud-nvidia-nv-embed-v1-mistral-rerank
- Raw sources retained privately: true

## Strategy Coverage
- BM25 control: true
- Full hybrid control: true
- Query expansion: true
- Voyage provider: true
- NVIDIA or Gemini provider: true
- Local Apple: false
- Local rerank: false

## Provider Hybrid Contract
- BM25 lexical floor required: true
- Full hybrid control required: true
- Same-shard controls required: true
- Provider challengers are hybrid context arms: true
- Provider-only dense claims allowed: false
- Provider challenger controls present: true
- Cloud provider strategies: cloud-gemini2-embed-rerank-proxy, cloud-nvidia-nv-embed-v1-mistral-rerank, cloud-voyage4-voyage-lite-rerank

## Execution Lanes
- deterministic-control-proxy: ready; intake-compatible=false; providers=none
  - Run-path and shard-integrity proof only. This does not score local or provider model quality.
  - query-expansion=deterministic-fallback-only
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- local-apple-no-spend: missing; intake-compatible=false; providers=local-apple, local-rerank
  - Use first when validating the no-spend local method before cloud challenger spend.
  - query-expansion=local-model-or-deterministic-diagnostic
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- local-apple-scaled-challenger: missing; intake-compatible=false; providers=local-apple, local-rerank
  - Use as an overnight/local methodology challenger when the 4B runtime is stable; do not merge it into the 0.6B accepted lane.
  - query-expansion=local-model-or-deterministic-diagnostic
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- voyage-minimum-challenger: ready; intake-compatible=false; providers=voyage
  - Use when Voyage quota is available to unblock the same-data Voyage answer-quality comparison.
  - query-expansion=not-required
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- gemini2-minimum-challenger: ready; intake-compatible=false; providers=gemini
  - Use with direct Gemini API credentials to test Gemini Embedding 2 without spending Voyage rerank quota.
  - query-expansion=not-required
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- nvidia-minimum-challenger: ready; intake-compatible=false; providers=nvidia
  - Use for an NVIDIA challenger comparison without spending Voyage quota.
  - query-expansion=not-required
  - diagnostic subset only; full-shard intake rejects it as strategy-set mismatch
- model-challenger-accepted-shards: ready; intake-compatible=true; providers=gemini, nvidia, voyage
  - Use this lane for a full same-data challenger-model run; it cannot support public SOTA claims against exact-target reports.
  - query-expansion=local-or-cloud-model-required
  - accepted for this model-challenger benchmark plan only; full-SOTA intake still requires the exact-target provider comparison plan

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
npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --memory-method contextual-source-chunk-v1 --context-token-budget 800 --limit 5 --query-offset {startIndex} --max-queries {queryCount} --private-output-dir <private-output-dir>/shards/{shardId}/materialized --output <public-review-dir>/public-longmemeval-model-challenger-materialize-{shardId}.json --markdown-output <public-review-dir>/public-longmemeval-model-challenger-materialize-{shardId}.md
RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=model-challenger RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1 SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1 RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=<1-when-provider-arms-run> RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=<1-when-provider-arms-run> SELFMEM_QUERY_EXPANSION_BASE_URL=<local-query-expansion-base-url-if-used> SELFMEM_QUERY_EXPANSION_MODEL=<query-expansion-model-if-used> RECALLWEAVE_QUERY_EXPANSION_CALLS=<1-when-cloud-query-expansion-runs> RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=<1-when-cloud-query-expansion-runs> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --live --execute --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/shards/{shardId}/materialized/longmemeval-queryset.private.json --memories <private-output-dir>/shards/{shardId}/materialized/longmemeval-memories.private.jsonl --private-output-dir <private-output-dir>/shards/{shardId}/arms --strategies bm25-lite,full-hybrid-rerank,query-expanded-full-hybrid-rerank,cloud-gemini2-embed-rerank-proxy,cloud-voyage4-voyage-lite-rerank,cloud-nvidia-nv-embed-v1-mistral-rerank --context-token-budget 800 --limit 5 --max-memory-bytes 400000000 --query-offset 0 --max-queries {queryCount}
RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=model-challenger RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=challenger-model-allowed RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1 SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1 RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<challenger-answer-model> RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<challenger-judge-model> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready --claim-scope model-challenger --model-match-policy challenger-model-allowed --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/shards/{shardId}/materialized/longmemeval-queryset.private.json --memories <private-output-dir>/shards/{shardId}/materialized/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/shards/{shardId}/materialized/longmemeval-answer-labels.private.json --query-offset 0 --max-queries {queryCount} --arm bm25-lite=<private-output-dir>/shards/{shardId}/arms/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/shards/{shardId}/arms/full-hybrid-rerank-responses.private.json --arm query-expanded-full-hybrid-rerank=<private-output-dir>/shards/{shardId}/arms/query-expanded-full-hybrid-rerank-responses.private.json --arm cloud-gemini2-embed-rerank-proxy=<private-output-dir>/shards/{shardId}/arms/cloud-gemini2-embed-rerank-proxy-responses.private.json --arm cloud-voyage4-voyage-lite-rerank=<private-output-dir>/shards/{shardId}/arms/cloud-voyage4-voyage-lite-rerank-responses.private.json --arm cloud-nvidia-nv-embed-v1-mistral-rerank=<private-output-dir>/shards/{shardId}/arms/cloud-nvidia-nv-embed-v1-mistral-rerank-responses.private.json --output <public-review-dir>/answer-quality-model-challenger-preflight-{shardId}.json --markdown-output <public-review-dir>/answer-quality-model-challenger-preflight-{shardId}.md
RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=model-challenger RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=challenger-model-allowed RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH=1 SELFMEM_SUPERMEMORY_SEARCH_DISABLED=1 RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<challenger-answer-model> RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<challenger-judge-model> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live --claim-scope model-challenger --model-match-policy challenger-model-allowed --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/shards/{shardId}/materialized/longmemeval-queryset.private.json --memories <private-output-dir>/shards/{shardId}/materialized/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/shards/{shardId}/materialized/longmemeval-answer-labels.private.json --query-offset 0 --max-queries {queryCount} --arm bm25-lite=<private-output-dir>/shards/{shardId}/arms/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/shards/{shardId}/arms/full-hybrid-rerank-responses.private.json --arm query-expanded-full-hybrid-rerank=<private-output-dir>/shards/{shardId}/arms/query-expanded-full-hybrid-rerank-responses.private.json --arm cloud-gemini2-embed-rerank-proxy=<private-output-dir>/shards/{shardId}/arms/cloud-gemini2-embed-rerank-proxy-responses.private.json --arm cloud-voyage4-voyage-lite-rerank=<private-output-dir>/shards/{shardId}/arms/cloud-voyage4-voyage-lite-rerank-responses.private.json --arm cloud-nvidia-nv-embed-v1-mistral-rerank=<private-output-dir>/shards/{shardId}/arms/cloud-nvidia-nv-embed-v1-mistral-rerank-responses.private.json --output <public-review-dir>/answer-quality-model-challenger-{shardId}.json --markdown-output <public-review-dir>/answer-quality-model-challenger-{shardId}.md
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:combine -- --input <public-review-dir>/answer-quality-model-challenger-shard-001.json,<public-review-dir>/answer-quality-model-challenger-shard-002.json,<public-review-dir>/answer-quality-model-challenger-shard-003.json,<public-review-dir>/answer-quality-model-challenger-shard-004.json,<public-review-dir>/answer-quality-model-challenger-shard-005.json,<public-review-dir>/answer-quality-model-challenger-shard-006.json,<public-review-dir>/answer-quality-model-challenger-shard-007.json,<public-review-dir>/answer-quality-model-challenger-shard-008.json,<public-review-dir>/answer-quality-model-challenger-shard-009.json,<public-review-dir>/answer-quality-model-challenger-shard-010.json,<public-review-dir>/answer-quality-model-challenger-shard-011.json,<public-review-dir>/answer-quality-model-challenger-shard-012.json,<public-review-dir>/answer-quality-model-challenger-shard-013.json,<public-review-dir>/answer-quality-model-challenger-shard-014.json,<public-review-dir>/answer-quality-model-challenger-shard-015.json,<public-review-dir>/answer-quality-model-challenger-shard-016.json,<public-review-dir>/answer-quality-model-challenger-shard-017.json,<public-review-dir>/answer-quality-model-challenger-shard-018.json,<public-review-dir>/answer-quality-model-challenger-shard-019.json,<public-review-dir>/answer-quality-model-challenger-shard-020.json --combine-mode shards --output <public-review-dir>/end-to-end-memory-score-model-challenger-combined.json --markdown-output <public-review-dir>/end-to-end-memory-score-model-challenger-combined.md
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --claim-scope model-challenger --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --result <public-review-dir>/end-to-end-memory-score-model-challenger-combined.json --reviewer-approval-report <public-review-dir>/memory-score-reviewer-intake-model-challenger.json --require-ready
```

## Blockers
- none

## Next Actions
- Run shard-scoped materialization before each response arm export so provider and local arms load only the shard-local private corpus.
- Run response arm exports shard-by-shard with explicit provider and query-expansion consent.
- Run shard-aware answer-quality preflight for each shard before model-scored answer quality.
- Run answer-quality scoring for each shard with the declared challenger answer and judge models.
- Combine the full query-shard result set, then run the memory-score gate and reviewer intake on the combined metrics-only packet.
- Treat the completed result as challenger-model benchmark evidence only; public SOTA and production-replacement claims still require exact-target full-SOTA gates.
