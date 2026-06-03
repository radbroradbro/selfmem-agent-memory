# Local-Full Benchmark Topic Ledger

- Status: PARTIAL_LOCAL_FULL_TOPIC_LEDGER
- Accepted questions: 475/500
- Coverage: 95%
- Next pending shard: shard-020 (475-500)
- Best strategy: local-apple-qwen3-0_6b-local-rerank
- Best answer quality: 26
- Public benchmark claims allowed: false

## Topics

### Local-full coverage is still partial

- Status: blocked
- Evidence: 475/500 questions accepted across 19/20 shards.
- Decision: Do not claim local-full or SOTA completion until all planned shards are accepted and combined.
- Next action: Run shard-020 (475-500).

### BM25 remains the lexical floor

- Status: active-control
- Evidence: bm25-lite score 23.1179; p50 8702.8421 ms.
- Decision: Keep BM25 in every fair comparison and use it as the fallback/control arm.
- Next action: Compare every promoted retrieval method against BM25 on the same accepted shard set.

### Local Apple rerank is the current local winner

- Status: positive-signal
- Evidence: local-apple-qwen3-0_6b-local-rerank score 26; delta vs BM25 2.8821; delta vs base 4.6632.
- Decision: Treat local rerank as the current method-refinement candidate, not as a public benchmark claim.
- Next action: Keep local rerank in shard-020 and watch whether the gain survives beyond 95% coverage.

### Plain full-hybrid is not promoted on current answer-quality evidence

- Status: not-promoted
- Evidence: full-hybrid-rerank score 19.2968; delta vs BM25 -3.8211.
- Decision: Do not treat deterministic full-hybrid as superior on the current accepted-shard aggregation.
- Next action: Use per-shard diagnostics to identify whether dense or rerank ordering is hurting specific categories.

### Query expansion remains negative

- Status: negative-signal
- Evidence: query-expanded-full-hybrid-rerank score 19.0442; delta vs BM25 -4.0737.
- Decision: Keep query expansion experimental and disabled as a default method until a same-data accepted shard win appears.
- Next action: Audit rewrite quality, fallback frequency, and category sensitivity before spending more full-shard cycles.

### Wiki title and subtopic amplification are wired but unproven

- Status: fixture-only
- Evidence: wiki fixture query count 3; winner bm25-lite; quality delta vs BM25 0.
- Decision: Do not promote title or subtopic boost from a fixture tie.
- Next action: Run a local-wiki shard plan or retrieval-proxy stress slice that includes wiki-title and wiki-subtopic arms.

### Hosted Supermemory comparison is separate from local-full methodology

- Status: canary-boundary-recorded
- Evidence: hosted canary quality 0; RecallWeave canary quality 0.1212; query count 8.
- Decision: Do not compare local-full partial shards to Supermemory reported SOTA or free-tier canaries as if they are the same benchmark.
- Next action: Use hosted Supermemory only in explicit hosted-baseline runs; keep it disabled for method refinement shards.

## Storage Policy

- Rule: Use public wiki pages for method recall and private local indexes for raw evidence review.
- Public wiki stores: strategy names, metric aggregates, query shard ranges, hashes, method decisions, blocker classes
- Private index stores: raw benchmark questions, raw answer labels, raw memory/session text, retrieved candidate chunks, local vector index payloads

## Next Actions
- Run shard-020 with hosted Supermemory search disabled and regenerate this ledger.
- Run a local-wiki shard plan before promoting title or subtopic amplification beyond fixture status.
- Keep raw LongMemEval material outside repo-facing wiki artifacts; index it only in local private storage.
