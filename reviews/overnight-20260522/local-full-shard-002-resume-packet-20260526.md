# Local-Full Shard Resume Packet

- Status: READY_FOR_LOCAL_FULL_SHARD_RESUME
- Target shard: shard-002 (25-50)
- Accepted local-full shards: 1
- Pending local-full shards: 19
- Runtime resume available: true
- Local embedding runtime ready: true
- Local embedding durability ready: true
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Resume State
- Previous failure: local-embedding-server-socket-close
- Completed arms: bm25-lite, full-hybrid-rerank, query-expanded-full-hybrid-rerank
- Missing arms: local-apple-qwen3-0_6b, local-apple-qwen3-0_6b-local-rerank
- Completed private arm hashes: bm25-lite=sha256:3eb7b6d8f8fdaa401c8fbb052b21cdd48cb6ae52e924876d0a33ce962cde3956; full-hybrid-rerank=sha256:22a4656f077df1304177dd2c04c964668f423b1d1826799e0d681d69ec26ac31; query-expanded-full-hybrid-rerank=sha256:cd3011dc8d751695d9461e66c013ffbb60d7a35c1ad632775293ace4970b6977

## Commands
- Runtime doctor: npm exec --yes pnpm@10.23.0 -- benchmark:local-embedding:runtime-doctor -- --require-ready --output reviews/overnight-20260522/local-embedding-runtime-doctor-20260526.json --markdown-output reviews/overnight-20260522/local-embedding-runtime-doctor-20260526.md
- Durability smoke: npm exec --yes pnpm@10.23.0 -- benchmark:local-embedding:durability -- --require-ready --output reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json --markdown-output reviews/overnight-20260522/local-embedding-durability-smoke-20260526.md
- Missing-arm export: RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-base-url> SELFMEM_LOCAL_EMBED_MODEL=<local-embedding-model> SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS=<safe-local-embedding-batch-token-limit> SELFMEM_LOCAL_EMBED_DURABILITY_REPORT=reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY=1 SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-base-url> SELFMEM_LOCAL_RERANK_MODEL=<local-rerank-model> SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT=<local-rerank-candidate-limit> SELFMEM_QUERY_EXPANSION_BASE_URL=<local-query-expansion-base-url-if-used> SELFMEM_QUERY_EXPANSION_MODEL=<query-expansion-model-if-used> RECALLWEAVE_QUERY_EXPANSION_CALLS=<1-when-cloud-query-expansion-runs> RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=<1-when-cloud-query-expansion-runs> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --live --execute --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/longmemeval-queryset.private.json --memories <private-output-dir>/longmemeval-memories.private.jsonl --private-output-dir <private-output-dir>/arms/shard-002 --strategies local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank --context-token-budget 800 --limit 5 --max-memory-bytes 300000000 --query-offset 25 --max-queries 25 --require-local-embedding-durability --local-embedding-durability-report reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json
- Preflight: RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=local-full RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=local-diagnostic-allowed RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<local-answer-model> RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<local-judge-model> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready --claim-scope local-full --model-match-policy local-diagnostic-allowed --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/longmemeval-queryset.private.json --memories <private-output-dir>/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/longmemeval-answer-labels.private.json --query-offset 25 --max-queries 25 --arm bm25-lite=<private-output-dir>/arms/shard-002/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/arms/shard-002/full-hybrid-rerank-responses.private.json --arm query-expanded-full-hybrid-rerank=<private-output-dir>/arms/shard-002/query-expanded-full-hybrid-rerank-responses.private.json --arm local-apple-qwen3-0_6b=<private-output-dir>/arms/shard-002/local-apple-qwen3-0_6b-responses.private.json --arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/arms/shard-002/local-apple-qwen3-0_6b-local-rerank-responses.private.json --output <public-review-dir>/answer-quality-local-full-preflight-shard-002.json --markdown-output <public-review-dir>/answer-quality-local-full-preflight-shard-002.md
- Answer quality: RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=local-full RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=local-diagnostic-allowed RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url> RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint> RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<local-answer-model> RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<local-judge-model> npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live --claim-scope local-full --model-match-policy local-diagnostic-allowed --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/longmemeval-queryset.private.json --memories <private-output-dir>/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/longmemeval-answer-labels.private.json --query-offset 25 --max-queries 25 --arm bm25-lite=<private-output-dir>/arms/shard-002/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/arms/shard-002/full-hybrid-rerank-responses.private.json --arm query-expanded-full-hybrid-rerank=<private-output-dir>/arms/shard-002/query-expanded-full-hybrid-rerank-responses.private.json --arm local-apple-qwen3-0_6b=<private-output-dir>/arms/shard-002/local-apple-qwen3-0_6b-responses.private.json --arm local-apple-qwen3-0_6b-local-rerank=<private-output-dir>/arms/shard-002/local-apple-qwen3-0_6b-local-rerank-responses.private.json --output <public-review-dir>/answer-quality-local-full-shard-002.json --markdown-output <public-review-dir>/answer-quality-local-full-shard-002.md
- Local shard intake: npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-shard-intake --input <public-review-dir>/answer-quality-local-full-shard-001.json,<public-review-dir>/answer-quality-local-full-shard-002.json --output reviews/overnight-20260522/answer-quality-local-full-shard-intake-after-shard-002.json --markdown-output reviews/overnight-20260522/answer-quality-local-full-shard-intake-after-shard-002.md --require-ready

## Safety
- Metrics only: true
- Public safe: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw private output path included: false

## Blockers
- none

## Next Actions
- Re-run the local embedding runtime doctor while the same local endpoint is alive.
- Re-run the local embedding durability smoke with --require-ready.
- Run the missing-arm-only response export for shard-002 so the already exported BM25, full-hybrid, and query-expanded arms are reused.
- Run the shard-002 answer-quality preflight and answer-quality commands.
- Re-run local shard intake with shard-001 and shard-002 public result JSONs.
- Do not combine, publish, or claim local-full benchmark evidence until all twenty local-full shards are accepted.
