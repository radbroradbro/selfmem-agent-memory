# Brain UI Dynamic Layout Evidence

Date: 2026-05-22

Scope: replace the hardcoded fixture graph coordinates with a deterministic
layout that derives node positions from the visible Nucleus nodes and edges.

## Implementation

- Added `buildGraphLayout()` to the Brain UI model.
- The layout ranks visible nodes from current graph edges and kind fallback
  order, then places them into bounded columns with vertical growth.
- The graph now stores `data-layout-mode`, `data-layout-columns`, and
  `data-layout-rows` for browser evidence.
- The default search input no longer pre-filters to `native memory`, so the
  first view shows the full fixture Nucleus graph.
- The graph panel now scrolls when the layout grows vertically.

## Browser Evidence

- Captured Codex Browser DOM evidence:
  `ui-evidence/brain-ui-dynamic-layout-evidence.json`.
- Captured fixture-only screenshot:
  `ui-evidence/brain-ui-dynamic-layout.png`.
- Browser evidence reports:
  - `layoutMode: dynamic-graph-layout`
  - `nodeCount: 9`
  - `edgeCount: 9`
  - `layoutColumns: 2`
  - `layoutRows: 5`
  - `overlapCount: 0`
  - `hasPrivateOrKeyText: false`
  - `consoleErrorCount: 0`

## Verification

- `node packages/brain-ui/smoke.mjs`: passed.
- `node packages/brain-ui/interaction-smoke.mjs`: passed and includes
  `dynamic-graph-layout`.

## Safety Boundary

- Evidence uses bundled fixture data only.
- No local memory containers, private agent logs, raw transcripts, credentials,
  or private paths are read.
- The screenshot and DOM evidence are public-safe fixture artifacts.
