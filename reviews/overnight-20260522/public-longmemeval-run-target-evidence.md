# Public Benchmark Target Check

Date: 2026-05-23

Commands:

```bash
node packages/bench/public-benchmark-target-author.mjs --slice-manifest reviews/overnight-20260522/public-longmemeval-slice-evidence.json --claim-tier run-only --judge-model gpt-4o --answer-model gpt-4o --judge-rule "MemoryBench LongMemEval source-locked judge and scoring contract at commit 118209a746d97d0d85e5a7234267f0b6962857e9" --output reviews/overnight-20260522/public-longmemeval-run-target.json
node packages/bench/public-benchmark-target-check.mjs --target reviews/overnight-20260522/public-longmemeval-run-target.json --strict-run --output reviews/overnight-20260522/public-longmemeval-run-target-check.json
node packages/bench/public-benchmark-target-check.mjs --target reviews/overnight-20260522/public-longmemeval-run-target.json --strict-run --format markdown --output reviews/overnight-20260522/public-longmemeval-run-target-evidence.md
```

- OK: true
- Fixture only: false
- Benchmark: LongMemEval
- Benchmark type: memory
- Claim tier: run-only
- Public slice run ready: true
- Target ready for canary: false
- Public benchmark claims allowed: false
- Failed checks: none

## Same-Data Lock

- MemoryBench commit:
  `118209a746d97d0d85e5a7234267f0b6962857e9`
- Dataset hash:
  `sha256:d6f21ea9d60a0d56f34a05b609c79c88a451d2ae03597821ea3d5a9678c3a442`
- Selected-id policy hash:
  `sha256:686da163b61d343549768cdccd890a46ce775b653414932bdd07aec2ccdd3a23`
- Answer-label hash:
  `sha256:423098446f2953b45fe049fbd9da0b8d806050d4aed6cdec2a349f167ce1fa3e`
- Scoring-code hash:
  `sha256:f9d889e173f83b68e64d7221121f51bb3cf289bb921aacf36d95080d4b0a9518`
- Question selector:
  deterministic first-per-type round-robin from the source-locked
  LongMemEval-S cleaned dataset.

## What This Proves

- RecallWeave now has a non-fixture public benchmark run target derived from
  the real LongMemEval slice manifest.
- The target is ready for a RecallWeave run on the same public benchmark data.
- The target remains metrics-only and public-safe; it contains no raw question
  ids, question text, answer text, memories, transcripts, credentials, or
  private local paths.
- Public comparison claims remain blocked until a source-locked reported target
  row is attached and passes `--strict`.

## Next Actions

- Run RecallWeave on this source-locked public slice and attach metrics-only results.
- Do not compare the result to a reported leader row until a canary-trend target with matching reported-target fields passes strict validation.
- Keep MTEB/MMTEB/BEIR/MIRACL/MS MARCO evidence separate as model-arm selection evidence.
