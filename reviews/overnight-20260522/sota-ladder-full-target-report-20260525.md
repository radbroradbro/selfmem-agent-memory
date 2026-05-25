# Public Benchmark SOTA Ladder

- Status: BLOCKED_FULL_MEMORY_SOTA_EVIDENCE
- Public benchmark claims allowed: false
- MTEB/component evidence is model-selection only: true

## Blockers
- all-current-result-files-keep-public-claims-disabled
- missing-voyage-answer-quality-same-data-result
- best-end-to-end-score-below-reported-supermemory-target
- missing-full-or-officially-comparable-memory-benchmark-run

## Required Full Memory Arms
- bm25-lite: present (lexical floor)
- dense-or-vector-only: present (semantic control)
- full-hybrid-rerank: present (intended local hybrid control)
- provider-voyage4-rerank: retrieval-proxy-present-answer-quality-missing (cloud quality challenger)
- provider-nvidia-or-gemini: present (non-Voyage provider challenger)
- local-apple-embedding: present (zero-spend local challenger)
- local-apple-reranker-sidecar: present (local rerank method challenger)
- llm-query-expansion: present (query expansion challenger)

## Reported Target Comparison
- Primary reported target: supermemory-production-research-gemini-3-pro (85.2 overall percent)
- Best end-to-end RecallWeave row: cloud-nvidia-nemotron-1b (43.1667)
- Meets reported target: false

## Full Benchmark Policy
- Current answer-quality query count: 30
- Minimum full query count: 500
- Officially comparable target tier: false
- Full or officially comparable run present: false

## Best Observed Rows
- cloud-nvidia-nemotron-1b: quality 43.1667, answerQuality 43.1667, P@1 n/a, nDCG@10 n/a, p50 9031 ms, retrievalProxyOnly=false, memoryBenchAnswerQuality=true
- local-apple-qwen3-0_6b-local-rerank: quality 36, answerQuality 36, P@1 n/a, nDCG@10 n/a, p50 10260 ms, retrievalProxyOnly=false, memoryBenchAnswerQuality=true
- full-hybrid-rerank: quality 26.6667, answerQuality 26.6667, P@1 n/a, nDCG@10 n/a, p50 8749 ms, retrievalProxyOnly=false, memoryBenchAnswerQuality=true
- local-apple-qwen3-0_6b: quality 26.6667, answerQuality 26.6667, P@1 n/a, nDCG@10 n/a, p50 9823 ms, retrievalProxyOnly=false, memoryBenchAnswerQuality=true
- bm25-lite: quality 20, answerQuality 20, P@1 n/a, nDCG@10 n/a, p50 7049 ms, retrievalProxyOnly=false, memoryBenchAnswerQuality=true
- query-expanded-full-hybrid-rerank: quality 20, answerQuality 20, P@1 n/a, nDCG@10 n/a, p50 10106 ms, retrievalProxyOnly=false, memoryBenchAnswerQuality=true
- cloud-voyage4-lite-voyage-lite: quality 0.304, answerQuality n/a, P@1 0.5667, nDCG@10 0.2658, p50 1988 ms, retrievalProxyOnly=true, memoryBenchAnswerQuality=false
- cloud-voyage4-voyage-lite-rerank: quality 0.304, answerQuality n/a, P@1 0.5667, nDCG@10 0.2658, p50 2251 ms, retrievalProxyOnly=true, memoryBenchAnswerQuality=false
- cloud-voyage4-voyage: quality 0.304, answerQuality n/a, P@1 0.5667, nDCG@10 0.2658, p50 6659 ms, retrievalProxyOnly=true, memoryBenchAnswerQuality=false
- local-apple-qwen3-4b: quality 0.2506, answerQuality n/a, P@1 0.4667, nDCG@10 0.2193, p50 290 ms, retrievalProxyOnly=true, memoryBenchAnswerQuality=false
- sparse-dense-graph-temporal: quality 0.1818, answerQuality n/a, P@1 0.3333, nDCG@10 0.1606, p50 77 ms, retrievalProxyOnly=true, memoryBenchAnswerQuality=false
- sparse-dense-temporal: quality 0.1401, answerQuality n/a, P@1 0.2333, nDCG@10 0.127, p50 76 ms, retrievalProxyOnly=true, memoryBenchAnswerQuality=false

## Next Actions
- Use MTEB and model-card evidence only to choose embedding and reranker candidates.
- Run the full LongMemEval-S or officially comparable MemoryBench target before broad SOTA or production-replacement wording.
- Run the missing provider answer-quality challengers on the same source-locked target before any SOTA or production replacement claim.
- Add Voyage and NVIDIA or Gemini answer-quality arms to the same end-to-end memory score packet.
- Keep the local query-expansion and local-rerank arms, but label them as local-only evidence until provider challengers and reviewers pass.
- Promote no method until an end-to-end memory score beats the reported target under matching metric definitions.
- Send the exact metrics-only packet to Gemini/Claude or NVIDIA/DeepSeek-style reviewers before release wording changes.
