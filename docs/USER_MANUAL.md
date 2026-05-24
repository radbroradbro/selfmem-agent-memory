# User Manual

RecallWeave gives Hermes and OpenClaw agents a local memory lane with optional
read-only Supermemory search. New writes go to local storage. Hosted
Supermemory stays available as old history when credentials and quota allow it.

The runtime id is currently `selfmem_canary` for compatibility with installed
Hermes and OpenClaw setup scripts. That is a compatibility id, not the product
name. Once that id is assigned to the runtime memory slot, RecallWeave is the
default memory provider for that agent.

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
`.env`, auth files, raw memory files, or diagnostics bundles. For benchmark
runs, prefer shell environment variables. If pasting keys into commands would
be messy, put newline-separated keys in a private file outside the repository
and set an env var such as `VOYAGE_API_KEYS_FILE`, `NVIDIA_API_KEYS_FILE`, or
`GEMINI_API_KEYS_FILE`.

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

The intended local mode for 24GB-class Apple Silicon machines is:

```text
Qwen3 Embedding 0.6B through llama.cpp/Metal
deterministic RecallWeave rerank proxy
local writes only
lexical recall as no-credential fallback
```

The Qwen3 Reranker 0.6B local sidecar is planned as a challenger arm. It is not
the current tested local default.

Gemini Embedding 2 and NVIDIA hosted retrieval models are benchmark arms, not
silent fallbacks. Enable them only through local environment variables and only
compare them with separate indexes or a fresh rebuild.

Query expansion is disabled by default. It should be enabled only after a
controlled canary proves that the rewrite improves answer quality without
leaking private text, damaging exact identifiers, or adding unacceptable
latency.

For local model tests, close or stop old RecallWeave-owned model servers before
measuring latency. Do not kill unrelated user model servers. If process
ownership is unclear, treat the benchmark as blocked and clean it up manually.

For hosted-vs-local comparison work, `baseline:run` is the safest single
command after the private hosted env file, reviewed query set, and local
RecallWeave container are ready. Use fixture mode first:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:run -- --fixture
```

Live mode still requires explicit hosted credentials, no-raw-text mode, and a
reviewed query set. It creates metrics-only evidence and keeps public claims
blocked until reviewer and owner approval.

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
bin/selfmem_update --host hermes --repo /path/to/hermes
bin/selfmem_update --host hermes --repo /path/to/hermes --apply
bin/selfmem_update --host hermes --repo /path/to/hermes --apply --run-canary --canary-output /tmp/recallweave-canary-report.json --canary-intake-output /tmp/recallweave-canary-intake.json --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
```

After linking or installing the package, use `selfmem_update` directly.

The updater is dry-run by default and should back up the adapter directory
before copying files. If an agent needs credentials installed, pass a local path
that already exists on that machine:

```bash
selfmem_update --host hermes --keys-file <local-keys-file> --apply
```

The repository never ships a bundled key file.

To test the updater on temporary fixture runtimes before touching an agent:

```bash
npm exec --yes pnpm@10.23.0 -- update:smoke
```

For a real one-agent canary, use metrics-only reports:

```bash
npm exec --yes pnpm@10.23.0 -- canary:drill -- --host hermes --format markdown --output /tmp/recallweave-canary-drill.md
bin/selfmem_update --host hermes --repo /path/to/hermes --apply --run-canary --canary-output /tmp/recallweave-canary-report.json --canary-intake-output /tmp/recallweave-canary-intake.json --canary-diagnosis-output /tmp/recallweave-canary-diagnosis.json --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
npm exec --yes pnpm@10.23.0 -- canary:report -- --diagnostic-dir <redacted-diagnostic-dir> --rollback-tested --output sanitized-report.json
npm exec --yes pnpm@10.23.0 -- canary:intake -- --report sanitized-report.json --strict-real
npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report sanitized-report.json
```

Attach diagnosis output only. Do not attach the source diagnostic bundle or raw
runtime logs. Strict canary intake requires search and store latency
instrumentation. Summary-only exports and older traces that omit `elapsed_ms`
can produce a useful diagnosis, but they cannot count as real rollout evidence.
Use `selfmem_update --strict-real --rollback-tested` only after the agent has
actually run a rollback drill and collected a fresh live window.
The drill prompt file uses only public canary text and helps create the
required local write, recall, hosted read-through, lifecycle, and rollback
signals.

## Runtime Checks

Run these from a checkout:

```bash
npm exec --yes pnpm@10.23.0 -- install
npm exec --yes pnpm@10.23.0 -- privacy:test
npm exec --yes pnpm@10.23.0 -- typecheck
npm exec --yes pnpm@10.23.0 -- smoke:openclaw
npm exec --yes pnpm@10.23.0 -- smoke:hermes
```

## Wiki Vault Sync

RecallWeave can compile a sanitized Nucleus snapshot into an Obsidian-style
wiki vault and apply it to a selected folder. Disk sync is explicit. Reviewed
markdown pages are not overwritten; a proposed update is written under
`wiki/_conflicts/` instead.

Run the fixture check before enabling any live vault flow:

```bash
npm exec --yes pnpm@10.23.0 -- wiki:sync:smoke
```

## Brain UI

Run the local Brain UI from a checkout:

```bash
npm exec --yes pnpm@10.23.0 -- brain:serve
```

Open `http://127.0.0.1:4177`.

By default the Brain UI uses bundled fixture data. To run a selected local
container audit preview, start it with:

```bash
RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1 npm exec --yes pnpm@10.23.0 -- brain:serve
```

The selected audit is read-only. It requires confirmation, clears the typed
path after submit, and shows only a redacted `.../container` path, counts, and
health reasons. The UI keeps a browser-local audit history with redacted labels
and counts only.

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
