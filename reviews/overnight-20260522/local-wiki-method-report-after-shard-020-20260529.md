# Local Wiki Method Report

- Status: WIKI_METHOD_SHARD_EVALUATED
- Shard: 100-125 of 500
- Scored queries: 25
- Best strategy: local-apple-qwen3-0_6b-local-rerank
- Best answer quality: 36
- Hosted Supermemory search disabled: true
- Compatible with legacy shard intake: false
- Counts as full memory SOTA evidence: false

## Strategy Scores

- bm25-lite: answerQuality=28, correctRate=0.28, p50=7269ms, deltaVsBm25=0
- full-hybrid-rerank: answerQuality=24, correctRate=0.24, p50=9208ms, deltaVsBm25=-4
- query-expanded-full-hybrid-rerank: answerQuality=24, correctRate=0.24, p50=11725ms, deltaVsBm25=-4
- wiki-title-amplified-hybrid: answerQuality=4, correctRate=0.04, p50=10278ms, deltaVsBm25=-24
- wiki-subtopic-amplified-hybrid: answerQuality=28, correctRate=0.28, p50=9045ms, deltaVsBm25=0
- wiki-summary-session-hybrid: answerQuality=16, correctRate=0.16, p50=8881ms, deltaVsBm25=-12
- local-apple-qwen3-0_6b: answerQuality=16, correctRate=0.16, p50=9479ms, deltaVsBm25=-12
- local-apple-qwen3-0_6b-local-rerank: answerQuality=36, correctRate=0.36, p50=9675ms, deltaVsBm25=8

## Observed Arm Snapshot

- local-apple-qwen3-0_6b-local-rerank: answerQuality=24.9, scoredQueries=500, shards=20
- bm25-lite: answerQuality=22.162, scoredQueries=500, shards=20
- local-apple-qwen3-0_6b: answerQuality=20.67, scoredQueries=500, shards=20
- full-hybrid-rerank: answerQuality=18.532, scoredQueries=500, shards=20
- query-expanded-full-hybrid-rerank: answerQuality=18.292, scoredQueries=500, shards=20

## Decisions

### wiki-title-amplification

- Status: negative-signal
- Evidence: score 4; delta vs BM25 -24
- Decision: Do not promote title amplification from the current evidence.

### wiki-subtopic-amplification

- Status: not-yet-positive
- Evidence: score 28; delta vs BM25 0
- Decision: Keep subtopic amplification as an experimental arm, not a default.

### wiki-summary-session

- Status: negative-signal
- Evidence: score 16; delta vs BM25 -12
- Decision: Do not promote summary-session wiki retrieval on this shard.

### local-rerank

- Status: positive-signal
- Evidence: score 36; delta vs BM25 8
- Decision: Keep local rerank as the next method-refinement candidate.

### full-hybrid-and-query-expansion

- Status: not-promoted
- Evidence: full-hybrid delta -4; query-expanded delta -4
- Decision: Do not promote query expansion; continue measuring full hybrid against BM25 shard by shard.

## Next Actions

- Do not promote wiki-title amplification; it trailed BM25 by 24 on this shard.
- Keep wiki-subtopic amplification experimental; it did not beat BM25 on this shard.
- Keep the local rerank arm in the next expanded shard; it beat BM25 by 8 here.
- If aggregating old and new shards, use a common-arm report or rerun earlier shards with the expanded strategy set.
