# Provider Challenger Result Gate

- Status: BLOCKED_PROVIDER_CHALLENGER_RESULT
- Counts as live provider challenger benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-run-target.json

## Blockers
- missing-voyage-provider-arm
- missing-nvidia-or-gemini-provider-arm
- missing-local-apple-provider-arm
- missing-provider-challenger-arms

## Provider Arms

## Next Actions
- Run the same-data provider comparison with configured Voyage, NVIDIA or Gemini, and local Apple endpoints.
- Include bm25-lite, full-hybrid-rerank, Voyage, NVIDIA or Gemini, and local Apple arms on the source-locked target.
- Re-run this gate with --require-ready before counting provider challenger rows in the SOTA ladder.
