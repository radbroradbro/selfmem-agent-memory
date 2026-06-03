# Baseline Evidence Packet Evidence

Date: 2026-05-23

## Scope

Added `baseline:packet`, a metrics-only zip builder for hosted Supermemory
baseline submissions. It packages the hosted result, RecallWeave result,
matched comparison, and hosted preflight output into one reviewer attachment.

This does not close the hosted-baseline blocker. It reduces operator error by
making the final submission shape explicit and fail-closed.

## Commands

```bash
node --check packages/bench/baseline-evidence-packet.mjs
npm exec --yes pnpm@10.23.0 -- baseline:packet -- --output <temporary-packet.zip>
npm exec --yes pnpm@10.23.0 -- baseline:packet -- --strict-real --output <temporary-strict-fixture.zip>
npm exec --yes pnpm@10.23.0 -- baseline:operator-packet
unzip -Z1 <temporary-packet.zip>
```

## Result

- `ok`: true.
- Mode: `baseline-evidence-packet`.
- Writes real files: true, to the requested output path only.
- Metrics only: true.
- Fixture-only smoke: true.
- Counts as hosted baseline evidence: false.
- Counts as comparison evidence: false.
- Public benchmark claims allowed: false.
- Public launch allowed: false.
- Packet hash from smoke:
  `26b660bdc4637e58a629029c19da0e98060d747c9bd43dc7993f652c88cb419e`.
- Zip entries:
  - `README.md`
  - `manifest.json`
  - `hosted-baseline-result.json`
  - `recallweave-result.json`
  - `baseline-comparison.json`
  - `hosted-baseline-preflight.json`
- `--strict-real` fixture packet fails closed because fixture hosted,
  RecallWeave, comparison, and preflight evidence cannot count as a real
  baseline packet.

## Guardrails

- `--strict-real` requires real hosted, RecallWeave, comparison, and preflight
  evidence.
- Fixture packets keep public benchmark claims disabled.
- The packet never includes raw hosted memories, raw local memories,
  transcripts, prompts, answers, provider keys, cookies, private local paths,
  or unredacted diagnostic archives.
- The hosted baseline operator packet now tells agents to run
  `baseline:packet --strict-real` after collecting and comparing aggregate-only
  files, so agents do not improvise which JSON files to send.
