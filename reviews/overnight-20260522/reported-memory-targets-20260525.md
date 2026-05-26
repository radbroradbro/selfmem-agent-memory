# Reported Memory Targets

- Status: READY_REPORTED_TARGETS
- Source evidence checked at: 2026-05-26
- Primary target: supermemory-production-research-gemini-3-pro
- Public safe: true

## Blockers
- none

## Memory Targets
- supermemory-production-research-gpt4o: 81.6 percent on LongMemEval-S; judge=gpt-4o; use=reported-memory-system-target; source=https://supermemory.ai/research/
- supermemory-production-research-gpt5: 84.6 percent on LongMemEval-S; judge=gpt-5; use=reported-memory-system-target; source=https://supermemory.ai/research/
- supermemory-production-research-gemini-3-pro: 85.2 percent on LongMemEval-S; judge=gemini-3-pro; use=primary-reported-memory-system-target; source=https://supermemory.ai/research/
- supermemory-experimental-asmr: 98.6 percent on LongMemEval-S; judge=multi-agent experimental flow; use=ceiling-reference-not-production-target; source=https://supermemory.ai/blog/we-broke-the-frontier-in-agent-memory-introducing-99-sota-memory-system/

## Component Targets
- qwen3-embedding-0_6b-mteb-english-v2: Qwen3-Embedding-0.6B, MTEB English v2 mean task score 70.7; use=model-selection-only
- qwen3-embedding-8b-mteb-english-v2: Qwen3-Embedding-8B, MTEB English v2 mean task score 75.22; use=model-selection-only
- qwen3-embedding-4b-mteb-english-v2: Qwen3-Embedding-4B, MTEB English v2 mean task score 74.6; use=model-selection-only
- qwen3-reranker-0_6b-mteb-r: Qwen3-Reranker-0.6B, MTEB-R reranker score 65.8; use=model-selection-only
- qwen3-reranker-4b-mteb-r: Qwen3-Reranker-4B, MTEB-R reranker score 69.76; use=model-selection-only
- qwen3-reranker-8b-mteb-r: Qwen3-Reranker-8B, MTEB-R reranker score 69.02; use=model-selection-only
- embeddinggemma-local-model-card: EmbeddingGemma, provider model card small on-device embedding model n/a; use=model-selection-only
- voyage-4-rerank-2-5-model-card: Voyage 4 plus rerank-2.5, provider model card retrieval and rerank recommendation n/a; use=model-selection-only
- gemini-embedding-2-model-card: Gemini Embedding 2, provider model card multimodal embedding endpoint availability n/a; use=model-selection-only
- nvidia-retrieval-nim-model-card: NVIDIA Retrieval NIM, provider model card embedding and rerank endpoint availability n/a; use=model-selection-only

## Benchmark Harness Targets
- memorybench-supermemory-unified-suite: MemoryBench; families=locomo, longmemeval, convomem; providers=supermemory, mem0, zep; use=benchmark-harness-source-only

## Required Coverage
- Minimum source evidence date: 2026-05-26
- Missing component source locks: none
- Missing benchmark harness source locks: none

## Rule
Reported scores can substitute for direct hosted usage when quota is blocked, but only as source-locked targets. RecallWeave still needs matching benchmark, scorer, answer model, judge model, and full-memory answer-quality evidence before a win counts.

## Next Actions
- Use the primary reported memory target as the SOTA comparison row in the ladder.
- Keep component targets in the model-selection lane only.
- Use benchmark harness targets only to choose a same-data full-memory evaluation route.
- Refresh this source-lock artifact whenever the public source rows or model matrix changes.
