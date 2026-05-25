# Benchmark Summary

This repository includes metrics-only benchmark notes. It does not include agent memory text, private containers, raw logs, raw diagnostics, or provider credentials.

## Current Claim Boundary

RecallWeave is promising and operationally useful as a quota-safe local write lane. It is not proven generally superior to Supermemory. Earlier internal smoke numbers are useful engineering evidence, but the release branch removed benchmark-specific context shortcuts. A 2026-05-23 source-matched, budgeted live canary beat the selected hosted baseline on this small private slice, and two independent reviewers approved the metrics-only packet for owner review. That supports a narrow canary comparison only. Broad superiority language still needs a fuller benchmark and owner approval.

Solo RecallWeave runs are smoke tests only. They can prove the harness runs,
privacy holds, latency is measurable, and the adapter does not fall over. They
do not prove memory quality. Quality evidence must compare RecallWeave against
same-data controls and external targets: a lexical floor such as BM25-lite, the
current full RecallWeave hybrid arm, provider-backed hybrid arms when explicit
env-only provider consent is present, and source-locked public target rows or
hosted Supermemory parity runs where those are available. BM25-lite is not the
system RecallWeave is trying to be. It is the floor. If BM25-lite wins, the
benchmark found a gap in hybrid weighting, embeddings, reranking, chunking,
query expansion, graph use, or temporal handling.

The current branch includes a hosted baseline preflight:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:preflight
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:preflight -- --print-template
npm exec --yes pnpm@10.23.0 -- baseline:discover
npm exec --yes pnpm@10.23.0 -- baseline:select-container
npm exec --yes pnpm@10.23.0 -- baseline:author-queryset
npm exec --yes pnpm@10.23.0 -- baseline:queryset
npm exec --yes pnpm@10.23.0 -- baseline:source-match
npm exec --yes pnpm@10.23.0 -- baseline:source-align
npm exec --yes pnpm@10.23.0 -- baseline:source-gap
npm exec --yes pnpm@10.23.0 -- baseline:collect -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:compare -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:next-run
npm exec --yes pnpm@10.23.0 -- baseline:run -- --fixture
npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake
```

The public benchmark lane now also includes a source-locked LongMemEval-S
materialization path:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
npm exec --yes pnpm@10.23.0 -- benchmark:public-hybrid -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
npm exec --yes pnpm@10.23.0 -- benchmark:public-autoresearch -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
```

That command uses the same public LongMemEval-S dataset hash as the checked-in
run-only target, writes the raw query set and haystack sessions only to a
private local directory, and emits public-safe hashes and counts. The canonical
retrieval-proxy RecallWeave run now uses the autoresearch winner,
`bm25-lite-b800-k5`, and scored 0.4541 quality, P@1 0.8333, recall@5 0.2917,
recall@10 0.2917, NDCG@10 0.3996, p50 latency 73 ms, p95 latency 78 ms,
average context tokens 800, zero cost, and zero redaction failures. This is a
blind autoresearch baseline, not a MemoryBench quality win.

The same source-locked slice also has a public-safe retrieval strategy
comparison. The initial `jaccard` baseline scored 0.1089 quality and P@1
0.1667. `bm25-lite` won with quality 0.4541 and P@1 0.8333. `hybrid-v1` tied
quality but was slower. This supports the next autoresearch step, but it is
still not MemoryBench answer-quality evidence or a public benchmark superiority
claim.

The current local-only autoresearch loop runs 72 same-data retrieval-proxy arms
across lexical, dense-proxy, temporal, graph-proxy, rerank-proxy, and
query-expansion-proxy strategies, context budget, and candidate limit. The
winner remains
`bm25-lite-b800-k5`: quality 0.4541, P@1 0.8333, recall@5 0.2917, NDCG@10
0.3996, average context tokens 800, p50 latency 16 ms, and zero privacy
failures. It keeps the same quality as the 1600-token `bm25-lite` run while
cutting average context tokens in half. The checked-in retrieval-proxy run has
now been regenerated with this setting. This is still not MemoryBench
answer-quality evidence.

BM25-lite is the control floor, not the final agent-memory design. A BM25 win is
a useful negative result: the richer retrieval stack has not earned promotion
on that slice. The autoresearch loop now includes the local hybrid-family proxy
arms, but those arms still use deterministic dense/rerank/query-expansion
proxies rather than learned embeddings or hosted rerankers. The next benchmark
gate must compare BM25-lite against the actual RecallWeave hybrid stack,
provider-backed Voyage, Gemini, NVIDIA, and Apple Silicon arms on the same
source-locked data before any agent default changes or external-system claims.

