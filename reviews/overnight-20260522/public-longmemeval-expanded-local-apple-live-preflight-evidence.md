# Local Apple Live Provider Preflight

Status: `BLOCKED_PROVIDER_ENV`

This is a public-safe, metrics-only preflight for the local Apple Silicon model
lane on the 30-question LongMemEval-S retrieval-proxy target. It makes no
provider calls and sends no benchmark text.

## Same-Data Contract

- Target:
  `reviews/overnight-20260522/public-longmemeval-expanded-run-target.json`
- Target hash:
  `sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c`
- Strategies:
  - `bm25-lite`
  - `full-hybrid-rerank`
  - `local-apple-qwen3-0_6b`
- Required provider:
  `local-apple`

## Current Blockers

- `RECALLWEAVE_PROVIDER_BENCHMARK_CALLS-not-enabled`
- `RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA-not-confirmed`
- `local-apple-credentials-missing`

For this lane, `local-apple-credentials-missing` means the benchmark has no
local embedding endpoint configured through `SELFMEM_LOCAL_EMBED_BASE_URL`.

## Meaning

The local Apple arm is scaffolded and fixture-covered, but it has not been
live-tested in the retrieval stack. The currently implemented local arm uses a
local embedding endpoint plus RecallWeave's deterministic rerank proxy. A live
Qwen3 reranker sidecar is still a challenger to add and benchmark later.

This preflight does not support any quality, SOTA, or public benchmark claim.
It exists to make the next local-model run reproducible and fail-closed.

## Safe Return Files

If an operator runs the local Apple lane later, return only:

- `recallweave-provider-preflight.json`
- `recallweave-provider-result.json`
- `recallweave-provider-result.md`

Do not return provider keys, key files, raw benchmark text, raw answers, raw
memories, raw transcripts, private local paths, or unredacted diagnostics.
