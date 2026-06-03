# Brain UI Graph Navigation Evidence

Date: 2026-05-22

Scope: add large-graph navigation controls to the fixture Brain UI without
reading or writing real local memories.

## Implementation

- Added graph scope controls for `all` and `neighborhood`.
- Added a jump-to-node select populated from the current filtered graph.
- Added a center-selected action that scrolls the selected node into view.
- Added public-safe graph navigation summary data.
- Added model coverage for neighborhood scoping and navigation metadata.

## Browser Evidence

- Captured Codex Browser DOM evidence:
  `ui-evidence/brain-ui-graph-navigation-evidence.json`.
- Captured fixture-only screenshot:
  `ui-evidence/brain-ui-graph-navigation.png`.
- Browser evidence reports:
  - `mode: fixture-graph-navigation-controls`
  - `writesRealFiles: false`
  - `scope: neighborhood`
  - `visibleNodeCount: 3`
  - `jumpOptions: 9`
  - `selectedVisible: true`
  - `activeNeighborhood: true`
  - `hasPrivateOrKeyText: false`
  - `consoleErrorCount: 0`

## Verification

- `node packages/brain-ui/smoke.mjs`: passed and includes
  `graph-navigation-controls`.
- `node packages/brain-ui/interaction-smoke.mjs`: passed and includes
  `graph-navigation-controls`.

## Safety Boundary

- Evidence uses bundled fixture data only.
- The controls do not read real local containers.
- The controls do not write files.
- No local memory containers, private agent logs, raw transcripts, credentials,
  or private paths are read.
