# Provider Wave Intake

- Status: READY_PROVIDER_WAVE_INTAKE
- Reports: 13
- Completed reports: 3
- Partial reports: 10
- Public benchmark claims allowed: false
- Counts as full memory SOTA evidence: false
- Sends benchmark text to provider: true

## Controls
- All waves include BM25: true
- All waves include full hybrid: true

## Providers
- gemini: completed=3, failed=6, queries=8, calls=20, docsSent=118, best=cloud-gemini2-embed-rerank-proxy:0.1575, failures=provider-rate-limit, provider-timeout, strategy-arm-failed
- nvidia: completed=6, failed=4, queries=10, calls=180, docsSent=1452, best=cloud-nvidia-nv-embed-v1-mistral-rerank:0.1575, failures=provider-timeout, strategy-arm-failed
- voyage: completed=1, failed=5, queries=5, calls=20, docsSent=225, best=cloud-voyage4-voyage-lite-rerank:0, failures=provider-rate-limit

## Blockers
- retryable-provider-limit-or-timeout-observed

## Next Actions
- Retry voyage, gemini, nvidia with provider-specific slices, capped dense/rerank candidates, and explicit provider arm timeout.
- Keep these provider waves separate from answer-quality and full-SOTA evidence until response arms are scored by the accepted answer-quality shard ladder.
