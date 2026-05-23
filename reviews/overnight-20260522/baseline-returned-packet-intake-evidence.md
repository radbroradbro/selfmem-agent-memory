# Returned Hosted Baseline Packet Intake Evidence

Date: 2026-05-23

## Scope

Added a maintainer-facing intake path for a returned hosted baseline evidence
packets. This mirrors the canary returned-packet flow: operators can package
aggregate hosted Supermemory, RecallWeave, comparison, and preflight results,
then maintainers can review the single zip without unpacking raw evidence by
hand.

## Commands

```bash
node --check packages/bench/baseline-evidence-packet-review.mjs
node --check packages/bench/baseline-returned-packet-intake.mjs
npm exec --yes pnpm@10.23.0 -- baseline:packet:review
npm exec --yes pnpm@10.23.0 -- baseline:returned-packet
```

Fixture strict-real rejection:

```bash
node packages/bench/baseline-evidence-packet.mjs --output <tmp>/packet.zip
node packages/bench/baseline-evidence-packet-review.mjs --packet <tmp>/packet.zip --strict-real
node packages/bench/baseline-returned-packet-intake.mjs --packet <tmp>/packet.zip --require-production-baseline --output <tmp>/returned-baseline-intake.json
```

Expected result: both strict-real commands exit nonzero for fixture evidence.

## Result

- `baseline:packet:review` passed on fixture input and reported
  `countsAsProductionBaselineEvidence: false`.
- `baseline:returned-packet` passed on fixture input with
  `status: NOT_BASELINE_EVIDENCE`.
- `--packet` review defaults to strict-real review.
- `--require-production-baseline` fails closed for fixture evidence.
- The output is metrics-only and includes no hosted memories, local memories,
  transcripts, prompts, answers, provider keys, cookies, or private paths.
- Public launch remains `false`.
- Public benchmark claims remain blocked unless the packet is strict-real and
  the comparison/preflight evidence already permits those claims.

## Guardrails

- Allowed zip entries are fixed to `README.md`, `manifest.json`,
  `hosted-baseline-result.json`, `recallweave-result.json`,
  `baseline-comparison.json`, and `hosted-baseline-preflight.json`.
- The reviewer rejects unexpected zip paths, absolute paths, key-shaped text,
  private local paths, and raw-content keys.
- Fixture packets never count as production baseline evidence.
- A strict-real baseline packet can close only the baseline-evidence lane. It
  still does not authorize public launch or owner-facing release claims.
