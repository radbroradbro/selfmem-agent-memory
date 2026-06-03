# Local Embedding Durability Smoke

- Status: BLOCKED_LOCAL_EMBEDDING_DURABILITY
- Strategy: local-apple-qwen3-4b
- Local endpoint configured: true
- Base URL printed: false
- Raw synthetic input included: false
- Ready for local Apple arm export: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false

## Probes
- tokens=16, status=pass, dims=2560, elapsedMs=148, failure=none
- tokens=128, status=blocked, dims=n/a, elapsedMs=358, failure=local-embedding-fetch-failed
- tokens=512, status=blocked, dims=n/a, elapsedMs=1, failure=local-embedding-fetch-failed
- tokens=700, status=blocked, dims=n/a, elapsedMs=1, failure=local-embedding-fetch-failed

## Blockers
- local-embedding-fetch-failed

## Next Actions
- Start the local OpenAI-compatible embedding endpoint and rerun this smoke before local Apple arm export.
- If the endpoint closes sockets on public synthetic probes, fix the local runtime before retrying shard 002.
- Do not count partial local-full shard attempts as benchmark evidence until every required arm exports.
