"""selfmem canary MemoryProvider for Hermes.

The provider writes new memory locally and can read old mapped Supermemory
history when credentials are available. It never writes to hosted Supermemory.
"""

from __future__ import annotations

import json
import logging
import hashlib
import math
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from agent.memory_provider import MemoryProvider

logger = logging.getLogger(__name__)

_MIN_CAPTURE_LENGTH = 10
_DEFAULT_TOP_K = 5
_RERANK_CANDIDATE_LIMIT = 20
_RERANK_TOKEN_BUDGET = 50000
_DEFAULT_LOCAL_CONTAINER = "selfmem_default"
_VOYAGE_EMBED_MODEL = "voyage-4-large"
_VOYAGE_RERANK_MODEL = "rerank-2.5"
_VOYAGE_DIMENSIONS = 1024
_VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings"
_VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank"
_SUPERMEMORY_SEARCH_URL = "https://api.supermemory.ai/v4/search"
_PRIVATE_RE = re.compile(r"<private>[\s\S]*?(?:</private>|$)", re.IGNORECASE)
_TRIVIAL_RE = re.compile(
    r"^(ok|okay|thanks|thank you|got it|sure|yes|no|yep|nope|k|ty|thx|np)\.?$",
    re.IGNORECASE,
)
_MAINTENANCE_RE = re.compile(
    r"\b(heartbeat|cron|watchdog|diagnostic|doctor|reliability|status|healthcheck|health check|memory monitor|silent run|update check|ping|no-op|noop)\b",
    re.IGNORECASE,
)
_RECALL_INTENT_RE = re.compile(
    r"\b(remember|recall|retrieve|search memory|find memory|durable|preference|decision|bug|fix|workflow|container|lcm|compress|compression|identity|profile)\b",
    re.IGNORECASE,
)
_KEY_PATTERNS = [
    (re.compile(r"pa-[A-Za-z0-9_-]{40,}"), "[REDACTED_VOYAGE_KEY]"),
    (re.compile(r"AIza[0-9A-Za-z_-]{30,}"), "[REDACTED_GOOGLE_AI_KEY]"),
    (re.compile(r"jina_[0-9A-Za-z_-]{20,}"), "[REDACTED_JINA_KEY]"),
    (re.compile(r"sk-ant-[A-Za-z0-9_-]{40,}"), "[REDACTED_ANTHROPIC_KEY]"),
    (re.compile(r"sk-or-v1-[A-Za-z0-9_-]{40,}"), "[REDACTED_OPENROUTER_KEY]"),
    (re.compile(r"sk-[A-Za-z0-9_-]{32,}"), "[REDACTED_OPENAI_LIKE_KEY]"),
    (re.compile(r"sm_[A-Za-z0-9_-]{40,}"), "[REDACTED_SUPERMEMORY_KEY]"),
    (re.compile(r"nvapi-[A-Za-z0-9_-]{32,}"), "[REDACTED_NVIDIA_KEY]"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_KEY]"),
    (re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{30,}\b"), "[REDACTED_TELEGRAM_BOT_TOKEN]"),
]


STORE_SCHEMA = {
    "name": "selfmem_store",
    "description": "Store an explicit selfmem canary memory for future recall.",
    "parameters": {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "The memory content to store."},
            "metadata": {"type": "object", "description": "Optional metadata."},
        },
        "required": ["content"],
    },
}

SEARCH_SCHEMA = {
    "name": "selfmem_search",
    "description": "Search selfmem canary memory by local lexical relevance.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "What to search for."},
            "limit": {"type": "integer", "description": "Maximum results to return, 1 to 20."},
        },
        "required": ["query"],
    },
}

FORGET_SCHEMA = {
    "name": "selfmem_forget",
    "description": "Forget a selfmem canary memory by id or best-match query.",
    "parameters": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "Exact memory id."},
            "query": {"type": "string", "description": "Query used to find the memory."},
        },
    },
}

PROFILE_SCHEMA = {
    "name": "selfmem_profile",
    "description": "Return a short profile summary from selfmem canary memory.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Optional query to focus profile."},
        },
    },
}

STATUS_SCHEMA = {
    "name": "selfmem_status",
    "description": "Return selfmem canary status, local container, source Supermemory container, and usage.",
    "parameters": {
        "type": "object",
        "properties": {},
    },
}


def _alias_schema(schema: Dict[str, Any], name: str, description: str) -> Dict[str, Any]:
    clone = dict(schema)
    clone["name"] = name
    clone["description"] = description
    return clone


