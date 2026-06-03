# RecallWeave Private Provider Env Pointer

- Status: private env present
- Private path: `~/.config/recallweave/providers.private.env`
- Public safe: true
- Secret values included here: false

## Usage

Load before hosted-provider benchmark lanes:

```sh
set -a
source "$HOME/.config/recallweave/providers.private.env"
set +a
```

## Variables Provided Privately

- `NVIDIA_API_KEY`
- `NVCF_API_KEY`
- `NVIDIA_PROVIDER_MIN_INTERVAL_MS`
- `OPENROUTER_API_KEY`
- `OPENROUTER_PROVIDER_MIN_INTERVAL_MS`
- `OPENROUTER_PROVIDER_MAX_RETRIES`
- `OPENROUTER_PROVIDER_TIMEOUT_MS`
- `RECALLWEAVE_OPENROUTER_QUERY_EXPANSION_MODEL`
- `RECALLWEAVE_OPENROUTER_FALLBACK_QUERY_EXPANSION_MODEL`
- `RECALLWEAVE_NVIDIA_EMBED_MODEL`
- `RECALLWEAVE_PROVIDER_RETRY_ATTEMPTS`
- `RECALLWEAVE_PROVIDER_RETRY_BASE_MS`
- `RECALLWEAVE_PROVIDER_TIMEOUT_MS`
- `RECALLWEAVE_BENCHMARK_DISABLE_SUPERMEMORY_SEARCH`
- `SELFMEM_SUPERMEMORY_SEARCH_DISABLED`

## Benchmark Policy

Use NVIDIA and OpenRouter variables for controlled hosted embed/rerank/query-expansion challenger lanes. Keep hosted Supermemory search disabled for isolated shard methodology runs unless the run is explicitly a hosted Supermemory baseline.
