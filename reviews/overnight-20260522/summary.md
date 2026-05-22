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
  `be08302`, run `26298965544`, success.
- Latest release-state guard CI:
  `dd17f44`, run `26289073223`, success.
- PR API state when checked: open, not draft, mergeable, clean.
- GitHub Actions CI run `26288370812` on `2888f91`: success.
- GitHub Actions CI run `26290534116` on `103e7c6`: success.
- GitHub Actions CI run `26291352800` on `04f1096`: success.
- GitHub Actions CI run `26292137539` on `3b5e140`: success.
- GitHub Actions CI run `26292772262` on `19f2577`: success.
- GitHub Actions CI run `26293533847` on `72ab902`: success.
- GitHub Actions CI run `26294323086` on `b5352a0`: success.
- GitHub Actions CI run `26295772356` on `21fd4d6`: success.
- GitHub Actions CI run `26297064340` on `be47cff`: success.
- GitHub Actions CI run `26297876735` on `62367a1`: success.
- GitHub Actions CI run `26298339106` on `aebd205`: success.
- GitHub Actions CI run `26298965544` on `be08302`: success.

## Shipped Overnight Slices

| Area | Evidence |
| --- | --- |
| Nucleus Index | `packages/core/src/nucleus/index.ts`, `docs/NUCLEUS_INDEX.md`, `reviews/overnight-20260522/wiki-vault-evidence.md` |
| LLM-wiki compiler | `packages/core/src/wiki/compiler.ts`, `packages/bench/wiki-vault-smoke.mjs`, `reviews/overnight-20260522/wiki-vault-evidence.md` |
| Wiki vault disk sync | `packages/core/src/wiki/sync.ts`, `packages/bench/wiki-vault-sync-smoke.mjs`, `reviews/overnight-20260522/wiki-vault-sync-evidence.md` |
| Wiki sync audit log | `packages/core/src/wiki/sync.ts`, `reviews/overnight-20260522/gemini-wiki-sync-audit-log-review.md` |
| Brain UI graph and editor | `packages/brain-ui/`, `reviews/overnight-20260522/ui-evidence/README.md` |
| Brain UI dynamic graph layout | `packages/brain-ui/src/model.js`, `reviews/overnight-20260522/brain-ui-dynamic-layout-evidence.md`, `reviews/overnight-20260522/gemini-brain-ui-dynamic-layout-review.md` |
| Brain UI graph navigation controls | `packages/brain-ui/src/model.js`, `packages/brain-ui/src/app.js`, `reviews/overnight-20260522/brain-ui-graph-navigation-evidence.md`, `reviews/overnight-20260522/gemini-brain-ui-graph-navigation-review.md` |
| Brain UI vault preview | `reviews/overnight-20260522/brain-ui-vault-preview-evidence.md` |
| Brain UI sync report | `reviews/overnight-20260522/brain-ui-sync-report-evidence.md` |
| Brain UI draft export | `reviews/overnight-20260522/brain-ui-edit-export-evidence.md` |
| Brain UI container health | `reviews/overnight-20260522/brain-ui-container-health-evidence.md` |
| Brain UI local audit preview | `reviews/overnight-20260522/brain-ui-local-audit-preview-evidence.md` |
| Brain UI selected local-container browse | `reviews/overnight-20260522/brain-ui-selected-local-browse-evidence.md` |
| Brain UI selected local-container browse review | `reviews/overnight-20260522/gemini-brain-ui-selected-local-browse-review.md` |
| Brain UI selected local memory edit overlay | `reviews/overnight-20260522/brain-ui-local-memory-edit-evidence.md` |
| Brain UI selected local memory edit review | `reviews/overnight-20260522/gemini-brain-ui-local-memory-edit-review.md` |
| Brain UI local edit overlay browse | `reviews/overnight-20260522/brain-ui-local-edit-overlay-browse-evidence.md` |
| Brain UI local edit overlay browse review | `reviews/overnight-20260522/gemini-brain-ui-local-edit-overlay-browse-review.md` |
| Brain UI selected local memory materialize | `reviews/overnight-20260522/brain-ui-local-memory-materialize-evidence.md` |
| Brain UI selected local memory materialize review | `reviews/overnight-20260522/gemini-brain-ui-local-memory-materialize-review.md` |
| Brain UI selected vault sync dry-run | `reviews/overnight-20260522/brain-ui-selected-sync-dry-run-evidence.md` |
| Brain UI selected vault sync apply | `packages/brain-ui/server.mjs`, `packages/brain-ui/interaction-smoke.mjs`, `reviews/overnight-20260522/ui-evidence/brain-ui-browser-dom-evidence.json` |
| Selected vault sync apply review | `reviews/overnight-20260522/gemini-selected-sync-apply-review.md` |
| Brain UI lifecycle policy preview | `reviews/overnight-20260522/brain-ui-lifecycle-policy-evidence.md` |
| Brain UI lifecycle policy apply | `reviews/overnight-20260522/brain-ui-lifecycle-policy-apply-evidence.md` |
| Brain UI lifecycle policy apply review | `reviews/overnight-20260522/gemini-brain-ui-lifecycle-policy-apply-review.md` |
| Brain UI memory review queue | `reviews/overnight-20260522/brain-ui-review-queue-evidence.md` |
| Brain UI memory review queue apply | `reviews/overnight-20260522/brain-ui-review-queue-apply-evidence.md` |
| Brain UI memory review queue apply review | `reviews/overnight-20260522/gemini-brain-ui-review-queue-apply-review.md` |
| Brain UI Nucleus snapshot | `reviews/overnight-20260522/brain-ui-nucleus-snapshot-evidence.md` |
| Brain UI research lineage | `reviews/overnight-20260522/brain-ui-research-lineage-evidence.md` |
| Brain UI interaction smoke | `packages/brain-ui/interaction-smoke.mjs`, `reviews/overnight-20260522/brain-ui-interaction-smoke-evidence.md` |
| Browser DOM evidence | `reviews/overnight-20260522/ui-evidence/brain-ui-browser-dom-evidence.json` |
| Browser evidence gate review | `reviews/overnight-20260522/gemini-browser-evidence-gate-review.md` |
| Local container audit preflight | `packages/core/src/local-container/audit.ts`, `reviews/overnight-20260522/local-container-audit-evidence.md` |
| Agent update command | `bin/selfmem_update`, `reviews/overnight-20260522/update-flow-evidence.md` |
| Session compaction benchmark | `packages/bench/session-compaction-benchmark.mjs`, `reviews/overnight-20260522/session-compaction-benchmark-evidence.md` |
| Local-session compaction audit | `packages/bench/session-compaction-local-audit.mjs`, `reviews/overnight-20260522/session-compaction-local-audit-evidence.md` |
| Public release gate | `packages/bench/release-readiness-check.mjs`, `reviews/overnight-20260522/release-readiness-evidence.md` |
| Release handoff | `docs/RELEASE_HANDOFF.md`, `reviews/overnight-20260522/release-handoff-evidence.md` |
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

