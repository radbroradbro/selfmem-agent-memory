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

## One-Agent Canary Workspace

Use `reviews/overnight-20260522/next-agent-workspace/` when the selected agent
returns canary evidence. That folder is for native CLI markdown findings and
maintainer intake notes only. It should contain aggregate metrics, hashes,
pass/fail flags, command ids, and timestamps.

Do not put raw memories, transcripts, prompts, answers, provider keys, cookies,
private local paths, private container names, or unredacted diagnostics in that
workspace.

The current handoff packet remains:

- `recallweave-openclaw-next-agent-canary-20260524-3d61677.zip`
- SHA-256:
  `15cd332af510b104bd9040ac78e8fff4c1b7ffb3d7628b62bfb897730514f2fe`
- Expected returned report commit:
  `3d61677bc3d316e040ac5a634467d0204c272493`

The returned packet must pass `canary:returned-packet` with
`--require-production-canary` and the expected adapter commit before the real
rollout blocker can close. A packet from an older adapter is diagnostic only.
The expected report commit is the latest verified adapter/product baseline, not
necessarily the latest docs-only PR head. The handoff command passes this
approved commit into the report generator so a later evidence-only commit does
not invalidate the runtime canary.

The current standard-inbox scan is
`reviews/overnight-20260522/returned-downloads-current-scan.md`. It found 0
production evidence packets, 10 handoff packets, 8 diagnostic bundles, 19
unknown packets, and 5 unreadable packets. That proves the current inbox has
handoffs and diagnostics only. It does not close the real-container rollout
blocker.

To convert a returned packet into public-safe workspace notes, run:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-workspace -- \
  --packet <returned-canary-evidence-packet.zip> \
  --workspace reviews/overnight-20260522/next-agent-workspace \
  --output /tmp/recallweave-returned-workspace.json
```

Add `--require-production-canary` when the command should fail unless the
returned packet can close the one-agent canary blocker.

## Hosted Baseline Preflight

This lane is optional when hosted Supermemory is quota-locked. The public
benchmark lane in `docs/PUBLIC_BENCHMARK_TARGETS.md` is the main route for
objective scoring: run RecallWeave on a source-locked public benchmark slice
and compare the result to reported leaderboard or provider stats. Use hosted
Supermemory for read-through parity, free-tier sanity checks, or historical
container export only. Do not require hosted writes for the autoresearch loop.

Validate the target first:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:source-lock -- --strict
npm exec --yes pnpm@10.23.0 -- benchmark:public-slice -- --live \
  --output reviews/overnight-20260522/public-longmemeval-slice-evidence.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-slice-evidence.md

npm exec --yes pnpm@10.23.0 -- benchmark:public-target:author -- \
  --slice-manifest reviews/overnight-20260522/public-longmemeval-slice-evidence.json \
  --claim-tier run-only \
  --judge-model gpt-4o \
  --answer-model gpt-4o \
  --judge-rule <source-locked-judge-rule> \
  --output reviews/overnight-20260522/public-longmemeval-run-target.json

npm exec --yes pnpm@10.23.0 -- benchmark:public-target -- \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --strict-run

npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-materialize-run.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-materialize-run-evidence.md

npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-strategy-compare.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-strategy-compare-evidence.md

npm exec --yes pnpm@10.23.0 -- benchmark:public-hybrid -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-hybrid-gate.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-hybrid-gate-evidence.md

npm exec --yes pnpm@10.23.0 -- benchmark:public-autoresearch -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json \
  --output reviews/overnight-20260522/public-longmemeval-autoresearch-loop.json \
  --markdown-output reviews/overnight-20260522/public-longmemeval-autoresearch-loop-evidence.md

npm exec --yes pnpm@10.23.0 -- benchmark:public-target:author -- \
  --benchmark longmemeval \
  --source-url https://github.com/supermemoryai/memorybench \
  --dataset-revision <source-locked-commit-or-dataset-version> \
  --split <public-split-or-canary-slice> \
  --question-ids-file <public-question-ids.txt> \
  --answer-labels-ref <public-label-file-or-dataset-ref> \
  --answer-labels-hash sha256:<label-hash> \
  --judge-model <same-judge-model> \
  --answer-model <same-answer-model> \
  --source-lock-note <why-this-is-the-same-data-and-scorer> \
  --judge-rule <source-locked-judge-rule> \
  --scoring-script-ref <official-or-memorybench-scorer-ref> \
  --scoring-code-hash sha256:<scorer-hash> \
  --reported-source-name <leader-or-provider-row> \
  --reported-source-url <reported-row-url> \
  --reported-metric-name <matching-metric> \
  --reported-score <score> \
  --reported-caveat <why-this-row-is-comparable-or-limited> \
  --output <target.json>

npm exec --yes pnpm@10.23.0 -- benchmark:public-target -- --target <target.json> --strict
```

