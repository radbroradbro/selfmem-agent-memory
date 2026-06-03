# Hosted Baseline Live Mirror Run Evidence

Date: 2026-05-23

## Scope

Ran the hosted-baseline flow again after adding the private hosted mirror. This
run used hosted Supermemory read-only for the hosted arm and a private local
RecallWeave-compatible mirror for the local arm. Raw hosted labels, raw query
text, and mirrored memory text stayed in a local temporary workspace and were
not copied into the repository.

Public-safe artifacts:

- `reviews/overnight-20260522/hosted-baseline-live-mirror-run.json`
- `reviews/overnight-20260522/hosted-baseline-live-mirror-packet.json`

Private local-only artifacts:

- hosted raw-label map
- selected hosted container env file
- reviewed private query set
- redacted local hosted mirror files
- strict-real evidence packet zip

## Commands

The controller ran this sequence with the local `SUPERMEMORY_API_KEY` present
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
baseline:run -- --live --container-env <private-env> --queryset <private-queryset> --container-dir <private-mirror> --local-map <private-mirror>/container-map.json --private-map <private-map> --preserve-ids --reviewed-queryset
baseline:packet -- --strict-real
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
- Hosted Supermemory latency p50: 572 ms.
- Hosted Supermemory latency p95: 1189 ms.
- Hosted Supermemory average context tokens: 1397.
- RecallWeave quality: 0.1212.
- RecallWeave P@1: 0.125.
- RecallWeave recall@5: 0.125.
- RecallWeave recall@10: 0.125.
- RecallWeave NDCG@10: 0.1096.
- RecallWeave latency p50: 24 ms.
- RecallWeave latency p95: 35 ms.
- RecallWeave average context tokens: 10849.
- Strict-real packet creation: passed.
- Next-run owner review gate: blocked on two reviewer approvals.

## Artifact Hashes

- `hosted-baseline-live-mirror-run.json` SHA256:
  `ee57e1d1e2775ce626f5fe31e6371bbe29abe351c3a0413dca6bec9777f0c60f`.
- `hosted-baseline-live-mirror-packet.json` SHA256:
  `1b581bd47a7ac47b0018ab908588620094126e05d32028a3b9f9df1f6be662d8`.
- Private strict-real evidence packet SHA256:
  `7b1d7b2587e21454333ec764fb8ceb0a2248365a4ab1ad8add02d7559fad6051`.

## Interpretation

This is the first source-matched live hosted-vs-local baseline after the hosted
mirror landed. It replaces the earlier all-zero comparison with a non-zero
RecallWeave result while hosted Supermemory still scored zero against the
private reviewed labels. That is useful engineering evidence, not a public
superiority claim.

The local arm used far more context tokens than hosted Supermemory. The next
research iteration should tune context budgeting and label quality before any
public benchmark language.

## Boundary

This evidence does not authorize public benchmark claims. The comparison still
needs two independent reviewer approvals, and the real one-agent canary remains
incomplete.
