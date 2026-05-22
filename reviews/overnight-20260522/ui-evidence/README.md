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

Chrome DevTools MCP was unavailable because no debug Chrome was listening on
port `9222`. The run fell back to Computer Use plus headless Chrome.

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
