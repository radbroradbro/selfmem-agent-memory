# Atomic Lifecycle Context Refinement

Generated: 2026-05-31

## Summary

This pass implements the next high-ROI refinement from the GPT-5.5 Pro review packet and the fallback DeepSeek V4 Pro critique: improve the memory object model before running another provider sweep.

The change does not claim a benchmark win, production readiness, or Supermemory parity. It makes the atomic-memory method more testable by giving atoms stable identities and lifecycle metadata so later answer-quality runs can evaluate current-truth handling instead of ranking flat source lines.

## Reviewer Path

- Claude Opus 4.8 non-interactive review was attempted first and timed out without usable output.
- DeepSeek V4 Pro returned a bounded cold critique.
- Its recommendation was to add typed, lifecycle-aware atomic memories before another no-spend provider wave.

No secrets, raw memories, raw benchmark text, or private paths are included in this note.

## Implementation

- `atomic-memory-v1` now uses content-derived atom IDs instead of chunk-position atom IDs.
- Each atom records:
  - `atomicKind`
  - `confidence`
  - `legacyAtomicId`
  - `validFrom`
  - `validUntil`
  - `supersedes`
  - `supersededBy`
  - `contradictedBy`
  - `lifecycleStatus`
  - `atomicSubjectKey`
  - `entities`
  - `topics`
- Materialization links later update/tombstone atoms to prior atoms with the same subject key.
- Runtime context metadata now preserves the lifecycle fields through the hybrid search context bridge.
- The typed context compiler groups derived facts into current truth and superseded or historical facts.

## Verification

- `node --check packages/bench/public-benchmark-materialize-run.mjs`
- `node --check packages/bench/recallweave-response-export.mjs`
- `node packages/bench/public-benchmark-materialize-run.mjs --atomic-lifecycle-smoke --memory-method atomic-memory-v1`
- `npm exec --yes pnpm@10.23.0 -- test -- tests/hybrid/hybrid-search.test.ts tests/bench/benchmark-contract.test.ts --runInBand`
- `npm exec --yes pnpm@10.23.0 -- typecheck`
- `npm exec --yes pnpm@10.23.0 -- build`
- `npm exec --yes pnpm@10.23.0 -- benchmark:public-method-ladder -- --fixture`
- `npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:method-ladder -- --fixture`
- `node packages/bench/release-readiness-check.mjs`

All checks passed.

## New Canaries

- Atomic lifecycle smoke: three favorite-database updates produce three atoms, one current atom, two superseded atoms, two supersede links, and content-derived atom IDs.
- Runtime context smoke: a current update atom is rendered before a superseded preference atom, with lifecycle status visible in the context packet.

## Claim Boundary

This is methodology hardening. The fixture ladder still shows atomic-memory ties with other chunked fixture methods, and no answer-quality model calls were made by the fixture workorder. The next meaningful benchmark step is a controlled answer-quality dev slice using the same answer model, judge model, prompt, context budget, and provider/no-spend policy across all arms.
