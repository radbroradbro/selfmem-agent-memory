# Brain UI Selected Local Audit Evidence

Date: 2026-05-22

Scope:

- Added `/local-container/audit` for selected local-container audit previews.
- The route is disabled unless the server starts with
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1`.
- The route requires `confirmReadOnly: true`.
- The UI path field is visible text for operator clarity, wrapped in a form,
  and cleared after submit.
- The response returns only a redacted `.../container` label, counts, health
  reasons, and an audit-trail summary.

Safety boundary:

- The route writes no files.
- The route does not return raw memory text, raw event text, raw trace text,
  provider keys, or the full selected root path.
- The default Brain UI server returns `local_audit_disabled`.
- Selected audit output reports `writesRealFiles: false`.

Verification:

- `pnpm brain:smoke`: passed.
- `pnpm brain:interaction`: passed.
- Chrome DevTools captured selected-audit DOM evidence and screenshot.
- Browser DOM evidence shows:
  - selected-audit controls present,
  - read-only selected audit completed,
  - two existing files,
  - two lines,
  - zero redactions,
  - input cleared after submit,
  - redacted `.../container` root visible,
  - full local root path not visible,
  - no visible private/key-shaped text.
- Browser console evidence: no console messages.

Artifacts:

- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-selected-local-audit.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-selected-local-audit-dom-evidence.json`.

Known limits:

- This is still a read-only audit preview.
- Editable real memory state still needs write confirmation, wiki lint before
  save, and a persistent local audit log.
