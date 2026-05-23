# Benchmark Summary

This repository includes metrics-only benchmark notes. It does not include agent memory text, private containers, raw logs, raw diagnostics, or provider credentials.

## Current Claim Boundary

RecallWeave is promising and operationally useful as a quota-safe local write lane. It is not proven generally superior to Supermemory. Earlier internal smoke numbers are useful engineering evidence, but the release branch removed benchmark-specific context shortcuts. Quality claims require a matched, source-locked canary win before any public score, then a fuller benchmark before broad superiority language.

The current branch includes a hosted baseline preflight:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:preflight
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
```

That command does not call hosted Supermemory by default. It keeps public
benchmark claims blocked unless a fresh metrics-only hosted baseline, a matched
RecallWeave run, a RecallWeave win, and two independent reviewer approvals are
present. Reports may contain aggregate metrics and hashes only.

The fixture command validates the expected result shape without counting as
baseline evidence. The template command prints the live-result schema agents
should fill after a hosted run. A fixture can pass every shape check and still
fail the real-evidence check because `fixtureOnly: true`.

`baseline:collect -- --live` is the read-only collector for hosted baseline
evidence. It uses hosted search only after explicit live flags and
environment-only credentials are present, and it writes aggregate metrics and
hashes only.

`baseline:compare` is the matched comparison gate. It compares only aggregate
hosted and RecallWeave result files. It blocks public claims when either result
is a fixture, when any metric or privacy flag is missing, when the query-set or
scoring-code hash differs, or when fewer than two reviewer approvals exist.

## Historical Controlled Local Baseline

| Setup | Evidence type | P@1 | Recall@5 | Recall@10 | Redaction failures | Boundary |
|---|---|---:|---:|---:|---:|---|
| RecallWeave local | deterministic fixture | 0.763 | 0.895 | 0.921 | 0 | Historical local lexical baseline. Rerun required on this release branch. |
| RecallWeave hybrid | deterministic fixture | 0.868 | 1.000 | 1.000 | 0 | Historical hybrid merge smoke. Rerun required on this release branch. |

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
- the same judge and answer model,
- the same scoring code,
- the same settings,
- two independent reviewer approvals,
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
with two independent reviewer approvals. A canary win may justify a full
benchmark; it does not prove general SOTA superiority.
