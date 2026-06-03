# Local Embedding Launch Diagnostic

- Status: BLOCKED_LOCAL_EMBEDDING_LAUNCH
- Fixture only: false
- Public safe: true
- Attempt count: 2
- Launch recovered: false
- Ready for shard 002 resume: false
- Counts as local-full benchmark evidence: false

## Attempts
- first: local-embedding-launch-exited-during-model-load; last phase tensor-load-started; lines 150; raw log printed false
- cpu: local-embedding-launch-exited-during-model-load; last phase model-metadata-loaded; lines 61; raw log printed false

## Blockers
- local-embedding-launch-exited-before-endpoint-ready

## Next Actions
- Free local memory pressure or stop stale model/browser processes before relaunching the embedding endpoint.
- Relaunch the dedicated Qwen3 Embedding 0.6B GGUF endpoint and wait for /v1/models readiness.
- Rerun the runtime doctor and durability smoke before shard-002 missing-arm export.
