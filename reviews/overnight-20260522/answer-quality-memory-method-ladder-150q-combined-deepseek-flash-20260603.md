# Combined Answer-Quality Method Ladder

- Mode: contiguous-query-shard-answer-quality-union
- Query range: 0-150
- Source shard count: 2
- Methods retained: session-v1, contextual-source-chunk-v1
- Methods dropped without full coverage: none
- Winner: contextual-source-chunk-v1:bm25-lite:39.8
- Public benchmark claims allowed: false

## Source Shards

| Path | Range | Hash |
| --- | ---: | --- |
| reviews/overnight-20260522/answer-quality-memory-method-ladder-100q-combined-deepseek-flash-20260603.json | 0-100 | sha256:411730f837eba7dab635df0b06a0d849f05bf36547b998d87e9d7510c4c756a6 |
| reviews/overnight-20260522/answer-quality-memory-method-ladder-q100-q150-deepseek-flash-20260603.json | 100-150 | sha256:7fbd9c93785a326be566bb52c8effb7efb8f456f9dc825fa613b2a9279b37090 |

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 23.1667 | 600 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 39.8 | 600 | 0 | 1 |
