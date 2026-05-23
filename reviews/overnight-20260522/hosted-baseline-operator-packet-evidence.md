# Hosted Baseline Operator Packet Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/hosted-baseline-operator-packet.mjs`.
- Added `baseline:operator-packet` as a package script and smoke step.
- The packet gives operators one public-safe baseline collection contract for
  hosted Supermemory comparison evidence.
- The packet now points operators to `baseline:collect -- --live` instead of an
  ad hoc external collector.
- Gemini focused review returned `CLEAN`.

Commands:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --format markdown
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
```

Expected behavior:

- JSON mode reports `mode: hosted-baseline-operator-packet`.
- Markdown mode prints a paste-ready operator packet.
- `writesRealFiles` is false.
- `callsHostedProvider` is false.
- It tells operators to print the template, validate fixture parsing, then
  collect and validate an aggregate-only hosted result.
- It tells operators to keep `SUPERMEMORY_API_KEY` in the local environment and
  never paste it into the command or any attachment.
- It requires env-only hosted credentials and never prints provider-key values.
- It tells operators to attach only:
  - `/tmp/recallweave-hosted-baseline-result.json`
  - `/tmp/recallweave-hosted-baseline-preflight.json`
- It forbids provider keys, raw hosted memories, raw local memories,
  transcripts, prompts, answers, cookies, bearer tokens, private local paths,
  and unredacted diagnostic archives.

Boundary:

- This packet does not call hosted Supermemory.
- This packet does not close the hosted-baseline blocker.
- Public comparison claims still require a non-fixture metrics-only hosted
  baseline, a matched RecallWeave run, a RecallWeave win, and two independent
  reviewer approvals.
