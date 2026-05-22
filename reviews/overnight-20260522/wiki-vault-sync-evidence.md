# Wiki Vault Disk Sync Evidence

Date: 2026-05-22

Scope:

- Added `syncCompiledWikiVault()` as an explicit apply step for compiled
  Nucleus wiki vaults.
- Added a fixture-safe `pnpm wiki:sync:smoke` gate.
- Kept disk writes opt-in and pointed at a caller-provided vault directory.

Public-safety boundary:

- Sync refuses compiled vaults with lint issues.
- Sync writes only relative compiled vault paths under the selected root.
- Sync does not read real agent homes, raw memory logs, databases, or private
  diagnostics.
- If an existing markdown page has `reviewed: true`, sync leaves it unchanged
  and writes a sanitized proposed update under `wiki/_conflicts/`.
- Conflict notes do not copy the existing reviewed page contents.

Verification:

- `pnpm wiki:sync:smoke`: passed with 12 compiled files, 11 writes, 1
  reviewed-page conflict note, and dry-run coverage.
- `pnpm test`: 16 tests passed.
- `pnpm typecheck`: passed.
- `pnpm smoke`: passed with wiki sync smoke included.
- `pnpm release:check`: passed.
- Gemini cold review first returned `BLOCK` for code-fence injection in conflict
  notes, YAML quoting, reviewed-page detection scope, and missing edge tests.
- Follow-up patch added dynamic markdown fences, JSON-quoted conflict titles,
  frontmatter-scoped reviewed detection, conflict filename cleanup, and tests
  for dry run, skip policy, unsafe paths, and fenced markdown.
- Gemini final re-review returned `CLEAN`.

Known limits:

- This sync helper does not delete stale pages yet.
- This sync helper does not merge manual edits. It preserves reviewed pages and
  creates conflict notes for a later human or agent pass.
