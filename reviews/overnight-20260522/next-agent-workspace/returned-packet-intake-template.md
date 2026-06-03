# Returned Packet Intake Template

Status: not filled.

Fill this after running the returned packet intake command against the selected
agent's evidence packet.

## Intake Command

```bash
npm exec --yes pnpm@10.23.0 -- canary:returned-packet -- --packet <returned-canary-evidence-packet.zip> --require-production-canary --output <metrics-only-intake.json>
```

## Intake Result

- intake ok:
- status:
- counts as production canary evidence:
- public launch allowed:
- fleet rollout allowed:
- packet label:
- packet SHA-256:
- strict-real passed:
- failed checks:
- strict failure reason:

## Decision

- Close real rollout blocker: yes/no
- Needs another fresh window: yes/no
- Needs adapter patch: yes/no
- Needs human approval: yes

## Notes

- Maintainer note:
- Follow-up issue or PR:
