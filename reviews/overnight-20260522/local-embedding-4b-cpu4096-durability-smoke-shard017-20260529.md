# Local Embedding Durability Smoke

- Status: READY_LOCAL_EMBEDDING_DURABILITY
- Strategy: local-apple-qwen3-4b
- Local endpoint configured: true
- Base URL printed: false
- Raw synthetic input included: false
- Ready for local Apple arm export: true
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false

## Probes
- tokens=16, status=pass, dims=2560, elapsedMs=885, failure=none
- tokens=128, status=pass, dims=2560, elapsedMs=4912, failure=none
- tokens=512, status=pass, dims=2560, elapsedMs=22525, failure=none
- tokens=700, status=pass, dims=2560, elapsedMs=15454, failure=none

## Blockers
- none

## Next Actions
- Use this report as the local Apple embedding preflight before response-arm export.
- Run the local-full answer-quality shard export with the same local embedding server still alive.
- Keep raw benchmark inputs and response files outside the repository.
