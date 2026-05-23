# Hosted Baseline Live Codex Local Run Evidence

Date: 2026-05-23

Verdict: real metrics-only baseline packet produced, but not public benchmark
evidence.

## What Ran

- Mode: live hosted Supermemory plus local RecallWeave export.
- Query set: the reviewed private 8-query hosted-prep set.
- Hosted arm: read-only Supermemory search.
- Local arm: the local Codex RecallWeave/selfmem bridge container.
- Output: `hosted-baseline-live-codex-local-run.json`.
- Evidence packet SHA256:
  `0838d80fc851d3751e6eecc99a62c2b94a5607d4f1244e1a5466b08f9d60d34c`.

## Result

- `fixtureOnly`: false.
- `callsHostedProvider`: true.
- `countsAsProductionBaselineEvidence`: true.
- `countsAsPublicBenchmarkEvidence`: false.
- `publicBenchmarkClaimsAllowed`: false.
- Query count: 8.
- Query-set hash:
  `sha256:52a7f54511631b079585accde83aa7817704f253abd990ced9d64dbcd31fc97a`.
- Privacy leaks: 0.
- Redaction failures: 0.

## Metrics

| Arm | Quality | P@1 | Recall@5 | Recall@10 | NDCG@10 | p50 latency | p95 latency | Avg context tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hosted Supermemory | 0 | 0 | 0 | 0 | 0 | 634 ms | 721 ms | 1228 |
| RecallWeave local Codex bridge | 0 | 0 | 0 | 0 | 0 | 8 ms | 17 ms | 386 |

## Interpretation

This run proves the one-command live baseline path can complete without raw
memory text, credentials, private paths, or diagnostic contents. It does not
prove RecallWeave quality and does not support a public comparison claim.

Both arms scored zero against the private query labels, which means the current
auto-authored hosted-source query set is not yet a reliable public benchmark
slice. The next research iteration should focus on source-match proof and label
construction before comparing model or retrieval quality.

## Next Required Step

Use a source-matched local container or a deliberately mirrored export of the
selected hosted container, then rerun the same metrics-only chain. Public claims
remain blocked until the matched run has non-zero source-label evidence, no
privacy failures, and two reviewer approvals.