Use `--strict-run` for a real same-data run target without comparison claims.
Use `--strict` only when a reported leaderboard or provider row is attached and
the result will be compared.

The current materialized LongMemEval-S run writes private query and haystack
files outside the repository and commits only metrics-safe evidence. The
checked-in retrieval-proxy result is
`reviews/overnight-20260522/public-longmemeval-recallweave-run-result.json`.
It now uses `bm25-lite-b800-k5`, the winning same-data autoresearch setting.
It is useful as a blind autoresearch baseline, but it is not a MemoryBench
answer-quality result and not a public comparison claim.

The current same-data retrieval strategy comparison is
`reviews/overnight-20260522/public-longmemeval-strategy-compare.json`.
`bm25-lite` beat the initial `jaccard` baseline on this six-row retrieval-proxy
slice, moving quality from 0.1089 to 0.4541 and P@1 from 0.1667 to 0.8333 with
zero privacy failures. The canonical checked-in RecallWeave run has been
regenerated with `bm25-lite-b800-k5`. Treat it as the next autoresearch method
choice, not a public benchmark claim.

The current same-data autoresearch loop is
`reviews/overnight-20260522/public-longmemeval-autoresearch-loop.json`. It ran
72 local-only retrieval-proxy arms across lexical, dense-proxy, temporal,
graph-proxy, rerank-proxy, and query-expansion-proxy strategies. It selected
`bm25-lite-b800-k5`, preserving quality 0.4541 while reducing average context
tokens to 800. The checked-in retrieval-proxy run now uses that setting. Treat
it as a local methodology improvement, not MemoryBench answer-quality proof.

The follow-up hybrid gate is
`reviews/overnight-20260522/public-longmemeval-hybrid-gate.json`. It compares
`bm25-lite` against local-only dense, sparse+dense, temporal, graph, rerank, and
query-expansion proxy arms on the same source-locked slice. `full-hybrid-rerank`
and `query-expanded-full-hybrid-rerank` tied BM25 quality but were slower, so
the gate keeps `bm25-lite` as the control/fallback and blocks hybrid default
promotion until real embedding/reranker arms beat it on a larger slice.

The expanded hybrid stress gate is
`reviews/overnight-20260522/public-longmemeval-expanded-hybrid-gate.json`. It
uses 30 public LongMemEval-S questions, 92 expected references, and 1,420
haystack sessions. BM25 remains the control winner, while
`full-hybrid-rerank` is slightly worse and slower. Treat that as a blocker on
promoting the deterministic proxy hybrid. The next benchmark move is live
provider-backed embedding and reranking, gated by the provider preflight below.

