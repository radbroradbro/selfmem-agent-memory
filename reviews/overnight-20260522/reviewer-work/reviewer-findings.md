# Budgeted Baseline Reviewer Findings

Date: 2026-05-23

## Scope

This review covers the source-matched, budgeted hosted-baseline canary in
`reviews/overnight-20260522/hosted-baseline-live-budgeted-run.json`.

The evidence is metrics-only. It reports no raw memory text, no raw transcript
text, no raw prompt text, no raw answer text, no credentials, and no private
paths.

## Benchmark Boundary

The run supports only a source-matched canary claim. It does not prove a full
MemoryBench result, does not authorize public launch, and does not remove the
need for owner approval.

## Reviewer Results

| Reviewer | Route | Status | Counts |
|---|---|---:|---:|
| Codex GPT-5.5 | native CLI reviewer | approved | yes |
| Gemini 3.1 Pro Preview | native CLI reviewer | approved | yes |
| Claude Opus | native CLI reviewer | blocked by local hooks | no |

## Main Takeaways

- The reviewer prompt summary now exposes P@1, recall@5, recall@10, NDCG@10,
  p50/p95 latency, and average context tokens for both arms.
- The hosted arm remained at zero quality on the source-matched canary.
- RecallWeave had non-zero quality on the same canary and stayed within the
  local 1600-token context budget.
- The context budget caveat remains important: the local arm clipped every
  query to fit the budget, so the canary supports controlled comparison, not a
  broad claim that all future recall contexts will stay short.
- Privacy failures remained zero.

## Next Gate

Run the strict intake gate against the two JSON approvals. If it passes, rerun
the matched comparison with the reviewer approval report attached. Public launch
still remains blocked until the owner explicitly approves it.

