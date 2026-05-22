# Brain UI Evidence

## Environment

- URL: `http://127.0.0.1:4177`
- Data: `packages/brain-ui/fixtures/nucleus.fixture.json`
- Data class: public-safe dummy fixture

## Browser Evidence

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
- graph-node confidence text.

Deferred:

- dynamic graph layout engine for non-fixture data.