The provider-backed gate starts as a fixture-only CI path:
`reviews/overnight-20260522/public-longmemeval-provider-gate-fixture.json`.
It checks the exact public-safe comparison shape for `bm25-lite`,
`full-hybrid-rerank`, `cloud-voyage-rerank-only`, `cloud-voyage4-voyage`,
`cloud-gemini-embed-rerank-proxy`, `cloud-gemini-voyage-rerank`,
`cloud-nvidia-retriever-500m`, `cloud-nvidia-nemotron-1b`,
`cloud-nvidia-e5-mistral`, and `local-apple-qwen3-0_6b`. Fixture mode uses
deterministic mocks and makes zero hosted calls. A real provider run is opt-in
only:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 \
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 \
VOYAGE_API_KEY=<env-only> \
GEMINI_API_KEY=<env-only-if-running-gemini-arm> \
NVIDIA_API_KEY=<env-only-if-running-nvidia-arm> \
SELFMEM_LOCAL_EMBED_BASE_URL=<env-only-if-running-local-apple-arm> \
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
```

The preflight evidence lives at
`reviews/overnight-20260522/public-longmemeval-provider-live-preflight.json`.
It calls no provider APIs and sends no benchmark text. In the current controller
environment it is blocked because the env-only provider keys and explicit
public-data/provider-call flags are absent. Do not describe provider-backed
results as live until this preflight reports
`READY_FOR_LIVE_PROVIDER_BENCHMARK`.

For the stronger 30-question LongMemEval-S slice, use the expanded target:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 \
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 \
VOYAGE_API_KEY=<env-only> \
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json \
  --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage \
  --max-memory-bytes 80000000
```

The checked-in expanded preflight is
`reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight.json`.
It is blocked in the clean controller environment for the same reason: no
provider-call consent, no public-data consent, and no env-only provider keys.
For one-provider runs, prefer the checked-in single-arm preflights:
`reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-voyage.json`
or
`reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-nvidia.json`.
Each report includes a live command template that names only the selected
provider credential and keeps the BM25 and full-hybrid controls in the same
comparison.

Do not use the provider gate on private agent memories unless the operator has
separately approved sending that text to the provider.

