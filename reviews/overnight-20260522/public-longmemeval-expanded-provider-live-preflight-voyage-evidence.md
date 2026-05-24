# Provider Benchmark Live Preflight

Status: BLOCKED_PROVIDER_ENV
Live run allowed: false
Calls provider APIs: false
Sends benchmark text to provider: false
Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c
Benchmark: longmemeval

## Strategies

- bm25-lite
- full-hybrid-rerank
- cloud-voyage4-voyage

## Provider Readiness

- Provider calls enabled: false
- Public data confirmed: false
- voyage: missing (VOYAGE_API_KEY, VOYAGE_API_KEYS, VOYAGE_API_KEY_FILE, VOYAGE_API_KEYS_FILE)

## Blockers

- RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled
- RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed
- voyage-credentials-missing

## Next Actions

- Set provider credentials only in the shell environment, never in committed files.
- Set RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 and RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 only for public benchmark slices.
- Re-run this preflight before spending provider calls.

## Live Command Template

```bash
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
VOYAGE_API_KEY=<env-only-voyage-key>
VOYAGE_API_KEYS_FILE=<optional-private-voyage-key-file>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage
```
