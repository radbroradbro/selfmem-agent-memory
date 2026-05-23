# Returned Canary Watch Findings

Date: 2026-05-23

## Scope

This note covers `canary:returned-watch`, a public-safe supervision command for
folders that may receive agent-returned canary evidence packets.

The command is designed for native CLI or operator runs where returned folders
may contain mixed zips: strict production canary evidence, handoff packets,
diagnostic bundles, unrelated zips, and malformed archives.

## Findings

- The watcher wraps the existing returned-inbox scanner instead of creating a
  second packet classifier.
- Candidate zip names stay hash-redacted by default.
- Output contains aggregate counts, folder basenames, status codes, and next
  actions only.
- It exits successfully while waiting for evidence, unless `--require-found` is
  set.
- With `--require-found`, it fails closed when no non-fixture production canary
  evidence is present.
- It rejects key-shaped secrets and private local paths before printing or
  writing output.

## Verification

The controller verified these paths:

- Static syntax checks for the watcher and touched release scripts passed.
- Default watcher fixture scan reported an awaiting-production-canary state.
- Mixed-folder watch reported handoff packets but no production canary evidence.
- Consumer install smoke included the watcher and verified npm pack coverage.
- Release readiness check included the watcher and passed.
- Local incoming-folder watch found no returned production canary evidence.

## Release Meaning

This improves supervision for incoming agent evidence. It does not count as a
production canary by itself and does not authorize public launch.

Public launch remains blocked until owner approval and one fresh real-container
production canary packet pass the strict returned-packet gate.
