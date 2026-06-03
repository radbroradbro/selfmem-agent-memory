# Gemini Brain UI Research Source Lock Review

Date: 2026-05-22

Command:

```bash
gemini --skip-trust --approval-mode plan -p "Cold review the new RecallWeave Brain UI Research Source Lock slice..."
```

Verdict: `CLEAN`

Reviewed scope:

- Brain UI Research Source Lock panel.
- Fixture source-lock packet and source cards.
- Smoke and interaction smoke coverage.
- Release-readiness gate checks.
- Public-safe browser evidence.

Key reviewer findings:

- The slice is fixture-only. The model hardcodes `writesRealFiles: false` and
  the UI reads `/fixtures/research-source-lock.json`.
- The payload scanner and smoke checks keep private/key-shaped text out of the
  fixture and evidence.
- The raw JSON export is behind a collapsed technical disclosure, so the
  primary panel stays human-readable.
- Raw source IDs are not primary UI labels, while exact backend labels remain
  copyable where operators need them.
- The caveats avoid SOTA and production-readiness overclaims.

Notes:

- Gemini reported missing `ripgrep` and fell back to its GrepTool.
- This review approves only the focused fixture UI slice. It does not approve a
  public launch, hosted baseline claim, or fleet rollout.
- After this review, the source-lock fixture was extended with explicit
  follow-up rules for topic/subtopic paths, stale memory supersession, and
  budgeted lifecycle frequency. It was then extended again with
  dashboard-to-cluster zoom as a scale requirement. Those additions are covered
  by smoke, interaction, browser, and release-gate evidence.
