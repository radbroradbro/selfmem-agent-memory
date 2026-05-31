# Provider Rerank Promotion Guardrails - 2026-05-31

## Scope

This note records a benchmark-harness hardening step after the first atomic provider wave. It is public-safe methodology evidence only. It does not change the production default provider and does not create a Supermemory, SOTA, or production-readiness claim.

## Changes

- Provider rerank correctness is now covered by the benchmark contract suite.
- NVIDIA rerank parser behavior is now covered by the benchmark contract suite for the `rankings` plus negative-logit response shape.
- Provider promotion is no longer allowed from a tiny directional shard. A provider arm must pass the paired-query floor and bootstrap confidence gate before `promoteProvider` can become true.
- The markdown report label now says `Provider arm promoted` rather than implying that a provider arm is promoted merely because it beat a control on a small retrieval-proxy slice.

## Why

The 3-query atomic provider wave was useful because Voyage and NVIDIA completed real no-spend cloud calls and narrowly beat BM25 on retrieval-proxy quality. That result is too small to promote a default or support public benchmark claims. These guardrails keep the useful signal while preventing accidental overclaiming.

## Verification

- `node --check packages/bench/public-benchmark-strategy-compare.mjs`
- `node --check packages/bench/recallweave-response-export.mjs`
- `node packages/bench/public-benchmark-strategy-compare.mjs --promotion-gate-smoke`
- `node packages/bench/recallweave-response-export.mjs --provider-rerank-cascade-smoke`
- `node packages/bench/recallweave-response-export.mjs --nvidia-adapter-parser-smoke`
- `npm exec --yes pnpm@10.23.0 -- test -- tests/bench/benchmark-contract.test.ts --runInBand`

## Claim Boundary

Allowed claim:

- The benchmark harness now blocks tiny provider wins from default-promotion status and tests provider rerank ranking behavior before larger provider sweeps.

Disallowed claims:

- RecallWeave beats Supermemory.
- The cloud provider stack is production-ready.
- The 3-query provider wave proves a benchmark or product default.
