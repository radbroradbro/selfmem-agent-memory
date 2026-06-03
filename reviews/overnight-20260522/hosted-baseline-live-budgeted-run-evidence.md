# Hosted Baseline Live Budgeted Run Evidence

Date: 2026-05-23

## Scope

Ran the source-matched hosted Supermemory versus RecallWeave baseline again
after adding local context-budget enforcement. This run used hosted
Supermemory read-only for the hosted arm and a private local
RecallWeave-compatible mirror for the local arm.

Raw hosted labels, raw query text, private maps, selected container env, and
mirrored memory text stayed in `/tmp` and were not copied into the repository.

Public-safe artifacts:

- `reviews/overnight-20260522/hosted-baseline-live-budgeted-run.json`
- `reviews/overnight-20260522/hosted-baseline-live-budgeted-packet.json`

Private local-only artifacts:

- hosted raw-label map
- selected hosted container env file
- reviewed private query set
- redacted local hosted mirror files
- strict-real evidence packet zip

## Commands

The controller ran the live chain with the local `SUPERMEMORY_API_KEY` present
in the environment and no credential values printed:

```bash
baseline:discover -- --live --private-map-output <private-map>
baseline:select-container -- --private-map <private-map> --env-output <private-env>
baseline:author-queryset -- --live --private-map <private-map> --queryset-output <private-queryset>
baseline:queryset -- --queryset <private-queryset> --strict
baseline:mirror-hosted -- --live --private-map <private-map> --output-dir <private-mirror>
baseline:source-match -- --live --queryset <private-queryset> --container-dir <private-mirror> --preserve-ids --strict
baseline:source-align -- --source-match <source-match> --local-map <private-mirror>/container-map.json --private-map <private-map> --strict
baseline:source-gap -- --source-match <source-match> --source-alignment <source-alignment>
baseline:run -- --live --container-env <private-env> --queryset <private-queryset> --container-dir <private-mirror> --local-map <private-mirror>/container-map.json --private-map <private-map> --preserve-ids --reviewed-queryset --context-token-budget 1600 --judge-model gpt-4o --answer-model gpt-4o
baseline:packet:review -- --packet <strict-real-packet> --strict-real
```

## Result

- Fixture-only: no.
- Hosted provider called: yes.
- Counts as production baseline evidence: yes.
- Counts as public benchmark evidence: no.
- Public benchmark claims allowed: no.
- Query count: 8.
- Privacy leaks: 0.
- Hosted Supermemory quality: 0.
- Hosted Supermemory P@1: 0.
- Hosted Supermemory recall@5: 0.
- Hosted Supermemory recall@10: 0.
- Hosted Supermemory NDCG@10: 0.
- Hosted Supermemory latency p50: 549 ms.
- Hosted Supermemory latency p95: 1078 ms.
- Hosted Supermemory average context tokens: 1397.
- RecallWeave quality: 0.1212.
- RecallWeave P@1: 0.125.
- RecallWeave recall@5: 0.125.
- RecallWeave recall@10: 0.125.
- RecallWeave NDCG@10: 0.1096.
- RecallWeave latency p50: 12 ms.
- RecallWeave latency p95: 17 ms.
- RecallWeave full candidate context average before budget: 10849 tokens.
- RecallWeave exported context average after budget: 1600 tokens.
- Budgeted queries: 8 of 8.
- Skipped-by-budget candidate count: 41.
- Strict-real packet review: passed.
- Reviewer intake: two independent approvals collected after this run.
- Reviewed comparison: rerun with reviewer approvals, passed.
- Reviewed returned packet intake: `READY_FOR_PUBLIC_BENCHMARK_REVIEW`.
- Reviewed next-run planner: `READY_FOR_OWNER_REVIEW`.
- Remaining release blockers: owner approval and one real-container production
  canary.

## Artifact Hashes

- `hosted-baseline-live-budgeted-run.json` SHA256:
  `b3a2207a584827e5ad0bfeca9edd53834df64518af6e921ee7f5ede604f31221`.
- Private strict-real evidence packet SHA256:
  `36531ff7db205db0bcfb7e39f0863b1226bf0b6d26d00f919374a41bc41a9693`.

## Interpretation

This run removes the earlier context-budget caveat. RecallWeave still beats
hosted Supermemory on the source-matched canary quality metrics, and the local
arm now runs within the configured 1600-token context budget. This is useful
engineering evidence, not a public superiority claim.

The reviewer approval intake now passes for this source-matched canary target.
Public benchmark language still requires the matched comparison and packet to
be rerun with that reviewer approval report attached.

## Boundary

This evidence does not authorize public benchmark claims, public launch, or
fleet rollout. The real one-agent canary remains incomplete.
