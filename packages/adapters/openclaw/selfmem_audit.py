#!/usr/bin/env python3
"""Audit OpenClaw selfmem reliability logs."""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import sys
from collections import Counter
from pathlib import Path
from typing import Any


KEY_PATTERNS = [
    re.compile(r"</?private>", re.I),
    re.compile(r"pa-[A-Za-z0-9_-]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"jina_[0-9A-Za-z_-]{20,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"sm_[A-Za-z0-9_-]{20,}"),
    re.compile(r"nvapi-[A-Za-z0-9_-]{20,}"),
]
ERROR_EVENTS = {
    "search_error",
    "search_fallback",
    "supermemory_read_through_error",
    "voyage_search_error",
}
LIFECYCLE_EVENTS = {
    "session_start",
    "before_prompt_build",
    "agent_end",
}
COMPRESSION_EVENTS = {
    "compression_checkpoint",
    "compression_checkpoint_raw",
    "lcm_after_compression_prompt_build",
}


def main() -> None:
    args = parse_args()
    home = resolve_home(args.home)
    containers = sorted((home / "selfmem" / "containers").glob("*"))
    reports = [audit_container(path) for path in containers if path.is_dir()]
    aggregate = aggregate_reports(home, reports)
    if args.json:
        print(json.dumps(aggregate, indent=2, sort_keys=True))
    else:
        print_text_report(aggregate)
    if args.fail_on_warn and aggregate["summary"]["warningCount"]:
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", default="")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--fail-on-warn", action="store_true")
    return parser.parse_args()


def resolve_home(value: str) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    return Path(
        os.environ.get("OPENCLAW_STATE_DIR")
        or os.environ.get("OPENCLAW_HOME")
        or Path.home() / ".openclaw"
    ).expanduser().resolve()


