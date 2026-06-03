# Brain UI Local Memory Materialize Evidence

Date: 2026-05-22

Scope: selected local memory edit overlays can now be materialized into a
selected local `memories.jsonl` file under explicit write confirmation.

## Implementation

- `materializeLocalMemoryEdits()` reads `.recallweave/local-memory-edits.jsonl`
  and applies supported safe overlays to `memories.jsonl`.
- Supported actions are `replace`, `append_correction`, and `suppress`.
- Private or key-shaped overlay payloads are skipped again at materialize time.
- Previously materialized overlays are skipped on rerun using content-free audit
  fingerprints, so append corrections are not duplicated.
- A backup is written under `.recallweave/backups/` before source memory writes.
- A content-free audit line is appended to
  `.recallweave/local-memory-materialize-audit.jsonl`.
- The Brain UI route is disabled unless
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_MATERIALIZE=1` is set.
- The route requires the exact confirmation phrase
  `APPLY LOCAL MEMORY MATERIALIZE`.

## UI

- The selected local memory materialize form sits next to the selected local
  edit overlay form.
- The UI reports applied, replaced, appended, skipped, backup path, and audit
  log path.
- The UI does not display original memory contents in the materialize response.

## Browser Evidence

- Updated `ui-evidence/brain-ui-browser-dom-evidence.json`.
- Captured fixture-only screenshot:
  `ui-evidence/brain-ui-local-memory-materialize.png`.
- The browser evidence checks confirm:
  - `hasLocalMemoryMaterialize: true`
  - `hasLocalMaterializeBackup: true`
  - `hasPrivateOrKeyText: false`

## Verification

- `npm run build`: passed.
- `npm run test`: passed, 22 tests.
- `node packages/brain-ui/smoke.mjs`: passed and covers the disabled route.
- `node packages/brain-ui/interaction-smoke.mjs`: passed and includes
  `selected-local-edit-materialize`.
- `node packages/bench/local-container-audit-smoke.mjs`: passed and reports
  `materializeApplied: 1`.

## Safety Boundary

- Public evidence uses fixture data only.
- The selected root path is redacted in responses.
- Materialize writes only after an environment gate, checkbox, and exact phrase.
- Audit logs are content-free.
- Backups are local to the selected container.
