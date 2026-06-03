# Public Evidence Index

RecallWeave keeps detailed verifier evidence in `reviews/` for local and PR gate
replay. Release archives hide that raw review surface with `.gitattributes`
`export-ignore`, so public packages present compact product docs instead of a
large review-evidence tree.

The export policy is `reviews/** export-ignore`.

Public-facing evidence should stay in these compact surfaces:

- `docs/PRODUCTION_READINESS.md`: current readiness verdict, blockers, and
  launch boundaries.
- `docs/PUBLIC_RELEASE_CHECKLIST.md`: owner approval, review, canary, and
  publication gates.
- `docs/BENCHMARK_SUMMARY.md`: benchmark methodology limits and whole-harness
  evidence boundaries.
- `docs/AUTORESEARCH_BENCHMARK_PLAN.md`: same-data benchmark and auto-research
  plan, with BM25 retained as a floor/control.
- `docs/CODEX_MEMORY_RESET.md`: memory reset and controlled dogfood policy.

The detailed `reviews/` evidence remains source-tracked so maintainers can
replay gates, inspect council evidence, and verify current-head claims before a
PR merge. It is not the public release surface.
