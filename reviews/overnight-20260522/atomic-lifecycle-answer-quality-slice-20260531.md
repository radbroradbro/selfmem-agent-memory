# Atomic Lifecycle Answer-Quality Slice

Generated: 2026-05-31

## Scope

- Follow-up to the GPT-5.5 Pro review plan and the lifecycle-aware `atomic-memory-v1` patch.
- Ran a bounded same-shard answer-quality diagnostic after fixing a benchmark materialization decontamination blocker.
- This is model-challenger diagnostic evidence only. It is not local-full, production, SOTA, or Supermemory-comparison evidence.
- Hosted Supermemory search stayed disabled for the benchmark methodology run.
- No raw questions, raw answers, raw memory text, private paths, or provider keys are included here.

## Materialization Safety Fix

- The public LongMemEval source contains key-shaped strings in message content.
- Before the fix, live materialization failed fast with `private memories contains a key-shaped secret`.
- The materializer now redacts key-shaped and private-tag content from derived memory records before writing private benchmark inputs.
- Stable provenance fields remain unsanitized and fail closed if they ever resemble secrets.
- Source-content hashes and token estimates are recomputed after decontamination.

## Diagnostic Run

- Command family: `benchmark:answer-quality:method-ladder`
- Claim scope: `model-challenger`
- Model match policy: `challenger-model-allowed`
- Endpoint label: `https://api.deepseek.com`
- Answer model: configured through private env
- Judge model: configured through private env
- Query count: 2
- Query offset: 0
- Context token budget: 800
- Retrieval strategies: `bm25-lite`, `full-hybrid-rerank`
- Memory methods: `session-v1`, `atomic-memory-v1`
- Public output:
  - `reviews/overnight-20260522/atomic-lifecycle-answer-quality-deepseek-flash-2q-20260531.json`
  - `reviews/overnight-20260522/atomic-lifecycle-answer-quality-deepseek-flash-2q-20260531.md`

## Results

| Method | Winner | Answer quality | Correct rate | Calls |
| --- | --- | ---: | ---: | ---: |
| `session-v1` | `bm25-lite` | 0 | 0 | 8 |
| `atomic-memory-v1` | `full-hybrid-rerank` | 50 | 0.5 | 8 |

## Interpretation

- The new atomic lifecycle path is end-to-end executable under the answer-quality harness.
- On this tiny shard, `atomic-memory-v1` beat `session-v1`, but the sample is far too small for promotion.
- The result supports the next method-refinement step: expand to a controlled 10 to 30 question development slice after cache/decontamination evidence and provider budget guards remain clean.
- The result does not change the public release/SOTA gate by itself.

## Verification

- `node --check packages/bench/public-benchmark-materialize-run.mjs`
- `node packages/bench/public-benchmark-materialize-run.mjs --fixture --memory-method atomic-memory-v1 --format json`
- `npm exec --yes pnpm@10.23.0 -- test -- tests/bench/benchmark-contract.test.ts --runInBand`

