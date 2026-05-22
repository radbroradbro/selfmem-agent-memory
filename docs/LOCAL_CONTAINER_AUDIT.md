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

The first implementation is a core utility, a smoke test, and a Brain UI
fixture preview. It is not yet a real local-container browser. The Brain UI
fixture preview uses a temporary synthetic container and shows file counts,
redaction counts, and health reasons only. The same utility can serve as the
first gate before a future explicit container picker, redacted path display,
read-only preview, write confirmation, and local audit trail.
