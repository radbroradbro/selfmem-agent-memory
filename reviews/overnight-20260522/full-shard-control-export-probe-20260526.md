# Full-Shard Control Export Probe

- Status: READY_FULL_SHARD_CONTROL_EXPORT_PROBE
- Shard: shard-001 (0-25)
- Calls provider APIs: false
- Sends benchmark text to provider: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Private response file committed: false
- Query expansion mode: deterministic-proxy
- All response counts match: true
- All provider calls zero: true
- All private files outside repo: true
- All private files mode 0600: true
- All privacy checks clean: true

## Arms
- bm25-lite: responses=25, candidates=19195, p50Ms=1061, wallSeconds=35, providerCalls=0, fileHash=sha256:2a82121f05e44ac4c6249c66c41a754ef85de940b63c5cb40c9d5e5ff6ea057a
- full-hybrid-rerank: responses=25, candidates=19195, p50Ms=3124, wallSeconds=226, providerCalls=0, fileHash=sha256:41f15b7460e746694024b1206376444c3736ab5b18d8f25b0b2ba2d935913de6
- query-expanded-full-hybrid-rerank: responses=25, candidates=19195, p50Ms=3139, wallSeconds=227, providerCalls=0, fileHash=sha256:27d513c2b3dedca72c34e43585e1222969551f3b0ff039b4eda70c3f2a5e3798

## Next Actions
- Run the provider and live local-model shard arms after endpoints and explicit public-data consent are configured.
- Run answer-quality preflight only after every required private response arm exists for the selected shard.
- Keep this control probe separate from SOTA evidence; it proves runnable same-shard controls, not answer-quality superiority.
