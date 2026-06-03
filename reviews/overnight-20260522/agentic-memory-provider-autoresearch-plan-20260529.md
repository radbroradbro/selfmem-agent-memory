# Agentic Provider Autoresearch Plan

- OK: true
- Target: LongMemEval-V2
- Source-lock ready: true
- Remaining source-lock blockers: none
- Personal/prod default: cloud-voyage4-lite-voyage-lite
- Methodology default: local-apple-controlled-lanes
- Primary score: whole-harness-agent-memory-answer-quality
- Supermemory comparison: plugin-to-plugin-agent-memory-layer
- Diagnostics are release scores: false
- Calls provider APIs: false

## Provider Matrix

- voyage: cloud-voyage4-lite-voyage-lite; embed=voyage-4-lite; rerank=rerank-2.5-lite; cap=10
- gemini: cloud-gemini2-embed-rerank-proxy; embed=gemini-embedding-001-or-gemini-embedding; rerank=proxy-or-voyage-rerank; cap=20
- nvidia: cloud-nvidia-nv-embed-v1-mistral-rerank; embed=nvidia/nv-embed-v1; rerank=nvidia/rerank-qa-mistral-4b; cap=30
- openrouter: openrouter-free-query-expansion; embed=nvidia/llama-nemotron-embed-vl-1b-v2:free when exposed by OpenRouter; rerank=not-primary-free-rerank; cap=20
- local-apple: local-apple-qwen3-4b-local-rerank; embed=qwen3-embedding-local; rerank=qwen3-reranker-local; cap=local

## Watchdog

- Minimum questions before quality stop: 45
- Stop if trailing best control by points: 8
- Stop on privacy failures above: 0

## Phases

- agent-memory-health-gate: ready
- long-agent-workflow-canary: ready
- source-lock-closeout: ready
- local-method-refinement: ready
- cloud-challenger-run: ready
- answer-quality-and-review: ready

## Next Actions

- Materialize LongMemEval-V2 in an operator-private run directory, then start local-method-refinement waves.
- Run local-method-refinement waves first, then cloud challengers with NVIDIA, Gemini, Voyage, and local Apple controls on the same rows.
- Keep the Voyage-lite/lite arm as the personal/prod default until a same-data cloud challenger beats it with lower cost or better answer quality.
- Do not enable hosted Supermemory search inside methodology runs; keep it as a separate parity lane.
