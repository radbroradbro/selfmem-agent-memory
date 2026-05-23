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
- metrics-only `baseline:packet` output when sending hosted-baseline comparison
  evidence.
- metrics-only `baseline:returned-packet` output when checking a returned
  hosted-baseline packet.
- metrics-only `baseline:discover` output when choosing a hosted Supermemory
  baseline container.
- metrics-only `baseline:queryset` output when proving a benchmark query set
  is source-locked and relevance-labeled.
- metrics-only `baseline:source-match` output when proving the selected local
  RecallWeave container can score a reviewed hosted-source query set.
- metrics-only `baseline:source-gap` output when turning source-match and
  source-alignment reports into a ready-or-repair path.
- source-locked benchmark query-set summaries showing every query has at least
  one expected result id or expected content hash.

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
- private hosted container maps created by `baseline:discover`.
- private query sets created by `baseline:author-queryset`.
- unlabeled natural-question benchmark files offered as performance evidence.

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

The updater reports adapter source and installed digests plus the strict canary
contract. Treat a missing `adapterContract.strictCanaryContract: v1` or
`installedMatchesSource: true` as a stale install, even if adapter smoke passes.

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
  --canary-output /tmp/recallweave-canary-report.json \
  --canary-intake-output /tmp/recallweave-canary-intake.json \
  --canary-diagnosis-output /tmp/recallweave-canary-diagnosis.json \
  --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
```

To produce a shareable metrics-only canary artifact during the same update,
write a sanitized report, intake, and packet:

```bash
bin/selfmem_update \
  --host hermes \
  --repo /path/to/hermes \
  --apply \
  --run-canary \
  --canary-output /tmp/recallweave-canary-report.json \
  --canary-intake-output /tmp/recallweave-canary-intake.json \
  --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
```

After a rollback drill, add `--rollback-tested --strict-real`. Strict-real
passes only when the selected live container has a fresh runtime window with
search/store latency samples, strict v1 adapter contract markers, lifecycle
coverage, hybrid search coverage, local writes, read-through mode, and zero
privacy leaks. If an agent sends a redacted
diagnostic export instead of a live container path, use
`--canary-diagnostic-dir` or `--canary-diagnostic-zip` together with
`--canary-since` so the report ignores pre-patch events inside the export.

Strict-real must produce a runtime report. Adapter standalone smoke is useful
for install sanity, but it is not rollout evidence. If the updater cannot find
a mapped live container and no diagnostic source is provided, `--strict-real`
fails instead of treating the adapter smoke as a pass.

When strict-real intake fails, keep the generated JSON. The command exits
nonzero but still writes a sanitized failure report with `failedChecks`,
latency, instrumentation, quality, and privacy counters. Attach that metrics
file, then run `canary:diagnose` on it. Do not send raw traces or memories.

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
For a deterministic fresh-window exercise, generate the canary drill and follow
its public prompts after applying the adapter:

```bash
npm exec --yes pnpm@10.23.0 -- canary:drill -- --host hermes --format markdown --output /tmp/recallweave-canary-drill.md
npm exec --yes pnpm@10.23.0 -- canary:drill -- --host openclaw --format markdown --output /tmp/recallweave-canary-drill.md
```

The drill forces the window to touch local write, local recall, hosted
read-through, lifecycle or LCM compression, rollback, strict intake, and
metrics-only packaging. If hosted read-through returns zero results, keep the
packet diagnostic instead of calling it production canary evidence.
If you did not use `--canary-packet-output`, package the report and intake
files with:

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --output /tmp/recallweave-canary-evidence-packet.zip
```

If strict intake failed and you generated a diagnosis file, add
`--diagnosis /tmp/recallweave-canary-diagnosis.json`. The packet is a
metrics-only zip; it must not contain raw logs, memories, prompts, answers,
keys, cookies, or private paths.

