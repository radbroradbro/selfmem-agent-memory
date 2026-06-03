Verdict: `CLEAN`

Gemini focused review found the RecallWeave response export and baseline
operator flow meet the requested boundary.

- Live mode requires `--live` or `RECALLWEAVE_BASELINE_LIVE=1` plus
  `RECALLWEAVE_BASELINE_NO_RAW_TEXT=1`.
- Exported results contain only ids or hashed ids, content hashes, scores,
  timing, token estimates, source labels, and privacy counters.
- Private tags and key-shaped values are stripped before hashing, memory ids
  are checked for secrets and private paths, and the serialized JSON is scanned
  for secrets, private paths, private tags, and raw response text fields.
- Fixture mode remains `fixtureOnly: true`, so it cannot authorize public
  benchmark claims.
- `recallweave-baseline-collector.mjs` consumes the export and applies its own
  raw-response-text assertion as a second boundary.

Gemini route: `gemini --skip-trust --approval-mode plan`.
