# Brain UI Evidence

## Environment

- URL: `http://127.0.0.1:4177`
- Data: `packages/brain-ui/fixtures/nucleus.fixture.json`
- Data class: public-safe dummy fixture

## Browser Evidence

- Codex Browser captured a 2026-06-03 current-head fixture overview after the
  Codex memory reset/product-gate commit. Evidence lives at
  `brain-ui-20260603-browser-evidence.json`, with full-page screenshot
  `brain-ui-20260603-browser-overview.jpg`. It verifies the rendered Nucleus
  graph, update flow, Nucleus snapshot, wiki/vault preview, vault sync report,
  compaction audit, benchmark dashboard, context preview, release readiness
  surface, fixture write-mode visibility, and zero console errors.
- Codex Browser captured a 2026-06-01 current-head live fixture flow after the
  release-gate alignment. The flow searched `native memory`, selected the
  retrieval trace node, and verified lifecycle trail, Nucleus snapshot,
  research lineage, research source lock, wiki/vault compile status, container
  health, update flow, zero console errors, and no private/key-shaped visible
  text. Evidence lives at
  `brain-ui-20260601-current-head-browser-evidence.json`, with screenshot
  `brain-ui-20260601-current-head-filtered-retrieval.jpg`.
- Computer Use opened the local fixture UI in Google Chrome.
- Computer Use verified search/filter controls, graph nodes, node details,
  editable derived doc text area, and save status.
- Headless Chrome via Playwright Core captured
  `brain-ui-fixture-edit.png`.
- DOM evidence captured in `brain-ui-dom-evidence.json`.
- Codex Browser captured sync-report DOM evidence in
  `brain-ui-sync-report-dom-evidence.json`.
- Headless Chrome captured the sync-report panel in
  `brain-ui-sync-report.png`.
- Codex Browser captured edit-export DOM evidence in
  `brain-ui-edit-export-dom-evidence.json`.
- Headless Chrome captured the edit-export panel in
  `brain-ui-edit-export.png`.
- Codex Browser captured Nucleus snapshot DOM evidence in
  `brain-ui-nucleus-snapshot-dom-evidence.json`.
- Headless Chrome captured the fixture-only Nucleus snapshot panel in
  `brain-ui-nucleus-snapshot.png`.
- Headless Chrome captured Research Lineage DOM evidence in
  `brain-ui-research-lineage-dom-evidence.json`.
- Headless Chrome captured the fixture-only Research Lineage panel in
  `brain-ui-research-lineage.png`.
- Headless Chrome captured refreshed Compaction Audit DOM evidence in
  `brain-ui-compaction-audit-evidence.json`.
- Headless Chrome captured the fixture-only Compaction Audit panel in
  `brain-ui-compaction-audit.png`.
- Chrome DevTools captured Container Health DOM evidence in
  `brain-ui-container-health-dom-evidence.json`.
- Chrome DevTools captured the fixture-only Container Health panel in
  `brain-ui-container-health.png`.
- Chrome DevTools captured Local Audit Preflight DOM evidence in
  `brain-ui-local-audit-dom-evidence.json`.
- Chrome DevTools captured the fixture-only Local Audit Preflight panel in
  `brain-ui-local-audit.png`.
- Chrome DevTools captured selected local-container audit DOM evidence in
  `brain-ui-selected-local-audit-dom-evidence.json`.
- Chrome DevTools captured the selected local-container audit panel in
  `brain-ui-selected-local-audit.png`.
- Chrome DevTools captured browser-local selected audit history DOM evidence in
  `brain-ui-selected-audit-history-dom-evidence.json`.
- Chrome DevTools captured the selected audit history panel in
  `brain-ui-selected-audit-history.png`.
- Chrome DevTools captured selected local vault sync dry-run DOM evidence in
  `brain-ui-selected-sync-dry-run-dom-evidence.json`.
- Chrome DevTools captured the selected local vault sync dry-run panel in
  `brain-ui-selected-sync-dry-run.png`.
- Chrome DevTools captured lifecycle policy DOM evidence in
  `brain-ui-lifecycle-policy-dom-evidence.json`.
