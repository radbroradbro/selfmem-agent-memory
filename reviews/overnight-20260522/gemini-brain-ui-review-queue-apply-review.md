# Gemini Review: Brain UI Review Queue Apply

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
- `reviews/overnight-20260522/brain-ui-review-queue-apply-evidence.md`

Review result:

- The route is documented and gated by
  `RECALLWEAVE_BRAIN_UI_ENABLE_REVIEW_APPLY=1`.
- Server-side write confirmation requires both a checkbox flag and the exact
  phrase `APPLY LOCAL REVIEW QUEUE`.
- Review payloads are rejected when they contain `<private>` spans or
  key-shaped text.
- Persisted decision records are content-free and omit candidate memory text.
- Responses and audit logs keep selected local root paths redacted.
- Writes stay under the selected `.recallweave/` directory.
- The frontend clears path and confirmation phrase inputs after submit.
- Interaction smoke covers missing confirmation, unsafe payload rejection,
  decision-log writes, audit-log writes, candidate-text exclusion, and
  public-safe serialization.

Reviewer conclusion:

The selected review queue apply slice is safe enough for the current
public-alpha PR boundary. It remains disabled by default and does not create a
production-ready public launch verdict.