The follow-up hybrid gate now exists and is intentionally conservative. It
compares `bm25-lite` against local-only hybrid-family proxy arms on the same
LongMemEval-S canary slice: `dense-proxy`, `sparse-dense-rrf`,
`sparse-dense-temporal`, `sparse-dense-graph-temporal`,
`full-hybrid-rerank`, and `query-expanded-full-hybrid-rerank`. These proxy
arms prove benchmark wiring and ranking behavior without hosted provider
calls. They do not replace later Voyage, Gemini, NVIDIA, or Apple Silicon local
model arms. On the current 6-query slice, `bm25-lite` remains the winner:
quality 0.4541, P@1 0.8333, recall@5 0.2917, NDCG@10 0.3996, p50 latency
16 ms. The best full-hybrid proxy tied quality but was slower at 33 ms p50, so
the gate correctly refused hybrid promotion.

The same local-only hybrid gate now also has a larger 30-query LongMemEval-S
stress slice:
`reviews/overnight-20260522/public-longmemeval-expanded-hybrid-gate.json`.
That slice covers 30 source-locked public questions, 92 expected references,
and 1,420 haystack sessions. `bm25-lite` again remains the control winner:
quality 0.2506, P@1 0.4667, recall@5 0.1583, recall@10 0.1583, NDCG@10
0.2193, p50 latency 180 ms, and zero privacy failures. The best local proxy
hybrid, `full-hybrid-rerank`, reached quality 0.2289 and P@1 0.4333 but had
p50 latency 417 ms. This weakens the BM25-overfit worry, but it also proves the
current proxy hybrid should not become the default yet.

The expanded autoresearch sweep now uses the same 30-query target:
`reviews/overnight-20260522/public-longmemeval-expanded-autoresearch-loop.json`.
It ran 48 local-only arms across `bm25-lite`, sparse+dense, temporal, graph,
full-hybrid rerank, and query-expanded full-hybrid rerank, with 800, 1200,
1600, and 2400 token budgets and limits of 5 and 10. `bm25-lite-b800-k5`
won: quality 0.2506, P@1 0.4667, recall@5 0.1583, NDCG@10 0.2193, p50
latency 74 ms, and zero privacy failures. The best full-hybrid arm reached
quality 0.2351. So the current recommendation is clear: keep BM25 as the
local default/fallback, and use the provider benchmark lane to test whether
real embeddings and rerankers beat it.

The provider-backed benchmark lane now has an opt-in harness. The fixture gate
is `reviews/overnight-20260522/public-longmemeval-provider-gate-fixture.json`.
It compares `bm25-lite`, `full-hybrid-rerank`, `cloud-voyage-rerank-only`,
`cloud-voyage4-voyage`, `cloud-voyage4-voyage-lite-rerank`,
`cloud-voyage4-lite-voyage-lite`, `cloud-gemini-embed-rerank-proxy`, and
`cloud-gemini-voyage-rerank`, plus NVIDIA and local Apple Silicon arms:
`cloud-nvidia-retriever-500m`, `cloud-nvidia-nemotron-1b`,
`cloud-nvidia-e5-mistral`, and `local-apple-qwen3-0_6b`. Fixture mode uses
deterministic provider mocks and makes zero hosted calls. A real run must set
both `RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1` and
`RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1`, plus env-only readiness for the
selected provider arm, before public benchmark passages can be sent to hosted
providers or a local model server. This is the next route for testing whether
the actual provider-backed hybrid stack beats BM25-lite on the same
source-locked data.

The first live Voyage provider canaries are now checked in as metrics-only
evidence:

- `reviews/overnight-20260522/public-longmemeval-voyage-live-provider-6q.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-voyage-live-provider.json`
- `reviews/overnight-20260522/public-longmemeval-voyage-live-provider-evidence.md`

Both runs compared `bm25-lite`, `full-hybrid-rerank`, and
`cloud-voyage4-voyage` on the same source-locked public LongMemEval-S data. On
the 6-query slice, live Voyage reached quality 0.5630 versus BM25 0.4541, with
P@1 1.0000 versus 0.8333 and p50 latency 1874 ms versus 16 ms. On the 30-query
expanded slice, live Voyage reached quality 0.2822 versus BM25 0.2506, with
P@1 0.5333 versus 0.4667 and p50 latency 1641 ms versus 82 ms. Both runs had
zero privacy and redaction failures.

