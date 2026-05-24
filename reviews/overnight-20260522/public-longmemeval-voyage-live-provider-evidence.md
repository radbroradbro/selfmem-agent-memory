# Public LongMemEval Voyage Live Provider Evidence

This evidence answers the benchmark framing concern directly: RecallWeave was
not tested alone. Each live run compared the same source-locked public
LongMemEval-S target across:

- `bm25-lite`, the lexical control and fallback.
- `full-hybrid-rerank`, the local deterministic hybrid control.
- `cloud-voyage4-voyage`, live Voyage `voyage-4-large` embeddings plus
  `rerank-2.5`.

Both reports are metrics-only. They include no raw benchmark questions, raw
answers, raw memories, raw transcripts, private local paths, or provider keys.

## Six-Question Canary

- Report:
  `reviews/overnight-20260522/public-longmemeval-voyage-live-provider-6q.json`
- Markdown:
  `reviews/overnight-20260522/public-longmemeval-voyage-live-provider-6q.md`
- Preflight:
  `reviews/overnight-20260522/public-longmemeval-voyage-live-provider-6q-preflight.json`
- Target slice:
  `longmemeval-s-cleaned-canary-6-first-per-type-2026-05-23`
- Query count: 6.
- Expected result references: 18.

| Strategy | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| `bm25-lite` | 0.4541 | 0.8333 | 0.2917 | 0.3996 | 16 |
| `full-hybrid-rerank` | 0.4541 | 0.8333 | 0.2917 | 0.3996 | 34 |
| `cloud-voyage4-voyage` | 0.5630 | 1.0000 | 0.3750 | 0.5018 | 1874 |

## Thirty-Question Canary

- Report:
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-live-provider.json`
- Markdown:
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-live-provider.md`
- Preflight:
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-live-provider-preflight.json`
- Target slice:
  `longmemeval-s-cleaned-canary-30-first-per-type-2026-05-24`
- Query count: 30.
- Expected result references: 92.
- Haystack sessions: 1,420.

| Strategy | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| `bm25-lite` | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 82 |
| `full-hybrid-rerank` | 0.2289 | 0.4333 | 0.1417 | 0.1989 | 177 |
| `cloud-voyage4-voyage` | 0.2822 | 0.5333 | 0.1750 | 0.2453 | 1641 |

## Interpretation

The live Voyage arm beat the BM25 control on the 6-question and 30-question
retrieval-proxy slices. That is the first provider-backed canary trend in the
right direction.

This is still not MemoryBench answer-quality evidence. The reports keep
`memoryBenchAnswerQuality: false` and `publicBenchmarkClaimsAllowed: false`.
The correct next step is latency and cost optimization against the same target,
then reviewer intake before any default or public-score language.

Immediate follow-up arms:

- Voyage with a smaller dense/rerank candidate pool to measure quality loss
  versus latency gain.
- Voyage `rerank-2.5-lite` as the latency challenger.
- Gemini embedding plus Voyage rerank on the same 30-question target.
- NVIDIA Nemotron retrieval/rerank on the same 30-question target.
- Apple Silicon local embedding on the same 30-question target.
