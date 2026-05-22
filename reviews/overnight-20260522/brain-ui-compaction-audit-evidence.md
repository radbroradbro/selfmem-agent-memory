# Brain UI Compaction Audit Evidence

Date: 2026-05-22

Scope:

- Added a fixture-only Compaction Audit panel to the Brain UI.
- The panel renders local session compaction audit metrics, kind counts,
  chronology, privacy status, and candidate fingerprints.
- The rendered packet uses `mode: fixture-local-session-compaction-audit`,
  `metricsOnly: true`, and `writesRealFiles: false`.

Public-safety boundary:

- The panel uses bundled fixture metrics only.
- It does not read local memory containers, raw session histories, raw
  transcripts, diagnostics, auth files, provider keys, hosted Supermemory
  contents, or real agent paths.
- It does not display candidate memory text, raw session text, or exact private
  source text.
- It does not write files, mutate memory, sync a vault, or update any hosted
  service.

Verification expectations:

- Brain UI smoke sees the Compaction Audit panel, builder, fixture endpoint,
  and current source wiring.
- Interaction smoke proves the model export is metrics-only, has zero privacy
  leaks, preserves chronological output, and does not include candidate text.
- Browser evidence shows 6 fixture input events, 4 candidate fingerprints, 2
  redactions, chronological output, 1 exact-identifier candidate, zero privacy
  leaks, zero console errors, and no private/key-shaped visible text.

Verification:

- `node packages/brain-ui/smoke.mjs`: passed.
- `node packages/brain-ui/interaction-smoke.mjs`: passed.
- Codex Browser opened `http://127.0.0.1:4177` with fixture data and captured
  DOM evidence.
- Headless Chrome captured a fixture-only screenshot that shows the Compaction
  Audit panel.
- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-compaction-audit.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-compaction-audit-evidence.json`.

Known limits:

- This is still fixture mode. Live local-session compaction for real Codex,
  Claude, Hermes, or OpenClaw exports must run outside public artifacts and
  publish only metrics, fingerprints, and privacy status.
