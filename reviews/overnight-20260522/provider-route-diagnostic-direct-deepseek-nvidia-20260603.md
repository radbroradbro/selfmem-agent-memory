# Provider Route Diagnostic

- Status: READY_DIRECT_DEEPSEEK_FLASH
- Generated: 2026-06-03T15:16:19Z
- OpenRouter used: false
- Credential values written: false
- Private paths written: false

## Direct DeepSeek

Direct DeepSeek flash is the usable scorer route for this pass. A tiny chat request returned HTTP 200, and the q150 scorer smoke completed without call failures.

The q150-q155 strict slice made 20 scorer calls with 0 failures. It did not promote the challenger: `session-v1` and `contextual-source-chunk-v1` both scored 20, so the method-specific gate blocked promotion with `best-challenger-does-not-clear-baseline-delta` and `best-overall-method-is-still-baseline`.

## NVIDIA NIM

The NVIDIA endpoint accepted the local key for model listing and showed both `deepseek-ai/deepseek-v4-flash` and `deepseek-ai/deepseek-v4-pro`. Tiny chat calls to both models timed out, so NVIDIA NIM chat should not be used as the answer-quality scorer until a tiny chat canary passes.

## Memory Recall

In-session Supermemory recall was attempted for this task and returned 0 matching memories, so no random benchmark/canary context was injected during this route check.

## Next Action

Use direct DeepSeek flash for bounded scorer diagnostics. Do not spend a full q150-q200 run from the q150-q155 slice alone; the current slice tied the baseline and should be treated as a stop/inspect signal.
