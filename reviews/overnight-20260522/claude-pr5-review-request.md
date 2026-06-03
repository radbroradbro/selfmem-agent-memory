# Claude PR #5 Cold Review Request

You are the requested Claude/Opus reviewer for RecallWeave PR #5.

Review the current branch as an adversarial release gate. Do not rely on
implementer claims alone. Inspect the files and command outputs you need, but
do not modify files.

Repository: `radbroradbro/selfmem-agent-memory`
Branch: `feat/nucleus-wiki-native-contract`
PR: `https://github.com/radbroradbro/selfmem-agent-memory/pull/5`

Scope:

- Nucleus Index contract.
- LLM-wiki compile and vault sync.
- Self-hosted Brain UI fixture surfaces.
- `selfmem_update` update flow.
- Local-only memory compaction benchmark and local-session audit.
- Hermes/OpenClaw bounded hosted read-through behavior.
- Public-safe release gate, GitHub live sync, and goal completion audit.

Required checks:

- Verify whether public launch should remain blocked.
- Verify whether the active native goal can be marked complete.
- Verify whether raw memories, transcripts, diagnostics, local paths,
  credentials, provider keys, or private container names are exposed.
- Verify whether benchmark claims stay blocked until a matched metrics-only
  hosted baseline and reviewer approvals exist.
- Verify whether the one-agent real canary remains incomplete.
- Verify whether the PR and issue evidence is coherent enough for an alpha PR,
  even if not production launch.

Useful files and commands:

- `docs/RELEASE_HANDOFF.md`
- `docs/PUBLIC_RELEASE_CHECKLIST.md`
- `docs/AUTORESEARCH_BENCHMARK_PLAN.md`
- `reviews/overnight-20260522/release-state.json`
- `reviews/overnight-20260522/production-readiness.md`
- `reviews/overnight-20260522/completion-audit.md`
- `reviews/overnight-20260522/pr-body-update-draft.md`
- `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`
- `packages/bench/release-readiness-check.mjs`
- `packages/bench/goal-completion-audit.mjs`
- `packages/bench/release-blocker-doctor.mjs`
- `packages/bench/github-live-sync-check.mjs`
- `node packages/bench/release-readiness-check.mjs`
- `node packages/bench/goal-completion-audit.mjs`
- `node packages/bench/release-blocker-doctor.mjs`
- `node packages/bench/github-live-sync-check.mjs`

Return a concise markdown review with this exact structure:

```markdown
# Claude PR #5 Review

Verdict: CLEAN | CONCERNS | BLOCK

## Findings

- ...

## Evidence Checked

- ...

## Required Before Public Launch

- ...

## Goal Completion Decision

Can mark native goal complete: yes | no
Reason: ...
```

Use `BLOCK` if the PR is unsafe to merge even as a private/public-alpha
candidate. Use `CONCERNS` if the code/evidence can proceed as an alpha PR but
public launch or goal completion remains blocked. Use `CLEAN` only if no
material issues remain and public launch is ready.
