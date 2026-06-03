---
title: "LongMemEval Benchmark Topics"
type: "methodology"
category: "benchmark"
tags: ["longmemeval", "benchmark", "local-full", "wiki"]
aliases: []
sources:
  - "reviews/overnight-20260522/local-full-shard-performance-report-after-shard-013-20260528.json"
  - "reviews/overnight-20260522/answer-quality-local-full-shard-intake-after-shard-013-20260528.json"
confidence: 0.7
version: 1
provenance:
  extracted: []
  inferred:
    - "Derived from public-safe local-full benchmark metrics."
  ambiguous:
    - "Topic categories are method-level summaries, not raw benchmark question categories."
reviewed: false
---

# LongMemEval Benchmark Topics

Accepted questions: 325/500.
Current best local strategy: local-apple-qwen3-0_6b-local-rerank (29.1385).

## Topic Ledger

### Local-full coverage is still partial

- Status: blocked
- Evidence: 325/500 questions accepted across 13/20 shards.
- Decision: Do not claim local-full or SOTA completion until all planned shards are accepted and combined.
- Next action: Run shard-014 (325-350).

### BM25 remains the lexical floor

- Status: active-control
- Evidence: bm25-lite score 25.88; p50 9404.0769 ms.
- Decision: Keep BM25 in every fair comparison and use it as the fallback/control arm.
- Next action: Compare every promoted retrieval method against BM25 on the same accepted shard set.

### Local Apple rerank is the current local winner

- Status: positive-signal
- Evidence: local-apple-qwen3-0_6b-local-rerank score 29.1385; delta vs BM25 3.2585; delta vs base 5.5847.
- Decision: Treat local rerank as the current method-refinement candidate, not as a public benchmark claim.
- Next action: Keep local rerank in shard-014 and watch whether the gain survives beyond 65% coverage.

### Plain full-hybrid is not promoted on current answer-quality evidence

- Status: not-promoted
- Evidence: full-hybrid-rerank score 20.9723; delta vs BM25 -4.9077.
- Decision: Do not treat deterministic full-hybrid as superior on the current accepted-shard aggregation.
- Next action: Use per-shard diagnostics to identify whether dense or rerank ordering is hurting specific categories.

### Query expansion remains negative

- Status: negative-signal
- Evidence: query-expanded-full-hybrid-rerank score 20.8492; delta vs BM25 -5.0308.
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

Use public wiki pages for method recall and private local indexes for raw evidence review.

Public wiki stores method notes, aggregate scores, hashes, shard ranges, and blocker classes. Raw benchmark questions, answer labels, session text, candidate chunks, and vector payloads stay in local private indexes.

