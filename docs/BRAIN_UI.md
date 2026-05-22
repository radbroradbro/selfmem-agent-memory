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
- lifecycle policy draft export,
- selected lifecycle policy apply with explicit confirmation,
- memory review queue draft export,
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
12. lifecycle policy preview,
13. selected lifecycle policy apply confirmation,
14. memory review queue preview,
15. compiled wiki/vault preview,
16. fixture vault sync report with conflict handling,
17. selected local vault sync dry-run,
18. selected local vault sync apply confirmation,
19. fixture local-container audit preflight.

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

The Lifecycle Policy panel stages recall and write-policy choices as a fixture
draft export. It clamps numeric settings, limits low-confidence write behavior
to known choices, shows changed fields, and marks `writesRealFiles: false`.
It does not edit real host config files.

Selected lifecycle policy apply is disabled unless
`RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY=1` is set. When enabled, it requires
a write checkbox and the exact confirmation phrase
`APPLY LOCAL LIFECYCLE POLICY`. It writes only a sanitized
`.recallweave/lifecycle-policy.json` file plus a content-free
`.recallweave/lifecycle-policy-audit.jsonl` audit line under the selected local
container root. It rejects policy payloads containing `<private>` spans or
key-shaped text, clears typed paths after submit, and returns only a redacted
`.../container` label, relative file paths, summary counts, and an audit hash.

The Review Queue panel stages candidate memory decisions as a fixture draft
export. It exposes approve, suppress, merge, and needs-more-evidence choices
for low-confidence or noisy candidate memories and marks `writesRealFiles:
false`.

The Local Audit Preflight panel uses a temporary fixture container and the
read-only audit utility. It displays file counts, redaction counts, and health
reasons only. It never displays raw memory, raw event text, provider keys, or
the temporary root path.

Selected local-container audit is disabled unless the server starts with
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1`. When enabled, the form requires
read-only confirmation, clears the typed path after submit, and returns only a
redacted `.../container` label, counts, health reasons, and an audit-trail
summary. The browser also keeps a bounded content-free selected-audit history
in `localStorage`. It still writes no agent files and never returns raw memory
text.

Selected local-container browse is disabled unless the server starts with
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_BROWSE=1`. When enabled, it requires
read-only confirmation, clears the typed path after submit, reads only the
allow-listed local memory files, and returns a bounded list of redacted memory
or trace snippets. It skips fully private entries, reports redaction counts,
returns only a redacted `.../container` label, and writes no agent files.

Selected local vault sync dry-run is also disabled unless
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1` is set. When enabled, it requires
read-only confirmation, clears the typed path after submit, runs
`syncCompiledWikiVault()` in dry-run mode, and returns only a redacted
`.../container` label plus relative action counts and conflicts. It writes no
wiki files.

Selected local vault sync apply is disabled unless
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY=1` is set. When enabled, it requires a
write checkbox and the exact confirmation phrase `APPLY LOCAL WIKI SYNC`. It
writes compiled, lint-clean wiki files only, records a content-free
`.recallweave/wiki-sync-audit.jsonl` intent log before writes, clears typed
paths after submit, and returns only a redacted `.../container` label, relative
actions, summary counts, and audit counts.

## Production Path

Before connecting real local containers, the UI needs:

- read-only local fixture mode,
- local container audit preflight,
- redacted local container mode,
- explicit file picker or config path with read-only confirmation,
- selected local-container browse preview,
- write confirmation for derived docs,
- wiki lint before save,
- memory review queue apply path with explicit confirmation,
- Nucleus snapshot export against a selected redacted local container,
- screenshot/recording safety guardrails,
- accessibility review.

See `docs/LOCAL_CONTAINER_AUDIT.md` for the first safe preflight utility.
