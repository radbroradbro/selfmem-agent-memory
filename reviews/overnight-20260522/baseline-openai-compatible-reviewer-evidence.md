# OpenAI-Compatible Reviewer Evidence

## Scope

Added `baseline:reviewer:openai-compatible` so DeepSeek or another
OpenAI-compatible reviewer can inspect the metrics-only hosted baseline packet
and write one sanitized approval JSON for `baseline:reviewer-intake`.

## Safety Contract

- Credentials are env-only.
- The command accepts `RECALLWEAVE_REVIEW_OPENAI_API_KEY`,
  `RECALLWEAVE_REVIEW_<PROVIDER>_API_KEY`, or `DEEPSEEK_API_KEY`.
- Docs never put the key in command arguments.
- Dry-run calls no reviewer provider and emits a non-countable fixture artifact.
- Live mode sends only aggregate metrics, hashes, privacy counters, target
  metadata, and reviewer instructions.
- Output is scanned for key-shaped secrets, private local paths, and forbidden
  raw-content keys before writing.
- `baseline:reviewer-intake` remains the authority on whether an approval
  counts.

## Verification

Commands exercised:

```bash
node packages/bench/baseline-openai-compatible-reviewer.mjs --dry-run --output /tmp/reviewer-dry-run.json
node packages/bench/baseline-reviewer-approval-intake.mjs --review /tmp/reviewer-dry-run.json --output /tmp/reviewer-intake.json
```

Expected result:

- runner mode: `baseline-openai-compatible-reviewer`
- provider default: `deepseek`
- model default: `deepseek-v4-pro`
- dry-run calls reviewer provider: `false`
- dry-run artifact fixture-only: `true`
- intake approval count: `0`
- public launch allowed: `false`

The missing-key live path also fails closed with an environment-variable
instruction and no credential echo.
