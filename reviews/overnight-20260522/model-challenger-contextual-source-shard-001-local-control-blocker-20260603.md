# Model-Challenger Shard 001 Local-Control Blocker

- Status: `BLOCKED_LOCAL_APPLE_AND_LOCAL_RERANK_CONTROLS`
- Scope: model-challenger diagnostic evidence only; not full-SOTA evidence and not public benchmark claim evidence
- Target: `LongMemEval`, `contextual-source-chunk-v1`, `shard-001`
- Query window: `0..25`, selected query count `25`
- Selected query hash: `sha256:60f0e92d1e889c0f664043750e1e30dbe6e52aa1d5bc10fe1006bf4f82869472`

Completed evidence:

- Seven-arm export: `answer-quality-model-challenger-contextual-source-shard-001-arm-export-with-dense-20260603.json`
- Seven-arm preflight: `answer-quality-model-challenger-contextual-source-preflight-shard-001-with-dense-20260603.json`
- Seven-arm answer-quality score: `answer-quality-model-challenger-contextual-source-shard-001-with-dense-deepseek-v4-flash-20260603.json`
- Seven-arm result gate: `memory-score-model-challenger-contextual-source-shard-001-with-dense-deepseek-v4-flash-result-gate-20260603.json`
- Scorer: direct DeepSeek API, `deepseek-v4-flash` answer and judge model, `350` answer-quality calls, `0` answer failures, `0` judge failures

Current shard scores:

- `bm25-lite`: `34`
- `dense-proxy`: `20`
- `cloud-voyage4-voyage-lite-rerank`: `42`
- `cloud-nvidia-nv-embed-v1-mistral-rerank`: `33.2`

The model-challenger result gate now has dense/vector control coverage, but it still blocks on `missing-local-apple-arm` and `missing-local-rerank-arm`. No local embedding or local rerank endpoint was configured or observed in the current shell/process state. Next action is to start or locate those local sidecars, export `local-apple-qwen3-0_6b` and `local-apple-qwen3-0_6b-local-rerank` on this same shard, then rerun preflight, DeepSeek direct scoring, and the result gate. Do not make public SOTA or reported-score claims from this partial packet.