- `npm run test`: passed, 22 tests.
- `pnpm smoke`: passed.
- `pnpm brain:interaction`: passed for the Brain UI model refactor slice.
- `pnpm wiki:sync:smoke`: passed with 12 pre-write audit entries.
- `pnpm container:audit:smoke`: passed.
- `pnpm release:check`: passed.
- `git diff --check`: passed.
- Public secret-pattern scan: no hits.
- Private-name scan: no hits.
- Release handoff follow-up: `docs/RELEASE_HANDOFF.md` added and required by
  `release:check`.
- Local-session compaction audit: `pnpm compaction:local-audit:built` passed
  in metrics-only mode with 6 input events, 2 redactions, 4 candidate
  fingerprints, chronological output, and zero privacy leaks.
- GitHub Actions CI: success on the latest inspected baseline, `be08302`.
- GitHub Actions CI: success on release-state guard commit `dd17f44`, run
  `26289073223`.
- GitHub Actions CI: success on guarded selected vault sync apply commit
  `103e7c6`, run `26290534116`.
- GitHub Actions CI: success on guarded selected local-container browse commit
  `04f1096`, run `26291352800`.
- GitHub Actions CI: success on guarded selected lifecycle policy apply commit
  `3b5e140`, run `26292137539`.
- GitHub Actions CI: success on guarded selected review queue apply commit
  `19f2577`, run `26292772262`.
