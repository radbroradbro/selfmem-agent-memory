# Wiki Vault Compiler Evidence

Date: 2026-05-22

Scope:

- Added a fixture-safe Nucleus-to-LLM-wiki compiler.
- Added a lint pass for generated wiki files.
- Added `pnpm wiki:smoke` and included it in the full smoke chain.
- Kept compilation in memory. The compiler does not write into a real Obsidian
  vault or agent memory directory by itself.

Public-safety boundary:

- Uses sanitized Nucleus snapshots.
- Rejects unsafe relative paths during lint.
- Ignores absolute or parent-traversal metadata paths for page output.
- Does not include raw memory logs, raw transcripts, credentials, private
  agent state, or private file paths.

Verification:

- `pnpm wiki:smoke`: passed with 12 generated files, 10 markdown pages, 9
  Nucleus nodes, 9 edges, and clean lint.
- `pnpm test`: 14 tests passed.
- `pnpm typecheck`: passed.
- `pnpm smoke`: passed privacy, typecheck, OpenClaw smoke, Hermes smoke, Brain
  UI smoke, session compaction smoke, and wiki vault smoke.
- `npm pack --dry-run` in `packages/core`: passed and included
  `dist/wiki/compiler.*`.
- `git diff --check`: passed.
- Public secret-pattern scan: no hits.
- Private-name scan: no hits.

Cold review:

- Gemini CLI first returned `CONCERNS` for public ID exposure, brittle
  frontmatter title parsing, path collisions after redaction, and unredacted
  snapshot timestamps.
- The follow-up patch hashes public Nucleus node, edge, root, source, and
  container identifiers; parses JSON-quoted frontmatter titles; adds hashed
  path suffixes; and redacts timestamps before public snapshot export.
- Gemini final re-review returned `CLEAN`.

Known limits:

- This is a compiler, not an apply-to-disk command.
- Manual edit conflict handling is still a documented requirement for the
  future disk sync step.
