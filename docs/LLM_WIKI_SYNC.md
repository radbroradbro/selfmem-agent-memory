# LLM-Wiki Sync

RecallWeave should use the LLM-wiki pattern as its editable knowledge layer:

1. immutable sanitized sources,
2. derived wiki/docs written by the memory engine,
3. a schema and lint rules that agents can follow,
4. a central index and append-only methodology log.

This gives users an Obsidian-compatible brain without requiring Obsidian as the
only viewer.

## Directory Shape

```text
vault/
  sources/
  wiki/
    index.md
    log.md
    methodology.md
    entities/
    projects/
    decisions/
    workflows/
    sessions/
    research/
    methodology/
  nucleus.json
```

`sources/` stores sanitized source copies or source references. `wiki/` stores
derived editable pages. `nucleus.json` stores the graph/index snapshot used by
the self-hosted UI.

## Frontmatter

Every generated page should include:

```yaml
title:
type:
category:
tags:
aliases:
sources:
created:
updated:
confidence:
version:
provenance:
  extracted:
  inferred:
  ambiguous:
reviewed: false
```

Manual edits are allowed. If `reviewed: true`, automated sync must not overwrite
the page without creating a conflict note.

## Sync Rules

- Redact before writing a source, page, log entry, or Nucleus snapshot.
- Preserve source references even when page text is rewritten.
- Prefer `[[wikilinks]]` for entity, project, decision, and workflow links.
- Append operational changes to `wiki/log.md`.
- Append methodology changes to `wiki/methodology.md`.
- Detect broken wikilinks, duplicate aliases, missing frontmatter, stale pages,
  and contradicted claims.
- Keep raw private session history outside the public vault.

## Compiler

The public-safe compiler and explicit sync helper live in `@recallweave/core`:

```ts
import {
  compileNucleusWikiVault,
  lintCompiledWikiVault,
  syncCompiledWikiVault,
} from "@recallweave/core";
```

`compileNucleusWikiVault(snapshot)` returns files in memory. It still does not
write to a real vault by itself.

`syncCompiledWikiVault(vault, { rootDir })` is the explicit apply step. It writes
only compiled, lint-clean files under the provided directory. If a markdown page
already has `reviewed: true`, sync leaves the reviewed page in place and writes a
sanitized conflict note under `wiki/_conflicts/`.

The compiler emits:

- `wiki/index.md`,
- `wiki/log.md`,
- `wiki/methodology.md`,
- one markdown page per editable Nucleus node,
- `nucleus.json`,
- `.manifest.json`.

Run the fixture gate with:

```bash
pnpm wiki:smoke
pnpm wiki:sync:smoke
```

## Editing Flow

The self-hosted UI should edit derived docs and wiki pages, not raw transcripts.

Required flow:

1. search the brain,
2. open a Nucleus node,
3. inspect provenance and retrieval trace,
4. edit a derived page,
5. save as a new version or cancel,
6. run lint,
7. update `nucleus.json`.

## Native Host Behavior

The wiki is shared, but host lifecycle remains native:

- Hermes writes through provider lifecycle events.
- OpenClaw writes through memory plugin lifecycle events.
- Codex and Claude Code write through their hook or skill surfaces.
- MCP exposes recall/context/save tools for clients that need a standard bridge.

The sync layer should normalize the resulting derived pages, not pretend every
host emitted the same event.

## Source-Lock References

The overnight source-lock scout should compare RecallWeave with public
LLM-wiki and agent-brain projects such as GBrain before the UI contract is
considered stable.

## Research Lineage

The wiki should keep research lineage as editable markdown pages. A final
architecture decision should not appear as a free-floating opinion. It should
link to:

- the original query,
- sources inspected,
- extracted claims,
- hypothesis,
- pros,
- cons,
- tests,
- decision,
- follow-up questions.

This structure lets later agents expand the research instead of restarting it.
