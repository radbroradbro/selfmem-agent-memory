# Brain UI Research Source Lock Evidence

Date: 2026-05-22

Scope:

- Fixture-only Research Source Lock panel in the self-hosted Brain UI.
- Source-locked research inputs for LLM-wiki, GBrain, Obsidian, MemoryBench,
  Hermes provider hooks, and recent memory-system papers.
- Human-readable source cards, implementation rules, and collapsed technical
  export.

Result:

- Mode: `fixture-brain-ui-research-source-lock`
- Writes real files: false
- Metrics-only: true
- Sources: 11
- Source-locked sources: 10
- Needs review: 0
- Recent sources: 9
- Benchmark targets: 3
- Implementation rules: 8
- Privacy leak count: 0
- Source links: 11
- Copy buttons for exact backend labels: 4
- Console errors: 0

Evidence files:

- `reviews/overnight-20260522/ui-evidence/brain-ui-research-source-lock-evidence.json`
- `reviews/overnight-20260522/ui-evidence/brain-ui-research-source-lock.png`

Notes:

- The panel is public-safe and fixture-only. It does not read local memories,
  raw transcripts, diagnostics, credentials, hosted Supermemory contents, real
  agent names, or local paths.
- It keeps backend identifiers copyable without showing users raw container
  names as the primary UI language.
- It includes explicit next-method rules for topic/subtopic paths, stale memory
  supersession, budgeted lifecycle frequency controls, and dashboard-to-cluster
  zoom at scale.
- The source lock is not a claim that RecallWeave is SOTA. It is a bounded
  evidence surface that records which sources shaped the next implementation
  rules and which claims still need live benchmarks.
