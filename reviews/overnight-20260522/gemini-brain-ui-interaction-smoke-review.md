# Gemini Brain UI Interaction Smoke Review

Date: 2026-05-22

Reviewer route:

- `GEMINI_CLI_TRUST_WORKSPACE=true gemini -p ...`
- Gemini CLI version observed earlier in this slice: `0.44.0-nightly.20260515.g928a311fb`.
- First attempt was blocked by Gemini's trusted-folder guard. The second attempt
  used Gemini's documented headless workspace trust flag.

Final verdict: CLEAN.

Reviewer findings:

- `packages/brain-ui/src/model.js`: shared export and redaction logic is applied
  in draft export, Nucleus export, and research lineage export.
- `packages/brain-ui/interaction-smoke.mjs`: the smoke exercises search
  filtering, retrieval trace visibility, private edit rejection, fixture export
  modes, and public-safe serialization.
- `packages/brain-ui/server.mjs`: fixture sync uses an isolated temporary
  directory and `dryRun: true`.
- `package.json`: `brain:interaction` and `brain:interaction:built` are defined
  and included in the aggregate smoke target.
- `packages/bench/release-readiness-check.mjs`: release gate requires the new
  evidence file and a fresh interaction smoke run.
- Safety: the slice stays inside fixture-only boundaries and does not expose raw
  memory data, raw transcripts, credentials, private agent names, or real local
  paths.

Notes:

- Gemini's tool layer reported that its own ripgrep helper was unavailable and
  fell back to grep. The review still returned `CLEAN`.
- A second review ran after tightening `buildEditExport` to redact exported
  `nodeId` values and after strengthening the interaction smoke so a normal
  saved edit and an unsafe private/key-shaped candidate are checked separately.
  Gemini again returned `CLEAN`.
- The second review specifically found that `buildEditExport` redacts node IDs,
  titles, kinds, and contents; that normal edits survive; that inspect-only
  retrieval trace edits are ignored; and that final serialized interaction
  outputs are checked for private/key-shaped text.
