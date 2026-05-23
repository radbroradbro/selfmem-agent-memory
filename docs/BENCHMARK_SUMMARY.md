# Benchmark Summary

This repository includes metrics-only benchmark notes. It does not include agent memory text, private containers, raw logs, raw diagnostics, or provider credentials.

## Current Claim Boundary

RecallWeave is promising and operationally useful as a quota-safe local write lane. It is not proven generally superior to Supermemory. Earlier internal smoke numbers are useful engineering evidence, but the release branch removed benchmark-specific context shortcuts. Quality claims require a matched, source-locked canary win before any public score, then a fuller benchmark before broad superiority language.

The current branch includes a hosted baseline preflight:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:preflight
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template
npm exec --yes pnpm@10.23.0 -- baseline:discover
npm exec --yes pnpm@10.23.0 -- baseline:select-container
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset
npm exec --yes pnpm@10.23.0 -- baseline:queryset
npm exec --yes pnpm@10.23.0 -- baseline:source-match
npm exec --yes pnpm@10.23.0 -- baseline:source-align
npm exec --yes pnpm@10.23.0 -- baseline:source-gap
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:next-run
npm exec --yes pnpm@10.23.0 -- baseline:run -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake
```

That command does not call hosted Supermemory by default. It keeps public
benchmark claims blocked unless a fresh metrics-only hosted baseline, a matched
RecallWeave run, a RecallWeave win, and two independent reviewer approvals are
present through `baseline:reviewer-intake`. Reports may contain aggregate
metrics and hashes only.

`baseline:discover -- --live` is the read-only hosted metadata discovery step.
It lists candidate containers as hashed ids, counts, timestamps, and status/type
counts only. It does not print raw container labels or memory text. Operators
who need the raw label can opt into a local-only private map with
`RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1` and `--private-map-output`, then
run `baseline:select-container` to write the selected label into a local-only
0600 env file without printing it. Source that env file on the operator machine
before collection. Do not attach the private map or private env file to public
evidence.

`baseline:author-queryset` can draft a private, review-required query set from
the selected hosted container. It writes the private query set outside the
repository with 0600 permissions and prints only counts and hashes. The draft
does not count as benchmark evidence until a human reviews it locally and
`baseline:queryset --strict` reports that every query is labeled and distinct.

The latest live prep on 2026-05-23 found 14 hashed candidate containers across
200 hosted documents, with no raw labels or memory text in the public report.
It then drafted a private 8-query source-locked query set from 47 text-bearing
hosted documents. The strict public-safe query-set report shows 8 unique
queries, 0 duplicates, and 0 unlabeled queries. This proves safe hosted
metadata access and private query-set preparation only. It is not a hosted
baseline or a comparison result.

A later 2026-05-23 live run used that query set against hosted Supermemory and
the local Codex RecallWeave/selfmem bridge container. The one-command chain
completed, called the hosted provider, wrote metrics-only outputs, and produced
a strict-real evidence packet. It still does not support public benchmark
claims: both arms scored 0 quality, so the result points to a source-match and
label-construction problem rather than a retrieval-quality win. The public-safe
run summary is in
`reviews/overnight-20260522/hosted-baseline-live-codex-local-run-evidence.md`.

To generate the hosted baseline operator packet with this discovery state
attached, run:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --discovery reviews/overnight-20260522/hosted-baseline-live-discovery.json --format markdown
```

`baseline:queryset` inspects the source-locked query set before either side
collects results. It emits hashes and counts only, marks whether every query is
labeled, and fails under `--strict` if any query lacks an expected result id or
content hash or if two queries have the same text.

`baseline:mirror-hosted` is the private read-only bridge for source-matched
hosted canaries. It reads the selected hosted Supermemory source, redacts
private spans, key-shaped strings, and private local paths, then writes a local
RecallWeave-compatible mirror outside the repository with 0700 directory mode
and 0600 files. Only its metrics report may be attached. The mirror files
contain redacted memory text and a raw container map, so they stay local.

