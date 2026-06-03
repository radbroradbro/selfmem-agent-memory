# Brain UI Lifecycle Policy Evidence

Date: 2026-05-22

Scope:

- `packages/brain-ui/fixtures/nucleus.fixture.json`
- `packages/brain-ui/src/model.js`
- `packages/brain-ui/src/index.html`
- `packages/brain-ui/src/app.js`
- `packages/brain-ui/src/styles.css`
- `packages/brain-ui/smoke.mjs`
- `packages/brain-ui/interaction-smoke.mjs`
- `docs/BRAIN_UI.md`
- `docs/PRODUCT_ROADMAP.md`

What changed:

- Added fixture lifecycle policy data for recall, write, Hermes, and OpenClaw lifecycle settings.
- Added a Brain UI Lifecycle Policy panel that stages policy choices as a JSON draft.
- Added `buildLifecyclePolicyDraft()` with numeric clamping, low-confidence action allow-listing, and public-safe exports.
- Kept the panel fixture-only and no-write. The draft marks `writesRealFiles: false`.

Browser evidence:

- DOM evidence: `reviews/overnight-20260522/ui-evidence/brain-ui-lifecycle-policy-dom-evidence.json`
- Screenshot: `reviews/overnight-20260522/ui-evidence/brain-ui-lifecycle-policy.png`

Observed evidence:

- Lifecycle Policy controls rendered.
- Staging recall every turn, max auto writes `8`, and low-confidence action `suppress` produced three changed fields.
- Draft mode was `fixture-lifecycle-policy-draft`.
- Draft `writesRealFiles` was `false`.
- Visible UI and draft export contained no private, key-shaped, or bearer-token text.
- Browser console had no messages.

Boundary:

This slice does not apply policy to Hermes, OpenClaw, or local config files. It only previews and exports a public-safe fixture draft.
