#!/usr/bin/env python3
"""Detect a Hermes agent's current Supermemory container and local selfmem target."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Iterable


KEY_PATTERNS = [
    re.compile(r"sm_[A-Za-z0-9_-]{20,}"),
    re.compile(r"pa-[A-Za-z0-9_-]{20,}"),
    re.compile(r"AIza[A-Za-z0-9_-]{20,}"),
    re.compile(r"nvapi-[A-Za-z0-9_-]{20,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
]


def main() -> None:
    hermes_home = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes"))).expanduser()
    agent_identity = (
        os.environ.get("HERMES_AGENT_IDENTITY")
        or os.environ.get("HERMES_BOT_NAME")
        or os.environ.get("BOT_NAME")
        or detect_agent_identity(hermes_home)
        or "unknown-agent"
    )
    sources = collect_sources(hermes_home)
    container = first_container(sources)
    local_container = local_container_for(agent_identity, container)
    output = {
        "ok": True,
        "hermesHome": str(hermes_home),
        "agentIdentity": agent_identity,
        "sourceSupermemoryContainer": container or None,
        "localSelfmemContainer": local_container,
        "sourcesChecked": [source["label"] for source in sources],
        "nextStep": "Install selfmem_canary with this local container before changing memory.provider.",
    }
    print(json.dumps(output, indent=2, sort_keys=True))


def collect_sources(hermes_home: Path) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = []
    env_text = "\n".join(f"{key}={value}" for key, value in os.environ.items() if "SUPERMEMORY" in key or "CONTAINER" in key or "HERMES" in key)
    sources.append({"label": "environment", "text": scrub(env_text)})
    for file in candidate_files(hermes_home):
        if not file.exists() or not file.is_file():
            continue
        try:
            sources.append({"label": str(file), "text": scrub(file.read_text(encoding="utf-8", errors="ignore"))})
        except Exception:
            continue
    dump = hermes_dump()
    if dump:
        sources.append({"label": "hermes dump", "text": scrub(dump)})
    return sources


def candidate_files(hermes_home: Path) -> Iterable[Path]:
    yield hermes_home / "config.yaml"
    yield hermes_home / "config.yml"
    yield hermes_home / "config.json"
    yield hermes_home / ".env"
    yield hermes_home.parent / ".env"
    yield Path.cwd() / ".env"


def first_container(sources: list[dict[str, str]]) -> str:
    for source in sources:
        found = extract_container(source["text"])
        if found:
            return found
    return ""


def extract_container(text: str) -> str:
    patterns = [
        r"(?:container[_-]?tag|containerTag|supermemory[_-]?container|SUPERMEMORY_CONTAINER_TAG|SUPERMEMORY_CONTAINER)\s*[:=]\s*['\"]?([A-Za-z0-9_.:-]{3,180})",
        r"(?:tag|namespace)\s*[:=]\s*['\"]?((?:codex|repo|hermes|claude|selfmem)[A-Za-z0-9_.:-]{3,180})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return (match.group(1) or "").strip().strip("'\"")
    return ""


def detect_agent_identity(hermes_home: Path) -> str:
    for source in collect_sources_without_dump(hermes_home):
        for pattern in [
            r"(?:agent[_-]?identity|bot[_-]?name|name)\s*[:=]\s*['\"]?([A-Za-z0-9_.:-]{3,120})",
        ]:
            match = re.search(pattern, source, re.IGNORECASE)
            if match:
                return (match.group(1) or "").strip().strip("'\"")
    return ""


def collect_sources_without_dump(hermes_home: Path) -> list[str]:
    texts = []
    for file in candidate_files(hermes_home):
        if file.exists() and file.is_file():
            try:
                texts.append(scrub(file.read_text(encoding="utf-8", errors="ignore")))
            except Exception:
                pass
    return texts


def local_container_for(agent_identity: str, source_container: str) -> str:
    seed = source_container or agent_identity or "unknown-agent"
    clean = re.sub(r"[^A-Za-z0-9_.:-]+", "_", seed).strip("_") or "unknown-agent"
    return f"selfmem_{clean}"[:180]


def hermes_dump() -> str:
    if not shutil.which("hermes"):
        return ""
    try:
        result = subprocess.run(["hermes", "dump"], capture_output=True, text=True, timeout=8, check=False)
    except Exception:
        return ""
    return "\n".join([result.stdout, result.stderr])


def scrub(text: str) -> str:
    output = text or ""
    for pattern in KEY_PATTERNS:
        output = pattern.sub("[REDACTED_KEY]", output)
    return output


if __name__ == "__main__":
    main()

