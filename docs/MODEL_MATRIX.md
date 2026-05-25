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
| Local Apple Silicon | Qwen3 Embedding 0.6B GGUF plus deterministic rerank proxy | Fits 24GB-class Macs better than 4B/8B arms and has 32K context, 1024-dimensional embeddings, and Apache-2.0 model licensing. The live local reranker is a planned challenger, not tested in-stack yet. |
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

Current benchmark support for this lane is local embeddings plus the
deterministic RecallWeave rerank proxy. The provider gate fixture includes the
local Apple arm. A live 30-query public LongMemEval-S retrieval-proxy result is
now recorded for this lane with a 900-token head/tail embedding view and a
persistent document embedding cache. The warm-cache run tied BM25 on quality
and reached 133 ms p50 latency, but it did not beat BM25 and should not be
promoted as the default retrieval winner.

For the stable local benchmark path, start llama.cpp in single-slot embedding
mode and keep document embeddings cached:

```bash
llama-server -hf Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0 \
  --embedding --host 127.0.0.1 --port 8080 \
  -c 8192 -b 4096 -ub 4096 -np 1 -nocb --cache-ram 0
```

Then set:

```bash
SELFMEM_LOCAL_EMBED_BASE_URL=http://127.0.0.1:8080/v1
SELFMEM_LOCAL_EMBED_MAX_TOKENS=900
SELFMEM_LOCAL_EMBED_BATCH_MAX_COUNT=1
```

The default 3000-token embedding view remains useful for cloud arms and may
work with other local runtimes, but it crashed this llama.cpp server on the
30-query local Apple run. Treat that as a runtime configuration blocker until a
new local server build or sidecar proves otherwise.

The reranker lane should first test Qwen3 Reranker 0.6B through a local
OpenAI-compatible rerank endpoint or a small sidecar process. Qwen3 Reranker
4B and 8B stay optional quality arms. They are not the default for 24GB Macs
until measured latency and memory pressure justify them.

The scaled Apple Silicon challenger is `local-apple-qwen3-4b`. It uses
Qwen3 Embedding 4B GGUF as a separate benchmark arm, not an env-only override
of the 0.6B default. Qwen's model card lists 32K context, up to 2560 embedding
dimensions, and GGUF quantizations including `Q4_K_M`, so the first local
quality attempt should use `Q4_K_M` on 24GB-class Macs before trying heavier
quantizations. It must run against the same BM25 and full-hybrid controls and
must earn promotion with measured quality, not model-card scores.

The first measured `local-apple-qwen3-4b` run completed on the 30-query
LongMemEval-S retrieval-proxy target. It tied BM25 on quality, but warm-cache
latency was 290 ms p50, compared with 133 ms p50 for the earlier 0.6B warm
run and 97 ms p50 for BM25 in the matched 4B warm report. Do not promote the
4B embedder as the Apple default from this evidence.

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
| `cloud-voyage4-lite-voyage-lite` | `voyage-4-lite` | `rerank-2.5-lite` | Current latency-sensitive cloud canary winner on the 30-query retrieval-proxy slice. |
| `cloud-voyage4-voyage-lite-rerank` | `voyage-4-large` | `rerank-2.5-lite` | Isolates lite rerank latency while keeping the larger embedder. |
| `cloud-voyage4-voyage` | `voyage-4-large` | `rerank-2.5` | Larger quality reference arm. |
| `cloud-gemini-embed-rerank-proxy` | `gemini-embedding-001`, default 1536 dims | Local deterministic rerank proxy | Gemini embedding challenger without a hosted reranker. |
| `cloud-gemini-voyage-rerank` | `gemini-embedding-001`, default 1536 dims | `rerank-2.5` | Gemini embedding challenger with Voyage rerank held constant. |
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
GOOGLE_API_KEY
GOOGLE_API_KEYS
AI_STUDIO_API_KEY
AI_STUDIO_API_KEYS
NVIDIA_API_KEY
NVIDIA_API_KEYS
OPENROUTER_API_KEY
```

Never commit key files, `.env`, private memory stores, trace logs, raw
diagnostics, screenshots from real agent memory, or exported user data.

The current public-safe provider harness exposes Voyage, Gemini, NVIDIA, and
local Apple Silicon arms:

- `cloud-voyage-rerank-only`: BM25 preselect, then Voyage `rerank-2.5`.
- `cloud-voyage4-voyage`: budgeted BM25 preselect, Voyage `voyage-4-large`
  query/document embeddings, sparse+dense+graph+temporal fusion, then Voyage
  `rerank-2.5`.
- `cloud-voyage4-voyage-lite-rerank`: smaller budgeted BM25 preselect,
  Voyage `voyage-4-large` query/document embeddings, sparse+dense+graph+
  temporal fusion, then Voyage `rerank-2.5-lite`.
- `cloud-voyage4-lite-voyage-lite`: smaller budgeted BM25 preselect, Voyage
  `voyage-4-lite` query/document embeddings, sparse+dense+graph+temporal
  fusion, then Voyage `rerank-2.5-lite`.
- `cloud-gemini-embed-rerank-proxy`: budgeted BM25 preselect, Gemini
  `gemini-embedding-001` query/document embeddings, sparse+dense+graph+temporal
  fusion, then the local deterministic rerank proxy.
- `cloud-gemini-voyage-rerank`: budgeted BM25 preselect, Gemini
  `gemini-embedding-001` query/document embeddings, sparse+dense+graph+temporal
  fusion, then Voyage `rerank-2.5`.
- `cloud-nvidia-retriever-500m`: budgeted BM25 preselect, NVIDIA embedding,
  sparse+dense+graph+temporal fusion, then NVIDIA's smaller reranker challenger.
- `cloud-nvidia-nemotron-1b`: budgeted BM25 preselect, NVIDIA Nemotron
  embedding, sparse+dense+graph+temporal fusion, then the 1B Nemotron reranker.
- `cloud-nvidia-e5-mistral`: budgeted BM25 preselect, NVIDIA E5-style QA
  embedding, sparse+dense+graph+temporal fusion, then the Mistral reranker arm.
- `local-apple-qwen3-0_6b`: budgeted BM25 preselect, an OpenAI-compatible
  local Apple Silicon embedding server, sparse+dense+graph+temporal fusion,
  then the deterministic local rerank proxy until a local reranker passes.
- `local-apple-qwen3-4b`: same local Apple Silicon stack, but labeled for
  Qwen3 Embedding 4B GGUF and 2560-dimensional embeddings.

Live provider benchmark calls require both `RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1`
and `RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1`. The second flag is
intentional: the harness may send benchmark passages to the provider, so it
must only be used on public benchmark slices unless the operator separately
approves private data transfer.

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
