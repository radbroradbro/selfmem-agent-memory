# Provider Benchmark Live Preflight

Status: BLOCKED_PROVIDER_ENV
Live run allowed: false
Calls provider APIs: false
Sends benchmark text to provider: false
Target hash: sha256:ff2d46f0d29aa8cb4345848c6c07c6af7f74365b72698872aaf6239bff5cdef4
Benchmark: longmemeval
Memory method: session-v1
Materialization contract: ok

## Strategies

- bm25-lite
- full-hybrid-rerank
- cloud-voyage-rerank-only
- cloud-voyage4-voyage
- cloud-gemini-embed-rerank-proxy
- cloud-gemini-voyage-rerank
- cloud-gemini2-embed-rerank-proxy
- cloud-gemini2-voyage-rerank
- cloud-nvidia-nv-embed-v1-mistral-rerank
- cloud-nvidia-embedcode-7b-mistral-rerank
- local-apple-qwen3-0_6b

## Provider Readiness

- Provider calls enabled: false
- Public data confirmed: false
- gemini: missing (GEMINI_API_KEY, GEMINI_API_KEYS, GOOGLE_API_KEY, GOOGLE_API_KEYS, AI_STUDIO_API_KEY, AI_STUDIO_API_KEYS, GEMINI_API_KEY_FILE, GEMINI_API_KEYS_FILE, GOOGLE_API_KEY_FILE, GOOGLE_API_KEYS_FILE, AI_STUDIO_API_KEY_FILE, AI_STUDIO_API_KEYS_FILE)
- local-apple: missing (SELFMEM_LOCAL_EMBED_BASE_URL)
- nvidia: missing (NVIDIA_API_KEY, NVIDIA_API_KEYS, NVAPI_KEY, NVAPI_KEYS, NVIDIA_API_KEY_FILE, NVIDIA_API_KEYS_FILE, NVAPI_KEY_FILE, NVAPI_KEYS_FILE)
- voyage: missing (VOYAGE_API_KEY, VOYAGE_API_KEYS, VOYAGE_API_KEY_FILE, VOYAGE_API_KEYS_FILE)

## Provider Execution Policy

- Throttle scope: provider
- Key-scoped throttle enabled: false
- Retry attempts: 4
- Timeout ms: 60000
- Global min interval ms: 0
- gemini: minIntervalMs=0, keyCount=0
- local-apple: minIntervalMs=0, keyCount=0
- nvidia: minIntervalMs=0, keyCount=0
- voyage: minIntervalMs=0, keyCount=0

## Provider Budget Contract

- Mode: no-spend-free-tier
- Max paid USD: 0
- Required providers: gemini, local-apple, nvidia, voyage
- Required providers within allowed set: true
- Paid provider requested in no-spend mode: false
- Cross-provider fallback enabled: false
- Cache provider outputs before full wave: true

## Blockers

- RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled
- RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed
- gemini-credentials-missing
- local-apple-credentials-missing
- nvidia-credentials-missing
- voyage-credentials-missing

## Next Actions

- Set provider credentials only in the shell environment, never in committed files.
- Set RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 and RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 only for public benchmark slices.
- Re-run this preflight before spending provider calls.

## Live Command Template

```bash
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
RECALLWEAVE_PROVIDER_THROTTLE_SCOPE=key
RECALLWEAVE_PROVIDER_MIN_INTERVAL_MS=<optional-provider-or-key-paced-ms>
GEMINI_API_KEY=<env-only-gemini-key>
GEMINI_API_KEYS_FILE=<optional-private-gemini-key-file>
SELFMEM_LOCAL_EMBED_BASE_URL=<env-only-local-apple-server-url>
NVIDIA_API_KEY=<env-only-nvidia-key>
NVIDIA_API_KEYS_FILE=<optional-private-nvidia-key-file>
VOYAGE_API_KEY=<env-only-voyage-key>
VOYAGE_API_KEYS_FILE=<optional-private-voyage-key-file>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage-rerank-only,cloud-voyage4-voyage,cloud-gemini-embed-rerank-proxy,cloud-gemini-voyage-rerank,cloud-gemini2-embed-rerank-proxy,cloud-gemini2-voyage-rerank,cloud-nvidia-nv-embed-v1-mistral-rerank,cloud-nvidia-embedcode-7b-mistral-rerank,local-apple-qwen3-0_6b
```
