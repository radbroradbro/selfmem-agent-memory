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
    "lifecycle-policy-draft",
    "selected-lifecycle-policy-apply",
    "review-queue-draft",
    "selected-review-queue-apply",
    "vault-path",
    "sync-report",
    "selected-wiki-sync-dry-run",
    "selected-wiki-sync-apply",
    "local-container-audit",
    "selected-local-browse",
    "selected-local-audit",
    "selected-audit-history",
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
  memory review queue, selected sync/audit forms, selected sync apply controls,
  draft export, and the absence of private or key-shaped visible text.
- Browser screenshot capture timed out during that browser pass. The
  timeout is recorded in the DOM evidence file rather than treated as approval.
- The interaction smoke now starts the server with local apply enabled and
  proves selected vault sync apply rejects missing write confirmation, writes
  compiled wiki files only after the exact confirmation phrase, creates a
  content-free audit log, and keeps selected root paths redacted.
- The interaction smoke now starts the server with lifecycle policy apply
  enabled and proves selected policy apply rejects missing write confirmation,
  rejects private or key-shaped policy payloads, writes only the selected local
  `.recallweave/lifecycle-policy.json` plus a content-free audit log, and keeps
  selected root paths redacted.
- The interaction smoke now starts the server with review queue apply enabled
  and proves selected review apply rejects missing write confirmation, rejects
  private or key-shaped review payloads, writes only selected local decision
  metadata plus a content-free audit log, excludes candidate text from the
  decision log, and keeps selected root paths redacted.

Known limits:

- This is still fixture mode for memory browsing and editing. Live local
  container editing and derived-doc apply still need separate
  security-reviewed write paths.
