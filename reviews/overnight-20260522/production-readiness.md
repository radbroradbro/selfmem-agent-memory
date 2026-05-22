# Production Readiness

Date: 2026-05-22

Verdict: FAIL

RecallWeave should not receive a public live update yet. PR #5 is substantial
and directionally aligned with the LLM-wiki/Nucleus/Brain UI target, but the
gate still lacks enough final reviewer and human-approval evidence to mark it
production ready.

## Current PR Trail

- PR: <https://github.com/radbroradbro/selfmem-agent-memory/pull/5>
- State checked through the GitHub connector: open, not draft, mergeable.
- Inline review threads checked through the GitHub connector: none unresolved.
- Branch: `feat/nucleus-wiki-native-contract`
- Base: `main`

## What Actually Shipped Or Was Proposed

Evidence in PR #5 and `reviews/overnight-20260522/` shows proposed work for:

- Nucleus Index contracts for memory nodes, lifecycle events, retrieval traces,
  wiki pages, and research lineage.
- LLM-wiki compiler and disk-sync flow with lint and reviewed-page conflict
  handling, plus optional content-free pre-write audit logging.
- Fixture-first Brain UI for search, graph/index inspection, provenance,
  lifecycle/retrieval trace inspection, derived doc editing, draft export,
  vault preview, sync report, Nucleus snapshot preview, local audit preflight,
  selected local-container audit preview, browser-local selected audit history,
  selected local-container browse preview, selected local memory edit overlay,
  local edit overlay browse visibility, selected local memory materialize,
  selected vault sync dry-run,
  selected vault sync apply, lifecycle policy preview, selected lifecycle
  policy apply, memory review queue preview, and selected review queue apply.
- Deterministic Brain UI dynamic graph layout that derives visible node
  positions from the current Nucleus graph, grows vertically, scrolls when
  needed, and replaces the older fixed fixture coordinates.
- Brain UI graph navigation controls for all-vs-neighborhood scope,
  jump-to-node selection, and selected-node centering.
- Brain UI Compaction Audit panel that renders local-session audit metrics and
  candidate fingerprints without raw session or candidate text.
- Brain UI Benchmark Dashboard panel that renders fixture local-only
  compaction benchmark pass/fail metrics, exact-identifier accuracy, noise
  reduction, scenario status, and benchmark caveats without raw session or
  candidate text.
- Brain UI Canary Rollout panel that renders one-agent canary prerequisites,
  dry-run/apply/observe/rollback steps, metrics to collect, blockers, and
  caveats without touching a real agent or local path.
- Brain UI Research Source Lock panel that renders current public sources,
  implementation rules, topic-path and stale-memory supersession decisions,
  dashboard-to-cluster zoom direction, benchmark targets, collapsed technical
  export, and source caveats without touching private research notes or local
  memory.
- Brain UI Context Preview panel that renders the fixture prompt recall packet,
  selected memories, omitted candidates, token budget, read-only hosted mode,
  local-only write mode, and safety counters.
- Brain UI Release Readiness panel that renders the current fixture public
  launch verdict, production-ready flag, verified CI status, proven surfaces,
  blockers, manual actions, hosted write-back status, and safety counters.
- Session compaction fixture benchmark.
- Dry-run-first updater wrapper and updater smoke.
- Release-readiness gate.

These are proposed on PR #5. They are not yet merged to `main`.

## Verification Run

Passed in this run:

- `npm run build`
- `npm run test`: 6 files, 22 tests
- `npm run typecheck`
- `npm run privacy:test`
- `npm run smoke:openclaw`: `privacyLeakCount: 0`
- `npm run smoke:hermes`: `privacyLeakCount: 0`
- `npm run compaction:smoke:built`
- `npm run compaction:benchmark:built`: 5 of 5 scenarios passed,
  `privacyLeakCount: 0`, exact identifier accuracy 1
- `npm run wiki:smoke:built`
- `npm run wiki:sync:smoke:built`
- `npm run update:smoke`
- `npm run release:check`
- `git diff --check`
- Core package `npm pack --dry-run` when npm used a writable temporary cache

Initial cron-environment blockers:

- `pnpm install --frozen-lockfile`: blocked because the sandbox could not resolve
  the npm registry.
- `npm run brain:smoke:built`: failed because localhost binding was denied in
  this sandbox.
- `npm run release:check`: failed on the fresh Brain UI smoke for the same
  localhost binding reason. With a writable npm cache, package dry-run passed.
