# Provider Wave Intake

- Status: READY_PROVIDER_WAVE_INTAKE
- Reports: 17
- Completed reports: 7
- Partial reports: 10
- Public benchmark claims allowed: false
- Counts as full memory SOTA evidence: false
- Sends benchmark text to provider: true

## Controls
- All waves include BM25: true
- All waves include full hybrid: true

## Provider Budget Contract
- Contract required for new provider waves: true
- Reports with budget contract: 0/17
- Reports missing budget contract: 17
- Budgeted reports no-spend: false
- Budgeted reports within allowed providers: true
- Paid provider requested in no-spend mode: false

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
- nvidia: completed=10, failed=4, queries=14, calls=192, docsSent=1548, best=cloud-nvidia-nv-embed-v1-mistral-rerank:0.1575, failures=provider-timeout, strategy-arm-failed
- voyage: completed=1, failed=5, queries=5, calls=20, docsSent=225, best=cloud-voyage4-voyage-lite-rerank:0, failures=provider-rate-limit

## Failure Taxonomy
- Required before promotion: true
- All failures classified: true
- Observed failures: 15
- Retryable provider-limit failures: 13
- Promotion blocked by retryable limits: true
- provider-rate-limit: count=7, retryable=7, providers=gemini, voyage, disposition=retry-as-separate-provider-arm-with-smaller-slice
- provider-timeout: count=6, retryable=6, providers=gemini, nvidia, disposition=retry-as-separate-provider-arm-with-smaller-slice
- strategy-arm-failed: count=2, retryable=0, providers=gemini, nvidia, disposition=investigate-before-promotion

## Latency Cost Quota Ledger
- Required before promotion: true
- Cost model: no-spend-ledger-from-provider-budget-contract-and-call-counts
- Estimated paid USD: unknown
- All reports have budget contract: false
- All budgeted reports no-spend: false
- Promotion ready: false
- gemini: calls=20, embed=20, rerank=0, docs=118, queries=8, p50=9246, p95=11706, keyCount=6, throttle=n/a, failures=provider-rate-limit, provider-timeout, strategy-arm-failed
- nvidia: calls=192, embed=128, rerank=64, docs=1548, queries=64, p50=17308.5, p95=17855.5, keyCount=1, throttle=1750, failures=provider-timeout, strategy-arm-failed
- voyage: calls=20, embed=15, rerank=5, docs=225, queries=5, p50=17651, p95=241069, keyCount=8, throttle=n/a, failures=provider-rate-limit

## Latency Cost Quota Promotion Blockers
- legacy-provider-waves-missing-budget-contract
- budgeted-provider-waves-not-all-no-spend

## Next Run Plan
- Status: READY_PROVIDER_REPAIR_WAVES
- Recommended execution: single-provider-single-slice
- Avoid concurrent provider arms: true
- nvidia: priority=high-free-lane, waveSize=1, best=cloud-nvidia-nv-embed-v1-mistral-rerank:0.1575, NVIDIA is the best zero-dollar repair lane so far: completed=10, failed=4; prefer tiny single-slice retries with a strict per-key pace.
- gemini: priority=medium-rate-limit-repair, waveSize=2, best=cloud-gemini2-embed-rerank-proxy:0.1575, Gemini has completed canaries but still shows timeout/rate-limit pressure: completed=3, failed=6; keep candidate pools capped.
- voyage: priority=medium-rate-limit-repair, waveSize=2, best=cloud-voyage4-voyage-lite-rerank:0, Voyage remains the personal/prod default, but the provider-wave evidence shows rate limits: completed=1, failed=5; retry in smaller waves before using it for same-data answer quality.

## Repair Slices
- q89-90: maxQueries=1, missing=nvidia, gemini, voyage, strategies=cloud-nvidia-nv-embed-v1-mistral-rerank, cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q50-51: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q51-52: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q52-53: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q53-54: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank
- q54-55: maxQueries=1, missing=gemini, voyage, strategies=cloud-gemini2-embed-rerank-proxy, cloud-voyage4-voyage-lite-rerank

## Blockers
- retryable-provider-limit-or-timeout-observed

## Next Actions
- Re-run legacy provider wave reports under the provider budget contract before using them for default promotion.
- Retry voyage, gemini, nvidia with provider-specific slices, capped dense/rerank candidates, and explicit provider arm timeout.
- Keep these provider waves separate from answer-quality and full-SOTA evidence until response arms are scored by the accepted answer-quality shard ladder.