The latency-sensitive live Voyage canary is now also checked in:

- `reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider-preflight.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-voyage-latency-live-provider-evidence.md`

This run compared five same-data arms on the 30-query public LongMemEval-S
target: `bm25-lite`, `full-hybrid-rerank`, `cloud-voyage4-voyage`,
`cloud-voyage4-voyage-lite-rerank`, and `cloud-voyage4-lite-voyage-lite`.
The best provider-backed arm was `cloud-voyage4-lite-voyage-lite`: quality
0.3040, P@1 0.5667, recall@5 0.1917, NDCG@10 0.2658, p50 latency 1988 ms,
and zero privacy failures. It beat BM25 by 0.0534 quality points and preserved
the same measured quality as the larger `voyage-4-large` plus `rerank-2.5`
arm while cutting p50 latency from 6659 ms to 1988 ms.

The harness now batches Voyage document embeddings by count and estimated
tokens. That prevents oversized provider requests and makes latency an honest
part of the comparison instead of a hidden failure mode.

This is the first provider-backed canary trend in the right direction, but it
is still retrieval-proxy evidence, not MemoryBench answer-quality evidence.
Public benchmark claims remain blocked. The next optimization step is to test
Gemini embeddings plus Voyage rerank, NVIDIA Nemotron retrieval/rerank, the
Apple Silicon local arm, and query-expansion variants against the same
30-query target.

The answer-quality harness is now present as the conversion step from
retrieval-proxy evidence to end-to-end memory evidence:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --fixture
```

The checked-in fixture smoke is
`reviews/overnight-20260522/answer-quality-harness-smoke-20260525.json`. It
proves public-safe metrics output, strategy scoring shape, and fail-closed
claim flags with zero provider calls. It does not prove a MemoryBench or
LongMemEval answer-quality win. A live run must use the private materialized
query set, memories, answer labels, and per-strategy response exports for the
same source-locked target, then pass:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --require-ready \
  --result <public-answer-quality-output.json>
```

The Apple Silicon local arm now has an explicit metrics-only preflight:

- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-live-preflight.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-live-preflight-evidence.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-operator-packet.md`

That preflight is blocked because no local embedding endpoint is configured via
`SELFMEM_LOCAL_EMBED_BASE_URL`. This means the local arm is scaffolded and
fixture-covered, but not live-tested. The current implemented local arm is
Qwen3 local embeddings plus RecallWeave's deterministic rerank proxy; a live
Qwen3 reranker sidecar remains a future challenger.

A first live Apple Silicon run is now recorded on the smaller 6-query
LongMemEval-S slice:

- `reviews/overnight-20260522/public-longmemeval-local-apple-live-provider-6q.json`
- `reviews/overnight-20260522/public-longmemeval-local-apple-live-provider-6q.md`

It used llama.cpp on Apple Metal with Qwen3 Embedding 0.6B GGUF, a 30-candidate
local dense preselect, bounded head/tail embedding views for long sessions, and
content-hash document embedding reuse inside the run. The local arm tied
`bm25-lite` and `full-hybrid-rerank` on retrieval-proxy quality: quality
0.4541, P@1 0.8333, recall@5 0.2917, and NDCG@10 0.3996, with zero privacy or
redaction failures. It did not earn promotion because p50 latency was 17,026 ms
versus 16 ms for BM25 and 32 ms for the deterministic full-hybrid control. The
expanded 30-query local pass also exposed the right production requirement:
local embeddings must be persisted in a reusable vector index before large
local benchmarks or agent defaults are meaningful.

The benchmark harness now has a privacy-safe persistent document-embedding
cache for the local Apple lane. It stores only cache hashes, model/settings
metadata, vector dimensions, and vectors outside the repository; it does not
store raw memory text, local paths, credentials, or transcripts. The cache smoke
in `reviews/overnight-20260522/local-apple-persistent-cache-smoke.md` used a
fake OpenAI-compatible local embedding server: the first run wrote 5 document
cache entries, and the second run loaded all 5 with zero document misses. That
does not improve model quality by itself, but it makes larger local benchmarks
and slightly larger Apple Silicon embedding models realistic instead of
re-embedding the same public documents every run.

The default Apple Silicon lane remains Qwen3 Embedding 0.6B for consumer
hardware. Operators may test a larger local model by serving it through the
same OpenAI-compatible embedding endpoint and setting
`SELFMEM_LOCAL_EMBED_MODEL`, `SELFMEM_LOCAL_EMBED_DIMENSIONS`,
`SELFMEM_LOCAL_EMBED_BASE_URL`, and optionally
`SELFMEM_LOCAL_EMBED_CACHE_PATH`. Public score claims still require a matched
canary report and reviewer approval; model-size experiments are evidence, not
marketing claims.

The scaled local benchmark lane is now explicit as `local-apple-qwen3-4b`.
It is intended for the user's 24GB-class Apple Silicon hardware as the first
larger local challenger after the 0.6B baseline. It should start with the
Qwen3 Embedding 4B `Q4_K_M` GGUF quantization, 2560 configured dimensions,
the same 900-token local embedding view that stabilized the 0.6B run, and the
same BM25 plus full-hybrid controls. It should not be presented as a default
or public quality win unless the measured run beats the strongest control.

That scaled lane now has a live 30-query result:

- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-preflight.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-provider-900tok-cold.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-provider-900tok-cold.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-provider-900tok-warm.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-provider-900tok-warm.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-4b-live-evidence.md`

