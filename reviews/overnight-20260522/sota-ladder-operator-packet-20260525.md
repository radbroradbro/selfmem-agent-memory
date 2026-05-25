# RecallWeave SOTA Ladder Operator Packet

- Status: BLOCKED_SOTA_OPERATOR_INPUTS
- Public benchmark claims allowed: false
- Target: reviews/overnight-20260522/public-longmemeval-expanded-run-target.json
- Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c

## Current Blockers
- all-current-result-files-keep-public-claims-disabled
- missing-voyage-answer-quality-same-data-result
- voyage-provider-rate-limited

## Current Evidence
- SOTA ladder: BLOCKED_FULL_MEMORY_SOTA_EVIDENCE
- Query expansion preflight: PURE_LOCAL_QUERY_EXPANSION_READY
- Provider preflight: READY_FOR_LIVE_PROVIDER_BENCHMARK
- Voyage provider blocker: BLOCKED_VOYAGE_RATE_LIMIT
- Provider challenger result gate: BLOCKED_PROVIDER_CHALLENGER_RESULT
- End-to-end memory score gate: BLOCKED_END_TO_END_MEMORY_SCORE
- Live-local answer quality: true
- Live-local winner: local-apple-qwen3-0_6b-local-rerank (36)
- Live-provider answer quality: true
- Live-provider winner: cloud-nvidia-nemotron-1b (43.1667)
- Memory score reviewer intake: READY_MEMORY_SCORE_REVIEWERS
- Answer-quality arm export: EXPORTED_RESPONSE_ARMS
- Answer-quality preflight: READY_FOR_LIVE_ANSWER_QUALITY
- Answer-quality harness smoke: public-benchmark-answer-quality
- Local rerank evidence: true
- Local rerank result gate: BLOCKED_LOCAL_RERANK_RESULT
- Query expansion local smoke: true
- Query expansion result gate: BLOCKED_QUERY_EXPANSION_RESULT
- Live LLM query expansion proven: true

## Operator Flow
### refresh-current-safe-gates

Refresh the blocked/ready state without provider calls or raw benchmark text.

```bash
RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>
npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder -- --output reviews/overnight-20260522/sota-ladder-report.json --markdown-output reviews/overnight-20260522/sota-ladder-report.md
npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --output reviews/overnight-20260522/query-expansion-preflight-next.json --markdown-output reviews/overnight-20260522/query-expansion-preflight-next.md
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank --output reviews/overnight-20260522/provider-preflight-next.json
```

### pure-local-query-expansion-arm

Use this only after a local OpenAI-compatible model endpoint is running. This may count as local-only when no cloud model is used.

```bash
SELFMEM_QUERY_EXPANSION_BASE_URL=<local-openai-compatible-url>
SELFMEM_QUERY_EXPANSION_MODEL=<local-query-expansion-model>
RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>
npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --require-ready
npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank --context-token-budget 800 --limit 5 --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.md"
npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:result-gate -- --require-ready --result "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-result.json" --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-gate.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-pure-local-gate.md"
```

Before counting this as LLM query expansion:

- Verify the strategy used the configured local query-expansion endpoint, not only the deterministic expansion proxy.
- Record query-expansion latency separately from embedding and rerank latency.

### mixed-cloud-query-expansion-arm

Use this when local hardware is the limiting factor. It must be labeled mixed local-plus-cloud, not pure local.

```bash
RECALLWEAVE_QUERY_EXPANSION_CALLS=1
RECALLWEAVE_QUERY_EXPANSION_PUBLIC_DATA=1
NVIDIA_API_KEYS_FILE=<private-file-outside-repo>
RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>
npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:preflight -- --require-ready
npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank --context-token-budget 800 --limit 5 --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.md"
npm exec --yes pnpm@10.23.0 -- benchmark:query-expansion:result-gate -- --require-ready --result "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-result.json" --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-gate.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/query-expansion-mixed-cloud-gate.md"
```

Before counting this as LLM query expansion:

- Verify only the current user query is sent to the cloud expansion model.
- Record provider, model, cost, and latency as a cloud substep.

### local-reranker-sidecar-arm

Run the local Apple embedding arm with a separate local reranker endpoint.