The controller should validate any received packet before it counts:

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet:review -- --packet /tmp/recallweave-canary-evidence-packet.zip
npm exec --yes pnpm@10.23.0 -- canary:packet:review -- --packet /tmp/recallweave-canary-evidence-packet.zip --strict-real
```

If several agents send redacted diagnostic bundles at once, audit them as a
batch before picking the next runtime to patch:

```bash
npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input-root /path/to/redacted-diagnostics
npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input /path/to/agent-a.zip --input /path/to/agent-b
```

Add `--allow-failed-inputs` for a mixed return folder where one broken or
irrelevant diagnostic should not prevent ranking the privacy-clean parsed
bundles. This is only a triage mode. It does not make a failed or partial batch
count as rollout evidence.

Use `--require-real-pass` only when the batch is being offered as production
one-agent canary evidence. Fixture bundles, stale pre-patch bundles, or bundles
without passing strict-real intake must fail closed. The output is metrics-only:
hashed agent/container labels, lifecycle counts, latency, instrumentation,
privacy counters, failed checks, and remediation categories.

To turn the batch result into one paste-ready next-agent plan, run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --input-root /path/to/redacted-diagnostics --format markdown
```

For mixed return folders, use the same triage flag here too:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --input-root /path/to/redacted-diagnostics --allow-failed-inputs --format markdown
```

This planner does not promote the fleet. It selects the closest privacy-clean
candidate, names the failed checks, and prints the exact dry-run, apply,
fresh-window, strict intake, diagnosis, and packet commands for one agent only.
If the selected candidate is fixture-only or privacy is not clean, the planner
says so instead of pretending the evidence is production-ready.

To send the work to one live operator, build a packet and require live-ready
evidence:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root /path/to/redacted-diagnostics --allow-failed-inputs --require-ready --output /tmp/recallweave-next-agent-handoff.zip
```

The packet stays metrics-only. It includes a fresh-window contract, return
checklist, deterministic drill instructions, and `readyForLiveHandoff`.
`--require-ready` rejects fixture/demo packets, so use it for real agent
handoffs.

When the selected agent returns a canary evidence packet, run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet /path/to/returned-canary-evidence-packet.zip --output /tmp/recallweave-returned-canary-intake.json
```

If the agent sent a folder of zips, scan the inbox first. This classifies real
returned evidence separately from handoff packets, diagnostics, and unrelated
zips:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root ~/Downloads --output /tmp/recallweave-returned-canary-inbox.json
```

For release evidence, require a strict production canary:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet /path/to/returned-canary-evidence-packet.zip --require-production-canary --output /tmp/recallweave-returned-canary-intake.json
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root ~/Downloads --require-production-canary --output /tmp/recallweave-returned-canary-inbox.json
```

This intake command does not read raw memories. It accepts only the metrics-only
packet and fails closed unless the packet is non-fixture, privacy-clean, and
strict-real.

The strict review must fail for fixtures or diagnostic-only packets.

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

When a live hosted discovery report already exists, generate the packet with
that state attached:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --discovery reviews/overnight-20260522/hosted-baseline-live-discovery.json --format markdown
```

Use the next-run planner when you have partial evidence and need the exact next
safe command sequence:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:next-run -- --format markdown
```

When you think the hosted and local evidence is complete, require a hard ready
check before sending it upstream:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:next-run -- --hosted /tmp/recallweave-hosted-baseline-result.json --recallweave /tmp/recallweave-result.json --preflight /tmp/recallweave-hosted-baseline-preflight.json --comparison /tmp/recallweave-baseline-comparison.json --require-ready
```

That command must fail for fixtures, partial evidence, privacy failures,
harness mismatches, missing reviewer approval, or a RecallWeave loss. Passing
means owner-review ready, not public-launch ready.

Both commands call no hosted provider. They print aggregate-only collection
contracts and validation commands. The actual read-only collection command is:

