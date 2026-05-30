# Public Provider Wave Q050 Partial

- Status: PARTIAL_PROVIDER_WAVE_COMPLETED_WITH_PROVIDER_RATE_LIMITS
- Query selection: offset 0, max 50
- Retrieval proxy only: true
- Public benchmark claims allowed: false
- Supermemory search disabled: true

## Completed Arms
- bm25-lite: quality=0.0164, pAt1=0.032, recallAt10=0.0098, providerCalls=0
- full-hybrid-rerank: quality=0.0157, pAt1=0.032, recallAt10=0.0088, providerCalls=0
- cloud-nvidia-nemotron-vl-1b: quality=0.0045, pAt1=0.008, recallAt10=0.003, providerCalls=150

## Failed Arms
- cloud-gemini2-embed-rerank-proxy: provider-429-rate-or-quota-limit
- cloud-voyage4-voyage-lite-rerank: provider-429-rate-or-quota-limit

## Findings
- BM25 remained the retrieval-proxy winner on this 50-question slice.
- NVIDIA completed 50 provider-backed queries but underperformed BM25 and full-hybrid on this slice.
- Gemini and Voyage reached provider 429 limits before producing complete slice results; they should be rerun with stricter pacing, smaller waves, or quota-separated keys.
- This is retrieval-proxy methodology evidence only, not MemoryBench answer-quality or SOTA proof.

## Next Actions
- Run a narrower NVIDIA follow-up varying dense/rerank candidate limits before promotion.
- Rerun Gemini and Voyage as smaller paced waves after quota cooldown or with confirmed per-key quota separation.
- Use answer-quality scoring only after response arms complete and the answer/judge endpoint policy is set.

## Safety
- Raw questions included: false
- Raw memory included: false
- Private output paths included: false
- Privacy leak count: 0
- Redaction failure count: 0
