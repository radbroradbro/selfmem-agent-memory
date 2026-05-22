# Contributing

Treat this like a production memory system. Small, reviewed changes beat one-off patches.

## Branches

Use one branch per change:

```text
agent/<agent-or-runtime>/<short-topic>
fix/<short-topic>
experiment/<short-topic>
```

## Pull requests

Every PR should include:

- what changed,
- why it changed,
- which runtime it affects,
- tests or smoke checks run,
- any remaining risk,
- whether live provider calls were mocked or real.

## Issues

Open an issue instead of patching when:

- the failure involves raw/private data that cannot be safely shared,
- the fix requires runtime credentials,
- the behavior is intermittent,
- the change could affect recall quality, privacy, or provider spend.

Use sanitized excerpts only. Never paste keys, full memories, raw transcripts, or auth files.

## Required local checks

Run the smallest relevant set first, then broader checks if the change touches shared code:

```bash
npm exec --yes pnpm@10.23.0 -- privacy:test
npm exec --yes pnpm@10.23.0 -- typecheck
node packages/adapters/openclaw/selfmem_canary_standalone_smoke.mjs
python3 packages/adapters/hermes/selfmem_canary_standalone_smoke.py
```
