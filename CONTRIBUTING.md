# Contributing

RecallWeave is memory infrastructure. Small, reviewed changes beat one-off
patches.

## Branches

Use one branch per change:

```text
agent/<runtime>/<short-topic>
fix/<short-topic>
experiment/<short-topic>
docs/<short-topic>
```

Agent-created branches should include the runtime or area that observed the
problem, such as `agent/hermes/lcm-precompress-trace` or
`agent/openclaw/read-through-dedupe`.

## Pull Requests

Every PR should include:

- what changed,
- why it changed,
- which runtime it affects,
- tests or smoke checks run,
- any remaining risk,
- whether live provider calls were mocked or real,
- whether this affects live memory writes, recall, provider spend, or migration.

Agents may open PRs, but maintainers approve releases and merges. Do not merge
your own runtime fix unless a human owner has reviewed it.

See [Agent Live-Build Guide](docs/AGENT_LIVE_BUILD_GUIDE.md) for the full
runtime patch workflow and [Maintainer Review Guide](docs/MAINTAINER_REVIEW_GUIDE.md)
for approval rules.

## Issues

Open an issue instead of patching when:

- the failure involves raw/private data that cannot be safely shared,
- the fix requires runtime credentials,
- the behavior is intermittent,
- the change could affect recall quality, privacy, or provider spend.

Use sanitized excerpts only. Never paste keys, full memories, raw transcripts,
auth files, browser state, or provider responses containing private data.

## Agent Change Classes

Use these labels in the PR title or body:

- `docs`: public docs, comments, examples, or diagrams.
- `runtime-fix`: Hermes or OpenClaw adapter behavior.
- `quality`: recall, rerank, dedupe, distillation, or context compilation.
- `safety`: redaction, container mapping, read-only behavior, or write gates.
- `ops`: update scripts, audits, CI, release packaging, or branch rules.
- `experiment`: benchmark arm, model/provider change, or methodology proposal.

`safety`, `quality`, and `experiment` changes need a stronger evidence section
than docs-only PRs.

## Required Local Checks

Run the smallest relevant set first, then broader checks if the change touches
shared code:

```bash
npm exec --yes pnpm@10.23.0 -- privacy:test
npm exec --yes pnpm@10.23.0 -- typecheck
node packages/adapters/openclaw/selfmem_canary_standalone_smoke.mjs
python3 packages/adapters/hermes/selfmem_canary_standalone_smoke.py
```

## Review Standard

Security, privacy, and recall-quality changes need evidence. A good PR shows
the exact checks run, explains any live-provider gap, and keeps benchmark claims
inside the proof actually collected.

## Merge Standard

A maintainer should merge only when:

- the PR template is complete,
- CI passes or the failure is explained as unrelated,
- private data scans are clean,
- at least one maintainer approves,
- live-runtime changes include rollback instructions,
- benchmark or provider claims do not exceed the evidence.
