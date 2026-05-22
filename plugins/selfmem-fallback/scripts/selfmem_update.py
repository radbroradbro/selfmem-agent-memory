#!/usr/bin/env python3
"""Apply a RecallWeave package update without remapping an agent's memory identity."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parent


def main() -> None:
    args = parse_args()
    home = resolve_home(args.host, args.home)
    result: dict[str, Any] = {
        "ok": True,
        "dryRun": not args.apply,
        "host": args.host,
        "home": str(home),
        "repo": args.repo or "",
        "preservedMapping": current_mapping(args.host, home),
        "steps": [],
    }

    if args.keys_file:
        result["steps"].append(install_local_keys(args.host, home, Path(args.keys_file).expanduser().resolve(), apply=args.apply))

    if args.repo:
        result["steps"].append(install_adapter(args.host, Path(args.repo).expanduser().resolve(), apply=args.apply))

    if args.install_audit and args.host == "openclaw":
        result["steps"].append(install_openclaw_audit(home, apply=args.apply))

    if args.run_canary:
        result["canary"] = run_canary(args.host)
        if not result["canary"]["ok"]:
            result["ok"] = False

    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["ok"]:
        raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=["hermes", "openclaw"], required=True)
    parser.add_argument("--home", default="")
    parser.add_argument("--repo", default="", help="Hermes or OpenClaw checkout/plugin root to update.")
    parser.add_argument("--keys-file", default="", help="Optional local credentials file to copy into this agent's selfmem home. Never commit this file.")
    parser.add_argument("--install-audit", action="store_true", default=True)
    parser.add_argument("--run-canary", action="store_true")
    parser.add_argument("--apply", action="store_true", help="Actually copy files. Without this, the updater is a dry run.")
    return parser.parse_args()


def resolve_home(host: str, value: str) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    if host == "openclaw":
        return Path(os.environ.get("OPENCLAW_STATE_DIR") or os.environ.get("OPENCLAW_HOME") or Path.home() / ".openclaw").expanduser().resolve()
    return Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes").expanduser().resolve()


def current_mapping(host: str, home: Path) -> dict[str, Any]:
    root = home / ("selfmem_canary" if host == "hermes" else "selfmem")
    maps = sorted((root / "containers").glob("*/container-map.json"))
    if not maps:
        return {"found": False}
    mappings = []
    for file in maps:
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            mappings.append({
                "path": str(file),
                "agentIdentity": data.get("agent_identity"),
                "sourceSupermemoryContainer": data.get("source_supermemory_container"),
                "localContainer": data.get("local_container"),
            })
        except Exception:
            mappings.append({"path": str(file), "error": "unreadable"})
    return {"found": True, "containers": mappings}


def install_local_keys(host: str, home: Path, source: Path, *, apply: bool) -> dict[str, Any]:
    target = home / ("selfmem_canary" if host == "hermes" else "selfmem") / "keys.env"
    if not source.exists():
        return {"step": "install_local_keys", "ok": False, "reason": "keys file missing", "target": str(target)}
    if not apply:
        return {"step": "install_local_keys", "ok": True, "dryRun": True, "source": str(source), "target": str(target)}
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    target.chmod(0o600)
    return {"step": "install_local_keys", "ok": True, "source": str(source), "target": str(target), "mode": "0600"}


def install_adapter(host: str, repo: Path, *, apply: bool) -> dict[str, Any]:
    if host == "hermes":
        source = REPO_ROOT / "packages" / "adapters" / "hermes" / "selfmem_canary"
        target = repo / "plugins" / "memory" / "selfmem_canary"
    else:
        source = REPO_ROOT / "packages" / "adapters" / "openclaw" / "selfmem_canary"
        target = repo / "plugins" / "selfmem_canary"
    if not source.exists():
        return {"step": "install_adapter", "ok": False, "reason": "adapter source missing", "source": str(source)}
    backup = None
    if target.exists():
        backup = target.with_name(f"{target.name}.bak-selfmem-update-{int(__import__('time').time())}")
    if not apply:
        return {"step": "install_adapter", "ok": True, "dryRun": True, "source": str(source), "target": str(target), "backup": str(backup) if backup else None}
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        assert backup is not None
        shutil.move(str(target), str(backup))
    shutil.copytree(source, target)
    return {"step": "install_adapter", "ok": True, "source": str(source), "target": str(target), "backup": str(backup) if backup else None}


def install_openclaw_audit(home: Path, *, apply: bool) -> dict[str, Any]:
    source = REPO_ROOT / "packages" / "adapters" / "openclaw" / "selfmem_audit.py"
    target = home / "selfmem" / "audit.py"
    if not source.exists():
        return {"step": "install_openclaw_audit", "ok": False, "reason": "audit source missing"}
    if not apply:
        return {"step": "install_openclaw_audit", "ok": True, "dryRun": True, "target": str(target)}
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    target.chmod(0o755)
    return {"step": "install_openclaw_audit", "ok": True, "target": str(target)}


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
        "stdout": parse_json(result.stdout),
        "stderr": result.stderr[-1000:],
    }


def parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except Exception:
        return text[-2000:]


if __name__ == "__main__":
    main()