`baseline:source-match` checks the reviewed query labels against the selected
local RecallWeave source or private hosted mirror before hosted calls are spent.
Use `--preserve-ids` when the source is the hosted mirror. It emits only hashes,
counts, readiness flags, and privacy counters. It fails under `--strict` unless
every reviewed query has at least one collectable expected reference in the
local source. Use this before `baseline:run` whenever a hosted query set came
from a hosted source.

`baseline:source-align` then checks that the selected hosted label and local
container map point at the same source and that the source-match report allows a
matched run. It also emits hashes, counts, readiness flags, and privacy counters
only. Use it before `baseline:run` and attach only the public-safe alignment
report, never the private hosted map.

`baseline:source-gap` reads the public-safe source-match and source-alignment
reports and prints one deterministic next path: run the matched baseline, select
a different hosted candidate, rebuild labels as content hashes, mirror the
hosted source locally, or rerun the source gates. Attach this report with the
source-match and source-alignment reports when a hosted baseline is still
blocked. When the source is blocked, the report also includes a hashed
per-query repair queue with match counts and a recommended private repair
action. It does not include raw query text, expected refs, memory text, or
container labels.
Use `baseline:operator-packet -- --source-gap <source-gap-report> --format
markdown` to turn a blocked source-gap report into a paste-ready repair handoff.
That handoff still shows only query hashes, match counts, and repair actions.

The fixture command validates the expected result shape without counting as
baseline evidence. The template command prints the live-result schema agents
should fill after a hosted run. A fixture can pass every shape check and still
fail the real-evidence check because `fixtureOnly: true`.

`baseline:collect -- --live` is the read-only collector for hosted baseline
evidence. It uses hosted search only after explicit live flags and
environment-only credentials are present, and it writes aggregate metrics and
hashes only.
Every query in the source-locked query set must carry at least one expected
result id or expected content hash, and every query text must be distinct. The
hosted and RecallWeave collectors reject unlabeled or duplicate query sets
before producing aggregate metrics.

`baseline:export:recallweave -- --live` creates the local RecallWeave
search-response export from a local container. It emits ids or hashed ids,
content hashes, scores, timings, token estimates, and privacy counters only.
It does not emit raw memory text.

`baseline:collect:recallweave -- --live` converts a local RecallWeave
search-response export into the matched aggregate result file. The export must
use ids, scores, timings, token estimates, privacy counters, and content
hashes. Raw response text is rejected by default.

`baseline:compare` is the matched comparison gate. It compares only aggregate
hosted and RecallWeave result files. It blocks public claims when either result
is a fixture, when any metric or privacy flag is missing, when the query-set or
scoring-code hash differs, when either result lacks labeled query-set evidence,
or when fewer than two reviewer approvals exist.

`baseline:next-run` is the state-aware planner for this benchmark lane. It
turns the current hosted/local evidence state into the next safe source-locked
run packet without calling hosted Supermemory or authorizing public claims. The
planner now places `baseline:source-match --strict` and
`baseline:source-align --strict`, followed by `baseline:source-gap`, between
query-set validation and the
hosted/local run chain to prevent another unmatched 0-0 comparison. For hosted
history, it now includes `baseline:mirror-hosted` so the local arm can prove the
same source before collection.

`baseline:run` is the one-command runner after private setup is complete. It
requires a reviewed private query set, a private hosted container env file, and
a private hosted mirror or source-matched local RecallWeave container, plus the
local and hosted container maps needed for source alignment. It repeats the
source-match and source-alignment gates and writes the source-gap plan before
hosted collection, then runs hosted collection, local export, local collection,
preflight, comparison, packet creation, and returned-packet intake. Fixture mode
proves the chain and remains blocked as real hosted-baseline evidence.

## Historical Controlled Local Baseline

| Setup | Evidence type | P@1 | Recall@5 | Recall@10 | Redaction failures | Boundary |
|---|---|---:|---:|---:|---:|---|
| RecallWeave local | deterministic fixture | 0.763 | 0.895 | 0.921 | 0 | Historical local lexical baseline. Rerun required on this release branch. |
| RecallWeave hybrid | deterministic fixture | 0.868 | 1.000 | 1.000 | 0 | Historical hybrid merge smoke. Rerun required on this release branch. |
| Hosted Supermemory | live hosted-prep Codex-local run | 0.000 | 0.000 | 0.000 | 0 | Metrics-only live run completed, but labels did not match retrieved hosted results. Not public benchmark evidence. |
| RecallWeave local Codex bridge | live hosted-prep Codex-local run | 0.000 | 0.000 | 0.000 | 0 | Much lower latency than hosted, but same zero-quality label result. Requires source-matched container before claims. |

