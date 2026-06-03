# Codex Memory Noise Artifact Gate Evidence - 2026-06-03

## Change

The Codex selfmem bridge now separates benchmark/canary artifacts from general
memory-quality lessons. Artifact-style benchmark or canary memories require a
matching active benchmark/canary task before they can be injected. General
RecallWeave memory-quality guidance can still appear for memory-quality prompts.

## Verification

- `codex-memory-context-quality-audit --live --strict` passed with 7 scenarios.
- The new `memory-plugin-noise-no-benchmark-artifacts` scenario passed with
  relevant retrieval/write/noise context and no BM25, shard, provider-arm, SOTA,
  LongMemEval, strict-real canary, returned-canary, or canary-packet artifacts.
- Tiny prompts `go` and `???` remain quiet.
- Unrelated email drafting remains quiet.
- The public-safety scan over the generated evidence found no private paths or
  provider-key-shaped strings.

## Monitor Boundary

The short watched monitor smoke passed 2 clean rewired iterations for quiet
prompts, direct lookup, relevance gating, artifact-risk absence, and severe
noise. The monitor now requires at least 12 clean iterations before labeling a
run as dogfood graduation evidence, so short smoke runs cannot be mistaken for
graduation proof.

## Evidence Files

- `codex-memory-context-quality-noise-artifact-gate-20260603.json`
- `codex-memory-dogfood-monitor-noise-artifact-gate-20260603.json`