- Claude CLI reviewer: blocked because the CLI is not logged in.
- Gemini CLI production-readiness reviewer: blocked because the CLI requested
  browser authentication and did not return a review.

Controller follow-up after that sandbox run:

- `pnpm brain:smoke`: passed with the fresh Brain UI.
- `pnpm release:check`: passed.
- GitHub Actions CI run `26288370812` on inspected baseline `2888f91` passed,
  including Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26289073223` on release-state guard commit `dd17f44`
  passed after the Gemini guard review became required.
- GitHub Actions CI run `26290534116` on guarded selected vault sync apply
  commit `103e7c6` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26291352800` on guarded selected local-container
  browse commit `04f1096` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26292137539` on guarded selected lifecycle policy
  apply commit `3b5e140` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26292772262` on guarded selected review queue apply
  commit `19f2577` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26293533847` on guarded selected local memory edit
  overlay commit `72ab902` passed Test, Full smoke, and Release readiness
  check.
- GitHub Actions CI run `26294323086` on guarded local edit overlay browse
  commit `b5352a0` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26295772356` on guarded local memory materialize
  commit `21fd4d6` passed Test, Full smoke, and Release readiness check.
- Focused Gemini reviews for the Nucleus snapshot and Research Lineage slices
  returned final `CLEAN` verdicts.
- Focused Gemini reviews for Brain UI local-audit preview and selected
  local-audit preview returned `CLEAN` verdicts.
- Focused Gemini review for selected local-container browse returned `CLEAN`.
- Focused Gemini review for selected local memory edit returned `CLEAN`.
- Focused Gemini review for local edit overlay browse returned `CLEAN`.
- Focused Gemini review for local memory materialize returned `CLEAN`.
- Focused Gemini review for selected audit-history returned `CLEAN`.
- Focused Gemini reviews for selected vault sync dry-run and lifecycle policy
  preview returned `CLEAN`.
- Focused Gemini review for memory review queue returned `CLEAN`.
- Focused Gemini review for selected review queue apply returned `CLEAN`.
- GitHub Actions CI run `26288370812` on inspected baseline `2888f91` passed.
- GitHub Actions CI run `26289073223` on release-state guard commit `dd17f44`
  passed.
- GitHub Actions CI run `26290534116` on guarded selected vault sync apply
  commit `103e7c6` passed.
- GitHub Actions CI run `26291352800` on guarded selected local-container
  browse commit `04f1096` passed.
- GitHub Actions CI run `26292137539` on guarded selected lifecycle policy
  apply commit `3b5e140` passed.
- GitHub Actions CI run `26292772262` on guarded selected review queue apply
  commit `19f2577` passed.
- GitHub Actions CI run `26293533847` on guarded selected local memory edit
  overlay commit `72ab902` passed.
- GitHub Actions CI run `26294323086` on guarded local edit overlay browse
  commit `b5352a0` passed.
- GitHub Actions CI run `26295772356` on guarded local memory materialize
  commit `21fd4d6` passed.
- GitHub Actions CI run `26297064340` on dynamic graph layout commit
  `be47cff` passed Test, Full smoke, and Release readiness check. Browser
  evidence reports `dynamic-graph-layout`, 9 fixture nodes, 9 fixture edges, 2
  columns, 5 rows, zero overlaps, zero console errors, and no
  private/key-shaped visible text.
- GitHub Actions CI run `26297876735` on graph navigation controls commit
  `62367a1` passed Test, Full smoke, and Release readiness check. Browser
  evidence reports neighborhood scope, 3 visible fixture nodes, 9 jump options,
  selected-node visibility, zero console errors, and no private/key-shaped
  visible text.
- GitHub Actions CI run `26299756374` on Brain UI Compaction Audit commit
  `fb466db` passed Test, Full smoke, and Release readiness check. Browser
  evidence reports metrics-only mode, 6 fixture input events, 4 candidate
  fingerprints, 2 redactions, chronological output, 1 exact-identifier
  candidate, zero privacy leaks, zero console errors, and no raw candidate
  text.
- GitHub Actions CI run `26300784883` on Brain UI Context Preview commit
  `0ec4396` passed Test, Full smoke, and Release readiness check.
- GitHub Actions CI run `26301888111` on Brain UI Release Readiness commit
  `8c26de7` passed Test, Full smoke, and Release readiness check.
