# Public Live Update Draft

Status: draft only. Do not publish until the owner approves the release.

## Candidate Update

RecallWeave now has a public-safe preview branch for the local-first agent
memory direction.

The current PR adds:

- a Nucleus Index contract for memories, lifecycle events, retrieval traces,
  wiki pages, research questions, hypotheses, decisions, and evidence;
- an LLM-wiki compiler with Obsidian-style frontmatter, wikilinks, index/log
  pages, provenance, conflict handling for reviewed pages, and optional
  content-free pre-write audit logging;
- a fixture-only Brain UI for graph browsing, search, provenance, timeline
  review, derived-doc editing, draft export, Nucleus snapshot preview, research
  lineage, vault preview, sync-report inspection, selected vault sync dry-run,
  selected vault sync apply, lifecycle policy preview, and memory review queue;
- a dry-run-first `selfmem_update` command for agent update workflows;
- fixture smokes for Hermes, OpenClaw, wiki sync, compaction, update flow, and
  release readiness.

## Safety Boundary

This branch does not ship credentials, raw memories, raw transcripts, private
diagnostics, hosted Supermemory contents, or private agent logs. The public UI
evidence uses dummy fixture data only.

Hosted Supermemory remains read-through history when configured. RecallWeave
writes locally by default and does not enable hosted write-back.

## Current Verdict

Not production ready yet.

The code and fixture checks pass, and GitHub Actions has passed the release
readiness gate on PR #5. Public launch should still wait for final human
approval and the blocked reviewer routes to be resolved or explicitly accepted.

## Try The Fixture Brain

From the repo checkout:

```bash
npm exec --yes pnpm@10.23.0 -- install
npm exec --yes pnpm@10.23.0 -- brain:serve
```

Then open:

```text
http://127.0.0.1:4177
```

Use only the bundled fixture data for screenshots, recordings, demos, and
issues.

## Verification Snapshot

Latest verified head before this draft refresh:

- PR: `https://github.com/radbroradbro/selfmem-agent-memory/pull/5`
- Head: `2888f91`
- GitHub Actions: CI run `26288370812` passed
- Release-state guard follow-up: `dd17f44`, CI run `26289073223` passed
- Local release gate: `pnpm release:check` passed in the controller run
- Reviewer state: Gemini focused slice reviews passed; Claude route blocked by
  login
- Completion audit: not complete, with public launch still blocked on human
  approval and reviewer-route acceptance

## Known Gaps

- The Brain UI is still fixture mode.
- Real local-container browse/edit/sync needs a redacted picker, explicit write
  confirmation, and another security review.
- The benchmark evidence is fixture-focused. Hosted Supermemory comparison
  claims require a fresh, valid, metrics-only baseline.
- The public release should stay conservative until the owner approves it.
