# Public MemoryBench Source Lock Evidence

Date: 2026-05-23

Command:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:source-lock -- --strict
```

Result:

- Mode: `public-benchmark-source-lock-check`
- Source: `MemoryBench`
- Repository: `https://github.com/supermemoryai/memorybench`
- Branch: `main`
- Commit: `118209a746d97d0d85e5a7234267f0b6962857e9`
- Benchmarks: `locomo`, `longmemeval`, `convomem`
- Dataset sources recorded: `longmemeval`, `locomo`, `convomem`
- Provider contract methods recorded: `initialize`, `ingest`, `awaitIndexing`,
  `search`, `clear`
- Benchmark contract methods recorded: `load`, `getQuestions`,
  `getHaystackSessions`, `getGroundTruth`, `getQuestionTypes`
- Key source-file hashes recorded: 15
- Checkout verification requested by default: `false`
- Public benchmark claims allowed: `false`
- Ready for target authoring: `true`
- Raw question ids included: `false`
- Raw labels included: `false`
- Raw memories or transcripts included: `false`

Independent checkout verification command:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:source-lock -- --strict --repo-checkout <memorybench-checkout>
```

Independent checkout verification result:

- Checkout verification requested: `true`
- Commit matched: `true`
- Required file count: 15
- Checked file count: 15
- Failed file count: 0
- Machine-readable evidence:
  `reviews/overnight-20260522/public-memorybench-source-lock-checkout-evidence.json`

What this proves:

- RecallWeave has a current MemoryBench source lock before authoring a real
  public canary target.
- The lock records the harness commit, benchmark names, dataset source URLs,
  provider interface, benchmark interface, CLI pipeline, MemScore components,
  and key source-file hashes.
- The source-lock check is public-safe and metrics-only.

What this does not prove:

- It does not run RecallWeave on LongMemEval, LoCoMo, or ConvoMem.
- It does not hash a downloaded dataset split or answer labels.
- It does not authorize benchmark superiority language.
