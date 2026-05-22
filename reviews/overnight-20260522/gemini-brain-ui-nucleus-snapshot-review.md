# Gemini Brain UI Nucleus Snapshot Review

Date: 2026-05-22

Reviewer: Gemini CLI

Verdict: CLEAN

Scope:

- Brain UI Nucleus Snapshot panel.
- Fixture-only Nucleus snapshot export.
- Public-release safety boundary for snapshot preview and evidence.

Initial review:

- Gemini first returned `CONCERNS`.
- Finding: `buildNucleusExport()` redacted node fields but counted
  `node.kind` before redaction, which could leak a future private or key-shaped
  kind as a JSON object key.

Fix applied:

- `packages/brain-ui/src/app.js` now builds `kindCounts` with
  `safeExportText(node.kind)`.
- `packages/brain-ui/smoke.mjs` checks for the object-key redaction guard.

Final review result:

> Verdict: CLEAN
>
> Findings:
> - Fix verified: `kindCounts` in `buildNucleusExport()` now uses
>   `safeExportText(node.kind)` when grouping by kind, successfully preventing
>   unredacted strings from sneaking out as JSON object keys.
> - Safety verified: The export mapping strictly allow-lists known fields
>   (`id`, `kind`, `title`, `editable`, `tags` for nodes; `id`, `kind`, `from`,
>   `to` for edges) and passes all string values through `safeExportText`.
> - Gate verified: The release readiness check enforces snapshot evidence files
>   and asserts `writesRealFiles: false` and `visibleTextHasPrivate: false`.
> - Docs verified: `BRAIN_UI.md` limits the current state to a fixture-only
>   preview and pushes real container logic to the Production Path checklist.
>
> Required fixes: None

