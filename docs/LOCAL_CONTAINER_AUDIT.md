# Local Container Audit

RecallWeave's Brain UI cannot safely jump from fixtures to real local memory
files without a preflight. The local container audit is that preflight.

## What It Does

`auditLocalContainer()` accepts an explicit container directory and inspects only
known RecallWeave runtime files:

- `memories.jsonl`
- `raw_events.jsonl`
- `lossless_context.jsonl`
- `trace.jsonl`

It returns counts and health reasons, not memory contents.

## Safety Rules

- The caller must pass the directory explicitly. There is no default home
  directory scan.
- The report redacts the root path and reports `rootPathRedacted: true`.
- The report returns a caller-supplied container label, sanitized through the
  same private/key redaction boundary.
- The audit reads files only up to `maxFileBytes`.
- Unsafe file names are rejected.
- It never writes files and always reports `writesRealFiles: false`.
- It detects private-tagged or key-shaped text but never returns the matched
  text.

## Health Meaning

`healthy` means the selected directory has known container files, none exceeded
the audit size limit, no read error occurred, and no private/key-shaped text was
detected in the inspected files.

`needs-review` means the audit found one or more preflight reasons, such as:

- `no_known_container_files`
- `private_or_key_shaped_text_detected`
- `file_exceeds_safe_audit_size`
- `file_read_error`
- `unsafe_audit_file_name_rejected`

## Current Use

The implementation now includes a core utility, smoke tests, a Brain UI fixture
preview, and a disabled by default selected-container audit route.

The fixture preview uses a temporary synthetic container and shows file counts,
redaction counts, and health reasons only.

The selected-container route is enabled only with
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1`. It requires read-only confirmation,
clears the typed path after submit, and returns only a redacted `.../container`
label, counts, health reasons, and an audit-trail summary. It still writes no
files and does not return raw memory/event text.

The Brain UI keeps a bounded browser-local selected-audit history in
`localStorage`. Each entry contains only the redacted container label, status,
counts, event name, and timestamp.

`browseLocalContainer()` is the next read-only step. It inspects only:

- `memories.jsonl`
- `trace.jsonl`
- `lossless_context.jsonl`

It returns a bounded list of redacted snippets plus source file, line number,
kind, event, and optional source id. Fully private entries are counted and
skipped. The selected-container browse route is disabled unless
`RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_BROWSE=1` is set, requires read-only
confirmation, clears the typed path after submit, reports
`writesRealFiles: false`, and never returns the selected root path.

The Brain UI now also has a disabled-by-default selected local memory edit
overlay. It is enabled only with `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT=1`,
requires the exact confirmation phrase `APPLY LOCAL MEMORY EDIT`, rejects
private/key-shaped payloads, and writes append-only overlay records under
`.recallweave/local-memory-edits.jsonl` plus a content-free audit trail under
`.recallweave/local-memory-edit-audit.jsonl`. It does not mutate
`memories.jsonl` in place.

Direct in-place editable memory state remains intentionally disabled. The wiki
sync helper already lints before write and can append a content-free pre-write
audit log when `auditLogPath` is supplied.
