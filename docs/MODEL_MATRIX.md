# Model Matrix

RecallWeave treats model choice as an experiment, not a hidden fallback. Each
provider arm keeps its own embedding space. If an embedding model changes, the
index must be rebuilt or stored separately.

Embedding and reranker benchmark scores are component evidence. MTEB/MMTEB,
BEIR, MIRACL, MS MARCO, and reranker tasks help choose arms, but the final
RecallWeave claim must come from a full memory or retrieval benchmark using the
same public data, dataset revision, and scoring setup as the target row.

## Defaults

| Lane | Default | Why |
|---|---|---|
| Cloud quality | Voyage `voyage-4-large` plus `rerank-2.5` | Strong text and code memory path with same-provider embedding and rerank. Voyage documents `rerank-2.5` as the highest-accuracy reranker and `rerank-2.5-lite` as the latency option. |
| Local Apple Silicon | Qwen3 Embedding 0.6B GGUF plus Qwen3 Reranker 0.6B | Fits 24GB-class Macs better than 4B/8B arms and has 32K context, 1024-dimensional embeddings, and Apache-2.0 model licensing. |
| Multimodal challenger | Gemini Embedding 2 or current Gemini embedding model | Useful for PDFs, images, audio, video, and storage-sensitive dimension tests. Do not make it the default until a matched canary wins. |
| NVIDIA NIM challenger | NVIDIA NeMo Retriever embedding plus rerank pairs | Useful for hosted latency and retrieval comparisons. Keep this as a benchmark arm until measured on RecallWeave canaries. |
| Query expansion | Off by default | Enable only when a canary proves better quality without unacceptable latency or exact-identifier damage. |

## Apple Silicon Local Lane

Recommended first local setup for M-series Macs with about 24GB unified memory:

```bash
brew install llama.cpp
llama-server -hf Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0 --embedding --port 8080
```

Use `SELFMEM_LOCAL_EMBED_BASE_URL=http://127.0.0.1:8080/v1`.

The reranker lane should first test Qwen3 Reranker 0.6B through a local
OpenAI-compatible rerank endpoint or a small sidecar process. Qwen3 Reranker
4B and 8B stay optional quality arms. They are not the default for 24GB Macs
until measured latency and memory pressure justify them.

Local packages should come from source-locked model cards or Hugging Face GGUF
artifacts that are known to run on Apple Silicon. Do not use a random quant or
experimental speed fork as the recommended lane. A quantization or runtime
trick can enter the matrix only as its own canary arm.

Before timing local models, the harness should check for stale `llama-server`,
Ollama, LM Studio, or sidecar rerank processes and either stop only the
RecallWeave-owned process ids or mark the run blocked. Latency numbers are not
credible if an old model server is still using CPU, GPU, or unified memory.

Small local query expansion is a challenger, not a default. If no specialized
query-expansion model is source-locked, test small Apple-friendly instruction
models such as Qwen or Gemma-class variants through the same local
OpenAI-compatible interface and let the canary decide.

## Cloud And Hosted Arms

| Arm | Embedder | Reranker | Status |
|---|---|---|---|
| `cloud-voyage4-voyage` | `voyage-4-large` | `rerank-2.5` | Default cloud canary arm. |
| `cloud-gemini2-cohere4pro` | Gemini Embedding 2 or current Gemini embedding model | Cohere Rerank 4 Pro | Challenger for multimodal and document-heavy memory. |
| `cloud-nvidia-retriever-500m` | `nvidia/llama-nemotron-embed-1b-v2` | `nvidia/llama-3.2-nemoretriever-500m-rerank-v2` | Latency challenger. |
| `cloud-nvidia-nemotron-1b` | `nvidia/llama-nemotron-embed-1b-v2` | `nvidia/llama-nemotron-rerank-1b-v2` | Current text retrieval challenger. |
| `cloud-nvidia-nemotron-vl-1b` | `nvidia/llama-nemotron-embed-vl-1b-v2` | `nvidia/llama-nemotron-rerank-vl-1b-v2` | Multimodal retrieval challenger. |
| `cloud-nvidia-e5-mistral` | `nvidia/nv-embedqa-e5-v5` | `nvidia/nv-rerankqa-mistral-4b-v3` | QA retrieval challenger. |
| `cloud-nvidia-code` | `nvidia/nv-embedcode-7b-v1` | NVIDIA 1B reranker challenger | Code-memory slice only. |

Provider keys are local environment variables only:

```text
VOYAGE_API_KEY
VOYAGE_API_KEYS
GEMINI_API_KEY
GEMINI_API_KEYS
NVIDIA_API_KEY
NVIDIA_API_KEYS
OPENROUTER_API_KEY
```

Never commit key files, `.env`, private memory stores, trace logs, raw
diagnostics, screenshots from real agent memory, or exported user data.

## Query Expansion

Query expansion is off by default.

Query expansion must preserve exact identifiers and private boundaries. It may
send the user query, but not stored memories, raw transcripts, provider keys, or
`<private>` content.

Candidate routes:

- NVIDIA NIM hosted LLM sweep for fast query rewrites.
- Gemini Flash-class model for low-friction AI Studio testing.
- Small local OpenAI-compatible model for zero-spend Apple Silicon smoke tests.

The default remains `rewriteQuery: false` until a source-locked canary proves:

- better quality on the same queries,
- no exact-identifier regression,
- no private-text leakage,
- p95 latency within the configured budget,
- Claude Opus 4.7 and separate Codex GPT-5.5 reviewer sign-off on the
  methodology.

## Autoresearch Setup Gate

Autoresearch may compare Apple Silicon local, Voyage, Gemini, and NVIDIA arms
in one controlled loop only if the harness keeps the arms isolated and the
context packet stays small. If the matrix becomes too wide, split arms across
independent workers that use the same frozen dataset, scoring code, judge, and
privacy scan.

Before any autoresearch change becomes implementation work, Claude Opus 4.7
and a separate Codex GPT-5.5 review must approve the setup. The backend method
must be credible first. The Brain UI pass comes after that, so the front end
shows a proven memory path rather than decorating an unproven one.

## Watchlist

MemReranker is relevant because it targets agent-memory reranking directly, but
it remains a watch item until public weights, license terms, and a local or
hosted route are source-locked. It should not become a default because a paper
score is exciting.

## Sources

- [Voyage AI reranker docs](https://docs.voyageai.com/docs/reranker)
- [Voyage AI model overview](https://www.mongodb.com/docs/voyageai/models/)
- [Gemini Embedding 2 announcement](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/)
- [Gemini embeddings API](https://ai.google.dev/api/embeddings)
- [Qwen3 Embedding 0.6B model card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)
- [Qwen3 Reranker 0.6B model card](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B)
- [Qwen3 Embedding 0.6B GGUF model card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF)
- [NVIDIA retrieval APIs](https://docs.api.nvidia.com/nim/reference/retrieval-apis)
- [NVIDIA LLM APIs](https://docs.api.nvidia.com/nim/reference/llm-apis)
- [MemReranker](https://arxiv.org/abs/2605.06132)
