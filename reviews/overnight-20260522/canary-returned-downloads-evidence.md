# Canary Returned Downloads Evidence

Date: 2026-05-23

## Scope

Added `canary:returned-downloads`, a metrics-only controller helper for the
standard local inboxes where returned agent packets usually arrive.

Added `canary:returned-downloads:strict` as the named release-blocking version
of the same standard-inbox scan. It always sets `--require-found`, so it must
fail until a returned production canary packet exists.

Added `canary:returned-downloads:watch12h` as the maintainer supervision
command for the standard local inboxes. It checks every 15 minutes for 12 hours,
requires a production canary packet, and exits nonzero if none appears.

By default it scans:

- Downloads
- Telegram Desktop

It wraps `canary:returned-watch` directly through Node, so operators do not
need to type private local folder paths into package-manager commands. It can
also write a markdown findings note for the next-agent review workspace.

## Commands

```bash
node --check packages/bench/canary-returned-downloads.mjs
node packages/bench/canary-returned-downloads.mjs --skip-defaults
node packages/bench/canary-returned-downloads.mjs --skip-defaults --input-root <mixed-temp-folder> --iterations 1
node packages/bench/canary-returned-downloads.mjs --skip-defaults --input-root <mixed-temp-folder> --require-found
node packages/bench/canary-returned-downloads.mjs --output <metrics-json> --findings-output reviews/overnight-20260522/next-agent-workspace/returned-downloads-findings.md
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads:strict -- --output <metrics-json>
npm exec --yes pnpm@10.23.0 -- canary:returned-downloads:watch12h -- --output <metrics-json> --findings-output <findings-md>
```

## Current Local Inbox Scan

- Status: `AWAITING_RETURNED_PRODUCTION_CANARY`.
- Production evidence packets: 0.
- Returned evidence packets: 0.
- Handoff packets: 1.
- Diagnostic bundles: 10.
- Unknown packets: 22.
- Unreadable packets: 0.
- Downloads scan:
  - candidates: 19.
  - handoff packets: 1.
  - diagnostics: 6.
  - unknown: 12.
  - unreadable: 0.
- Telegram Desktop scan:
  - candidates: 14.
  - diagnostics: 4.
  - unknown: 10.

The refreshed scanner no longer treats zip entries with private-looking paths as
unreadable. It uses sanitized basenames for classification and still emits only
safe entry labels, hashes, counts, and status codes.

The scan wrote
`reviews/overnight-20260522/returned-downloads-current-scan.md` as the native
markdown findings note. It contains counts and safe inbox labels only.

## Fixture Result

- `--skip-defaults` reports `NO_DEFAULT_INBOXES` and exits successfully unless
  `--require-found` is set.
- A temporary mixed inbox with one handoff packet reports
  `AWAITING_RETURNED_PRODUCTION_CANARY`, `handoffPackets: 1`, and
  `productionEvidencePackets: 0`.
- The same temporary inbox exits nonzero with `--require-found`.
- The markdown findings output records aggregate counts and keeps public launch
  blocked.

## Public Safety

- The helper emits counts, safe inbox labels, hashes, status codes, and child
  watch metrics only.
- It rejects key-shaped strings and private local path patterns before printing
  or writing output.
- It does not print candidate filenames from folder scans.
- It does not read or emit raw memories, prompts, transcripts, answers, env
  files, provider keys, cookies, private container names, or diagnostics.

## Release Meaning

This is supervision tooling only. It does not close the real canary blocker.
The release blocker closes only when a non-fixture returned evidence packet
passes strict production intake and the maintainer approves promotion.