class SelfmemCanaryProvider(MemoryProvider):
    def __init__(self) -> None:
        self._session_id = ""
        self._hermes_home = ""
        self._store_dir: Optional[Path] = None
        self._memories_path: Optional[Path] = None
        self._trace_path: Optional[Path] = None
        self._lossless_path: Optional[Path] = None
        self._raw_path: Optional[Path] = None
        self._container_map_path: Optional[Path] = None
        self._write_enabled = True
        self._active = False
        self._voyage_key = ""
        self._voyage_keys: List[str] = []
        self._voyage_key_index = 0
        self._supermemory_key = ""
        self._supermemory_read_through = False
        self._provider_mode = "local_lexical"
        self._source_supermemory_container = ""
        self._local_container = _DEFAULT_LOCAL_CONTAINER
        self._agent_identity = ""
        self._usage = {
            "embedding_tokens": 0,
            "rerank_tokens": 0,
            "embedding_calls": 0,
            "rerank_calls": 0,
            "recall_skipped": 0,
            "dedupe_suppressed": 0,
        }

    @property
    def name(self) -> str:
        return "selfmem_canary"

    def is_available(self) -> bool:
        return True

    def initialize(self, session_id: str, **kwargs) -> None:
        self._session_id = session_id
        self._hermes_home = str(kwargs.get("hermes_home") or Path.home() / ".hermes")
        hermes_home = Path(self._hermes_home)
        _load_selfmem_env(hermes_home)
        self._agent_identity = str(kwargs.get("agent_identity") or os.environ.get("HERMES_AGENT_IDENTITY") or os.environ.get("HERMES_BOT_NAME") or "unknown-agent")
        setup = _load_agent_setup(hermes_home, self._agent_identity)
        self._source_supermemory_container = (
            str(kwargs.get("supermemory_container") or "")
            or str(setup.get("source_supermemory_container") or "")
            or _discover_supermemory_container(hermes_home, kwargs)
        )
        self._local_container = (
            str(kwargs.get("local_container") or "")
            or str(setup.get("local_container") or "")
            or _local_container_for(self._agent_identity, self._source_supermemory_container)
        )
        self._store_dir = hermes_home / "selfmem_canary" / "containers" / _safe_name(self._local_container)
        self._store_dir.mkdir(parents=True, exist_ok=True)
        self._memories_path = self._store_dir / "memories.jsonl"
        self._trace_path = self._store_dir / "trace.jsonl"
        self._lossless_path = self._store_dir / "lossless_context.jsonl"
        self._raw_path = self._store_dir / "raw_events.jsonl"
        self._container_map_path = self._store_dir / "container-map.json"
        self._voyage_keys = _voyage_keys_from_env()
        self._voyage_key = self._voyage_keys[0] if self._voyage_keys else ""
        self._supermemory_key = (
            os.environ.get("SELFMEM_SUPERMEMORY_READ_KEY", "")
            or os.environ.get("SUPERMEMORY_READ_API_KEY", "")
            or os.environ.get("SUPERMEMORY_API_KEY", "")
            or os.environ.get("SUPERMEMORY_CC_API_KEY", "")
        )
        self._supermemory_read_through = bool(
            self._supermemory_key
            and self._source_supermemory_container
            and os.environ.get("SELFMEM_SUPERMEMORY_READ_THROUGH", "1") != "0"
        )
        local_mode = "voyage-4-large+rerank-2.5" if self._voyage_keys else "local_lexical"
        self._provider_mode = f"{local_mode}+supermemory-read-through" if self._supermemory_read_through else local_mode
        agent_context = str(kwargs.get("agent_context") or "")
        self._write_container_map()
        self._write_enabled = agent_context not in ("cron", "flush", "subagent")
        self._active = True
        self._trace("initialize", {
            "session_id": session_id,
            "write_enabled": self._write_enabled,
            "provider_mode": self._provider_mode,
            "agent_identity": self._agent_identity,
            "source_supermemory_container": self._source_supermemory_container or None,
            "local_container": self._local_container,
            "supermemory_read_through": self._supermemory_read_through,
            "search_policy": "union_local_and_supermemory_read_through",
        })

    def system_prompt_block(self) -> str:
        if not self._active:
            return ""
        return "\n".join([
            "# RecallWeave memory",
            f"Active RecallWeave provider. Mode: {self._provider_mode}. Use selfmem_search, selfmem_store, selfmem_forget, and selfmem_profile for explicit memory operations.",
            f"Local memory container: {self._local_container}. Source Supermemory container: {self._source_supermemory_container or 'not detected'}.",
            "New memory writes are local. Search includes local RecallWeave plus mapped Supermemory read-through when the key and source container are available.",
            "For durable growing memory, use selfmem_store. Keep built-in MEMORY.md/USER.md small and stable; if the built-in memory tool hits a character limit, store the durable fact in RecallWeave instead.",
        ])

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        query = _coerce_text(query)
        decision = _recall_decision(query)
        if not decision["recall"]:
            self._usage["recall_skipped"] += 1
            self._trace("prefetch_skipped", {
                "query": query[:160],
                "reason": decision["reason"],
                "provider_mode": self._provider_mode,
            })
            self._lossless("prefetch_skipped", {
                "session_id": session_id or self._session_id,
                "query": query,
                "reason": decision["reason"],
            })
            return ""
        start = time.perf_counter()
        results = self._search(query, _DEFAULT_TOP_K)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 3)
        if not results:
            self._trace("prefetch", {
                "query": query[:160],
                "result_count": 0,
                "elapsed_ms": elapsed_ms,
                "provider_mode": self._provider_mode,
            })
            self._lossless("prefetch", {
                "session_id": session_id or self._session_id,
                "query": query,
                "result_ids": [],
                "elapsed_ms": elapsed_ms,
                "provider_mode": self._provider_mode,
            })
            return ""
        lines = ["<selfmem-context>", "## Relevant selfmem canary memories"]
        for item in results:
            source = _source_label(item)
            lines.append(f"- [{source} {item['id']}] {item['content']}")
        lines.append("</selfmem-context>")
        context = "\n".join(lines)
        self._trace("prefetch", {
            "query": query[:160],
            "result_count": len(results),
            "result_ids": [item["id"] for item in results],
            "elapsed_ms": elapsed_ms,
            "provider_mode": self._provider_mode,
        })
        self._lossless("prefetch", {
            "session_id": session_id or self._session_id,
            "query": query,
            "result_ids": [item["id"] for item in results],
            "context_length": len(context),
            "context_sha256": hashlib.sha256(context.encode("utf-8")).hexdigest()[:16],
            "elapsed_ms": elapsed_ms,
            "provider_mode": self._provider_mode,
        })
        return context

    def queue_prefetch(self, query: str, *, session_id: str = "") -> None:
        query = _coerce_text(query)
        self._trace("queue_prefetch", {"query": query[:160], "session_id": session_id or self._session_id})
        self._lossless("queue_prefetch", {"query": query, "session_id": session_id or self._session_id})

    def sync_turn(self, user_content: str, assistant_content: str, *, session_id: str = "") -> None:
        if not self._write_enabled:
            self._trace("sync_turn_rejected", {"reason": "write-disabled"})
            self._lossless("sync_turn_candidate", {
                "decision": "rejected",
                "reason": "write-disabled",
                "session_id": session_id or self._session_id,
            })
            return
        user = _redact(user_content)
        assistant = _redact(assistant_content)
        if user["fully_private"]:
            self._trace("sync_turn_rejected", {"reason": "user-fully-private", "redacted": user["redacted"]})
            self._lossless("sync_turn_candidate", {
                "decision": "rejected",
                "reason": "user-fully-private",
                "session_id": session_id or self._session_id,
                "redaction_count": user["redaction_count"] + assistant["redaction_count"],
            })
            return
        if _is_trivial(user["text"]) or len(user["text"]) < _MIN_CAPTURE_LENGTH:
            self._trace("sync_turn_rejected", {"reason": "trivial-or-short"})
            self._lossless("sync_turn_candidate", {
                "decision": "rejected",
                "reason": "trivial-or-short",
                "session_id": session_id or self._session_id,
            })
            return
        content = (
            f"[role: user]\n{user['text']}\n[user:end]\n\n"
            f"[role: assistant]\n{assistant['text']}\n[assistant:end]"
        )
        item = self._store(content, {
            "source": "hermes",
            "type": "conversation_turn",
            "session_id": session_id or self._session_id,
            "redacted": bool(user["redacted"] or assistant["redacted"]),
        })
        self._lossless("sync_turn_candidate", {
            "decision": "accepted",
            "reason": "durable-candidate",
            "session_id": session_id or self._session_id,
            "memory_id": item["id"],
            "content": content,
            "redaction_count": user["redaction_count"] + assistant["redaction_count"],
            "provider_mode": self._provider_mode,
        })
        self._raw_event("sync_turn_raw", {
            "session_id": session_id or self._session_id,
            "content": content,
            "memory_id": item["id"],
        })

    def on_session_end(self, messages: List[Dict[str, Any]]) -> None:
        cleaned = []
        for message in messages or []:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            if role not in ("user", "assistant"):
                continue
            redacted = _redact(message.get("content", ""))
            if redacted["fully_private"]:
                continue
            text = redacted["text"].strip()
            if text:
                cleaned.append({"role": role, "content": text})
        self._trace("session_end", {"message_count": len(cleaned)})
        self._lossless("session_end", {
            "session_id": self._session_id,
            "messages": cleaned,
            "message_count": len(cleaned),
        })
        self._raw_event("session_end_raw", {
            "session_id": self._session_id,
            "messages": cleaned,
            "message_count": len(cleaned),
        })

    def on_pre_compress(self, messages: List[Dict[str, Any]]) -> str:
        self._trace("pre_compress", {"message_count": len(messages or [])})
        self._lossless("pre_compress", {
            "session_id": self._session_id,
            "message_count": len(messages or []),
            "messages": _compact_messages(messages or []),
        })
        return "selfmem_canary observed pre-compression; preserve durable user preferences and project decisions when evidenced."

    def on_memory_write(self, action: str, target: str, content: str, metadata=None) -> None:
        redacted = _redact(content)
        if redacted["fully_private"]:
            self._trace("memory_write_rejected", {"action": action, "target": target, "reason": "fully-private"})
            self._lossless("memory_write_candidate", {
                "decision": "rejected",
                "reason": "fully-private",
                "action": action,
                "target": target,
                "redaction_count": redacted["redaction_count"],
            })
            return
        item = self._store(redacted["text"], {
            "source": "hermes_builtin_memory_write",
            "action": action,
            "target": target,
            "redacted": bool(redacted["redacted"]),
            "metadata": metadata or {},
        })
        self._lossless("memory_write_candidate", {
            "decision": "accepted",
            "action": action,
            "target": target,
            "memory_id": item["id"],
            "content": redacted["text"],
            "redaction_count": redacted["redaction_count"],
            "provider_mode": self._provider_mode,
        })

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        return [
            STORE_SCHEMA,
            SEARCH_SCHEMA,
            FORGET_SCHEMA,
            PROFILE_SCHEMA,
            STATUS_SCHEMA,
            _alias_schema(STORE_SCHEMA, "supermemory_store", "Compatibility alias: store a local RecallWeave memory."),
            _alias_schema(SEARCH_SCHEMA, "supermemory_search", "Compatibility alias: search local RecallWeave plus mapped Supermemory read-through."),
            _alias_schema(FORGET_SCHEMA, "supermemory_forget", "Compatibility alias: forget a local RecallWeave memory."),
            _alias_schema(PROFILE_SCHEMA, "supermemory_profile", "Compatibility alias: return a local RecallWeave profile summary."),
            _alias_schema(STATUS_SCHEMA, "supermemory_status", "Compatibility alias: return RecallWeave status."),
        ]

    def handle_tool_call(self, tool_name: str, args: Dict[str, Any], **kwargs) -> str:
        try:
            tool_name = _normalize_tool_name(tool_name)
            if tool_name == "selfmem_store":
                content = _coerce_text(args.get("content", ""))
                redacted = _redact(content)
                if redacted["fully_private"]:
                    return json.dumps({"success": False, "message": "Rejected fully private memory."})
                item = self._store(redacted["text"], {
                    "source": "tool",
                    "redacted": bool(redacted["redacted"]),
                    "metadata": args.get("metadata") if isinstance(args.get("metadata"), dict) else {},
                })
                return json.dumps({"success": True, "id": item["id"], "redacted": redacted["redacted"]})
            if tool_name == "selfmem_search":
                limit = _clamp_limit(args.get("limit", _DEFAULT_TOP_K))
                return json.dumps({"results": self._search(_coerce_text(args.get("query", "")), limit)})
            if tool_name == "selfmem_forget":
                return json.dumps(self._forget(str(args.get("id", "")), _coerce_text(args.get("query", ""))))
            if tool_name == "selfmem_profile":
                results = self._search(_coerce_text(args.get("query", "")), _DEFAULT_TOP_K) if args.get("query") else self._read_all()[:_DEFAULT_TOP_K]
                return json.dumps({"profile": [item["content"] for item in results]})
            if tool_name == "selfmem_status":
                return json.dumps(self._status())
            return json.dumps({"success": False, "message": f"Unknown tool: {tool_name}"})
        except Exception as exc:
            logger.debug("selfmem_canary tool failed", exc_info=True)
            return json.dumps({"success": False, "message": str(exc)})

    def shutdown(self) -> None:
        self._trace("shutdown", {"session_id": self._session_id})

    def get_config_schema(self) -> List[Dict[str, Any]]:
        return []

    def save_config(self, values: Dict[str, Any], hermes_home: str) -> None:
        return None

    def _store(self, content: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        assert self._memories_path is not None
        content = _coerce_text(content)
        distilled = _distill_content(content, metadata)
        if not distilled:
            distilled = content.strip()[:1200]
        duplicate = self._find_duplicate(distilled)
        if duplicate:
            self._usage["dedupe_suppressed"] += 1
            self._trace("store_deduped", {
                "id": duplicate.get("id"),
                "local_container": self._local_container,
            })
            return duplicate
        embedding = None
        embedding_error = ""
        if self._voyage_keys:
            try:
                embedding = self._voyage_embed([distilled], "document")[0]
            except Exception as exc:
                embedding_error = _sanitize_error(str(exc))
                self._trace("embedding_error", {"message": embedding_error})
        item = {
            "id": f"selfmem-{int(time.time() * 1000)}-{hashlib.sha256(distilled.encode('utf-8')).hexdigest()[:10]}",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "content": distilled,
            "raw_ref": _stable_ref(content),
            "metadata": {
                **metadata,
                "distilled": True,
                "local_container": self._local_container,
                "source_supermemory_container": self._source_supermemory_container,
                "agent_identity": self._agent_identity,
            },
        }
        if embedding:
            item["embedding"] = embedding
            item["embedding_model"] = _VOYAGE_EMBED_MODEL
            item["embedding_dimensions"] = _VOYAGE_DIMENSIONS
        if embedding_error:
            item["embedding_error"] = embedding_error
        with self._memories_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(item, ensure_ascii=True) + "\n")
        self._trace("store", {
            "id": item["id"],
            "metadata": metadata,
            "provider_mode": self._provider_mode,
            "has_embedding": bool(embedding),
            "local_container": self._local_container,
            "source_supermemory_container": self._source_supermemory_container or None,
            "usage": self._usage,
        })
        return item

    def _status(self) -> Dict[str, Any]:
        return {
            "success": True,
            "provider": self.name,
            "provider_mode": self._provider_mode,
            "agent_identity": self._agent_identity,
            "local_container": self._local_container,
            "source_supermemory_container": self._source_supermemory_container or None,
            "write_enabled": self._write_enabled,
            "memory_count": len(self._read_all()),
            "store_dir": str(self._store_dir) if self._store_dir else "",
            "memories_path": str(self._memories_path) if self._memories_path else "",
            "trace_path": str(self._trace_path) if self._trace_path else "",
            "lossless_path": str(self._lossless_path) if self._lossless_path else "",
            "raw_path": str(self._raw_path) if self._raw_path else "",
            "container_map_path": str(self._container_map_path) if self._container_map_path else "",
            "usage": self._usage,
            "supermemory_read_through": self._supermemory_read_through,
            "live_credentials": {
                "semantic_provider": "voyage" if self._voyage_key else "missing",
                "voyage_key_present": bool(self._voyage_keys),
                "voyage_key_count": len(self._voyage_keys),
                "supermemory_read_key_present": bool(self._supermemory_key),
                "supermemory_read_through_ready": bool(self._supermemory_read_through),
            },
            "recall_policy": {
                "auto_recall_gate": "every_turn" if os.environ.get("SELFMEM_RECALL_EVERY_TURN") == "1" else "skip_obvious_maintenance",
                "rerank_candidate_limit": _rerank_candidate_limit(),
                "rerank_token_budget": _rerank_token_budget(),
            },
            "search_policy": "union_local_and_supermemory_read_through",
            "tool_aliases": ["supermemory_store", "supermemory_search", "supermemory_forget", "supermemory_profile", "supermemory_status"],
        }

    def _write_container_map(self) -> None:
        if not self._container_map_path:
            return
        data = {
            "agent_identity": self._agent_identity,
            "source_supermemory_container": self._source_supermemory_container or None,
            "local_container": self._local_container,
            "hermes_home": self._hermes_home,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mode": "local-write-supermemory-read-through",
            "supermemory_read_through": self._supermemory_read_through,
            "rerank_policy": "weighted_rrf_union; voyage rerank for local embedded candidates when VOYAGE_API_KEY is present; hosted Supermemory uses its own rerank flag",
            "query_expansion": "off_by_default_for_live_hooks",
        }
        self._container_map_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")

    def _search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        start = time.perf_counter()
        query = _coerce_text(query)
        remote_results: List[Dict[str, Any]] = []
        remote_error = ""
        try:
            results = self._search_local(query, limit)
            if self._supermemory_read_through:
                try:
                    remote_results = self._search_supermemory(query, max(limit * 2, limit))
                except Exception as exc:
                    remote_error = _sanitize_error(str(exc))
                    self._trace("supermemory_read_through_error", {
                        "message": remote_error,
                        "source_supermemory_container": self._source_supermemory_container or None,
                    })
            results = _merge_ranked_results([results, remote_results], limit)
            self._trace("search", {
                "query": query[:160],
                "result_count": len(results),
                "result_ids": [item["id"] for item in results],
                "local_result_count": len([item for item in results if item.get("memory_source") == "local_selfmem"]),
                "supermemory_result_count": len([item for item in results if item.get("memory_source") == "supermemory_read_through"]),
                "elapsed_ms": round((time.perf_counter() - start) * 1000, 3),
                "provider_mode": self._provider_mode,
                "supermemory_read_through": self._supermemory_read_through,
                "supermemory_error": remote_error,
                "usage": self._usage,
            })
            return results
        except Exception as exc:
            message = _sanitize_error(str(exc))
            self._trace("search_error", {"message": message, "provider_mode": self._provider_mode})
            results = self._search_lexical(query, limit)
            self._trace("search_fallback", {
                "query": query[:160],
                "result_count": len(results),
                "result_ids": [item["id"] for item in results],
                "elapsed_ms": round((time.perf_counter() - start) * 1000, 3),
                "provider_mode": "local_lexical_after_voyage_error",
            })
            return results

    def _search_local(self, query: str, limit: int) -> List[Dict[str, Any]]:
        if self._voyage_keys:
            return self._search_voyage(query, limit)
        return self._search_lexical(query, limit)

    def _search_lexical(self, query: str, limit: int) -> List[Dict[str, Any]]:
        query_tokens = set(_tokens(query))
        if not query_tokens:
            return []
        scored = []
        for item in self._read_all():
            doc_tokens = _tokens(item.get("content", ""))
            if not doc_tokens:
                continue
            score = sum(1 for token in doc_tokens if token in query_tokens)
            if score > 0:
                scored.append(_public_item({**item, "score": score, "provider_mode": "local_lexical", "memory_source": "local_selfmem"}))
        scored.sort(key=lambda item: (-item["score"], item["id"]))
        return scored[:limit]

    def _search_voyage(self, query: str, limit: int) -> List[Dict[str, Any]]:
        query_vector = self._voyage_embed([query], "query")[0]
        candidates = []
        for item in self._read_all():
            vector = item.get("embedding")
            if isinstance(vector, list) and vector:
                candidates.append({**item, "dense_score": _cosine(query_vector, vector)})
        if not candidates:
            return self._search_lexical(query, limit)
        candidates.sort(key=lambda item: (-item["dense_score"], item["id"]))
        candidates = candidates[:_rerank_candidate_limit()]
        documents = [str(item.get("content", "")) for item in candidates]
        if not self._can_rerank(query, documents):
            self._trace("rerank_budget_skipped", {
                "candidate_count": len(candidates),
                "rerank_tokens_used": self._usage.get("rerank_tokens", 0),
                "rerank_token_budget": _rerank_token_budget(),
            })
            output = []
            for item in candidates[:limit]:
                clone = dict(item)
                clone["score"] = clone.get("dense_score", 0)
                clone["provider_mode"] = f"{self._provider_mode}+dense-budget"
                clone["memory_source"] = "local_selfmem"
                output.append(_public_item(clone))
            return output
        reranked = self._voyage_rerank(query, documents, min(limit, len(documents)))
        output = []
        for result in reranked:
            index = result.get("index", -1)
            if not isinstance(index, int) or index < 0 or index >= len(candidates):
                continue
            item = dict(candidates[index])
            item["score"] = result.get("score", 0)
            item["provider_mode"] = self._provider_mode
            item["memory_source"] = "local_selfmem"
            output.append(_public_item(item))
        return output[:limit]

    def _search_supermemory(self, query: str, limit: int) -> List[Dict[str, Any]]:
        if not self._supermemory_key or not self._source_supermemory_container:
            return []
        payload = {
            "q": query,
            "containerTag": self._source_supermemory_container,
            "limit": max(1, min(20, limit)),
            "threshold": 0,
            "rerank": True,
            "rewriteQuery": False,
            "searchMode": "memories",
        }
        request = urllib.request.Request(
            _SUPERMEMORY_SEARCH_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self._supermemory_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supermemory read-through HTTP {exc.code}: {_sanitize_error(body)}") from exc
        results = []
        for index, item in enumerate(data.get("results", []) or []):
            if not isinstance(item, dict):
                continue
            text = str(item.get("memory") or item.get("chunk") or item.get("content") or "").strip()
            redacted = _redact(text)
            if redacted["fully_private"] or not redacted["text"].strip():
                continue
            remote_id = str(item.get("id") or f"rank-{index}")
            results.append({
                "id": f"supermemory:{remote_id}",
                "created_at": "",
                "content": redacted["text"],
                "score": float(item.get("similarity") or item.get("score") or 0.0),
                "provider_mode": "supermemory_read_through",
                "memory_source": "supermemory_read_through",
                "metadata": {
                    "supermemory_id": remote_id,
                    "source_supermemory_container": self._source_supermemory_container,
                    "redacted": redacted["redacted"],
                },
            })
        return results

    def _forget(self, memory_id: str, query: str) -> Dict[str, Any]:
        items = self._read_all()
        target_id = memory_id.strip()
        if not target_id and query.strip():
            results = self._search(query, 1)
            target_id = results[0]["id"] if results else ""
        if not target_id:
            return {"success": False, "message": "No memory id or matching query."}
        kept = [item for item in items if item.get("id") != target_id]
        if len(kept) == len(items):
            return {"success": False, "message": "Memory not found."}
        assert self._memories_path is not None
        with self._memories_path.open("w", encoding="utf-8") as handle:
            for item in kept:
                handle.write(json.dumps(item, ensure_ascii=True) + "\n")
        self._trace("forget", {"id": target_id})
        return {"success": True, "id": target_id}

    def _read_all(self) -> List[Dict[str, Any]]:
        if not self._memories_path or not self._memories_path.exists():
            return []
        items = []
        for line in self._memories_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            try:
                item = json.loads(line)
                if isinstance(item, dict):
                    items.append(item)
            except Exception:
                continue
        return items

    def _voyage_embed(self, texts: List[str], input_type: str) -> List[List[float]]:
        payload = {
            "input": texts,
            "model": _VOYAGE_EMBED_MODEL,
            "input_type": input_type,
            "output_dimension": _VOYAGE_DIMENSIONS,
            "output_dtype": "float",
            "truncation": True,
        }
        response = self._voyage_request(_VOYAGE_EMBED_URL, payload)
        self._usage["embedding_calls"] += 1
        self._usage["embedding_tokens"] += int(response.get("usage", {}).get("total_tokens") or 0)
        data = sorted(response.get("data", []), key=lambda item: item.get("index", 0))
        vectors = [item.get("embedding") for item in data]
        if any(not isinstance(vector, list) for vector in vectors):
            raise RuntimeError("Voyage embedding response missing vectors")
        return vectors

    def _voyage_rerank(self, query: str, documents: List[str], top_k: int) -> List[Dict[str, Any]]:
        payload = {
            "query": query,
            "documents": documents,
            "model": _VOYAGE_RERANK_MODEL,
            "top_k": top_k,
            "return_documents": False,
            "truncation": True,
        }
        response = self._voyage_request(_VOYAGE_RERANK_URL, payload)
        self._usage["rerank_calls"] += 1
        self._usage["rerank_tokens"] += int(response.get("usage", {}).get("total_tokens") or 0)
        return [
            {"index": item.get("index", -1), "score": item.get("relevance_score", 0)}
            for item in response.get("data", [])
        ]

    def _voyage_request(self, url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self._voyage_keys:
            raise RuntimeError("Voyage key missing")
        last_error = ""
        for attempt in range(max(1, len(self._voyage_keys))):
            key = self._next_voyage_key()
            request = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=15) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")
                last_error = f"Voyage HTTP {exc.code}: {_sanitize_error(body)}"
                self._trace("voyage_key_fallback", {"status": exc.code, "attempt": attempt + 1})
                if exc.code not in (401, 402, 403, 408, 409, 429, 500, 502, 503, 504):
                    break
        raise RuntimeError(last_error or "Voyage request failed")

    def _next_voyage_key(self) -> str:
        key = self._voyage_keys[self._voyage_key_index % len(self._voyage_keys)]
        self._voyage_key_index += 1
        return key

    def _find_duplicate(self, content: str) -> Optional[Dict[str, Any]]:
        fingerprint = _normalized_content_hash(content)
        for item in self._read_all():
            if _normalized_content_hash(str(item.get("content") or "")) == fingerprint:
                return item
        return None

    def _can_rerank(self, query: str, documents: List[str]) -> bool:
        budget = _rerank_token_budget()
        if budget == 0:
            return True
        estimated_tokens = _estimate_tokens("\n".join([query, *documents]))
        return int(self._usage.get("rerank_tokens", 0) or 0) + estimated_tokens <= budget

    def _trace(self, event: str, data: Dict[str, Any]) -> None:
        if not self._trace_path:
            return
        clean = _redact(json.dumps(data, ensure_ascii=True))["text"]
        entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "event": event,
            "data": json.loads(clean),
        }
        with self._trace_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=True) + "\n")

    def _lossless(self, event: str, data: Dict[str, Any]) -> None:
        if not self._lossless_path:
            return
        clean = _redact(json.dumps(data, ensure_ascii=True))["text"]
        entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "event": event,
            "session_id": self._session_id,
            "data": json.loads(clean),
        }
        with self._lossless_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=True) + "\n")

    def _raw_event(self, event: str, data: Dict[str, Any]) -> None:
        if not self._raw_path:
            return
        clean = _redact(json.dumps(data, ensure_ascii=True))["text"]
        entry = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "event": event,
            "session_id": self._session_id,
            "data": json.loads(clean),
        }
        with self._raw_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=True) + "\n")


