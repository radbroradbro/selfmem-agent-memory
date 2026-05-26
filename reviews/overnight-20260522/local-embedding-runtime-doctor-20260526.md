# Local Embedding Runtime Doctor

- Status: BLOCKED_LOCAL_EMBEDDING_RUNTIME
- Strategy: local-apple-qwen3-0_6b
- Expected family: qwen3-embedding
- Config env path printed: false
- Private path printed: false
- Endpoint printed: false
- Ready for durability smoke: false
- Counts as local-full benchmark evidence: false

## Runtime
- Server binary configured: true
- Server binary present: true
- Server supports embedding flag: true
- Model configured: true
- Model present: true
- Model size class: large
- Likely dedicated embedding model: false
- Likely vocab fixture: false
- Expected family matched: false
- Endpoint configured: true
- Endpoint local only: true
- Models endpoint reachable: false

## Blockers
- local-embedding-runtime-not-ready
- local-embedding-model-not-dedicated-embedding
- local-embedding-model-family-mismatch
- local-embedding-endpoint-not-reachable
- local-embedding-models-endpoint-fetch-failed

## Next Actions
- Fix or start the local OpenAI-compatible embedding endpoint.
- Do not reuse a chat/generation model selection as the embedding runtime.
- Provision a dedicated local embedding GGUF checkpoint for the local Apple arm.
- Start llama.cpp in embedding mode against that checkpoint before retrying shard 002.
- Rerun this runtime doctor, then the durability smoke, before local-full response-arm export.
