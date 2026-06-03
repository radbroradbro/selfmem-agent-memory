# Brain UI Model Matrix Evidence

Date: 2026-05-22

Scope:

- Fixture-only Model Matrix panel in the self-hosted Brain UI.
- Cloud and local provider arms for the May 2026 autoresearch matrix.
- Query-expansion, credential, reviewer, and hosted-baseline guardrails.

Result:

- Mode: `fixture-brain-ui-model-matrix`
- Writes real files: false
- Metrics-only: true
- Status: `guarded`
- Provider arms: 6
- Cloud arms: 4
- Local arms: 2
- Gates: 5
- Blockers: 3
- Console errors: 0
- Private/key-shaped visible text: false

Visible defaults:

- Cloud default: `cloud-voyage4-voyage`
- Local default: `local-apple-qwen3-0_6b`
- Query expansion: off
- Credentials: env-only

Visible lanes:

- Apple Silicon local lane targets 24GB-class Macs.
- Local default uses `Qwen3-Embedding-0.6B-GGUF`,
  `Qwen3-Reranker-0.6B`, and `llama.cpp with Metal`.
- Cloud arms show Voyage, Gemini, and NVIDIA NIM challenger paths.

Evidence files:

- `reviews/overnight-20260522/ui-evidence/brain-ui-model-matrix-evidence.json`
- `reviews/overnight-20260522/ui-evidence/brain-ui-model-matrix.png`

Notes:

- The panel is public-safe and fixture-only. It does not read local memories,
  raw transcripts, diagnostics, credentials, hosted Supermemory contents, real
  agent names, or local paths.
- The UI keeps exact backend arm ids visible for operators while giving the
  human a readable cloud/local model summary.
- Query expansion stays off until a matched source-locked canary proves a
  quality gain under the same dataset slice, query set, judge, answer model,
  scoring code, privacy scan, and reviewer sign-off.
- The panel does not claim RecallWeave is SOTA. It shows a guarded test matrix
  that must be benchmarked before any public score claim.
