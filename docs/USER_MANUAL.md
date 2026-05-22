# User Manual

RecallWeave gives Hermes and OpenClaw agents a local memory lane with optional
read-only Supermemory search. New writes go to local storage. Hosted
Supermemory stays available as old history when credentials and quota allow it.

The runtime id is currently `selfmem_canary` for compatibility with installed
Hermes and OpenClaw setup scripts. Once that id is assigned to the runtime
memory slot, RecallWeave is the default memory provider for that agent.

## What To Install

Use the runtime-specific adapter:

- Hermes: `packages/adapters/hermes/selfmem_canary`
- OpenClaw: `packages/adapters/openclaw/selfmem_canary`

Use `plugins/selfmem-fallback/scripts/setup-agent-memory.py` to create the local
container mapping. The mapping should identify:

- the agent identity,
- the local RecallWeave container,
- the old Supermemory container label, if there is one,
- whether hosted Supermemory should be used as read-only history.

Keep provider credentials on the agent machine. Do not commit `keys.env`,
`.env`, auth files, raw memory files, or diagnostics bundles.

## Default Memory Mode

Hermes becomes native/default when its profile config sets:

```yaml
memory:
  provider: selfmem_canary
```

OpenClaw becomes native/default when its config sets the memory slot to:

```json
{
  "plugins": {
    "slots": {
      "memory": "selfmem_canary"
    }
  }
}
```

Run the smoke check before changing the slot. After the slot changes, verify the
runtime trace shows automatic recall and writes.

## Provider Mode

The intended cloud mode is:

```text
Voyage voyage-4-large embeddings
Voyage rerank-2.5 reranking
optional Supermemory read-through
local writes only
```

Multiple Voyage keys may be configured locally for rate-limit rotation. Rotation
is a runtime credential setting, not repository data.

## Supermemory Read-Through

When configured, search merges:

- local RecallWeave results,
- hosted Supermemory results,
- optional cached Supermemory export results.

The merge step deduplicates near-identical memories and keeps local writes
authoritative. Supermemory write-back should stay disabled until a dry-run sync
report shows no unsafe or duplicate writes.

## Update Flow

Agents should pull the repo, branch, patch, run smokes, and open a pull request.

For local update scripts:

```bash
python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --repo /path/to/hermes
python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --repo /path/to/hermes --apply
```

The updater is dry-run by default and should back up the adapter directory
before copying files. If an agent needs credentials installed, pass a local path
that already exists on that machine:

```bash
python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --keys-file ~/private/recallweave/keys.env --apply
```

The repository never ships a bundled key file.

## Runtime Checks

Run these from a checkout:

```bash
npm exec --yes pnpm@10.23.0 -- install
npm exec --yes pnpm@10.23.0 -- privacy:test
npm exec --yes pnpm@10.23.0 -- typecheck
npm exec --yes pnpm@10.23.0 -- smoke:openclaw
npm exec --yes pnpm@10.23.0 -- smoke:hermes
```

On a live agent, inspect the runtime trace for:

- `session_start`,
- automatic recall before prompt build,
- local store events after turns,
- redaction count,
- provider errors,
- skipped maintenance/status recalls.

## What To Share In Issues

Share counts, event names, sanitized stack traces, and version info. Do not
share memory text, raw transcripts, raw JSONL logs, environment files, auth
state, browser state, or provider keys.
