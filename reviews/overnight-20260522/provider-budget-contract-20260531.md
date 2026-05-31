# Provider Budget Contract

Generated: 2026-05-31

## Scope

- Added a shared provider-budget contract for RecallWeave provider benchmark preflight, provider-gate reports, and provider-wave intake.
- The contract makes no-spend/free-tier assumptions explicit before provider calls are counted as benchmark evidence.
- No raw provider keys, raw memories, raw transcripts, raw questions, or private benchmark text are included here.

## Contract Enforced

- Default mode is `no-spend-free-tier` with `maxPaidUsd = 0`.
- Allowed provider families include Voyage, Gemini, NVIDIA, local Apple, local rerank, OpenRouter, DeepSeek, Jina, and Alibaba.
- Paid-only challenger families are disallowed in no-spend mode unless an explicit paid cap is configured.
- Key rotation is same-provider only and may not switch models or providers inside an arm.
- Cross-provider fallback stays disabled; failed provider arms stay failed for that run and can only be retried as separate arms.
- Provider output caching is required to key on provider, model, dimensions, and payload hash, and public evidence must remain metrics-only.

## Evidence

- `goal-loop-review` gate detection
  - Required gates: security, architecture, code, integration, final.
  - Used bounded verification for this slice because the broad repo verifier previously hung on whole-repository security scanning.
- `node --check packages/bench/provider-budget-contract.mjs`
  - Passed.
- `node --check packages/bench/public-benchmark-strategy-compare.mjs`
  - Passed.
- `node --check packages/bench/provider-benchmark-live-preflight.mjs`
  - Passed.
- `node --check packages/bench/provider-wave-intake.mjs`
  - Passed.
- `npm exec --yes pnpm@10.23.0 -- test -- tests/bench/benchmark-contract.test.ts --runInBand`
  - Passed 7 files / 31 tests.
- Provider-gate fixture report
  - Passed and reported `providerBudget.mode = no-spend-free-tier`, `maxPaidUsd = 0`, required provider `voyage`, and cross-provider fallback disabled.
- NVIDIA live preflight without credentials
  - Blocked as expected on missing consent/credentials while still reporting an allowed no-spend NVIDIA budget contract.
- Provider-wave intake refresh
  - Passed and wrote `reviews/overnight-20260522/provider-wave-intake-20260531.json`.
  - Found 17 legacy provider-wave reports without the new budget contract, so they remain historical retrieval/provider-gate evidence but should not be used for default promotion until rerun under the contract.

## Claim Boundary

This is benchmark-methodology hardening. It does not add answer-quality evidence, full-memory SOTA evidence, or Supermemory-comparable proof by itself.
