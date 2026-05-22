# Operations

## Repo Discipline

Use the repository for source code, generic docs, tests, and sanitized fixtures. Keep private notes, memory exports, diagnostics, and credentials out of the repository.

Recommended branch names:

```text
agent/<runtime>/<short-topic>
fix/<short-topic>
experiment/<short-topic>
```

## Issue Template Guidance

Good issue material:

- runtime name and version,
- adapter version or commit,
- event counts,
- error class,
- sanitized stack trace,
- smoke command results,
- whether provider calls were real or mocked.

Bad issue material:

- raw memory text,
- raw transcripts,
- `memories.jsonl`,
- `raw_events.jsonl`,
- `lossless_context.jsonl`,
- `.env`,
- auth files,
- browser state,
- provider keys,
- personal agent container names unless sanitized.

## Pull Request Checklist

Every pull request should state:

- what changed,
- why it changed,
- which runtime it affects,
- which tests passed,
- whether live provider calls were mocked,
- whether any behavior changes recall, writes, privacy, or spend.

## Reliability Audit

A good runtime audit should report:

- lifecycle event counts,
- search counts,
- store counts,
- skipped maintenance recall count,
- provider error count,
- redaction leak count,
- duplicate suppression count,
- p50 and p95 recall latency,
- whether hosted Supermemory returned results or failed.

Do not include the recalled text. Metrics are enough for repo issues.
