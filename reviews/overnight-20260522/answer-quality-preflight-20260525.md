# Answer-Quality Benchmark Preflight

- Status: BLOCKED_ANSWER_QUALITY_ENV
- Claim scope: full-sota
- Model match policy: exact-target-required
- Live answer-quality can run: false
- Ready for end-to-end memory score gate: false
- Calls provider APIs: false
- Sends benchmark text to provider: false
- Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c
- Target answer model: gpt-4o
- Target judge model: gpt-4o
- Query shard requested: false
- Query shard: n/a

## Readiness
- Env ready: false
- Private inputs ready: false
- Response arms ready: false
- Response arms cover selected shard: false
- Same-data hashes ready: false
- Answer model matches target: false
- Judge model matches target: false
- Scoring model policy satisfied: false
- Counts as local-full benchmark evidence: false

## Strategy Coverage
- BM25 lite: false
- Full hybrid rerank: false
- Provider or local challenger: false

## Blockers
- RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS-not-enabled
- RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA-not-confirmed
- RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT-not-confirmed
- answer-model-missing
- judge-model-missing
- openai-compatible-base-url-missing
- private-queryset-missing
- private-memories-missing
- private-answer-labels-missing
- response-arm-exports-missing
- bm25-lite-arm-missing
- full-hybrid-rerank-arm-missing
- provider-or-local-challenger-arm-missing

## Next Actions
- Materialize the source-locked target into an operator-private directory outside the repository.
- Export one private RecallWeave response file per strategy with baseline:export:recallweave.
- Set explicit answer-quality model-call, public-data, and no-raw-output consent flags before live scoring.
- Include bm25-lite, full-hybrid-rerank, and at least one provider or local challenger arm.

## Live Command Template
```bash
RECALLWEAVE_MEMORYBENCH_CLAIM_SCOPE=full-sota
RECALLWEAVE_MEMORYBENCH_MODEL_MATCH_POLICY=exact-target-required
RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1
RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1
RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1
RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>
RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>
RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=gpt-4o
RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=gpt-4o
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live --claim-scope full-sota --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --queryset <private-output-dir>/materialized/longmemeval-queryset.private.json --memories <private-output-dir>/materialized/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/materialized/longmemeval-answer-labels.private.json --arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json --arm <provider-or-local-arm>=<private-output-dir>/<provider-or-local-arm>-responses.private.json --output <public-answer-quality-output.json>
```
