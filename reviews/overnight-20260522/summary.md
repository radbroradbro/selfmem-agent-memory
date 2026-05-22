# RecallWeave Overnight Summary

Date: 2026-05-22

Thread goal: run and supervise the 12-hour RecallWeave product goal loop for
Nucleus Index, wiki/vault sync, self-hosted Brain UI, update flow, and
local-only memory compaction benchmarking.

Verdict: post-12-hour production readiness remains FAIL for public launch. The
fresh controller run and GitHub CI now pass, but final reviewer/human approval
is still required before any public live update.

## Current PR State

- Repository: `radbroradbro/selfmem-agent-memory`
- Pull request: <https://github.com/radbroradbro/selfmem-agent-memory/pull/5>
- Branch: `feat/nucleus-wiki-native-contract`
- Base: `main`
- Latest CI-inspected public-draft baseline:
  `2888f91`
- Latest release-state guard CI:
  `dd17f44`, run `26289073223`, success.
- PR API state when checked: open, not draft, mergeable, clean.
- GitHub Actions CI run `26288370812` on `2888f91`: success.

## Shipped Overnight Slices

| Area | Evidence |
| --- | --- |
| Nucleus Index | `packages/core/src/nucleus/index.ts`, `docs/NUCLEUS_INDEX.md`, `reviews/overnight-20260522/wiki-vault-evidence.md` |
| LLM-wiki compiler | `packages/core/src/wiki/compiler.ts`, `packages/bench/wiki-vault-smoke.mjs`, `reviews/overnight-20260522/wiki-vault-evidence.md` |
| Wiki vault disk sync | `packages/core/src/wiki/sync.ts`, `packages/bench/wiki-vault-sync-smoke.mjs`, `reviews/overnight-20260522/wiki-vault-sync-evidence.md` |
| Wiki sync audit log | `packages/core/src/wiki/sync.ts`, `reviews/overnight-20260522/gemini-wiki-sync-audit-log-review.md` |
| Brain UI graph and editor | `packages/brain-ui/`, `reviews/overnight-20260522/ui-evidence/README.md` |
| Brain UI vault preview | `reviews/overnight-20260522/brain-ui-vault-preview-evidence.md` |
| Brain UI sync report | `reviews/overnight-20260522/brain-ui-sync-report-evidence.md` |
| Brain UI draft export | `reviews/overnight-20260522/brain-ui-edit-export-evidence.md` |
| Brain UI container health | `reviews/overnight-20260522/brain-ui-container-health-evidence.md` |
| Brain UI local audit preview | `reviews/overnight-20260522/brain-ui-local-audit-preview-evidence.md` |
| Brain UI selected vault sync dry-run | `reviews/overnight-20260522/brain-ui-selected-sync-dry-run-evidence.md` |
| Brain UI selected vault sync apply | `packages/brain-ui/server.mjs`, `packages/brain-ui/interaction-smoke.mjs`, `reviews/overnight-20260522/ui-evidence/brain-ui-browser-dom-evidence.json` |
| Selected vault sync apply review | `reviews/overnight-20260522/gemini-selected-sync-apply-review.md` |
| Brain UI lifecycle policy preview | `reviews/overnight-20260522/brain-ui-lifecycle-policy-evidence.md` |
| Brain UI memory review queue | `reviews/overnight-20260522/brain-ui-review-queue-evidence.md` |
| Brain UI Nucleus snapshot | `reviews/overnight-20260522/brain-ui-nucleus-snapshot-evidence.md` |
| Brain UI research lineage | `reviews/overnight-20260522/brain-ui-research-lineage-evidence.md` |
| Brain UI interaction smoke | `packages/brain-ui/interaction-smoke.mjs`, `reviews/overnight-20260522/brain-ui-interaction-smoke-evidence.md` |
| Browser DOM evidence | `reviews/overnight-20260522/ui-evidence/brain-ui-browser-dom-evidence.json` |
| Browser evidence gate review | `reviews/overnight-20260522/gemini-browser-evidence-gate-review.md` |
| Local container audit preflight | `packages/core/src/local-container/audit.ts`, `reviews/overnight-20260522/local-container-audit-evidence.md` |
| Agent update command | `bin/selfmem_update`, `reviews/overnight-20260522/update-flow-evidence.md` |
| Session compaction benchmark | `packages/bench/session-compaction-benchmark.mjs`, `reviews/overnight-20260522/session-compaction-benchmark-evidence.md` |
| Public release gate | `packages/bench/release-readiness-check.mjs`, `reviews/overnight-20260522/release-readiness-evidence.md` |
| Conservative release-state manifest | `reviews/overnight-20260522/release-state.json` |
| Release-state guard review | `reviews/overnight-20260522/gemini-release-state-guard-review.md` |
| Post-12-hour readiness verdict | `reviews/overnight-20260522/production-readiness.md` |
| Public live-update draft | `reviews/overnight-20260522/public-live-update-draft.md` |
| Dummy Brain demo storyboard | `reviews/overnight-20260522/dummy-brain-demo-storyboard.md` |
| Public live-update copy review | `reviews/overnight-20260522/gemini-public-live-update-copy-review.md` |
| PR body/comment update draft | `reviews/overnight-20260522/pr-body-update-draft.md` |
| GitHub issue creation blocker | `reviews/overnight-20260522/github-issue-create-blocked.md` |
| Blocker permission refresh review | `reviews/overnight-20260522/gemini-blocker-permission-refresh-review.md` |
| Completion audit | `reviews/overnight-20260522/completion-audit.md` |
| Completion audit review | `reviews/overnight-20260522/gemini-completion-audit-review.md` |

