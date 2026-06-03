# Brain UI Research Lineage Evidence

Date: 2026-05-22

Scope:

- Added a fixture-only Research Lineage panel to the Brain UI.
- The panel renders the public fixture query, connected hypothesis, and
  connected decision trail from the Nucleus graph.
- The lineage packet uses `mode: fixture-research-lineage` and
  `writesRealFiles: false`.

Public-safety boundary:

- The panel uses bundled fixture graph data only.
- It does not read local memory containers, raw transcripts, diagnostics, auth
  files, provider keys, hosted Supermemory contents, or real agent paths.
- It does not write files, mutate memory, sync a vault, or update any hosted
  service.

Verification expectations:

- Brain UI smoke sees the Research Lineage panel, builder, and CSS.
- Browser evidence shows a query, hypothesis, and decision trail.
- Browser evidence shows `fixture-research-lineage`.
- Browser evidence shows `writesRealFiles: false`.
- Visible browser text contains no private-tag content or common key shapes.

Verification:

- `pnpm brain:smoke`: passed.
- Chromium opened `http://127.0.0.1:4177` with fixture data and captured DOM
  evidence plus a screenshot.
- Browser DOM evidence shows one lineage card, three lineage steps, query,
  hypothesis, decision coverage, zero console warnings or errors, and no visible
  private/key-shaped text.
- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-research-lineage.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-research-lineage-dom-evidence.json`.

Known limits:

- This is still fixture mode. Live research lineage needs source-lock import,
  local-only redaction review, reviewer attribution, and explicit user consent
  before connecting real research notes or memory containers.

