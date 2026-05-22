# selfmem fallback scripts

Generic setup and update helpers for selfmem agent runtimes. Keep credentials local on the agent machine.

- `setup-agent-memory.py` creates a local container mapping for Hermes or OpenClaw.
- `selfmem_update.py` performs an in-place dry-run by default and requires `--apply` before copying files.
- `doctor.mjs` checks local scaffold health without printing secrets.
- `supermemory-export.mjs` is for controlled export workflows and must not be used to commit memory data.