If the correct hosted container is unknown, first create the public discovery
report and private raw-label map outside the repository, then select the
candidate into a private env file without printing the label:

```bash
RECALLWEAVE_BASELINE_LIVE=1 \
RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 \
npm exec --yes pnpm@10.23.0 -- baseline:discover \
  -- --live --output /tmp/recallweave-hosted-baseline-discovery.json \
  --private-map-output /tmp/recallweave-hosted-container-map.private.jsonl

npm exec --yes pnpm@10.23.0 -- baseline:select-container \
  -- --discovery /tmp/recallweave-hosted-baseline-discovery.json \
  --private-map /tmp/recallweave-hosted-container-map.private.jsonl \
  --env-output /tmp/recallweave-hosted-baseline.private.env

RECALLWEAVE_BASELINE_LIVE=1 \
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset \
  -- --live --discovery /tmp/recallweave-hosted-baseline-discovery.json \
  --private-map /tmp/recallweave-hosted-container-map.private.jsonl \
  --queryset-output /tmp/recallweave-hosted-baseline-queryset.json \
  --output /tmp/recallweave-hosted-baseline-queryset-author-report.json

RECALLWEAVE_BASELINE_LIVE=1 \
npm exec --yes pnpm@10.23.0 -- baseline:mirror-hosted \
  -- --live --discovery /tmp/recallweave-hosted-baseline-discovery.json \
  --private-map /tmp/recallweave-hosted-container-map.private.jsonl \
  --output-dir /tmp/recallweave-hosted-local-mirror \
  --output /tmp/recallweave-hosted-local-mirror.json

npm exec --yes pnpm@10.23.0 -- baseline:queryset \
  -- --queryset /tmp/recallweave-hosted-baseline-queryset.json \
  --strict --output /tmp/recallweave-hosted-baseline-queryset-report.json

RECALLWEAVE_BASELINE_LIVE=1 \
RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
npm exec --yes pnpm@10.23.0 -- baseline:source-match \
  -- --live --queryset /tmp/recallweave-hosted-baseline-queryset.json \
  --container-dir /tmp/recallweave-hosted-local-mirror \
  --preserve-ids \
  --strict --output /tmp/recallweave-baseline-source-match.json

npm exec --yes pnpm@10.23.0 -- baseline:source-align \
  -- --source-match /tmp/recallweave-baseline-source-match.json \
  --local-map /tmp/recallweave-hosted-local-mirror/container-map.json \
  --private-map /tmp/recallweave-hosted-container-map.private.jsonl \
  --strict --output /tmp/recallweave-baseline-source-alignment.json

npm exec --yes pnpm@10.23.0 -- baseline:source-gap \
  -- --source-match /tmp/recallweave-baseline-source-match.json \
  --source-alignment /tmp/recallweave-baseline-source-alignment.json \
  --output /tmp/recallweave-baseline-source-gap.json
```

Review the private query set locally before collection. Then source
`/tmp/recallweave-hosted-baseline.private.env` locally before the hosted
collector. Do not attach that env file, the private map, or the private query
set. The hosted mirror contains redacted memory text and a raw container map, so
keep the mirror directory local and attach only
`/tmp/recallweave-hosted-local-mirror.json` plus the metrics-only query-set,
source-match, source-alignment, and source-gap reports. If
`baseline:source-gap` is blocked, use only the hashed
`repairQueue` in that report to decide which private query labels need mirrored
hosted source content, rebuilt local-source labels, or collectable content
hashes.

For a paste-ready handoff after a blocked source-gap report, reload that report
into the operator packet. It prints only hashed query fingerprints, counts, and
repair actions:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- \
  --source-gap /tmp/recallweave-baseline-source-gap.json \
  --format markdown