```bash
SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>
SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-server-url>
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --require-ready --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-preflight.json"
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,local-apple-qwen3-0_6b-local-rerank --max-memory-bytes 80000000 --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.md"
npm exec --yes pnpm@10.23.0 -- benchmark:local-rerank:result-gate -- --require-ready --result "$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-result.json" --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-gate.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/local-rerank-gate.md"
```

### provider-comparison-ladder

Run provider challengers on the same target only after preflight is ready and public-data/provider-call consent is explicit.

```bash
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
VOYAGE_API_KEYS_FILE=<private-file-outside-repo>
GEMINI_API_KEYS_FILE=<private-file-outside-repo>
NVIDIA_API_KEYS_FILE=<private-file-outside-repo>
SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>
RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider:preflight -- --require-ready --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-preflight-ready.json"
npm exec --yes pnpm@10.23.0 -- benchmark:public-provider -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank --max-memory-bytes 80000000 --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.md"
npm exec --yes pnpm@10.23.0 -- benchmark:provider-challenger:result-gate -- --require-ready --result "$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-same-data-result.json" --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-challenger-gate.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/provider-challenger-gate.md"
```

### end-to-end-memory-score-and-review

Do not ship public benchmark or production-replacement claims until answer quality, reviewers, UI, docs, and owner approval are all present.

```bash
RECALLWEAVE_SOTA_OUTPUT_DIR=<private-output-dir-outside-repo>
RECALLWEAVE_BASELINE_LIVE=1
RECALLWEAVE_BASELINE_NO_RAW_TEXT=1
RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1
RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1
SELFMEM_QUERY_EXPANSION_BASE_URL=<local-query-expansion-url-or-use-approved-cloud-env>
SELFMEM_QUERY_EXPANSION_MODEL=<local-query-expansion-model-or-use-approved-cloud-env>
VOYAGE_API_KEYS_FILE=<private-file-outside-repo>
NVIDIA_API_KEYS_FILE=<private-file-outside-repo>
SELFMEM_LOCAL_EMBED_BASE_URL=<local-embedding-server-url>
SELFMEM_LOCAL_RERANK_BASE_URL=<local-rerank-server-url>
npm exec --yes pnpm@10.23.0 -- benchmark:sota-ladder
npm exec --yes pnpm@10.23.0 -- benchmark:public-materialize -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --private-output-dir "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized" --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialize-report.json"
npm exec --yes pnpm@10.23.0 -- benchmark:public-strategy -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank --context-token-budget 800 --limit 5 --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/full-ladder-same-data-result.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/full-ladder-same-data-result.md"
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:arms -- --execute --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --queryset "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json" --memories "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl" --private-output-dir "$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms" --strategies bm25-lite,dense-proxy,full-hybrid-rerank,query-expanded-full-hybrid-rerank,cloud-voyage4-voyage,cloud-gemini-voyage-rerank,cloud-nvidia-nemotron-1b,local-apple-qwen3-0_6b,local-apple-qwen3-0_6b-local-rerank --context-token-budget 800 --limit 5 --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-arm-export.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-arm-export.md"
npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality:preflight -- --require-ready --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --queryset "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json" --memories "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl" --answer-labels "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-answer-labels.private.json" --arm bm25-lite="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/bm25-lite-responses.private.json" --arm dense-proxy="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/dense-proxy-responses.private.json" --arm full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/full-hybrid-rerank-responses.private.json" --arm query-expanded-full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/query-expanded-full-hybrid-rerank-responses.private.json" --arm cloud-voyage4-voyage="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/cloud-voyage4-voyage-responses.private.json" --arm cloud-gemini-voyage-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/cloud-gemini-voyage-rerank-responses.private.json" --arm cloud-nvidia-nemotron-1b="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/cloud-nvidia-nemotron-1b-responses.private.json" --arm local-apple-qwen3-0_6b="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/local-apple-qwen3-0_6b-responses.private.json" --arm local-apple-qwen3-0_6b-local-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/local-apple-qwen3-0_6b-local-rerank-responses.private.json" --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-preflight.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/answer-quality-preflight.md"
RECALLWEAVE_MEMORYBENCH_ANSWER_QUALITY_CALLS=1 RECALLWEAVE_MEMORYBENCH_PUBLIC_DATA=1 RECALLWEAVE_MEMORYBENCH_NO_RAW_TEXT_OUTPUT=1 npm exec --yes pnpm@10.23.0 -- benchmark:answer-quality -- --live --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --queryset "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-queryset.private.json" --memories "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-memories.private.jsonl" --answer-labels "$RECALLWEAVE_SOTA_OUTPUT_DIR/materialized/longmemeval-answer-labels.private.json" --arm bm25-lite="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/bm25-lite-responses.private.json" --arm dense-proxy="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/dense-proxy-responses.private.json" --arm full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/full-hybrid-rerank-responses.private.json" --arm query-expanded-full-hybrid-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/query-expanded-full-hybrid-rerank-responses.private.json" --arm cloud-voyage4-voyage="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/cloud-voyage4-voyage-responses.private.json" --arm cloud-gemini-voyage-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/cloud-gemini-voyage-rerank-responses.private.json" --arm cloud-nvidia-nemotron-1b="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/cloud-nvidia-nemotron-1b-responses.private.json" --arm local-apple-qwen3-0_6b="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/local-apple-qwen3-0_6b-responses.private.json" --arm local-apple-qwen3-0_6b-local-rerank="$RECALLWEAVE_SOTA_OUTPUT_DIR/response-arms/local-apple-qwen3-0_6b-local-rerank-responses.private.json" --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.md"
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:reviewer-intake -- --strict-target --result "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json" --review <reviewer-a-memory-score-approval.json> --review <reviewer-b-memory-score-approval.json> --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/memory-score-reviewer-intake.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/memory-score-reviewer-intake.md"
npm exec --yes pnpm@10.23.0 -- benchmark:memory-score:result-gate -- --require-ready --result "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score.json" --reviewer-approval-report "$RECALLWEAVE_SOTA_OUTPUT_DIR/memory-score-reviewer-intake.json" --target reviews/overnight-20260522/public-longmemeval-expanded-run-target.json --output "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-gate.json" --markdown-output "$RECALLWEAVE_SOTA_OUTPUT_DIR/end-to-end-memory-score-gate.md"
npm exec --yes pnpm@10.23.0 -- baseline:packet -- --hosted <metrics-only-hosted-result.json> --recallweave <metrics-only-recallweave-result.json> --comparison <metrics-only-comparison.json> --preflight <metrics-only-preflight.json> --strict-real --output <metrics-only-reviewer-packet.zip>
npm exec --yes pnpm@10.23.0 -- baseline:reviewer-intake -- --packet <metrics-only-reviewer-packet.zip> --comparison <metrics-only-comparison.json> --strict-target --review <reviewer-a-approval.json> --review <reviewer-b-approval.json> --output reviews/overnight-20260522/reviewer-approval-report.json
```

