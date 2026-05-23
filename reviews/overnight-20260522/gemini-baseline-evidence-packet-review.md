# Gemini Review: Baseline Evidence Packet

Date: 2026-05-23

Verdict: `CLEAN`

Scope reviewed:

- `packages/bench/baseline-evidence-packet.mjs`
- `package.json` `baseline:packet` script
- `packages/bench/hosted-baseline-operator-packet.mjs` packaging command
- `packages/bench/consumer-install-smoke.mjs` clean-consumer coverage
- `packages/bench/release-readiness-check.mjs` baseline packet gate additions

Findings:

- Metrics-only integrity: all hosted, RecallWeave, comparison, and preflight
  JSON inputs must declare metrics-only output, and recursive raw-content key
  checks reject memory, transcript, prompt, answer, message, credential, cookie,
  and environment shapes.
- Secret and path safety: inputs and generated outputs are scanned for
  key-shaped secrets and private local filesystem paths.
- Strict-real behavior: `--strict-real` fails closed when any input is fixture
  evidence or fails privacy, metrics, preflight, or comparison validation.
- Authorization boundary: `publicLaunchAllowed` remains false in the packet
  manifest and command output. Public benchmark claims still require reviewer
  and owner approval.
- Handoff safety: the hosted baseline operator packet now provides a clear
  `baseline:packet --strict-real` handoff path so agents attach one metrics-only
  zip rather than loose or improvised JSON.

No blocking concerns identified.
