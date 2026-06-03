# Provider Benchmark Live Preflight

Status: READY_FOR_LIVE_PROVIDER_BENCHMARK
Live run allowed: true
Calls provider APIs: false
Sends benchmark text to provider: false
Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c
Benchmark: longmemeval

## Strategies

- cloud-voyage4-voyage
- cloud-nvidia-nemotron-1b

## Provider Readiness

- Provider calls enabled: true
- Public data confirmed: true
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
NVIDIA_API_KEY=<env-only-nvidia-key>
NVIDIA_API_KEYS_FILE=<optional-private-nvidia-key-file>
VOYAGE_API_KEY=<env-only-voyage-key>
VOYAGE_API_KEYS_FILE=<optional-private-voyage-key-file>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies cloud-voyage4-voyage,cloud-nvidia-nemotron-1b
```
