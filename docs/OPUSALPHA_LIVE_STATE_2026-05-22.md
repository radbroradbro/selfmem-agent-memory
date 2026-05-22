# OpusAlphaBot live state snapshot — 2026-05-22

This is a sanitized operational handoff note for the OpusAlphaBot lane. It intentionally avoids raw memories, raw transcripts, provider keys, auth files, private diagnostics, and full logs.

## Runtime snapshot

- Bot lane: OpusAlphaBot / `opusalphabot`.
- Live memory provider: `selfmem_canary` compatibility id.
- Local memory container: `selfmem_opusalphabot`.
- Source hosted-history container: `opusalphabot` read-through when credentials/quota are available.
- Current durable-memory mode observed in the bot prompt: `voyage-4-large+rerank-2.5+supermemory-read-through`.
- Context engine: LCM enabled in the Hermes profile.
- Default model routing at the start of this handoff was Codex `gpt-5.5`; Claude CLI subscription routing is being wired separately through a native interactive Claude helm.

## Selfmem / RecallWeave notes

- Public repo clone is present locally at `workspace/selfmem-agent-memory`.
- The public Hermes adapter under `packages/adapters/hermes/selfmem_canary/` is ahead of the installed runtime copy in branding and safety behavior:
  - Public repo uses RecallWeave naming in prompts/docs.
  - Public repo includes recall gating counters such as `recall_skipped` and `dedupe_suppressed`.
  - Public repo avoids writing full prefetch context into lossless lifecycle logs and records hashes/metadata instead.
  - Installed runtime copy still contains older `selfmem_canary` prompt wording and more verbose lifecycle payload shapes.
- Do not blindly overwrite the running installed provider while the gateway is active. Use the repo updater or a controlled branch + smoke-test + gateway restart.

## Native Claude helm state

Goal: route normal Telegram DM turns through native interactive Claude Code CLI with Hermes exposed over MCP, while keeping Hermes slash commands and Codex fallback available.

Verified:

- Plain Claude Code CLI works under the bot macOS user and shows a Claude Max login.
- ACP / Agent SDK bridge was not the right route; it returned `401 authentication_error Invalid authentication credentials` even while plain Claude CLI auth was good.
- Native interactive Claude in tmux successfully connected to Hermes MCP and responded to a no-send probe with `HELM_MCP_READY`.

Artifacts created in the OpusAlphaBot profile:

- User plugin: `plugins/claude-helm/`
  - Registers a `pre_gateway_dispatch` hook.
  - Lets slash commands continue through normal Hermes.
  - Intercepts normal authorized Telegram DM text, persists the user turn, injects the turn into the tmux Claude session, and asks Claude to reply via Hermes MCP `messages_send`.
  - Fails open to normal Hermes dispatch if the helm supervisor cannot be reached.
- Supervisor: `scripts/claude-helm-supervisor.sh`
  - Maintains tmux session `opusalpha-claude-helm`.
  - Writes runtime MCP config and system prompt under the profile runtime directory.
  - Launches interactive `claude --model opus --effort high` with `mcp__hermes__*` tools only.
- Older bridge plugin also exists: `plugins/claude-helm-bridge/`
  - It persists inbound messages and skips the Hermes LLM, but it relies on Claude polling/waiting through MCP rather than actively injecting a prompt.

Current caution:

- A gateway restart interrupted an active Codex turn and auto-resume triggered. Confirm the Claude helm plugin logs on the first fresh non-slash Telegram DM after restart before declaring the switch complete.
- Keep Codex available as the explicit fallback route through normal Hermes `/model` or config changes.

## Safe next steps

1. Run RecallWeave repo smoke tests before changing the installed memory provider:

   ```bash
   npm exec --yes pnpm@10.23.0 -- install
   npm exec --yes pnpm@10.23.0 -- smoke
   ```

2. If syncing the installed Hermes adapter from this repo, use the dry-run updater first:

   ```bash
   python3 plugins/selfmem-fallback/scripts/selfmem_update.py --host hermes --repo /path/to/hermes
   ```

3. For Claude helm verification, send one normal Telegram DM after gateway settles and check:

   - `logs/claude-helm-plugin.log` records an injected prompt.
   - tmux session `opusalpha-claude-helm` remains live.
   - The visible reply is sent through Hermes MCP, not through the Codex AIAgent.
   - Slash commands like `/status` still bypass the helm and run in Hermes.

4. Do not commit:

   - raw `memories.jsonl`
   - raw `raw_events.jsonl`
   - raw `lossless_context.jsonl`
   - raw `trace.jsonl`
   - `.env`
   - auth/cookie/browser state
   - private diagnostics bundles

## Task state at snapshot time

- Inspect Hermes MCP / Claude helm capability: complete.
- Preserve/sync public RecallWeave repo state: in progress.
- Prototype persistent interactive Claude helm: complete.
- Wire gateway/system to use Claude helm after restarts: in progress.
- Verify live Telegram routing with Codex fallback only when explicitly switched: pending.
