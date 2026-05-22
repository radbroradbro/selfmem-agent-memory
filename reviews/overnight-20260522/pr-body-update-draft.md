# PR Body Update Draft

The GitHub connector could read PR #5, but updating the body returned:

```text
FORBIDDEN: Resource not accessible by integration
```

Paste this body into PR #5 when repository permissions allow it.

```markdown
## Summary

- Adds the Nucleus Index contract for memory nodes, lifecycle events, retrieval traces, wiki pages, research questions, hypotheses, decisions, and evidence.
- Adds LLM-wiki compile/sync flow with Obsidian-style frontmatter, wikilinks, index/log pages, provenance, linting, reviewed-page conflict handling, and optional content-free pre-write audit logging.
- Adds a fixture-first Brain UI for graph browsing, search, container health, Local Audit Preflight, selected local-container audit preview, browser-local selected audit history, provenance, timeline review, lifecycle/retrieval trace inspection, derived-doc editing, draft export, Nucleus snapshot preview, Research Lineage, vault preview, and sync-report inspection.
- Adds a read-only local-container audit preflight, disabled-by-default selected audit route, and content-free selected audit history that return or store counts and health reasons without returning raw memory/event text or private root paths.
- Adds `selfmem_update` dry-run-first update flow and fixture smokes for Hermes/OpenClaw adapters, wiki sync, compaction, update flow, and release readiness.
- Adds post-12-hour readiness evidence, a conservative public live-update draft, and a dummy-data demo storyboard.

## Current Verdict

Not production ready for public launch yet.

The code, fixture UI, release gate, and GitHub Actions pass. Public launch should still wait for owner approval and final reviewer-route acceptance because Claude CLI review is blocked by login and the Brain UI remains fixture mode.

## Verification

Latest local verification includes the wiki sync audit-log slice.

- Local `pnpm test`: 6 files, 20 tests passed.
- Local `pnpm smoke`: passed.
- Local `pnpm container:audit:smoke`: passed.
- Local `pnpm release:check`: passed.
- Local `git diff --check`: passed.
- Local secret-pattern scan: no hits.
- Local private-name scan: no hits.
- GitHub Actions `CI / Verify`: run #43 passed on `9e6554c`, the latest code-changing head inspected before this draft.
- Gemini focused reviews: sync report, wiki sync audit log, update command, edit export, Container Health, Brain UI local-audit preview, Brain UI selected local-audit preview, Brain UI selected audit-history, local-container audit, Nucleus snapshot, Research Lineage, and public live-update copy are `CLEAN` after fixes.
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
- `reviews/overnight-20260522/public-live-update-draft.md`
- `reviews/overnight-20260522/dummy-brain-demo-storyboard.md`
- `reviews/overnight-20260522/completion-audit.md`
- `reviews/overnight-20260522/ui-evidence/README.md`
- `packages/bench/release-readiness-check.mjs`
```
