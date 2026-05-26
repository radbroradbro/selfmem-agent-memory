# Local-Full Shard Resume Environment Doctor

- Status: BLOCKED_LOCAL_FULL_SHARD_RESUME_ENV
- Target shard: shard-002 (25-50)
- Ready for missing-arm export: false
- Ready for answer-quality preflight: false
- Ready for local shard intake: false
- Private directory provided: false
- Private directory present: false
- Private directory outside repository: false
- Local embedding env ready: false
- Local rerank env ready: false
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
- queryset: present=false; hashMatched=false
- memories: present=false; hashMatched=null
- answer-labels: present=false; hashMatched=false

## Completed Arm Files
- bm25-lite: present=false; hashMatched=false
- full-hybrid-rerank: present=false; hashMatched=false
- query-expanded-full-hybrid-rerank: present=false; hashMatched=false

## Missing Arm Files
- local-apple-qwen3-0_6b: present=false
- local-apple-qwen3-0_6b-local-rerank: present=false

## Blockers
- private-dir-not-provided
- required-private-input-files-missing
- completed-private-arm-files-missing
- local-embedding-env-missing
- local-rerank-env-missing
- local-safety-env-missing
- answer-quality-env-missing

## Next Actions
- Provide RECALLWEAVE_FULL_SHARD_PRIVATE_DIR or --private-input-dir for the outside-repository private materialization directory.
- Set the local embedding and local rerank environment variables for the two missing local Apple arms.
- Set local answer-quality endpoint and model environment variables before preflight/scoring.
- Regenerate this doctor before running the resume packet commands.
