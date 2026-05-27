# Answer-Quality Benchmark Preflight

- Status: BLOCKED_ANSWER_QUALITY_ENV
- Claim scope: local-full
- Model match policy: local-diagnostic-allowed
- Live answer-quality can run: false
- Ready for end-to-end memory score gate: false
- Calls provider APIs: false
- Sends benchmark text to provider: false
- Target hash: sha256:dcdd33ca5a4ad3154dc3cf0da74c10fc96a1864e8f8b6ce154aff5386bdfc23e
- Target answer model: gpt-4o
- Target judge model: gpt-4o
- Query shard requested: true
- Query shard: 50-75

## Readiness
- Env ready: false
- Private inputs ready: true
- Response arms ready: true
- Response arms cover selected shard: true
- Same-data hashes ready: true
- Answer model matches target: false
- Judge model matches target: false
- Scoring model policy satisfied: false
- Counts as local-full benchmark evidence: false

## Strategy Coverage
- BM25 lite: true
- Full hybrid rerank: true
- Provider or local challenger: true

## Blockers
- RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled
- RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed
- RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed
- answer-model-missing
- judge-model-missing
- openai-compatible-base-url-missing

## Next Actions
- Materialize the source-locked target into an operator-private directory outside the repository.
- Export one private RecallWeave response file per strategy with baseline:export:recallweave.
- Set explicit answer-quality model-call, public-data, and no-raw-output consent flags before live scoring.
- Include bm25-lite, full-hybrid-rerank, and at least one provider or local challenger arm.

## Live Command Template
```bash
RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=local-full
RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=local-diagnostic-allowed
RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1
RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1
RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1
RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>
RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>
RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<local-answer-model>
RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<local-judge-model>
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live --claim-scope local-full --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --queryset <private-output-dir>/materialized/longmemeval-queryset.private.json --memories <private-output-dir>/materialized/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/materialized/longmemeval-answer-labels.private.json --query-offset 50 --max-queries 25 --arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json --arm <provider-or-local-arm>=<private-output-dir>/<provider-or-local-arm>-responses.private.json --output <public-answer-quality-output.json>
```
