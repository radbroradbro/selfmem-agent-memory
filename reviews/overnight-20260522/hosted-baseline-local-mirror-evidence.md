# Hosted Baseline Local Mirror Evidence

This slice adds `baseline:mirror-hosted` for source-matched hosted-baseline
work. It is a read-only hosted Supermemory bridge: it reads the selected hosted
source, writes a private local RecallWeave-compatible mirror outside the
repository, and emits only a metrics report.

## Safety Contract

- Hosted write-back: no.
- Public report contains raw labels: no.
- Raw memory included in public report: no.
- Private mirror files mode: `0600`.
- Private mirror directory mode: `0700`.
- Private mirror location: outside the repository.
- Private map required for live mode: yes.
- Public launch or public comparison claims allowed: no.

## Verification

Commands run:

```bash
node --check packages/bench/hosted-baseline-local-mirror.mjs
npm exec --yes pnpm@10.23.0 -- baseline:mirror-hosted
```

Fixture result:

- mirror report mode: `hosted-baseline-local-mirror`.
- calls hosted provider: no.
- mirrored memory count: `3`.
- privacy leak count: `0`.
- redaction failure count: `0`.
- raw memory included: no.

Source-match fixture chain:

- `baseline:discover` wrote a private raw-label map with `0600` mode.
- `baseline:author-queryset` wrote a private query set with `0600` mode.
- `baseline:mirror-hosted` wrote a private hosted mirror with `0600` files.
- `baseline:source-match --preserve-ids --strict` reported
  `sourceMatchReady: true`.
- source-match collectable query count: `3`.
- `baseline:source-align --strict` reported
  `READY_FOR_MATCHED_BASELINE_FIXTURE`.

## Boundary

This does not prove RecallWeave beats hosted Supermemory. It reduces the
hosted-baseline blocker by creating a private source-matched local arm so the
next live canary can avoid another source-mismatched 0-0 comparison.
