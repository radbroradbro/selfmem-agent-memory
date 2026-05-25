# Query Expansion Result Gate

- Status: BLOCKED_QUERY_EXPANSION_RESULT
- Counts as live query-expansion benchmark: false
- Counts as full memory SOTA evidence: false
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json

## Blockers
- fixture-result-cannot-count-as-live-query-expansion
- result-not-bound-to-source-locked-target
- missing-materializer-hash
- query-expansion-live-calls-missing
- query-expansion-used-deterministic-fallback
- query-expansion-mode-not-labeled
- query-expansion-provider-not-live
- query-expansion-rewrite-count-missing

## Result
- Source: generated-fixture-proxy-smoke
- Fixture only: true
- Query expansion mode: deterministic-proxy
- Query expansion provider: local-deterministic
- Query expansion calls: 0
- Query expansion fallbacks: 3

## Next Actions
- Run the same-data strategy comparison with a configured local or approved mixed-cloud query-expansion endpoint.
- Include bm25-lite, full-hybrid-rerank, and query-expanded-full-hybrid-rerank on the source-locked target.
- Re-run this gate with --require-ready before counting the query-expansion row in the SOTA ladder.