def register(ctx) -> None:
    ctx.register_memory_provider(SelfmemCanaryProvider())


def _normalize_tool_name(tool_name: str) -> str:
    if tool_name.startswith("supermemory_"):
        return "selfmem_" + tool_name.removeprefix("supermemory_")
    return tool_name


def _discover_supermemory_container(hermes_home: Path, kwargs: Dict[str, Any]) -> str:
    direct = (
        str(kwargs.get("supermemory_container") or "")
        or os.environ.get("SELFMEM_SOURCE_SUPERMEMORY_CONTAINER", "")
        or os.environ.get("SUPERMEMORY_CONTAINER_TAG", "")
        or os.environ.get("SUPERMEMORY_CONTAINER", "")
        or os.environ.get("SUPERMEMORY_TAG", "")
    ).strip()
    if direct:
        return direct

    candidates = [
        hermes_home / "config.yaml",
        hermes_home / "config.yml",
        hermes_home / "config.json",
        hermes_home / ".env",
        hermes_home.parent / ".env",
    ]
    for file in candidates:
        if not file.exists() or not file.is_file():
            continue
        try:
            text = _redact(file.read_text(encoding="utf-8", errors="ignore"))["text"]
        except Exception:
            continue
        found = _extract_container_from_text(text)
        if found:
            return found
    return ""


