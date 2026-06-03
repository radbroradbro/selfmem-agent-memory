# Brain UI Local Edit Overlay Browse Evidence

Date: 2026-05-22

Scope: selected local-container browse now surfaces append-only local memory
edit overlays.

## Implementation

- `browseLocalContainer()` now reads
  `.recallweave/local-memory-edits.jsonl` when present.
- It attaches matching overlay actions, reasons, and redacted replacement
  previews to browsed memory entries by source file, line, or source id.
- It reports overlay counts and overlay redaction counts.
- It does not mutate `memories.jsonl`.
- Oversize, missing, and unreadable overlay files are reported without throwing.

## UI

- The Brain UI selected browse list now renders matching overlays under the
  relevant memory line.
- Fixture browse shows an overlay next to the matching fixture memory.

## Browser Evidence

- Updated `ui-evidence/brain-ui-browser-dom-evidence.json`.
- Captured fixture-only screenshot:
  `ui-evidence/brain-ui-local-edit-overlay-browse.png`.
- The Browser evidence checks confirm:
  - `hasLocalEditOverlayBrowse: true`
  - `hasLocalEditOverlayPreview: true`
  - `hasPrivateOrKeyText: false`

## Verification

- `npm run build`: passed after the overlay report type was tightened.
- `npm run test`: passed.
- `node packages/brain-ui/smoke.mjs`: passed.
- `node packages/brain-ui/interaction-smoke.mjs`: passed and includes
  `selected-local-edit-overlay-browse`.
- `node packages/bench/local-container-audit-smoke.mjs`: passed and reports
  `browseOverlayCount: 1`.

## Safety Boundary

- Public evidence uses fixture data only.
- Replacement previews are redacted before display.
- Root paths are not returned.
- Direct in-place local memory mutation remains disabled.
