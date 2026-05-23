# Baseline Context-Budget Gate Evidence

Date: 2026-05-23

Purpose: prevent a local RecallWeave arm from looking better while injecting far more context than hosted Supermemory.

Implemented:

- `baseline:export:recallweave` now accepts `--context-token-budget` or `RECALLWEAVE_BASELINE_CONTEXT_TOKEN_BUDGET`.
- The response export records only metrics-safe budget fields: whether the budget applied, the token budget, average full candidate tokens, average exported context tokens, clipped result count, and skipped result count.
- `baseline:collect:recallweave` carries that budget metadata into the aggregate RecallWeave result.
- `baseline:compare` now reports a `contextBudget` block and fails `context-token-parity` when RecallWeave exceeds the hosted context allowance.
- `baseline:operator-packet`, `baseline:next-run`, and `baseline:run` now steer matched live runs toward a 1600-token local context budget.

Local proof:

```text
node packages/bench/recallweave-response-export.mjs --fixture --context-token-budget 40
```

Result summary:

```json
{
  "applied": true,
  "budget": 40,
  "avg": 40,
  "first": {
    "applied": true,
    "tokenBudget": 40,
    "selectedCount": 2,
    "skippedByBudgetCount": 3,
    "clippedResultCount": 1,
    "fullCandidateTokens": 119,
    "exportedContextTokens": 40
  }
}
```

Safety checks:

- No raw memory text is emitted in the response export.
- No private paths or key-shaped values are emitted.
- `release:check` passes with the new gate.
- Public benchmark claims remain blocked by reviewer approval and real-rollout requirements.
