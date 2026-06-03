# Gemini Canary Report Generator Review

Date: 2026-05-22

Command:

```sh
gemini --skip-trust --approval-mode plan -p 'Cold review the RecallWeave canary report generator slice. Inspect packages/bench/canary-report-from-trace.mjs, packages/bench/canary-evidence-intake.mjs, packages/bench/fixtures/canary-runtime-*.fixture.*, packages/adapters/hermes/selfmem_canary/__init__.py, packages/adapters/openclaw/selfmem_canary/index.mjs, package.json, packages/bench/consumer-install-smoke.mjs, packages/bench/release-readiness-check.mjs, packages/bench/goal-completion-audit.mjs, reviews/overnight-20260522/canary-report-generator-evidence.md, docs/RELEASE_HANDOFF.md, and release docs. Check no secrets, raw memory text, transcripts, prompts, answers, local paths, or credentials can enter generated reports. Check store latency is recorded by adapters rather than fabricated. Check fixture-derived reports are accepted only as fixture evidence and fail strict-real intake. Check release gate enforces this evidence and reviewer packet. Return either Verdict: CLEAN or Verdict: BLOCKED with concise findings.'
```

Verdict: `CLEAN`

Findings:

- No sensitive data in reports: `canary-report-from-trace.mjs` maps runtime
  data to hashes, counters, rates, latency, and event fingerprints. The report
  generator and intake both reject key-shaped secrets and raw local paths. The
  intake also rejects forbidden raw-content/auth-like fields such as raw
  memory, raw transcript, raw prompt, raw answer, API key, and token fields.
- Store latency recording: Hermes now records store elapsed time with
  `time.perf_counter()`, and OpenClaw records it with `Date.now()`. The
  generator calculates p50/p95 store latency from those trace metrics rather
  than fabricating a value.
- Fixture handling and strict-real intake: fixture-derived reports are marked
  with `fixtureOnly: true` and `evidenceType:
  fixture-trace-derived-canary-report`. `canary-evidence-intake.mjs` rejects
  those reports when `--strict-real` is used.
- Release gates: `release-readiness-check.mjs` asserts generator output,
  fixture strict-real rejection, intake behavior, evidence files, and reviewer
  packet coverage. `goal-completion-audit.mjs` lists the canary report
  generator as a proven surface while the real rollout remains incomplete.

## Diagnostic Bundle Follow-up

Command:

```sh
gemini --skip-trust --approval-mode plan -p 'Cold re-review the RecallWeave canary diagnostic-bundle intake slice after the fixture relocation fix. Inspect only repository files, not private diagnostics. Scope: packages/bench/canary-report-from-trace.mjs, packages/bench/fixtures/canary-diagnostic-export.fixture/**, packages/bench/fixtures/canary-runtime-container-map.fixture.json, packages/bench/release-readiness-check.mjs, packages/bench/consumer-install-smoke.mjs, package.json, docs/RELEASE_HANDOFF.md, and reviews/overnight-20260522/canary-report-generator-evidence.md. Confirm whether the previous blocker is fixed: copied/zipped fixtures must still emit fixtureOnly true and fail strict-real intake. Also check zip path validation, diagnostic-dir support, no raw memories/transcripts/prompts/answers/local paths/secrets in generated reports, and no fabricated latency for older bundles. Return exactly: Verdict: CLEAN or Verdict: BLOCKED, then concise findings.'
```

Verdict: `CLEAN`

Findings:

- Fixture relocation and zip handling are fixed. The release gate packages the
  diagnostic fixture into a temporary zip outside `packages/bench/fixtures`,
  then confirms the report still emits `fixtureOnly: true` and fails
  `--strict-real`.
- Zip path validation blocks absolute paths, Windows drive paths, and `..`
  traversal entries before extraction.
- Diagnostic directory support covers `--diagnostic-dir`, `--bundle-dir`, and
  `--audit-dir`, including metadata-only `trace_metadata_only.jsonl` exports.
- Generated reports stay metrics-only, with hashes, counters, rates, latency,
  quality booleans, privacy counters, and no raw memories, transcripts,
  prompts, answers, credentials, or local paths.
- Missing latency is not fabricated. Older bundles without store `elapsed_ms`
  emit `0` latency and fail the strict intake instead of becoming green
  rollout evidence.
