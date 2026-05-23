# Autoresearch Benchmark Plan

This plan is the next implementation gate after the current public-alpha
source-lock work. It does not claim RecallWeave is better than hosted memory
systems. It defines how RecallWeave is allowed to prove or disprove that claim.

## Rule For Public Scores

Use a matched source-locked canary before any public score.

Do not publish a GitHub benchmark score unless RecallWeave beats the matched
baseline on a source-locked canary.

A publishable canary must use:

- the same dataset slice,
- the same memory set,
- the same queries,
- relevance-labeled queries, where every query includes at least one
  `expectedResultIds` or `expectedResultHashes` entry,
- a private hosted mirror or source-matched local RecallWeave source when the
  query labels were authored from hosted history,
- a source-match preflight proving the local RecallWeave source can collect at
  least one expected reference for every reviewed query,
- a source-alignment gate proving the hosted label and local container map point
  at the same source before hosted calls are spent,
- a source-gap plan proving the source reports either allow a matched baseline
  run or name the exact repair path,
- the same judge and answer model,
- the same scoring code,
- the same privacy rules,
- cost and latency accounting,
- zero redaction failures,
- two independent reviewer approvals.

If RecallWeave does not win, write a private gap report and keep iterating. Do
not market the score.

Run the hosted baseline preflight before any live comparison:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:preflight
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template
npm exec --yes pnpm@10.23.0 -- baseline:discover
npm exec --yes pnpm@10.23.0 -- baseline:select-container
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset
npm exec --yes pnpm@10.23.0 -- baseline:queryset
npm exec --yes pnpm@10.23.0 -- baseline:mirror-hosted
npm exec --yes pnpm@10.23.0 -- baseline:source-match
npm exec --yes pnpm@10.23.0 -- baseline:source-align
npm exec --yes pnpm@10.23.0 -- baseline:source-gap
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:next-run
```

The preflight is offline by default. It must report `callsHostedProvider:
false`, `metricsOnly: true`, and `benchmarkClaimsAllowed: false` unless a
fresh sanitized hosted-baseline result is supplied with `--result`. A live run
needs explicit environment opt-in, `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`, and a
metrics-only output file. The output may include run ids, source commits, model
ids, aggregate scores, cost, latency, and hashes. It must not include raw
memories, raw transcripts, private prompts, private answers, credentials,
cookies, or bearer tokens.

Before collection, `baseline:discover -- --live` may be used as a safe metadata
step when the source container is unknown. A public discovery report may show
hashed candidate ids and counts only. It does not count as a hosted baseline
and does not support benchmark language. If a raw hosted label is needed, use
the private-map discovery flow outside the repository, then run
`baseline:select-container` to write the selected label into a 0600 private env
file without printing it. The private map and env file are local operator
material only.

If a new query set is needed, run `baseline:author-queryset` after container
selection. It may draft a private, review-required query set from the selected
hosted container, but the draft itself is not benchmark evidence. It must be
reviewed locally, then checked with `baseline:queryset --strict`, before hosted
or RecallWeave collection starts. Attach only the public author report and the
strict query-set inspection report.
If the canary uses hosted history as its source, run `baseline:mirror-hosted`
next. It reads hosted Supermemory in read-only mode, writes a redacted local
RecallWeave-compatible mirror outside the repository, and emits a public-safe
metrics report. The mirror's `memories.jsonl` and `container-map.json` are
private local inputs, not reviewer attachments.

The fixture path proves that the result shape is parseable. It must never count
as hosted baseline evidence, even if all metrics fields are present. Use
`--print-template` before live collection so the agent writes only aggregate
fields and source-lock hashes.

Use `baseline:queryset -- --queryset <path> --strict --output <report>` on the
frozen query file before either collector runs. The report must be metrics-only
and public-safe: hashes, counts, readiness flags, and no raw query text or
expected-result identifiers.

Then run `baseline:source-match -- --live --queryset <path> --container-dir
<hosted-mirror-or-source-matched-container> --preserve-ids --strict --output
<report>` before hosted collection when using the private hosted mirror. Omit
`--preserve-ids` only when the local source intentionally emits hashed ids and
the query set uses content hashes. This report must also be metrics-only and
public-safe. It blocks the run if the local RecallWeave source cannot satisfy
the reviewed labels, which prevents another source-mismatched 0-0 comparison.

Then run `baseline:source-align -- --source-match <report> --local-map
<local-container-map.json> --private-map <private-hosted-map.jsonl> --strict
--output <alignment-report>`. This report must stay metrics-only and
public-safe. It blocks the run if a label match is not enough to prove matching
content. Keep the private hosted map local and attach only the alignment report.

Then run `baseline:source-gap -- --source-match <report> --source-alignment
<alignment-report> --output <gap-report>`. The report is also public-safe. It
must say `READY_FOR_MATCHED_BASELINE` before a hosted collection run can be
treated as source-matched. If it reports a blocked state, follow its repair path
instead of spending more hosted calls.

After both result files exist, run the matched comparison gate:

Use the exporter's `--output` flag for the RecallWeave response file. Do not
redirect the package-manager command's stdout into the JSON file, because
wrapper banners can corrupt the evidence file before the collector reads it.

```bash
RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
npm exec --yes pnpm@10.23.0 -- baseline:export:recallweave \
  -- --live --container-dir <hosted-mirror-or-source-matched-container> \
  --preserve-ids \
  --output /tmp/recallweave-search-responses.json

RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_NO_RAW_TEXT=1 \
npm exec --yes pnpm@10.23.0 -- baseline:collect:recallweave \
  -- --live --responses /tmp/recallweave-search-responses.json \
  --output /tmp/recallweave-result.json

npm exec --yes pnpm@10.23.0 -- baseline:compare \
  -- --hosted /tmp/recallweave-hosted-baseline-result.json \
  --recallweave /tmp/recallweave-result.json
```

The comparison gate is also metrics-only. It must report the same dataset
slice, query-set hash, scoring-code hash, judge model, answer model, and
harness flags before it can count as comparison evidence. `--fixture` always
blocks public claims, even if the loaded files look real.

The hosted and RecallWeave collectors reject unlabeled query sets before they
produce aggregate metrics. A live run with natural questions but no expected
ids or content hashes is useful for debugging search shape only; it is not
benchmark evidence and must not feed public comparison language.

`baseline:export:recallweave` creates the local search-response export from a
local `memories.jsonl` container. It emits ids or hashed ids, content hashes,
scores, timings, token estimates, privacy counters, and no raw memory text. The
RecallWeave collector accepts that export and rejects raw response text by
default so a local run cannot quietly become a raw memory attachment.

`baseline:next-run` is the state-aware planner for this lane. Use it when an
agent has partial evidence and needs the next safe step. It inspects hosted,
RecallWeave, preflight, and comparison state when available, then prints the
exact source-locked run sequence. It never calls a hosted provider, never
authorizes public claims, and keeps fixtures useful only for parser validation.
It prints `baseline:source-match --strict` as a required step before the
hosted/local run chain when a reviewed query set is present, then prints
`baseline:source-gap` so operators can tell whether the source gate is ready or
still blocked.
Use `baseline:next-run -- --require-ready` after the hosted, RecallWeave,
preflight, and comparison files are available. It must fail for fixtures,
partial evidence, privacy failures, harness mismatches, missing reviewer
approval, or a RecallWeave loss. A passing result means the evidence is ready
for owner review, not public launch.

Allowed public wording after a win:

> On this source-locked canary, RecallWeave beat the matched baseline with the
> same judge, answer model, queries, and scoring code. This is not a full
> benchmark proof, but it suggests the method may surpass available cloud memory
> systems on this workload and justifies a full benchmark.

## Controlled Matrix

Run one method at a time unless independent workers run isolated arms with the
same frozen harness.

| Arm | Purpose |
|---|---|
| `cloud-voyage4-voyage` | First cloud quality proof. |
| `cloud-gemini2-cohere4pro` | Multimodal and dimension challenger. |
| `cloud-nvidia-retriever-500m` | Hosted latency challenger. |
| `cloud-nvidia-nemotron-1b` | Current NVIDIA text retrieval challenger. |
| `cloud-nvidia-nemotron-vl-1b` | Multimodal NVIDIA retrieval challenger. |
| `cloud-nvidia-e5-mistral` | Hosted QA retrieval challenger. |
| `local-apple-qwen3-0_6b` | Default local Apple Silicon proof. |
| `local-apple-qwen3-4b` | Optional local quality challenger. |

The local lane matters because many users will not want hosted embedding and
rerank bills. The first local target is 24GB Apple Silicon, not a large GPU
server.

Local runs must start from a clean runtime state. The harness should detect
stale local model servers, record which ports and process ids are active, and
stop only RecallWeave-owned stale processes before measuring. If ownership is
unclear, block the run instead of killing unrelated user work.

Use Hugging Face or source-locked Apple Silicon artifacts for local models.
Avoid quantization heroics in the default lane. Qwen, Gemma, local Nemotron
variants, MLX, llama.cpp, Ollama, or other Apple-friendly routes may enter the
matrix, but each variant needs its own label, source, latency, memory, and
quality result.

## Research Loop

1. Source-lock current provider docs, model cards, benchmark papers, and
   project references.
2. Freeze a canary benchmark slice from MemoryBench, LongMemEval, LoCoMo,
   ConvoMem, or a documented real benchmark subset.
3. Run the matched baseline and one RecallWeave arm.
4. Record accuracy, P@1, recall@5, recall@10, NDCG@10 where available, p50 and
   p95 latency, context tokens, ingest cost, query cost, and failures.
5. Pick the largest quality gap. If quality is tied, pick the largest latency
   or cost gap.
6. Propose exactly one methodology change.
7. Require two independent reviewers to approve the setup before coding.
8. Implement only the approved change.
9. Rerun the affected canary first.
10. Keep the change only if quality improves without a serious regression, or
    quality holds while latency or cost improves materially.

Reviewer packets must include commands, dataset slice, run id, source commit,
provider arm, model ids, judge, answer model, latency/cost summary, and a
privacy scan result.

Backend confidence comes first. Do not spend the UI pass polishing a methodology
that has not passed the setup gate, privacy gate, and at least one controlled
canary run. Once the backend evidence is credible, the Brain UI should show the
same source lineage, topic graph, provider arm, trace, and reviewer decision so
users can understand why the system chose a memory path.

## Reviewers

Preferred reviewer route:

- Implementer: Codex GPT-5.5 high or the active Codex goal.
- Reviewer A: Claude Opus 4.7 through Claude CLI. This approval is required
  before autoresearch changes become implementation work.
- Reviewer B: Codex GPT-5.5 in a separate cold review context. Gemini CLI may
  add coverage, but it does not replace the Opus plus 5.5 setup gate unless
  the owner explicitly accepts the substitution.

If a reviewer route is unavailable, write a blocked-review file. Do not count
that route as approval.

## Query Expansion Gate

Query expansion is off by default. It can enter the matrix only as a single
methodology change.

The query expansion canary must check:

- exact identifiers,
- temporal facts,
- contradicted facts,
- short natural queries,
- noisy user phrasing,
- private-tag redaction,
- p50 and p95 added latency.

The expansion provider may be NVIDIA, Gemini, OpenRouter, or a small local
OpenAI-compatible model. The provider receives only the current query. It never
receives stored memories, raw transcripts, private text, or credentials.

The expansion arm must stay within free-tier or approved budget limits where
possible. If a provider rate limit appears, the run should pause or narrow the
slice instead of quietly changing models or mixing providers inside one arm.

## Pruning Gate

Pruning is a review queue, not automatic deletion.

RecallWeave may surface:

- duplicate candidates,
- stale open bugs,
- resolved tasks,
- contradicted facts,
- low-salience noise,
- memories that never retrieve,
- memories that retrieve but never help answers.

The default action is "review." A user or maintainer approves suppress, merge,
or delete. Backups are recommended before destructive actions. A risky
`--yolo` mode may exist later, but it must be disabled by default and clearly
marked as unsafe for normal users.

## UI Gate

After backend canary evidence is clean, run the Brain UI pass:

- dashboard health,
- topic clusters,
- graph paths,
- editable documents,
- source lineage,
- benchmark evidence,
- provider status,
- lifecycle frequency,
- pruning review queue.

Visual reviewers should inspect screenshots or screen recordings using fixture
data. Public UI evidence must not contain real agent memory, private paths,
keys, or raw diagnostics.
