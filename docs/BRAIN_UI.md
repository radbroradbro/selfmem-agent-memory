# Brain UI

RecallWeave's self-hosted brain UI should make local memory inspectable and
editable without forcing the user into raw Obsidian files.

The first scaffold lives in `packages/brain-ui/` and uses fixture data only.

## Purpose

The UI should expose:

- Nucleus graph nodes and edges,
- container health and provider mode,
- hybrid retrieval traces,
- lifecycle and sleep-cycle events,
- research lineage,
- sanitized Nucleus snapshot export,
- derived docs and wiki pages,
- compiled wiki/vault files,
- vault disk-sync status and conflicts,
- provenance,
- low-noise chronological timelines.

## Non-Goals

The UI must not:

- read real local memories by default,
- display raw transcripts,
- display credentials,
- display private diagnostics,
- sync hosted Supermemory writes,
- replace Obsidian for users who prefer Obsidian.

## Fixture Review

Run:

```bash
pnpm brain:serve
```

Open:

```text
http://127.0.0.1:4177
```

Use Codex Browser, Computer Use, or Playwright to capture fixture-only evidence.

Required visual review path:

1. search,
2. graph navigation,
3. retrieval trace inspection,
4. lifecycle event inspection,
5. derived doc edit,
6. save or reset,
7. draft export preview,
8. timeline scan,
9. provenance scan,
10. Nucleus snapshot preview,
11. research lineage preview,
12. compiled wiki/vault preview,
13. fixture vault sync report with conflict handling.

Current public evidence lives under `reviews/overnight-20260522/ui-evidence/`
and must stay fixture-only. The sync report endpoint uses a temporary fixture
vault, redacts its root as `fixture-temp-vault`, and never reads an agent's real
memory directory.

The fixture Container panel shows fake local/read-through container labels,
provider mode, local-only write mode, lifecycle/retrieval counts, leak count,
redaction count, and duplicate-cluster count. It proves the health affordance
without touching real agent state.

The fixture editor refuses private or key-shaped text and exports saved fixture
edits as a preview object with `writesRealFiles: false`.

The Nucleus snapshot preview is also fixture-only and marks
`writesRealFiles: false`.

## Production Path

Before connecting real local containers, the UI needs:

- read-only local fixture mode,
- redacted local container mode,
- explicit file picker or config path,
- write confirmation for derived docs,
- wiki lint before save,
- Nucleus snapshot export against a selected redacted local container,
- explicit vault sync confirmation,
- screenshot/recording safety guardrails,
- accessibility review.
