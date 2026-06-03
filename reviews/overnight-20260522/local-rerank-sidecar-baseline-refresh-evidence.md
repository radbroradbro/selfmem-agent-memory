# Local Reranker Sidecar Baseline Refresh Evidence

Date: 2026-05-24

## Verified Head

- Commit: `d1615df09ab7e13fc2f1b39c74dbe6de7128f07b`
- GitHub Actions run: `26378052431`
- Conclusion: success
- PR branch: `feat/nucleus-wiki-native-contract`

## What Changed

This baseline adds `local-apple-qwen3-0_6b-local-rerank` as an experimental
benchmark arm.

The arm keeps the measured Qwen3 Embedding 0.6B Apple Silicon lane fixed and
changes only the final reranker. The reranker is env-only and requires
`SELFMEM_LOCAL_RERANK_ENDPOINT` or `SELFMEM_LOCAL_RERANK_BASE_URL`.

## Current Status

- Fixture provider gate: passed.
- Live preflight without a local reranker endpoint: blocked as expected.
- Release guard: passed.
- GitHub live PR/issue sync: passed.
- Goal audit: passed and still reports the native goal as incomplete.
- Public launch: still blocked by owner approval and one real strict
  production canary.

## Non-Claims

This commit does not prove a local reranker win. It does not promote the
sidecar as a default. It adds a clean, fail-closed path for the next local
benchmark run.

The approved one-agent runtime canary adapter/report commit remains
`18d606aff589986b4d8b416a686bedb7ff1506d2`.
