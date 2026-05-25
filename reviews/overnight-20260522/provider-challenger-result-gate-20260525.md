# Provider Challenger Result Gate

- Status: BLOCKED_PROVIDER_CHALLENGER_RESULT
- Counts as live provider challenger benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json

## Blockers
- missing-voyage-provider-arm

## Provider Arms
- cloud-nvidia-nemotron-1b: providers=nvidia, answerQuality=43.1667
- local-apple-qwen3-0_6b: providers=local-apple, answerQuality=26.6667

## Next Actions
- Run the same-data provider comparison with configured Voyage, NVIDIA or Gemini, and local Apple endpoints.
- Include bm25-lite, full-hybrid-rerank, Voyage, NVIDIA or Gemini, and local Apple arms on the source-locked target.
- Re-run this gate with --require-ready before counting provider challenger rows in the SOTA ladder.