def _load_selfmem_env(hermes_home: Path) -> None:
    for file in [
        hermes_home / "selfmem_canary" / "keys.env",
        hermes_home / "selfmem_canary" / ".env",
        hermes_home / ".env",
        hermes_home.parent / ".env",
    ]:
        if not file.exists() or not file.is_file():
            continue
        try:
            lines = file.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            if stripped.startswith("export "):
                stripped = stripped[len("export "):].strip()
            name, value = stripped.split("=", 1)
            name = name.strip()
            if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name) or os.environ.get(name):
                continue
            os.environ[name] = value.strip().strip("'\"")


def _voyage_keys_from_env() -> List[str]:
    candidates = []
    candidates.extend(os.environ.get("SELFMEM_VOYAGE_API_KEYS", "").split(","))
    candidates.extend(os.environ.get("VOYAGE_API_KEYS", "").split(","))
    candidates.append(os.environ.get("SELFMEM_VOYAGE_API_KEY", ""))
    candidates.append(os.environ.get("VOYAGE_API_KEY", ""))
    keys = []
    seen = set()
    for key in candidates:
        cleaned = key.strip()
        if cleaned and cleaned not in seen:
            keys.append(cleaned)
            seen.add(cleaned)
    return keys


def _first_voyage_key_from_env() -> str:
    keys = _voyage_keys_from_env()
    return keys[0] if keys else ""


