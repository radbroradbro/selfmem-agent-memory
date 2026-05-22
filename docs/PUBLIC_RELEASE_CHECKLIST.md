# Public Release Checklist

Use this checklist before making the repository public.

## Repository Surface

- [ ] Repository is private during final review.
- [ ] License is Apache-2.0.
- [ ] README names RecallWeave and explains the legacy `selfmem_canary` id.
- [ ] Docs do not expose private agent names, raw memories, raw diagnostics, or
  credentials.
- [ ] Benchmark notes are metrics-only and include claim boundaries.
- [ ] Supermemory references are clear, read-only, and non-affiliation-safe.

## Scans

- [ ] Secret scan returns zero hits across the worktree.
- [ ] Forbidden-path scan returns zero raw memory, raw event, auth, database, or
  diagnostics files.
- [ ] `git diff --check` is clean.
- [ ] Remote URL does not contain a token.
- [ ] `pnpm release:check` passes.

## Tests

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm smoke:openclaw`
- [ ] `pnpm smoke:hermes`
- [ ] `pnpm smoke`
- [ ] `pnpm compaction:benchmark` if compaction changed.
- [ ] `pnpm wiki:sync:smoke` if vault sync changed.

## Review

- [ ] Security review completed.
- [ ] Docs clarity review completed.
- [ ] Release claim review completed.
- [ ] Any `CONCERNS` decision has an explicit acceptance note.

## Publish

- [ ] Push public-ready commit while the repo is still private.
- [ ] Verify GitHub Actions status.
- [ ] Flip repository visibility only after the owner approves.
