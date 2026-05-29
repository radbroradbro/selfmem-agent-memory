# Local Embedding Runtime Doctor

- Status: READY_LOCAL_EMBEDDING_RUNTIME
- Strategy: local-apple-qwen3-0_6b
- Expected family: qwen3-embedding
- Config env path printed: false
- Private path printed: false
- Endpoint printed: false
- Ready for durability smoke: true
- Counts as local-full benchmark evidence: false

## Runtime
- Server binary configured: true
- Server binary present: true
- Server supports embedding flag: true
- Model configured: true
- Model present: false
- Model source: hf-repo
- HF repo configured: true
- Model size class: n/a
- Likely dedicated embedding model: true
- Likely vocab fixture: false
- Expected family matched: true
- Endpoint configured: true
- Endpoint local only: true
- Models endpoint reachable: true

## Blockers
- none

## Next Actions
- Run benchmark:local-embedding:durability -- --require-ready while the same local endpoint is alive.
- Run local-full response-arm export only after the durability smoke passes.
- Keep raw benchmark inputs and response files outside the repository.
