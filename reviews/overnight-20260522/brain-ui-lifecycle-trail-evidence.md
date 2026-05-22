# Brain UI Lifecycle Trail Browser Evidence

Date: 2026-05-22

Scope:

- Fresh in-app browser render of the Brain UI lifecycle trail on the current PR
  head.
- Local URL: `http://127.0.0.1:4189/`
- Head checked: `8777290169f598ff9172e889e927858b3956f764`
- GitHub Actions CI run already passing for that head: `26316074705`

Evidence:

- Screenshot: `ui-evidence/brain-ui-lifecycle-trail.png`
- Browser evidence JSON:
  `ui-evidence/brain-ui-lifecycle-trail-evidence.json`
- Page title: `RecallWeave Brain`
- Visible selected node: `RecallWeave Index`
- Screenshot size: 1280 by 1223 pixels

Checks:

- Lifecycle Trail visible: true
- Lifecycle event card visible: true
- Retrieval trace card visible: true
- `on_pre_compress` fixture event visible: true
- Fixture-only mode: true
- Browser console error or warning count: 0
- Private/key-shaped visible text hits: 0

Boundary:

- This is fixture-only browser evidence.
- It does not read local user memories, raw transcripts, private diagnostics,
  provider keys, or hosted Supermemory data.
- It strengthens the current-head UI evidence. It does not approve public
  launch or complete the native goal.
