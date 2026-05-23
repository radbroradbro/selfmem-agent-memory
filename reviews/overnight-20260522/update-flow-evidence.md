# Update Flow Evidence

Date: 2026-05-22

Scope:

- Added a fixture-safe smoke test for `selfmem_update.py`.
- Added `bin/selfmem_update` as the user-facing command wrapper and package
  binary mapping.
- Exercised Hermes and OpenClaw updater paths in temporary runtime directories.
- Exercised updater-triggered canary report and intake generation against a
  fixture diagnostic export.
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
- `--run-canary --canary-output <path>` runs adapter smoke, writes a sanitized
  canary report, runs intake, and keeps fixture output from counting as real
  rollout evidence.
- `--canary-since <iso-timestamp>` is forwarded to the report generator and
  recorded in the summarized runtime report so a patched agent can collect a
  fresh window without old trace history poisoning strict intake.
- `--run-canary --strict-real` fails if no live container, diagnostic directory,
  or diagnostic zip is available. Adapter standalone smoke alone cannot satisfy
  strict-real rollout evidence.

Command:

```bash
pnpm update:smoke
```

Verification:

- `pnpm update:smoke`: passed for Hermes and OpenClaw fixture runtimes.
- `python3 -m py_compile packages/bench/update-flow-smoke.py plugins/selfmem-fallback/scripts/selfmem_update.py`: passed.
- `bin/selfmem_update --help`: covered by the release-readiness gate.
- `bin/selfmem_update --help`: now exposes `--run-canary`, `--canary-output`,
  `--canary-since`, `--canary-last-minutes`, `--strict-real`, and
  `--rollback-tested`.
- Strict-real missing-source guard: passed for Hermes and OpenClaw fixture
  runtimes.
- `pnpm smoke`: passed with update smoke included.
- `pnpm test`: 14 tests passed.
- `git diff --check`: passed.
- Public secret-pattern scan: no hits.
- Private-name scan: no hits.

Cold review:

- Earlier Gemini review returned `CLEAN` after a backup-collision observation
  was hardened. The updater allocates unique backup paths if multiple applies
  happen in the same second, and the smoke test verifies repeated apply
  behavior.
- Gemini later blocked the first `selfmem_update` wrapper because package-manager
  symlinks would break path resolution. The wrapper now resolves symlinks before
  locating the Python updater, and the release-readiness gate executes it through
  a temporary symlink.
- Final Gemini CLI review returned `CLEAN` for the command wrapper.
- Gemini strict-real source-guard review returned `CLEAN` after inspecting
  `selfmem_update.py`, `update-flow-smoke.py`, this guide surface, and canary
  intake behavior.

Known limits:

- This smoke proves updater mechanics and report generation, not live runtime
  health.
- Live agent rollout still requires one-agent canary evidence before broad
  installation.
