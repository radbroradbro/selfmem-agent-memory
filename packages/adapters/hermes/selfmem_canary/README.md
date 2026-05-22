# selfmem_canary Hermes Provider

This package is a Hermes `MemoryProvider` for RecallWeave. The package name keeps `selfmem_canary` for compatibility with the current setup scripts.

It writes to `$HERMES_HOME/selfmem_canary/`, exposes `selfmem_*` tools, redacts private/key-shaped content before storage, and records a JSONL trace for review.

After the import/lifecycle report passes and the active config has been snapshotted, set it as the live Hermes provider with `memory.provider: selfmem_canary`.
