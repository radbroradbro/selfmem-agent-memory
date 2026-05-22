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
- graph-node confidence text.

Deferred:

- dynamic graph layout engine for non-fixture data.