- GitHub Actions CI: success on guarded selected local memory edit overlay
  commit `72ab902`, run `26293533847`.
- GitHub Actions CI: success on guarded local edit overlay browse commit
  `b5352a0`, run `26294323086`.
- GitHub Actions CI: success on guarded local memory materialize commit
  `21fd4d6`, run `26295772356`.
- Dynamic Brain UI layout verification: local smoke and interaction smoke
  passed with `dynamic-graph-layout` evidence, and GitHub Actions CI run
  `26297064340` passed on `be47cff`.
- Graph navigation verification: local smoke and interaction smoke passed with
  `graph-navigation-controls` evidence, and GitHub Actions CI run
  `26297876735` passed on `62367a1`.
- Release handoff verification: local release gate, full smoke, tests,
  private-name scan, Gemini review, and GitHub Actions CI run `26298339106`
  passed on `aebd205`.
- Local-session compaction audit verification: release gate now requires
  `session-compaction-local-audit-evidence.md`, the local audit script, and
  the `session-compaction-local-audit` release-state surface.
  GitHub Actions CI run `26298965544` passed on `be08302`.

Automation rerun evidence from 2026-05-22T14:42Z is recorded in
`automation-rerun-20260522T1442Z.md`. That rerun passed the non-server fixture
smokes, tests, syntax checks, `git diff --check`, and a core package dry-run
with a repo-local npm cache. Fresh Brain UI server/browser checks remain
blocked in this automation sandbox by loopback `listen EPERM` and Browser
`file://` policy, so the packet continues to rely on the existing sanitized
fixture screenshots and DOM evidence for visual review.

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
- `brain-ui-local-memory-edit.png`
- `brain-ui-edit-export.png`
- `brain-ui-nucleus-snapshot.png`
- `brain-ui-research-lineage.png`
- matching DOM evidence JSON for the UI, vault preview, sync report, and edit
  draft export, plus Container Health, Local Audit Preflight, Nucleus snapshot,
  selected local-container audit, selected local-container browse, selected
  audit history, selected vault sync dry-run, lifecycle policy, memory review
  queue, and research-lineage previews
- `brain-ui-browser-dom-evidence.json`, captured by Codex Browser
  against browser evidence baseline `96ae9cc`; screenshot capture timed out and is recorded in
  the artifact
- selected vault sync apply controls are present in browser DOM evidence and
  interaction smoke proves writes require `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY`
  plus the exact `APPLY LOCAL WIKI SYNC` phrase
- selected lifecycle policy apply controls are present in the current Brain UI
  source and interaction smoke proves writes require
  `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY` plus the exact
  `APPLY LOCAL LIFECYCLE POLICY` phrase
- selected review queue apply controls are present in the current Brain UI
  source and interaction smoke proves writes require
  `RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY` plus the exact
  `APPLY LOCAL REVIEW QUEUE` phrase
