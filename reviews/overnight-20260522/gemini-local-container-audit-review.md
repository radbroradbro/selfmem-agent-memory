# Gemini Local Container Audit Review

Date: 2026-05-22

Reviewer route:

- `GEMINI_CLI_TRUST_WORKSPACE=true gemini -p ...`
- Gemini CLI reported that its own shell helper was unavailable, but completed
  review through file inspection and returned a verdict.

Verdict: CLEAN.

Reviewer findings:

- `packages/core/src/local-container/audit.ts` uses `basename()` plus the
  `DEFAULT_LOCAL_CONTAINER_AUDIT_FILES` allowlist. Relative or non-whitelisted
  names are rejected as `unsafe_name`.
- `auditFile()` returns only metadata such as line count and redaction count. It
  does not return raw file contents or redacted text.
- The input `rootDir` is not included in `LocalContainerAuditReport`; the report
  states `rootPathRedacted: true`.
- Tests and smoke coverage verify that serialized reports contain no raw memory
  text, no key-like patterns, and no root directory.
- `docs/LOCAL_CONTAINER_AUDIT.md` correctly describes the feature as a
  preflight, not a live memory browser.
- The existing release gate continues to scan for secrets and forbidden runtime
  files such as `.env`, `memories.jsonl`, and `raw_events.jsonl`.

Residual note:

- This review does not replace the blocked Claude cold review. It is one clean
  Gemini security/integration review for the local-container audit slice.
