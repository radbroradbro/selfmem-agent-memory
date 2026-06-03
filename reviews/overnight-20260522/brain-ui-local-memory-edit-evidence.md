# Brain UI Local Memory Edit Evidence

Date: 2026-05-22

Scope: selected local memory edit overlay for the RecallWeave Brain UI.

## Implementation

- Added disabled-by-default server route `POST /local-container/edit`.
- The route requires `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT=1`.
- It requires `confirmWrite: true` and the exact phrase
  `APPLY LOCAL MEMORY EDIT`.
- It rejects payloads containing `<private>` spans or key-shaped text.
- It writes an append-only overlay record to
  `.recallweave/local-memory-edits.jsonl`.
- It writes a content-free audit line to
  `.recallweave/local-memory-edit-audit.jsonl`.
- It does not mutate `memories.jsonl` in place.
- It returns only a redacted root label, relative paths, summary metadata, and
  a content hash.

## UI

- Added a selected local memory edit form to the Brain UI.
- The form captures source file, line, source id, action, reason, replacement
  text, write confirmation, and the confirmation phrase.
- Typed path, phrase, and replacement text are cleared after submit.
- The result summary shows action, source reference, byte count, audit count,
  relative log paths, and content hash.

## Browser Evidence

- Updated `ui-evidence/brain-ui-browser-dom-evidence.json` from the local
  fixture UI.
- Captured fixture-only screenshot:
  `ui-evidence/brain-ui-local-memory-edit.png`.
- The DOM evidence confirms the selected local memory edit controls exist.

## Verification

- `npm run build`: passed.
- `node packages/brain-ui/smoke.mjs`: passed and includes
  `selected-local-edit-disabled`.
- `node packages/brain-ui/interaction-smoke.mjs`: passed and includes
  `selected-local-memory-edit`.

## Safety Boundary

- Public evidence uses fixture text only.
- No credentials, raw memories, raw transcripts, private diagnostics, private
  paths, or private agent logs were added.
- Direct in-place local memory mutation remains disabled.
