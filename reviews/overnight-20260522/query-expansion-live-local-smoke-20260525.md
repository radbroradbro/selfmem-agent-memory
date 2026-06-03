# Query Expansion Live Local Smoke

Date: 2026-05-25

## Result

- Status: passed
- Strategy: `query-expanded-full-hybrid-rerank`
- Expander mode: pure local
- Expander provider: local OpenAI-compatible fixture server
- Request count: 3
- Reported query-expansion calls: 3
- Raw memory included: false
- Raw prompt included: false
- Stored memories sent to expander: false
- Memory payload marker observed by fixture server: false
- Public benchmark claims allowed: false

## Scope

This proves the benchmark harness can call a configured local query-expansion
endpoint and keep the exported artifact metrics-only. It is a wiring smoke, not
a quality benchmark and not a SOTA claim.

## Remaining Gate

A real same-data query-expansion benchmark still needs a selected local or
approved mixed-cloud expander, the same source-locked target, matched scoring,
and reviewer approval before any public claim.
