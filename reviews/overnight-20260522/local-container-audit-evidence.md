# Local Container Audit Evidence

Date: 2026-05-22

Scope:

- Added `auditLocalContainer()` in `packages/core/src/local-container/audit.ts`.
- Added unit coverage under `tests/local-container/audit.test.ts`.
- Added `packages/bench/local-container-audit-smoke.mjs`.
- Added `container:audit:smoke` and `container:audit:smoke:built` scripts.
- Added the audit smoke to aggregate `pnpm smoke` and `pnpm release:check`.

Safety boundary:

- The audit requires an explicit `rootDir`.
- It inspects only known local container files:
  `memories.jsonl`, `raw_events.jsonl`, `lossless_context.jsonl`, and
  `trace.jsonl`.
- It returns counts, byte totals, line totals, redaction counts, skipped-file
  reasons, and health reasons.
- It does not return raw memory text, raw event text, raw transcript text, raw
  traces, credentials, private paths, or the selected root path.
- It reports `rootPathRedacted: true` and `writesRealFiles: false`.
- It detects private/key-shaped text without returning the matched text.

Verification:

- `pnpm container:audit:smoke`: passed.
- `pnpm test`: passed with local-container audit tests included.
- `pnpm release:check`: passed with fresh local-container audit smoke included.

Smoke output:

```json
{
  "ok": true,
  "mode": "local-container-audit",
  "writesRealFiles": false,
  "rootPathRedacted": true,
  "existingFiles": 3,
  "lines": 3,
  "redactionCount": 2,
  "status": "needs-review",
  "reasons": [
    "private_or_key_shaped_text_detected"
  ]
}
```

Known limits:

- This is a preflight utility, not a full live memory browser.
- Future real-container UI work still needs an explicit path picker, redacted
  path display, read-only preview mode, write confirmation, and a local audit
  trail before touching real agent state.
