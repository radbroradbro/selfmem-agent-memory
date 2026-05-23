# Public Benchmark Target Evidence

Date: 2026-05-23

Command:

```bash
npm exec --yes pnpm@10.23.0 -- benchmark:public-target:author
npm exec --yes pnpm@10.23.0 -- benchmark:public-target
```

Result:

- Author mode: fixture target JSON generated from the canonical fixture
- Mode: `public-benchmark-target-check`
- Fixture only: `true`
- Benchmark family: `longmemeval`
- Benchmark type: `memory`
- Claim tier: `fixture`
- Same data contract: passed
- Component evidence is model-selection only: passed
- Public benchmark claims allowed: `false`
- Target ready for canary: `false`
- Raw question ids included in report: `false`
- Raw labels included in report: `false`
- Raw memories or transcripts included: `false`

What this proves:

- RecallWeave now has a runnable public benchmark target gate, not only prose.
- RecallWeave can generate the target file shape from an audited authoring
  command before validating it.
- Non-fixture canary targets must include a source-lock attestation; hand-made
  targets without that note fail the validator.
- A target must name the same data, revision, split, labels, judge model, answer model, judge rule, and scoring setup before a public canary can run.
- MTEB/MMTEB/BEIR/MIRACL/MS MARCO and reranker leaderboards are accepted only
  as component evidence for choosing model arms.
- The fixture keeps public benchmark claims blocked.

What this does not prove:

- It does not run RecallWeave on LongMemEval, LoCoMo, ConvoMem, BEAM, or
  LongMemEval-V2.
- It does not authorize SOTA language.
- It does not replace a full public benchmark run or reviewer approval.
