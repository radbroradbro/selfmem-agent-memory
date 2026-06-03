# Gemini Review: Brain UI Lifecycle Policy Apply

Date: 2026-05-22

Verdict: CLEAN

Scope:

- `packages/brain-ui/server.mjs`
- `packages/brain-ui/src/index.html`
- `packages/brain-ui/src/app.js`
- `packages/brain-ui/src/styles.css`
- `packages/brain-ui/smoke.mjs`
- `packages/brain-ui/interaction-smoke.mjs`
- `docs/BRAIN_UI.md`
- `reviews/overnight-20260522/brain-ui-lifecycle-policy-apply-evidence.md`

Review history:

- First Gemini pass returned `BLOCKED` because the new
  `RECALLWEAVE_BRAIN_UI_ENABLE_POLICY_APPLY` environment gate was not
  documented.
- `docs/BRAIN_UI.md` was updated to document the gate, exact confirmation
  phrase, write scope, redaction behavior, and redacted response boundary.
- Second Gemini pass returned `CLEAN`.

Clean-pass findings:

- The docs describe the mandatory environment gate and exact confirmation
  phrase.
- The server checks the environment gate before handling the route.
- The server rejects policy payloads containing private or key-shaped text.
- Writes are confined under the selected container root.
- Responses redact the selected local root path.
- Interaction smoke covers confirmation bypass, secret rejection, and verified
  local policy/audit writes.
- The frontend clears path and phrase inputs after submission.
- Policy changed-field handling uses a strict allow-list.

Reviewer conclusion:

The selected lifecycle policy apply slice is safe enough for the current
public-alpha PR boundary. It remains disabled by default and does not create a
production-ready public launch verdict.
