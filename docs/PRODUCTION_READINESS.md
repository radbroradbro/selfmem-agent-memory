# Production Readiness

RecallWeave is production-ready only when current evidence proves the runtime,
privacy model, UI, docs, and update path work together.

## Required Verdicts

Use one of these verdicts in review packets:

- `PASS`
- `PASS WITH CONCERNS`
- `FAIL`

Do not use `PASS` if any required evidence is missing.

## Required Evidence

Before a public live update or release note:

- install succeeds from a clean clone,
- build passes,
- typecheck passes,
- unit and privacy tests pass,
- Hermes smoke passes,
- OpenClaw smoke passes,
- package dry-run passes,
- secret scan passes,
- private-name scan passes,
- forbidden runtime file scan passes,
- UI launches on localhost if a UI exists,
- UI evidence uses sanitized fixture data only,
- wiki lint passes if wiki sync changed,
- Nucleus snapshot redaction tests pass,
- research-lineage examples link queries, hypotheses, pros, cons, sources, and
  decisions without leaking private evidence,
- session compaction benchmark passes on fixture data with chronological output
  and zero privacy leaks,
- reviewer packet records which council routes actually ran.

## UI Evidence

The brain UI is not ready unless a reviewer can inspect a sanitized flow:

1. launch,
2. search,
3. open a memory or wiki node,
4. inspect provenance,
5. inspect retrieval trace,
6. inspect lifecycle or sleep-cycle event,
7. edit a derived doc or wiki page,
8. save or cancel,
9. run lint or validation.

Acceptable evidence:

- screenshots,
- short screen recordings,
- accessibility snapshots,
- console logs,
- network logs,
- test traces.

Forbidden evidence:

- raw memory text from a real user,
- raw local session history,
- credentials,
- private paths,
- private agent logs,
- private diagnostics zips.

## Native Memory Optimization

Production readiness requires host-native behavior:

- Hermes uses provider lifecycle and sleep/compression hooks when exposed.
- OpenClaw uses memory plugin lifecycle.
- Codex uses its hook or skill path.
- Claude Code uses its plugin or hook path.
- MCP exposes a standard bridge without becoming the only source of truth.

RecallWeave should optimize each host's memory rhythm instead of forcing all
hosts into the same generic lifecycle.

## Hybrid Search

The runtime must prove local hybrid recall:

- lexical recall,
- semantic recall when provider credentials exist,
- rerank or deterministic score fallback,
- read-only hosted Supermemory search when configured,
- export-cache fallback when configured,
- dedupe across sources,
- bounded prompt context,
- retrieval trace stored locally.

Benchmarks should check whether memories reach production context, not merely
whether raw search returns them.

## LLM-Wiki Layer

The release must document and test:

- immutable sanitized sources,
- derived editable wiki pages,
- frontmatter,
- wikilinks,
- central index,
- methodology log,
- provenance,
- conflict handling for reviewed manual edits,
- lint for broken links and stale claims.

## Research Lineage

Production review must verify that major design choices have a traceable
research path:

- query,
- sources,
- claims,
- hypothesis,
- pros,
- cons,
- tests,
- decision,
- next questions.

This lineage should be visible in the wiki and the Nucleus graph. It may use
public sources and sanitized fixture evidence only.

## Session Compaction

Production review must verify that local session compaction can extract durable
memory candidates without bloating recall.

Required checks:

- redaction before extraction,
- chronological candidate output,
- noise reduction,
- stale school-note downshift to background,
- no raw private sessions in public artifacts.

## Failure Loop

If readiness fails:

1. write the failing evidence,
2. open an issue or PR with acceptance criteria,
3. fix narrow blockers when safe,
4. rerun the affected checks,
5. repeat until the verdict is backed by evidence.

Never call the release production-ready because the plan is good.
