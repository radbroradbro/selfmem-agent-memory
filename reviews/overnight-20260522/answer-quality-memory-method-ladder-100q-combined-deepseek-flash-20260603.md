# Combined Answer-Quality Method Ladder

- Mode: contiguous-query-shard-answer-quality-union
- Query range: 0-100
- Source shard count: 2
- Methods retained: session-v1, contextual-source-chunk-v1
- Methods dropped without full coverage: atomic-memory-v1
- Winner: contextual-source-chunk-v1:bm25-lite:37.1
- Public benchmark claims allowed: false

## Source Shards

| Path | Range | Hash |
| --- | ---: | --- |
| reviews/overnight-20260522/answer-quality-memory-method-ladder-75q-deepseek-flash-paired-20260601.json | 0-75 | sha256:cbfb597efe36499aaf47a701b2456749e6b80dc2d86d1dc829904b55dbb73770 |
| reviews/overnight-20260522/answer-quality-memory-method-ladder-q075-q100-deepseek-flash-20260603.json | 75-100 | sha256:3232820fbe9cd8361cc844c0d405b3f1172dd84df3a65de9fe20100536750104 |

## Method Rows

| Method | Winner | Answer quality | Calls | Answer failures | Judge failures |
| --- | --- | ---: | ---: | ---: | ---: |
| session-v1 | full-hybrid-rerank | 21.3 | 400 | 0 | 0 |
| contextual-source-chunk-v1 | bm25-lite | 37.1 | 400 | 0 | 1 |
