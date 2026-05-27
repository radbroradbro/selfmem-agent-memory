# Local Rerank Durability Smoke

- Status: READY_LOCAL_RERANK_DURABILITY
- Fixture only: false
- Strategy: local-apple-qwen3-0_6b-local-rerank
- Local endpoint configured: true
- Endpoint printed: false
- Raw synthetic input included: false
- Response body timeout bounded: true
- Ready for local rerank arm export: true
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false

## Probes
- documents=3, status=pass, scoreCount=3, elapsedMs=215, failure=none
- documents=8, status=pass, scoreCount=8, elapsedMs=593, failure=none
- documents=12, status=pass, scoreCount=12, elapsedMs=816, failure=none

## Blockers
- none

## Next Actions
- Use this report as the local rerank response-body completion guard before missing-arm export.
- Run the local-full shard retry with the same local rerank sidecar still alive.
- Keep raw benchmark inputs and response files outside the repository.
