# Overnight Kickoff

## Objective

Run the RecallWeave 12-hour product loop with native Codex goals, council
review, browser/computer-use UI evidence, and safe PR-based implementation for:

- Nucleus Index,
- LLM-wiki and vault sync,
- self-hosted brain UI,
- update flow,
- local-only memory compaction benchmarking,
- native memory optimization per host runtime.
- research lineage for source-backed hypotheses, pros, cons, decisions, and
  follow-up questions.

## Current Commit

Seeded from public `main` at `f498173`.

## Added Contracts

- `packages/core/src/nucleus/index.ts`
- `docs/NUCLEUS_INDEX.md`
- `docs/LLM_WIKI_SYNC.md`
- `docs/RESEARCH_LINEAGE.md`
- `docs/PRODUCTION_READINESS.md`
- `packages/brain-ui/`

## Design Commitments

- Hermes lifecycle and sleep/compression phases are native inputs, not things
  RecallWeave should replace.
- Hybrid search must remain visible through retrieval trace nodes.
- The LLM-wiki layer is the editable knowledge surface.
- The self-hosted UI should inspect and edit derived docs with sanitized
  fixture data before any real private session data is used locally.
- Research should be traceable as graph/wiki lineage, not summarized into
  unexplained conclusions.
- Public artifacts must never contain credentials, raw memories, raw
  transcripts, private agent logs, private file paths, or private diagnostics.

## Reviewer Notes

The first reviewers should check whether these contracts are too broad, too
vague, or missing a critical host-specific lifecycle event. They should also
compare the design with source-locked public projects such as GBrain before the
UI contract is treated as stable.
