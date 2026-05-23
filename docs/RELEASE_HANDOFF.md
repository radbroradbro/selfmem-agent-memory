# Release Handoff

Use this page when the code is green but the repository still needs a human
release decision.

## Current State Labels

Use these labels in PRs, issues, and release notes:

- `code-checks-pass`: local checks and GitHub Actions pass.
- `fixture-ui-proven`: Brain UI evidence uses public fixture data only.
- `not-production-ready`: public launch remains blocked.
- `reviewer-concerns-recorded`: Claude Opus review ran and returned
  `CONCERNS`.
- `human-approval-required`: the owner must approve visibility, merge, and live
  rollout.

Do not shorten this to "ready" unless the public release checklist is complete.

## Manual GitHub Steps

PR #5 and GitHub issue #6 have been updated from the audited packet. If they
drift later, use the repo files below as the source of truth.

1. Open PR #5.
2. Verify the PR body matches
   `reviews/overnight-20260522/pr-body-update-draft.md`.
3. Verify GitHub issue #6 matches
   `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`,
   or record that the owner accepts the missing issue.
4. Link issue #6 in PR #5 if the relationship is not already visible.
5. Keep the public launch verdict as `FAIL` until the owner approves a different
   verdict.

Do not paste private diagnostics, raw memories, session transcripts, local agent
paths, provider keys, or private container names into GitHub.

## Generated Handoff Packet

Run this when GitHub write permissions are blocked and a maintainer needs a
single paste-ready packet, or when a later change needs the public PR/issue
text refreshed:

```bash
npm exec --yes pnpm@10.23.0 -- release:handoff
```

The GitHub handoff packet prints the current PR body, status comment, blocker
issue title, blocker issue body, labels, and manual steps. It does not call
GitHub or write files. Treat it as the public-safe source of truth only while
the packet reports `publicLaunchAllowed: false` and `productionReady: false`.

## Live GitHub Sync

Run this after refreshing PR #5 or issue #6, or before merge, to confirm the
live GitHub text still matches the checked-in release drafts:

```bash
npm exec --yes pnpm@10.23.0 -- release:github-sync
```

The live GitHub sync check calls the GitHub API in read-only mode and prints
only hashes, booleans, and public state. It does not print PR body text, issue
body text, credentials, private local paths, raw memories, transcripts, or
diagnostic contents.

## Blocker Doctor

Run this before merge or visibility changes:

```bash
npm exec --yes pnpm@10.23.0 -- release:doctor
```

The doctor is intentionally conservative. It should report
`publicLaunchAllowed: false` until Claude review, human approval, and
hosted-baseline blockers are resolved or explicitly accepted.
Use its `manualCommands` list as the next-action checklist for agents.

## Hosted Baseline Preflight

Run this before any hosted Supermemory comparison claim:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:preflight
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template
npm exec --yes pnpm@10.23.0 -- baseline:discover
npm exec --yes pnpm@10.23.0 -- baseline:select-container
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset
npm exec --yes pnpm@10.23.0 -- baseline:queryset
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet
npm exec --yes pnpm@10.23.0 -- baseline:next-run
npm exec --yes pnpm@10.23.0 -- baseline:next-run -- --fixture --require-ready
npm exec --yes pnpm@10.23.0 -- baseline:packet
npm exec --yes pnpm@10.23.0 -- baseline:packet:review
npm exec --yes pnpm@10.23.0 -- baseline:returned-packet
```

The preflight is offline by default. It should report `callsHostedProvider:
false` and `benchmarkClaimsAllowed: false` until a fresh metrics-only hosted
baseline result is supplied. Live baseline outputs must contain aggregate
metrics only. Do not include raw memory text, transcripts, prompts, answers,
credentials, cookies, or bearer tokens.
Every query in the source-locked query set must include at least one
`expectedResultIds` or `expectedResultHashes` entry. The collectors reject
unlabeled query sets so a live-looking run cannot create meaningless benchmark
metrics.

Use `--fixture` to verify the parser and result-shape gate without using a
provider key. Use `--print-template` before a live collection run and fill that
shape with aggregate metrics, source commits, model ids, costs, latency, and
hashes. The fixture is intentionally rejected as real hosted-baseline evidence.
Use `baseline:discover -- --live` first when the hosted Supermemory key can list
documents but the correct source container is unknown. It prints hashed
container candidates only. To recover the raw label locally, set
`RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1` and pass `--private-map-output`
to a path outside the repository. The private map is local operator material,
not reviewer or GitHub evidence. Then run `baseline:select-container` with the
public discovery report and private map. It writes the selected raw label into a
0600 private env file without printing the label. Source that env file locally
before `baseline:collect`, and never attach it to public evidence.
If the query set needs to be drafted from the selected hosted container, run:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset \
  -- --live --discovery <public-discovery> \
  --private-map <private-map> \
  --queryset-output <private-query-set> \
  --output <public-author-report>
```

