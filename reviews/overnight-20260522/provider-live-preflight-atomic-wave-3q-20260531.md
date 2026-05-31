# Provider Benchmark Live Preflight

Status: READY_FOR_LIVE_PROVIDER_BENCHMARK
Live run allowed: true
Calls provider APIs: false
Sends benchmark text to provider: false
Target hash: sha256:dcdd33ca5a4ad3154dc3cf0da74c10fc96a1864e8f8b6ce154aff5386bdfc23e
Benchmark: longmemeval

## Strategies

- bm25-lite
- full-hybrid-rerank
- cloud-voyage4-lite-voyage-lite
- cloud-gemini2-voyage-rerank
- cloud-nvidia-nv-embed-v1-mistral-rerank

## Provider Readiness

- Provider calls enabled: true
- Public data confirmed: true
- gemini: present (GEMINI_API_KEY, GEMINI_API_KEYS, GOOGLE_API_KEY, GOOGLE_API_KEYS, AI_STUDIO_API_KEY, AI_STUDIO_API_KEYS, GEMINI_API_KEY_FILE, GEMINI_API_KEYS_FILE, GOOGLE_API_KEY_FILE, GOOGLE_API_KEYS_FILE, AI_STUDIO_API_KEY_FILE, AI_STUDIO_API_KEYS_FILE)
- nvidia: present (NVIDIA_API_KEY, NVIDIA_API_KEYS, NVAPI_KEY, NVAPI_KEYS, NVIDIA_API_KEY_FILE, NVIDIA_API_KEYS_FILE, NVAPI_KEY_FILE, NVAPI_KEYS_FILE)
- voyage: present (VOYAGE_API_KEY, VOYAGE_API_KEYS, VOYAGE_API_KEY_FILE, VOYAGE_API_KEYS_FILE)

## Provider Execution Policy

- Throttle scope: key
- Key-scoped throttle enabled: true
- Retry attempts: 4
- Timeout ms: 60000
- Global min interval ms: 0
- gemini: minIntervalMs=700, keyCount=6
- nvidia: minIntervalMs=1750, keyCount=1
- voyage: minIntervalMs=0, keyCount=8

## Provider Budget Contract

- Mode: no-spend-free-tier
- Max paid USD: 0
- Required providers: gemini, nvidia, voyage
- Required providers within allowed set: true
- Paid provider requested in no-spend mode: false
- Cross-provider fallback enabled: false
- Cache provider outputs before full wave: true

## Blockers

- none

## Next Actions

- Run benchmark:public-provider with --live against the source-locked target.
- Keep reports metrics-only until MemoryBench answer-quality or another end-to-end memory score is run.

## Live Command Template

```bash
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
RECALLWEAVE_PROVIDER_THROTTLE_SCOPE=key
RECALLWEAVE_PROVIDER_MIN_INTERVAL_MS=<optional-provider-or-key-paced-ms>
GEMINI_API_KEY=<env-only-gemini-key>
GEMINI_API_KEYS_FILE=<optional-private-gemini-key-file>
NVIDIA_API_KEY=<env-only-nvidia-key>
NVIDIA_API_KEYS_FILE=<optional-private-nvidia-key-file>
VOYAGE_API_KEY=<env-only-voyage-key>
VOYAGE_API_KEYS_FILE=<optional-private-voyage-key-file>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-lite-voyage-lite,cloud-gemini2-voyage-rerank,cloud-nvidia-nv-embed-v1-mistral-rerank
```
