# Dummy Brain Demo Storyboard

Status: public-safe demo plan. Use fixture data only.

## Goal

Show the RecallWeave Brain UI as an inspectable local memory control surface
without exposing any real memory, transcript, diagnostic, credential, agent log,
or private path.

## Setup

Use a clean checkout of PR #5.

```bash
npm exec --yes pnpm@10.23.0 -- install
npm exec --yes pnpm@10.23.0 -- brain:serve
```

Open:

```text
http://127.0.0.1:4177
```

## Recording Rules

- Record only bundled fixture data.
- Do not open local memory containers.
- Do not open raw logs, `.env` files, diagnostics zips, screenshots from real
  agents, hosted Supermemory dashboards, or private folders.
- Stop recording before running any command that might print local paths or
  credentials.

## Shot List

1. Open the fixture Brain UI and show the `fixture-safe evidence` badge.
2. Search for `native memory`.
3. Click the retrieval trace node and show provenance plus trace details.
4. Click the lifecycle event node and show the pre-compression checkpoint.
5. Click the editable native-memory plan.
6. Make a harmless fixture edit, save it, and show the Draft Export panel.
7. Open the Nucleus Snapshot panel and show `writesRealFiles: false`.
8. Open the Research Lineage panel and show query, hypothesis, and decision.
9. Open the Wiki Vault Preview and select the generated index or methodology
   page.
10. Open the Vault Sync Report and show dry-run writes plus conflict handling.
11. End with the release readiness note: fixture checks pass, but public launch
    still needs owner approval and final reviewer route acceptance.

## Voiceover Notes

- RecallWeave is local-first agent memory infrastructure.
- The UI is not a marketing page. It is an inspection and editing surface for
  memory-derived artifacts.
- The current demo is dummy-data-only because public evidence must not leak
  memory content.
- The Nucleus graph links memories, lifecycle events, retrieval traces, derived
  docs, and research decisions.
- The wiki layer compiles derived docs into Obsidian-compatible markdown while
  protecting reviewed pages from accidental overwrite.
- `selfmem_update` is dry-run-first so agents can test before changing a live
  Hermes or OpenClaw profile.

## Success Criteria

- The recording shows the full fixture flow in under three minutes.
- The recording contains no private text, tokens, raw memory, transcripts,
  diagnostics, private file paths, or real agent names.
- The final frame does not say production ready.

