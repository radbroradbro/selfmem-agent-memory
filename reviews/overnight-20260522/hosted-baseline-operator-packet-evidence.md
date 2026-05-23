# Hosted Baseline Operator Packet Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/hosted-baseline-operator-packet.mjs`.
- Added `baseline:operator-packet` as a package script and smoke step.
- The packet gives operators one public-safe baseline collection contract for
  hosted Supermemory comparison evidence, matched RecallWeave collection, and
  metrics-only comparison.
- The packet now starts with `baseline:discover` so an operator can find likely
  hosted source containers without exposing raw hosted labels or memory text.
- The packet documents the optional private map flow and states that the
  private map stays local and must not be attached.
- The packet now includes `baseline:queryset --strict` before collection so
  operators can attach a metrics-only query-set report without exposing raw
  query text or expected ids.
- The packet now points operators to `baseline:collect -- --live`,
  `baseline:export:recallweave -- --live`,
  `baseline:collect:recallweave -- --live`, and `baseline:compare` instead of
  ad hoc external collectors.
- The packet now points operators to `baseline:packet --strict-real` so the
  hosted result, RecallWeave result, comparison, and preflight become one
  metrics-only reviewer zip.
- The packet can now accept `--discovery
  reviews/overnight-20260522/hosted-baseline-live-discovery.json` and include
  the already-proven live hosted metadata state: 100 documents seen, 4 hashed
  candidate containers, no raw labels, no raw memory, and zero privacy leaks.
- Gemini focused review returned `CLEAN`.

Commands:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --format markdown
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --discovery reviews/overnight-20260522/hosted-baseline-live-discovery.json --format markdown
npm exec --yes pnpm@10.23.0 -- baseline:discover
npm exec --yes pnpm@10.23.0 -- baseline:queryset
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:packet
```

Expected behavior:

- JSON mode reports `mode: hosted-baseline-operator-packet`.
- Markdown mode prints a paste-ready operator packet.
- Discovery mode summarizes live hosted metadata discovery without raw hosted
  labels or memory text.
- Discovery mode reports `fixtureOnly: false`, `callsHostedProvider: true`,
  `documentsSeen: 100`, `containerCandidateCount: 4`, hashed candidate ids,
  and zero privacy leaks.
- `writesRealFiles` is false.
- `callsHostedProvider` is false.
- It tells operators to print the template, validate fixture parsing, then
  discover candidate hosted containers, collect, and validate aggregate-only
  hosted and RecallWeave results.
- It tells operators that discovery output may be attached but private raw-label
  maps must stay local.
- It tells operators to create a local RecallWeave search export with
  `baseline:export:recallweave`, then convert that export into a metrics-only
  result before comparison.
- It tells operators to use the exporter's `--output` flag and not shell-redirect
  the package-manager command's stdout into JSON, because wrapper banners can
  corrupt the evidence file.
- It tells operators to run `baseline:compare` only after hosted and
  RecallWeave outputs share the same dataset, query-set hash, scoring-code
  hash, judge model, and answer model.
- It tells operators to run `baseline:queryset --strict` and attach the
  metrics-only query-set report, not the raw query file.
- It tells operators every query must have at least one expected result id or
  expected content hash, and that `querySetEvidence.publicBenchmarkReady` must
  be true for both hosted and RecallWeave results.
- It tells operators to run `baseline:packet --strict-real` after comparison so
  reviewers receive one metrics-only zip instead of loose ad hoc JSON.
- It tells operators to keep `SUPERMEMORY_API_KEY` in the local environment and
  never paste it into the command or any attachment.
- It requires env-only hosted credentials and never prints provider-key values.
- It tells operators to attach only:
  - `/tmp/recallweave-hosted-baseline-result.json`
  - `/tmp/recallweave-hosted-baseline-preflight.json`
  - `/tmp/recallweave-hosted-baseline-discovery.json`
  - `/tmp/recallweave-hosted-baseline-queryset-report.json`
  - `/tmp/recallweave-result.json`
  - `/tmp/recallweave-baseline-comparison.json`
  - `/tmp/recallweave-baseline-evidence-packet.zip`
- It forbids provider keys, raw hosted memories, raw RecallWeave response
  exports containing memory text, raw local memories, transcripts, prompts,
  answers, cookies, bearer tokens, private local paths, private container maps,
  and unredacted
  diagnostic archives.

Boundary:

- This packet does not call hosted Supermemory.
- This packet does not close the hosted-baseline blocker.
- Public comparison claims still require a non-fixture metrics-only hosted
  baseline, a matched RecallWeave run, labeled query sets, a RecallWeave win,
  and two independent reviewer approvals.
