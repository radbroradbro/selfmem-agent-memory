# Local Reranker Sidecar Review Blocked

Date: 2026-05-24

## Scope

This note covers the `local-apple-qwen3-0_6b-local-rerank` benchmark arm.

The slice adds an env-only local reranker sidecar to the existing Apple Silicon
Qwen3 0.6B embedding benchmark path. It is a challenger arm only. It is not a
default and is not promoted.

## Required Gates

`goal-loop-review` detected these gates for the working-tree diff:

- security
- code
- integration
- final

Detector evidence:

- `reviews/overnight-20260522/local-rerank-sidecar-review/pending_gates.json`

## Blocker

The automated `goal-loop-review` verifier route hung silently while invoking the
gate verification wrapper. The stale reviewer processes were terminated instead
of counting them as approvals.

No external council approval is counted for this sidecar slice yet.

## Evidence Already Collected

Focused local verification passed:

- `npm exec --yes pnpm@10.23.0 -- vitest run tests/bench/benchmark-contract.test.ts tests/privacy/query-expansion-boundary.test.ts`
- `node packages/brain-ui/smoke.mjs`
- `node packages/brain-ui/interaction-smoke.mjs`
- `node --check packages/bench/recallweave-response-export.mjs`
- `node --check packages/bench/provider-benchmark-live-preflight.mjs`
- `node --check packages/bench/public-benchmark-strategy-compare.mjs`
- `git diff --check`
- `npm exec --yes pnpm@10.23.0 -- release:check`
- `npm exec --yes pnpm@10.23.0 -- goal:audit`
- `npm exec --yes pnpm@10.23.0 -- release:github-sync`

Benchmark/preflight evidence:

- `reviews/overnight-20260522/public-longmemeval-provider-gate-local-rerank-fixture.json`
- `reviews/overnight-20260522/public-longmemeval-provider-gate-local-rerank-fixture.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-preflight-blocked.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-preflight-blocked.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-require-ready-blocked.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-rerank-require-ready-blocked.md`

## Current Decision

The sidecar arm is fixture-covered and fail-closed. It should remain mergeable
only as an experimental benchmark path if the normal local verification stays
green. It should not be described as live-proven until a local reranker endpoint
is configured and a real public LongMemEval-S subset run completes.

The native goal remains incomplete.
