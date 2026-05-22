# Gemini Review: Selected Vault Sync Apply

Date: 2026-05-22

Verdict: CLEAN

Scope:

- `packages/brain-ui/server.mjs`
- `packages/brain-ui/src/index.html`
- `packages/brain-ui/src/app.js`
- `packages/brain-ui/smoke.mjs`
- `packages/brain-ui/interaction-smoke.mjs`
- `packages/bench/release-readiness-check.mjs`
- `docs/BRAIN_UI.md`
- `reviews/overnight-20260522/ui-evidence/brain-ui-browser-dom-evidence.json`
- `reviews/overnight-20260522/release-state.json`
- `reviews/overnight-20260522/completion-audit.md`
- `reviews/overnight-20260522/production-readiness.md`
- `reviews/overnight-20260522/release-readiness-evidence.md`

Review result:

- Selected vault sync apply is disabled by default.
- Apply requires `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_APPLY=1`.
- Apply requires a write checkbox and the exact phrase
  `APPLY LOCAL WIKI SYNC`.
- The server explicitly checks `lintCompiledWikiVault()` before write apply.
- Path inputs are visible text fields and are cleared after submission.
- Root paths are redacted in display and responses.
- The audit log is content-free and records write intent without raw paths or
  private data.
- No raw memory text, credentials, hosted write-back, or private/key-shaped data
  is exposed by the slice.
- Production readiness remains `FAIL`.

Reviewer conclusion:

The previous blockers, missing explicit lint check and obscured path fields,
are resolved. The selected vault sync apply slice satisfies the stated safety
and functional requirements.
