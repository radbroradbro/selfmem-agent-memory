# Brain UI

RecallWeave's self-hosted brain UI should make local memory inspectable and
editable without forcing the user into raw Obsidian files.

The first scaffold lives in `packages/brain-ui/` and uses fixture data only.

## Purpose

The UI should expose:

- Nucleus graph nodes and edges,
- deterministic dynamic graph layout with vertical growth,
- graph navigation controls for all-vs-neighborhood scope, jump-to-node, and
  selected-node centering,
- container health and provider mode,
- hybrid retrieval traces,
- lifecycle and sleep-cycle events,
- research lineage,
- metrics-only local session compaction audit,
- local-only compaction benchmark dashboard,
- one-agent canary rollout dashboard,
- prompt context preview for injected recall packets,
- release readiness console for current public-launch blockers,
- lifecycle policy draft export,
- selected lifecycle policy apply with explicit confirmation,
- memory review queue draft export,
- selected memory review queue apply with explicit confirmation,
- selected local memory edit overlay with explicit confirmation,
- selected local memory materialize with explicit confirmation and backup,
- sanitized Nucleus snapshot export,
- derived docs and wiki pages,
- research source lock cards for current public sources, implementation rules,
  caveats, and benchmark targets,
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
3. graph navigation controls: all scope, neighborhood scope, jump-to-node,
   selected-node center,
4. dynamic layout spacing and scroll behavior,
5. retrieval trace inspection,
6. lifecycle event inspection,
7. derived doc edit,
8. save or reset,
9. draft export preview,
10. timeline scan,
11. provenance scan,
12. Nucleus snapshot preview,
13. research lineage preview,
14. research source lock preview,
15. local session compaction audit preview,
16. local compaction benchmark dashboard,
17. one-agent canary rollout dashboard,
18. prompt context preview,
19. release readiness console,
20. lifecycle policy preview,
21. selected lifecycle policy apply confirmation,
22. memory review queue preview,
23. selected memory review queue apply confirmation,
24. compiled wiki/vault preview,
25. fixture vault sync report with conflict handling,
26. selected local vault sync dry-run,
27. selected local vault sync apply confirmation,
28. fixture local-container audit preflight,
29. selected local memory edit overlay confirmation,
30. selected local memory materialize confirmation.

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

The Research Source Lock panel is fixture-only and metrics-only. It shows the
public sources that currently constrain RecallWeave's design, including the
LLM-wiki pattern, GBrain, Obsidian-compatible wiki work, MemoryBench, Hermes
provider hooks, Supermemory, and recent memory-system papers. It renders source
cards and implementation rules in human language, keeps the technical JSON
export collapsed by default, and keeps backend labels copyable without making
raw ids the primary interface. Current browser evidence records 11 sources, 10
  source-locked sources, 9 recent sources, 8 implementation rules, 3 benchmark
targets, zero console errors, and no private/key-shaped visible text. The rules
include topic/subtopic paths, stale-memory supersession for resolved bugs or
tasks, user-adjustable lifecycle frequency so recall and write cadence can
balance continuity, latency, token use, and provider limits, and a
dashboard-to-cluster zoom path for larger memory graphs.

The graph layout is data-driven. It ranks visible Nucleus nodes from graph
edges and kind fallback order, limits columns so cards do not overlap in the
center panel, and grows vertically with scroll when the visible graph expands.
The browser evidence records layout mode, node count, edge count, column count,
row count, overlap count, console errors, and private/key-shaped text checks.

Graph navigation is also fixture-safe. The controls can show the full filtered
graph, narrow the current graph to the selected node's direct neighborhood,
jump to any node in the filtered result set, and center the selected graph
card. The browser evidence records navigation mode, active scope, visible node
count, jump option count, selected-node visibility, console errors, and
private/key-shaped text checks.

The Compaction Audit panel is fixture-only and metrics-only. It shows input
event count, output candidate count, redaction count, skipped noise count,
chronology, exact-identifier preservation, privacy leak count, and candidate
fingerprints. It does not show raw session text or candidate memory text. The
browser evidence records `fixture-local-session-compaction-audit`,
`metricsOnly: true`, `writesRealFiles: false`, zero privacy leaks, zero console
errors, and no private/key-shaped visible text.

The Benchmark Dashboard panel is fixture-only and metrics-only. It summarizes
the local-only compaction benchmark suite without raw session text or candidate
memory text. It shows pass/fail verdict, scenarios passed, failed scenarios,
privacy leaks, exact-identifier accuracy, kind coverage, required-term
coverage, noise reduction, output-candidate count, per-scenario statuses, and
caveats. Current browser evidence records
`fixture-local-compaction-benchmark-dashboard`, 5 of 5 scenarios passed, 0
failed scenarios, 0 privacy leaks, exact-identifier accuracy 1, average noise
reduction 0.307, hosted-baseline caveat visible, no-raw-text caveat visible,
zero console errors, and no private/key-shaped visible text. This panel does
not claim hosted Supermemory superiority, and it is not a public GitHub
benchmark score. A public score needs a matched, source-locked canary win with
the same judge, settings, scoring code, privacy scan, and reviewer sign-off.

