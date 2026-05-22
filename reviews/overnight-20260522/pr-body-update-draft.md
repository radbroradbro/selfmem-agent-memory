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
- The PR body below is therefore the public-safe source of truth until a human
  can paste it or GitHub integration permissions change.

```markdown
## Summary

- Adds the Nucleus Index contract for memory nodes, lifecycle events, retrieval traces, wiki pages, research questions, hypotheses, decisions, and evidence.
- Adds LLM-wiki compile/sync flow with Obsidian-style frontmatter, wikilinks, index/log pages, provenance, linting, reviewed-page conflict handling, and optional content-free pre-write audit logging.
- Adds a fixture-first Brain UI for graph browsing, search, container health, Local Audit Preflight, selected local-container audit preview, selected local-container browse preview, selected local memory edit overlay, browser-local selected audit history, selected vault sync dry-run, selected vault sync apply, lifecycle policy preview, selected lifecycle policy apply, memory review queue preview, selected review queue apply, provenance, timeline review, lifecycle/retrieval trace inspection, derived-doc editing, draft export, Nucleus snapshot preview, Research Lineage, vault preview, and sync-report inspection.
- Adds a read-only local-container audit preflight, disabled-by-default selected audit and browse routes, disabled-by-default selected memory edit overlay, and content-free selected audit history that return or store counts, health reasons, bounded redacted snippets, or append-only local edit metadata without returning raw root paths.
- Adds `selfmem_update` dry-run-first update flow and fixture smokes for Hermes/OpenClaw adapters, wiki sync, compaction, update flow, and release readiness.
- Adds post-12-hour readiness evidence, a conservative public live-update draft, and a dummy-data demo storyboard.

## Current Verdict

Not production ready for public launch yet.

The code, fixture UI, release gate, and GitHub Actions pass. Public launch should still wait for owner approval and final reviewer-route acceptance because Claude CLI review is blocked by login and the Brain UI remains fixture mode.

## Verification

Latest local verification includes the guarded local memory edit overlay slice.

- Local `npm run test`: 6 files, 21 tests passed.
- Local `npm exec --yes pnpm@10.23.0 -- smoke`: passed.
- Local `node packages/bench/release-readiness-check.mjs`: passed.
- Local `git diff --check`: passed.
- Local secret-pattern scan: no hits.
- Local private-name scan: no hits.
- GitHub Actions CI: run `26288370812` passed on `2888f91`, the latest baseline inspected before this draft.
- GitHub Actions CI: run `26289073223` passed on `dd17f44`, the release-state guard follow-up commit.
- GitHub Actions CI: run `26292137539` passed on `3b5e140`, the guarded lifecycle policy apply commit.
- GitHub Actions CI: run `26292772262` passed on `19f2577`, the guarded review queue apply commit.
- GitHub Actions CI: run `26293533847` passed on `72ab902`, the guarded local memory edit overlay commit.
- Gemini focused reviews: sync report, wiki sync audit log, update command, edit export, Container Health, Brain UI local-audit preview, Brain UI selected local-audit preview, Brain UI selected local-container browse, Brain UI local memory edit, Brain UI selected audit-history, Brain UI selected vault sync dry-run, Brain UI lifecycle policy preview, Brain UI lifecycle policy apply, Brain UI memory review queue, Brain UI review queue apply, local-container audit, Nucleus snapshot, Research Lineage, browser evidence gate, and public live-update copy are `CLEAN` after fixes.
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
- `reviews/overnight-20260522/completion-audit.md`
- `reviews/overnight-20260522/ui-evidence/README.md`
- `packages/bench/release-readiness-check.mjs`
```
