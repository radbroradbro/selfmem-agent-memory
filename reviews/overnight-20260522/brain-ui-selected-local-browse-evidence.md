# Brain UI Selected Local Browse Evidence

Date: 2026-05-22

Scope:

- Added `browseLocalContainer()` for bounded read-only local memory previews.
- Added `/local-container/browse` for selected local-container browse previews.
- The route is disabled unless the server starts with
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_BROWSE=1`.
- The route requires `confirmReadOnly: true`.
- The UI path field is visible text for operator clarity and is cleared after
  submit.
- The response returns only a redacted `.../container` label, redacted item
  snippets, source file names, line numbers, event labels, counts, and an
  audit-trail summary.

Safety boundary:

- The route writes no files.
- The route reads only `memories.jsonl`, `trace.jsonl`, and
  `lossless_context.jsonl`.
- The browse report caps file size and item count.
- Fully private entries are skipped and counted.
- Private spans and key-shaped text are redacted before display.
- The default Brain UI server returns `local_browse_disabled`.
- Selected browse output reports `writesRealFiles: false`.

Verification:

- `tests/local-container/audit.test.ts` covers redacted browse output, skipped
  private entries, event extraction, and no raw root path.
- `pnpm brain:smoke`: passed.
- `pnpm brain:interaction`: passed.
- Interaction smoke covers disabled-by-default behavior, missing confirmation,
  selected browse success, redaction counts, no selected root path, and
  public-safe serialization.

Known limits:

- This is still a read-only browse preview.
- Selected local memory edits now use a separate disabled-by-default append-only
  overlay path. Direct in-place local memory mutation remains blocked.
