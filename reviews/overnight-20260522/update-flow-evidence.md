# Update Flow Evidence

Date: 2026-05-22

Scope:

- Added a fixture-safe smoke test for `selfmem_update.py`.
- Exercised Hermes and OpenClaw updater paths in temporary runtime directories.
- Verified dry-run and apply behavior without touching real agent homes.

Public-safety boundary:

- Uses temporary directories only.
- Uses a fake non-secret `RECALLWEAVE_FIXTURE_KEY=fixture` file.
- Does not read or write real Hermes, OpenClaw, Supermemory, Voyage, or local
  agent memory state.

Verification expectations:

- Dry-run reports planned key and adapter steps without copying files.
- Apply copies adapter files into fake runtime plugin paths.
- Apply moves existing adapter directories to backup paths.
- Repeated apply creates unique backup paths instead of colliding on timestamp.
- Apply preserves local container mapping reports.
- Apply copies local key files with `0600`.
- OpenClaw apply installs the audit helper by default.

Command:

```bash
pnpm update:smoke
```

Verification:

- `pnpm update:smoke`: passed for Hermes and OpenClaw fixture runtimes.
- `python3 -m py_compile packages/bench/update-flow-smoke.py plugins/selfmem-fallback/scripts/selfmem_update.py`: passed.
- `pnpm smoke`: passed with update smoke included.
- `pnpm test`: 14 tests passed.
- `git diff --check`: passed.
- Public secret-pattern scan: no hits.
- Private-name scan: no hits.

Cold review:

- Gemini CLI returned `CLEAN`.
- A minor backup-collision observation was hardened before commit. The updater
  now allocates unique backup paths if multiple applies happen in the same
  second, and the smoke test verifies repeated apply behavior.

Known limits:

- This smoke proves updater mechanics, not live runtime health.
- Live agent rollout still requires one-agent canary evidence before broad
  installation.
