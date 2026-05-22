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
  `22e17b1`, run `26305635737`, success.
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
- GitHub Actions CI run `26299756374` on `fb466db`: success.
- GitHub Actions CI run `26300784883` on `0ec4396`: success.
- GitHub Actions CI run `26301888111` on `8c26de7`: success.
- GitHub Actions CI run `26302442423` on `d0113c0`: success.
- GitHub Actions CI run `26302990767` on `f51346f`: success.
- GitHub Actions CI run `26304465466` on `e043d6b`: success.
- GitHub Actions CI run `26305284384` on `13cbe8d`: success.
- GitHub Actions CI run `26305635737` on `22e17b1`: success.

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
| Model/autoresearch matrix gate | `docs/MODEL_MATRIX.md`, `docs/AUTORESEARCH_BENCHMARK_PLAN.md`, `configs/provider-matrix.yaml`, `configs/bench-budget.yaml` |
| Brain UI model matrix | `packages/brain-ui/fixtures/model-matrix.json`, `reviews/overnight-20260522/brain-ui-model-matrix-evidence.md`, `reviews/overnight-20260522/gemini-brain-ui-model-matrix-review.md` |
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
| Brain UI research source lock | `reviews/overnight-20260522/brain-ui-research-source-lock-evidence.md` |
| Brain UI compaction audit | `reviews/overnight-20260522/brain-ui-compaction-audit-evidence.md` |
| Brain UI benchmark dashboard | `reviews/overnight-20260522/brain-ui-benchmark-dashboard-evidence.md` |
| Brain UI canary rollout | `reviews/overnight-20260522/brain-ui-canary-rollout-evidence.md` |
| Brain UI context preview | `reviews/overnight-20260522/brain-ui-context-preview-evidence.md` |
| Brain UI release readiness | `reviews/overnight-20260522/brain-ui-release-readiness-evidence.md` |
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
- Brain UI Compaction Audit verification: release gate now requires
  `brain-ui-compaction-audit-evidence.md`, the screenshot, Browser DOM
  evidence, Gemini review evidence, the `brain-ui-session-compaction-audit`
  release-state surface, and fresh Brain UI smoke and interaction smoke
  coverage. GitHub Actions CI run `26299756374` passed on `fb466db`.
- Brain UI Context Preview verification: local smoke and interaction smoke pass
  with `prompt-context-preview` evidence. Browser DOM evidence reports 642 of
  900 fixture context tokens used, 3 selected memories, 3 context sections, 2
  omitted candidates, read-only hosted mode, local-only writes, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text. GitHub
  Actions CI run `26300784883` passed on `0ec4396`.
- Brain UI Release Readiness verification: local smoke and interaction smoke
  pass with `release-readiness-console` evidence. Browser DOM evidence reports
  public launch verdict `FAIL`, `productionReady: false`, 16 proven preview
  surfaces, 5 remaining blockers, 5 manual actions, fixture-only evidence,
  hosted write-back disabled, zero privacy leaks, zero console errors, and no
  private/key-shaped visible text. GitHub Actions CI run `26301888111` passed
  on `8c26de7`.
- Brain UI Benchmark Dashboard verification: local smoke and interaction smoke
  pass with `benchmark-dashboard` evidence. Browser DOM evidence reports 5 of
  5 fixture scenarios passed, 0 failed scenarios, 0 privacy leaks,
  exact-identifier accuracy 1, average noise reduction 0.307, 3 caveats,
  hosted-baseline caveat visible, zero console errors, and no
  private/key-shaped visible text. GitHub Actions CI run `26302442423` passed
  on `d0113c0`.
- Brain UI Canary Rollout verification: local smoke and interaction smoke pass
  with `canary-rollout` evidence. Browser DOM evidence reports
  `READY_FOR_ONE_AGENT_CANARY`, target scope `one-agent`, hosted Supermemory
  mode `read-through-only`, public launch verdict `FAIL`, owner approval
  required, 5 rollout steps, 11 metrics to collect, rollback and dry-run steps
  visible, zero console errors, and no private/key-shaped visible text. GitHub
  Actions CI run `26302990767` passed on `f51346f`.
