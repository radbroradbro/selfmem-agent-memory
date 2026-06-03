# Adapter Strict Canary Contract Evidence

Date: 2026-05-23

Scope:

- Added a public-safe strict canary contract marker to the Hermes and OpenClaw
  adapters.
- Added adapter contract fields to sanitized runtime canary reports and intake
  output.
- Added updater source and target digests so agents can prove the installed
  adapter matches the reviewed package.
- Kept the gate fail-closed: stale or unmarked adapters do not pass strict real
  intake.

Contract:

- Adapter name: `recallweave-selfmem-canary`
- Strict canary contract: `v1`
- Search latency instrumentation: required.
- Store latency instrumentation: required.
- Hosted Supermemory remains read-through only.
- New writes remain local only.

Verification:

- `node --check packages/bench/canary-report-from-trace.mjs`
- `node --check packages/bench/canary-evidence-intake.mjs`
- `node --check packages/bench/canary-remediation.mjs`
- `node --check packages/bench/release-readiness-check.mjs`
- `python3 -m py_compile plugins/selfmem-fallback/scripts/selfmem_update.py packages/bench/update-flow-smoke.py`
- `npm exec --yes pnpm@10.23.0 -- smoke:openclaw`: passed with
  `adapterContractCovered: true`, search latency instrumentation, store latency
  instrumentation, lifecycle coverage, hybrid search, and zero privacy leaks.
- `npm exec --yes pnpm@10.23.0 -- smoke:hermes`: passed with
  `adapterContractCovered: true`, LCM lifecycle coverage, search/store latency
  instrumentation, hybrid search, and zero privacy leaks.
- `node packages/bench/canary-report-from-trace.mjs --fixture`: generated a
  metrics-only report whose `adapter` block exposes the strict v1 canary
  contract.
- `node packages/bench/canary-evidence-intake.mjs --strict-real`: still exits
  nonzero for the bundled fixture while printing sanitized JSON. The adapter
  contract check itself passes in the fixture; the fixture rejection still
  blocks real rollout claims.
- `npm exec --yes pnpm@10.23.0 -- update:smoke`: passed for Hermes and
  OpenClaw, including adapter digests and strict canary contract detection.

Why this matters:

- The previous strict canary path could tell us that a report lacked store
  latency, but it could not make stale installed adapters obvious from the
  report itself.
- A live agent can now show both runtime evidence and an installed adapter
  contract without exposing paths, keys, memories, prompts, or transcripts.
- This does not unblock public launch. It only makes the next one-agent canary
  easier to validate.
