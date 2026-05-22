# Security

RecallWeave is designed to keep runtime memory data out of the public codebase.

Do not open issues or PRs containing:

- API keys, provider tokens, PATs, or bearer tokens,
- raw memories, transcripts, or lossless context files,
- `.env`, auth files, cookies, browser state, or SQLite runtime DBs,
- real personal agent container mappings unless sanitized,
- provider request or response bodies that contain private content.

If a secret is exposed, rotate it immediately. Remove it from history before
sharing any repository link or diagnostic bundle.

## Supported Versions

This public alpha supports only the current `main` branch. Pin deployments to a
commit if your runtime needs stability.

## Reporting

Open a GitHub issue with sanitized details when possible. If the report needs
private evidence, share only:

- version and commit,
- runtime name,
- event names and counts,
- redacted stack trace,
- redaction leak count,
- provider mode,
- whether live provider calls were mocked or real.

Never attach raw `memories.jsonl`, `raw_events.jsonl`, `lossless_context.jsonl`,
trace files with private payloads, database files, credential files, or browser
state.