Review the private query set locally before any collection. Attach only the
public author report and the strict `baseline:queryset` report. Do not attach
the private query set.
You may attach a public-safe live discovery report when it contains only hashed
candidate ids, counts, timestamps, status/type counts, and privacy flags. That
report proves metadata access and candidate discovery only. It does not close
the hosted-baseline blocker, pick the source container, or support any
comparison claim.
Use `baseline:queryset -- --queryset <path> --strict --output
/tmp/recallweave-hosted-baseline-queryset-report.json` before either side
collects results. The report is public-safe because it prints hashes and counts
only, and strict mode fails if any query lacks an expected result id or content
hash.
Use `baseline:collect -- --live` for the read-only hosted search collection
once `SUPERMEMORY_API_KEY` and the source-locked query-set environment are
configured. It writes metrics and hashes only.
Use `baseline:export:recallweave -- --live --container-dir <path>` to create a
local RecallWeave search-response export from `memories.jsonl` without raw
memory text. Use the exporter's `--output` flag for this file. Do not redirect
the package-manager command's stdout into JSON, because wrapper banners can
corrupt the evidence file before the collector reads it.
Use `baseline:collect:recallweave -- --live --responses <path>` after the
local RecallWeave run exports ids, scores, timings, token estimates, privacy
counters, and content hashes. The collector rejects raw response text by
default.
Use `baseline:compare` after both hosted and RecallWeave result files exist.
It blocks public claims unless both results are non-fixture, metrics-only,
privacy-clean, and source-locked to the same query set and scoring code.
Use `baseline:operator-packet` when an agent needs a paste-ready, public-safe
handoff for hosted baseline collection. The packet itself is a contract and
validation guide only. It does not call hosted Supermemory or close the blocker.
After live hosted discovery has been collected, pass the public-safe discovery
report back into the packet so the operator sees the current hashed candidate
state without raw labels:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --discovery reviews/overnight-20260522/hosted-baseline-live-discovery.json --format markdown
```

Use `baseline:next-run` when an agent has partial hosted or RecallWeave
evidence and needs the next exact command sequence. It is state-aware, calls no
hosted provider, keeps fixture evidence from closing the blocker, and never
authorizes public comparison claims by itself.
Use `baseline:next-run -- --require-ready` only after hosted, RecallWeave,
preflight, and comparison files exist. That switch fails closed for fixture,
partial, privacy-unclean, mismatched, losing, or unreviewed evidence. A passing
result means the comparison is ready for owner review, not public launch.
Use `baseline:packet` after hosted and RecallWeave aggregate files are collected
and compared. It creates one metrics-only zip for reviewer intake and rejects
fixture packets under `--strict-real`.
Use `baseline:packet:review` to inspect a received hosted-baseline packet
without unpacking raw evidence by hand. Use `baseline:returned-packet -- --packet
<returned-baseline-evidence-packet.zip> --require-production-baseline --output
/tmp/recallweave-returned-baseline-intake.json` when an agent returns a packet.
That command fails closed unless the packet is non-fixture, metrics-only,
privacy-clean, and contains hosted, RecallWeave, comparison, and preflight
evidence. Public benchmark language still requires reviewer and owner approval.

## Goal Completion Audit

Run this before anyone claims the active goal is complete:

```bash
npm exec --yes pnpm@10.23.0 -- goal:audit
```

The audit must report `goalComplete: false` while Claude review, human
approval, hosted-baseline, or real rollout evidence remain blocked. Do not call
the native goal complete unless a later audit proves every requirement with
current evidence.

## Canary Evidence Intake

First generate a sanitized runtime report from the selected agent container:

```bash
FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Apply the reviewed adapter, then run the patched agent for at least 15 minutes.

npm exec --yes pnpm@10.23.0 -- canary:report -- \
  --host hermes \
  --container <agent-selfmem-container-dir> \
  --since "$FRESH_WINDOW_START" \
  --rollback-tested \
  --output sanitized-report.json
