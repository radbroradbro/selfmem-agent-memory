# Benchmark Summary

This repository includes metrics-only benchmark notes. It does not include agent memory text, private containers, raw logs, raw diagnostics, or provider credentials.

## Current Claim Boundary

selfmem is promising and operationally useful as a quota-safe local write lane. It is not proven generally superior to Supermemory. Earlier internal smoke numbers are useful engineering evidence, but the release branch removed benchmark-specific context shortcuts and must rerun formal benchmarks before making quality claims.

## Historical Controlled Local Baseline

| Setup | Evidence type | P@1 | Recall@5 | Recall@10 | Redaction failures | Boundary |
|---|---|---:|---:|---:|---:|---|
| selfmem-local | deterministic fixture | 0.763 | 0.895 | 0.921 | 0 | Historical local lexical baseline. Rerun required on this release branch. |
| selfmem-hybrid | deterministic fixture | 0.868 | 1.000 | 1.000 | 0 | Historical hybrid merge smoke. Rerun required on this release branch. |

## Historical Plugin-To-Plugin Smoke

| Host surface | selfmem-cloud-voyage P@1 | Supermemory P@1 | selfmem Recall@5 | Supermemory Recall@5 | Privacy leaks | Boundary |
|---|---:|---:|---:|---:|---:|---|
| Codex context-proxy | 0.895 | 0.895 | 1.000 | 1.000 | 0 | Historical controlled active-session tasks, deterministic answers. Rerun required on this release branch. |
| Claude Code context-proxy | 0.895 | 0.895 | 1.000 | 1.000 | 0 | Historical SessionStart/Stop parity surface. Rerun required on this release branch. |

Latency from those smokes:

| Host surface | selfmem p50 | selfmem p95 | Supermemory p50 | Supermemory p95 | Note |
|---|---:|---:|---:|---:|---|
| Codex context-proxy | 592.4 ms | 19445.8 ms | 610.3 ms | 940.6 ms | selfmem p95 inflated by free-tier key-rotation pacing. |
| Claude Code context-proxy | 457.7 ms | 19558.6 ms | 651.5 ms | 1064.2 ms | selfmem p95 inflated by free-tier key-rotation pacing. |

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

- the same memory set,
- the same queries,
- the same judge and answer model,
- the same scoring code,
- no memory text in shared reports,
- zero redaction failures,
- cost and latency accounting,
- a valid Supermemory baseline that is not quota-blocked.

Until then, selfmem should be described as a local-first fallback and experimental native memory lane, not as a proven replacement.
