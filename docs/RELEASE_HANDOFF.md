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
`publicLaunchAllowed: false` until owner approval, the full-memory SOTA
benchmark gate, and the real canary blocker are resolved or explicitly
accepted. Its blocker list must include
`full-memory-sota-benchmark-gate-incomplete` while the full same-data
answer-quality shard ladder is incomplete.
Use its `manualCommands` list as the next-action checklist for agents.

For the benchmark-specific blocker, run:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:accepted-lane-doctor
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-shard-workorder
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-shard-intake
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:local-accepted-lane-doctor
npm exec --yes pnpm@10.23.0 -- benchmark:sota-doctor
```

The accepted-lane doctor does not call providers or expose raw benchmark text.
It names the exact env-only operator inputs still needed before the only
full-SOTA shard-intake-compatible lane can launch. The local workorder and
intake commands are no-provider-call checks for the local 500-query path only;
they do not authorize SOTA or launch language. The SOTA doctor then summarizes
the full LongMemEval target, raw-source-retention state, accepted-lane launch
readiness, BM25-as-control contract, full-shard coverage, current canary score,
reported-target delta, reviewer status, UI/docs refresh status, owner approval,
and real-canary blockers. It must remain
`BLOCKED_FULL_MEMORY_SOTA_EVIDENCE` until the full same-data answer-quality
result, provider arms, reviewers, UI/docs, owner approval, and real canary all
pass.

## One-Agent Canary Workspace

Use `reviews/overnight-20260522/next-agent-workspace/` when the selected agent
returns canary evidence. That folder is for native CLI markdown findings and
maintainer intake notes only. It should contain aggregate metrics, hashes,
pass/fail flags, command ids, and timestamps.

Do not put raw memories, transcripts, prompts, answers, provider keys, cookies,
private local paths, private container names, or unredacted diagnostics in that
workspace.

The current selected-agent send set is:

- `recallweave-openclaw-next-agent-canary-20260525-SEND-THIS-ONE-18d606a.zip`
- `recallweave-SEND-THIS-ONE-openclaw-canary-instructions.md`
- `recallweave-SEND-THIS-ONE-checksum.txt`

The current handoff packet remains the clearly named sendable packet:

- Zip:
  `recallweave-openclaw-next-agent-canary-20260525-SEND-THIS-ONE-18d606a.zip`
- SHA-256:
  `cb03a1bf25772e2ee397b64f76fa7c485989dd1b3652a37ad8622f6d6ed0289a`
- Packet generated from controller commit:
  `f21a7e751ddcd0b9e64a96d682a3fa0940c17c11`
- Approved adapter commit:
  `18d606aff589986b4d8b416a686bedb7ff1506d2`
- Expected returned report commit:
  `18d606aff589986b4d8b416a686bedb7ff1506d2`

The returned packet must pass `canary:returned-packet` with
`--require-production-canary` and the expected adapter commit before the real
rollout blocker can close. A packet from an older adapter is diagnostic only.
The expected report commit is the approved runtime adapter baseline, not
necessarily the latest verified PR head. The handoff command passes this
approved commit into the report generator so later evidence or docs commits do
not invalidate the runtime canary.
If a newer adapter commit should count, regenerate the handoff packet with that
commit first.

The current standard-inbox scan is
`reviews/overnight-20260522/returned-downloads-current-scan.md`. It found 0
production evidence packets, 1 handoff packet, 10 diagnostic bundles, 22
unknown packets, and 0 unreadable packets. That proves the current inbox has
handoff packets and diagnostics only. It does not close the real-container
rollout blocker. The findings note now includes hash-only safe triage for unknown and
unreadable zips, so maintainers can see whether the misses are malformed,
diagnostic, or non-canary packets before exposing local filenames.

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

New LongMemEval-S materialization runs write private raw-source, selected-row,
query, haystack, answer-label, and source-manifest files outside the repository
and commit only metrics-safe evidence. The public report keeps hashes and
counts for the raw source lineage so reviewers can audit compressed or derived
inputs without exposing raw benchmark text in the repo. The
checked-in retrieval-proxy result is
`reviews/overnight-20260522/public-longmemeval-recallweave-run-result.json`.
It now uses `bm25-lite-b800-k5`, the winning same-data autoresearch setting.
It is useful as a blind autoresearch baseline, but it is not a MemoryBench
answer-quality result and not a public comparison claim.

The current answer-quality harness smoke is
`reviews/overnight-20260522/answer-quality-harness-smoke-20260525.json`, and
the live-run preflights are
`reviews/overnight-20260522/answer-quality-arm-export-20260525.json` and
`reviews/overnight-20260522/answer-quality-preflight-20260525.json`. The smoke
proves the metrics-only `benchmark:answer-quality` output shape in fixture mode
with zero provider calls. The arm-export preflight proves the same-data response
arm plan is present for BM25, full-hybrid, query expansion, provider, local
Apple, and local rerank arms. The clean-shell scoring preflight remains useful
as a fail-closed check when private materialized inputs, response arm exports,
model-call consent, public-data consent, or no-raw-output consent are absent.

A full local same-data LongMemEval answer-quality run now exists:
`reviews/overnight-20260522/end-to-end-memory-score-live-local-20260525.json`.
It scored 30 queries across BM25, full hybrid, query-expanded hybrid, local
Qwen3 0.6B embedding, and local Qwen3 0.6B embedding plus local rerank arms.
The best local arm was `local-apple-qwen3-0_6b-local-rerank` at `36`
answer-quality / `0.3667` correct rate with 300 local model calls and zero
answer or judge failures. The combined same-data answer-quality report,
`reviews/overnight-20260522/end-to-end-memory-score-combined-20260525.json`,
adds the NVIDIA `cloud-nvidia-nemotron-1b` provider arm at `43.1667`
answer-quality / `0.4333` correct rate. Two independent reviewer approvals are
recorded in
`reviews/overnight-20260522/memory-score-reviewer-intake-20260525.json`.
The full 500-query LongMemEval target is ready as a run target, and the
answer-quality harness now supports chunked response exports and scoring with
`--query-offset` and `--max-queries`. The checked-in shard plan is
`reviews/overnight-20260522/answer-quality-full-shard-plan-20260525.json`; it
splits the full target into twenty 25-query shards and keeps BM25, full hybrid,
query expansion, Voyage, NVIDIA, local Apple, and local rerank arms on the same
source-locked data. The SOTA operator packet follows that plan directly: each
shard exports private response arms into its own shard directory, runs
answer-quality preflight against those shard-local arms, and only then writes
the public-safe shard score. That preflight now checks that every response arm
covers the selected `--query-offset` / `--max-queries` range before scoring.
Merge those chunks only with
`benchmark:answer-quality:combine -- --combine-mode shards`, which rejects gaps,
overlaps, target/model mismatches, and mixed strategy sets.
Before spending model calls on those shards, run
`benchmark:answer-quality:private-input-doctor` against the regenerated private
materialized directory. The current evidence,
`reviews/overnight-20260522/full-shard-private-input-doctor-current.json`,
shows the private full queryset, memories, answer labels, raw dataset, selected
raw rows, and source manifest are present outside the repository, hash-matched,
mode `0600`, and covered by the shard plan's `300000000` byte memory cap. This
is full-shard run readiness only; it is not a 500-query score, SOTA proof, or a
public claim.
Release verification now preserves those private benchmark materials: the stale
temp cleanup in `release:check` only removes old
`recallweave-release-check-root-*` directories and has a regression check that
keeps `recallweave-sota-full-*` materialization roots and current-path pointer
files intact.
The first private BM25 control export probe is recorded at
`reviews/overnight-20260522/full-shard-bm25-control-export-probe-20260526.json`.
It confirms `shard-001` can export 25 `bm25-lite` responses against the full
19,195-candidate private memory set with a lexical-only feature profile, zero
privacy leaks, and no committed private response file. Treat it as run-path
evidence only; every remaining arm on the shard still needs its own private
response export before preflight, answer scoring, intake, or combine.
The fuller deterministic shard-control probe is recorded at
`reviews/overnight-20260522/full-shard-control-export-probe-20260526.json`. It
exports `bm25-lite`, `full-hybrid-rerank`, and
`query-expanded-full-hybrid-rerank` on the same 25-query shard, keeps all private
response files outside the repo at mode `0600`, makes zero provider calls, and
uses deterministic query-expansion fallbacks for the expanded arm. This still
does not count as answer-quality evidence, local/provider model evidence, or
SOTA support.
The same shard now has an answer-quality preflight packet at
`reviews/overnight-20260522/full-shard-control-answer-quality-preflight-20260526.json`.
It proves the private query set, answer labels, memories, and the three control
response arms are hash-aligned and cover the same 25-query shard. It deliberately
also verifies the selected-query-id hash for each arm. It deliberately stays
`BLOCKED_ANSWER_QUALITY_ENV` because model-call consent, public-data
consent, no-raw-output consent, and an answer/judge endpoint are not configured.
Treat it as scoring readiness only, not an answer-quality score or SOTA support.
Use `benchmark:answer-quality:shard-workorder` as the public-safe run tracker
for those twenty shards. The checked-in workorder,
`reviews/overnight-20260522/answer-quality-full-shard-workorder-20260525.json`,
is intentionally pending with zero accepted shards. It now mirrors the shard
plan's execution lanes: `deterministic-control-proxy`,
`local-apple-no-spend`, `voyage-minimum-challenger`,
`nvidia-minimum-challenger`, and `full-sota-accepted-shards`. Only
`full-sota-accepted-shards` is compatible with full-shard intake; the others
are diagnostic/comparison lanes. After shard jobs return, the workorder should
show accepted coverage before the stricter intake step is allowed. It also
records no-call environment readiness for each lane; the checked-in accepted
SOTA lane is blocked until live-export consent, no-raw-text consent,
answer-quality consent, local Apple/local rerank endpoints, Voyage/NVIDIA
credentials, answer and judge model configuration, a scoring endpoint, and
query-expansion readiness are all configured.
Query expansion is deliberately lane-scoped: deterministic fallback is allowed
for the control and local diagnostic lanes without becoming SOTA support, while
`full-sota-accepted-shards` still requires local or cloud model-backed query
expansion and exact target answer/judge model matching.
For the local-first full benchmark, use
`benchmark:answer-quality:local-shard-plan`. The checked-in plan,
`reviews/overnight-20260522/answer-quality-local-full-shard-plan-20260526.json`,
uses the same 500-query LongMemEval target and private raw-source-retaining
materialization but accepts the local strategy set only: BM25, full hybrid,
query-expanded full hybrid, Qwen3 local Apple embedding, and local rerank. The
paired workorder,
`reviews/overnight-20260522/answer-quality-local-full-shard-workorder-20260526.json`,
has no Voyage/NVIDIA blockers and is blocked only on the local/run consent,
answer-quality endpoint, and model-backed query-expansion readiness needed to
actually run it. Treat a completed local-full result as model-method evidence;
it can explain a local-vs-cloud gap, but it is not SOTA proof or launch approval.
Its scoring contract is also separate: local answer/judge models may differ
from the target only when the answer-quality endpoint is local, and
`benchmark:memory-score:result-gate --claim-scope full-sota` rejects a
local-full packet instead of promoting it.
The first local-full shard has now run end-to-end with a real local Qwen3
Reranker 0.6B Q8 sidecar:
`reviews/overnight-20260522/answer-quality-local-full-shard-001-20260526.json`.
The result is accepted by
`reviews/overnight-20260522/end-to-end-memory-score-local-full-shard-001-gate-20260526.json`
as `local-full` evidence only. It scored 25 of 500 target queries; the best arm
was `full-hybrid-rerank` at `19.4`, while
`local-apple-qwen3-0_6b-local-rerank` scored `15.8` and BM25 scored `15.2`.
The follow-up intake,
`reviews/overnight-20260522/answer-quality-local-full-shard-intake-after-shard-001-20260526.json`,
accepts shard 001 and keeps the lane blocked on nineteen missing shards. Do not
use this as launch, production, or SOTA support.
The local-full performance report,
`reviews/overnight-20260522/local-full-shard-performance-report-20260526.json`,
turns that accepted-shard trail into a compact metrics-only progress snapshot.
It currently covers one shard, 25 of 500 queries, and 5 percent coverage;
`full-hybrid-rerank` leads the partial local-full snapshot at `19.4` answer
quality, and the local Apple rerank arm is behind the local Apple base on this
slice. The report keeps local-full benchmark evidence, full-memory SOTA
evidence, combine readiness, and public benchmark claims disabled until the
local-full shard intake reaches complete coverage.
`benchmark:sota-doctor` now carries this same performance snapshot inside
`localFullLaneState.performanceReport`, so the top-level SOTA/blocker evidence
shows partial local-full quality and latency without treating it as SOTA proof.
Shard 002 is currently a blocked runtime attempt, not an accepted shard:
`reviews/overnight-20260522/answer-quality-local-full-shard-002-runtime-blocker-20260526.json`.
The BM25, full-hybrid, and local query-expanded arms exported 25 private
responses each, but the local Apple embedding arm failed with a reproducible
local embedding-server socket close. The same failure reproduced on a public
synthetic embedding smoke at the time. The current checked-in runtime preflight,
`reviews/overnight-20260522/local-embedding-runtime-doctor-20260526.json`,
now reports `READY_LOCAL_EMBEDDING_RUNTIME` for a dedicated Qwen3 Embedding
0.6B GGUF local llama.cpp endpoint without exposing endpoint or path details.
The current checked-in durability preflight,
`reviews/overnight-20260522/local-embedding-durability-smoke-20260526.json`,
now reports `READY_LOCAL_EMBEDDING_DURABILITY` on bounded synthetic probes.
These clear only the historical local embedding preflight. The latest launch
refresh at
`reviews/overnight-20260522/local-embedding-launch-diagnostic-20260526.json`
reports `BLOCKED_LOCAL_EMBEDDING_LAUNCH`: two relaunch attempts exited during
model load before endpoint readiness, while preserving only public-safe labels,
counts, phases, and failure classes. Restart the same local endpoint, rerun the
runtime doctor and durability smoke, then rerun shard 002 before treating that
shard as accepted evidence.
For local Apple response-arm export, pass a fresh ready report through
`--local-embedding-durability-report` or
`SELFMEM_LOCAL_EMBED_DURABILITY_REPORT` with
`RECALLWEAVE_REQUIRE_LOCAL_EMBED_DURABILITY=1`.
The regenerated local-full plan and workorder already put the local embedding
endpoint, local rerank endpoint, durability report, and
`--require-local-embedding-durability` into each response-arm export command;
fill those placeholders from the live local sidecars rather than dropping them
for shard retries.
Run `benchmark:answer-quality:local-shard-workorder` and
`benchmark:answer-quality:local-shard-intake` for this lane so the local-full
plan is selected automatically. The checked-in local workorder now consumes the
accepted shard 001 output plus the shard 002 runtime blocker and prints a
missing-arm-only retry for the two local Apple arms. The resume packet at
`reviews/overnight-20260522/local-full-shard-002-resume-packet-20260526.json`
turns that state into an operator handoff: it records current local runtime and
durability readiness, lists only hashes/counts/labels for completed private
arms, points the operator to the private command materializer, keeps the
missing-arm export, preflight, answer-quality, and local-intake templates as
public evidence rather than runnable commands, and keeps local-full evidence,
SOTA evidence, public benchmark
claims, and launch claims disabled until shard 002 returns an accepted public
result. Before running those commands, run
`benchmark:answer-quality:local-shard-resume-env`; the checked-in report at
`reviews/overnight-20260522/local-full-shard-002-resume-env-doctor-20260526.json`
shows this shell is blocked because the outside-repository private directory
and local model/scoring environment are not present. It prints only missing
variable names, labels, hashes, and counts. It now also verifies that the
source-locked full materialization retained the raw dataset, selected raw rows,
and source manifest privately, while keeping compressed/default retrieval and
UI surfaces separate from the private audit source. It also binds the retry to
the local embedding durability report generated after the shard 002
socket-close blocker, including the required long synthetic probe envelope.
The same report distinguishes a shell that has enough inputs to materialize the
commands from the resume packet templates themselves: `readyForCommandMaterialization`
can become true, but `resumePacketCommandsRunnableAsPrinted` stays false until
the operator replaces placeholders outside the public report.
Use `benchmark:answer-quality:local-shard-resume-env -- --fixture` to exercise
the green path without private data or hosted calls. That fixture creates only
temporary synthetic private files outside the repository, proves the hashes and
env gates can pass, and remains non-countable evidence with all public claim
flags disabled.
Use `benchmark:answer-quality:local-shard-resume-command` only after the resume
env doctor says the required placeholders are materializable. It writes the
filled command sequence to an outside-repository private shell script selected
with `--private-command-output` or
`RECALLWEAVE_LOCAL_FULL_RESUME_PRIVATE_COMMAND_OUTPUT`; the public report keeps
only command IDs, counts, hashes, and blocker names. The resume packet now
includes this materializer command so the intended retry flow is env doctor,
private script materialization, then private script execution.
After the private script returns, run
`benchmark:answer-quality:local-shard-resume-result`. The checked-in result
doctor at
`reviews/overnight-20260522/local-full-shard-002-resume-result-doctor-20260526.json`
is blocked because the private script has not run and the shard 002 public
answer-quality result is missing. A passing result doctor validates that the
returned public shard-002 JSON matches the local-full plan, keeps command text
and private paths out of public evidence, and prints the local shard-intake
command for shard 001 plus shard 002. It does not authorize combine, SOTA, or
launch claims.
The checked-in local intake report,
`reviews/overnight-20260522/answer-quality-local-full-shard-intake-20260526.json`,
is intentionally blocked with zero accepted shards and twenty missing shards.
It should turn green only after all twenty local-full public shard-result JSONs
are present and hash-aligned.
Then run `benchmark:answer-quality:local-accepted-lane-doctor`. The checked-in
doctor,
`reviews/overnight-20260522/local-full-accepted-lane-launch-doctor-20260526.json`,
is the concrete next-missing-shard go/no-go for that local lane. It reads the
checked-in progress intake, treats shard 001 as already accepted, and prints
shard 002 retry commands with `--query-offset 25`. It prints no raw benchmark
text or credentials, keeps the private raw-source lineage private, and does not
add Voyage/NVIDIA or public-SOTA blockers to the local-only run path.
Before combining returned full-shard outputs, run
`benchmark:answer-quality:shard-intake` against the public shard-result JSONs.
The checked-in intake report,
`reviews/overnight-20260522/answer-quality-full-shard-intake-20260525.json`,
is intentionally blocked with zero accepted shards and twenty missing shards.
It should turn green only after the full shard set is present, non-overlapping,
source/model/hash/range-matched, strategy-matched, and public-safe. Passing
intake is combine readiness only, not SOTA proof.
This is real benchmark progress, not SOTA proof:
`reviews/overnight-20260522/end-to-end-memory-score-gate-20260525.json` remains
blocked by the missing same-data Voyage answer-quality arm recorded in
`reviews/overnight-20260522/voyage-provider-rate-limit-20260525.json`. To turn
a retrieval, local, or provider canary into end-to-end memory evidence eligible
for claims, export the response arms, run the preflight and harness against
private materialized LongMemEval inputs, then require:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --execute \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json \
  --queryset <private-queryset.json> \
  --memories <private-memories.jsonl> \
  --private-output-dir <private-response-arm-dir>
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready \
  --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json \
  --queryset <private-queryset.json> \
  --memories <private-memories.jsonl> \
  --answer-labels <private-answer-labels.json> \
  --arm bm25-lite=<private-bm25-responses.json> \
  --arm full-hybrid-rerank=<private-hybrid-responses.json> \
  --arm <provider-or-local-arm>=<private-challenger-responses.json>
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:reviewer-intake -- --strict-target \
  --result <public-answer-quality-output.json> \
  --review <reviewer-a-memory-score-approval.json> \
  --review <reviewer-b-memory-score-approval.json> \
  --output <memory-score-reviewer-intake.json>
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --require-ready \
  --result <public-answer-quality-output.json> \
  --reviewer-approval-report <memory-score-reviewer-intake.json>
```

