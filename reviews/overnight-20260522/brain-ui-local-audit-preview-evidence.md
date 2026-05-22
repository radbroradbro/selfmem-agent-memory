# Brain UI Local Audit Preview Evidence

Date: 2026-05-22

Scope:

- Added a fixture-only Local Audit Preflight panel to the Brain UI.
- Added `/fixtures/local-container-audit.json`, which creates a temporary
  synthetic local container, runs `auditLocalContainer()`, returns only the
  content-free report, then removes the temporary directory.
- Added Brain UI smoke and interaction-smoke coverage for the local audit
  endpoint and rendered panel.

Safety boundary:

- The endpoint uses a temporary fixture container only.
- The response contains counts, file names from the fixed allowlist, redaction
  counts, and health reasons.
- The response does not include raw memory text, raw event text, raw trace text,
  provider keys, private tags, or the temporary root path.
- The UI panel is read-only and writes no files.

Bug caught during implementation:

- The first version returned the audit promise without awaiting it inside the
  `try` block, which allowed temporary cleanup before all audit reads completed.
- `pnpm brain:smoke` caught the bug because the fixture endpoint reported only
  two existing files instead of three.
- The server now awaits the audit before cleanup.

Verification:

- `pnpm brain:smoke`: passed.
- `pnpm brain:interaction`: passed.
- Chrome DevTools captured fixture-only DOM evidence and screenshot.
- Browser DOM evidence shows:
  - Local Audit Preflight heading,
  - `needs-review` status,
  - three existing files,
  - three lines,
  - two redactions,
  - one missing known file,
  - `private or key shaped text detected`,
  - no visible private/key-shaped text or local root path.
- Browser console evidence: no console messages.

Artifacts:

- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-local-audit.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-local-audit-dom-evidence.json`.

Known limits:

- This is not a real local-container browser.
- Real local mode still needs an explicit path picker, redacted path display,
  operator confirmation, read-only preview, and local audit trail.
