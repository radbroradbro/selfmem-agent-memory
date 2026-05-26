# Local Embedding Durability Smoke

- Status: BLOCKED_LOCAL_EMBEDDING_DURABILITY
- Strategy: local-apple-qwen3-0_6b
- Local endpoint configured: false
- Base URL printed: false
- Raw synthetic input included: false
- Ready for local Apple arm export: false
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false

## Probes
- tokens=16, status=not-run, dims=n/a, elapsedMs=0, failure=local-embedding-base-url-missing
- tokens=128, status=not-run, dims=n/a, elapsedMs=0, failure=local-embedding-base-url-missing
- tokens=512, status=not-run, dims=n/a, elapsedMs=0, failure=local-embedding-base-url-missing
- tokens=700, status=not-run, dims=n/a, elapsedMs=0, failure=local-embedding-base-url-missing

## Blockers
- local-embedding-base-url-missing

## Next Actions
- Start the local OpenAI-compatible embedding endpoint and rerun this smoke before local Apple arm export.
- If the endpoint closes sockets on public synthetic probes, fix the local runtime before retrying shard 002.
- Do not count partial local-full shard attempts as benchmark evidence until every required arm exports.
