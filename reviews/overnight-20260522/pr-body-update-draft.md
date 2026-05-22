# PR Body Update Draft

The GitHub connector could read PR #5, but updating the body returned:

```text
FORBIDDEN: Resource not accessible by integration
```

Paste this body into PR #5 when repository permissions allow it.

Retry note:

- A direct PR body update was retried after CI run #44 and still returned the
  same 403.
- A top-level PR comment with a concise status refresh was also attempted and
  returned the same 403.
- This draft was refreshed after CI run `26288370812` passed on `2888f91`.
- It was refreshed again after release-state guard CI run `26289073223` passed
  on `dd17f44`.
- It was refreshed again after guarded lifecycle policy apply CI run
  `26292137539` passed on `3b5e140`.
- It was refreshed again after guarded review queue apply CI run
  `26292772262` passed on `19f2577`.
- It was refreshed again after guarded local memory edit overlay CI run
  `26293533847` passed on `72ab902`.
- It was refreshed again after guarded local edit overlay browse CI run
  `26294323086` passed on `b5352a0`.
- It was refreshed again after guarded local memory materialize CI run
  `26295772356` passed on `21fd4d6`.
- It was refreshed again after the dynamic Brain UI layout slice passed
  GitHub Actions CI run `26297064340` on `be47cff`.
- It was refreshed again after graph navigation controls passed GitHub Actions
  CI run `26297876735` on `62367a1`.
- It was refreshed again after the release handoff gate passed GitHub Actions
  CI run `26298339106` on `aebd205`.
- A direct PR body update was retried after GitHub Actions CI run
  `26298491296` passed on `2175c6e`; it still returned the same 403.
- It was refreshed again after the metrics-only local session compaction audit
  passed GitHub Actions CI run `26298965544` on `be08302`.
- The PR body below is therefore the public-safe source of truth until a human
  can paste it or GitHub integration permissions change.

