# NVIDIA Contextual Method Shard Diagnostic

- Status: TINY_SHARD_RETRIEVAL_PROXY_COMPLETE
- Benchmark: LongMemEval full-run target
- Query shard: 0-3 of 500
- Context token budget: 800
- Result limit: 5
- Counts as answer-quality evidence: false
- Counts as SOTA evidence: false
- Public-safe: true
- Metrics-only: true
- Raw questions included: false
- Raw answers included: false
- Raw memories included: false
- Private paths included: false

## Provider

- Primary cloud lane: NVIDIA
- Strategy: cloud-nvidia-nv-embed-v1-mistral-rerank
- Embed model: nvidia/nv-embed-v1
- Rerank model: nv-rerank-qa-mistral-4b:1
- Provider key count: 1
- Key-scoped throttle: 1500 ms

## Materialization

- Session control method: session-v1
- Contextual chunk method: contextual-source-chunk-v1
- Example 3-query contextual memory file size: 2,409,101 bytes
- Example 3-query contextual chunk count: 1,064

## Rows

| Method | Strategy | Quality | Recall@5 | Query count | Provider calls | Avg context tokens |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| session-v1 | bm25-lite | 0.5117 | 0.3056 | 3 | 0 | 800 |
| session-v1 | full-hybrid-rerank | 0.3753 | 0.2500 | 3 | 0 | 800 |
| contextual-source-chunk-v1 | bm25-lite | 0.2459 | 0.0620 | 3 | 0 | 800 |
| contextual-source-chunk-v1 | full-hybrid-rerank | 0.2459 | 0.0620 | 3 | 0 | 800 |
| session-v1 | metadata-aware-full-hybrid-rerank | 0.1575 | 0.0833 | 3 | 0 | 800 |
| session-v1 | wiki-subtopic-amplified-hybrid | 0.1575 | 0.0833 | 3 | 0 | 800 |
| contextual-source-chunk-v1 | wiki-subtopic-amplified-hybrid | 0.1291 | 0.0317 | 3 | 0 | 800 |
| contextual-source-chunk-v1 | cloud-nvidia-nv-embed-v1-mistral-rerank | 0.1096 | 0.0159 | 3 | 9 | 800 |
| contextual-source-chunk-v1 | metadata-aware-full-hybrid-rerank | 0.0462 | 0.0462 | 3 | 0 | 800 |
| session-v1 | cloud-nvidia-nv-embed-v1-mistral-rerank | 0.0000 | 0.0000 | 3 | 9 | 800 |

## Interpretation

This tiny retrieval-proxy shard proves the NVIDIA cloud arm is wired through the
new sharded full-target path, but it does not prove a method win. The session
BM25 control led the shard. Contextual source chunks, metadata-aware rerank, and
wiki/subtopic amplification all underperformed here.

The hard zero for the NVIDIA arm on the `session-v1` control is a warning sign:
it may be an adapter, embedding/rerank parsing, scoring, or tiny-shard
integration problem rather than a reliable model-quality result. Do not use this
as a stable NVIDIA verdict.

The useful next step is not to promote contextual chunks as-is. The method needs
a high-signal atomic/contextual index layer that can rank concise summaries and
then rehydrate source chunks for answer generation. After that, rerun a larger
same-data shard with NVIDIA as the primary cheap cloud challenger.
