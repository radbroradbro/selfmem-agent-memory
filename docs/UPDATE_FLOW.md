# Update Flow

RecallWeave updates are a product feature, not a per-person relay process.
The public update path is the `selfmem_update` command plus metrics-only
verification. It should work the same way for Hermes, OpenClaw, and future
adapter hosts that implement the runtime contract.

## Command

Dry-run an update before changing a runtime:

```bash
selfmem_update --host <hermes|openclaw> --home <agent-home> --repo <runtime-repo> --keys-file <private-keys-env>
```

Apply the update:

```bash
selfmem_update --host <hermes|openclaw> --home <agent-home> --repo <runtime-repo> --keys-file <private-keys-env> --apply
```

The updater preserves existing container mappings, installs the current adapter,
backs up the previous adapter directory, copies private key files with `0600`
permissions, and can run the strict canary path when requested.

## Verification

Run the fixture-safe smoke test:

```bash
npm run update:smoke
```

For a real runtime canary, the update flow should emit metrics-only evidence:

```bash
selfmem_update --host <host> --home <agent-home> --repo <runtime-repo> --keys-file <private-keys-env> --apply --run-canary --strict-real --canary-output <public-safe-json> --canary-intake-output <public-safe-intake-json>
```

Canary evidence must not include raw memories, raw transcripts, prompts,
answers, local private paths, environment files, browser state, or provider
keys. Fixture evidence is useful for regression testing, but it never proves a
production rollout.

## Release Gate

Before claiming production readiness, verify:

- `npm run update:smoke` passes,
- the Brain UI smoke and interaction checks pass,
- same-data benchmark gates for the claimed scope pass,
- metrics-only canary evidence is current,
- GitHub release state is synchronized without exposing private data,
- the public release checklist is complete.

This update flow replaces public relay instructions. Maintainer-local notes
can exist outside the repository, but the public repo should document reusable
commands and verifiable behavior.
