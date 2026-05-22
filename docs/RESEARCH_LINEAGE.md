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

## Source Lock

Research lineage should distinguish public source lock from private working
memory. A source-lock packet lists the public sources that constrain a decision,
their status, claim type, confidence, caveats, and implementation rules.

The Brain UI must show that packet as readable source cards and rules first.
Any raw export belongs behind a technical disclosure. Backend identifiers may
remain copyable for operators, but the main UI should say "Topic paths",
"Stale memory supersession", and "Budgeted lifecycle frequency" instead of
showing raw ids as the product language.

Source lock is not marketing proof. It records what the product should test
next and which claims need live reproduction before publication.

Provider and benchmark decisions use the same rule. RecallWeave may document
Voyage, Gemini, NVIDIA, Qwen3, llama.cpp, GBrain, LLM-wiki, and memory
benchmark sources as inputs, but public score claims require a matched canary
win. The canary must share dataset slice, queries, judge, answer model, scoring
code, privacy rules, and reviewer sign-off with the baseline. Otherwise the
result stays an internal gap report.

## Nucleus Nodes

Research lineage uses these node kinds:

- `research_query`
- `source_claim`
- `hypothesis`
- `decision`
- `methodology` pages in the wiki layer

The graph should show whether claims support, challenge, answer, test, or inform
a hypothesis.

## Topic Paths

Major memories should carry a topic path and optional subtopic path. Examples:

- `Law / FCPA / Red flags`
- `Code / RecallWeave / Hermes lifecycle`
- `Agent operations / OpenClaw / Update flow`

Topic paths should become wiki links, graph edges, and retrieval boosts. They
should not replace dense, sparse, temporal, or rerank scoring. They give the
retriever a map so related items can reinforce one another without flooding the
prompt with every memory from a broad topic.

When a bug, task, or hypothesis is resolved, the next write should add a
superseding state and demote the stale open item. The old item remains useful
for methodology and future debugging, but it should not keep ranking as if it
were still active.

Lifecycle frequency should stay user-adjustable. Some agents need recall every
turn. Others can recall on topic shifts, after compression, on explicit memory
keywords, or every few turns. Each profile should log recall frequency, context
tokens, write count, and miss rate so the setting can be tuned from evidence
instead of taste.

At scale, the UI should open with dashboard health: memory volume, recent
writes, recall miss rate, privacy failures, unresolved contradictions, stale
open bugs, and provider status. From there, users should zoom into topic
clusters, then linked paths, then editable documents. A graph is helpful only
when it has that dashboard-to-cluster-to-document rhythm.

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
