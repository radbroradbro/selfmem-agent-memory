# Research Seeds

These public sources should seed the overnight research-lineage graph. They are
not final authority; source-lock scouts must verify current commits, licenses,
and exact implementation details before code copies or compatibility claims.

## Agent Brain Projects

- GBrain: https://github.com/garrytan/gbrain
  - Useful areas to inspect: markdown brain repo, typed graph links, hybrid
    retrieval, eval replay, MCP server, skillpacks, doctor/remediation cycle,
    and sleep/dream maintenance jobs.
  - Initial use: compare patterns, do not copy code without license and
    attribution review.

## Hermes Memory And Wiki Surfaces

- Hermes memory architecture article:
  https://hermes-agent.ai/blog/hermes-agent-memory-system
- Hermes Obsidian memory keep-alive page:
  https://hermes-agent.ai/tools/hermes-obsidian-plugin
- Hermes plugin docs:
  https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins

Initial use: treat Hermes as a native lifecycle host. RecallWeave should plug
into provider hooks, memory-write hooks, pre-compression boundaries, and
sleep/compression cycles instead of replacing the runtime.

## Papers And Patterns

- PlugMem: https://arxiv.org/abs/2603.03296
- WiCER: https://arxiv.org/abs/2605.07068
- Memory Sandbox: https://arxiv.org/abs/2308.01542

Initial use:

- PlugMem informs compact task-agnostic memory modules.
- WiCER informs compile/evaluate/refine loops for LLM-wiki memory.
- Memory Sandbox informs editable transparent memory UI.

## Research Questions

- Should RecallWeave bridge to GBrain-like markdown brain repos, import/export
  them, or only borrow design patterns?
- Which lifecycle events should emit Nucleus edges by default?
- Which research-lineage nodes should be visible in the first self-hosted UI?
- Which local embedding path is useful on Bradley's Mac while remaining
  optional and not the default?
- How should UI evidence become a traceable hypothesis/test/decision record?