```

If the agent sent a redacted diagnostic export instead of a live container path,
use the bundle directly:

```bash
npm exec --yes pnpm@10.23.0 -- canary:report -- \
  --diagnostic-dir <unzipped-agent-diagnostics-dir> \
  --since "$FRESH_WINDOW_START" \
  --rollback-tested \
  --output sanitized-report.json

npm exec --yes pnpm@10.23.0 -- canary:report -- \
  --zip <agent-diagnostics.zip> \
  --since "$FRESH_WINDOW_START" \
  --rollback-tested \
  --output sanitized-report.json
```

Then run the intake gate:

```bash
npm exec --yes pnpm@10.23.0 -- canary:intake -- --report sanitized-report.json --strict-real
```

If strict-real intake fails, keep its JSON output. The command exits nonzero
but still writes a sanitized failure report with failed checks, latency,
instrumentation, quality, and privacy counters. Feed that metrics-only output
to `canary:diagnose`; do not attach raw traces or memories.

If the intake gate fails, generate a metrics-only remediation plan:

```bash
npm exec --yes pnpm@10.23.0 -- canary:diagnose -- --report sanitized-report.json
```

The diagnosis should name failed checks, p95 latency values, missing latency
instrumentation, missing lifecycle coverage, identity issues, privacy failures,
and the next safe collection steps. Summary-only diagnostic exports are allowed
for diagnosis, but they cannot satisfy strict real canary evidence because they
do not prove prompt-time/store latency. It must not print memory text, prompt
text, answer text, local paths,
credentials, cookies, or bearer tokens.

The report must contain aggregate metrics only: hashed agent/container labels,
lifecycle event counts, hybrid-search coverage, local-write observation,
hosted read-through mode, adapter contract markers, p50 and p95 latency,
privacy counters, and rollback readiness. Strict-real evidence must use a fresh
post-update window of at least 15 minutes. Use `--since`, `--canary-since`, or
`--last-minutes` to avoid
letting old trace history prove or poison the patched adapter. The canary report
generator reads local trace files or metadata-only diagnostic summaries but does
not make a raw diagnostic export safe to attach.

The one-command updater path can write the report, intake, optional diagnosis,
and packet in one run:

```bash
bin/selfmem_update --host hermes --repo <runtime-checkout> --run-canary --rollback-tested --strict-real --canary-since "$FRESH_WINDOW_START" --canary-output /tmp/recallweave-canary-report.json --canary-intake-output /tmp/recallweave-canary-intake.json --canary-diagnosis-output /tmp/recallweave-canary-diagnosis.json --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
```

If the updater was not used for packaging, use `canary:packet` to create one
metrics-only zip for reviewers:

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --output /tmp/recallweave-canary-evidence-packet.zip
```

If strict intake failed, include the diagnosis file with `--diagnosis`. The
packet still does not authorize public launch or fleet rollout by itself. It
must not print raw memories, transcripts, prompts, answers, local paths,
credentials, cookies, or bearer tokens. A fixture pass is useful for the
tooling path, but it is not real rollout evidence.

When a reviewer receives the zip, validate the packet before treating it as
canary evidence:

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet:review -- --packet /tmp/recallweave-canary-evidence-packet.zip
```

Use `--strict-real` only when the packet is being offered as production canary
evidence. A fixture packet, failed intake packet, or packet without passing
strict-real intake must fail closed and remain diagnostic only.

The live adapter must expose `adapter.name: recallweave-selfmem-canary`,
`strictCanaryContract: v1`, and search/store latency instrumentation markers.
If those fields are absent, update the runtime with `selfmem_update` before
collecting a fresh canary window.

When several redacted agent diagnostic bundles are available, rank them before
deciding which agent should be the next real canary:

```bash
npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input-root <redacted-diagnostics-folder>
npm exec --yes pnpm@10.23.0 -- canary:batch-audit -- --input <agent-a.zip> --input <agent-b-dir>
```

The batch audit converts each bundle through `canary:report`,
`canary:intake --strict-real`, and `canary:diagnose`, then prints only hashed
labels, counts, latency, failed checks, and remediation categories. It never
prints raw memories, transcripts, prompts, answers, credentials, or private
paths. Add `--allow-failed-inputs` when a mixed returned-diagnostics folder has
one bad archive but still contains usable parsed bundles. Add
`--require-real-pass` only when the batch is meant to prove the real one-agent
canary blocker is closed; otherwise it is a triage tool.

After ranking the batch, generate one next-agent update plan:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --input-root <redacted-diagnostics-folder> --format markdown
```

