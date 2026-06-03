# Voyage Provider Rate-Limit Blocker

- Status: BLOCKED_VOYAGE_RATE_LIMIT
- Provider: voyage
- HTTP status: 429
- Target hash: sha256:56438ca47ca525b75c7fac7b63f0f2bc30a4b244ddd270ed7fd8f492c6c9be0c
- Fresh retry: 2026-05-25T21:44:39.000Z
- Public safe: true
- Raw questions included: false
- Raw answers included: false
- Raw memory included: false
- Raw transcript included: false
- Credentials printed: false

## Attempted Arms

- cloud-voyage4-voyage
- cloud-voyage4-lite-voyage-lite

## Fresh Retry Evidence

- Same-data LongMemEval materialization completed outside the repository.
- Local control response arms exported: bm25-lite, full-hybrid-rerank.
- Fresh Voyage arm attempted: cloud-voyage4-voyage.
- Provider pacing: 12000 ms minimum interval, 2 retry attempts.
- Result: Voyage returned HTTP 429 before a Voyage response arm was exported.
- No private paths, raw benchmark text, provider response body, or credentials are committed.

## Result

The NVIDIA same-data answer-quality arm completed, but the Voyage arms hit provider
rate limits after retry/backoff, stricter pacing, and a fresh same-data retry. This keeps the Voyage
answer-quality row incomplete and blocks any full SOTA or hosted-memory
replacement claim.

## Next Actions

- Retry Voyage after quota or rate-limit reset.
- Keep the SOTA ladder blocked on missing Voyage same-data answer-quality.
- Do not substitute NVIDIA, MTEB, or reported Supermemory stats for a same-data
  Voyage result.
