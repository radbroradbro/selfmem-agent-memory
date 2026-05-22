# Brain UI Context Preview Evidence

Date: 2026-05-22

Scope:

- Added a fixture-only Context Preview panel to the Brain UI.
- The panel renders the prompt-time recall packet that would be injected after
  hybrid search and reranking.
- The rendered packet uses `mode: fixture-prompt-context-preview` and
  `writesRealFiles: false`.

Public-safety boundary:

- The panel uses bundled fixture data only.
- It does not read local memory containers, raw transcripts, diagnostics,
  auth files, provider keys, hosted Supermemory contents, or real agent paths.
- It shows public fixture context text, selected memory metadata, omitted
  candidate reasons, token budget, read-only hosted status, local-only write
  mode, and safety counters.
- It does not write files, mutate memory, sync a vault, or update any hosted
  service.

Verification expectations:

- Brain UI smoke sees the Context Preview panel, builder, fixture endpoint,
  and current source wiring.
- Interaction smoke proves the model export is fixture-only, uses local-only
  write mode, treats hosted read-through as read-only, has zero privacy leaks,
  and includes the compiled recall packet.
- Browser evidence shows 642 of 900 context tokens used, 258 tokens remaining,
  3 selected memories, 3 context sections, 2 omitted candidates, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text.

Verification:

- `node packages/brain-ui/smoke.mjs`: passed.
- `node packages/brain-ui/interaction-smoke.mjs`: passed.
- Codex Browser opened `http://127.0.0.1:4177` with fixture data and captured
  DOM evidence.
- Headless Chrome captured a fixture-only screenshot that shows the Context
  Preview panel.
- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-context-preview.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-context-preview-evidence.json`.

Known limits:

- This is still fixture mode. A live prompt-context preview for real Codex,
  Claude, Hermes, or OpenClaw containers must publish only redacted context,
  public-safe metadata, budget counts, citations, and privacy status.
