# Gemini Hosted Baseline Operator Packet Review

Date: 2026-05-23

Reviewer route:

- Gemini CLI 0.44.0-nightly.20260515.g928a311fb
- Command mode: read-only plan review
- Scope: hosted baseline operator packet diff only

Verdict: `CLEAN`

Findings:

- Credential and memory exposure: safe. The packet keeps keys in environment
  variables, forbids raw memories, raw transcripts, raw prompts, raw answers,
  tokens, cookies, private paths, and unredacted diagnostics, and asserts
  against key-shaped and private-path output.
- Accidental hosted calls: safe. The packet prints validation commands and
  does not execute network calls or hosted Supermemory calls.
- Benchmark claims: properly blocked. The packet requires matched runs, two
  reviewer approvals, and a RecallWeave win before public comparison claims.
- Coherence: docs, package script, smoke step, and release gate are aligned.
- Release-readiness gate: covered. The gate verifies the script, package
  command, no-hosted-call flag, forbidden artifact list, public-safe output,
  and secret-free evidence.
- Follow-up extension: `baseline:operator-packet -- --discovery
  reviews/overnight-20260522/hosted-baseline-live-discovery.json` now folds the
  live hashed-candidate discovery summary into the operator packet. The release
  gate verifies the state is non-fixture metadata, called the hosted provider,
  saw 100 documents and 4 hashed candidate containers, includes no raw labels or
  raw memory, and keeps privacy leaks at zero.
- Follow-up review initially flagged that `recommendedCandidateId` needed the
  same hashed-id validation as `containerCandidates`. The packet now validates
  the recommended id format and requires it to appear in the hashed candidate
  list; the release gate asserts both conditions.
- Second focused review after the fix returned `CLEAN`.

Notes:

- Terminal warnings reported limited color support and missing ripgrep inside
  Gemini. They did not affect the verdict.
