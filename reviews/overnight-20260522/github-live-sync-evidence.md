# GitHub Live Sync Evidence

Date: 2026-05-23

- PR #5 and issue #6 were refreshed from checked-in public-safe drafts after
  hosted-baseline run orchestration reached green CI.
- PR #5 was refreshed again after live hosted prep evidence added the
  duplicate-query gate and public-safe 8-query prep report.
- PR #5 was refreshed again after `aeaa5aa` passed CI and became the latest
  verified hosted-baseline live-prep hardening baseline.
- PR #5 was refreshed again after the live Codex-local hosted baseline run
  completed as metrics-only evidence with public benchmark claims still blocked.
- PR #5 was refreshed again after `15e6657` passed CI and became the latest
  verified code/product baseline for the live hosted-vs-local Codex follow-up.
- PR #5 and issue #6 were refreshed again after adding the baseline
  source-alignment gate and current OpenClaw label-aligned/content-divergent
  evidence.
- PR #5 and issue #6 were refreshed again after source-match and
  source-alignment were wired into the operator packet, next-run planner, and
  one-command baseline runner before hosted collection.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26334827218` passed on `fc76077`.
- PR #5 and issue #6 were refreshed again after source-match private-path
  redaction evidence was added to the public-safe drafts.
- PR #5 and issue #6 were refreshed again after `a56449d` passed CI and became
  the latest verified code/product baseline.
- PR #5 was refreshed again after the source-matched budgeted live canary
  evidence was added to the public-safe draft.
- PR #5 was refreshed again after the source-matched budgeted live canary
  collected two independent reviewer approvals and moved to owner-review state.
- PR #5 and issue #6 were refreshed again after postwatch real-diagnostics
  triage selected the current OpenClaw one-agent handoff packet.
- PR #5 and issue #6 were refreshed again after the returned canary workspace
  helper added markdown and JSON intake generation for the selected agent
  packet.
- PR #5 and issue #6 were refreshed again after `daac851` passed CI as the
  latest verified code/product baseline and the PR branch was fast-forwarded to
  that head.
- PR #5 and issue #6 were refreshed again after adding
  `canary:returned-downloads`, the standard Downloads and Telegram Desktop
  returned-packet scanner, plus metrics-only markdown findings for the
  next-agent workspace.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26343015277` passed on `13cac9a` and the release-state baseline was
  promoted.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26343998064` passed on `4310e0e` and the release-state baseline was
  promoted.
- PR #5 and issue #6 were refreshed again after the current OpenClaw
  one-agent handoff packet was regenerated with the deterministic drill step in
  the main next-agent plan.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26344382488` passed on `67993f1` and the release-state baseline was
  promoted.
- PR #5 and issue #6 were refreshed again after adding the public benchmark
  target lane for quota-locked Supermemory accounts.
- PR #5 and issue #6 were refreshed again after clarifying that public memory
  claims must use the same benchmark data, revision, split, labels, judge
  model, answer model, judge rule, and scoring setup as the target row, while
  MTEB/MMTEB/BEIR/MIRACL/MS MARCO and reranker leaderboards remain component
  evidence for model-arm selection.
- PR #5 and issue #6 were refreshed again after adding
  `benchmark:public-target`, the metrics-only source-locked target validator
  for public benchmark canaries.
- PR #5 and issue #6 were refreshed again after enforcing same judge model and
  same answer model in `benchmark:public-target`.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26345383489` passed on `90b6bc9` and the release-state baseline was
  promoted.
- PR #5 and issue #6 were refreshed again after regenerating the current
  OpenClaw next-agent handoff packet in the standard Downloads location.
- PR #5 and issue #6 were refreshed again after adding
  `benchmark:public-target:author`, source-lock attestations, and the stricter
  public canary validator.
- PR #5 and issue #6 were refreshed again after adding the current MemoryBench
  source lock, optional checkout hash verification, and machine-readable
  source-lock evidence for `locomo`, `longmemeval`, and `convomem`.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26346310930` passed on `9de4ebd` and the release-state baseline was
  promoted.
- PR #5 and issue #6 were refreshed again after adding the public
  LongMemEval-S slice manifest and the focused Codex slice review.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26346613433` passed on `8eb69e8` and the release-state baseline was
  promoted.
- PR #5 and issue #6 were refreshed again after adding the real
  LongMemEval-S run-only target, `--strict-run` validation, and focused Codex
  review evidence.
- GitHub Actions run `26346952139` passed on `9a11452` after the
  LongMemEval-S run-only target and sync evidence refresh.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26351957568` passed on `8aa9826`, the release-state baseline was promoted,
  and the current OpenClaw one-agent handoff packet was regenerated with an
  expected adapter commit.