## Verification Run

Latest local verification before this summary:

- `pnpm test`: passed, 20 tests.
- `pnpm smoke`: passed.
- `pnpm brain:interaction`: passed for the Brain UI model refactor slice.
- `pnpm wiki:sync:smoke`: passed with 12 pre-write audit entries.
- `pnpm container:audit:smoke`: passed.
- `pnpm release:check`: passed.
- `git diff --check`: passed.
- Public secret-pattern scan: no hits.
- Private-name scan: no hits.
- GitHub Actions CI: success on the latest inspected baseline, `2888f91`.
- GitHub Actions CI: success on release-state guard commit `dd17f44`, run
  `26289073223`.

## UI Evidence

Sanitized fixture evidence exists under
`reviews/overnight-20260522/ui-evidence/`:

- `brain-ui-fixture-edit.png`
- `brain-ui-vault-preview.png`
- `brain-ui-sync-report.png`
- `brain-ui-container-health.png`
- `brain-ui-local-audit.png`
- `brain-ui-selected-local-audit.png`
- `brain-ui-selected-audit-history.png`
- `brain-ui-selected-sync-dry-run.png`
- `brain-ui-lifecycle-policy.png`
- `brain-ui-review-queue.png`
- `brain-ui-edit-export.png`
- `brain-ui-nucleus-snapshot.png`
- `brain-ui-research-lineage.png`
- matching DOM evidence JSON for the UI, vault preview, sync report, and edit
  draft export, plus Container Health, Local Audit Preflight, Nucleus snapshot,
  selected local-container audit, selected audit history, selected vault sync
  dry-run, lifecycle policy, memory review queue, and research-lineage previews
- `brain-ui-browser-dom-evidence.json`, captured by Codex Browser
  against browser evidence baseline `96ae9cc`; screenshot capture timed out and is recorded in
  the artifact
- selected vault sync apply controls are present in browser DOM evidence and
  interaction smoke proves writes require `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY`
  plus the exact `APPLY LOCAL WIKI SYNC` phrase

The evidence uses bundled fixture data only. It does not show raw memories,
raw transcripts, credentials, private diagnostics, private agent paths, or real
local memory contents.

## Reviewer Evidence

- Gemini UI review: concerns found and applied in earlier UI slice.
- Gemini wiki/vault reviews: final `CLEAN`.
- Gemini wiki sync audit-log review: `CLEAN`.
- Gemini sync-report review: `CLEAN`.
- Gemini update-command review: first `BLOCK`, then final `CLEAN` after symlink
  resolution was fixed and tested.
- Gemini edit-export review: `CLEAN`.
- Gemini Container Health review: `CLEAN`, with a note that Gemini CLI produced
  transient routing warnings before returning the verdict.