The 4B arm tied BM25 quality on the warm-cache run: quality 0.2506, P@1
0.4667, recall@5 0.1583, NDCG@10 0.2193. Warm latency was 290 ms p50 and
363 ms p95, versus BM25 at 97 ms p50 and 106 ms p95, and versus the 0.6B warm
local arm's earlier 133 ms p50 and 200 ms p95. Cold cache fill was much slower
at 31.3 s p50 and 53.9 s p95. This means scaling from 0.6B to 4B did not
improve this retrieval target; the next local gain should come from reranking,
query expansion, candidate selection, or chunking rather than raw embedding
model size.

The next local method challenger is now explicit:
`local-apple-qwen3-0_6b-local-rerank`. It keeps the measured 0.6B Apple
Silicon embedding lane and adds an env-only local reranker sidecar after
sparse+dense+graph+temporal fusion. This arm is not a default and has no live
quality result yet. It exists so the next local run can test reranking as one
methodology change without confusing it with the failed 4B embedder scale-up.

A source-locked 30-query local Apple run is now recorded:

- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-cached-live-preflight.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-cached-live-provider-900tok-8192ctx.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-cached-live-provider-900tok-8192ctx.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-cached-live-provider-900tok-warm.json`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-cached-live-provider-900tok-warm.md`
- `reviews/overnight-20260522/public-longmemeval-expanded-local-apple-cached-live-evidence.md`

The stable local setup used a 900-token head/tail embedding view, single-slot
llama.cpp on Apple Metal, Qwen3 Embedding 0.6B Q8 GGUF, and a persistent
document embedding cache. Attempts with the default 3000-token local embedding
view crashed the local llama.cpp server during embedding, so they are recorded
as local runtime blockers, not quality results.

On the warm-cache run, `local-apple-qwen3-0_6b` tied BM25 on retrieval-proxy
quality: quality 0.2506, P@1 0.4667, recall@5 0.1583, NDCG@10 0.2193. Latency
was 133 ms p50 and 200 ms p95, versus BM25 at 90 ms p50 and 105 ms p95. The
warm run loaded 573 document cache entries, had 900 document cache hits, zero
document cache misses, and zero privacy or redaction failures. This makes the
local lane viable as a warm-index fallback, but it does not earn promotion over
BM25 or the current Voyage cloud canary.

Provider keys can stay in normal environment variables, or in private key files
referenced by env vars such as `VOYAGE_API_KEYS_FILE`,
`NVIDIA_API_KEYS_FILE`, and `GEMINI_API_KEYS_FILE`. Key files must live outside
the repository and may contain newline- or comma-separated keys. Public reports
still print only presence and key counts.

The live-provider preflight is
`reviews/overnight-20260522/public-longmemeval-provider-live-preflight.json`.
It calls no provider APIs and sends no benchmark text. In the current clean
controller environment it reports `BLOCKED_PROVIDER_ENV`: provider-call and
public-data flags are unset, and env-only Gemini/Voyage/NVIDIA/local-Apple
readiness is absent.
That is intentional. A live provider benchmark should run only after this
preflight reports `READY_FOR_LIVE_PROVIDER_BENCHMARK`.

