# Reviewer Work Folder

Date: 2026-05-23

This folder holds public-safe reviewer evidence for the budgeted hosted-baseline
canary. It is intentionally narrow:

- no raw memories
- no raw transcripts
- no raw prompts
- no raw answers
- no credentials
- no private filesystem paths

The reviewer gate accepts only machine-readable JSON approvals that bind to the
same metrics-only run, query-set hash, and scoring-code hash. Markdown notes in
this folder explain route status and blocked attempts; they do not count as
benchmark approvals by themselves.

Future native CLI reviewers should write concise markdown findings in this
folder, then export any countable approval as JSON only after the markdown
findings are complete. Keep CLI transcripts summarized. Do not paste raw
prompts, raw answers, raw memories, credentials, or private paths.

## Current Findings

- Codex GPT-5.5 produced a countable source-matched canary approval.
- Gemini produced a countable source-matched canary approval for the same run
  target.
- Claude CLI is installed, but the local noninteractive route is blocked because
  project hooks run before Claude can return reviewer output.
- Public launch remains blocked even if the benchmark canary approval gate
  passes. Owner approval is still required.

## Countable Approval Files

- `codex-5-5-budgeted-baseline-approval.json`
- `gemini-3-1-pro-budgeted-baseline-approval.json`

## Route Notes

- `claude-opus-blocked-by-hooks.md`
- `reviewer-findings.md`
