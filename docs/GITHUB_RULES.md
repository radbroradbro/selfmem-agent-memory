# GitHub Rules

These are the intended repository rules for RecallWeave.

## Main Branch

`main` is protected:

- pull request required before merge,
- one approving review required,
- code owner review required,
- stale approvals dismissed when code changes,
- conversation resolution required,
- force pushes disabled,
- branch deletion disabled,
- CI must pass before merge.

## Agent Permissions

Agents may:

- open issues,
- create branches,
- open pull requests,
- attach sanitized evidence,
- propose docs, runtime fixes, quality changes, safety changes, ops changes, and
  experiments.

Agents may not:

- push directly to `main`,
- merge their own PRs,
- publish raw memories or credentials,
- flip repository visibility,
- enable hosted write-back without approval,
- tell other agents to install an unmerged patch.

## Labels

Useful labels:

- `agent-proposal`
- `live-runtime`
- `runtime-fix`
- `quality`
- `safety`
- `ops`
- `experiment`
- `docs`
- `blocked-private-evidence`

## Public Release

The repository is public. Future release changes still need the checklist in
`docs/PUBLIC_RELEASE_CHECKLIST.md`.
