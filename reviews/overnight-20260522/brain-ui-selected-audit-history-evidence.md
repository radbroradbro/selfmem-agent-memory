# Brain UI Selected Audit History Evidence

Date: 2026-05-22

Scope:

- Added a browser-local selected audit history for the Brain UI.
- Added `buildSelectedAuditTrailEntry()` and `mergeSelectedAuditTrail()` to
  sanitize and bound selected-audit history entries.
- The UI writes only a content-free trail entry to browser `localStorage`.
- The trail stores redacted container label, status, counts, event name, and
  timestamp.

Safety boundary:

- The selected audit route remains disabled by default.
- Agent files remain read-only.
- The browser-local history does not store raw memory text, raw event text,
  provider keys, or full local root paths.
- History entries report `writesRealFiles: false`.
- The history list is bounded by the model helper.

Verification:

- `pnpm brain:smoke`: passed.
- `pnpm brain:interaction`: passed.
- Interaction smoke includes private/key-shaped synthetic prior history and
  path-shaped synthetic prior history and verifies public-safe serialization.
- Prior browser history is re-sanitized and path-like values are collapsed to
  `.../basename`.
- Chrome DevTools captured selected-audit-history DOM evidence and screenshot.
- Browser DOM evidence shows:
  - one history entry,
  - `local_container_audit_preview`,
  - two files,
  - two lines,
  - zero redactions,
  - input cleared after submit,
  - full local root path absent from visible text and stored history,
  - no visible or stored private/key-shaped text.
- Browser console evidence: no console messages.

Artifacts:

- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-selected-audit-history.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-selected-audit-history-dom-evidence.json`.

Known limits:

- This is browser-local history, not a committed agent-side audit log.
- Real local-container browse/edit/sync still needs write confirmation and wiki
  lint before any file write.
