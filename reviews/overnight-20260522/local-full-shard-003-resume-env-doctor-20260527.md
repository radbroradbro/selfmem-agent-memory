# Local-Full Shard Resume Environment Doctor

- Status: BLOCKED_LOCAL_FULL_SHARD_RESUME_ENV
- Fixture only: false
- Target shard: shard-003 (50-75)
- Ready for missing-arm export: true
- Ready for missing-arm export except env: true
- Ready for answer-quality preflight: false
- Ready for local shard intake: false
- Ready for command materialization: false
- Private input files ready: true
- Completed private arm files ready: true
- Local resume execution env ready: true
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
- Local embedding env ready: true
- Local rerank env ready: true
- Local safety env ready: true
- Answer-quality env ready: false
- Counts as local-full benchmark evidence: false

## Missing Environment Names
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
- local-apple-qwen3-0_6b: present=true; hashMatched=true

## Missing Arm Files
- local-apple-qwen3-0_6b-local-rerank: present=true

## Command Materialization
- Template placeholders present: true
- Commands runnable as printed: false
- Required placeholders ready: false
- Unresolved required placeholders: local-answer-model, local-judge-model, openai-compatible-base-url
- Optional placeholders requiring operator choice: 1-when-cloud-query-expansion-runs, env-only-if-cloud-endpoint, local-query-expansion-base-url-if-used, query-expansion-model-if-used
- Prints materialized commands: false

## Blockers
- answer-quality-env-missing

## Next Actions
- Set local answer-quality endpoint and model environment variables before preflight/scoring.
- Regenerate this doctor before running the next resume packet command.
