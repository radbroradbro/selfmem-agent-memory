# Atomic Provider Wave Readiness Note - 2026-05-31

## Scope

This note records the first successful no-spend provider retrieval-proxy wave on an `atomic-memory-v1` LongMemEval shard. It is public-safe evidence for harness wiring and provider-lane direction only. It is not an answer-quality result, production-readiness result, Supermemory comparison, or SOTA claim.

## Harness Fixes

- Live provider comparison now forwards shard controls into materialization: `--memory-method`, `--context-token-budget`, `--limit`, `--max-queries`, and `--query-offset`.
- The pre-fix failure mode was runtime/methodology, not model quality: the comparison runner could try to materialize a much larger target before applying the requested small shard.
- Provider throttling now accepts an explicit `0` ms interval, matching the preflight policy and allowing key-scoped free-tier providers whose private config intentionally sets a zero interval.
- A regression test covers both fixes.

## Evidence Files

- Preflight: `reviews/overnight-20260522/provider-live-preflight-atomic-wave-3q-20260531.{json,md}`
- Live wave: `reviews/overnight-20260522/provider-live-atomic-wave-3q-20260531.{json,md}`

## Result Snapshot

The run used 3 selected queries, retrieval-proxy metrics, public benchmark data only, and no raw questions, answers, memories, transcripts, private output paths, or credentials in the report.

| Strategy | Provider-backed | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `bm25-lite` | no | 0.4188 | 1 | 0.1419 | 0.3914 | 11 |
| `full-hybrid-rerank` | no | 0.2838 | 0.6667 | 0.1035 | 0.2613 | 25 |
| `cloud-voyage4-lite-voyage-lite` | yes | 0.4349 | 1 | 0.1452 | 0.4492 | 837 |
| `cloud-nvidia-nv-embed-v1-mistral-rerank` | yes | 0.4349 | 1 | 0.1452 | 0.4492 | 14905 |

`cloud-gemini2-voyage-rerank` failed with a retryable provider-rate-limit classification, so the overall run status is `PARTIAL_COMPLETED_WITH_ARM_FAILURES`.

## Read

- The provider lane is wired well enough to run real no-spend cloud arms on the atomic shard.
- Voyage and NVIDIA tied on retrieval-proxy quality for this tiny shard; Voyage was much faster in this run.
- The lift over BM25 was narrow: `0.4349` vs `0.4188` quality.
- This is still too small to promote a default, but it is useful evidence that provider-backed atomic retrieval should advance to a larger same-data shard.

## Claim Boundary

Do not claim:

- RecallWeave beats Supermemory.
- RecallWeave is SOTA.
- The provider stack is production-ready.
- NVIDIA, Gemini, or Voyage has been fully evaluated.

Allowed claim:

- On a 3-query public-safe LongMemEval retrieval-proxy shard using `atomic-memory-v1`, the completed Voyage and NVIDIA cloud arms narrowly beat the BM25 control, while the Gemini+Voyage arm hit a retryable provider rate limit.

## Next Method Step

Run the same atomic provider ladder on a larger shard only after provider score normalization and adapter canaries are in place. Keep query expansion disabled by default until it wins same-data answer-quality checks.
