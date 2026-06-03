# Answer-quality method ladder retrieval autopsy

Status: READY_RETRIEVAL_CHALLENGER_FOR_SCORING
Fixture only: false
Methods: session-v1, contextual-source-chunk-v1
Strategies: bm25-lite
Shard: 150-155
Same raw query selection: true

## Best Baseline
- Method: session-v1
- Strategy: bm25-lite
- Hit rate: 0.6
- Hit queries: 3/5
- MRR: 0.6
- Rank buckets: rank1 3, rank2-5 0, miss 2

## Best Challenger
- Method: contextual-source-chunk-v1
- Strategy: bm25-lite
- Hit rate: 0.8
- Hit queries: 4/5
- MRR: 0.8
- Rank buckets: rank1 4, rank2-5 0, miss 1

## Comparison
- Hit-rate lift: 0.2
- Paired outcomes: both hit 3, baseline-only 0, challenger-only 1, both miss 1

## Blockers
- none

## Next Actions
- Run a bounded answer-quality scorer on the same shard for the retrieval challenger before expanding the shard.
- Promote only if the standard method-ladder result gate shows a non-session challenger beating session-v1.