- Chrome DevTools captured the lifecycle policy draft panel in
  `brain-ui-lifecycle-policy.png`.
- The selected lifecycle policy apply slice was verified by fresh Brain UI
  smoke and interaction smoke. It has no committed screenshot yet; the evidence
  is the gated route, docs, smoke output, and Gemini review.
- Chrome DevTools captured memory review queue DOM evidence in
  `brain-ui-review-queue-dom-evidence.json`.
- Chrome DevTools captured the memory review queue panel in
  `brain-ui-review-queue.png`.
- The selected review queue apply slice was verified by fresh Brain UI smoke
  and interaction smoke. It has no committed screenshot yet; the evidence is
  the gated route, docs, smoke output, and Gemini review.
- The selected local memory edit overlay slice was verified by fresh Brain UI
  smoke, interaction smoke, and updated Browser DOM evidence. A fixture-only
  screenshot was captured at `brain-ui-local-memory-edit.png`.
- The local edit overlay browse slice was verified by fresh Brain UI smoke,
  interaction smoke, local-container audit smoke, and updated Browser DOM
  evidence. A fixture-only screenshot was captured at
  `brain-ui-local-edit-overlay-browse.png`.
- The selected local memory materialize slice was verified by fresh Brain UI
  smoke, interaction smoke, local-container audit smoke, and updated Browser
  DOM evidence. A fixture-only screenshot was captured at
  `brain-ui-local-memory-materialize.png`.
- The dynamic graph layout slice was verified by Codex Browser DOM evidence,
  fresh Brain UI smoke, and interaction smoke. A fixture-only screenshot was
  captured at `brain-ui-dynamic-layout.png`, and
  `brain-ui-dynamic-layout-evidence.json` reports `overlapCount: 0`.
- The graph navigation controls slice was verified by Codex Browser DOM
  evidence, fresh Brain UI smoke, and interaction smoke. A fixture-only
  screenshot was captured at `brain-ui-graph-navigation.png`, and
  `brain-ui-graph-navigation-evidence.json` reports neighborhood scope,
  jump-to-node options, selected-node visibility, zero console errors, and no
  private/key-shaped visible text.
- The Compaction Audit slice was verified by refreshed DOM evidence, fresh
  Brain UI smoke, and interaction smoke. A fixture-only screenshot was captured
  at `brain-ui-compaction-audit.png`, and
  `brain-ui-compaction-audit-evidence.json` reports metrics-only mode, 6 input
  events, 4 candidate fingerprints, 2 redactions, chronological output, 1
  exact-identifier candidate, 4 topic links, 6 lifecycle events, 0 unlinked
  candidates, zero privacy leaks, zero console errors, and no raw candidate
  text.
- The Benchmark Dashboard slice was verified by Codex Browser DOM evidence,
  fresh Brain UI smoke, interaction smoke, and Gemini focused review. A
  fixture-only screenshot was captured at `brain-ui-benchmark-dashboard.png`,
  and `brain-ui-benchmark-dashboard-evidence.json` reports 5 of 5 fixture
  scenarios passed, 0 failed scenarios, 0 privacy leaks, exact-identifier
  accuracy 1, average noise reduction 0.307, hosted-baseline caveat,
  no-raw-text caveat, zero console errors, and no private/key-shaped visible
  text.
- The Canary Rollout slice was verified by Playwright browser evidence, fresh
  Brain UI smoke, interaction smoke, and Gemini focused review. A fixture-only
  screenshot was captured at `brain-ui-canary-rollout.png`, and
  `brain-ui-canary-rollout-evidence.json` reports
  `READY_FOR_ONE_AGENT_CANARY`, one-agent scope, hosted Supermemory
  read-through-only mode, public launch verdict `FAIL`, owner approval
  required, dry-run and rollback steps visible, 11 metrics to collect, zero
  console errors, and no private/key-shaped visible text.
