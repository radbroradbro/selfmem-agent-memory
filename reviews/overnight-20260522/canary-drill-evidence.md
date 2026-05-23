# Canary Drill Evidence

## Scope

`canary:drill` adds a deterministic, public-safe strict-real canary drill for
one Hermes or OpenClaw agent. It reduces failed returned canary packets by
telling the operator exactly how to create the evidence strict intake expects:

- local write
- local recall
- hosted Supermemory read-through attempt
- lifecycle or LCM compression coverage
- rollback dry-run
- strict-real report, intake, diagnosis, and packet collection

It does not authorize public launch or fleet rollout.

## Commands

```bash
node --check packages/bench/canary-drill.mjs
npm exec --yes pnpm@10.23.0 -- canary:drill
npm exec --yes pnpm@10.23.0 -- canary:drill -- --host openclaw --format markdown
node packages/bench/canary-operator-packet.mjs --host openclaw
node packages/bench/canary-next-agent-packet.mjs
```

## Results

- `canary:drill` emitted `mode: strict-real-canary-drill`.
- `writesRealFiles: false`, `metricsOnly: true`, `publicSafe: true`.
- `publicLaunchAllowed: false` and `fleetRolloutAllowed: false`.
- The drill requires a 15-minute fresh window after adapter apply.
- The drill contract requires patched adapter, native memory slot, local write,
  hosted read-through, lifecycle coverage, LCM/compression coverage, rollback,
  and metrics-only return.
- The OpenClaw markdown output contains the same public-safe drill with
  placeholder paths only.
- `canary-operator-packet` now includes a `generate-drill` command.
- `canary-next-agent-packet` now includes `strict-real-canary-drill.md`.

## Safety

- The drill prompts use only public canary text: color `cobalt` and workflow
  name `Meridian`.
- The hosted read-through step asks for result counts only and forbids quoting
  memory text.
- The drill output contains no provider keys, raw memories, raw transcripts,
  raw prompts, raw answers, cookies, private local paths, or unredacted
  diagnostic archives.
- If hosted read-through returns zero results, the packet remains diagnostic
  and cannot close the production canary blocker.
