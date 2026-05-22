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

The app uses `fixtures/nucleus.fixture.json`. It does not read local memories,
raw transcripts, diagnostics, credentials, or private agent logs.

## Review Flow

Use this flow for browser or computer-use evidence:

1. Launch the UI.
2. Search for `native memory`.
3. Open the retrieval trace node.
4. Open the derived doc node.
5. Edit the derived doc text.
6. Save the fixture edit.
7. Inspect provenance and the timeline.
8. Capture only sanitized screenshots or recordings.

## Current Scope

This is a scaffold, not the final app. It proves the product surface and visual
review loop before wiring real local containers.