- PR #5 and issue #6 were refreshed again after binding the one-agent canary
  packet commands to the approved adapter commit and regenerating the handoff
  packet with concrete collection commands.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26353888297` passed on `18d606a`, the release-state baseline was promoted,
  the provider-backed benchmark gate added single-provider Voyage and NVIDIA
  live preflight reports, and the OpenClaw one-agent handoff packet was
  regenerated for that expected adapter commit.
- PR #5 and issue #6 were refreshed again after clarifying the next-agent
  packet commit contract: the packet is generated from controller commit
  `67c0944`, while the approved adapter/report commit remains `18d606a`.
- PR #5 and issue #6 were refreshed again after splitting the release state
  into latest verified PR branch head `106b78c` and approved runtime canary
  adapter/report commit `18d606a`.
- PR #5 was refreshed again after the standard inbox scan was rerun and still
  found 0 production evidence packets, then the top-level Downloads handoff
  surface was reduced to the single current `SEND-THIS-ONE` packet.
- PR #5 was refreshed again after adding hash-only triage summaries for
  unknown and unreadable returned zips.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26354982486` passed on `cb40732`, making the latest verified PR branch head
  the returned canary triage and unreadable-zip sanitization commit while
  preserving `18d606a` as the approved runtime canary adapter/report commit.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26355118094` passed on `8b6f9bd`, promoting the returned canary triage
  evidence head while preserving `18d606a` as the approved runtime canary
  adapter/report commit.
- PR #5 and issue #6 were refreshed again after adding benchmark gate contract
  enforcement so provider gates reject solo provider-arm runs and hybrid gates
  reject runs without the `bm25-lite` control.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26355558402` passed on `c2b72f2`, promoting the benchmark gate contract
  commit as the latest verified PR branch head while preserving `18d606a` as
  the approved runtime canary adapter/report commit.
- PR #5 and issue #6 were refreshed again after adding private provider
  key-file env support for same-data provider benchmark runs. The refresh kept
  the body text public-safe and recorded only hashes, booleans, lengths, and
  timestamps.
- PR #5 and issue #6 were refreshed again after GitHub Actions run
  `26365847461` passed on `6ac6dd8`, promoting the native/default memory
  evidence hardening and refreshed one-agent handoff packet as the latest
  verified PR branch head while preserving `18d606a` as the approved runtime
  canary adapter/report commit.
- PR #5 and issue #6 were refreshed again after adding the live Voyage
  provider canaries for the 6-query and 30-query public LongMemEval-S targets.
  The refresh kept the body text public-safe and preserved the rule that this
  is retrieval-proxy canary evidence, not MemoryBench answer-quality proof.
- PR #5 and issue #6 were refreshed again after adding the latency-sensitive
  Voyage provider canary for the 30-query public LongMemEval-S target,
  including the `cloud-voyage4-lite-voyage-lite` arm. The refresh kept the
  body text public-safe and preserved the rule that this is retrieval-proxy
  canary evidence, not MemoryBench answer-quality proof.
- PR #5 and issue #6 were refreshed again after promoting CI-passed commit
  `2bb8b6b3` as the latest verified branch head while preserving `18d606a` as
  the approved runtime canary adapter/report commit.
- PR #5 and issue #6 were refreshed again after renaming the current
  OpenClaw one-agent handoff packet to the clearly marked
  `SEND-THIS-ONE` packet while preserving `18d606a` as the approved runtime
  canary adapter/report commit.
- PR #5 was refreshed again after the standard inbox scan evidence was updated
  to match the cleaned top-level Downloads surface: 0 production evidence
  packets, 1 current handoff packet, 8 diagnostics, 19 unknown packets, and 5
  unreadable packets.
- PR #5 and issue #6 were refreshed again after recording live local Apple
  Qwen3 0.6B and 4B provider runs, promoting `6c72c194` as the latest verified
  code/product baseline while preserving `18d606a` as the approved runtime
  canary adapter/report commit.
- PR #5 and issue #6 match the checked-in public-safe drafts after refresh.
- PR body refreshed at: 2026-05-25T00:37:13Z
- Note: GitHub PR `updated_at` can advance after branch pushes even when the
  body hash still matches this checked-in draft.
- Issue updated at: 2026-05-25T00:37:15Z
- PR body hash: 3d2695e066e6a639b39ebcfde9bc1621902bef70c7b9a17687c405ceea1702d5
- Issue title hash: e093f2ff3b75bc8883b03105411e42498d5eb5a4231b369634a83fddecc3fa3c
- Issue body hash: c27eb9b49893e458fc0fed7cf1e2b726bfdc7683a01aa7a7c7e0eee0cdcb04d7

No credentials, raw memories, transcripts, private local paths, or diagnostic contents were printed or committed.
