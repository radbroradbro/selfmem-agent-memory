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
- local-apple-qwen3-0_6b-local-rerank

## Provider Readiness

- Provider calls enabled: true
- Public data confirmed: true
- local-apple: present (SELFMEM_LOCAL_EMBED_BASE_URL)
- local-rerank: missing (SELFMEM_LOCAL_RERANK_ENDPOINT, SELFMEM_LOCAL_RERANK_BASE_URL)

## Blockers

- local-rerank-credentials-missing

## Next Actions

- Set provider credentials only in the shell environment, never in committed files.
- Set RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 and RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 only for public benchmark slices.
- Re-run this preflight before spending provider calls.

## Live Command Template

```bash
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
SELFMEM_LOCAL_EMBED_BASE_URL=<env-only-local-apple-server-url>
SELFMEM_LOCAL_RERANK_ENDPOINT=<env-only-local-rerank-endpoint>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank
```
