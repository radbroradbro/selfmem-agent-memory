# Local Apple Persistent Cache Smoke

Date: 2026-05-24

Purpose: prove that the local Apple benchmark path can reuse document
embeddings across runs without storing raw memory text, credentials, transcripts,
or private paths in public benchmark reports.

Method:

- Used a temporary fake OpenAI-compatible embedding server.
- Used only fixture queryset and fixture memories.
- Set `RECALLWEAVE_PROVIDER_BENCHMARK_CALLS=1` and
  `RECALLWEAVE_PROVIDER_BENCHMARK_PUBLIC_DATA=1`.
- Set `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`.
- Set `SELFMEM_LOCAL_EMBED_CACHE_PATH` to a temporary path outside the
  repository.
- Deleted the temporary cache after the smoke check.

Result:

| Run | Provider calls | Document count sent | Cache hits | Cache misses | Cache writes | Entries loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| first | 6 | 8 | 4 | 5 | 5 | 0 |
| second | 3 | 3 | 9 | 0 | 0 | 5 |

Interpretation:

- The first run embedded missing documents and wrote 5 cache entries.
- The second run loaded all 5 entries and had zero document cache misses.
- Remaining provider calls are query embeddings, which are intentionally not
  cached in this gate.
- The smoke used fixture data only and produced metrics-only output.

This makes larger local Apple Silicon benchmark runs practical, but it is not a
quality claim. Promotion still requires a live public benchmark result.