- Gemini Brain UI local-audit preview review: `CLEAN`.
- Gemini Brain UI selected local-audit review: `CLEAN`.
- Gemini Brain UI selected audit-history review: `CLEAN`.
- Gemini Brain UI selected vault sync dry-run review: `CLEAN`.
- Gemini selected vault sync apply review: first `BLOCK`, then final `CLEAN`
  after explicit lint checking and visible path fields were added.
- Gemini Brain UI lifecycle policy review: `CLEAN`.
- Gemini Brain UI review queue review: `CLEAN`.
- Gemini Nucleus snapshot review: first `CONCERNS`, then final `CLEAN` after
  object-key redaction was fixed and smoke-guarded.
- Gemini research-lineage review: `CLEAN`.
- Gemini Brain UI interaction-smoke review: `CLEAN`.
- Gemini browser evidence gate review: `CLEAN`.
- Gemini local-container audit review: `CLEAN`.
- Gemini public live-update copy review: `CLEAN`.
- Gemini completion-audit review: first `BLOCK` because the audit was untracked
  and absent from the diff, then final `CLEAN` after staging.
- Gemini blocker-permission refresh review: `CLEAN`.
- Gemini release-state guard review: `CLEAN`.
- Gemini production-readiness review: blocked by CLI browser authentication.
- Claude CLI route: blocked because Claude CLI is not logged in. See
  `reviews/overnight-20260522/claude-pr5-review-blocked.md`.

## Safety Boundaries

- No credentials are committed.
- No raw memory files are committed.
- No raw transcripts are committed.
- No diagnostics zips are committed.
- No hosted Supermemory write-back is enabled.
- Brain UI writes are fixture-only. The draft export states
  `writesRealFiles: false`.
- Brain UI model helpers are covered by a repeatable interaction smoke for
  search, retrieval traces, draft export, Nucleus export, research lineage,
  vault path selection, sync reporting, and private/key-shaped edit rejection.
- Local-container audit preflight is read-only, redacts the selected root path,
  returns counts and health reasons only, and never returns raw memory/event
  text.
- Brain UI local-audit preview uses a temporary fixture container and displays
  counts/reasons only.
- Brain UI selected local-audit mode is disabled by default, requires read-only
  confirmation, clears the typed path, and displays only a redacted
  `.../container` label.
- Brain UI selected audit history is browser-local and stores only redacted
  labels, counts, status, event name, and timestamp.
- Brain UI selected vault sync dry-run is disabled by default, requires
  read-only confirmation, clears the typed path, returns only a redacted root
  label plus relative action counts, and writes no wiki files.
- Brain UI selected vault sync apply is disabled by default, requires the local
  apply environment flag, requires write confirmation plus an exact phrase,
  writes only compiled wiki files, and emits content-free audit-log entries.
- Brain UI lifecycle policy preview is fixture-only. It stages recall/write
  settings as `writesRealFiles: false` draft output and does not edit host
  config files.
- Brain UI memory review queue is fixture-only. It stages approve, suppress,
  merge, and needs-more-evidence decisions as `writesRealFiles: false` draft
  output and does not write real memories.
- Wiki vault sync is explicit and protects reviewed pages by writing conflict
  notes instead of overwriting.
- Wiki vault sync can append a content-free pre-write audit log when
  `auditLogPath` is supplied.
- `selfmem_update` is dry-run by default and requires `--apply` before copying
  files.

## Residual Risks

- Claude review is blocked until Claude CLI is logged in.
- The Brain UI has read-only selected local-container audit preview and
  browser-local audit history plus write-confirmed selected vault sync apply,
  but real local-container browse/edit, lifecycle policy apply, and review-queue
  apply still need write confirmation and UI wiring.
- The compaction benchmark uses public fixtures. Private local Codex or Claude
  session-history runs must stay local and may commit only aggregate metrics or
  reusable tooling.
- Benchmark comparison against hosted Supermemory is not a release claim. The
  current public docs correctly require a fresh valid baseline before quality
  marketing.
- The post-12-hour production-ready verdict remains `FAIL` for public launch.
  Fresh controller and CI checks pass, but Claude remains blocked, the GitHub
  app cannot update the PR body, add a PR status comment, or create the blocker
  issue, and a human release decision has not been made.

## Next Recommended Slice

Use `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`
as the conservative issue text unless PR #5 is updated directly. Do not publish
a live update until reviewer blockers and human approval are resolved.
