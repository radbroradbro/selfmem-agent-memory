# Public Benchmark SOTA Ladder

- Status: BLOCKED_FULL_MEMORY_SOTA_EVIDENCE
- Public benchmark claims allowed: false
- MTEB/component evidence is model-selection only: true

## Blockers
- missing-end-to-end-memory-benchmark-score
- all-current-result-files-keep-public-claims-disabled
- missing-nvidia-or-gemini-live-same-data-result
- missing-local-apple-reranker-sidecar-result
- missing-live-llm-query-expansion-result

## Required Full Memory Arms
- bm25-lite: present (lexical floor)
- dense-or-vector-only: present (semantic control)
- full-hybrid-rerank: present (intended local hybrid control)
- provider-voyage4-rerank: present (cloud quality challenger)
- provider-nvidia-or-gemini: missing-live-result (non-Voyage provider challenger)
- local-apple-embedding: present (zero-spend local challenger)
- local-apple-reranker-sidecar: missing-live-result (local rerank method challenger)
- llm-query-expansion: deterministic-proxy-present-live-llm-missing (query expansion challenger)

## Best Observed Rows
- cloud-voyage4-lite-voyage-lite: quality 0.304, P@1 0.5667, nDCG@10 0.2658, p50 1988 ms, retrievalProxyOnly=true
- cloud-voyage4-voyage-lite-rerank: quality 0.304, P@1 0.5667, nDCG@10 0.2658, p50 2251 ms, retrievalProxyOnly=true
- cloud-voyage4-voyage: quality 0.304, P@1 0.5667, nDCG@10 0.2658, p50 6659 ms, retrievalProxyOnly=true
- bm25-lite: quality 0.2506, P@1 0.4667, nDCG@10 0.2193, p50 74 ms, retrievalProxyOnly=true
- local-apple-qwen3-4b: quality 0.2506, P@1 0.4667, nDCG@10 0.2193, p50 290 ms, retrievalProxyOnly=true
- full-hybrid-rerank: quality 0.2351, P@1 0.4333, nDCG@10 0.2071, p50 155 ms, retrievalProxyOnly=true
- sparse-dense-graph-temporal: quality 0.1818, P@1 0.3333, nDCG@10 0.1606, p50 77 ms, retrievalProxyOnly=true
- query-expanded-full-hybrid-rerank: quality 0.1818, P@1 0.3333, nDCG@10 0.1606, p50 157 ms, retrievalProxyOnly=true
- sparse-dense-temporal: quality 0.1401, P@1 0.2333, nDCG@10 0.127, p50 76 ms, retrievalProxyOnly=true
- sparse-dense-rrf: quality 0.1024, P@1 0.1667, nDCG@10 0.0928, p50 75 ms, retrievalProxyOnly=true
- dense-proxy: quality 0.0533, P@1 0.1, nDCG@10 0.0465, p50 2 ms, retrievalProxyOnly=true

## Next Actions
- Use MTEB and model-card evidence only to choose embedding and reranker candidates.
- Run the full same-data memory benchmark ladder before any SOTA or production replacement claim.
- Add live NVIDIA or Gemini provider results, plus a local Apple reranker-sidecar result, on the same source-locked target.
- Test LLM query expansion as its own arm: local small-model first where practical, or a clearly labeled cloud-only query-expansion substep if local hardware is the bottleneck.
- Promote no method until an end-to-end memory score beats the reported target under matching metric definitions.
- Send the exact metrics-only packet to Gemini/Claude or NVIDIA/DeepSeek-style reviewers before release wording changes.
