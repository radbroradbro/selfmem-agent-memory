# Model-Challenger Route And Local Runtime Blocker

- Status: `BLOCKED_ON_LOCAL_RUNTIME_ONLY`
- Claim scope: `model-challenger`
- Shard: `shard-001`, 25 source-locked contextual-source queries
- Public safe: yes
- Secrets included: no
- Private paths included: no

## Corrected Provider Route

- Answer-quality scorer: direct DeepSeek
- Base URL: `https://api.deepseek.com`
- Answer model: `deepseek-v4-flash`
- Judge model: `deepseek-v4-flash`
- API key source: private key file
- API key file present: true
- OpenRouter used for answer-quality scoring: false

OpenRouter is not the scorer route for this model-challenger result. The scorer route is direct DeepSeek.

## Latest Scored Result

- Result: `reviews/overnight-20260522/answer-quality-model-challenger-contextual-source-shard-001-with-dense-deepseek-v4-flash-20260603.json`
- Calls completed: 350
- Call failures: 0
- Arms scored: 7
- Best arm: `cloud-voyage4-voyage-lite-rerank`
- Best answer-quality score: 42
- BM25 answer-quality score: 34
- Dense-proxy answer-quality score: 20

## Gate Blocker

The model-challenger end-to-end memory score gate remains blocked by:

- `missing-local-apple-arm`
- `missing-local-rerank-arm`

It is not blocked by OpenRouter scorer routing, direct DeepSeek key availability, or the dense control.

## Local Runtime Evidence

- Local embedding runtime doctor: `BLOCKED_LOCAL_EMBEDDING_RUNTIME`
- Local Apple arm ready for export: false
- Local rerank durability smoke: `BLOCKED_LOCAL_RERANK_DURABILITY`
- Local rerank arm ready for export: false
- Expected local endpoint ports listening: false
- Dedicated Qwen embedding/rerank GGUF found by narrow search: false
- llama.cpp server binary found by narrow search: true

## Next Action

Provision or point `SELFMEM_LOCAL_EMBED_*` and `SELFMEM_LOCAL_RERANK_*` at dedicated local embedding/rerank endpoints, then export only the two missing local arms and rerun the same direct-DeepSeek score gate.

Do not reroute answer-quality scoring through OpenRouter. Do not spend another loop on BM25-only benchmarking.
