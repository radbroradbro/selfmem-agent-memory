# Operator Findings Template

Status: not filled.

Use this template after the selected agent completes a fresh post-update
OpenClaw window. Keep it metrics-only.

## Run Identity

- Host:
- Handoff packet label:
- Handoff packet SHA-256:
- Fresh window start:
- Fresh window end:
- Window duration minutes:
- Adapter updated after window start: yes/no
- Rollback tested: yes/no

## Native CLI Outputs

- Canary report path label:
- Canary intake path label:
- Canary diagnosis path label, if failed:
- Canary evidence packet label:
- Canary evidence packet SHA-256:

## Pass Flags

- strict-real intake passed:
- fixture-only:
- counts as real rollout evidence:
- canary pass:
- lifecycle covered:
- hybrid search covered:
- local writes observed:
- hosted read-through observed:
- rollback available:
- rollback tested:

## Latency And Instrumentation

- recall p95 ms:
- store p95 ms:
- search latency samples:
- store latency samples:
- missing store latency count:

## Privacy

- privacy leak count:
- secret-pattern hits:
- raw memory included:
- raw transcript included:
- raw prompt included:
- raw answer included:

## Findings

- What worked:
- What failed or looked risky:
- What should be changed before another agent:

## Attach-Back Checklist

- metrics-only canary report attached:
- metrics-only intake attached:
- metrics-only diagnosis attached if failed:
- sanitized evidence packet attached:
- no raw logs or memory content attached:
