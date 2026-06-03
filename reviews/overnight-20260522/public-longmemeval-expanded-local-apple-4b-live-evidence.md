# Public LongMemEval-S Local Apple 4B Live Evidence

Date: 2026-05-24

Scope:

- Source-locked public LongMemEval-S retrieval-proxy target.
- 30 queries.
- Same-data controls: `bm25-lite` and `full-hybrid-rerank`.
- Provider arm: `local-apple-qwen3-4b`.
- Local runtime: llama.cpp on Apple Metal with Qwen3 Embedding 4B `Q4_K_M` GGUF.
- Embedding view: bounded 900-token head/tail local view.
- Dense candidate limit: 30.
- Context budget: 800 tokens.

Runtime notes:

- The model loaded as Qwen3 Embedding 4B, `Q4_K_M`, 2.32 GiB file size,
  2560 embedding dimensions, and 40960 training context.
- The server used single-slot embedding mode with 8192 context. This preserved
  the socket stability established by the 0.6B local run.
- The first live command through the package script stopped before provider
  calls because the source-locked materialized public memory file exceeded the
  default 5 MB export cap. The direct run raised that cap to 25 MB for this
  public benchmark target.

Cold cache result:

- Report: `public-longmemeval-expanded-local-apple-4b-live-provider-900tok-cold.json`
- Markdown: `public-longmemeval-expanded-local-apple-4b-live-provider-900tok-cold.md`

| Arm | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 85 | 94 |
| full-hybrid-rerank | 0.2289 | 0.4333 | 0.1417 | 0.1989 | 170 | 201 |
| local-apple-qwen3-4b | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 31304 | 53909 |

Cold cache provider stats:

- Provider calls: 603.
- Document count sent: 603.
- Cache hits: 327.
- Cache misses: 573.
- Cache writes: 573.
- Privacy failures: 0.
- Redaction failures: 0.

Warm cache result:

- Report: `public-longmemeval-expanded-local-apple-4b-live-provider-900tok-warm.json`
- Markdown: `public-longmemeval-expanded-local-apple-4b-live-provider-900tok-warm.md`

| Arm | Quality | P@1 | Recall@5 | NDCG@10 | p50 ms | p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25-lite | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 97 | 106 |
| full-hybrid-rerank | 0.2289 | 0.4333 | 0.1417 | 0.1989 | 193 | 223 |
| local-apple-qwen3-4b | 0.2506 | 0.4667 | 0.1583 | 0.2193 | 290 | 363 |

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

- Do not promote the 4B local Apple arm. It tied BM25 on quality, beat the
  deterministic full-hybrid control on quality, but was slower than both
  controls and slower than the 0.6B warm local arm.
- Larger local embeddings alone did not improve this source-locked retrieval
  target. The next local methodology work should test reranking, query
  expansion, candidate selection, or chunking rather than merely increasing the
  embedding model size.
- Keep public claims blocked. This is retrieval-proxy evidence, not MemoryBench
  answer-quality evidence.