- selected local memory edit controls are present in Browser DOM evidence and
  interaction smoke proves writes require
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT` plus the exact
  `APPLY LOCAL MEMORY EDIT` phrase
- selected local edit overlay browse evidence is present in Browser DOM
  evidence and interaction smoke proves a matching append-only overlay appears
  in the selected local-container browse without mutating `memories.jsonl`
- selected local memory materialize controls are present in Browser DOM
  evidence and interaction smoke proves safe overlays can be written into
  `memories.jsonl` with a backup and content-free audit log
- dynamic graph layout evidence records `dynamic-graph-layout`, 9 fixture
  nodes, 9 fixture edges, 2 columns, 5 rows, zero node overlaps, no console
  errors, and no private/key-shaped visible text
- graph navigation evidence records all-vs-neighborhood scope, 3 visible
  neighborhood nodes, 9 jump options, selected-node visibility, zero console
  errors, and no private/key-shaped visible text

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
- Gemini Brain UI selected local-container browse review: `CLEAN`.
- Gemini Brain UI selected audit-history review: `CLEAN`.
- Gemini Brain UI selected vault sync dry-run review: `CLEAN`.
- Gemini selected vault sync apply review: first `BLOCK`, then final `CLEAN`
  after explicit lint checking and visible path fields were added.
- Gemini Brain UI lifecycle policy review: `CLEAN`.
- Gemini Brain UI lifecycle policy apply review: first `BLOCK` for missing env
  gate docs, then final `CLEAN` after `docs/BRAIN_UI.md` documented the apply
  path.
- Gemini Brain UI review queue review: `CLEAN`.
- Gemini Brain UI review queue apply review: `CLEAN`.
- Gemini Brain UI local memory edit review: `CLEAN`.
- Gemini Brain UI local edit overlay browse review: `CLEAN`.
- Gemini Brain UI local memory materialize review: `CLEAN`.
- Gemini Nucleus snapshot review: first `CONCERNS`, then final `CLEAN` after
  object-key redaction was fixed and smoke-guarded.
- Gemini research-lineage review: `CLEAN`.
- Gemini Brain UI interaction-smoke review: `CLEAN`.
- Gemini browser evidence gate review: `CLEAN`.
- Gemini local-container audit review: `CLEAN`.
- Gemini public live-update copy review: `CLEAN`.
- Gemini completion-audit review: first `BLOCK` because the audit was untracked
  and absent from the diff, then final `CLEAN` after staging.
- Gemini session compaction local audit review: `CLEAN`.
- Gemini blocker-permission refresh review: `CLEAN`.
- Gemini release-state guard review: `CLEAN`.
- Gemini release-handoff review: `CLEAN`.
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
- Brain UI selected local-container browse is disabled by default, requires
  read-only confirmation, clears the typed path, returns bounded redacted
  memory/trace snippets, skips fully private entries, and writes no files.
- Brain UI local edit overlay browse surfaces matching append-only edit
  overlays beside selected local-container browse entries using redacted
  previews only, and still writes no files.
- Brain UI selected local memory materialize is disabled by default, requires
  the local materialize environment flag, requires write confirmation plus an
  exact phrase, writes a backup, applies supported safe overlays to
  `memories.jsonl`, appends a content-free audit line, skips private/key-shaped
  overlays, and returns only redacted root labels and relative paths.
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
- Brain UI selected lifecycle policy apply is disabled by default, requires the
  policy apply environment flag, requires write confirmation plus an exact
  phrase, rejects private/key-shaped policy payloads, writes only a sanitized
  selected local `.recallweave/lifecycle-policy.json` plus a content-free audit
  line, and returns only redacted root labels and relative paths.
- Brain UI memory review queue is fixture-only. It stages approve, suppress,
  merge, and needs-more-evidence decisions as `writesRealFiles: false` draft
  output and does not write real memories.
- Brain UI selected memory review queue apply is disabled by default, requires
  the review apply environment flag, requires write confirmation plus an exact
  phrase, rejects private/key-shaped review payloads, writes only selected
  local decision metadata plus a content-free audit line, excludes candidate
  text, and returns only redacted root labels and relative paths.
- Brain UI selected local memory edit is disabled by default, requires the
  local edit environment flag, requires write confirmation plus an exact
  phrase, rejects private/key-shaped edit payloads, writes only an append-only
  local edit overlay plus a content-free audit line, does not mutate
  `memories.jsonl` in place, and returns only redacted root labels and relative
  paths.
- Wiki vault sync is explicit and protects reviewed pages by writing conflict
  notes instead of overwriting.
- Wiki vault sync can append a content-free pre-write audit log when
  `auditLogPath` is supplied.
- `selfmem_update` is dry-run by default and requires `--apply` before copying
  files.

## Residual Risks

- Claude review is blocked until Claude CLI is logged in.
- The Brain UI has read-only selected local-container audit and browse previews,
  browser-local audit history, plus write-confirmed selected vault sync apply,
  write-confirmed selected lifecycle policy apply, and write-confirmed selected
  review queue apply, plus write-confirmed selected local memory edit overlays
  with read-only overlay browse visibility and guarded materialization.
  Freeform in-place local memory mutation remains disabled outside the guarded
  materialize path.
- The compaction benchmark uses public fixtures. Private local Codex or Claude
  session-history runs must stay local and may commit only aggregate metrics or
  reusable tooling. The local-session compaction audit now provides that
  metrics-only path without candidate text.
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
