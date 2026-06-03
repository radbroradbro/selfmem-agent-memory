# Operations

## Repo Discipline

Use the repository for source code, generic docs, tests, and sanitized fixtures. Keep private notes, memory exports, diagnostics, and credentials out of the repository.

Recommended branch names:

```text
agent/<runtime>/<short-topic>
fix/<short-topic>
experiment/<short-topic>
docs/<short-topic>
```

Agents should submit pull requests instead of pushing to `main`. Maintainers own
release decisions, native-default rollout, public visibility, and sync-back
behavior.

See `docs/GITHUB_RULES.md` for the intended branch protection and agent
permission model.

When code checks pass but GitHub automation cannot update the PR body, create a
blocker issue, or add a PR comment, use `docs/UPDATE_FLOW.md` and the checked-in
release drafts as the public-safe fallback. Keep the launch verdict separate
from code health.

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

Every live-runtime pull request should also state:

- how the failure was observed,
- where sanitized evidence came from,
- how to test the fix on one agent,
- how to roll it back,
- whether the update script can apply it safely.

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

## Live Build Improvement Loop

Use this loop when an agent finds a production issue:

1. Capture sanitized counts and error classes.
2. Decide whether the issue is docs-only, runtime-fix, quality, safety, ops, or
   experiment.
3. Open an issue if the evidence cannot be shared safely.
4. Branch from `main` and keep the patch small.
5. Run the smallest relevant checks.
6. Open a pull request with the reason, evidence, checks, and rollback.
7. Wait for maintainer approval before merging or telling other agents to
   install it.
