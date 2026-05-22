# RecallWeave Brain UI

Fixture-safe local UI for reviewing the Nucleus Index, LLM-wiki editing flow,
retrieval traces, lifecycle events, and research lineage.

Run it from the repo root:

```bash
pnpm brain:serve
```

Then open:

```text
http://127.0.0.1:4177
```

The app uses `fixtures/nucleus.fixture.json` by default. It does not read local
memories, raw transcripts, diagnostics, credentials, or private agent logs unless
the selected-container audit route is explicitly enabled.

The Container panel is fixture-only. It shows fake local and hosted read-through
labels, provider mode, local-only write mode, lifecycle/retrieval counts,
privacy leak count, redaction count, and duplicate-cluster count.

## Review Flow

Use this flow for browser or computer-use evidence:

1. Launch the UI.
2. Search for `native memory`.
3. Check the Container panel reports `healthy-fixture` and `local-only`.
4. Open the retrieval trace node.
5. Open the derived doc node.
6. Edit the derived doc text.
7. Save the fixture edit.
8. Inspect provenance and the timeline.
9. Inspect the Local Audit Preflight panel.
10. Optional: start with `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_AUDIT=1`, run a
    selected-container audit, and confirm the visible path is redacted.
11. Optional: start with `RECALLWEAVE_BRAIN_UI_ENABLE_LOCAL_EDIT=1`, apply a
    selected local memory edit overlay in a throwaway fixture, and confirm the
    response and audit trail are content-free.
12. Capture only sanitized screenshots or recordings.

## Current Scope

This is a scaffold, not the final app. It proves the product surface and visual
review loop before direct in-place memory editing. Selected local audits are
read-only and return counts, reasons, and redacted path labels only. Selected
local memory edits write append-only overlays under `.recallweave/` and never
rewrite `memories.jsonl` directly.
