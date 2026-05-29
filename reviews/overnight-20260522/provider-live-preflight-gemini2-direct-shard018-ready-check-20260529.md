# Provider Benchmark Live Preflight

Status: BLOCKED_PROVIDER_ENV
Live run allowed: false
Calls provider APIs: false
Sends benchmark text to provider: false
Target hash: sha256:dcdd33ca5a4ad3154dc3cf0da74c10fc96a1864e8f8b6ce154aff5386bdfc23e
Benchmark: longmemeval

## Strategies

- bm25-lite
- full-hybrid-rerank
- cloud-gemini2-embed-rerank-proxy

## Provider Readiness

- Provider calls enabled: true
- Public data confirmed: true
- gemini: missing (GEMINI_API_KEY, GEMINI_API_KEYS, GOOGLE_API_KEY, GOOGLE_API_KEYS, AI_STUDIO_API_KEY, AI_STUDIO_API_KEYS, GEMINI_API_KEY_FILE, GEMINI_API_KEYS_FILE, GOOGLE_API_KEY_FILE, GOOGLE_API_KEYS_FILE, AI_STUDIO_API_KEY_FILE, AI_STUDIO_API_KEYS_FILE)

## Blockers

- gemini-credentials-missing

## Next Actions

- Set provider credentials only in the shell environment, never in committed files.
- Set RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 and RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 only for public benchmark slices.
- Re-run this preflight before spending provider calls.

## Live Command Template

```bash
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
GEMINI_API_KEY=<env-only-gemini-key>
GEMINI_API_KEYS_FILE=<optional-private-gemini-key-file>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-full-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-gemini2-embed-rerank-proxy
```
