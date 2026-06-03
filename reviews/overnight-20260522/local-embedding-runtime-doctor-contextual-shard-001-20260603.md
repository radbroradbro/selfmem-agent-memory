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
- Server binary configured: false
- Server binary present: false
- Server supports embedding flag: false
- Model configured: false
- Model present: false
- Model source: missing
- HF repo configured: false
- Model size class: n/a
- Likely dedicated embedding model: false
- Likely vocab fixture: false
- Expected family matched: false
- Endpoint configured: false
- Endpoint local only: false
- Models endpoint reachable: false

## Blockers
- local-embedding-runtime-not-ready
- local-embedding-server-bin-missing
- local-embedding-model-path-missing
- local-embedding-endpoint-missing

## Next Actions
- Provision a dedicated local embedding GGUF checkpoint for the local Apple arm.
- Start llama.cpp in embedding mode against that checkpoint before retrying shard 002.
- Rerun this runtime doctor, then the durability smoke, before local-full response-arm export.