def _load_agent_setup(hermes_home: Path, agent_identity: str) -> Dict[str, Any]:
    candidates = [
        hermes_home / "selfmem_canary" / "agents" / f"{_safe_name(agent_identity)}.json",
        hermes_home / "selfmem_canary" / "agent-setup.json",
    ]
    for file in candidates:
        if not file.exists() or not file.is_file():
            continue
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        if data.get("agent_identity") and str(data.get("agent_identity")) != agent_identity:
            continue
        return data
    return {}


def _extract_container_from_text(text: str) -> str:
    patterns = [
        r"(?:container[_-]?tag|containerTag|supermemory[_-]?container|SUPERMEMORY_CONTAINER_TAG|SUPERMEMORY_CONTAINER)\s*[:=]\s*['\"]?([A-Za-z0-9_.:-]{3,160})",
        r"(?:tag|namespace)\s*[:=]\s*['\"]?((?:codex|repo|hermes|claude|selfmem)[A-Za-z0-9_.:-]{3,160})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return (match.group(1) or "").strip().strip("'\"")
    return ""


def _local_container_for(agent_identity: str, source_supermemory_container: str) -> str:
    seed = source_supermemory_container or agent_identity or "unknown-agent"
    cleaned = _safe_name(seed)
    if not cleaned:
        cleaned = "unknown-agent"
    return f"selfmem_{cleaned}"[:180]


def _safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.:-]+", "_", value or "").strip("_")