The Canary Rollout panel is fixture-only and metrics-only. It summarizes the
safe path from a green PR to one controlled agent canary without touching a
real agent. It shows one-agent scope, host type, local checks, GitHub Actions
status, public launch verdict, prerequisites, dry-run/apply/observe/rollback
steps, metrics to collect, blockers, and caveats. Current browser evidence
records `fixture-one-agent-canary-rollout`, verdict
`READY_FOR_ONE_AGENT_CANARY`, target scope `one-agent`, hosted Supermemory mode
`read-through-only`, public launch verdict `FAIL`, owner approval required,
privacy leak count 0, 5 steps, 11 metrics, rollback and dry-run steps visible,
zero console errors, and no private/key-shaped visible text. This panel does
not approve public launch or fleet rollout; it only makes the one-agent canary
path inspectable.

The Context Preview panel is fixture-only. It shows the recall packet that
would enter a prompt after hybrid retrieval and reranking: selected memory
metadata, context sections, omitted candidates, token budget, citations,
read-only hosted status, local-only write mode, and leak counters. It uses
public fixture text only and marks `writesRealFiles: false`. The browser
evidence records `fixture-prompt-context-preview`, 642 of 900 context tokens
used, 3 selected memories, 3 context sections, 2 omitted candidates, hosted
read-through as read-only, local-only writes, zero console errors, and no
private/key-shaped visible text.

The Release Readiness panel is fixture-only and metrics-only. It shows the
current public launch verdict, production-ready flag, latest verified code CI
status, blocker count, proven preview-surface count, manual action count,
fixture-only status, hosted write-back status, and leak counter. It is meant to
make the release gate easy to inspect before a human approves publication. It
does not update GitHub, change repository visibility, or write local agent
files. Current browser evidence records `fixture-release-readiness-console`,
public launch verdict `FAIL`, `productionReady: false`, 16 proven surfaces, 5
remaining blockers, 5 manual actions, hosted write-back disabled, zero console
errors, and no private/key-shaped visible text.

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

Selected memory review queue apply is disabled unless
`RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY=1` is set. When enabled, it requires
a write checkbox and the exact confirmation phrase `APPLY LOCAL REVIEW QUEUE`.
It writes only content-free decision records to
`.recallweave/review-decisions.jsonl` plus a content-free
`.recallweave/review-queue-audit.jsonl` audit line under the selected local
container root. It rejects review payloads containing `<private>` spans or
key-shaped text, does not write candidate memory text, clears typed paths after
submit, and returns only a redacted `.../container` label, relative file paths,
summary counts, and an audit hash.

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
surfaces matching append-only local memory edit overlays, returns only a
redacted `.../container` label, and writes no agent files.

Selected local memory edit is disabled unless the server starts with
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT=1`. When enabled, it requires a write
checkbox and the exact confirmation phrase `APPLY LOCAL MEMORY EDIT`. It does
not mutate `memories.jsonl` in place. It writes an append-only
`.recallweave/local-memory-edits.jsonl` overlay record plus a content-free
`.recallweave/local-memory-edit-audit.jsonl` audit line under the selected
local container root. The overlay may include the replacement memory text, but
the audit log and server response do not. It rejects payloads containing
`<private>` spans or key-shaped text, clears typed paths and edit text after
submit, and returns only a redacted `.../container` label, relative file paths,
summary counts, and an audit hash. The selected local-container browse preview
can then show the overlay action, reason, and redacted replacement preview next
to the matching memory line without mutating the source JSONL.

Selected local memory materialize is disabled unless the server starts with
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_MATERIALIZE=1`. When enabled, it requires a
write checkbox and the exact confirmation phrase
`APPLY LOCAL MEMORY MATERIALIZE`. It reads append-only local edit overlays,
applies supported safe edits to `memories.jsonl`, writes a local backup under
`.recallweave/backups/`, and appends a content-free
`.recallweave/local-memory-materialize-audit.jsonl` audit line. It rejects
private or key-shaped overlay payloads again before writing. The server
response returns only counts, relative paths, action statuses, and a redacted
`.../container` label.

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
- selected local memory edit overlay,
- selected local memory materialize with backup,
- graph navigation controls for large filtered result sets,
- write confirmation for derived docs,
- wiki lint before save,
- Nucleus snapshot export against a selected redacted local container,
- screenshot/recording safety guardrails,
- accessibility review.

See `docs/LOCAL_CONTAINER_AUDIT.md` for the first safe preflight utility.
