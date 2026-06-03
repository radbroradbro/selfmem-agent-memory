# Public LongMemEval-S Local Apple Cached Live Evidence

Date: 2026-05-24

Scope:

- Source-locked public LongMemEval-S retrieval-proxy target.
- 30 queries.
- Same-data controls: `bm25-lite` and `full-hybrid-rerank`.
- Provider arm: `local-apple-qwen3-0_6b`.
- Local runtime: llama.cpp on Apple Metal with Qwen3 Embedding 0.6B Q8 GGUF.
- Embedding view: bounded 900-token head/tail local view.
- Dense candidate limit: 30.
- Context budget: 800 tokens.

Why the 900-token view was used:

- The first 30-query attempt used the default 3000-token local embedding view
  with an auto-parallel llama.cpp server and failed when the server closed the
  socket during embedding.
- A single-slot 3000-token retry also failed.
- A 900-token view with single-slot llama.cpp completed. This is the first
  stable local Apple run on this source-locked 30-query target.

Cold cache result:

- Report: `public-longmemeval-expanded-local-apple-cached-live-provider-900tok-8192ctx.json`
- Markdown: `public-longmemeval-expanded-local-apple-cached-live-provider-900tok-8192ctx.md`

| Arm | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 75 | 85 |
| full-hybrid-rerank | 0.2289 | 0.4333 | 0.1417 | 0.1989 | 167 | 189 |
| local-apple-qwen3-0_6b | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 4351 | 5673 |

Cold cache provider stats:

- Provider calls: 603.
- Document count sent: 603.
- Cache hits: 327.
- Cache misses: 573.
- Cache writes: 573.
- Privacy failures: 0.
- Redaction failures: 0.

Warm cache result:

- Report: `public-longmemeval-expanded-local-apple-cached-live-provider-900tok-warm.json`
- Markdown: `public-longmemeval-expanded-local-apple-cached-live-provider-900tok-warm.md`

| Arm | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 90 | 105 |
| full-hybrid-rerank | 0.2289 | 0.4333 | 0.1417 | 0.1989 | 192 | 214 |
| local-apple-qwen3-0_6b | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 133 | 200 |

Warm cache provider stats:

- Provider calls: 30.
- Document count sent: 30.
- Cache entries loaded: 573.
- Cache hits: 900.
- Cache misses: 0.
- Cache writes: 0.
- Privacy failures: 0.
- Redaction failures: 0.

Decision:

- Do not promote the local Apple arm as a quality winner. It tied BM25 and beat
  the deterministic full-hybrid control on quality, but did not beat BM25.
- Treat the local Apple lane as viable only after persistent document embedding
  cache or vector-index warmup.
- Keep provider-backed public claims blocked. This is retrieval-proxy evidence,
  not MemoryBench answer-quality evidence.
- Next local work should test a larger Apple-friendly embedding model or a
  local reranker only after the same cache/index discipline is preserved.
