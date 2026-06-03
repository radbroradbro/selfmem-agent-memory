# Canary Evidence Packet Review Evidence

Date: 2026-05-23

## Scope

Added `canary:packet:review`, a metrics-only validator for one-agent canary
evidence zips received from Hermes or OpenClaw agents. The command opens the
zip, validates only the public-safe JSON files inside it, rejects raw-content
keys, key-shaped secrets, private local paths, unexpected zip entries, and
unsafe path entries, then reports whether the packet can count as strict-real
one-agent canary evidence.

This does not complete the real-container rollout blocker. It makes the next
real canary safer by giving the controller a single command to review the file
an agent sends back.

## Commands

```bash
node --check packages/bench/canary-evidence-packet-review.mjs
npm exec --yes pnpm@10.23.0 -- canary:packet:review
npm exec --yes pnpm@10.23.0 -- canary:packet -- --output <temporary-packet.zip>
npm exec --yes pnpm@10.23.0 -- canary:packet:review -- --packet <temporary-packet.zip>
npm exec --yes pnpm@10.23.0 -- canary:packet:review -- --packet <temporary-packet.zip> --strict-real
npm exec --yes pnpm@10.23.0 -- consumer:smoke
```

## Result

- Mode: `canary-evidence-packet-review`.
- Default fixture review: `ok: true`.
- Writes real files: true only when the command creates its own temporary
  fixture packet for smoke coverage.
- Explicit packet review writes no files.
- Metrics only: true.
- Fixture-only smoke: true.
- Counts as real rollout evidence: false.
- Counts as production canary evidence: false.
- Public launch allowed: false.
- Fleet rollout allowed: false.
- Packet hash from explicit fixture review:
  `3cded8d90bf2635d64ae7a98d393a3edce8e536065bfc36fbc8331ac03125895`.
- Zip entries reviewed:
  - `README.md`
  - `canary-report.json`
  - `manifest.json`
- `--strict-real` fixture review fails closed with failed check
  `strict-real-passed`.

## Guardrails

- `--strict-real` requires a non-fixture packet with passing strict-real intake.
- The command compares manifest files to zip entries.
- The command rejects unexpected zip entries, absolute paths, and `..` paths.
- The command recursively rejects raw memory, transcript, prompt, answer,
  message, credential, cookie, and environment-shaped keys.
- The command scans packet contents and its own output for key-shaped secrets
  and private local paths.
- The command never allows public launch or fleet rollout by itself.