```

Prefer the one-command runner once those private inputs are ready:

```bash
. /tmp/recallweave-hosted-baseline.private.env
RECALLWEAVE_BASELINE_LIVE=1 \
RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1 \
RECALLWEAVE_BASELINE_QUERYSET=/tmp/recallweave-hosted-baseline-queryset.json \
npm exec --yes pnpm@10.23.0 -- baseline:run -- \
  --live \
  --container-env /tmp/recallweave-hosted-baseline.private.env \
  --queryset /tmp/recallweave-hosted-baseline-queryset.json \
  --container-dir /tmp/recallweave-hosted-local-mirror \
  --local-map /tmp/recallweave-hosted-local-mirror/container-map.json \
  --private-map /tmp/recallweave-hosted-container-map.private.jsonl \
  --preserve-ids \
  --reviewed-queryset \
  --output /tmp/recallweave-baseline-run.json
```

This creates hosted, local, comparison, preflight, packet, and returned-intake
outputs together. It still does not allow public benchmark claims or public
launch by itself.

Use the individual commands below only when you need to debug a stage.

```bash
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --live --output /tmp/recallweave-hosted-baseline-result.json
```

Create the matched local result from a RecallWeave response export that has no
raw memory text:

Use the exporter's `--output` flag. Do not redirect the package-manager
command's stdout into the JSON file, because wrapper banners can corrupt the
evidence file before the collector reads it.

```bash
RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET=1600 \
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave \
  -- --live --container-dir /tmp/recallweave-hosted-local-mirror \
  --preserve-ids \
  --context-token-budget 1600 \
  --output /tmp/recallweave-search-responses.json

RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave \
  -- --live --responses /tmp/recallweave-search-responses.json \
  --output /tmp/recallweave-result.json
```

Then compare the two aggregate files:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:compare \
  -- --hosted /tmp/recallweave-hosted-baseline-result.json \
  --recallweave /tmp/recallweave-result.json
```

After packaging the aggregate evidence, validate reviewer approvals as their
own metrics-only artifacts. DeepSeek, Claude, Gemini, Codex, or another model
can review, but the gate trusts only the JSON approval file and never a loose
counter:

```bash
# Set this in your shell, password manager, or CI secret store first. Do not
# paste the value into docs, issue comments, PRs, screenshots, or command logs.
export RECALLWEAVE_REVIEW_OPENAI_API_KEY="..."

RECALLWEAVE_REVIEW_OPENAI_PROVIDER=deepseek \
RECALLWEAVE_REVIEW_OPENAI_MODEL=deepseek-v4-pro \
npm exec --yes pnpm@10.23.0 -- baseline:reviewer:openai-compatible \
  -- --packet /tmp/recallweave-baseline-evidence-packet.zip \
  --comparison /tmp/recallweave-baseline-comparison.json \
  --reviewer-id deepseek-reviewer-a \
  --output /tmp/reviewer-a-approval.json

npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake \
  -- --packet /tmp/recallweave-baseline-evidence-packet.zip \
  --comparison /tmp/recallweave-baseline-comparison.json \
  --strict-target \
  --review /tmp/reviewer-a-approval.json \
  --review /tmp/reviewer-b-approval.json \
  --output /tmp/recallweave-reviewer-approval-report.json

npm exec --yes pnpm@10.23.0 -- baseline:compare \
  -- --hosted /tmp/recallweave-hosted-baseline-result.json \
  --recallweave /tmp/recallweave-result.json \
  --reviewer-approval-report /tmp/recallweave-reviewer-approval-report.json \
  --output /tmp/recallweave-baseline-comparison.json
```

`baseline:reviewer:openai-compatible` is env-only. In dry-run mode it writes a
non-countable fixture review so agents can test the path without spending or
creating fake approvals. In live mode it reads aggregate hashes and metrics,
calls the reviewer provider, writes one sanitized approval JSON, and leaves
`baseline:reviewer-intake` to decide whether the approval counts. Hosted and
reviewer credentials stay in local environment variables and must never appear
in PRs, docs, diagnostics, screenshots, or attachments.