## Pass Criteria
- All arms use the exact same source-locked target, query-set hash, scoring-code hash, context budget, and limit.
- BM25, dense/vector-only, full-hybrid, local Apple embedding, local Apple reranker, Voyage, NVIDIA or Gemini, and query-expansion arms all have same-data rows.
- The query-expansion arm states whether it is pure local or mixed local-plus-cloud, and mixed arms name the cloud substep.
- The query-expansion arm proves live LLM expansion wiring before it is counted as an LLM query-expansion result.
- The final claim uses an end-to-end memory answer-quality score, not retrieval-proxy or MTEB-only evidence.
- Supermemory reported scores are comparison targets only unless the same harness/dataset/judge semantics are matched.
- privacyLeakCount and redactionFailureCount are zero for every attached report.
- Two independent reviewers approve the exact metrics-only packet before owner review or public release wording changes.
- Brain UI evidence, docs, and release notes are updated after the benchmark result is known.

## Reviewer Packet
- Attach: metrics-only SOTA ladder report
- Attach: query-expansion preflight and run report
- Attach: same-data provider/local strategy reports
- Attach: end-to-end memory answer-quality report
- Attach: UI screenshots or browser evidence for the brain view
- Attach: docs and release-note diff
- Do not attach: provider keys
- Do not attach: raw benchmark questions
- Do not attach: raw answers
- Do not attach: raw memory logs
- Do not attach: raw transcripts
- Do not attach: private local paths
- Do not attach: implementer scratchpad or hidden reasoning
