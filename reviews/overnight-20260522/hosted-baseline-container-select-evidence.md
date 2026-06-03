# Hosted Baseline Container Selector Evidence

## Scope

Added `baseline:select-container` as the private bridge between safe hosted
discovery and live hosted collection.

The selector reads:

- a public `baseline:discover` report with hashed container candidates,
- a local-only private map with raw hosted labels.

It writes:

- a 0600 private env file for the selected hosted container.

It prints only a public-safe JSON receipt.

## Verification

Commands run:

```bash
node --check packages/bench/hosted-baseline-container-select.mjs
node packages/bench/hosted-baseline-container-select.mjs --fixture --env-output <tmp-private-env> --output <tmp-public-report>
RECALLWEAVE_BASELINE_LIVE=1 RECALLWEAVE_BASELINE_ALLOW_PRIVATE_LABELS=1 node packages/bench/hosted-baseline-discovery.mjs --live --limit 50 --max-pages 1 --output <tmp-public-discovery> --private-map-output <tmp-private-map>
node packages/bench/hosted-baseline-container-select.mjs --discovery <tmp-public-discovery> --private-map <tmp-private-map> --env-output <tmp-private-env> --output <tmp-public-selection-report>
```

Result:

- Mode: `hosted-baseline-container-select`
- Public safe: yes
- Metrics only: yes
- Calls hosted provider: no
- Raw labels included: no
- Raw memory included: no
- Private env mode: `0600`
- Private env attachable to public evidence: no
- Private map and private env must stay outside the repository.
- Live selector smoke: non-fixture, three private-map entries, selected hashed
  candidate had 43 hosted documents, private-map mode 0600, private-env mode
  0600, raw labels included in stdout/public report: no.

The fixture private env contains the raw fixture label by design, but stdout
and the public report do not. The release gate also rejects an env-output path
inside the repository.

## Integration

The selector is now included in:

- `package.json` as `baseline:select-container`,
- `hosted-baseline-operator-packet`,
- `hosted-baseline-next-run`,
- `release-blocker-doctor`,
- clean consumer smoke,
- release readiness checks,
- public docs for the hosted-baseline lane.

This does not close the hosted-baseline blocker. It only makes the next live
run safer and less error-prone.
