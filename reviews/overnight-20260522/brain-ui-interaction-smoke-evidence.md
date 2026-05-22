# Brain UI Interaction Smoke Evidence

Date: 2026-05-22

Scope:

- Added a repeatable Brain UI interaction smoke that exercises the fixture
  brain model without depending on screenshots alone.
- Moved export and selection helpers into `packages/brain-ui/src/model.js` so
  browser UI behavior and smoke tests share the same logic.
- The smoke covers search filtering, retrieval trace visibility, editable node
  handling, Container Health, private/key-shaped edit rejection, draft export,
  Nucleus export, research lineage, vault path selection, dry-run sync
  reporting, and public-safe serialization.

Public-safety boundary:

- The smoke uses bundled public fixture data only.
- It does not read local memory containers, raw transcripts, diagnostics,
  provider keys, hosted Supermemory contents, auth files, or real agent paths.
- Edit export stays fixture-only and reports `writesRealFiles: false`.
- Private-tagged and key-shaped candidate text is constructed in memory and
  verified as rejected/redacted. It is not persisted.

Verification:

- `pnpm brain:smoke`: passed after the model refactor.
- `pnpm brain:interaction`: passed.

Interaction smoke output:

```json
{
  "ok": true,
  "checked": [
    "search-filter",
    "retrieval-trace",
    "editable-node",
    "container-health",
    "private-edit-guard",
    "draft-export",
    "nucleus-export",
    "research-lineage",
    "vault-path",
    "sync-report",
    "public-safe-serialization"
  ]
}
```

Release impact:

- `brain:interaction` and `brain:interaction:built` are now required package
  scripts.
- The aggregate `smoke` script runs `brain:interaction:built` after the normal
  Brain UI smoke.
- The release-readiness check requires this evidence file, the Gemini review
  file, both scripts, and a fresh interaction smoke run.
- A follow-up Codex Browser pass loaded the current evidence baseline and saved
  `ui-evidence/brain-ui-browser-dom-evidence.json`. It verifies
  Nucleus, container health, vault preview, sync report, lifecycle policy,
  memory review queue, selected sync/audit forms, draft export, and the absence
  of private or key-shaped visible text.
- Browser screenshot capture timed out during that browser pass. The
  timeout is recorded in the DOM evidence file rather than treated as approval.

Known limits:

- This is still fixture mode. Live local-container browsing, editing, and vault
  sync need a separate security-reviewed path picker, redacted path display,
  write confirmation, and audit trail before real agent state can be exposed.
