# Brain UI Selected Sync Dry-Run Evidence

Date: 2026-05-22

Scope:

- Added a disabled-by-default selected local vault sync dry-run to the Brain UI.
- Added `/wiki/sync/dry-run` behind
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1`.
- Required read-only confirmation before the server reads the selected vault
  root.
- Cleared the typed path after submit.
- Returned only redacted `.../container` display text, relative sync actions,
  and counts.
- Kept `writesRealFiles: false` and `dryRun: true`.

Evidence:

- `pnpm brain:smoke`: passed.
- `pnpm brain:interaction`: passed with `selected-wiki-sync-dry-run`.
- Browser evidence:
  - `reviews/overnight-20260522/ui-evidence/brain-ui-selected-sync-dry-run-dom-evidence.json`
  - `reviews/overnight-20260522/ui-evidence/brain-ui-selected-sync-dry-run.png`

DOM evidence proves:

- selected sync controls are visible,
- the typed root path is cleared after submit,
- the visible root uses a redacted `.../` display,
- the raw selected root path is absent from visible text,
- private/key-shaped text is absent,
- a conflict action is visible,
- no writes-enabled text is present,
- console messages are empty.

Boundary:

- This is a fixture-based, read-only dry-run preview.
- It does not browse raw memories.
- It does not write wiki files.
- Real selected-vault apply remains deferred until write confirmation, reviewer
  approval, and public-safe audit evidence exist.
