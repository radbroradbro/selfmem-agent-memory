---
title: "LongMemEval Benchmark Topics"
type: "methodology"
category: "benchmark"
tags: ["longmemeval", "benchmark", "local-full", "wiki"]
aliases: []
sources:
  - "reviews/overnight-20260522/local-full-shard-performance-report-after-shard-020-20260529.json"
  - "reviews/overnight-20260522/answer-quality-local-full-shard-intake-after-shard-020-20260529.json"
  - "reviews/overnight-20260522/public-longmemeval-wiki-amplification-q075-078-20260531.json"
  - "reviews/overnight-20260522/public-longmemeval-full-provider-wave-q075-078-keyrotation-20260530.json"
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

Accepted questions: 500/500.
Current best local strategy: local-apple-qwen3-0_6b-local-rerank (24.9).

## Topic Ledger

### Local-full coverage is complete

- Status: complete
- Evidence: 500/500 questions accepted across 20/20 shards.
- Decision: Treat the completed local-full lane as diagnostic evidence only; full SOTA and production claims still require the provider/full-memory gates.
- Next action: Run combine, memory-score, reviewer, and provider/full-memory gates before any public claim changes.

### BM25 remains the lexical floor

- Status: active-control
- Evidence: bm25-lite score 22.162; p50 8618.9 ms.
- Decision: Keep BM25 in every fair comparison and use it as the fallback/control arm.
- Next action: Compare every promoted retrieval method against BM25 on the same accepted shard set.

### Local Apple rerank is the current local winner

- Status: positive-signal
- Evidence: local-apple-qwen3-0_6b-local-rerank score 24.9; delta vs BM25 2.738; delta vs base 4.23.
- Decision: Treat local rerank as the current method-refinement candidate, not as a public benchmark claim.
- Next action: Keep local rerank through final combine and memory-score gates.

### Plain full-hybrid is not promoted on current answer-quality evidence

- Status: not-promoted
- Evidence: full-hybrid-rerank score 18.532; delta vs BM25 -3.63.
- Decision: Do not treat deterministic full-hybrid as superior on the current accepted-shard aggregation.
- Next action: Use per-shard diagnostics to identify whether dense or rerank ordering is hurting specific categories.

### Query expansion remains negative

- Status: negative-signal
- Evidence: query-expanded-full-hybrid-rerank score 18.292; delta vs BM25 -3.87.
- Decision: Keep query expansion experimental and disabled as a default method until a same-data accepted shard win appears.
- Next action: Audit rewrite quality, fallback frequency, and category sensitivity before spending more full-shard cycles.

### Wiki title and subtopic amplification are wired but unproven

- Status: retrieval-proxy-not-promoted
- Evidence: q075-q078 retrieval slice completed; winner bm25-lite; promote=false; bm25-lite=0.1575; full-hybrid-rerank=0.1575; wiki-title-amplified-hybrid=0.1575; wiki-subtopic-amplified-hybrid=0.1575; wiki-summary-session-hybrid=0.1575.
- Decision: Do not promote title or subtopic boost until it wins accepted answer-quality shards, not just fixture or retrieval-proxy checks.
- Next action: Keep wiki title/subtopic/session arms benchmark-gated; use the bounded-pool q075 slice as runtime evidence, not promotion evidence.

### Cloud provider arms are hybrid challengers, not pure vector replacements

- Status: retrieval-proxy-not-promoted
- Evidence: q075-q078 provider retrieval slice completed; winner bm25-lite; promote=false; cloud-gemini2-embed-rerank-proxy=0.1575; cloud-nvidia-nv-embed-v1-mistral-rerank=0.1575.
- Decision: Keep Gemini/NVIDIA/Voyage/local provider arms behind the BM25-plus-hybrid candidate pool and require same-data answer-quality wins before promotion.
- Next action: Run provider challengers one provider at a time on larger or accepted answer-quality slices; keep Voyage rate-limit evidence separate from quality evidence.

### Latest cloud provider q085-q090 wave is operationally blocked

- Status: provider-lane-blocked
- Evidence: q85-q90 status PARTIAL_COMPLETED_WITH_ARM_FAILURES; completed rows bm25-lite, full-hybrid-rerank; failed provider arms cloud-gemini2-embed-rerank-proxy:provider-rate-limit; cloud-voyage4-voyage-lite-rerank:provider-rate-limit; cloud-nvidia-nv-embed-v1-mistral-rerank:provider-timeout; winner among completed rows bm25-lite.
- Decision: Do not read provider rate limits or timeouts as retrieval-quality losses. Treat them as cloud-lane operational blockers until a provider arm returns a scored row.
- Next action: Retry one provider at a time with bounded candidate and batch settings, or keep method refinement on local/BM25 lanes until provider calls are reliable.

### Hosted Supermemory comparison is separate from local-full methodology

- Status: canary-boundary-recorded
- Evidence: hosted canary quality 0; RecallWeave canary quality 0.1212; query count 8.
- Decision: Do not compare local-full partial shards to Supermemory reported SOTA or free-tier canaries as if they are the same benchmark.
- Next action: Use hosted Supermemory only in explicit hosted-baseline runs; keep it disabled for method refinement shards.

## Storage Policy

Use public wiki pages for method recall and private local indexes for raw evidence review.

Public wiki stores method notes, aggregate scores, hashes, shard ranges, and blocker classes. Raw benchmark questions, answer labels, session text, candidate chunks, and vector payloads stay in local private indexes.

