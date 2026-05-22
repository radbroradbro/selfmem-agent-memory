# Adapter Bounded Read-Through Evidence

Date: 2026-05-22

## Purpose

This slice hardens the Hermes and OpenClaw runtime adapters after real
diagnostic exports showed clean privacy and lifecycle coverage but failed strict
canary intake on recall p95 latency and store latency instrumentation.

The fix does not make the old exports pass. A fresh one-agent runtime window is
still required.

## What Changed

- Hermes and OpenClaw now report `local_first_then_bounded_supermemory_read_through`.
- Hosted Supermemory read-through is no longer unconditional on every search.
- Read-through runs when local results are thin or the query explicitly asks
  for hosted, old, legacy, or Supermemory history.
- If local recall already exceeds the configured recall budget, hosted
  read-through is skipped for that turn.
- Hosted read-through timeout defaults to 1200 ms.
- Recall latency budget defaults to 2200 ms.
- Search traces now include total, local, and remote elapsed milliseconds.
- Search traces now record whether hosted read-through was attempted or skipped,
  plus the skip reason.
- Store traces use positive sub-millisecond timing so strict canary intake does
  not treat a fast local write as missing instrumentation.
- OpenClaw fetch timeouts now clear in a `finally` block.

## Configuration

- `SELFMEM_SUPERMEMORY_TIMEOUT_MS`: hosted read-through timeout. Default: `1200`.
- `SELFMEM_RECALL_LATENCY_BUDGET_MS`: recall budget before hosted read-through is skipped. Default: `2200`.
- `SELFMEM_MIN_LOCAL_RESULTS_BEFORE_REMOTE`: local result count below which hosted read-through runs. Default: `3`.

## Files Updated

- `packages/adapters/hermes/selfmem_canary/__init__.py`
- `packages/adapters/hermes/selfmem_canary_standalone_smoke.py`
- `packages/adapters/openclaw/selfmem_canary/index.mjs`
- `packages/adapters/openclaw/selfmem_canary_standalone_smoke.mjs`

## Verification

Local commands passed:

```bash
npm exec --yes pnpm@10.23.0 -- smoke:openclaw
npm exec --yes pnpm@10.23.0 -- smoke:hermes
npm exec --yes pnpm@10.23.0 -- test
npm exec --yes pnpm@10.23.0 -- smoke
node packages/bench/release-readiness-check.mjs
node packages/bench/goal-completion-audit.mjs
node packages/bench/release-blocker-doctor.mjs
```

Adapter smokes now assert:

- bounded read-through policy appears in status output;
- hosted read-through can still return remote results on explicit or thin-local
  queries;
- search traces contain positive total, local, and remote timing;
- lifecycle coverage still includes prompt recall, end-of-turn capture, and LCM
  compression signals;
- privacy leak count remains zero.

## Remaining Boundary

The active goal remains incomplete. The next real agent must collect a fresh
sanitized report after installing this patch, then run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:report -- --diagnostic-dir <redacted-diagnostic-dir> --rollback-tested --output sanitized-report.json
npm exec --yes pnpm@10.23.0 -- canary:intake -- --report sanitized-report.json --strict-real
```

If strict intake fails again, run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report sanitized-report.json
```

Only a fresh passing real report can clear the real-container rollout item.
