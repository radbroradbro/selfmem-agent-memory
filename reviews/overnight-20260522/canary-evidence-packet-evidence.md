# Canary Evidence Packet Evidence

Date: 2026-05-23

## Scope

Added `canary:packet`, a metrics-only zip builder for one-agent canary
submissions. It packages sanitized canary report, intake, and optional
diagnosis files into one attachable zip while rejecting raw memory-shaped keys,
secret-shaped values, and private local paths.

This does not complete the real-container rollout blocker. It reduces operator
error by giving agents one safe packet to attach after strict-real canary
collection or failed-canary diagnosis.

## Commands

```bash
node --check packages/bench/canary-evidence-packet.mjs
npm exec --yes pnpm@10.23.0 -- canary:packet -- --output <temporary-packet.zip>
npm exec --yes pnpm@10.23.0 -- canary:intake > <temporary-intake.json>
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report packages/bench/fixtures/canary-runtime-report.fixture.json --intake <temporary-intake.json> --output <temporary-packet-with-intake.zip>
npm exec --yes pnpm@10.23.0 -- canary:packet -- --report packages/bench/fixtures/canary-runtime-report.fixture.json --intake <temporary-intake.json> --strict-real --output <temporary-strict-fixture.zip>
unzip -Z1 <temporary-packet.zip>
```

## Result

- `ok`: true.
- Mode: `canary-evidence-packet`.
- Writes real files: true, to the requested output path only.
- Metrics only: true.
- Fixture-only smoke: true.
- Counts as real rollout evidence: false.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Packet hash from smoke: `e7e5933f3081f3bb86ee91cf86c57ab34cf156e24e4ae3badfc37477e5d653f6`.
- Zip entries:
  - `README.md`
  - `manifest.json`
  - `canary-report.json`
- Zip entries when intake is included:
  - `README.md`
  - `manifest.json`
  - `canary-report.json`
  - `canary-intake.json`
- `--strict-real` fixture packet fails closed because a fixture cannot count as
  passing live canary intake evidence.

## Guardrails

- `--strict-real` requires a passing `canary:intake --strict-real` output.
- Fixture packets and failing diagnostic packets keep
  `countsAsRealRolloutEvidence: false`.
- The packet never includes raw memories, raw transcripts, raw prompts, raw
  answers, provider keys, cookies, private local paths, or unredacted
  diagnostic archives.
- The operator packet now includes both passing-evidence and
  diagnostic-evidence packaging commands, so agents do not have to improvise
  which files to send.
