# GitHub Rules

These are the intended repository rules for RecallWeave.

## Main Branch

`main` should be protected:

- pull request required before merge,
- one approving review required,
- code owner review required,
- stale approvals dismissed when code changes,
- conversation resolution required,
- force pushes disabled,
- branch deletion disabled,
- CI should pass before merge once GitHub Actions is active.

Current caveat: GitHub may block branch protection on a private repository
unless the owner has the required plan. If protection is unavailable, enforce
these rules through CODEOWNERS, pull-request review, and maintainer discipline
until the repo becomes public or the plan supports protected branches.

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

The repository should stay private until the owner explicitly approves public
visibility. Public release needs the checklist in
`docs/PUBLIC_RELEASE_CHECKLIST.md`.
