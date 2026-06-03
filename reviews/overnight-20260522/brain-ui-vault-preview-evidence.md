# Brain UI Vault Preview Evidence

Date: 2026-05-22

Scope:

- Added a fixture-only `/fixtures/wiki-vault.json` endpoint to the Brain UI
  server.
- Added a Wiki Vault Preview panel that lets reviewers inspect the compiled
  markdown files, manifest, and `nucleus.json` output without writing to disk.
- Updated Brain UI smoke coverage to verify the endpoint, panel code, CSS, lint
  cleanliness, and public-safe fixture output.

Public-safety boundary:

- The endpoint compiles the bundled fixture snapshot only.
- It does not read local memory containers, raw transcripts, diagnostics, auth
  files, provider keys, or real vault paths.
- The preview displays compiler output in the browser only. It does not apply
  edits or write files.

Verification expectations:

- Brain UI smoke fetches `/fixtures/wiki-vault.json`.
- The response has `ok: true`, zero lint issues, `wiki/index.md`, and wiki
  pages.
- Combined fixture and vault JSON contains no private-tag content or common key
  shapes.
- Browser evidence should show the Wiki Vault Preview panel and at least one
  compiled markdown page.

Verification:

- `pnpm brain:smoke`: passed.
- `pnpm test`: 14 tests passed.
- `pnpm smoke`: passed with the updated Brain UI smoke included.
- Browser evidence was captured with Chromium/Playwright against
  `http://127.0.0.1:4177`.
- Screenshot: `reviews/overnight-20260522/ui-evidence/brain-ui-vault-preview.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-vault-preview-dom-evidence.json`.
- DOM evidence shows `12 files compiled. Lint clean.`, 12 vault options, no
  console messages, and no visible private/key-shaped text.
- Gemini CLI returned `CLEAN`. Its only non-blocking note was that the Brain UI
  server depends on compiled core exports, so `brain:serve` and `brain:smoke`
  now run `pnpm build` first.

Known limits:

- This is still fixture mode. Real local-container browse/edit mode requires an
  explicit path picker and write confirmation.