Do not use MemoryBench, LongMemEval, or SOTA wording until that result gate,
reviewer audit, UI evidence, docs, and owner approval all pass.

For DeepSeek, NVIDIA, OpenRouter, Z.ai, or another OpenAI-compatible reviewer,
generate a memory-score approval artifact with the env-only reviewer route:

```bash
RECALLWEAVE_REVIEW_OPENAI_PROVIDER=deepseek-pro \
RECALLWEAVE_REVIEW_OPENAI_MODEL=deepseek-v4-pro \
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:reviewer:openai-compatible -- \
  --result reviews/overnight-20260522/end-to-end-memory-score-combined-20260525.json \
  --reviewer-id deepseek-memory-score-a \
  --output <reviewer-a-memory-score-approval.json>
```

The reviewer prompt contains only metrics, hashes, safety counters, gate
blockers, and strategy names. It must not include provider keys, raw benchmark
questions, raw answers, raw memories, transcripts, or private paths.

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

The matching expanded autoresearch sweep is
`reviews/overnight-20260522/public-longmemeval-expanded-autoresearch-loop.json`.
It compares 48 local-only arms on that same 30-question target. The winner is
`bm25-lite-b800-k5`: quality 0.2506, P@1 0.4667, recall@5 0.1583, NDCG@10
0.2193, p50 latency 74 ms, and zero privacy failures. That keeps BM25 as the
local default/fallback for now. It does not prove BM25 is the final product
method; it proves the current deterministic proxy hybrid has not earned
promotion.

