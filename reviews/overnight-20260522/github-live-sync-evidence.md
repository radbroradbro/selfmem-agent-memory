# GitHub Live Sync Evidence

Date: 2026-05-23

Command:

```bash
node packages/bench/github-live-sync-check.mjs
```

Result: passed.

The checker calls the GitHub API in read-only mode and compares live public
state against the checked-in release drafts:

- PR #5 is open.
- PR #5 head branch is `feat/nucleus-wiki-native-contract`.
- PR #5 body matches `reviews/overnight-20260522/pr-body-update-draft.md`.
- GitHub issue #6 is open.
- GitHub issue #6 title and body match
  `reviews/overnight-20260522/issue-drafts/blocker-fresh-brain-ui-launch-and-release-gate.md`.
- The output contains hashes and booleans only. It does not print the PR body,
  issue body, credentials, private local paths, raw memories, transcripts, or
  diagnostic contents.

Observed public-safe output:

```json
{
  "ok": true,
  "mode": "github-live-sync-check",
  "writesRealFiles": false,
  "callsGitHubApi": true,
  "repository": "radbroradbro/selfmem-agent-memory",
  "pullRequest": 5,
  "issueNumber": 6,
  "reviewDir": "reviews/overnight-20260522",
  "livePrOpen": true,
  "liveIssueOpen": true,
  "livePrHeadMatches": true,
  "expectedHeadRef": "feat/nucleus-wiki-native-contract",
  "prBodyMatches": true,
  "issueTitleMatches": true,
  "issueBodyMatches": true,
  "prBodyHash": "3ec9d439ca818f735dc7a5f5f6d385aa9d0a43c06fac2ff1ec1c46fd424329a9",
  "issueTitleHash": "e093f2ff3b75bc8883b03105411e42498d5eb5a4231b369634a83fddecc3fa3c",
  "issueBodyHash": "045c43e973db6ff4ce7da59f442637787e98981a8b3690c717264a4862511a72",
  "liveUpdatedAt": {
    "pullRequest": "2026-05-23T02:03:30Z",
    "issue": "2026-05-23T02:03:30Z"
  },
  "safety": {
    "printsBodyText": false,
    "printsCredentials": false,
    "privateLeakCount": 0,
    "hasSecretPattern": false,
    "hasPrivatePathPattern": false
  }
}
```

This evidence does not change the launch verdict. It only proves that live PR
#5 and issue #6 still match the repository evidence.
