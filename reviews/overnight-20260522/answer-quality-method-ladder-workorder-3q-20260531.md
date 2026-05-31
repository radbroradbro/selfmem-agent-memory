# Answer-Quality Memory Method Ladder

- Execute requested: false
- Ready for execution: false
- Claim scope: local-full
- Model match policy: local-diagnostic-allowed
- Query shard: 0 to 3
- Same raw query selection: true
- Claim boundary: answer-quality method-ladder workorder only; response arms are exported but no model-scored answer-quality calls were made

## Readiness

- Endpoint present: false
- Endpoint local: false
- Answer model present: false
- Judge model present: false
- Blockers: answer-quality-call-consent-missing, public-data-consent-missing, no-raw-output-guard-missing, openai-compatible-base-url-missing, answer-model-missing, judge-model-missing

## Materialization

| Method | Queries | Sessions | Records | Source chunks | Index records | Expected refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| session-v1 | 3 | 146 | 146 | 0 | 0 | 12 |
| contextual-source-chunk-v1 | 3 | 146 | 1064 | 1064 | 0 | 61 |
| contextual-index-source-chunk-v1 | 3 | 146 | 2128 | 1064 | 1064 | 61 |

## Response Arms

| Method | Strategy | Responses | Skipped source-only | Result IDs | Provider calls |
| --- | --- | ---: | ---: | --- | ---: |
| session-v1 | bm25-lite | 3 | 0 | session-or-memory | 0 |
| session-v1 | full-hybrid-rerank | 3 | 0 | session-or-memory | 0 |
| contextual-source-chunk-v1 | bm25-lite | 3 | 0 | source-chunk-or-mixed | 0 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 3 | 0 | source-chunk-or-mixed | 0 |
| contextual-index-source-chunk-v1 | bm25-lite | 3 | 1064 | source-chunk-or-mixed | 0 |
| contextual-index-source-chunk-v1 | full-hybrid-rerank | 3 | 1064 | source-chunk-or-mixed | 0 |

## Next Actions

- Start a local OpenAI-compatible answer/judge endpoint or provide an approved cloud endpoint through env-only secrets.
- Set RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1, RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1, and RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1.
- Re-run this command with --execute to score the exported same-shard arms.
