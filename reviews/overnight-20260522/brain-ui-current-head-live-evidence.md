# Brain UI Current-Head Live Evidence

## 2026-06-01 Refresh

Scope:

- Fresh in-app browser render of the Brain UI on the current PR head after the
  tolerant method-ladder release-gate alignment.
- Local URL: `http://127.0.0.1:4189/`
- Head checked: `5e55cb8b7231be4c43e7ba514c76a03722546304`
- Browser flow: load self-hosted Brain UI, search `native memory`, select the
  retrieval trace fixture node, and inspect lifecycle trail, Nucleus snapshot,
  research lineage, source lock, container health, and update flow.

Evidence:

- Screenshot:
  `ui-evidence/brain-ui-20260601-current-head-filtered-retrieval.jpg`
- Browser evidence JSON:
  `ui-evidence/brain-ui-20260601-current-head-browser-evidence.json`
- Page title: `RecallWeave Brain`
- Screenshot size: 1280 by 720 pixels

Checks:

- Container health visible as `healthy-fixture`: true
- Search filtered graph visible: true
- Retrieval trace selected: true
- Lifecycle trail visible: true
- Nucleus snapshot fixture export visible with `writesRealFiles: false`: true
- Research lineage visible: true
- Research source lock visible: true
- Wiki/vault compile status visible as `12 files compiled. Lint clean.`: true
- Update flow visible with pull, doctor, smoke, and PR steps: true
- Browser console error count: 0
- Private/key-shaped visible text hits: 0
- Private path visible text hits: 0

Boundary:

- This is fixture-only browser evidence from the self-hosted local Brain UI.
- It does not read local user memories, raw transcripts, private diagnostics,
  provider keys, or hosted Supermemory data.
- It strengthens current-head UI evidence but still does not approve public
  launch, prove SOTA memory performance, or replace owner approval.

## 2026-05-31 Refresh

Date: 2026-05-31

Scope:

- Fresh in-app browser render of the Brain UI on the current PR head.
- Local URL: `http://127.0.0.1:4189/`
- Head checked: `8ad7728d31d6b66cbd325b69ecedd49ede45e0cb`
- Local release gate was rerun after the provider-arm watchdog update and
  passed before this browser refresh.

Evidence:

- Screenshot: `ui-evidence/brain-ui-current-head-live.png`
- Browser evidence JSON:
  `ui-evidence/brain-ui-current-head-live-evidence.json`
- Page title: `RecallWeave Brain`
- Visible primary panel: `Nucleus`
- Screenshot size: 1280 by 1223 pixels

Checks:

- Nucleus graph visible: true
- Wiki vault and sync surfaces visible: true
- Model Matrix visible: true
- Context Preview visible: true
- Release Readiness visible: true
- Compaction Audit visible: true
- Benchmark Dashboard visible: true
- Canary Rollout visible: true
- Research Source Lock visible: true
- Lifecycle Trail visible: true
- Lifecycle Event card visible: true
- Retrieval Trace card visible: true
- `on_pre_compress` fixture event visible: true
- Public launch verdict remains `FAIL`: true
- Production-ready state remains false: true
- Browser console error or warning count: 0
- Private/key-shaped visible text hits: 0

Boundary:

- This is fixture-only browser evidence from the self-hosted local Brain UI.
- It does not read local user memories, raw transcripts, private diagnostics,
  provider keys, or hosted Supermemory data.
- It strengthens the current-head UI evidence. It does not approve public
  launch, prove SOTA memory performance, or replace owner approval.