def audit_container(container: Path) -> dict[str, Any]:
    trace = read_jsonl(container / "trace.jsonl")
    raw = read_jsonl(container / "raw_events.jsonl")
    memories = read_jsonl(container / "memories.jsonl")
    container_map = read_json(container / "container-map.json")
    events = Counter(str(item.get("event", "")) for item in trace)
    raw_events = Counter(str(item.get("event", "")) for item in raw)
    warnings: list[str] = []

    if not trace:
        warnings.append("No trace.jsonl events found.")
    missing = sorted(event for event in LIFECYCLE_EVENTS if events.get(event, 0) == 0)
    if missing:
        warnings.append(f"Missing lifecycle events: {', '.join(missing)}.")
    if events.get("store", 0) == 0:
        warnings.append("No store events found.")
    if events.get("agent_end_write_suppressed", 0) and not container_map.get("read_only"):
        warnings.append("Writes were suppressed even though container map is not read-only.")
    if container_map.get("agent_identity") in ("", None, "unknown-agent"):
        warnings.append("Agent identity is unresolved or unknown-agent.")
    if privacy_leak_count(trace, raw, memories):
        warnings.append("Potential private/key-shaped content found in logs.")

    before_prompt = [item for item in trace if item.get("event") == "before_prompt_build"]
    before_prompt_skipped = [item for item in trace if item.get("event") == "before_prompt_build_skipped"]
    search_events = [item for item in trace if item.get("event") == "search"]
    maintenance_searches = [
        item for item in search_events
        if re.search(r"\b(heartbeat|cron|watchdog|diagnostic|doctor|reliability|status|healthcheck|ping)\b", nested_str(item, "data", "query"), re.I)
    ]
    zero_result_turns = sum(1 for item in search_events if nested_int(item, "data", "result_count") == 0)
    local_counts = [nested_int(item, "data", "local_result_count") for item in search_events]
    remote_counts = [nested_int(item, "data", "supermemory_result_count") for item in search_events]
    result_counts = [nested_int(item, "data", "result_count") for item in search_events]
    hybrid_seen = any(local > 0 and remote > 0 for local, remote in zip(local_counts, remote_counts))
    read_through_seen = any(remote > 0 for remote in remote_counts)
    voyage_errors = events.get("voyage_search_error", 0)
    supermemory_errors = events.get("supermemory_read_through_error", 0)
    voyage_key_fallbacks = events.get("voyage_key_fallback", 0)
    embedding_backfills = events.get("embedding_backfill", 0)
    dedupe_suppressed = events.get("store_deduped", 0)
    last_usage = latest_usage(search_events)
    compression_seen = any(events.get(event, 0) or raw_events.get(event, 0) for event in COMPRESSION_EVENTS)
    compression_like_prompt_seen = events.get("lcm_after_compression_prompt_build", 0) > 0
    if search_events and len(maintenance_searches) / len(search_events) > 0.25 and not before_prompt_skipped:
        warnings.append("More than 25% of searches look like maintenance/status traffic and no recall skip events were recorded.")
    if last_usage.get("rerank_tokens", 0) > 500000:
        warnings.append("Rerank token usage is high; confirm maintenance recall gating and embedding cache are installed.")

    return {
        "container": container.name,
        "path": str(container),
        "agentIdentity": container_map.get("agent_identity"),
        "sourceSupermemoryContainer": container_map.get("source_supermemory_container"),
        "localContainer": container_map.get("local_container"),
        "readOnly": bool(container_map.get("read_only")),
        "eventCounts": dict(events),
        "rawEventCounts": dict(raw_events),
        "memoryCount": len(memories),
        "traceCount": len(trace),
        "rawCount": len(raw),
        "lifecycleCovered": all(events.get(event, 0) > 0 for event in LIFECYCLE_EVENTS),
        "hybridSearchCovered": hybrid_seen,
        "supermemoryReadThroughReturnedResults": read_through_seen,
        "compressionCheckpointSeen": compression_seen,
        "compressionLikePromptSeen": compression_like_prompt_seen,
        "zeroResultTurns": zero_result_turns,
        "zeroResultRate": safe_div(zero_result_turns, len(search_events)),
        "maintenanceSearchCount": len(maintenance_searches),
        "beforePromptSkippedCount": len(before_prompt_skipped),
        "searchCount": len(search_events),
        "beforePromptCount": len(before_prompt),
        "embeddingBackfillCount": embedding_backfills,
        "dedupeSuppressedCount": dedupe_suppressed,
        "voyageKeyFallbackCount": voyage_key_fallbacks,
        "lastUsage": last_usage,
        "storeCount": events.get("store", 0),
        "agentEndCount": events.get("agent_end", 0),
        "writeSuppressedCount": events.get("agent_end_write_suppressed", 0),
        "errorCount": sum(events.get(event, 0) for event in ERROR_EVENTS),
        "voyageErrorCount": voyage_errors,
        "supermemoryReadThroughErrorCount": supermemory_errors,
        "privacyLeakCount": privacy_leak_count(trace, raw, memories),
        "resultCountP50": percentile(result_counts, 0.5),
        "resultCountP95": percentile(result_counts, 0.95),
        "warnings": warnings,
    }


def aggregate_reports(home: Path, reports: list[dict[str, Any]]) -> dict[str, Any]:
    warnings = [warning for report in reports for warning in report["warnings"]]
    ok = bool(reports) and not warnings and sum(report["privacyLeakCount"] for report in reports) == 0
    return {
        "ok": ok,
        "home": str(home),
        "summary": {
            "containerCount": len(reports),
            "warningCount": len(warnings),
            "privacyLeakCount": sum(report["privacyLeakCount"] for report in reports),
            "totalTraceEvents": sum(report["traceCount"] for report in reports),
            "totalMemories": sum(report["memoryCount"] for report in reports),
            "totalSearches": sum(report["searchCount"] for report in reports),
        "totalStores": sum(report["storeCount"] for report in reports),
        "totalErrors": sum(report["errorCount"] for report in reports),
        "totalMaintenanceSearches": sum(report["maintenanceSearchCount"] for report in reports),
        "totalBeforePromptSkipped": sum(report["beforePromptSkippedCount"] for report in reports),
        "totalVoyageKeyFallbacks": sum(report["voyageKeyFallbackCount"] for report in reports),
        "totalDedupeSuppressed": sum(report["dedupeSuppressedCount"] for report in reports),
    },
        "warnings": warnings,
        "containers": reports,
    }


