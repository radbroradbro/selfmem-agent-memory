# Brain UI Current-Head Live Evidence

Date: 2026-05-22

Scope:

- Fresh in-app browser render of the Brain UI on the current PR head.
- Local URL: `http://127.0.0.1:4187/`
- Head checked: `733c1e6e38a546e8e37b5ecffcfc262e9fae59da`
- GitHub Actions CI run already passing for that head: `26307824017`

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
- Public launch verdict remains `FAIL`: true
- Production-ready state remains false: true
- Browser console error or warning count: 0
- Private/key-shaped visible text hits: 0

Boundary:

- This is fixture-only browser evidence.
- It does not read local user memories, raw transcripts, private diagnostics,
  provider keys, or hosted Supermemory data.
- It strengthens the current-head UI evidence. It does not approve public
  launch or replace the blocked Claude review.