Run this before any hosted Supermemory comparison claim:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:preflight
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template
npm exec --yes pnpm@10.23.0 -- baseline:discover
npm exec --yes pnpm@10.23.0 -- baseline:select-container
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset
npm exec --yes pnpm@10.23.0 -- baseline:queryset
npm exec --yes pnpm@10.23.0 -- baseline:mirror-hosted
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet
npm exec --yes pnpm@10.23.0 -- baseline:next-run
npm exec --yes pnpm@10.23.0 -- baseline:run -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:next-run -- --fixture --require-ready
npm exec --yes pnpm@10.23.0 -- baseline:packet
npm exec --yes pnpm@10.23.0 -- baseline:packet:review
npm exec --yes pnpm@10.23.0 -- baseline:returned-packet
npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake
```

The preflight is offline by default. It should report `callsHostedProvider:
false` and `benchmarkClaimsAllowed: false` until a fresh metrics-only hosted
baseline result is supplied. Live baseline outputs must contain aggregate
metrics only. Do not include raw memory text, transcripts, prompts, answers,
credentials, cookies, or bearer tokens.
Every query in the source-locked query set must include at least one
`expectedResultIds` or `expectedResultHashes` entry, and every query text must
be distinct. The collectors reject unlabeled or duplicate query sets so a
live-looking run cannot create meaningless benchmark metrics.

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
When the hosted source is the intended baseline source, run
`baseline:mirror-hosted -- --live` after authoring the private query set. It
reads hosted Supermemory, writes a private local RecallWeave-compatible mirror
outside the repository, and emits only a metrics report. The mirror directory
contains redacted memory text plus `container-map.json`; keep both files local
and attach only the mirror report.
The current live prep evidence found a selected hashed hosted candidate,
drafted 8 private queries from 46 text-bearing documents, and strict inspection
reported 8 unique queries with 0 duplicate or unlabeled queries. That evidence
narrows the blocker but does not replace a matched hosted-vs-RecallWeave run.
The current exploratory live hosted-vs-local Codex run completed the full
`baseline:run` chain without raw text or leaks, but both arms scored zero
against the private labels. Treat that as a source-match/label-construction
finding, not as public benchmark evidence.
A later source-matched budgeted live run completed against a private hosted
mirror with `--preserve-ids`, a reviewed query set, and
`--context-token-budget 1600`. Hosted Supermemory scored 0.0000 quality with
average context tokens 1397. RecallWeave scored 0.1212 quality, P@1 0.125,
recall@5 0.125, recall@10 0.125, and average context tokens 1600. Both arms had
zero privacy failures. This closes the earlier context-budget rerun task, but
does not authorize launch. Two independent reviewers have now approved the
exact metrics-only packet through `baseline:reviewer-intake`, and the reviewed
comparison is ready for owner review.
You may attach a public-safe live discovery report when it contains only hashed
candidate ids, counts, timestamps, status/type counts, and privacy flags. That
report proves metadata access and candidate discovery only. It does not close
the hosted-baseline blocker, pick the source container, or support any
comparison claim.
Use `baseline:queryset -- --queryset <path> --strict --output
/tmp/recallweave-hosted-baseline-queryset-report.json` before either side
collects results. The report is public-safe because it prints hashes and counts
only, and strict mode fails if any query lacks an expected result id or content
hash or duplicates another query.
Use `baseline:collect -- --live` for the read-only hosted search collection
once `SUPERMEMORY_API_KEY` and the source-locked query-set environment are
configured. It writes metrics and hashes only.
Use `baseline:export:recallweave -- --live --container-dir <path>` to create a
local RecallWeave search-response export from `memories.jsonl` without raw
memory text. Use the exporter's `--output` flag for this file, and pass
`--context-token-budget` or set `RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET`
for matched hosted comparisons. Do not redirect the package-manager command's
stdout into JSON, because wrapper banners can corrupt the evidence file before
the collector reads it.
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
Before `baseline:run`, use `baseline:source-match --strict` with the reviewed
query set and the selected private hosted mirror or source-matched local
RecallWeave container. Use `--preserve-ids` when the source is a hosted mirror.
It emits only hashes, counts, readiness flags, and privacy counters. Do not
spend hosted calls unless that report says `sourceMatchReady: true`.
Then run `baseline:source-align --strict` with the source-match report, local
container map from the mirror or source-matched local container, and private
hosted map. It catches the subtle failure where the hosted label and local
mapping match, but the local source still lacks the expected refs needed for a
fair benchmark.
Then run `baseline:source-gap` with the source-match and source-alignment
reports. That public-safe report must say `READY_FOR_MATCHED_BASELINE` before a
hosted collection run is meaningful. If it reports a blocked state, follow its
repair path instead of spending more hosted calls. For blocked reports, use the
hashed `repairQueue` to decide whether each private query needs mirrored hosted
source content, rebuilt local-source labels, or converted collectable content
hashes. Do not attach the private query set or raw memory text.
To hand that state to another agent without leaking private labels, reload only
the public-safe source-gap report into the operator packet:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- \
  --source-gap /tmp/recallweave-baseline-source-gap.json \
  --format markdown
```

Use `baseline:run` after the private hosted env file, reviewed private query
set, private hosted mirror or source-matched local container, source-match
preflight, source-alignment gate, and source-gap plan are ready. It repeats the
source gates, writes the source-gap plan, then runs hosted collection, local export, local collection,
preflight, comparison, packet creation, and returned-packet intake in one
metrics-only chain:

```bash
. /tmp/recallweave-hosted-baseline.private.env
RECALLWEAVE_BASELINE_LIVE=1 \
RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
RECALLWEAVE_BASELINE_QUERYSET_REVIEWED=1 \
RECALLWEAVE_BASELINE_QUERYSET=/tmp/recallweave-hosted-baseline-queryset.json \
RECALLWEAVE_BASELINE_PRESERVE_IDS=1 \
npm exec --yes pnpm@10.23.0 -- baseline:run -- \
  --live \
  --container-env /tmp/recallweave-hosted-baseline.private.env \
  --queryset /tmp/recallweave-hosted-baseline-queryset.json \
  --container-dir /tmp/recallweave-hosted-local-mirror \
  --local-map /tmp/recallweave-hosted-local-mirror/container-map.json \
  --private-map /tmp/recallweave-hosted-container-map.private.jsonl \
  --preserve-ids \
  --reviewed-queryset \
  --output /tmp/recallweave-baseline-run.json
```

