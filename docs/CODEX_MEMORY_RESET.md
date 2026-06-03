# Codex Memory Controlled Dogfood

This page describes the current Codex bridge recovery gate. It is a product
safety gate, not public benchmark evidence.

## Current Mode

The Codex memory bridge can be in either reset dogfood or rewired dogfood.
Native Codex memory use and generation stay disabled in both phases. In reset
dogfood, prompt/stop hooks are disabled while maintainers verify manual recall,
explicit durable writes, context ranking, dedupe, and pruning. In rewired
dogfood, one controlled Codex lane may use the local bridge hooks while the
monitor proves that recall remains relevant, quiet, and useful in live work.

Do not restart unattended benchmark loops or agent-wide rollout automation from
this mode. Re-enable automatic recall only after the local reset-health gate and
controlled dogfood checks show that unrelated prompts stay quiet, task-specific
prompts retrieve only directly relevant context, and post-boundary writes are
inspectable without raw private memory leakage.

## Local Gate

Run the reset-health gate on the workstation where Codex is installed:

```bash
npm exec --yes pnpm@10.23.0 -- codex:memory-reset-health
```

The gate is intentionally local. It checks the installed bridge, hook phase,
disabled native Codex memory state, hosted write-back status, context-quality
scenarios, and active-store noise counts without printing raw memory,
transcripts, keys, or private paths.

`READY_FOR_CONTROLLED_DOGFOOD` means maintainers may use manual recall and
explicit writes in a limited dogfood loop. It does not mean production ready,
public release ready, or Supermemory replacement ready.

`READY_FOR_REWIRED_CONTROLLED_DOGFOOD` means the local hook pair is enabled in
one controlled Codex lane and the relevance gate is clean. It still does not
mean production ready, public release ready, or Supermemory replacement ready.

The report also includes a `dogfoodMonitor` block. Use that block during and
after any rewire to track:

- noise: severe noise counts, benchmark/canary-memory residue, and quarantine
  activity,
- retrieval: recall run/skip rates, forced versus signal-triggered recall, and
  average match counts; forced or periodic recall must carry a current-task
  anchor, and missing anchor metadata counts as noise risk,
- direct lookup: task prompts must retrieve bounded useful context while
  unrelated prompts retrieve nothing; the report carries hashes and counts, not
  raw retrieved memory,
- writes: explicit store outcomes, duplicate suppression, rejected writes, and
  stop-time candidate/write rates,
- usefulness: context-quality scenario pass rate, including unrelated prompts
  that should retrieve no memory.

Automatic recall should not expand beyond one controlled Codex lane until this
monitor stays clean in real work. A one-time canary is not enough.

Run the explicit periodic monitor during rewire dogfood:

```bash
npm exec --yes pnpm@10.23.0 -- codex:memory-dogfood-monitor:watch
```

The monitor has two proof levels. A one-shot run can prove current health and
catch immediate noise, but it must report `MONITORING_INTERVALS_REQUIRED` for
dogfood graduation. Graduation review requires watched rewired intervals; by
default the watch command needs 12 clean iterations. Shorter watched runs may be
used only as gate-smoke tests or diagnostics, not as a public release or
benchmark claim.

When a watched run is ready for dogfood graduation review, keep the full monitor
output local and write a compact metrics-only evidence summary into the active
review directory:

```bash
node packages/bench/codex-memory-dogfood-evidence-check.mjs \
  --evidence /tmp/codex-memory-dogfood-monitor-current.json \
  --output reviews/<review-dir>/codex-memory-dogfood-evidence-current.json \
  --strict
```

That evidence may show the controlled Codex memory lane is ready for graduation
review. It still does not authorize public launch, SOTA claims, or broader
automatic recall rollout.

If the monitor reports noisy or confusing context, keep or turn automatic
injection off, fix the ranking, write, dedupe, or pruning method, and rerun the
monitor. Do not treat repeated noisy recall as an acceptable operator burden.
This is not a local-secret scrub. Local memory may contain private operational
facts when the operator wants that; the strict public-safety boundary applies to
checked-in or release artifacts.

## Phase Order

1. Keep automatic injection off and scrub or quarantine severe local memory
   noise.
2. Prove context quality with targeted live prompts, including unrelated prompts
   that should retrieve nothing.
3. Dogfood the bridge manually during real research and build work, with
   explicit writes and visible wiki or topic updates.
4. Re-enable automatic recall only in a controlled one-agent lane after the
   manual dogfood loop stays useful and quiet, then keep monitoring
   `dogfoodMonitor` for noise, retrieval usefulness, and write health.
5. Use five-to-ten-question mechanics loops only when rewiring or testing a new
   method.
6. Run whole-harness same-data benchmarks after the wiring is stable; BM25 is
   the lexical floor, not the product scoreboard.
7. Collapse large private or review-evidence surfaces before public release.

## Release Boundary

This reset gate can pass while public release remains blocked. A release still
needs a compact public surface, same-data benchmark proof, reviewer gates,
owner approval, and real one-agent rollout evidence. Do not cite reset-health
as a public memory-quality score.
