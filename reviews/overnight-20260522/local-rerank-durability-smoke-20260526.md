# Local Rerank Durability Smoke

- Status: BLOCKED_LOCAL_RERANK_DURABILITY
- Fixture only: false
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Local endpoint configured: false
- Endpoint printed: false
- Raw synthetic input included: false
- Response body timeout bounded: true
- Ready for local rerank arm export: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false

## Probes
- documents=3, status=not-run, scoreCount=0, elapsedMs=0, failure=local-rerank-endpoint-missing
- documents=8, status=not-run, scoreCount=0, elapsedMs=0, failure=local-rerank-endpoint-missing
- documents=12, status=not-run, scoreCount=0, elapsedMs=0, failure=local-rerank-endpoint-missing

## Blockers
- local-rerank-endpoint-missing

## Next Actions
- Start the local rerank sidecar or endpoint and rerun this smoke before local-rerank arm export.
- If the endpoint accepts work but times out on these public synthetic probes, lower candidate count or fix the local sidecar before retrying the shard.
- Do not count partial local-full shard attempts as benchmark evidence until every required arm exports and scores.
