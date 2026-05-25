# Answer-Quality Benchmark Preflight

- Status: READY_FOR_LIVE_ANSWER_QUALITY
- Live answer-quality can run: true
- Ready for end-to-end memory score gate: true
- Calls provider APIs: false
- Sends benchmark text to provider: false
- Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c

## Readiness
- Env ready: true
- Private inputs ready: true
- Response arms ready: true
- Same-data hashes ready: true

## Strategy Coverage
- BM25 lite: true
- Full hybrid rerank: true
- Provider or local challenger: true

## Blockers
- none

## Next Actions
- Run benchmark:answer-quality with --live against the private materialized inputs and response arm exports.
- Attach the metrics-only result to benchmark:memory-score:result-gate --require-ready.
- Send the metrics-only packet to independent reviewers before public benchmark wording changes.

## Live Command Template
```bash
RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1
RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1
RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1
RECALLWEAVE_MEMORYBENCH_BASE_URL=<openai-compatible-base-url>
RECALLWEAVE_MEMORYBENCH_API_KEY=<env-only-if-cloud-endpoint>
RECALLWEAVE_MEMORYBENCH_ANSWER_MODEL=<answer-model>
RECALLWEAVE_MEMORYBENCH_JUDGE_MODEL=<judge-model>
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --queryset <private-output-dir>/materialized/longmemeval-queryset.private.json --memories <private-output-dir>/materialized/longmemeval-memories.private.jsonl --answer-labels <private-output-dir>/materialized/longmemeval-answer-labels.private.json --arm bm25-lite=<private-output-dir>/bm25-lite-responses.private.json --arm full-hybrid-rerank=<private-output-dir>/full-hybrid-rerank-responses.private.json --arm <provider-or-local-arm>=<private-output-dir>/<provider-or-local-arm>-responses.private.json --output <public-answer-quality-output.json>
```
