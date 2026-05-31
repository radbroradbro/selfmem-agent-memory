# Provider Benchmark Live Preflight

Status: READY_FOR_LIVE_PROVIDER_BENCHMARK
Live run allowed: true
Calls provider APIs: false
Sends benchmark text to provider: false
Target hash: sha256:25292b75a9a11119a39103d26f368ec05491e188b97caf6df2575a11aa8331f7
Benchmark: longmemeval

## Strategies

- bm25-lite
- full-hybrid-rerank
- cloud-gemini2-embed-rerank-proxy
- cloud-voyage4-voyage-lite-rerank
- cloud-nvidia-nv-embed-v1-mistral-rerank

## Provider Readiness

- Provider calls enabled: true
- Public data confirmed: true
- gemini: present (GEMINI_API_KEY, GEMINI_API_KEYS, GOOGLE_API_KEY, GOOGLE_API_KEYS, AI_STUDIO_API_KEY, AI_STUDIO_API_KEYS, GEMINI_API_KEY_FILE, GEMINI_API_KEYS_FILE, GOOGLE_API_KEY_FILE, GOOGLE_API_KEYS_FILE, AI_STUDIO_API_KEY_FILE, AI_STUDIO_API_KEYS_FILE)
- nvidia: present (NVIDIA_API_KEY, NVIDIA_API_KEYS, NVAPI_KEY, NVAPI_KEYS, NVIDIA_API_KEY_FILE, NVIDIA_API_KEYS_FILE, NVAPI_KEY_FILE, NVAPI_KEYS_FILE)
- voyage: present (VOYAGE_API_KEY, VOYAGE_API_KEYS, VOYAGE_API_KEY_FILE, VOYAGE_API_KEYS_FILE)

## Blockers

- none

## Next Actions

- Run benchmark:public-provider with --live against the source-locked target.
- Keep reports metrics-only until MemoryBench answer-quality or another end-to-end memory score is run.

## Live Command Template

```bash
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
GEMINI_API_KEY=<env-only-gemini-key>
GEMINI_API_KEYS_FILE=<optional-private-gemini-key-file>
NVIDIA_API_KEY=<env-only-nvidia-key>
NVIDIA_API_KEYS_FILE=<optional-private-nvidia-key-file>
VOYAGE_API_KEY=<env-only-voyage-key>
VOYAGE_API_KEYS_FILE=<optional-private-voyage-key-file>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-gemini2-embed-rerank-proxy,cloud-voyage4-voyage-lite-rerank,cloud-nvidia-nv-embed-v1-mistral-rerank
```
