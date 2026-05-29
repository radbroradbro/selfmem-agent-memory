# Local 4B Runtime Findings: Shard 017

Status: `BLOCKED_FOR_INTERACTIVE_FULL_SHARD_EXPORT`

This packet is public-safe and metrics-only. It includes no raw benchmark text, raw memories, raw answers, credentials, or private paths.

## Findings

- `metal-runtime-blocked`: Qwen3 Embedding 4B with Metal closed the embedding connection during synthetic durability probes and the shard response export. Treat this as runtime instability, not model quality.
- `cpu-runtime-ready`: CPU-only Qwen3 Embedding 4B with 4096 context passed the 16, 128, 512, and 700 token synthetic probes with 2560-dimensional vectors.
- `cpu-runtime-too-slow-interactive`: CPU-only 4B made slow full-shard progress and was stopped before producing the local 4B response arm. It is suitable for overnight/local methodology work, not interactive default runs.
- `cloud-provider-env-blocked`: Gemini, NVIDIA, and Voyage provider preflight was blocked because credentials were not visible in the shell.

## Evidence

- `local-embedding-4b-durability-smoke-shard017-conservative-20260529.json`
- `local-embedding-4b-nocache-durability-smoke-shard017-20260529.json`
- `local-embedding-4b-cpu4096-durability-smoke-shard017-20260529.json`
- `local-rerank-durability-smoke-shard017-cpu4b-rerank-20260529.json`
- `provider-challenger-preflight-shard017-20260529.json`
- `answer-quality-local-full-shard-017-4b-rerank-arm-export-preflight-20260529.json`

## Next Lane

Use direct Gemini Embedding 2, NVIDIA Nemotron, and Voyage provider arms when credentials are visible through environment variables or private key files outside the repository. Keep CPU-only 4B as an overnight method lane or small canary, and keep it separate from the accepted 0.6B local-full aggregate.