- Brain UI Context Preview local verification passed fresh Brain UI smoke and
  interaction smoke. Browser evidence reports 642 of 900 fixture context tokens
  used, 258 tokens remaining, 3 selected memories, 3 context sections, 2
  omitted candidates, hosted read-through as read-only, local-only writes, zero
  privacy leaks, zero console errors, and no private/key-shaped visible text.
- Brain UI Release Readiness local verification passed fresh Brain UI smoke
  and interaction smoke. Browser evidence reports public launch verdict `FAIL`,
  `productionReady: false`, 16 proven surfaces, 5 remaining blockers, 5 manual
  actions, fixture-only evidence, hosted write-back disabled, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text. GitHub
  Actions CI run `26301888111` passed on `8c26de7`.
- Brain UI Benchmark Dashboard local verification passed fresh Brain UI smoke
  and interaction smoke. Browser evidence reports 5 of 5 fixture scenarios
  passed, 0 failed scenarios, 0 privacy leaks, exact-identifier accuracy 1,
  average noise reduction 0.307, hosted-baseline caveat visible, no-raw-text
  caveat visible, zero console errors, and no private/key-shaped visible text.
  GitHub Actions CI run `26302442423` passed on `d0113c0`.
- Brain UI Canary Rollout local verification passed fresh Brain UI smoke and
  interaction smoke. Browser evidence reports `READY_FOR_ONE_AGENT_CANARY`,
  one-agent scope, hosted Supermemory read-through-only mode, public launch
  verdict `FAIL`, owner approval required, 5 steps, 11 metrics to collect,
  rollback and dry-run steps visible, zero console errors, and no
  private/key-shaped visible text. GitHub Actions CI run `26302990767` passed
  on `f51346f`.
- Brain UI Research Source Lock local verification passed fresh Brain UI smoke,
  interaction smoke, browser evidence, release readiness check, and GitHub
  Actions CI run `26304465466` on `e043d6b`. Browser evidence reports 11
  public sources, 8 implementation rules, dashboard-to-cluster zoom,
  topic/subtopic path and stale-supersession rules, zero console errors, and no
  private/key-shaped visible text.

## UI Evidence

Existing fixture-only UI evidence is present under
`reviews/overnight-20260522/ui-evidence/`, including screenshots and DOM
evidence for:

- main Brain UI graph/editor,
- vault preview,
- sync report,
- edit draft export,
- Nucleus snapshot preview.
- research-lineage preview,
- local audit preflight,
- selected local-container audit preview,
- selected local-container browse preview,
- selected local memory edit overlay,
- local edit overlay browse visibility,
- selected local memory materialize,
- selected audit history.
- selected vault sync dry-run,
- selected vault sync apply,
- lifecycle policy preview.
- selected lifecycle policy apply.
- memory review queue preview.
- selected review queue apply.
- Codex Browser DOM evidence for the main Brain UI surfaces.
- dynamic graph layout evidence with zero overlaps and fixture-only text.
- graph navigation controls evidence with fixture-only neighborhood scope and
  jump-to-node controls.
- compaction audit evidence with metrics-only fixture output, 6 input events,
  4 candidate fingerprints, chronological output, zero privacy leaks, zero
  console errors, and no raw candidate text.
- benchmark dashboard evidence with fixture local-only compaction benchmark
  metrics, 5 of 5 scenarios passed, hosted-baseline caveat, no-raw-text caveat,
  zero privacy leaks, zero console errors, and no private/key-shaped visible
  text.
- canary rollout evidence with fixture one-agent rollout status, dry-run and
  rollback path, metrics to collect, public launch still blocked, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text.
- research source lock evidence with 11 public sources, 8 implementation
  rules, topic/subtopic path, stale-memory supersession, budgeted
  lifecycle-frequency decisions, dashboard-to-cluster zoom direction,
  collapsed technical export, zero privacy leaks, zero console errors, and no
  private/key-shaped visible text.
- context preview evidence with the fixture prompt recall packet, selected and
  omitted candidates, token budget, read-only hosted mode, local-only writes,
  zero privacy leaks, zero console errors, and no private/key-shaped visible
  text.
- release readiness evidence with the fixture public launch verdict, blocker
  list, manual action list, CI status, hosted write-back disabled, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text.

