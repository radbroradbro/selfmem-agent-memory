# Atomic Lifecycle Answer-Quality 10Q Diagnostic

Generated: 2026-05-31

## Scope

- Follow-up to the 2-question lifecycle-aware `atomic-memory-v1` proof.
- Ran a bounded 10-question same-shard model-challenger diagnostic.
- This remains diagnostic evidence only. It is not local-full evidence, full-SOTA evidence, production evidence, or a Supermemory comparison claim.
- Hosted Supermemory search stayed disabled for isolated benchmark methodology.
- No raw questions, raw answers, raw memory text, private paths, or provider keys are included here.

## Runtime Fix

- The first 10-question attempt failed on query 3 because the DeepSeek endpoint returned empty answer content.
- The answer-quality runner now sends the same DeepSeek thinking-disable field used by the query-expansion runner: `thinking: { type: "disabled" }`.
- After that change, the 10-question run completed with zero answer failures and zero judge failures.

## Diagnostic Run

- Command family: `benchmark:answer-quality:method-ladder`
- Claim scope: `model-challenger`
- Model match policy: `challenger-model-allowed`
- Endpoint label: `https://api.deepseek.com`
- Answer model: configured through private env
- Judge model: configured through private env
- Query count: 10
- Query offset: 0
- Context token budget: 800
- Retrieval strategies: `bm25-lite`, `full-hybrid-rerank`
- Memory methods: `session-v1`, `atomic-memory-v1`
- Public output:
  - `reviews/overnight-20260522/atomic-lifecycle-answer-quality-deepseek-flash-10q-20260531.json`
  - `reviews/overnight-20260522/atomic-lifecycle-answer-quality-deepseek-flash-10q-20260531.md`

## Results

| Method | Winner | Answer quality | Correct rate | Calls |
| --- | --- | ---: | ---: | ---: |
| `session-v1` | `bm25-lite` | 10 | 0.1 | 40 |
| `atomic-memory-v1` | `bm25-lite` | 35 | 0.3 | 40 |

Atomic strategy detail:

| Atomic strategy | Answer quality | Correct rate |
| --- | ---: | ---: |
| `bm25-lite` | 35 | 0.3 |
| `full-hybrid-rerank` | 25 | 0.2 |

## Interpretation

- The 10-question slice preserves the directional win for atomic memory over whole-session memory.
- The winning atomic arm on this slice was lexical BM25 over atomic memories, not full-hybrid rerank.
- This supports promoting `atomic-memory-v1` into the next controlled development slice, while keeping BM25 as the lexical floor/control.
- It does not support promoting full-hybrid rerank as the default scorer yet.
- Next high-ROI test: 30-question same-shard answer-quality diagnostic with `session-v1`, `atomic-memory-v1`, and the strongest provider rerank lane once provider cache/decontamination evidence is clean.

## Verification

- `node --check packages/bench/public-benchmark-answer-quality.mjs`
- `npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:method-ladder -- --fixture`
- Live 10-question model-challenger run completed with zero answer failures and zero judge failures.

