# Session Compaction Evidence

Date: 2026-05-22

Scope:

- Added a deterministic, fixture-only session compaction harness.
- Added redaction-first candidate extraction for decisions, preferences,
  procedures, bugs, fixes, methodology notes, source notes, and high-level
  profile context.
- Added stale Spring 2026 school-note handling that downshifts old course
  material into one background candidate instead of preserving bulk notes.

Public-safety boundary:

- No real session history was used.
- No raw memory logs, diagnostics, credentials, private paths, or private agent
  state were added.
- Fixture data uses synthetic RecallWeave examples only.

Verification:

- `pnpm test`: 12 tests passed.
- `pnpm typecheck`: passed.
- `pnpm compaction:smoke`: passed with seven chronological candidates, one
  private-tag redaction, one skipped noise event, and zero private text in the
  serialized result.
- `pnpm smoke`: passed privacy, typecheck, OpenClaw smoke, Hermes smoke, Brain
  UI smoke, and session compaction smoke.
- `npm pack --dry-run` in `packages/core`: passed and included compiled
  compaction exports.
- `git diff --check`: passed.
- Public secret-pattern scan: no hits.
- Private-name scan: no hits after neutralizing one review note.

Cold review:

- Gemini CLI reviewed the staged compaction diff and returned `CONCERNS`.
- One real high-severity finding was fixed before commit: candidate IDs used to
  include a reversible base64 slice of candidate text. IDs now use a one-way
  SHA-256 digest slice, and tests assert IDs do not contain encoded text.
- Gemini also flagged hardcoded personal context. Stale handling now accepts
  caller-provided `staleRules`, and the default rule is generalized to completed
  academic-term material.
- A final Gemini re-review returned `CLEAN` after the ID and generic stale
  fallback fixes.

Known limits:

- This is an extraction harness, not a full MemoryBench replacement.
- Real local session imports must stay private and should publish only aggregate
  metrics, synthetic examples, or redacted methodology notes.