Fixture mode proves the chain, but does not count as a fresh hosted baseline.
The first live Codex-local run proved the chain too, but still does not support
public claims because the selected hosted-source query labels did not retrieve
non-zero evidence on either side. The next live run needs a source-matched
local container or mirrored local export, proven by `baseline:source-match`,
source-aligned by `baseline:source-align`, and marked ready by
`baseline:source-gap`, before quality claims are meaningful.
The current source-matched budgeted run has now cleared that source-matched
rerun step and the reviewer-approval step. The next benchmark task is not
another hosted call by default. It is owner review of the metrics-only canary
packet, then a broader benchmark only if the owner approves the claim scope.
Use `baseline:packet` after hosted and RecallWeave aggregate files are collected
and compared. It creates one metrics-only zip for reviewer intake and rejects
fixture packets under `--strict-real`.
Use `baseline:packet:review` to inspect a received hosted-baseline packet
without unpacking raw evidence by hand. Use `baseline:returned-packet -- --packet
<returned-baseline-evidence-packet.zip> --require-public-benchmark --output
/tmp/recallweave-returned-baseline-intake.json` when an agent returns a packet.
That command fails closed unless the packet is non-fixture, metrics-only,
privacy-clean, and contains hosted, RecallWeave, comparison, and preflight
evidence. Public launch still requires owner approval.
Use `baseline:reviewer-intake` only with sanitized approval JSON files that
bind to the packet SHA or run hash. It can accept approvals produced after
Claude, Codex, Gemini, DeepSeek, or another reviewer inspects the metrics-only
packet, but it does not accept raw memories, keys, private paths, or a loose
reviewer count.

For DeepSeek or another OpenAI-compatible reviewer, generate the approval file
with an env-only direct call:

```bash
# Set the real value outside the repo and outside pasted command logs.
export RECALLWEAVE_REVIEW_OPENAI_API_KEY="..."

RECALLWEAVE_REVIEW_OPENAI_PROVIDER=deepseek \
RECALLWEAVE_REVIEW_OPENAI_MODEL=deepseek-v4-pro \
npm exec --yes pnpm@10.23.0 -- baseline:reviewer:openai-compatible \
  -- --packet /tmp/recallweave-baseline-evidence-packet.zip \
  --comparison /tmp/recallweave-baseline-comparison.json \
  --reviewer-id deepseek-reviewer-a \
  --output /tmp/reviewer-a-approval.json
```

Run the same command with `--dry-run` first when checking a fresh install. The
dry-run artifact is intentionally non-countable, so it cannot fake a benchmark
approval.

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
bin/selfmem_update --host hermes --repo <runtime-checkout> --run-canary --rollback-tested --strict-real --expected-commit <approved-commit> --canary-since "$FRESH_WINDOW_START" --canary-output /tmp/recallweave-canary-report.json --canary-intake-output /tmp/recallweave-canary-intake.json --canary-diagnosis-output /tmp/recallweave-canary-diagnosis.json --canary-packet-output /tmp/recallweave-canary-evidence-packet.zip
```

Before collecting, use the deterministic drill to make the fresh window
exercise the signals strict intake expects:

```bash
npm exec --yes pnpm@10.23.0 -- canary:drill -- --host hermes --format markdown --output /tmp/recallweave-canary-drill.md
npm exec --yes pnpm@10.23.0 -- canary:drill -- --host openclaw --format markdown --output /tmp/recallweave-canary-drill.md
```

The drill uses public test prompts only. It asks the agent to store and recall a
public canary fact, run hosted read-through without quoting memory text,
exercise lifecycle or LCM compression, run a rollback dry-run, and return only
the metrics-only report, intake, diagnosis if needed, and packet.

If the updater was not used for packaging, use `canary:packet` to create one
metrics-only zip for reviewers:

```bash
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report /tmp/recallweave-canary-report.json --intake /tmp/recallweave-canary-intake.json --expected-commit <approved-commit> --output /tmp/recallweave-canary-evidence-packet.zip
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

