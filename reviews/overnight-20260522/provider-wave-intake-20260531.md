# Provider Wave Intake

- Status: READY_PROVIDER_WAVE_INTAKE
- Reports: 15
- Completed reports: 5
- Partial reports: 10
- Public benchmark claims allowed: false
- Counts as full memory SOTA evidence: false
- Sends benchmark text to provider: true

## Controls
- All waves include BM25: true
- All waves include full hybrid: true

## Provider Hybrid Contract
- BM25 lexical floor required: true
- Full hybrid control required: true
- Same-data controls required: true
- Provider challengers are hybrid context arms: true
- Provider-only dense claims allowed: false
- All provider waves meet hybrid control contract: true
- Answer quality still required for memory claims: true

## Providers
- gemini: completed=3, failed=6, queries=8, calls=20, docsSent=118, best=cloud-gemini2-embed-rerank-proxy:0.1575, failures=provider-rate-limit, provider-timeout, strategy-arm-failed
- nvidia: completed=8, failed=4, queries=12, calls=186, docsSent=1500, best=cloud-nvidia-nv-embed-v1-mistral-rerank:0.1575, failures=provider-timeout, strategy-arm-failed
- voyage: completed=1, failed=5, queries=5, calls=20, docsSent=225, best=cloud-voyage4-voyage-lite-rerank:0, failures=provider-rate-limit

## Next Run Plan
- Status: READY_PROVIDER_REPAIR_WAVES
- Recommended execution: single-provider-single-slice
- Avoid concurrent provider arms: true
- nvidia: priority=high-free-lane, waveSize=1, best=cloud-nvidia-nv-embed-v1-mistral-rerank:0.1575, NVIDIA is the best zero-dollar repair lane so far: completed=8, failed=4; prefer tiny single-slice retries with a strict per-key pace.
- gemini: priority=medium-rate-limit-repair, waveSize=2, best=cloud-gemini2-embed-rerank-proxy:0.1575, Gemini has completed canaries but still shows timeout/rate-limit pressure: completed=3, failed=6; keep candidate pools capped.
- voyage: priority=medium-rate-limit-repair, waveSize=2, best=cloud-voyage4-voyage-lite-rerank:0, Voyage remains the personal/prod default, but the provider-wave evidence shows rate limits: completed=1, failed=5; retry in smaller waves before using it for same-data answer quality.

## Repair Slices
- q87-88: maxQueries=1, missing=nvidia, gemini, voyage, strategies=cloud-nvidia-nv-embed-v1-mistral-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q88-89: maxQueries=1, missing=nvidia, gemini, voyage, strategies=cloud-nvidia-nv-embed-v1-mistral-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q89-90: maxQueries=1, missing=nvidia, gemini, voyage, strategies=cloud-nvidia-nv-embed-v1-mistral-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q50-51: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q51-52: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q52-53: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank

## Blockers
- retryable-provider-limit-or-timeout-observed

## Next Actions
- Retry voyage, gemini, nvidia with provider-specific slices, capped dense/rerank candidates, and explicit provider arm timeout.
- Keep these provider waves separate from answer-quality and full-SOTA evidence until response arms are scored by the accepted answer-quality shard ladder.
