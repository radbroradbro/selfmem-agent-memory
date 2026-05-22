# Research Lineage

RecallWeave should learn from its own research without turning research notes
into untraceable opinions.

The final product should track:

- the research question,
- the sources inspected,
- the claims extracted,
- the hypothesis,
- pros,
- cons,
- tests run,
- decisions made,
- follow-up questions.

This is how the LLM-wiki layer supports final decision-making. A user should be
able to ask why RecallWeave chose a graph design, a reranker, a lifecycle hook,
or an update flow and see the source trail.

## Nucleus Nodes

Research lineage uses these node kinds:

- `research_query`
- `source_claim`
- `hypothesis`
- `decision`
- `methodology` pages in the wiki layer

The graph should show whether claims support, challenge, answer, test, or inform
a hypothesis.

## Wiki Pages

Research pages should live under:

```text
vault/wiki/methodology/
vault/wiki/research/
vault/wiki/decisions/
```

Every page should use normal LLM-wiki frontmatter and link back to source pages.

Suggested page sections:

```markdown
## Question

## Sources

## Claims

## Hypothesis

## Pros

## Cons

## Test Plan

## Decision

## Next Questions
```

## Source of Truth

Public research pages may cite public sources and sanitized fixture evidence.

Private local tests may inspect real Codex or Claude session history, but public
outputs must collapse that into aggregate metrics, redacted examples, or
fixture-safe methodology.

## Agent Behavior

Overnight agents should append research lineage instead of overwriting it.

When a later run changes a decision, it should add a superseding decision node
with an edge to the older one. The old page remains useful because it explains
what evidence was available at the time.

## Visual UI

The self-hosted brain UI should let users inspect research lineage as:

- a graph path,
- a table of claims,
- a decision timeline,
- an editable derived markdown page.

This is more important than visual novelty. The graph earns its keep when it
helps a user see what evidence led to a decision.

## UI Evaluation Loop

Research lineage should also track how the UI itself improves.

For every major brain UI pass, agents should record:

- what flow was tested,
- which browser or computer-use tool captured the evidence,
- what screenshot or screen-recording artifact was reviewed,
- what the reviewer disliked,
- what hypothesis the UI change tested,
- what changed after review,
- whether the second pass improved.

Subagents may operate the browser, capture sanitized screen recordings, and
grade visual quality. Their findings should become `source_claim` or
`hypothesis` nodes, not vague comments that disappear after the run.

Only fixture data may appear in public UI evidence.