For mixed return folders, pass the triage flag through the planner so one bad
archive does not block the best privacy-clean candidate:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent -- --input-root <redacted-diagnostics-folder> --allow-failed-inputs --format markdown
```

The next-agent plan is safe to paste to one operator. It keeps public launch
and fleet rollout blocked, selects the closest privacy-clean candidate, and
prints only placeholder-based commands for dry-run, adapter apply, fresh-window
collection, strict intake, diagnosis, and metrics-only packet packaging.

When sending the handoff to another agent, prefer one packet over loose pasted
commands:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root <redacted-diagnostics-folder> --expected-commit <approved-commit> --output /tmp/recallweave-next-agent-handoff.zip
```

For a live handoff, require the planner to prove the packet is not fixture/demo
evidence:

```bash
npm exec --yes pnpm@10.23.0 -- canary:next-agent-packet -- --input-root <redacted-diagnostics-folder> --allow-failed-inputs --require-ready --expected-commit <approved-commit> --output /tmp/recallweave-next-agent-handoff.zip
```

The packet contains only README, manifest, next-agent plan JSON/Markdown,
strict-real operator instructions, and the deterministic canary drill. It does
not include raw diagnostics or memory content. The selected operator should
return only the metrics-only canary report, intake JSON, optional diagnosis
JSON, and canary evidence packet. Its manifest
records `readyForLiveHandoff`, a 15-minute fresh-window contract, and the exact
returned-packet intake command. Fixture packets can still test tooling, but
`--require-ready` rejects them before they can be sent as live operator work.

When a returned evidence packet arrives, intake it before interpreting the
result:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --expected-commit <approved-commit> --output /tmp/recallweave-returned-canary-intake.json
```

For a mixed folder of agent replies, scan the inbox first. The scanner separates
returned evidence packets from handoff packets, diagnostic bundles, unreadable
zips, and unrelated files without exposing raw paths or memory text. Candidate
file names are redacted by default for folder scans; use `--expose-labels` only
for local operator-only review:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root <folder-of-agent-zips> --output /tmp/recallweave-returned-canary-inbox.json
```

For repeated supervision, use the watcher. It keeps candidate filenames
hash-redacted and exits successfully while waiting unless `--require-found` is
set:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-watch -- --input-root <folder-of-agent-zips> --include-all-zips --iterations 1 --output /tmp/recallweave-returned-canary-watch.json
```

For the common local workflow, use the Downloads scanner. It checks the standard
Downloads and Telegram Desktop inboxes without requiring private folder paths
in the command, and it can write a markdown findings note for the review
workspace:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads -- --output /tmp/recallweave-returned-downloads.json --findings-output reviews/overnight-20260522/next-agent-workspace/returned-downloads-findings.md
```

For a release-blocking check, require production-grade evidence:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --require-production-canary --expected-commit <approved-commit> --output /tmp/recallweave-returned-canary-intake.json
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root <folder-of-agent-zips> --require-production-canary --expected-commit <approved-commit> --output /tmp/recallweave-returned-canary-inbox.json
npm exec --yes pnpm@10.23.0 -- canary:returned-watch -- --input-root <folder-of-agent-zips> --include-all-zips --require-found --expected-commit <approved-commit> --output /tmp/recallweave-returned-canary-watch.json
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads -- --require-found --output /tmp/recallweave-returned-downloads.json
```

The command fails closed unless the returned packet is non-fixture,
metrics-only, privacy-clean, strict-real, and eligible to count as one-agent
production canary evidence for the expected adapter commit. Even then, public
launch and fleet rollout remain blocked until maintainer approval.

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
