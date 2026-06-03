# Codex Memory Dogfood Monitor

- Status: `READY_DOGFOOD_MONITOR`
- Phase: `rewired`
- Iterations: 1
- Public safe: yes
- Raw memory, transcript, prompt, or context included: no
- Provider APIs called: no

## Current Health

- Severe noise clean: true
- Quiet prompt retrieved context: false
- Task lookup scenarios passed: 3/3
- Direct lookup relevant for task prompts: 3/3
- Quiet direct lookup empty: 3/3
- Confusing lookup count: 0
- Random benchmark/canary injection risk: false
- Explicit store write rate: 1

## Recall Policy

- Active recall policy: `periodic-or-signal`
- Required policy: `periodic-or-signal-with-anchored-relevance`
- Relevance ready for auto recall: true
- Auto injection allowed: false
- Forced or periodic recalls anchored: true
- Unanchored recall events: 0

Benchmark and canary memories are allowed only for matching benchmark/canary tasks.

## Graduation Gate

This one-shot monitor proves current health only. Dogfood graduation still requires a watched rewired run with 12 clean intervals.

Current graduation blockers:

- `watched-intervals-not-run`
- `clean-iteration-count-too-low`
