# Brain UI Sync Report Evidence

Date: 2026-05-22

Scope:

- Added a fixture-only `/fixtures/wiki-sync-report.json` endpoint to the Brain
  UI server.
- Added a Vault Sync Report panel that shows dry-run writes, reviewed-page
  conflicts, and top sync actions beside the compiled wiki preview.
- Updated Brain UI smoke coverage to verify the endpoint, panel code, CSS,
  conflict reporting, and public-safe fixture output.
- Updated the release-readiness gate so the sync-report screenshot and DOM
  evidence are required before public release review can pass.

Public-safety boundary:

- The endpoint compiles the bundled fixture snapshot only.
- It creates a temporary fixture vault and returns the root as
  `fixture-temp-vault`.
- It does not read local memory containers, real agent homes, raw transcripts,
  diagnostics, auth files, provider keys, hosted Supermemory contents, or real
  vault paths.
- The UI displays dry-run output only. It does not write to a selected real
  vault.

Verification expectations:

- Brain UI smoke fetches `/fixtures/wiki-sync-report.json`.
- The response has `ok: true`, `dryRun: true`, `rootDir:
  fixture-temp-vault`, at least one write, and at least one
  `write_conflict_note` action.
- Combined fixture, vault, and sync-report JSON contains no private-tag content
  or common key shapes.
- Browser evidence should show the Vault Sync Report panel with dry-run status,
  write count, conflict count, and a conflict note path.

Verification:

- `pnpm brain:smoke`: passed.
- Codex Browser opened `http://127.0.0.1:4177` and captured DOM evidence.
- Browser DOM evidence shows the Vault Sync Report heading, dry-run status, 11
  writes, 1 conflict, a conflict path, zero console warnings or errors, and no
  visible private/key-shaped text.
- Screenshot capture through the Browser backend timed out, so the screenshot
  was captured with local headless Chrome against the same localhost server.
- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-sync-report.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-sync-report-dom-evidence.json`.
- Gemini CLI returned `CLEAN`. Its optional defense-in-depth suggestion was to
  make temp-root containment explicit before seeding the reviewed-page conflict;
  that patch was applied.

Known limits:

- This is still fixture mode. Real local-container browse/edit/sync mode needs
  an explicit path picker, write confirmation, and a redacted container audit
  before it can be enabled.