def _stable_ref(content: str) -> str:
    return f"raw:{hashlib.sha256(_coerce_text(content).encode('utf-8')).hexdigest()[:24]}"


def _distill_content(content: str, metadata: Dict[str, Any]) -> str:
    source = str(metadata.get("type") or metadata.get("source") or "memory")
    statements = []
    for line in re.split(r"\n+|(?<=[.!?])\s+", _coerce_text(content)):
        compact = re.sub(r"\s+", " ", line).strip()
        if len(compact) < 24:
            continue
        if _is_scaffold(compact):
            continue
        kind = _classify_kind(compact, source)
        score = _distill_score(compact, kind)
        if score <= 0:
            continue
        statements.append((score, kind, compact[:360]))
    statements.sort(key=lambda item: (-item[0], len(item[2])))
    if not statements:
        return ""
    score, kind, text = statements[0]
    return f"{kind}: {text}"


def _is_scaffold(text: str) -> bool:
    patterns = [
        r"^review the conversation above",
        r"^if something stands out",
        r"^if nothing is worth saving",
        r"^nothing to save",
        r"^has the user expressed",
        r"^should this be preserved",
        r"^system:",
        r"^developer:",
        r"^tool:",
        r"^(want me|would you like|do you want|should i|can i)\b",
        r"\?\s*$",
    ]
    lower = text.lower()
    return any(re.search(pattern, lower) for pattern in patterns)