```markdown
## Summary

- Adds the Nucleus Index contract for memory nodes, lifecycle events, retrieval traces, wiki pages, research questions, hypotheses, decisions, and evidence.
- Adds LLM-wiki compile/sync flow with Obsidian-style frontmatter, wikilinks, index/log pages, provenance, linting, reviewed-page conflict handling, and optional content-free pre-write audit logging.
- Adds a fixture-first Brain UI for graph browsing with a deterministic dynamic graph layout, graph navigation controls, search, container health, Local Audit Preflight, selected local-container audit preview, selected local-container browse preview, selected local memory edit overlay, local edit overlay browse visibility, selected local memory materialize, browser-local selected audit history, selected vault sync dry-run, selected vault sync apply, lifecycle policy preview, selected lifecycle policy apply, memory review queue preview, selected review queue apply, provenance, timeline review, lifecycle/retrieval trace inspection, derived-doc editing, draft export, Nucleus snapshot preview, Research Lineage, vault preview, and sync-report inspection.
- Adds a read-only local-container audit preflight, disabled-by-default selected audit and browse routes, disabled-by-default selected memory edit overlay, local edit overlay browse previews, selected local memory materialize with backup, and content-free selected audit history that return or store counts, health reasons, bounded redacted snippets, or append-only local edit metadata without returning raw root paths.
- Adds `selfmem_update` dry-run-first update flow and fixture smokes for Hermes/OpenClaw adapters, wiki sync, compaction, update flow, and release readiness.
- Adds a metrics-only local-session compaction audit path for private Codex, Claude, Hermes, and OpenClaw exports without printing candidate memory text.
- Adds post-12-hour readiness evidence, a conservative public live-update draft, and a dummy-data demo storyboard.
- Adds `docs/RELEASE_HANDOFF.md` so the owner can manually update the stale PR body, create the blocker issue, accept or rerun the blocked Claude route, and run a one-agent canary with `selfmem_update`.

## Current Verdict

Not production ready for public launch yet.

The code, fixture UI, release gate, and GitHub Actions pass. Public launch should still wait for owner approval and final reviewer-route acceptance because Claude CLI review is blocked by login and the Brain UI remains fixture mode.

## Verification

Latest local verification includes the release handoff gate slice.

- Local `npm run test`: 6 files, 22 tests passed.
- Local `npm exec --yes pnpm@10.23.0 -- smoke`: passed.
- Local `node packages/bench/release-readiness-check.mjs`: passed.
- Local `node packages/bench/session-compaction-local-audit.mjs --strict`: passed.
- Local `git diff --check`: passed.
- Local secret-pattern scan: no hits.
- Local private-name scan: no hits.
- Local dynamic graph layout evidence: `dynamic-graph-layout`, 9 fixture nodes,
  9 fixture edges, 2 columns, 5 rows, zero overlaps, zero console errors, and
  no private/key-shaped visible text.
- Local graph navigation evidence: neighborhood scope, 3 visible fixture nodes,
  9 jump options, selected-node visibility, zero console errors, and no
  private/key-shaped visible text.
- GitHub Actions CI: run `26288370812` passed on `2888f91`, the latest baseline inspected before this draft.
- GitHub Actions CI: run `26289073223` passed on `dd17f44`, the release-state guard follow-up commit.
- GitHub Actions CI: run `26292137539` passed on `3b5e140`, the guarded lifecycle policy apply commit.
- GitHub Actions CI: run `26292772262` passed on `19f2577`, the guarded review queue apply commit.
- GitHub Actions CI: run `26293533847` passed on `72ab902`, the guarded local memory edit overlay commit.
- GitHub Actions CI: run `26294323086` passed on `b5352a0`, the guarded local edit overlay browse commit.
- GitHub Actions CI: run `26295772356` passed on `21fd4d6`, the guarded local memory materialize commit.
- GitHub Actions CI: run `26297064340` passed on `be47cff`, the dynamic Brain UI graph layout commit.
- GitHub Actions CI: run `26297876735` passed on `62367a1`, the graph navigation controls commit.
- GitHub Actions CI: run `26298339106` passed on `aebd205`, the release handoff gate commit.
- GitHub Actions CI: run `26298965544` passed on `be08302`, the metrics-only local session compaction audit commit.
- Gemini focused reviews: sync report, wiki sync audit log, update command, edit export, Container Health, Brain UI local-audit preview, Brain UI selected local-audit preview, Brain UI selected local-container browse, Brain UI local memory edit, Brain UI local edit overlay browse, Brain UI local memory materialize, Brain UI selected audit-history, Brain UI selected vault sync dry-run, Brain UI lifecycle policy preview, Brain UI lifecycle policy apply, Brain UI memory review queue, Brain UI review queue apply, local-container audit, session compaction local audit, Nucleus snapshot, Research Lineage, browser evidence gate, public live-update copy, and release handoff are `CLEAN` after fixes.
- Claude route: blocked, recorded in `reviews/overnight-20260522/claude-pr5-review-blocked.md`.
- Completion audit: `reviews/overnight-20260522/completion-audit.md` says the goal remains active and not complete.

## Safety

- No credentials, raw memories, raw transcripts, private diagnostics, private agent logs, diagnostics zips, or private screenshots are committed.
- Public UI screenshots and DOM evidence use bundled fixture data only.
- Hosted Supermemory is documented as read-through history only. Hosted write-back is not enabled.
- Real session-history compaction remains local-only and out of git.

## Key Evidence Files

- `reviews/overnight-20260522/summary.md`
- `reviews/overnight-20260522/production-readiness.md`
- `reviews/overnight-20260522/release-state.json`
- `reviews/overnight-20260522/public-live-update-draft.md`
- `reviews/overnight-20260522/dummy-brain-demo-storyboard.md`
- `docs/RELEASE_HANDOFF.md`
- `reviews/overnight-20260522/release-handoff-evidence.md`
- `reviews/overnight-20260522/completion-audit.md`
- `reviews/overnight-20260522/ui-evidence/README.md`
- `reviews/overnight-20260522/brain-ui-dynamic-layout-evidence.md`
- `reviews/overnight-20260522/gemini-brain-ui-dynamic-layout-review.md`
- `reviews/overnight-20260522/brain-ui-graph-navigation-evidence.md`
- `reviews/overnight-20260522/gemini-brain-ui-graph-navigation-review.md`
- `reviews/overnight-20260522/session-compaction-local-audit-evidence.md`
- `packages/bench/release-readiness-check.mjs`
```
