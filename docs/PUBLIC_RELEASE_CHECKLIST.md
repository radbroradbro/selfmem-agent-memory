# Public Release Checklist

Use this checklist before making the repository public.

## Repository Surface

- [ ] Repository is private during final review.
- [ ] License is Apache-2.0.
- [ ] README names RecallWeave and explains the legacy `selfmem_canary` id.
- [ ] Docs do not expose private agent names, raw memories, raw diagnostics, or
  credentials.
- [ ] Benchmark notes are metrics-only and say public scores require a matched
  source-locked canary win, same judge/settings, zero privacy failures, and
  reviewer sign-off.
- [ ] Benchmark notes distinguish retrieval-proxy evidence from end-to-end
  answer-quality evidence and name `benchmark:answer-quality:arms`,
  `benchmark:answer-quality:preflight`, `benchmark:answer-quality`, and
  `benchmark:memory-score:reviewer-intake`, and
  `benchmark:memory-score:result-gate --require-ready` as the required
  conversion path before SOTA or MemoryBench-style language.
- [ ] Live answer-quality results are labeled as incomplete SOTA evidence until
  the same-data Voyage arm, exact-packet reviewer approvals, owner approval,
  and real rollout gates all pass. Current reviewer approvals do not replace a
  missing Voyage result.
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
- [ ] Public live-update draft says whether the release is production ready or
  alpha only.
- [ ] Dummy-data demo storyboard exists and forbids private memory footage.
- [ ] `docs/RELEASE_HANDOFF.md` has the current manual PR, blocked reviewer,
  public visibility, and one-agent canary steps.
- [ ] If GitHub automation cannot update the PR body or create blocker issues,
  the owner has either completed the manual steps or accepted the missing
  GitHub updates in writing.

## Publish

- [ ] Push public-ready commit while the repo is still private.
- [ ] Verify GitHub Actions status.
- [ ] Flip repository visibility only after the owner approves.