def _classify_kind(text: str, source: str) -> str:
    lower = text.lower()
    if source == "conversation_turn":
        if re.search(r"\b(prefer|preference|likes?|wants?|style|tone)\b", lower):
            return "Preference"
        if re.search(r"\b(decision|decided|default|keep|route|canonical|policy|should|must|do not)\b", lower):
            return "Decision"
    if re.search(r"\b(prefer|preference|likes?|wants?|style|tone)\b", lower):
        return "Preference"
    if re.search(r"\b(decision|decided|default|keep|route|canonical|policy|should|must|do not)\b", lower):
        return "Decision"
    if re.search(r"\b(command|install|setup|configure|run|workflow|hook|script|path|env|vm|gateway|lcm|compress)\b", lower):
        return "Procedure"
    if re.search(r"\b(bug|error|failure|issue|blocked|quota|maxed|limit|leak|redact)\b", lower):
        return "Bug"
    if re.search(r"\b(fix|fixed|resolved|patched|hardened|fallback|degrade)\b", lower):
        return "Fix"
    return "Fact"


def _distill_score(text: str, kind: str) -> int:
    lower = text.lower()
    score = 1 if kind != "Fact" else 0
    if re.search(r"\b(remember|important|durable|preference|decision|workflow|gotcha|fixed|default|lcm|compress|memory)\b", lower):
        score += 2
    if re.search(r"\b(secret|api key|token|password|credential)\b", lower):
        score -= 2
    return score


def _redact(text: Any) -> Dict[str, Any]:
    count = 0

    def repl_private(_match):
        nonlocal count
        count += 1
        return "[REDACTED_PRIVATE]"

    output = _PRIVATE_RE.sub(repl_private, _coerce_text(text))
    for pattern, replacement in _KEY_PATTERNS:
        output, n = pattern.subn(replacement, output)
        count += n
    visible = re.sub(r"\[[A-Z0-9_]+\]", "", output).strip()
    return {
        "text": output,
        "redacted": count > 0,
        "redaction_count": count,
        "fully_private": len(visible) == 0,
    }


