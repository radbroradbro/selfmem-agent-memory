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
  "prBodyHash": "69ed5bcb3b0308a7e7d23263439fe6f9e1be341e7ef21b260bf22a310e3dbfa0",
  "issueTitleHash": "e093f2ff3b75bc8883b03105411e42498d5eb5a4231b369634a83fddecc3fa3c",
  "issueBodyHash": "b1e99a540f0deb0c9f3e26306f0a3d1c3c47cea5639d1ac5e2d89a7b3c70d6ab",
  "liveUpdatedAt": {
    "pullRequest": "2026-05-23T01:44:14Z",
    "issue": "2026-05-23T01:44:14Z"
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
