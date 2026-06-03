# Gemini Review: Canary Next-Agent Handoff Packet

Date: 2026-05-23

Reviewer route: `gemini --skip-trust --approval-mode plan`.

Verdict: CLEAN

## Evidence

- Safety checks: the packet builder and source planner/operator scripts use
  regex-based checks for key-shaped secrets and private local paths. The packet
  builder validates every generated file before zipping.
- Strict scope: the manifest and README keep `publicLaunchAllowed: false` and
  `fleetRolloutAllowed: false`. The planner keeps the scope to a one-agent fresh
  canary with a 15-minute fresh evidence window.
- Fail-closed readiness: `--require-ready` rejects fixture/demo packet creation
  unless the planner reports `READY_FOR_ONE_AGENT_FRESH_CANARY` from non-fixture
  evidence. This keeps smoke-test packets from being mistaken for live
  operator-ready packets.
- Return contract: the manifest now carries a fresh-window contract and return
  checklist, including post-update timing, strict-real evidence, rollback
  proof, metrics-only packet packaging, and the required returned-packet intake
  command.
- Gate coverage: `package.json`, the release-readiness gate, and clean-consumer
  smoke cover the packet builder, its package inclusion, and the fixture
  fail-closed behavior.
- Transparency: the OpenClaw handoff evidence names the failed checks and gives a
  metrics-only remediation path for one operator.

## Concerns

None.

## Required Fixes

None.

## Refresh Review

After adding `--require-ready`, Gemini reran a focused cold review on the
current diff. Verdict remained CLEAN.

Additional findings:

- The fail-closed fixture path exits nonzero and prints a safe JSON reason
  instead of a stack trace.
- Release readiness now checks the fixture rejection, manifest readiness fields,
  fresh-window contract, return checklist, and release-doctor command.
- The docs match the CLI behavior and keep fixture packets separate from live
  operator work.

Required fixes: none.

## Allow-Failed Inputs Extension Review

Gemini reran a focused cold review after the packet builder and planner gained
direct `--input-root ... --allow-failed-inputs --require-ready` support for
mixed returned-diagnostics folders.

Verdict: CLEAN

Additional findings:

- `--allow-failed-inputs` is parsed as a boolean by both the planner and packet
  builder.
- The flag is scoped to the diagnostic batch audit path and is not used to
  relax returned-packet or production-canary intake.
- Mixed-folder packet creation can tolerate one failed sibling diagnostic while
  still reporting `failedInputCount` and preventing the failed input from
  counting as rollout evidence.
- Generated outputs remain metrics-only and public-safe; raw memories,
  transcripts, prompts, answers, keys, cookies, private local paths, and raw
  diagnostics stay forbidden.
- `--require-ready` still fails closed for fixture or demo packets.
- Public launch and fleet rollout remain blocked.
- Docs match the implemented command shape.

Required fixes: none.

## Empty or Handoff-Only Folder Fail-Closed Refresh

Gemini reran a focused cold review on the follow-up patch that makes empty or
handoff-only diagnostic folders fail closed as structured metrics-only JSON.

Verdict: BLOCKED

Finding:

- The no-candidate path removed stale output zips, but the separate
  `--require-ready` failure path did not. A stale zip from a previous successful
  run could remain at the requested output path.

Resolution:

- Patched `canary-next-agent-packet` so `--require-ready` failures also remove
  the requested output path before printing the metrics-only failure JSON.
- Added release-gate assertions that both no-candidate failures and
  `--require-ready` failures leave no output zip.
- Replaced the local mixed-folder path in this evidence packet with a
  placeholder command so public evidence remains path-safe.

Gemini reran the cold review after the fix.

Verdict: CLEAN

Additional findings:

- Both no-candidate and `--require-ready` failure paths remove the requested
  output zip before returning.
- Rejected paths serialize metrics-only JSON and avoid stack traces.
- Fixture packet behavior still works.
- Public launch and fleet rollout remain blocked.
- Generated output still goes through secret and private-path scanning.
