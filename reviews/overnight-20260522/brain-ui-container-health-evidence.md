# Brain UI Container Health Evidence

Date: 2026-05-22

Scope:

- Added a fixture-only Container panel to the Brain UI.
- The panel shows the agent label, local container, hosted read-through label,
  provider mode, write mode, lifecycle event count, retrieval trace count,
  privacy leak count, redaction count, and duplicate-cluster count.
- Added `buildContainerHealth()` to the shared Brain UI model so the rendered UI
  and interaction smoke use the same sanitized derived data.

Public-safety boundary:

- The panel uses bundled fixture data only.
- It does not read local memory containers, raw transcripts, diagnostics,
  credentials, private agent paths, real provider keys, or hosted Supermemory
  contents.
- The hosted container value is a fake read-through fixture label. It proves the
  UI affordance without exposing any real account or container name.
- The panel is inspect-only. It does not write files, mutate local memory, sync
  a vault, or call a provider.

Verification:

- `pnpm brain:smoke`: passed.
- `pnpm brain:interaction`: passed and now checks `container-health`.
- Chrome DevTools evidence was attempted through the local plugin. The first
  attempt was blocked because no debug Chrome was listening on port 9222. A
  temporary isolated Chrome profile was then launched for fixture-only capture.
- Browser DOM evidence shows:
  - `healthy-fixture`,
  - `recallweave_fixture_local`,
  - `fixture_supermemory_readonly`,
  - `voyage-4-large plus rerank-2.5 plus hosted read-through`,
  - `local-only`,
  - leak count `0`,
  - redaction count `1`,
  - retrieval trace visibility,
  - no visible private/key-shaped text.
- Browser console evidence: no console messages.

Artifacts:

- Screenshot:
  `reviews/overnight-20260522/ui-evidence/brain-ui-container-health.png`.
- DOM evidence:
  `reviews/overnight-20260522/ui-evidence/brain-ui-container-health-dom-evidence.json`.

Known limits:

- This is still fixture mode. Real local-container health needs a separate
  security-reviewed reader, redacted path display, explicit container picker,
  and a local audit trail before it can touch real agent state.