def print_text_report(report: dict[str, Any]) -> None:
    summary = report["summary"]
    print(f"selfmem audit: {'OK' if report['ok'] else 'WARN'}")
    print(f"home: {report['home']}")
    print(f"containers: {summary['containerCount']}")
    print(f"memories: {summary['totalMemories']}")
    print(f"searches: {summary['totalSearches']}")
    print(f"stores: {summary['totalStores']}")
    print(f"errors: {summary['totalErrors']}")
    print(f"privacy leaks: {summary['privacyLeakCount']}")
    print(f"maintenance searches: {summary['totalMaintenanceSearches']}")
    print(f"skipped auto-recalls: {summary['totalBeforePromptSkipped']}")
    print(f"Voyage key fallbacks: {summary['totalVoyageKeyFallbacks']}")
    print(f"duplicates suppressed: {summary['totalDedupeSuppressed']}")
    for warning in report["warnings"]:
        print(f"WARN: {warning}")
    for container in report["containers"]:
        print("")
        print(f"[{container['container']}]")
        print(f"agent: {container.get('agentIdentity')}")
        print(f"source Supermemory: {container.get('sourceSupermemoryContainer')}")
        print(f"lifecycle covered: {container['lifecycleCovered']}")
        print(f"hybrid search covered: {container['hybridSearchCovered']}")
        print(f"compression checkpoint seen: {container['compressionCheckpointSeen']}")
        print(f"zero-result rate: {container['zeroResultRate']:.1%}")
        print(f"maintenance searches: {container['maintenanceSearchCount']}")
        print(f"skipped auto-recalls: {container['beforePromptSkippedCount']}")
        print(f"last usage: {container['lastUsage']}")


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    items = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        try:
            item = json.loads(line)
            if isinstance(item, dict):
                items.append(item)
        except Exception:
            continue
    return items


def privacy_leak_count(*collections: list[dict[str, Any]]) -> int:
    text = "\n".join(json.dumps(item, ensure_ascii=True) for collection in collections for item in collection)
    return sum(1 for pattern in KEY_PATTERNS if pattern.search(text))


def nested_int(item: dict[str, Any], *keys: str) -> int:
    value: Any = item
    for key in keys:
        value = value.get(key, {}) if isinstance(value, dict) else {}
    try:
        return int(value)
    except Exception:
        return 0


def nested_str(item: dict[str, Any], *keys: str) -> str:
    value: Any = item
    for key in keys:
        value = value.get(key, {}) if isinstance(value, dict) else {}
    return str(value or "")


def latest_usage(search_events: list[dict[str, Any]]) -> dict[str, int]:
    for item in reversed(search_events):
        usage = item.get("data", {}).get("usage", {}) if isinstance(item.get("data"), dict) else {}
        if isinstance(usage, dict):
            return {
                key: nested_usage_int(usage, key)
                for key in (
                    "embedding_tokens",
                    "rerank_tokens",
                    "embedding_calls",
                    "rerank_calls",
                    "embedding_cache_hits",
                    "embedding_cache_misses",
                    "recall_skipped",
                    "dedupe_suppressed",
                )
            }
    return {}


def nested_usage_int(usage: dict[str, Any], key: str) -> int:
    try:
        return int(usage.get(key, 0) or 0)
    except Exception:
        return 0


def safe_div(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def percentile(values: list[int], p: float) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    index = min(len(sorted_values) - 1, max(0, round((len(sorted_values) - 1) * p)))
    return float(sorted_values[index])


if __name__ == "__main__":
    main()
