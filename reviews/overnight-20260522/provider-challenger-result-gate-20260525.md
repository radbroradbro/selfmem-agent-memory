# Provider Challenger Result Gate

- Status: BLOCKED_PROVIDER_CHALLENGER_RESULT
- Counts as live provider challenger benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json

## Blockers
- fixture-result-cannot-count-as-live-provider-ladder
- result-not-bound-to-source-locked-target
- missing-materializer-hash
- provider-live-consent-not-proven
- provider-live-calls-missing
- provider-used-mock-calls
- provider-key-or-endpoint-counts-missing

## Provider Arms
- cloud-voyage4-voyage: providers=voyage, liveCalls=0, mockCalls=6, keyCount=0
- cloud-gemini-voyage-rerank: providers=gemini,voyage, liveCalls=0, mockCalls=6, keyCount=0
- cloud-nvidia-nemotron-1b: providers=nvidia, liveCalls=0, mockCalls=6, keyCount=0
- local-apple-qwen3-0_6b: providers=local-apple, liveCalls=0, mockCalls=3, keyCount=0

## Next Actions
- Run the same-data provider comparison with configured Voyage, NVIDIA or Gemini, and local Apple endpoints.
- Include bm25-lite, full-hybrid-rerank, Voyage, NVIDIA or Gemini, and local Apple arms on the source-locked target.
- Re-run this gate with --require-ready before counting provider challenger rows in the SOTA ladder.