The next-agent plan is safe to paste to one operator. It keeps public launch
and fleet rollout blocked, selects the closest privacy-clean candidate, and
prints only placeholder-based commands for dry-run, adapter apply, fresh-window
collection, strict intake, diagnosis, and metrics-only packet packaging.

When sending the handoff to another agent, prefer one packet over loose pasted
commands:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root <redacted-diagnostics-folder> --output /tmp/recallweave-next-agent-handoff.zip
```

For a live handoff, require the planner to prove the packet is not fixture/demo
evidence:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root <redacted-diagnostics-folder> --require-ready --output /tmp/recallweave-next-agent-handoff.zip
```

The packet contains only README, manifest, next-agent plan JSON/Markdown, and
strict-real operator instructions. It does not include raw diagnostics or memory
content. The selected operator should return only the metrics-only canary report,
intake JSON, optional diagnosis JSON, and canary evidence packet. Its manifest
records `readyForLiveHandoff`, a 15-minute fresh-window contract, and the exact
returned-packet intake command. Fixture packets can still test tooling, but
`--require-ready` rejects them before they can be sent as live operator work.

When a returned evidence packet arrives, intake it before interpreting the
result:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --output /tmp/recallweave-returned-canary-intake.json
```

For a release-blocking check, require production-grade evidence:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --require-production-canary --output /tmp/recallweave-returned-canary-intake.json
```

The command fails closed unless the returned packet is non-fixture,
metrics-only, privacy-clean, strict-real, and eligible to count as one-agent
production canary evidence. Even then, public launch and fleet rollout remain
blocked until maintainer approval.

Current Hermes and OpenClaw adapters use local-first bounded hosted
read-through. They search hosted Supermemory when local results are thin or the
query explicitly asks for old, legacy, hosted, or Supermemory history. To prove
hybrid search in a canary, include at least one explicit history query and verify
the sanitized report shows both local and hosted results. The adapters trace
total, local, and remote recall latency, plus whether hosted read-through was
attempted or skipped.

## Reviewer Route Choices

Claude Opus review now exists at
`reviews/overnight-20260522/claude-pr5-review.md` with verdict `CONCERNS`.
Treat it as support for an alpha PR only. It does not approve public launch,
benchmark claims, or native-goal completion.

Before merge, make sure the owner has accepted the current concern list and
the remaining blockers are visible.

## Alpha Merge Criteria

PR #5 may be merged as an alpha candidate only when all of these are true:

- GitHub Actions passed on the current head commit.
- `npm exec --yes pnpm@10.23.0 -- smoke` passed locally or in CI.
- `npm exec --yes pnpm@10.23.0 -- release:check` passed.
- Secret, forbidden-file, and private-name scans have zero hits.
- The PR body reflects the current evidence packet.
- The owner approved merge with the current blocker list visible.

Alpha merge does not mean production rollout. Agents still need canary rollout
with `selfmem_update`, sanitized runtime counts, and rollback notes.

## Public Visibility Criteria

Do not make the repository public until all alpha merge criteria are true and
the owner explicitly approves public visibility.

Before flipping visibility, confirm:

- `docs/PUBLIC_RELEASE_CHECKLIST.md` is complete.
- `reviews/overnight-20260522/release-state.json` still says
  `publicLaunchVerdict: "FAIL"` unless the owner has approved a new verdict.
- No public docs claim RecallWeave beats hosted Supermemory.
- Benchmark claims are metrics-only and point to reports without memory text.
- The demo uses dummy data only.

## Live Agent Rollout

For each deployed agent:

1. Update from the merged commit.
2. Run `selfmem_update` in dry-run mode.
3. Record `FRESH_WINDOW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")`.
4. Apply to one agent with `--apply`.
5. Run normal traffic for at least 15 minutes.
6. Prefer `--canary-output /tmp/recallweave-canary-report.json` plus
   `--canary-since "$FRESH_WINDOW_START"` so the update
   command writes a metrics-only report while it runs adapter smoke.
7. Verify the agent can still answer normal traffic and then collect a fresh
   live window with event counts, redaction count, provider mode, search/store
   latency samples, and errors.
8. Run `canary:report` for the selected agent container if the update command
   did not already write a report.
9. Run `canary:intake -- --report sanitized-report.json --strict-real`.
10. If strict intake fails, run
   `canary:diagnose -- --report sanitized-report.json` and attach only the
   metrics-only remediation output to the PR or issue.
11. Open a PR or issue if any runtime behavior diverges.

Do not roll the same change to every agent until one-agent canary evidence is
clean.