- The Research Source Lock slice was verified by Playwright browser evidence,
  fresh Brain UI smoke, interaction smoke, and Gemini focused review. A
  fixture-only screenshot was captured at `brain-ui-research-source-lock.png`,
  and `brain-ui-research-source-lock-evidence.json` reports 11 public sources,
  10 source-locked sources, 9 recent sources, 8 implementation rules, 3
  benchmark targets, topic-path and stale-supersession rules, collapsed
  technical export, dashboard-to-cluster zoom, human-readable container labels,
  zero console errors, and no private/key-shaped visible text.
- The Context Preview slice was verified by Codex Browser DOM evidence, fresh
  Brain UI smoke, and interaction smoke. A fixture-only screenshot was captured
  at `brain-ui-context-preview.png`, and
  `brain-ui-context-preview-evidence.json` reports 642 of 900 context tokens
  used, 258 tokens remaining, 3 selected memories, 3 context sections, 2
  omitted candidates, hosted read-through as read-only, local-only write mode,
  zero privacy leaks, zero console errors, and no private/key-shaped visible
  text.
- The Release Readiness slice was verified by Codex Browser DOM evidence,
  fresh Brain UI smoke, and interaction smoke. A fixture-only screenshot was
  captured at `brain-ui-release-readiness.png`, and
  `brain-ui-release-readiness-evidence.json` reports public launch verdict
  `FAIL`, `productionReady: false`, 16 proven preview surfaces, 5 blockers, 5
  manual actions, hosted write-back disabled, zero privacy leaks, zero console
  errors, and no private/key-shaped visible text.
- The Current-Head Live Browser slice was verified in the in-app browser on
  head `8777290`. A fixture-only screenshot was captured at
  `brain-ui-current-head-live.png`, and
  `brain-ui-current-head-live-evidence.json` reports Nucleus, wiki/vault sync,
  Model Matrix, Context Preview, Release Readiness, Compaction Audit, Benchmark
  Dashboard, Canary Rollout, Research Source Lock, Lifecycle Trail, lifecycle
  event cards, retrieval trace cards, and `on_pre_compress` fixture text
  visible, with public launch still `FAIL`, zero console errors or warnings,
  and no private/key-shaped visible text.
- The Lifecycle Trail Browser slice was captured separately at
  `brain-ui-lifecycle-trail.png`; `brain-ui-lifecycle-trail-evidence.json`
  records the selected wiki page, event card, retrieval trace card, fixture-only
  mode, zero console errors or warnings, and no private/key-shaped visible text.
- Codex Browser loaded browser evidence baseline `96ae9cc` and captured fresh
  Browser DOM evidence in
  `brain-ui-browser-dom-evidence.json`.
- That browser DOM evidence includes selected local vault sync apply controls,
  including the visible path field, write checkbox, and confirmation phrase
  field.
- The selected local-container browse slice was verified by fresh Brain UI smoke
  and interaction smoke. A later Chrome DevTools capture attempt could not
  connect because no debug Chrome was listening on port `9222`.
- Codex Browser screenshot capture timed out twice for that browser pass,
  so the browser artifact records DOM evidence only. Existing screenshot
  artifacts remain fixture-only visual evidence.

Early Chrome DevTools MCP capture was unavailable because no debug Chrome was
listening on port `9222`. The Container Health capture used a temporary
isolated debug Chrome profile with fixture-only data.

## Reviewer Evidence

- Gemini CLI reviewed the DOM/screenshot evidence in
  `gemini-ui-review.md`.
- Claude CLI produced no review text in `claude-ui-review.md`; treat this as a
  blocked/empty reviewer result, not an approval.
- Z.ai vision timed out after 120 seconds; no vision verdict was used.

## Findings Applied

Gemini found:

- accessibility label run-on text,
- missing update-flow surface,
- missing no-results empty state,
- confidence not visible on graph nodes,
- hardcoded graph geometry.

Applied in this PR:

- node `aria-label` with readable kind/title,
- update-flow panel,
- empty-state message,
- graph-node confidence text,
- deterministic dynamic graph layout with vertical growth and no-overlap
  browser evidence.
- graph navigation controls for all-vs-neighborhood scope, jump-to-node, and
  selected-node centering.

Deferred:

- large-container clustering and pagination after real local-container UX is
  approved.
