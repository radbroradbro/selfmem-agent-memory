# Hosted Baseline Discovery Evidence

Date: 2026-05-23

Scope:

- Added `packages/bench/hosted-baseline-discovery.mjs`.
- Added `baseline:discover` as a package script and smoke step.
- Wired discovery into the clean consumer smoke, release readiness check, hosted
  baseline operator packet, release handoff, benchmark summary, and live-build
  guide.

Purpose:

- Identify likely hosted Supermemory baseline containers without exposing raw
  memory text, raw document titles, raw prompts, raw answers, raw container
  labels, or provider keys.
- Keep public evidence to hashed candidate ids, counts, timestamps, status/type
  counts, and document-id hashes.
- Allow a local-only private map only when
  `RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1` and `--private-map-output` are
  both set.

Commands:

```bash
node --check packages/bench/hosted-baseline-discovery.mjs
node packages/bench/hosted-baseline-discovery.mjs
RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 node packages/bench/hosted-baseline-discovery.mjs --private-map-output /tmp/recallweave-hosted-container-map.private.jsonl
RECALLWEAVE_BASELINE_LIVE=1 node packages/bench/hosted-baseline-discovery.mjs --live --limit 10 --max-pages 1 --output /tmp/recallweave-hosted-baseline-discovery.json
RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 node packages/bench/hosted-baseline-discovery.mjs --live --limit 10 --max-pages 1 --output /tmp/recallweave-hosted-baseline-discovery-private-map-check.json --private-map-output /tmp/recallweave-hosted-container-map.private.jsonl
```

Latest live metadata result:

- Hosted provider call: yes.
- Hosted write-back: no.
- Content requested: no, `includeContent: false`.
- Run time: 2026-05-23T07:26:32Z.
- Pages read: 2.
- Documents seen: 100.
- Candidate containers found: 4.
- Candidate counts: 46, 43, 10, and 1 documents.
- Errors: 0.
- Raw labels included in stdout or output JSON: no.
- Raw memory/title/prompt/answer text included: no.
- Private map written in opt-in run: yes in the earlier safety check.
- Private map mode: `0600` when requested.

Boundary:

- This proves the key can list hosted metadata and that the discovery command
  can identify source-container candidates safely.
- It does not choose a source container for the benchmark.
- It does not close the hosted-baseline blocker.
- The raw private map is local operator material and must not be attached to
  public evidence, reviewer packets, or GitHub.
