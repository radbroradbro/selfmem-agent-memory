# Local-Full Shard 017 Runtime Blocker

- Status: BLOCKED_LOCAL_FULL_SHARD_RUNTIME
- Shard: shard-017
- Query range: 400-425 of 500
- Completed response arms: 3
- Missing response arms: 2
- Counts as local-full benchmark evidence: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false

## Completed Arms

| Strategy | Responses | Provider calls | Private response hash |
| --- | ---: | ---: | --- |
| bm25-lite | 25 | 0 | sha256:6840b43ad7c912dfad4f1a941ba1b4f127a73e600b5ff6f01c021b6e08baf7f2 |
| full-hybrid-rerank | 25 | 0 | sha256:e265b5bfa1e17e50c9ceb12d83847559fcb4f49864fb0e10db2146f000b305a6 |
| query-expanded-full-hybrid-rerank | 25 | 0 | sha256:d7c4e35ea479b03eabc4146a27112d94cf7f684b6190e1f650e58f96cd1e7700 |

## Missing Arms

- local-apple-qwen3-0_6b
- local-apple-qwen3-0_6b-local-rerank

## Runtime Finding

The shard-017 embedding sidecar log reached local model-load initialization and
then stopped without a live process or completed local Apple arms. This should
be treated as a runtime interruption, not model-quality evidence.

## Next Actions

- Reuse the completed deterministic shard-017 arms.
- Restart local embedding and local rerank sidecars with conservative token and
  batch settings.
- Export only the missing local Apple and local-rerank shard-017 arms.
- Run shard-017 preflight, answer-quality scoring, intake, performance report,
  topic ledger, and SOTA doctor after the missing arms exist.
