# GitHub Issue Creation Blocked

Date: 2026-05-22

Scope:

- Tried to create a public-safe blocker issue from
  `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`.
- Tried to add a public-safe top-level PR status comment after the latest
  controller refresh.
- Retried the PR body update and blocker issue flow after the dynamic Brain UI
  layout evidence was added; the permission failure remained the same.

Result:

- Blocked. The GitHub connector returned this 403 for both issue creation and
  PR commenting:

```text
FORBIDDEN: Resource not accessible by integration
```

No private evidence was sent. The attempted issue body used only public-safe
fixture and review metadata, including the dynamic layout fixture evidence.

Follow-up:

- Create the issue manually from
  `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`
  when repository permissions allow it.
- Or explicitly accept the missing issue as part of the human release decision.
