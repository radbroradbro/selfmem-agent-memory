# RecallWeave Provider Benchmark Operator Packet

Provider lane: voyage
Public launch allowed: no
Public benchmark claims allowed: no
Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json
Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c

## Current Preflight

- Status: BLOCKED_PROVIDER_ENV
- Live run allowed now: false
- Calls provider APIs now: false
- Sends benchmark text now: false
- Required providers: voyage
- Missing providers: voyage

## Same-Data Strategies

- bm25-lite
- full-hybrid-rerank
- cloud-voyage4-voyage

## Commands

### store-credentials-outside-repo

Put any provider key in a private file outside the repository with 0600 permissions. Do not paste keys into commands or committed files.



### preflight-require-ready


```bash
RECALLWEAVE_PROVIDER_OUTPUT_DIR=<private-output-dir-outside-repo>
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
VOYAGE_API_KEYS_FILE=<private-file-outside-repo>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage --require-ready --output "$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-preflight.json"
```

### run-same-data-provider-comparison


```bash
RECALLWEAVE_PROVIDER_OUTPUT_DIR=<private-output-dir-outside-repo>
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
VOYAGE_API_KEYS_FILE=<private-file-outside-repo>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage --max-memory-bytes 80000000 --output "$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.json" --markdown-output "$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.md"
```

### scan-returned-artifacts


```bash
rg -n "(pa-|AIza|sm_|nvapi-|jina_|ghp_|github_pat_|sk-|Bearer |memories\.jsonl|raw_events\.jsonl|lossless_context\.jsonl)" "$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-preflight.json" "$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.json" "$RECALLWEAVE_PROVIDER_OUTPUT_DIR/recallweave-provider-result.md" || true
```

## Pass Criteria

- preflight reports READY_FOR_LIVE_PROVIDER_BENCHMARK before the live run
- result includes bm25-lite, full-hybrid-rerank, and the selected provider arm
- all arms use the same target hash, query-set hash, scoring-code hash, context budget, and limit
- privacyLeakCount and redactionFailureCount are zero for every arm
- rawQuestionsIncluded, rawAnswersIncluded, and rawMemoryIncluded remain false
- provider-backed arm beats bm25-lite on quality or materially improves a secondary metric without quality regression
- publicBenchmarkClaimsAllowed remains false until the result receives the required review/owner approval path

## Attach Back

- recallweave-provider-preflight.json
- recallweave-provider-result.json
- recallweave-provider-result.md

## Do Not Attach

- provider keys
- key files
- raw benchmark question text
- raw answers
- raw memories
- raw transcripts
- private local paths
- unredacted diagnostics
