# Codex Review: Public LongMemEval Materialize Run

Verdict: PASS WITH CONCERNS

The materializer is a useful bridge from source-locked benchmark target to
actual same-data RecallWeave inputs. It preserves the right public boundary:
raw questions, answers, question ids, haystack sessions, and private file paths
stay outside the repository; committed evidence contains only hashes, counts,
metrics, and command templates.

Follow-up review after Goodall blocker:

- The materializer now emits `collectorCompatibleQuerySetHash`.
- The release gate now asserts that
  `public-longmemeval-recallweave-run-result.json.querySetHash` equals that
  materializer hash, so the scored result is bound to the materialized same-data
  query set.
- The RecallWeave result JSON now carries `retrievalProxyOnly: true`,
  `memoryBenchAnswerQuality: false`, and
  `publicBenchmarkClaimsAllowed: false`.
- `release:check` passes with those stricter assertions.

Concerns:

- The checked-in result is a retrieval proxy from the local RecallWeave response
  exporter and repository scoring contract. It is not official MemoryBench
  answer evaluation and is not a MemoryBench quality win.
- The blind baseline is weak: quality 0.1089 on six source-locked rows. That is
  acceptable as an autoresearch starting point, but it argues for embedding,
  reranking, temporal, and query-expansion work before any public benchmark
  language.
- The target remains `run-only`. A reported comparison row and reviewer
  approvals are still required before canary-trend wording.

Release decision:

Pass this slice into the release gate as benchmark infrastructure and blind
baseline evidence. Keep public launch, broad SOTA, and Supermemory superiority
claims blocked.
