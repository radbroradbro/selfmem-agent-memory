# Public Benchmark Targets

This file defines the benchmark lane to use when hosted Supermemory write quota
is exhausted. RecallWeave does not need hosted Supermemory writes to evaluate
memory quality. The main objective is to run RecallWeave on a real public
benchmark slice, compare the result to source-locked published targets, then
iterate through autoresearch until the canary trend beats those targets.

## Rule

Use public benchmark data first.

Hosted Supermemory is useful for product parity and read-through behavior, but
it is not the only baseline. When hosted quota is locked, do not block the
benchmark loop on hosted writes. Run RecallWeave against a source-locked slice
from MemoryBench, LongMemEval, LoCoMo, ConvoMem, BEAM, or another documented
memory benchmark, then compare the metrics to published leaderboard or provider
reports.

## Claim Tiers

| Tier | Evidence | Allowed wording |
| --- | --- | --- |
| Fixture | Parser or UI fixture only. | "The harness shape works." |
| Canary trend | RecallWeave beats a reported target on a small source-locked slice with matching metric definitions. | "The canary is trending toward a win against reported leaders." |
| Public benchmark | Full or officially comparable benchmark run with source lock, metric parity, reviewer approval, and privacy scan. | "RecallWeave beat the reported target on this benchmark setup." |
| Broad SOTA | Multiple full comparable benchmarks, same metric definitions, reviewer approval, and reproducible artifacts. | "RecallWeave is stronger across the tested benchmark suite." |

Do not call a canary trend a full benchmark win. Do not compare RecallWeave
accuracy to a reported provider score unless the dataset variant, metric, judge,
answer model, token budget, and scoring code are stated.

## Seed Targets

These are targets for planning, not proof that the cited systems used the same
harness we will use.

| Source | Benchmark | Reported metric | Target | Caveat |
| --- | --- | --- | ---: | --- |
| Supermemory README | LongMemEval | result | 81.6% | Reported as #1 by provider; match metric before using. |
| Supermemory README | LoCoMo | rank | #1 | No numeric score in the checked README lines. |
| Supermemory README | ConvoMem | rank | #1 | No numeric score in the checked README lines. |
| Mem0 state report | LoCoMo | score | 92.5 | Reported provider result with average tokens per query. |
| Mem0 state report | LongMemEval | score | 94.4 | Reported provider result with average tokens per query. |
| Mem0 state report | BEAM 1M | score | 64.1 | Use only when the BEAM slice and context depth match. |
| Mem0 state report | BEAM 10M | score | 48.6 | Use only when the BEAM slice and context depth match. |

## Source Lock Notes

- MemoryBench is the preferred harness because it exposes provider, benchmark,
  judge, answer model, run id, question limits, and checkpointed
  ingest-index-search-answer-evaluate-report phases. Its documented benchmark
  names are `locomo`, `longmemeval`, and `convomem`.
- MemoryBench's MemScore is a triple: quality, latency, and context tokens. Do
  not collapse that into one score.
- LongMemEval is a strong target because it uses 500 human-curated questions and
  tests information extraction, multi-session reasoning, knowledge update,
  temporal reasoning, and abstention.
- Reported provider scores are useful objective targets, but they are weaker
  than same-harness head-to-head runs. Every target row must keep its source URL
  and date checked.

## Sources Checked

- https://github.com/supermemoryai/memorybench
- https://supermemory.ai/docs/memorybench/integrations
- https://github.com/supermemoryai/supermemory/blob/main/README.md
- https://mem0.ai/blog/state-of-ai-agent-memory-2026
- https://openreview.net/pdf?id=wIonk5yTDq
