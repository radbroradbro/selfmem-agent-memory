# Agent Live-Build Guide

This guide explains how deployed agents should propose fixes without risking
private memory, credentials, or unstable rollout.

## Rule Zero

Agents can propose. Maintainers approve.

Do not push directly to `main`. Do not tell other agents to install a patch until
a maintainer merges it or explicitly approves the exact commit.

## Good Reasons To Propose A Patch

- A lifecycle event fails or never fires.
- Recall works in tests but not in a live prompt.
- Writes go to the wrong local container.
- Hosted Supermemory read-through returns errors or noisy results.
- A redaction, dedupe, or write gate behaves incorrectly.
- The updater would copy to the wrong runtime path.
- A doc step misleads an operator.
- A smoke test misses a failure seen in production.

## Bad Reasons To Patch Directly

- A provider key is missing.
- A memory seems wrong but the evidence contains private text.
- A benchmark result is interesting but not reproducible.
- The fix requires changing every agent at once.
- The change enables hosted write-back without a dry-run sync report.
- The change broadens recall frequency or provider spend without a budget note.

## Evidence To Share

Share:

- runtime name,
- commit or package version,
- event counts,
- search/store counts,
- error class,
- redaction leak count,
- provider mode,
- p50/p95 recall latency,
- smoke command output,
- sanitized stack trace.
- metrics-only `canary:diagnose` output when strict canary intake fails.

Do not share:

- provider keys,
- raw memories,
- raw transcripts,
- raw JSONL logs,
- `memories.jsonl`,
- `raw_events.jsonl`,
- `lossless_context.jsonl`,
- `.env`,
- auth files,
- browser state,
- private container mappings.

## Branch And PR Flow

1. Update from `main`.
2. Create a branch:

```bash
git checkout -b agent/hermes/short-topic
```

3. Make the smallest useful patch.
4. Run the relevant checks:

```bash
npm exec --yes pnpm@10.23.0 -- privacy:test
npm exec --yes pnpm@10.23.0 -- typecheck
npm exec --yes pnpm@10.23.0 -- smoke:openclaw
npm exec --yes pnpm@10.23.0 -- smoke:hermes
```

5. Open a pull request.
6. Fill out the PR template.
7. Wait for maintainer review.

## Live Runtime Patch Standard

A live-runtime PR should answer five questions:

1. What failed?
2. Why is this the smallest safe fix?
3. How was it tested without exposing memory content?
4. How can one agent try it first?
5. How can the operator roll it back?

## Rollout Levels

| Level | Meaning | Approval |
|---|---|---|
| L0 docs | Docs, comments, examples, diagrams. | Maintainer review. |
| L1 local smoke | Tests or adapter code that passes mocked smokes. | Maintainer review plus CI. |
| L2 one-agent canary | One live agent applies the patch. | Maintainer approval and rollback. |
| L3 multi-agent rollout | Several agents update. | Maintainer approval after L2 evidence. |
| L4 public release | Public-facing claim or visibility change. | Owner approval only. |

## Update Command

The updater is dry-run by default:

```bash
bin/selfmem_update --host hermes --repo /path/to/hermes
```

Apply only after review:

```bash
bin/selfmem_update --host hermes --repo /path/to/hermes --apply --run-canary
```

For strict live rollout evidence, start a fresh canary window at the update
time. Old trace history can include pre-patch missing latency samples, stale
errors, or earlier identity mistakes. Do not let that old history count for or
against the patched build:

```bash
FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
bin/selfmem_update --host hermes --repo /path/to/hermes --apply
```

Run the patched agent normally for at least 15 minutes, then collect only events
from after that timestamp:

```bash
bin/selfmem_update \
  --host hermes \
  --repo /path/to/hermes \
  --run-canary \
  --rollback-tested \
  --strict-real \
  --canary-since "$FRESH_WINDOW_START" \
  --canary-output /tmp/recallweave-canary-report.json
```

To produce a shareable metrics-only canary artifact during the same update,
write a sanitized report and run intake:

```bash
bin/selfmem_update \
  --host hermes \
  --repo /path/to/hermes \
  --apply \
  --run-canary \
  --canary-output /tmp/recallweave-canary-report.json
```

After a rollback drill, add `--rollback-tested --strict-real`. Strict-real
passes only when the selected live container has a fresh runtime window with
search/store latency samples, lifecycle coverage, hybrid search coverage, local
writes, read-through mode, and zero privacy leaks. If an agent sends a redacted
diagnostic export instead of a live container path, use
`--canary-diagnostic-dir` or `--canary-diagnostic-zip` together with
`--canary-since` so the report ignores pre-patch events inside the export.

Strict-real must produce a runtime report. Adapter standalone smoke is useful
for install sanity, but it is not rollout evidence. If the updater cannot find
a mapped live container and no diagnostic source is provided, `--strict-real`
fails instead of treating the adapter smoke as a pass.

Use `--keys-file` only with a local private file on that runtime machine. Never
put keys in the repository.

Maintainers can test the updater without touching a real agent:

```bash
npm exec --yes pnpm@10.23.0 -- update:smoke
```

The smoke creates temporary Hermes and OpenClaw homes, checks dry-run behavior,
applies into fake runtime directories, verifies adapter backups, preserves the
container mapping, confirms copied local key files use `0600`, and exercises the
canary report/intake path against a fixture diagnostic export.

To generate one paste-ready handoff for an agent operator, run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:operator-packet
npm exec --yes pnpm@10.23.0 -- canary:operator-packet -- --host openclaw --format markdown
```

The operator packet is public-safe. It uses placeholders for runtime paths and
lists only the metrics-only files the agent should attach after the run.

## Failed Canary Reports

If a live canary report fails strict intake, do not summarize the private logs
by hand. Run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report sanitized-report.json
```

Attach the diagnosis output, not the source diagnostic bundle. A good diagnosis
names the failed checks, p95 latency numbers, missing hook coverage, identity
mapping problems, privacy counters, and whether a fresh window is needed after
the fix.

## Benchmark Or Model Changes

Provider, reranker, query expansion, and benchmark changes are experiments.
They need:

- same dataset or fixture set,
- same scoring code,
- same judge and answer model,
- latency and cost notes,
- redaction failure count,
- no raw memory in reports.

The preferred local experiment for Apple Silicon users is the small
llama.cpp/Metal lane first: Qwen3 Embedding 0.6B plus Qwen3 Reranker 0.6B.
Qwen3 4B and 8B arms are quality challengers, not defaults for 24GB machines.

Gemini, NVIDIA hosted retrieval models, and query expansion providers must be
configured by local environment variables only. Do not paste provider keys into
PRs, docs, traces, screenshots, or diagnostics.

Do not publish benchmark scores from a patch unless RecallWeave beats the
matched baseline on a source-locked canary with the same dataset slice, memory
set, queries, judge, answer model, scoring code, settings, privacy scan, and
reviewer sign-off.

For hosted Supermemory baseline work, use the operator packet instead of
inventing ad hoc instructions:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --format markdown
```

The packet calls no hosted provider. It prints the aggregate-only collection
contract and validation commands. The actual read-only collection command is:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output /tmp/recallweave-hosted-baseline-result.json
```

Hosted credentials stay in local environment variables and must never appear in
PRs, docs, diagnostics, screenshots, or attachments.
