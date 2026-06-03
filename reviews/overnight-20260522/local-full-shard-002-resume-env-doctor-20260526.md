# Local-Full Shard Resume Environment Doctor

- Status: BLOCKED_LOCAL_FULL_SHARD_RESUME_ENV
- Fixture only: false
- Target shard: shard-002 (25-50)
- Ready for missing-arm export: false
- Ready for missing-arm export except env: true
- Ready for answer-quality preflight: false
- Ready for local shard intake: false
- Ready for command materialization: false
- Private input files ready: true
- Completed private arm files ready: true
- Local resume execution env ready: false
- Resume packet commands runnable as printed: false
- Private directory provided: true
- Private directory present: true
- Private directory outside repository: true
- Raw-source retention contract ready: true
- Raw-source private audit ready: true
- Compressed default retrieval allowed: true
- Local embedding durability report ready: true
- Local embedding durability long probe ready: true
- Local embedding durability fresher than runtime blocker: true
- Local embedding env ready: false
- Local rerank env ready: false
- Local safety env ready: false
- Answer-quality env ready: false
- Counts as local-full benchmark evidence: false

## Missing Environment Names
- SELFMEM_LOCAL_EMBED_BASE_URL
- SELFMEM_LOCAL_EMBED_MODEL
- SELFMEM_LOCAL_EMBED_BATCH_MAX_TOKENS
- SELFMEM_LOCAL_RERANK_BASE_URL
- SELFMEM_LOCAL_RERANK_MODEL
- SELFMEM_LOCAL_RERANK_CANDIDATE_LIMIT
- RECALLWEAVE_BASELINE_LIVE
- RECALLWEAVE_BASELINE_NO_RAW_TEXT
- RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY
- RECALLWEAVE_MEMORYBENCH_BASE_URL
- RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL
- RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL
- RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS
- RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA
- RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT

## Private Inputs
- Ready: true
- queryset: present=true; hashKind=collector-compatible-queryset; hashMatched=true
- memories: present=true; hashKind=file-sha256; hashMatched=null
- answer-labels: present=true; hashKind=embedded-answer-labels; hashMatched=true

## Raw Source Retention
- Contract ready: true
- Public report safe: true
- Ready for private audit: true
- Compressed default retrieval allowed: true
- Required private audit roles: raw-dataset, selected-raw-rows, source-manifest
- raw-dataset: present=true; hashMatched=true
- selected-raw-rows: present=true; hashMatched=true
- source-manifest: present=true; hashMatched=true

## Local Embedding Durability
- Report ready: true
- Ready for local-full resume: true
- Long probe ready: true
- Generated after runtime blocker: true
- Minimum required token count: 700
- Maximum probe token count: 700
- Probe count: 4
- Failed probe classes: none

## Completed Arm Files
- Ready: true
- bm25-lite: present=true; hashMatched=true
- full-hybrid-rerank: present=true; hashMatched=true
- query-expanded-full-hybrid-rerank: present=true; hashMatched=true

## Missing Arm Files
- local-apple-qwen3-0_6b: present=false
- local-apple-qwen3-0_6b-local-rerank: present=false

## Command Materialization
- Template placeholders present: true
- Commands runnable as printed: false
- Required placeholders ready: false
- Unresolved required placeholders: local-answer-model, local-embedding-base-url, local-embedding-model, local-judge-model, local-rerank-base-url, local-rerank-candidate-limit, local-rerank-model, openai-compatible-base-url, safe-local-embedding-batch-token-limit
- Optional placeholders requiring operator choice: 1-when-cloud-query-expansion-runs, env-only-if-cloud-endpoint, local-query-expansion-base-url-if-used, query-expansion-model-if-used
- Prints materialized commands: false

## Blockers
- local-embedding-env-missing
- local-rerank-env-missing
- local-safety-env-missing
- answer-quality-env-missing

## Next Actions
- Set the local embedding, local rerank, and safety environment variables for the two missing local Apple arms.
- Set local answer-quality endpoint and model environment variables before preflight/scoring.
- Regenerate this doctor before running the next resume packet command.