The provider-backed gate starts as a fixture-only CI path:
`reviews/overnight-20260522/public-longmemeval-provider-gate-fixture.json`.
It checks the exact public-safe comparison shape for `bm25-lite`,
`full-hybrid-rerank`, `cloud-voyage-rerank-only`, `cloud-voyage4-voyage`,
`cloud-voyage4-voyage-lite-rerank`, `cloud-voyage4-lite-voyage-lite`,
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

For a paste-ready operator handoff, generate the provider packet:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:packet -- --provider voyage --format markdown
```

The checked-in Voyage packet is
`reviews/overnight-20260522/public-longmemeval-expanded-provider-operator-packet.md`.
It is public-safe and metrics-only. It does not call a provider, does not print
keys, keeps the output directory and provider key file outside the repo, and
requires `bm25-lite`, `full-hybrid-rerank`, and `cloud-voyage4-voyage` in the
same run.

The checked-in local Apple packet is
`reviews/overnight-20260522/public-longmemeval-expanded-local-apple-operator-packet.md`.
It is also public-safe and metrics-only. Its paired preflight,
`reviews/overnight-20260522/public-longmemeval-expanded-local-apple-live-preflight.json`,
currently reports `BLOCKED_PROVIDER_ENV` because no local embedding endpoint is
configured through `SELFMEM_LOCAL_EMBED_BASE_URL`. The local Apple arm is
scaffolded and fixture-covered for retrieval-proxy runs in a clean controller
environment. Separately, the local-full answer-quality shard has now live-tested
Qwen3 local embeddings plus a real Qwen3 Reranker 0.6B Q8 sidecar. That shard
is local diagnostic evidence only and did not promote the sidecar arm.
The shard 002 retry surfaced an embedding-server durability blocker before the
local Apple arm could complete. The runtime doctor and durability smoke pass as
preflight evidence, but the current launch diagnostic still blocks resume
because the endpoint exits during model load. Do not treat the partial three-arm
shard 002 packet as answer-quality evidence until that shard is rerun, scored,
and accepted by intake.
Shard 003 then completed the base local Apple embedding arm and blocked on the
reranker sidecar response body. The corrected llama.cpp reranker launch needs
`--embedding --pooling rank --rerank`; a `--rerank`-only launch can return
HTTP 200 with `null` scores. The public-safe local rerank durability smoke now
passes against a corrected sidecar, but shard-003 still needs missing-arm
export, preflight, scoring, and intake before it becomes benchmark evidence.

The first live Voyage provider canaries have now run:

- 6-query target:
  `reviews/overnight-20260522/public-longmemeval-voyage-live-provider-6q.json`
- 30-query expanded target:
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-live-provider.json`
- 30-query latency-sensitive target:
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider.json`
- Summary:
  `reviews/overnight-20260522/public-longmemeval-voyage-live-provider-evidence.md`
  and
  `reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider-evidence.md`

Both used the same-data provider gate with `bm25-lite`,
`full-hybrid-rerank`, and live `cloud-voyage4-voyage`. Voyage beat BM25 on
retrieval-proxy quality on both slices, but p50 latency was much higher:
1874 ms versus 16 ms on the 6-query slice and 1641 ms versus 82 ms on the
30-query slice. Treat this as a provider-backed canary trend, not a public
SOTA claim. The reports keep `memoryBenchAnswerQuality: false` and
`publicBenchmarkClaimsAllowed: false`.

The latency-sensitive 30-query run added `cloud-voyage4-voyage-lite-rerank`
and `cloud-voyage4-lite-voyage-lite` to the same BM25 and full-hybrid controls.
`cloud-voyage4-lite-voyage-lite` reached quality 0.3040, P@1 0.5667,
recall@5 0.1917, NDCG@10 0.2658, p50 latency 1988 ms, and zero privacy
failures. It preserved the same measured quality as `cloud-voyage4-voyage`
while cutting p50 latency from 6659 ms to 1988 ms. Use it as the next cloud
canary default, not as a final MemoryBench or SOTA claim.

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
for local operator-only review. Unknown and unreadable packets also get
hash-only reason triage so reviewers can act without seeing private filenames:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root <folder-of-agent-zips> --output /tmp/recallweave-returned-canary-inbox.json
```

For repeated supervision, use the watcher. It keeps candidate filenames
hash-redacted, carries the same safe triage forward, and exits successfully
while waiting unless `--require-found` is set:

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
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads:strict -- --output /tmp/recallweave-returned-downloads.json
```

For overnight supervision on the maintainer machine, use the 12-hour standard
inbox watcher. It checks Downloads and Telegram Desktop every 15 minutes,
requires production-grade evidence, and exits nonzero if no returned production
packet appears:

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads:watch12h -- --output /tmp/recallweave-returned-downloads-watch.json --findings-output reviews/overnight-20260522/next-agent-workspace/returned-downloads-watch-findings.md
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
