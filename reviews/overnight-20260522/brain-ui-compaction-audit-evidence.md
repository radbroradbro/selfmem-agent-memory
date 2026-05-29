# Brain UI Compaction Audit Evidence

Date: 2026-05-22, refreshed 2026-05-29

Scope:

- Added a fixture-only Compaction Audit panel to the Brain UI.
- The panel renders local session compaction audit metrics, kind counts,
  chronology, privacy status, candidate fingerprints, and session-map
  lifecycle/topic telemetry.
- The rendered packet uses `mode: fixture-local-session-compaction-audit`,
  `metricsOnly: true`, and `writesRealFiles: false`.

Public-safety boundary:

- The panel uses bundled fixture metrics only.
- It does not read local memory containers, raw session histories, raw
  transcripts, diagnostics, auth files, provider keys, hosted Supermemory
  contents, or real agent paths.
- It does not display candidate memory text, raw session text, or exact private
  source text.
- Session-map rows expose only hashed topic fingerprints, phase counts, and
  metrics-only waste signals.
- It does not write files, mutate memory, sync a vault, or update any hosted
  service.

Verification expectations:

- Brain UI smoke sees the Compaction Audit panel, builder, fixture endpoint,
  and current source wiring.
- Interaction smoke proves the model export is metrics-only, has zero privacy
  leaks, preserves chronological output, carries session-map lifecycle/topic
  counters, and does not include candidate text.
- Browser evidence shows 6 fixture input events, 4 candidate fingerprints, 2
  redactions, chronological output, 1 exact-identifier candidate, zero privacy
  leaks, 4 topic links, 6 lifecycle events, 0 unlinked candidates, zero console
  errors, and no private/key-shaped visible text.

Verification:

- `node packages/brain-ui/smoke.mjs`: passed.
- `node packages/brain-ui/interaction-smoke.mjs`: passed.
- Headless Chrome opened `http://127.0.0.1:4189` with fixture data and
  refreshed DOM evidence after the session-map telemetry contract landed.
- Headless Chrome captured a fixture-only screenshot that shows the Compaction
  Audit panel. The in-app browser bridge was unavailable in this resumed
  context, so this refresh uses the headless capture path.
- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-compaction-audit.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-compaction-audit-evidence.json`.

Known limits:

- This is still fixture mode. Live local-session compaction for real Codex,
  Claude, Hermes, or OpenClaw exports must run outside public artifacts and
  publish only metrics, fingerprints, and privacy status.
