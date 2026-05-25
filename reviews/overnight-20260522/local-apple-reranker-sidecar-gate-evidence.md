# Local Apple Reranker Sidecar Gate Evidence

Date: 2026-05-24

## Scope

This slice adds a controlled local methodology challenger:
`local-apple-qwen3-0_6b-local-rerank`.

The arm keeps the measured Qwen3 Embedding 0.6B Apple Silicon lane fixed and
changes only the final reranker. That prevents the next local benchmark from
confusing reranker effects with the already measured 4B embedder scale-up.

## Implementation

- `packages/bench/recallweave-response-export.mjs` now recognizes
  `local-apple-qwen3-0_6b-local-rerank`.
- The new arm uses the same local Apple embedding provider as
  `local-apple-qwen3-0_6b`.
- Final rerank calls an env-only local reranker endpoint from
  `SELFMEM_LOCAL_RERANK_ENDPOINT` or `SELFMEM_LOCAL_RERANK_BASE_URL`.
- The default sidecar label is `Qwen/Qwen3-Reranker-0.6B`.
- Provider preflight treats the arm as requiring both `local-apple` and
  `local-rerank`.
- The Brain UI model matrix now shows the sidecar as a challenger, not a
  default.

## Evidence

Fixture provider gate:

- `reviews/overnight-20260522/public-longmemeval-provider-gate-local-rerank-fixture.json`
- `reviews/overnight-20260522/public-longmemeval-provider-gate-local-rerank-fixture.md`

Expanded public LongMemEval-S preflight:

- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-preflight-blocked.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-preflight-blocked.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-require-ready-blocked.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-require-ready-blocked.md`

Focused verification:

- `npm exec --yes pnpm@10.23.0 -- vitest run tests/bench/benchmark-contract.test.ts tests/privacy/query-expansion-boundary.test.ts`
- `node packages/brain-ui/smoke.mjs`
- `node packages/brain-ui/interaction-smoke.mjs`
- `node --check packages/bench/recallweave-response-export.mjs`
- `node --check packages/bench/provider-benchmark-live-preflight.mjs`
- `node --check packages/bench/public-benchmark-strategy-compare.mjs`
- `git diff --check`

## Result

The sidecar arm is fixture-covered and fail-closed. It is not promoted and has
no live quality result yet. A live run remains blocked until a local reranker
endpoint is configured.

This is aligned with the next local benchmark hypothesis: test reranking first,
not a larger embedder.
