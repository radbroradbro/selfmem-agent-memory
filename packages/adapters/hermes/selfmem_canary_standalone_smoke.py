#!/usr/bin/env python3
"""Standalone smoke test for the selfmem Hermes canary provider.

This fakes the minimal Hermes MemoryProvider import so the canary can be tested
outside a live Hermes checkout. The live VM should still run
`selfmem_canary_smoke.py` from the real Hermes repo before promotion.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
import tempfile
import types
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
PROVIDER_PATH = ROOT / "packages" / "adapters" / "hermes" / "selfmem_canary" / "__init__.py"


def main() -> None:
    fake_agent = types.ModuleType("agent")
    fake_memory_provider = types.ModuleType("agent.memory_provider")

    class MemoryProvider:
        pass

    fake_memory_provider.MemoryProvider = MemoryProvider
    sys.modules["agent"] = fake_agent
    sys.modules["agent.memory_provider"] = fake_memory_provider

    spec = importlib.util.spec_from_file_location("selfmem_canary_standalone", PROVIDER_PATH)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Could not load provider: {PROVIDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    with tempfile.TemporaryDirectory(prefix="selfmem-hermes-smoke-") as tmp:
        hermes_home = Path(tmp) / ".hermes"
        hermes_home.mkdir(parents=True, exist_ok=True)
        provider = module.SelfmemCanaryProvider()
        provider.initialize(
            "standalone-smoke",
            hermes_home=str(hermes_home),
            agent_identity="standalone-agent",
            supermemory_container="hermes_standalone_source",
        )
        provider._supermemory_read_through = True
        provider._supermemory_key = "test-read-through-key"
        provider._provider_mode = f"{provider._provider_mode}+supermemory-read-through-test"

        def fake_supermemory_search(query: str, limit: int):
            return [{
                "id": "supermemory:remote-smoke",
                "content": "Remote Supermemory history remains searchable while new memories write locally.",
                "score": 0.91,
                "provider_mode": "supermemory_read_through",
                "memory_source": "supermemory_read_through",
                "metadata": {
                    "source_supermemory_container": "hermes_standalone_source",
                },
            }]

        provider._search_supermemory = fake_supermemory_search
        tool_names = [schema["name"] for schema in provider.get_tool_schemas()]
        alias_store = json.loads(provider.handle_tool_call("supermemory_store", {
            "content": "LCM lifecycle memory should be distilled into local selfmem before any future Supermemory sync.",
        }))
        alias_search = json.loads(provider.handle_tool_call("supermemory_search", {
            "query": "LCM lifecycle local selfmem sync remote Supermemory history",
            "limit": 5,
        }))
        provider.sync_turn(
            "remember the Hermes canary must preserve LCM lifecycle events locally",
            "I will store the durable local memory lifecycle rule.",
            session_id="standalone-smoke",
        )
        provider.sync_turn(
            [{"type": "text", "text": "remember list-shaped Hermes lifecycle payloads must not crash selfmem"}],
            [{"type": "text", "text": "I will handle structured content safely."}],
            session_id="standalone-smoke",
        )
        prefetch = provider.prefetch("What is the LCM lifecycle memory rule?", session_id="standalone-smoke")
        skipped_prefetch = provider.prefetch("heartbeat diagnostic status check ping", session_id="standalone-smoke")
        status_like_prefetch = provider.prefetch("What is the status decision for Hermes memory retrieval?", session_id="standalone-smoke")
        pre_compress = provider.on_pre_compress([
            {"role": "user", "content": [{"type": "text", "text": "LCM pre-compress should be tracked by selfmem."}]},
        ])
        provider.on_memory_write("remember", "MEMORY.md", "Built-in Hermes memory writes should mirror into local selfmem.")
        provider.on_session_end([
            {"role": "user", "content": "session ending after LCM lifecycle smoke"},
            {"role": "assistant", "content": "done"},
        ])
        status = json.loads(provider.handle_tool_call("supermemory_status", {}))
        provider.shutdown()

        memories = Path(status["memories_path"]).read_text(encoding="utf-8", errors="ignore")
        trace = Path(status["trace_path"]).read_text(encoding="utf-8", errors="ignore")
        lossless = Path(status["lossless_path"]).read_text(encoding="utf-8", errors="ignore")
        raw = Path(status["raw_path"]).read_text(encoding="utf-8", errors="ignore")
        leaks = count_leaks("\n".join([memories, trace, lossless, raw, prefetch]))
        output = {
            "ok": True,
            "toolAliasCoverage": all(name in tool_names for name in [
                "supermemory_store",
                "supermemory_search",
                "supermemory_forget",
                "supermemory_profile",
                "supermemory_status",
            ]),
            "aliasStoreSuccess": bool(alias_store.get("success")),
            "aliasSearchResultCount": len(alias_search.get("results", [])),
            "hybridSearchCovered": any(item.get("memory_source") == "supermemory_read_through" for item in alias_search.get("results", [])),
            "sourceSupermemoryContainer": status.get("source_supermemory_container"),
            "localContainer": status.get("local_container"),
            "prefetchHasContext": bool(prefetch.strip()),
            "maintenanceRecallGateCovered": skipped_prefetch == "" and "prefetch_skipped" in trace,
            "statusLikeRecallCovered": bool(status_like_prefetch.strip()),
            "preCompressReturned": bool(pre_compress.strip()),
            "lcmLifecycleCovered": all(token in lossless for token in [
                "sync_turn_candidate",
                "pre_compress",
                "memory_write_candidate",
                "session_end",
            ]),
            "rawAuditCovered": "sync_turn_raw" in raw and "session_end_raw" in raw,
            "listPayloadCovered": "list-shaped Hermes lifecycle payloads" in memories,
            "distilledNotRawDefault": "role: user" not in memories,
            "privacyLeakCount": leaks,
            "memoryLineCount": len([line for line in memories.splitlines() if line.strip()]),
            "traceLineCount": len([line for line in trace.splitlines() if line.strip()]),
            "losslessLineCount": len([line for line in lossless.splitlines() if line.strip()]),
            "rawLineCount": len([line for line in raw.splitlines() if line.strip()]),
        }
        print(json.dumps(output, indent=2, sort_keys=True))
        if not all([
            output["toolAliasCoverage"],
            output["aliasStoreSuccess"],
            output["aliasSearchResultCount"] > 0,
            output["hybridSearchCovered"],
            output["sourceSupermemoryContainer"] == "hermes_standalone_source",
            output["localContainer"] == "selfmem_hermes_standalone_source",
            output["prefetchHasContext"],
            output["maintenanceRecallGateCovered"],
            output["statusLikeRecallCovered"],
            output["preCompressReturned"],
            output["lcmLifecycleCovered"],
            output["rawAuditCovered"],
            output["listPayloadCovered"],
            output["distilledNotRawDefault"],
            output["privacyLeakCount"] == 0,
        ]):
            raise SystemExit(1)


def count_leaks(text: str) -> int:
    patterns = [
        r"</?private>",
        r"pa-[A-Za-z0-9_-]{20,}",
        r"nvapi-[A-Za-z0-9_-]{20,}",
        r"jina_[A-Za-z0-9_-]{20,}",
        r"sk-ant-[A-Za-z0-9_-]{20,}",
        r"sm_[A-Za-z0-9_-]{20,}",
        r"AIza[0-9A-Za-z_-]{20,}",
    ]
    return sum(1 for pattern in patterns if re.search(pattern, text))


if __name__ == "__main__":
    main()
