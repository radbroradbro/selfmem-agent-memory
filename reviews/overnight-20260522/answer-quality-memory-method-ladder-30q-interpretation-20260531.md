# Answer-Quality Memory Method Ladder 30Q Interpretation

Generated: 2026-05-31

## Scope

- This is a same-shard model-challenger diagnostic over 30 LongMemEval questions.
- It compares memory materialization methods, not public SOTA or production readiness.
- Hosted Supermemory search stayed disabled for this methodology run.
- The run used failure-accounted answer-quality scoring, so provider call problems are counted in the method report rather than aborting the full ladder.
- No raw questions, raw answers, raw memory text, private paths, or provider keys are included here.

## Result

| Method | Winning retrieval arm | Answer quality | Correct rate | Call failures |
| --- | --- | ---: | ---: | ---: |
| `session-v1` | `full-hybrid-rerank` | 23.3333 | 0.2333 | 0 |
| `contextual-source-chunk-v1` | `bm25-lite` | 31.6667 | 0.3 | 1 |
| `contextual-index-source-chunk-v1` | `bm25-lite` | 22.6667 | 0.2 | 0 |
| `atomic-memory-v1` | `bm25-lite` | 28.3333 | 0.2667 | 1 |

## Interpretation

- The wider slice keeps the earlier direction that smaller, lifecycle-aware records can beat whole-session memory.
- The best method on this slice was `contextual-source-chunk-v1` with `bm25-lite`, not `atomic-memory-v1`.
- `atomic-memory-v1` still beat the session baseline, but it did not beat contextual source chunks here.
- `contextual-index-source-chunk-v1` underperformed, which argues against promoting the index-expanded materializer without another targeted reason.
- Full-hybrid helped the whole-session baseline, but BM25 over better materialized records still won overall.

## Next Step

Use `contextual-source-chunk-v1` plus `atomic-memory-v1` as the next challengers against `session-v1` on a larger accepted shard. Keep BM25 as the lexical control, keep full-hybrid as a candidate arm, and only promote a method if it keeps its edge under failure-accounted answer-quality scoring.

