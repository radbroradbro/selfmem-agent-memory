# Clean Consumer Smoke Evidence

Date: 2026-05-22

Scope:

- Fresh temporary checkout built from the public tracked file set.
- Consumer-visible updater, Brain UI, local-container audit, local-session
  compaction audit, and package dry-run behavior.
- No private memories, credentials, local paths, or diagnostics.

Result:

- Mode: `clean-consumer-smoke`
- Writes real files: false
- Temporary checkout files: 425
- Required npm package files present: true
- Forbidden runtime files: 0
- Secret/key-shaped hits: 0

Commands proven inside the clean checkout:

- `selfmem_update --help`
- `python3 packages/bench/update-flow-smoke.py`
- `node packages/brain-ui/smoke.mjs`
- `node packages/brain-ui/interaction-smoke.mjs`
- `node packages/bench/local-container-audit-smoke.mjs`
- `node packages/bench/session-compaction-local-audit.mjs --strict`
- `node packages/bench/canary-report-from-trace.mjs --fixture`
- `node packages/bench/canary-report-from-trace.mjs --diagnostic-dir packages/bench/fixtures/canary-diagnostic-export.fixture`
- `node packages/bench/canary-evidence-intake.mjs`
- `node packages/bench/canary-remediation.mjs`
- `node packages/bench/canary-operator-packet.mjs --host hermes`
- `node packages/bench/canary-evidence-packet.mjs`
- `node packages/bench/canary-evidence-packet-review.mjs`
- `node packages/bench/hosted-baseline-collector.mjs --fixture`
- `node packages/bench/recallweave-response-export.mjs --fixture`
- `node packages/bench/recallweave-baseline-collector.mjs --fixture`
- `node packages/bench/baseline-comparison.mjs --fixture`
- `node packages/bench/hosted-baseline-operator-packet.mjs`
- `node packages/bench/baseline-evidence-packet.mjs`
- `npm pack --dry-run --json`

Required package entries verified:

- `package.json`
- `bin/selfmem_update`
- `README.md`
- `docs/USER_MANUAL.md`
- `docs/BRAIN_UI.md`
- `docs/MODEL_MATRIX.md`
- `packages/core/dist/index.js`
- `packages/brain-ui/src/index.html`
- `packages/brain-ui/fixtures/model-matrix.json`
- `packages/bench/canary-evidence-packet.mjs`
- `packages/bench/canary-evidence-packet-review.mjs`
- `packages/bench/baseline-evidence-packet.mjs`
- `plugins/selfmem-fallback/scripts/selfmem_update.py`

Notes:

- This does not claim production launch readiness. It proves that a clean
  consumer-style copy has the updater, built core runtime, Brain UI fixtures,
  model-matrix visibility, hosted-baseline packet tooling, and local audit
  tooling needed for a public alpha user or agent to start without relying on
  the developer worktree.
- Latest smoke also verified the canary evidence packet review command in a
  clean consumer-style copy. The clean checkout had 428 files, npm dry-run pack
  had 424 files, forbidden runtime files were 0, and secret hits were 0.
- The release gate now reruns this smoke directly.