def _tokens(text: str) -> List[str]:
    text = re.sub(r"containertag", "container tag", _coerce_text(text).lower())
    raw = re.split(r"[^a-z0-9_/-]+", text)
    return [_normalize_token(token) for token in raw if len(token) > 1]


def _normalize_token(token: str) -> str:
    token = token.strip("_-/")
    if token in ("private", "privacy", "redaction"):
        return "privacy"
    if token in ("keys", "key", "credential", "credentials"):
        return "credential"
    if token in ("working", "works", "worked"):
        return "work"
    if token.endswith("ing") and len(token) > 5:
        return token[:-3]
    if token.endswith("s") and len(token) > 4:
        return token[:-1]
    return token


def _clamp_limit(value: Any) -> int:
    try:
        return max(1, min(20, int(value)))
    except Exception:
        return _DEFAULT_TOP_K


def _is_trivial(text: str) -> bool:
    return bool(_TRIVIAL_RE.match(_coerce_text(text).strip()))


def _coerce_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(part for part in (_coerce_text(item) for item in value) if part)
    if isinstance(value, dict):
        for key in ("text", "content", "message", "summary", "output"):
            if key in value:
                return _coerce_text(value.get(key))
        try:
            return json.dumps(value, ensure_ascii=True)
        except Exception:
            return str(value)
    return str(value)


def _recall_decision(query: Any) -> Dict[str, Any]:
    if os.environ.get("SELFMEM_RECALL_EVERY_TURN") == "1":
        return {"recall": True, "reason": "forced"}
    text = re.sub(r"\s+", " ", _coerce_text(query)).strip()
    if len(text) < 8 or len(_tokens(text)) < 2:
        return {"recall": False, "reason": "empty-or-trivial"}
    if _MAINTENANCE_RE.search(text) and not _RECALL_INTENT_RE.search(text):
        return {"recall": False, "reason": "maintenance"}
    return {"recall": True, "reason": "normal"}


def _compact_messages(messages: List[Any]) -> List[Dict[str, Any]]:
    compacted = []
    for index, message in enumerate(messages):
        if not isinstance(message, dict):
            text = _redact(message)["text"]
            role = "unknown"
        else:
            role = str(message.get("role") or "unknown")
            text = _redact(message.get("content", ""))["text"]
        text = re.sub(r"\s+", " ", text).strip()
        compacted.append({
            "index": index,
            "role": role,
            "content_length": len(text),
            "content_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest()[:16] if text else "",
            "preview": text[:220],
        })
    return compacted


def _rerank_candidate_limit() -> int:
    try:
        return max(4, min(50, int(os.environ.get("SELFMEM_RERANK_CANDIDATE_LIMIT", str(_RERANK_CANDIDATE_LIMIT)))))
    except Exception:
        return _RERANK_CANDIDATE_LIMIT


def _rerank_token_budget() -> int:
    try:
        return max(0, int(os.environ.get("SELFMEM_RERANK_TOKEN_BUDGET", str(_RERANK_TOKEN_BUDGET))))
    except Exception:
        return _RERANK_TOKEN_BUDGET


def _estimate_tokens(text: str) -> int:
    return math.ceil(len([part for part in re.split(r"\s+", _coerce_text(text)) if part]) * 1.35)


def _normalized_content_hash(text: str) -> str:
    normalized = re.sub(r"\s+", " ", _coerce_text(text).lower()).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _public_item(item: Dict[str, Any]) -> Dict[str, Any]:
    clone = dict(item)
    clone.pop("embedding", None)
    return clone


def _merge_ranked_results(result_sets: List[List[Dict[str, Any]]], limit: int) -> List[Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    weights = [1.0, 0.95]
    rrf_k = 60
    for set_index, results in enumerate(result_sets):
        weight = weights[set_index] if set_index < len(weights) else 0.8
        for rank, item in enumerate(results):
            content = str(item.get("content") or "")
            if not content.strip():
                continue
            key = hashlib.sha256(re.sub(r"\s+", " ", content.lower()).strip().encode("utf-8")).hexdigest()
            score = weight / (rrf_k + rank + 1)
            existing = merged.get(key)
            if existing is None:
                clone = _public_item(item)
                clone["hybrid_score"] = score
                merged[key] = clone
                continue
            existing["hybrid_score"] = float(existing.get("hybrid_score") or 0.0) + score
            if existing.get("memory_source") != "local_selfmem" and item.get("memory_source") == "local_selfmem":
                clone = _public_item(item)
                clone["hybrid_score"] = existing["hybrid_score"]
                merged[key] = clone
    output = list(merged.values())
    output.sort(key=lambda item: (-float(item.get("hybrid_score") or 0.0), item.get("memory_source") != "local_selfmem", str(item.get("id") or "")))
    return output[:limit]


def _source_label(item: Dict[str, Any]) -> str:
    source = str(item.get("memory_source") or "")
    if source == "supermemory_read_through":
        return "supermemory-history"
    if source == "local_selfmem":
        return "local-selfmem"
    return "memory"


def _cosine(a: List[float], b: List[float]) -> float:
    length = min(len(a), len(b))
    if length == 0:
        return 0.0
    dot = 0.0
    a_norm = 0.0
    b_norm = 0.0
    for index in range(length):
        av = float(a[index] or 0.0)
        bv = float(b[index] or 0.0)
        dot += av * bv
        a_norm += av * av
        b_norm += bv * bv
    if a_norm == 0.0 or b_norm == 0.0:
        return 0.0
    return dot / (math.sqrt(a_norm) * math.sqrt(b_norm))


def _sanitize_error(message: str) -> str:
    output = _coerce_text(message)
    for pattern, replacement in _KEY_PATTERNS:
        output = pattern.sub(replacement, output)
    return output[:500]