## Historical Plugin-To-Plugin Smoke

| Host surface | RecallWeave cloud Voyage P@1 | Supermemory P@1 | RecallWeave Recall@5 | Supermemory Recall@5 | Privacy leaks | Boundary |
|---|---:|---:|---:|---:|---:|---|
| Codex context-proxy | 0.895 | 0.895 | 1.000 | 1.000 | 0 | Historical controlled active-session tasks, deterministic answers. Rerun required on this release branch. |
| Claude Code context-proxy | 0.895 | 0.895 | 1.000 | 1.000 | 0 | Historical SessionStart/Stop parity surface. Rerun required on this release branch. |

Latency from those smokes:

| Host surface | RecallWeave p50 | RecallWeave p95 | Supermemory p50 | Supermemory p95 | Note |
|---|---:|---:|---:|---:|---|
| Codex context-proxy | 592.4 ms | 19445.8 ms | 610.3 ms | 940.6 ms | RecallWeave p95 inflated by free-tier key-rotation pacing. |
| Claude Code context-proxy | 457.7 ms | 19558.6 ms | 651.5 ms | 1064.2 ms | RecallWeave p95 inflated by free-tier key-rotation pacing. |

## Superseded Public MemoryBench Smoke

| Benchmark | Scope | Stack | Result | Boundary |
|---|---|---|---|---|
| LongMemEval-S | first 5 questions | Voyage voyage-4-large plus rerank-2.5, Gemini 2.5 Flash judge and answer model | superseded engineering smoke | No release claim. The benchmark-specific context shortcuts were removed before publishing, and the run must be repeated before comparison framing. |

Interpretation: retrieval can be strong while answer synthesis remains weak. The next quality improvement should target generic type-aware context compilation and compact event/fact synthesis, not benchmark-specific shortcuts.

## Runtime Smokes

| Runtime | Evidence type | Result | Boundary |
|---|---|---|---|
| Hermes | standalone mocked provider smoke | pass | proves adapter path, not live billing. |
| OpenClaw | standalone mocked provider smoke | pass | proves adapter path, not live billing. |
| Privacy tests | unit tests | zero expected leaks | does not replace live log audits. |

## What Counts As A Real Win

A stronger claim requires:

- a source-locked canary from a real benchmark or documented benchmark slice,
- a RecallWeave win against the matched baseline,
- the same memory set,
- the same queries,
- relevance labels for every query,
- the same judge and answer model,
- the same scoring code,
- the same settings,
- a source-match preflight showing the local RecallWeave source can score the
  reviewed labels,
- two independent reviewer approvals bound to the exact metrics-only packet
  through `baseline:reviewer-intake`,
- no memory text in shared reports,
- zero redaction failures,
- cost and latency accounting,
- a valid Supermemory baseline that is not quota-blocked.
- a baseline result that is not a fixture and passes the hosted preflight
  result checks.

Until then, RecallWeave should be described as a local-first fallback and experimental native memory lane, not as a proven replacement.

## Next Canary Matrix

The next public-safe benchmark gate will test separated provider arms:

- `cloud-voyage4-voyage` for the first cloud quality proof.
- `cloud-gemini2-cohere4pro` for multimodal and dimension tests.
- `cloud-nvidia-retriever-500m`, `cloud-nvidia-nemotron-1b`,
  `cloud-nvidia-nemotron-vl-1b`, and `cloud-nvidia-e5-mistral` for hosted
  NVIDIA retrieval comparisons.
- `local-apple-qwen3-0_6b` for the default Apple Silicon lane.

Query expansion stays off unless it enters as one isolated methodology change
and beats the no-expansion run without exact-identifier, privacy, or latency
regressions.

Public GitHub benchmark scores are allowed only after a real matched canary win
with two independent reviewer approvals recorded by `baseline:reviewer-intake`.
A canary win may justify a full benchmark; it does not prove general SOTA
superiority.
