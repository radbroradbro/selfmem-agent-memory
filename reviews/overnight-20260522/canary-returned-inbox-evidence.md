# Canary Returned Inbox Evidence

## Scope

Added `canary:returned-inbox`, a metrics-only scanner for folders of returned
agent zips. It is intended for the handoff reality where a folder may contain
strict canary evidence packets, next-agent handoff packets, diagnostics, and
bad or unrelated zips.

The scanner does not read raw memories or transcripts. It lists zip entries,
classifies packet contracts, delegates real evidence validation to
`canary:returned-packet`, and emits only safe labels, hashes, counts, status
codes, and failed check names.

## Commands

```bash
node --check packages/bench/canary-returned-inbox.mjs
node --check packages/bench/consumer-install-smoke.mjs
node --check packages/bench/release-readiness-check.mjs
node --check packages/bench/goal-completion-audit.mjs
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --input-root <mixed-temp-folder> --include-all-zips
npm exec --yes pnpm@10.23.0 -- canary:returned-inbox -- --require-production-canary
```

## Results

- Default fixture scan passed as tooling proof and reported
  `RETURNED_EVIDENCE_FOUND_NOT_PRODUCTION`.
- The strict release form failed closed with `--require-production-canary` for
  fixture evidence.
- A mixed inbox containing one fixture evidence packet, one next-agent handoff
  packet, and one bad zip reported:
  - `returnedEvidencePackets: 1`
  - `productionEvidencePackets: 0`
  - `handoffPackets: 1`
  - `unreadablePackets: 1`
- Handoff packets were classified as
  `HANDOFF_PACKET_NOT_RETURNED_EVIDENCE`.
- Bad zips were classified as `UNREADABLE_ZIP`, but raw local paths were
  redacted from the failure reason.
- Output preserved `publicLaunchAllowed: false` and `fleetRolloutAllowed:
  false`.

## Public Safety

- No raw memories, prompts, transcripts, answers, env files, or tokens are
  emitted.
- Output uses packet basenames, SHA-256 hashes, counts, known safe entry names,
  and review summaries.
- Private local paths and key-shaped secrets are rejected before output is
  printed or written.

## Release Meaning

This proves folder-level triage only. It does not count as a live production
canary. Production evidence still requires a non-fixture returned evidence
packet that passes `canary:returned-packet -- --require-production-canary`.