Initial cron limitation: that run could not launch the UI on localhost, so it
could not issue a PASS verdict by itself. The controller follow-up and GitHub CI
now prove the fixture UI and release gate can pass, but public release should
still wait for the remaining reviewer and human-approval gates.

## Readiness Grades

| Area | Grade | Reason |
| --- | --- | --- |
| Security/privacy | PASS WITH CONCERNS | Redaction, secret-pattern, forbidden-file, and privacy smokes are strong, but current reviewer routes are blocked. |
| Install/update ergonomics | PASS WITH CONCERNS | Updater smoke passes and wrapper is dry-run-first; clean install could not be rerun because package registry DNS is unavailable. |
| Local-first memory correctness | PASS WITH CONCERNS | Hermes/OpenClaw smokes and compaction fixtures pass; selected local-container audit and browse previews are read-only and gated, selected local memory edits use append-only overlays, overlay browse makes those edits visible, selected local memory materialize applies safe overlays with duplicate-rerun skipping, backup, and content-free audit, and browser-local history is content-free. |
| LLM-wiki integrity | PASS WITH CONCERNS | Compiler, lint, and sync conflict smoke pass on fixtures; live user vault confirmation flow is still future work. |
| UI usefulness | PASS WITH CONCERNS | Fixture UI evidence exists, the graph now uses a dynamic layout and navigation controls rather than fixed coordinates alone, Compaction Audit shows metrics-only local-session evidence, Benchmark Dashboard shows fixture local-only compaction quality metrics and caveats, Canary Rollout shows the one-agent dry-run/apply/observe/rollback path, Context Preview shows the prompt recall packet and omitted candidates, Release Readiness shows the current public launch verdict and blockers, selected local-container audit and browse previews, selected local memory edit overlay, local edit overlay browse visibility, selected local memory materialize, selected vault sync dry-run, selected vault sync apply, lifecycle policy preview, selected lifecycle policy apply, memory review queue preview/apply, and history are gated/read-only/content-free, and fresh controller/CI checks pass. |
| Docs clarity | PASS WITH CONCERNS | Docs and evidence are extensive, but the public launch story needs a clean verdict and blocked-route notes. |
| Test coverage | PASS WITH CONCERNS | Core fixture coverage is good; browser/Playwright rerun is blocked in this environment. |
| Rollback safety | PASS WITH CONCERNS | Updater is dry-run-first and uses fixture smoke, but public live update should wait for release-gate pass. |

## Blocking Issue Or PR Follow-Up

Use
`reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`
as a conservative issue draft if the current PR is not immediately updated.

## Public Live Update Status

Do not publish a public live update from this evidence set. The next public note
can say that PR #5 is a public readiness candidate with fixture Brain UI and
Nucleus/wiki work under review, but it should not call RecallWeave production
ready.

## Demo Plan With Dummy Fixture Data

Use only bundled fixture data:

1. Start the Brain UI from a clean checkout.
2. Search for the native-memory fixture.
3. Open the Nucleus graph/index view and inspect node kinds.
4. Confirm the dynamic graph layout shows the fixture graph without node
   overlaps.
5. Open provenance and retrieval trace panels.
6. Edit the derived native-memory doc, then show save/cancel and draft export.
7. Open the Nucleus snapshot preview and confirm `writesRealFiles: false`.
8. Open the wiki/vault preview and sync report, including the reviewed-page
   conflict note.
9. Open the local audit preflight panel.
10. Open selected vault sync apply and show that it requires explicit write
   confirmation before it can write files.
11. Open the lifecycle policy preview and stage a no-write draft export.
12. In a throwaway fixture only, start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY=1`, open selected lifecycle
   policy apply, and show that it requires explicit write confirmation before
   it can write the local policy file.
13. Open the memory review queue and stage a no-write candidate decision.
14. In a throwaway fixture only, start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY=1`, open selected review queue
   apply, and show that it requires explicit write confirmation before it can
   write the local decision log.
15. Optional, in a throwaway fixture only: start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1` and
   `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_BROWSE=1`, run selected local-container
   audit and browse, confirm the visible path is redacted, and confirm local
   edit overlay browse shows only redacted overlay previews.
16. Optional, in a throwaway fixture only: start with
   `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_MATERIALIZE=1`, run selected local memory
   materialize, and confirm backup plus audit paths are relative and
   content-free.
17. End with the release-readiness gate output and residual alpha caveats.

Do not record real local memories, raw session history, private diagnostics,
credentials, private paths, or real agent logs.
