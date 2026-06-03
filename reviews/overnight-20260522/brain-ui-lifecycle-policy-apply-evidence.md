# Brain UI Lifecycle Policy Apply Evidence

Date: 2026-05-22

Scope:

- `packages/brain-ui/server.mjs`
- `packages/brain-ui/src/index.html`
- `packages/brain-ui/src/app.js`
- `packages/brain-ui/src/styles.css`
- `packages/brain-ui/smoke.mjs`
- `packages/brain-ui/interaction-smoke.mjs`
- `docs/BRAIN_UI.md`

What changed:

- Added disabled-by-default `/lifecycle-policy/apply`.
- Added `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY=1` as the explicit apply
  gate.
- Added a selected local lifecycle policy apply form to the Brain UI.
- Required a write checkbox and the exact phrase
  `APPLY LOCAL LIFECYCLE POLICY`.
- Wrote only `.recallweave/lifecycle-policy.json` and
  `.recallweave/lifecycle-policy-audit.jsonl` under the selected container.
- Rejected policy payloads containing `<private>` spans or key-shaped text.
- Returned only redacted root labels, relative file paths, summary counts, and
  a content hash.

Verification:

- `npm run build`: passed in this controller shell.
- `node packages/brain-ui/smoke.mjs`: passed.
- `node packages/brain-ui/interaction-smoke.mjs`: passed.

Interaction smoke evidence:

```json
{
  "ok": true,
  "checked": [
    "lifecycle-policy-draft",
    "selected-lifecycle-policy-apply",
    "public-safe-serialization"
  ]
}
```

Safety boundary:

- The route is disabled unless explicitly enabled.
- The route does not write hosted Supermemory data.
- The route does not read raw memories or transcripts.
- The route does not write host runtime config directly.
- The route writes a local policy file for the selected container plus a
  content-free audit event.
- Selected root paths stay redacted in responses and audit logs.
