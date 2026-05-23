# GitHub Live Sync Evidence

Date: 2026-05-22

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
  "prBodyHash": "6a056bf2bc470b6487145bc9015972e06d4384fe1babcd5e79c239fe3f1e57bd",
  "issueTitleHash": "e093f2ff3b75bc8883b03105411e42498d5eb5a4231b369634a83fddecc3fa3c",
  "issueBodyHash": "3091802617b15919af146c3999f5318c38688e497d9538302e4d9293334fa72e",
  "liveUpdatedAt": {
    "pullRequest": "2026-05-23T01:12:50Z",
    "issue": "2026-05-23T01:12:51Z"
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
