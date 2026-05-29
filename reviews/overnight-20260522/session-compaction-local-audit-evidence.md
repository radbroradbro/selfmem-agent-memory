# Session Compaction Local Audit Evidence

Date: 2026-05-22

Scope: add a metrics-only local-session compaction audit harness for private
Codex, Claude, Hermes, or OpenClaw session exports.

## What Changed

- Added `packages/bench/session-compaction-local-audit.mjs`.
- Added fixture input
  `packages/bench/fixtures/session-compaction-local-audit.fixture.jsonl`.
- Added `pnpm compaction:local-audit` and
  `pnpm compaction:local-audit:built`.
- Added the local audit to the aggregate smoke chain.
- Documented private usage in `docs/SESSION_COMPACTION_BENCHMARK.md`.

## Safety Boundary

The audit output is metrics-only by default. It does not print:

- candidate memory text,
- raw session text,
- local paths,
- raw session ids,
- credentials,
- private diagnostics.

It prints hashed candidate ids, kinds, salience scores, reason counts, source
event counts, chronological bounds, redaction counts, and quality metrics.

## Fixture Result

The public fixture run reported:

- mode: `local-session-compaction-audit`,
- writesRealFiles: `false`,
- metricsOnly: `true`,
- input events: 6,
- redaction count: 2,
- output candidates: 4,
- chronological: `true`,
- noise reduction ratio: 0.333,
- privacy leak count: 0,
- exact identifier candidate count: 1.

No raw candidate memory text appears in this evidence file.

## Verification

- `pnpm compaction:local-audit:built`: passed.
- `pnpm release:check`: passed with fresh local-session compaction audit.
- Release secret scan now includes `.jsonl` files.
- Gemini session compaction local audit review: `CLEAN`.
- GitHub Actions CI run `26298965544` on commit `be08302`: passed Test, Full
  smoke, and Release readiness check.

## 2026-05-29 Refresh: Lifecycle And Topic Map Audit

The local audit now includes a metrics-only session-map block. The public report
still does not print candidate memory text, raw session text, local paths, raw
session ids, or credentials.

Fixture result:

- topic link count: 4,
- lifecycle event count: 6,
- linked candidate count: 4,
- unlinked candidate count: 0,
- lifecycle phases: `session_start`, `pre_compact`, `candidate_distilled`,
  `topic_linked`, `session_map_ready`, `session_end`,
- waste signals: `redaction-observed`,
- warnings: none,
- privacy leak count: 0.

Verification:

- `node packages/bench/session-compaction-local-audit.mjs --strict`: passed.
- Strict mode now requires session-map lifecycle phases and zero unlinked
  candidates.
