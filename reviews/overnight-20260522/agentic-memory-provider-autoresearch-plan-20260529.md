# Agentic Provider Autoresearch Plan

- OK: true
- Target: LongMemEval-V2
- Source-lock ready: true
- Remaining source-lock blockers: none
- Personal/prod default: cloud-voyage4-voyage
- Methodology default: local-apple-controlled-lanes
- Calls provider APIs: false

## Provider Matrix

- voyage: cloud-voyage4-voyage; embed=voyage-4; rerank=rerank-2.5-or-lite; cap=10
- gemini: cloud-gemini2-embed-rerank-proxy; embed=gemini-embedding-001-or-gemini-embedding; rerank=proxy-or-voyage-rerank; cap=20
- nvidia: cloud-nvidia-nemotron-vl-1b; embed=nvidia/llama-nemotron-embed-vl-1b-v2; rerank=nvidia/llama-nemotron-rerank-vl-1b-v2; cap=30
- openrouter: openrouter-free-query-expansion; embed=nvidia/llama-nemotron-embed-vl-1b-v2:free when exposed by OpenRouter; rerank=not-primary-free-rerank; cap=20
- local-apple: local-apple-qwen3-4b-local-rerank; embed=qwen3-embedding-local; rerank=qwen3-reranker-local; cap=local

## Watchdog

- Minimum questions before quality stop: 45
- Stop if trailing best control by points: 8
- Stop on privacy failures above: 0

## Phases

- source-lock-closeout: ready
- local-method-refinement: ready
- cloud-challenger-run: ready
- answer-quality-and-review: ready

## Next Actions

- Materialize LongMemEval-V2 in an operator-private run directory, then start local-method-refinement waves.
- Run local-method-refinement waves first, then cloud challengers with NVIDIA, Gemini, Voyage, and local Apple controls on the same rows.
- Keep Voyage as the personal/prod default until a same-data cloud challenger beats it with lower cost or better answer quality.
- Do not enable hosted Supermemory search inside methodology runs; keep it as a separate parity lane.