- Brain UI Research Source Lock verification: local smoke and interaction
  smoke pass with `research-source-lock` evidence. Browser evidence reports 11
  public sources, 10 source-locked sources, 9 recent sources, 8 implementation
  rules, 3 benchmark targets, topic-path and stale-supersession rules,
  dashboard-to-cluster zoom, collapsed technical export, human-readable
  container labels, zero console errors, and no private/key-shaped visible
  text. GitHub Actions CI run `26304465466` passed on `e043d6b`.
- May 2026 model/autoresearch matrix gate verification: local release check,
  local full smoke, and GitHub Actions CI run `26305284384` passed on
  `13cbe8d`. The gate records Apple Silicon local defaults, Voyage/Gemini/NVIDIA
  challenger arms, env-only provider credentials, clean local runtime rules,
  query expansion disabled by default, and matched-canary-only public benchmark
  claims.
- Model/autoresearch release-gate hardening verification: GitHub Actions CI run
  `26305635737` passed on `22e17b1`. The release check now requires the model
  matrix and autoresearch plan and validates conservative provider, query
  expansion, local runtime, and no-secret guardrails.
- Brain UI Model Matrix verification: local smoke, interaction smoke, browser
  evidence, release readiness check, and Gemini focused review passed locally.
  Browser evidence reports 6 provider arms, 4 cloud arms, 2 local arms, Apple
  Silicon Qwen3 0.6B local default, Voyage/Gemini/NVIDIA cloud arms, query
  expansion off, env-only credentials, 5 gates, 3 blockers, zero console
  errors, and no private/key-shaped visible text.

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
- compaction audit evidence records metrics-only mode, 6 fixture input events,
  4 candidate fingerprints, 2 redactions, chronological output, 1
  exact-identifier candidate, zero privacy leaks, zero console errors, and no
  raw candidate text
- benchmark dashboard evidence records 5 of 5 fixture scenarios passed, 0
  failed scenarios, 0 privacy leaks, exact-identifier accuracy 1, average noise
  reduction 0.307, hosted-baseline caveat visible, zero console errors, and no
  private/key-shaped visible text
- canary rollout evidence records `READY_FOR_ONE_AGENT_CANARY`, one-agent
  scope, read-through-only hosted Supermemory mode, public launch verdict
  `FAIL`, owner approval required, rollback and dry-run steps visible, 11
  metrics to collect, zero console errors, and no private/key-shaped visible
  text
- research source lock evidence records 11 public sources, 10 source-locked
  sources, 9 recent sources, 8 implementation rules, topic/subtopic path,
  stale-memory supersession, budgeted lifecycle-frequency, and
  dashboard-to-cluster zoom rules, collapsed technical export, human-readable
  container labels, zero console errors, and no private/key-shaped visible text
- context preview evidence records the fixture prompt recall packet, 642 of 900
  context tokens used, 258 tokens remaining, 3 selected memories, 3 context
  sections, 2 omitted candidates, hosted read-through as read-only, local-only
  writes, zero privacy leaks, zero console errors, and no private/key-shaped
  visible text
- release readiness evidence records public launch verdict `FAIL`,
  `productionReady: false`, verified CI status, 16 proven preview surfaces, 5
  blockers, 5 manual actions, hosted write-back disabled, zero privacy leaks,
  zero console errors, and no private/key-shaped visible text

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
- Gemini Brain UI context preview review: `CLEAN`, with a note that Gemini CLI
  produced transient capacity warnings before returning the verdict.
- Gemini Brain UI benchmark dashboard review: `CLEAN`, with a note that Gemini
  CLI produced transient capacity warnings before returning the verdict.
- Gemini Brain UI canary rollout review: `CLEAN`.
- Gemini Brain UI research source lock review: `CLEAN`.
- Gemini Brain UI model matrix review: `CLEAN`.
- Gemini Brain UI release readiness review: `CLEAN`, with a note that Gemini
  CLI produced transient capacity warnings before returning the verdict.
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