The larger 30-question target also has its own live-provider preflight:
`reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight.json`.
It binds the future live command to
`reviews/overnight-20260522/public-longmemeval-expanded-run-target.json`, calls
no provider APIs, sends no benchmark text, and currently reports the same
`BLOCKED_PROVIDER_ENV` status. This should be the preferred next provider run
because it tests the cloud arms against the stronger slice where deterministic
hybrid still failed to beat BM25.

Two single-provider expanded preflights now make that next run less all-or-none:

- Voyage arm:
  `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-voyage.json`.
- NVIDIA arm:
  `reviews/overnight-20260522/public-longmemeval-expanded-provider-live-preflight-nvidia.json`.

Both compare the provider arm against `bm25-lite` and `full-hybrid-rerank` on
the same 30-question target. Their command templates list only the selected
provider's env variable, so a Voyage test is not blocked by missing NVIDIA,
Gemini, or local Apple readiness, and an NVIDIA test is not blocked by missing
Voyage, Gemini, or local Apple readiness.

The same path also has a public-safe operator packet:
`reviews/overnight-20260522/public-longmemeval-expanded-provider-operator-packet.md`.
Generate it with:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:packet -- --provider voyage --format markdown
```

The packet is deliberately conservative. It tells the operator to rerun
`benchmark:public-provider:preflight --require-ready`, then run the same-data
provider comparison only after the provider key file and public-data/provider
call consent flags are present. It also lists exactly what may come back:
metrics-only preflight and result files, not keys, raw benchmark text, raw
memories, transcripts, private paths, or diagnostics.

The provider benchmark runner now enforces that comparison shape at the command
level. A provider gate cannot run a provider arm by itself; it must include
`bm25-lite`, `full-hybrid-rerank`, and at least one provider-backed arm. A
hybrid gate must include `bm25-lite` plus at least one hybrid-family candidate.
The autoresearch runner also rejects single-arm reports unless the operator
passes `--allow-solo-smoke`, which labels the run as wiring-only evidence.
That keeps solo runs in the smoke-test lane and makes the control comparison
part of the benchmark contract, not just prose.

Provider gates now make a separate provider-promotion decision. The report may
still include the legacy `hybridPromotion` field for compatibility, but the
decision is keyed as `kind: provider` and selects only provider-backed arms for
`bestProviderStrategy`. The local `full-hybrid-rerank` arm is a required
control, not a provider winner.

That command does not call hosted Supermemory by default. It keeps public
benchmark claims blocked unless a fresh metrics-only hosted baseline, a matched
RecallWeave run, a RecallWeave win, and two independent reviewer approvals are
present through `baseline:reviewer-intake`. Reports may contain aggregate
metrics and hashes only.

The latest budgeted live canary on 2026-05-23 used a source-matched private
hosted mirror, a reviewed 8-query set, no-raw-text mode, preserved hosted ids,
and a 1600-token RecallWeave context budget. Hosted Supermemory scored 0.0000
quality with p50 latency 549 ms and average context tokens 1397. RecallWeave
scored 0.1212 quality, P@1 0.125, recall@5 0.125, recall@10 0.125, p50 latency
12 ms, p95 latency 17 ms, and average context tokens 1600. Privacy failures
were zero for both arms. The result removes the earlier local context-mass
caveat. A reviewed comparison now records reviewerApprovalCount 2,
`publicBenchmarkClaimsAllowed: true`, and `READY_FOR_OWNER_REVIEW`. Public
launch and broad benchmark language remain blocked by owner approval and the
fresh real-container rollout gate.

`baseline:discover -- --live` is the read-only hosted metadata discovery step.
It lists candidate containers as hashed ids, counts, timestamps, and status/type
counts only. It does not print raw container labels or memory text. Operators
who need the raw label can opt into a local-only private map with
`RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1` and `--private-map-output`, then
run `baseline:select-container` to write the selected label into a local-only
0600 env file without printing it. Source that env file on the operator machine
before collection. Do not attach the private map or private env file to public
evidence.

`baseline:author-queryset` can draft a private, review-required query set from
the selected hosted container. It writes the private query set outside the
repository with 0600 permissions and prints only counts and hashes. The draft
does not count as benchmark evidence until a human reviews it locally and
`baseline:queryset --strict` reports that every query is labeled and distinct.

The latest live prep on 2026-05-23 found 14 hashed candidate containers across
200 hosted documents, with no raw labels or memory text in the public report.
It then drafted a private 8-query source-locked query set from 47 text-bearing
hosted documents. The strict public-safe query-set report shows 8 unique
queries, 0 duplicates, and 0 unlabeled queries. This proves safe hosted
metadata access and private query-set preparation only. It is not a hosted
baseline or a comparison result.

A later 2026-05-23 live run used that query set against hosted Supermemory and
the local Codex RecallWeave/selfmem bridge container. The one-command chain
completed, called the hosted provider, wrote metrics-only outputs, and produced
a strict-real evidence packet. It still does not support public benchmark
claims: both arms scored 0 quality, so the result points to a source-match and
label-construction problem rather than a retrieval-quality win. The public-safe
run summary is in
`reviews/overnight-20260522/hosted-baseline-live-codex-local-run-evidence.md`.

A subsequent 2026-05-23 source-matched mirror run used hosted Supermemory as
the read-only source for both arms and applied a 1600-token RecallWeave context
budget. That run produced a strict-real packet, two reviewer approvals, and a
reviewed owner-review packet. The public-safe run summary is in
`reviews/overnight-20260522/hosted-baseline-live-budgeted-run-evidence.md`.

To generate the hosted baseline operator packet with this discovery state
attached, run:

```bash
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet -- --discovery reviews/overnight-20260522/hosted-baseline-live-discovery.json --format markdown
```

`baseline:queryset` inspects the source-locked query set before either side
collects results. It emits hashes and counts only, marks whether every query is
labeled, and fails under `--strict` if any query lacks an expected result id or
content hash or if two queries have the same text.

`baseline:mirror-hosted` is the private read-only bridge for source-matched
hosted canaries. It reads the selected hosted Supermemory source, redacts
private spans, key-shaped strings, and private local paths, then writes a local
RecallWeave-compatible mirror outside the repository with 0700 directory mode
and 0600 files. Only its metrics report may be attached. The mirror files
contain redacted memory text and a raw container map, so they stay local.

`baseline:source-match` checks the reviewed query labels against the selected
local RecallWeave source or private hosted mirror before hosted calls are spent.
Use `--preserve-ids` when the source is the hosted mirror. It emits only hashes,
counts, readiness flags, and privacy counters. It fails under `--strict` unless
every reviewed query has at least one collectable expected reference in the
local source. Use this before `baseline:run` whenever a hosted query set came
from a hosted source.

`baseline:source-align` then checks that the selected hosted label and local
container map point at the same source and that the source-match report allows a
matched run. It also emits hashes, counts, readiness flags, and privacy counters
only. Use it before `baseline:run` and attach only the public-safe alignment
report, never the private hosted map.

`baseline:source-gap` reads the public-safe source-match and source-alignment
reports and prints one deterministic next path: run the matched baseline, select
a different hosted candidate, rebuild labels as content hashes, mirror the
hosted source locally, or rerun the source gates. Attach this report with the
source-match and source-alignment reports when a hosted baseline is still
blocked. When the source is blocked, the report also includes a hashed
per-query repair queue with match counts and a recommended private repair
action. It does not include raw query text, expected refs, memory text, or
container labels.
Use `baseline:operator-packet -- --source-gap <source-gap-report> --format
markdown` to turn a blocked source-gap report into a paste-ready repair handoff.
That handoff still shows only query hashes, match counts, and repair actions.

The fixture command validates the expected result shape without counting as
baseline evidence. The template command prints the live-result schema agents
should fill after a hosted run. A fixture can pass every shape check and still
fail the real-evidence check because `fixtureOnly: true`.

`baseline:collect -- --live` is the read-only collector for hosted baseline
evidence. It uses hosted search only after explicit live flags and
environment-only credentials are present, and it writes aggregate metrics and
hashes only.
Every query in the source-locked query set must carry at least one expected
result id or expected content hash, and every query text must be distinct. The
hosted and RecallWeave collectors reject unlabeled or duplicate query sets
before producing aggregate metrics.

`baseline:export:recallweave -- --live` creates the local RecallWeave
search-response export from a local container. It emits ids or hashed ids,
content hashes, scores, timings, token estimates, and privacy counters only.
It does not emit raw memory text. For matched hosted comparisons, set
`RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET` or pass `--context-token-budget`
so the local arm reports budgeted context tokens instead of full-memory token
mass.

`baseline:collect:recallweave -- --live` converts a local RecallWeave
search-response export into the matched aggregate result file. The export must
use ids, scores, timings, token estimates, privacy counters, and content
hashes. Raw response text is rejected by default.

`baseline:compare` is the matched comparison gate. It compares only aggregate
hosted and RecallWeave result files. It blocks public claims when either result
is a fixture, when any metric or privacy flag is missing, when the query-set or
scoring-code hash differs, when either result lacks labeled query-set evidence,
when RecallWeave exceeds the context-token parity allowance, or when fewer than
two reviewer approvals exist.

`baseline:reviewer:openai-compatible` is the optional direct-review generator
for DeepSeek and other OpenAI-compatible reviewers. It reads only metrics,
hashes, safety counters, and target metadata, then writes one sanitized approval
JSON for `baseline:reviewer-intake`. The API key must live in
`RECALLWEAVE_REVIEW_OPENAI_API_KEY` or a provider-specific environment variable.
The command never needs the key in a shell argument, doc, PR comment, or packet.
Dry-run mode calls no provider and produces a non-countable fixture artifact.

`baseline:next-run` is the state-aware planner for this benchmark lane. It
turns the current hosted/local evidence state into the next safe source-locked
run packet without calling hosted Supermemory or authorizing public claims. The
planner now places `baseline:source-match --strict` and
`baseline:source-align --strict`, followed by `baseline:source-gap`, between
query-set validation and the
hosted/local run chain to prevent another unmatched 0-0 comparison. For hosted
history, it now includes `baseline:mirror-hosted` so the local arm can prove the
same source before collection.

`baseline:run` is the one-command runner after private setup is complete. It
requires a reviewed private query set, a private hosted container env file, and
a private hosted mirror or source-matched local RecallWeave container, plus the
local and hosted container maps needed for source alignment. It repeats the
source-match and source-alignment gates and writes the source-gap plan before
hosted collection, then runs hosted collection, local export, local collection,
preflight, comparison, packet creation, and returned-packet intake. Fixture mode
proves the chain and remains blocked as real hosted-baseline evidence.

## Historical Controlled Local Baseline

| Setup | Evidence type | P@1 | Recall@5 | Recall@10 | Redaction failures | Boundary |
|---|---|---:|---:|---:|---:|---|
| RecallWeave local | deterministic fixture | 0.763 | 0.895 | 0.921 | 0 | Historical local lexical baseline. Rerun required on this release branch. |
| RecallWeave hybrid | deterministic fixture | 0.868 | 1.000 | 1.000 | 0 | Historical hybrid merge smoke. Rerun required on this release branch. |
| Hosted Supermemory | live hosted-prep Codex-local run | 0.000 | 0.000 | 0.000 | 0 | Metrics-only live run completed, but labels did not match retrieved hosted results. Not public benchmark evidence. |
| RecallWeave local Codex bridge | live hosted-prep Codex-local run | 0.000 | 0.000 | 0.000 | 0 | Much lower latency than hosted, but same zero-quality label result. Requires source-matched container before claims. |
| Hosted Supermemory | live source-matched budgeted canary | 0.000 | 0.000 | 0.000 | 0 | Metrics-only hosted baseline on an 8-query private slice. Not public benchmark evidence until two reviewers approve the exact packet. |
| RecallWeave hosted mirror | live source-matched budgeted canary | 0.125 | 0.125 | 0.125 | 0 | Beat the selected hosted baseline on the small canary with a 1600-token context budget. Not a broad or public superiority claim. |

## Historical Plugin-To-Plugin Smoke

| Host surface | RecallWeave cloud Voyage P@1 | Supermemory P@1 | RecallWeave Recall@5 | Supermemory Recall@5 | Privacy leaks | Boundary |
|---|---:|---:|---:|---:|---:|---|
| Codex context-proxy | 0.895 | 0.895 | 1.000 | 1.000 | 0 | Historical controlled active-session tasks, deterministic answers. Rerun required on this release branch. |
| Claude Code context-proxy | 0.895 | 0.895 | 1.000 | 1.000 | 0 | Historical SessionStart/Stop parity surface. Rerun required on this release branch. |

Latency from those smokes:

| Host surface | RecallWeave p50 | RecallWeave p95 | Supermemory p50 | Supermemory p95 | Note |
|---|---:|---:|---:|---:|---|
| Codex context-proxy | 592.4 ms | 19445.8 ms | 610.3 ms | 940.6 ms | RecallWeave p95 inflated by free-tier key-rotation pacing. |
| Claude Code context-proxy | 457.7 ms | 19558.6 ms | 651.5 ms | 1064.2 ms | RecallWeave p95 inflated by free-tier key-rotation pacing. |

## Superseded Public MemoryBench Smoke

| Benchmark | Scope | Stack | Result | Boundary |
|---|---|---|---|---|
| LongMemEval-S | first 5 questions | Voyage voyage-4-large plus rerank-2.5, Gemini 2.5 Flash judge and answer model | superseded engineering smoke | No release claim. The benchmark-specific context shortcuts were removed before publishing, and the run must be repeated before comparison framing. |

Interpretation: retrieval can be strong while answer synthesis remains weak. The next quality improvement should target generic type-aware context compilation and compact event/fact synthesis, not benchmark-specific shortcuts.

## Runtime Smokes

| Runtime | Evidence type | Result | Boundary |
|---|---|---|---|
| Hermes | standalone mocked provider smoke | pass | proves adapter path, not live billing. |
| OpenClaw | standalone mocked provider smoke | pass | proves adapter path, not live billing. |
| Privacy tests | unit tests | zero expected leaks | does not replace live log audits. |

## What Counts As A Real Win

A stronger claim requires:

- a source-locked canary from a real benchmark or documented benchmark slice,
- a RecallWeave win against the matched baseline,
- the same memory set,
- the same queries,
- relevance labels for every query,
- the same judge and answer model,
- the same scoring code,
- the same settings,
- a metrics-only end-to-end answer-quality result from `benchmark:answer-quality`
  that passed `benchmark:memory-score:result-gate --require-ready`,
- a source-match preflight showing the local RecallWeave source can score the
  reviewed labels,
- context-token parity between hosted and local arms, or an explicit local
  context budget recorded in the RecallWeave export,
- two independent reviewer approvals bound to the exact metrics-only packet
  through `baseline:reviewer-intake`,
- no memory text in shared reports,
- zero redaction failures,
- cost and latency accounting,
- a valid Supermemory baseline that is not quota-blocked.
- a baseline result that is not a fixture and passes the hosted preflight
  result checks.

Until then, RecallWeave should be described as a local-first fallback and experimental native memory lane, not as a proven replacement.

## Next Canary Matrix

The next public-safe benchmark gate will test separated provider arms:

- `cloud-voyage4-lite-voyage-lite` as the current latency-sensitive cloud
  canary winner.
- `cloud-voyage4-voyage` as the larger quality reference arm.
- `cloud-voyage4-voyage-lite-rerank` to isolate the effect of
  `rerank-2.5-lite` while keeping `voyage-4-large`.
- `cloud-gemini-embed-rerank-proxy` for Gemini embedding quality without a
  hosted reranker.
- `cloud-gemini-voyage-rerank` for Gemini embedding quality with Voyage rerank.
- `cloud-nvidia-retriever-500m`, `cloud-nvidia-nemotron-1b`,
  `cloud-nvidia-nemotron-vl-1b`, and `cloud-nvidia-e5-mistral` for hosted
  NVIDIA retrieval comparisons.
- `local-apple-qwen3-0_6b` for the default Apple Silicon lane.
- `local-apple-qwen3-0_6b-local-rerank` for the first local method challenger:
  same 0.6B Apple Silicon embedding lane, plus a local reranker sidecar.
- `local-apple-qwen3-4b` for the measured larger local Apple Silicon arm after
  the persistent cache gate is green.

Query expansion stays off unless it enters as one isolated methodology change
and beats the no-expansion run without exact-identifier, privacy, or latency
regressions.

Public GitHub benchmark scores are allowed only after a real matched canary win
with two independent reviewer approvals recorded by `baseline:reviewer-intake`.
A canary win may justify a full benchmark; it does not prove general SOTA
superiority.

The public target itself must pass before a canary starts:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-target -- --target <target.json> --strict
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --fixture
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1 \
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1 \
VOYAGE_API_KEY=<env-only> \
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live \
  --target reviews/overnight-20260522/public-longmemeval-run-target.json
```

This gate separates component evidence from memory-system evidence. MTEB,
MMTEB, BEIR, MIRACL, MS MARCO, and reranker scores can choose model arms, but
they cannot replace MemoryBench, LongMemEval, LoCoMo, ConvoMem, BEAM, or another
end-to-end memory benchmark.
