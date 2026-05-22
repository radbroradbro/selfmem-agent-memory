# Compatibility Notes

RecallWeave is the public project name. "Canary" means a limited rollout test,
not the system name. The current Hermes and OpenClaw adapter id remains
`selfmem_canary` only so existing installs and setup scripts keep working.

## Runtime Ids

| Surface | Current id | Reason |
|---|---|---|
| Hermes memory provider | `selfmem_canary` | Existing profile configs use this provider name. |
| OpenClaw memory slot | `selfmem_canary` | Existing slot configs use this plugin id. |
| Tool aliases | `selfmem_*`, `supermemory_*` | The `supermemory_*` aliases help migration from hosted Supermemory. |
| Package name | `recallweave` | Public project name. |
| Core package | `@recallweave/core` | Public package name for shared TypeScript utilities. |

## Migration Direction

A later release may add `recallweave` as a first-class runtime id. That release
should keep `selfmem_canary` as a compatibility alias and provide a migration
command that updates configs without changing container mappings.

New docs, UI labels, and examples should say RecallWeave unless they are
showing an exact compatibility id that must be pasted into an existing runtime
config.

## Supermemory Bridge

The bridge is read-through by default:

- local RecallWeave writes remain local,
- hosted Supermemory can be searched when configured,
- cached Supermemory exports can be searched when hosted quota is unavailable,
- automatic hosted write-back stays off until a dry-run sync report proves it is
  safe.

## Agent Identity

Each runtime should pin an agent identity and container mapping. If an identity
cannot be resolved, the adapter should fail closed or run read-only rather than
writing to an `unknown-agent` bucket.
