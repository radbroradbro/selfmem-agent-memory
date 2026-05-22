#!/usr/bin/env python3
"""Set up a per-agent selfmem container mapped to an agent's Supermemory container."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parent


def main() -> None:
    args = parse_args()
    home = Path(args.home).expanduser().resolve()
    source_container = args.supermemory_container or detect_container(args.host, home)
    if not source_container and not args.allow_missing_container:
        raise SystemExit(
            "No agent-specific Supermemory container was detected. "
            "Pass --supermemory-container for this agent so selfmem does not pool memories across agents."
        )

    agent = args.agent or detect_agent(args.host, home) or "unknown-agent"
    local_container = args.local_container or local_container_for(source_container or agent)
    setup = build_setup(args.host, agent, home, source_container, local_container)
    credential_install = write_setup(setup)
    if args.keys_file:
        credential_install = install_local_keys(setup, Path(args.keys_file).expanduser().resolve())

    if args.install and args.host == "hermes":
        install_hermes(args.repo)
    elif args.install and args.host == "openclaw":
        install_openclaw(args.repo)

    smoke = None
    if args.run_canary:
        smoke = run_canary(args.host)

    output: dict[str, Any] = {
        "ok": True,
        "host": args.host,
        "agentIdentity": agent,
        "home": str(home),
        "sourceSupermemoryContainer": source_container or None,
        "localSelfmemContainer": local_container,
        "setupPath": str(setup["setup_path"]),
        "containerMapPath": str(setup["container_map_path"]),
        "storeDir": str(setup["store_dir"]),
        "installed": bool(args.install),
        "credentialInstall": credential_install,
        "liveCredentialStatus": credential_status(args.host, home, bool(source_container)),
        "canary": smoke,
        "nextSteps": next_steps(args.host, args.repo),
    }
    print(json.dumps(output, indent=2, sort_keys=True))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=["hermes", "openclaw"], required=True)
    parser.add_argument("--agent", default="")
    parser.add_argument("--supermemory-container", default="")
    parser.add_argument("--local-container", default="")
    parser.add_argument("--home", default="")
    parser.add_argument("--repo", default="")
    parser.add_argument("--install", action="store_true")
    parser.add_argument("--run-canary", action="store_true")
    parser.add_argument("--allow-missing-container", action="store_true")
    parser.add_argument("--keys-file", default="", help="Optional local credentials file to copy into this agent's selfmem home. Never commit this file.")
    args = parser.parse_args()
    if not args.home:
        if args.host == "openclaw" and os.environ.get("OPENCLAW_STATE_DIR"):
            args.home = os.environ["OPENCLAW_STATE_DIR"]
        elif args.host == "openclaw" and os.environ.get("OPENCLAW_HOME"):
            args.home = os.environ["OPENCLAW_HOME"]
        else:
            args.home = str(Path.home() / (".hermes" if args.host == "hermes" else ".openclaw"))
    return args


def build_setup(host: str, agent: str, home: Path, source_container: str, local_container: str) -> dict[str, Any]:
    root = home / ("selfmem_canary" if host == "hermes" else "selfmem")
    agent_dir = root / "agents"
    container_dir = root / "containers" / safe_name(local_container)
    setup_path = agent_dir / f"{safe_name(agent)}.json"
    container_map_path = container_dir / "container-map.json"
    return {
        "version": 1,
        "host": host,
        "agent_identity": agent,
        "source_supermemory_container": source_container,
        "local_container": local_container,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "setup_path": setup_path,
        "container_map_path": container_map_path,
        "store_dir": container_dir,
        "mode": "local-write-supermemory-read-through",
        "search_policy": "union_local_and_supermemory_read_through",
        "lifecycle_requirements": lifecycle_requirements(host),
    }


def write_setup(setup: dict[str, Any]) -> dict[str, Any]:
    serializable = {
        key: str(value) if isinstance(value, Path) else value
        for key, value in setup.items()
    }
    for path_key in ("setup_path", "container_map_path", "store_dir"):
        Path(serializable[path_key]).parent.mkdir(parents=True, exist_ok=True)
    Path(serializable["store_dir"]).mkdir(parents=True, exist_ok=True)
    Path(serializable["setup_path"]).write_text(json.dumps(serializable, indent=2, sort_keys=True), encoding="utf-8")
    Path(serializable["container_map_path"]).write_text(json.dumps(serializable, indent=2, sort_keys=True), encoding="utf-8")
    install_audit_script(serializable)
    return {
        "installed": False,
        "reason": "no keys file requested",
        "target": str(Path(serializable["store_dir"]).parents[1] / "keys.env"),
    }


def install_local_keys(setup: dict[str, Any], source: Path) -> dict[str, Any]:
    target_root = Path(setup["store_dir"]).parents[1]
    target = target_root / "keys.env"
    if not source.exists():
        return {
            "installed": False,
            "reason": "keys file missing",
            "source": str(source),
            "target": str(target),
        }
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    target.chmod(0o600)
    return {
        "installed": True,
        "source": str(source),
        "target": str(target),
        "mode": "0600",
    }


def install_audit_script(setup: dict[str, Any]) -> None:
    if setup.get("host") != "openclaw":
        return
    source = REPO_ROOT / "packages" / "adapters" / "openclaw" / "selfmem_audit.py"
    if not source.exists():
        return
    target = Path(setup["store_dir"]).parents[1] / "audit.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    target.chmod(0o755)


def lifecycle_requirements(host: str) -> list[str]:
    if host == "hermes":
        return ["prefetch", "sync_turn", "on_pre_compress", "on_memory_write", "on_session_end", "tool_aliases"]
    return ["session_start", "before_prompt_build", "agent_end", "memory_tools", "tool_aliases"]


def detect_container(host: str, home: Path) -> str:
    env_names = [
        "SELFMEM_SOURCE_SUPERMEMORY_CONTAINER",
        "SUPERMEMORY_CONTAINER_TAG",
        "SUPERMEMORY_CONTAINER",
        "SUPERMEMORY_TAG",
    ]
    for name in env_names:
        if os.environ.get(name):
            return os.environ[name].strip()
    for text in collect_text_sources(host, home):
        found = extract_container(scrub(text))
        if found:
            return found
    return ""


def detect_agent(host: str, home: Path) -> str:
    env_names = ["HERMES_AGENT_IDENTITY", "HERMES_BOT_NAME", "OPENCLAW_AGENT_IDENTITY", "OPENCLAW_BOT_NAME", "BOT_NAME"]
    for name in env_names:
        if os.environ.get(name):
            return os.environ[name].strip()
    for text in collect_text_sources(host, home):
        match = re.search(r"(?:agent[_-]?identity|bot[_-]?name|name)\s*[:=]\s*['\"]?([A-Za-z0-9_.:-]{3,120})", scrub(text), re.I)
        if match:
            return (match.group(1) or "").strip().strip("'\"")
    return ""


def collect_text_sources(host: str, home: Path) -> list[str]:
    names = ["config.yaml", "config.yml", "config.json", ".env"]
    if host == "openclaw":
        names.extend(["openclaw.json", "plugin.json"])
    texts: list[str] = []
    for file in [home / name for name in names] + [home.parent / ".env", Path.cwd() / ".env"]:
        if file.exists() and file.is_file():
            try:
                texts.append(file.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                pass
    return texts


def extract_container(text: str) -> str:
    patterns = [
        r"(?:container[_-]?tag|containerTag|supermemory[_-]?container|SUPERMEMORY_CONTAINER_TAG|SUPERMEMORY_CONTAINER)\s*[:=]\s*['\"]?([A-Za-z0-9_.:-]{3,180})",
        r"(?:tag|namespace)\s*[:=]\s*['\"]?((?:codex|repo|hermes|claude|openclaw|selfmem)[A-Za-z0-9_.:-]{3,180})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return (match.group(1) or "").strip().strip("'\"")
    return ""


def install_hermes(repo: str) -> None:
    if not repo:
        return
    target = Path(repo).expanduser().resolve() / "plugins" / "memory" / "selfmem_canary"
    source = REPO_ROOT / "packages" / "adapters" / "hermes" / "selfmem_canary"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def install_openclaw(repo: str) -> None:
    if not repo:
        return
    target = Path(repo).expanduser().resolve() / "plugins" / "selfmem_canary"
    source = REPO_ROOT / "packages" / "adapters" / "openclaw" / "selfmem_canary"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def run_canary(host: str) -> dict[str, Any]:
    command = (
        [sys.executable, str(REPO_ROOT / "packages" / "adapters" / "hermes" / "selfmem_canary_standalone_smoke.py")]
        if host == "hermes"
        else ["node", str(REPO_ROOT / "packages" / "adapters" / "openclaw" / "selfmem_canary_standalone_smoke.mjs")]
    )
    result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=30)
    return {
        "ok": result.returncode == 0,
        "evidenceType": "adapter-smoke-with-mocked-provider-calls",
        "command": " ".join(command),
        "stdout": parse_json_or_text(result.stdout),
        "stderr": scrub(result.stderr)[-1000:],
    }


def credential_status(host: str, home: Path, has_source_container: bool) -> dict[str, Any]:
    texts = []
    key_files = key_file_candidates(host, home)
    for file in key_files:
        if file.exists() and file.is_file():
            try:
                texts.append(file.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                pass
    env_text = "\n".join(f"{name}={value}" for name, value in os.environ.items() if name.startswith(("VOYAGE", "SELFMEM", "SUPERMEMORY")))
    texts.append(env_text)
    combined = "\n".join(texts)
    voyage_keys = set(re.findall(r"pa-[A-Za-z0-9_-]{20,}", combined))
    supermemory_keys = set(re.findall(r"sm_[A-Za-z0-9_-]{20,}", combined))
    return {
        "keyFilesPresent": [str(file) for file in key_files if file.exists()],
        "voyageKeyCount": len(voyage_keys),
        "supermemoryReadKeyPresent": len(supermemory_keys) > 0,
        "semanticProviderReady": len(voyage_keys) > 0,
        "supermemoryReadThroughReady": len(supermemory_keys) > 0 and has_source_container,
        "note": "This reports presence only. It does not print raw key values.",
    }


def key_file_candidates(host: str, home: Path) -> list[Path]:
    if host == "hermes":
        return [
            home / "selfmem_canary" / "keys.env",
            home / "selfmem_canary" / ".env",
            home / ".env",
        ]
    return [
        home / "selfmem" / "keys.env",
        home / "selfmem" / ".env",
        home / ".env",
    ]


def parse_json_or_text(text: str) -> Any:
    clean = scrub(text.strip())
    try:
        return json.loads(clean)
    except Exception:
        return clean[-2000:]


def next_steps(host: str, repo: str) -> list[str]:
    if host == "hermes":
        return [
            "Run the live Hermes smoke from the Hermes repo with its virtualenv active.",
            "Confirm prefetch, sync_turn, on_pre_compress, on_memory_write, and on_session_end traces.",
            "Keep memory.provider set to selfmem_canary after the canary passes.",
            "For old hosted memories, set SUPERMEMORY_API_KEY or SELFMEM_SUPERMEMORY_READ_KEY plus the mapped source container; reads are optional and writes stay local.",
        ]
    return [
        "Install the selfmem_canary OpenClaw plugin into the target OpenClaw plugin directory.",
        "Confirm session_start, before_prompt_build, agent_end, and memory tools run for the target agent.",
        "Run python3 $OPENCLAW_STATE_DIR/selfmem/audit.py --json after a real session.",
        "Keep the plugin in the target OpenClaw memory slot after the canary passes.",
        "For old hosted memories, set SUPERMEMORY_API_KEY or SELFMEM_SUPERMEMORY_READ_KEY plus the mapped source container; reads are optional and writes stay local.",
    ]


def local_container_for(source: str) -> str:
    return f"selfmem_{safe_name(source or 'unknown-agent')}"[:180]


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.:-]+", "_", value or "").strip("_") or "unknown-agent"


def scrub(text: str) -> str:
    output = text or ""
    for pattern in [
        r"sm_[A-Za-z0-9_-]{20,}",
        r"pa-[A-Za-z0-9_-]{20,}",
        r"AIza[A-Za-z0-9_-]{20,}",
        r"nvapi-[A-Za-z0-9_-]{20,}",
        r"sk-[A-Za-z0-9_-]{20,}",
        r"jina_[A-Za-z0-9_-]{20,}",
    ]:
        output = re.sub(pattern, "[REDACTED_KEY]", output)
    return output


if __name__ == "__main__":
    main()
