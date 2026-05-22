# Gemini Brain UI Selected Local Audit Review

Date: 2026-05-22

Reviewer route:

- `GEMINI_CLI_TRUST_WORKSPACE=true gemini -p ...`
- Gemini CLI reported terminal/tool-routing warnings, then completed review and
  returned a verdict.

Verdict: CLEAN.

Reviewer findings:

- `/local-container/audit` is disabled by default and gated by
  `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1`.
- The server requires `confirmReadOnly: true`.
- `auditLocalContainer()` returns metadata, counts, health status, and
  redaction counts. It does not return raw memory/event text.
- The selected root path is reduced to a redacted `.../container` display
  label.
- The UI clears the typed path after submission.
- Audit reads remain restricted to known RecallWeave files.
- File-size limits are enforced.
- Interaction smoke and DOM evidence confirm that private/key-shaped text and
  raw local paths do not leak into serialized or visible output.

Residual note:

- This review does not replace the blocked Claude cold review.
