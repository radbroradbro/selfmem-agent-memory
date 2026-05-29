# Agentic Memory Source-Lock Decision

- OK: true
- Tier: small
- Reader model: Qwen/Qwen3.5-9B
- Judge model: gpt-5.2
- Leaderboard row hash: sha256:edd142ab5b0576cacb8a23c364a2e96761c031a7f478254e0ed1045e5788255f
- Counts as benchmark score: false

## Boundary

- Codex GPT-5.5 may be used as an internal memory-controller or actor lane, but a Codex-reader run is not leaderboard-comparable unless the official model contract changes.

## Next Actions

- Regenerate the live source-lock packet with these four decision fields.
- Keep Codex GPT-5.5 as a separate internal actor/controller lane unless the official leaderboard model contract changes.
- Start official-comparable materialization only after the regenerated source-lock says sourceLockReadyForMaterialization=true.
