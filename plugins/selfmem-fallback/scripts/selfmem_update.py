#!/usr/bin/env python3
"""Apply a RecallWeave package update without remapping an agent's memory identity."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parent


def main() -> None:
    args = parse_args()
    started_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    home = resolve_home(args.host, args.home)
    result: dict[str, Any] = {
        "ok": True,
        "dryRun": not args.apply,
        "host": args.host,
        "home": str(home),
        "repo": args.repo or "",
        "startedAt": started_at,
        "freshCanarySince": args.canary_since or started_at,
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
        result["canary"] = run_canary(args.host, home, args)
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
    parser.add_argument("--canary-output", default="", help="Optional path for a sanitized canary report JSON.")
    parser.add_argument("--canary-intake-output", default="", help="Optional path for sanitized canary intake JSON.")
    parser.add_argument("--canary-diagnosis-output", default="", help="Optional path for sanitized canary diagnosis JSON when strict intake fails.")
    parser.add_argument("--canary-packet-output", default="", help="Optional path for a metrics-only canary evidence packet zip.")
    parser.add_argument("--canary-diagnostic-dir", default="", help="Optional redacted diagnostic directory to convert into canary evidence.")
    parser.add_argument("--canary-diagnostic-zip", default="", help="Optional redacted diagnostic zip to convert into canary evidence.")
    parser.add_argument("--canary-since", default="", help="Only count canary trace events at or after this ISO timestamp.")
    parser.add_argument("--canary-last-minutes", default="", help="Only count canary trace events from the last N minutes.")
    parser.add_argument("--strict-real", action="store_true", help="Require strict real canary intake to pass.")
    parser.add_argument("--rollback-tested", action="store_true", help="Mark the canary report rollback drill as tested.")
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
    source_digest = directory_digest(source)
    source_contract = adapter_contract_from_source(host, source)
    backup = None
    if target.exists():
        backup = unique_backup_path(target)
    if not apply:
        return {
            "step": "install_adapter",
            "ok": True,
            "dryRun": True,
            "source": str(source),
            "target": str(target),
            "backup": str(backup) if backup else None,
            "sourceDigest": source_digest,
            "adapterContract": source_contract,
        }
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        assert backup is not None
        shutil.move(str(target), str(backup))
    shutil.copytree(source, target)
    target_digest = directory_digest(target)
    return {
        "step": "install_adapter",
        "ok": target_digest == source_digest,
        "source": str(source),
        "target": str(target),
        "backup": str(backup) if backup else None,
        "sourceDigest": source_digest,
        "targetDigest": target_digest,
        "adapterContract": source_contract,
        "installedMatchesSource": target_digest == source_digest,
    }


def unique_backup_path(target: Path) -> Path:
    base = target.with_name(f"{target.name}.bak-selfmem-update-{int(time.time())}")
    if not base.exists():
        return base
    for index in range(2, 1000):
        candidate = target.with_name(f"{base.name}-{index}")
        if not candidate.exists():
            return candidate
    raise RuntimeError(f"could not allocate backup path for {target}")


def directory_digest(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def adapter_contract_from_source(host: str, source: Path) -> dict[str, Any]:
    file = source / ("__init__.py" if host == "hermes" else "index.mjs")
    if not file.exists():
        return {"found": False}
    text = file.read_text(encoding="utf-8", errors="ignore")
    return {
        "found": "recallweave-selfmem-canary" in text,
        "name": "recallweave-selfmem-canary" if "recallweave-selfmem-canary" in text else "unknown",
        "strictCanaryContract": "v1" if "strictCanaryContract" in text and ('"v1"' in text or "'v1'" in text) else "unknown",
        "searchLatencyInstrumentation": "searchLatencyInstrumentation" in text or "search_latency_instrumentation" in text,
        "storeLatencyInstrumentation": "storeLatencyInstrumentation" in text or "store_latency_instrumentation" in text,
    }


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


def run_canary(host: str, home: Path, args: argparse.Namespace) -> dict[str, Any]:
    command = (
        [sys.executable, str(REPO_ROOT / "packages" / "adapters" / "hermes" / "selfmem_canary_standalone_smoke.py")]
        if host == "hermes"
        else ["node", str(REPO_ROOT / "packages" / "adapters" / "openclaw" / "selfmem_canary_standalone_smoke.mjs")]
    )
    result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=30)
    output: dict[str, Any] = {
        "ok": result.returncode == 0,
        "evidenceType": "adapter-smoke-plus-optional-runtime-canary",
        "adapterSmoke": {
            "ok": result.returncode == 0,
            "evidenceType": "adapter-smoke-with-mocked-provider-calls",
            "command": "adapter standalone smoke",
            "stdout": parse_json(result.stdout),
            "stderr": result.stderr[-1000:],
        },
    }
    runtime = run_runtime_canary(host, home, args)
    if runtime:
        output["runtimeReport"] = runtime
        if args.strict_real and not runtime["ok"]:
            output["ok"] = False
    elif args.strict_real or args.canary_output or args.canary_intake_output or args.canary_diagnosis_output or args.canary_packet_output:
        output["ok"] = False
        output["runtimeReport"] = {
            "ok": False,
            "reportGenerated": False,
            "source": "missing",
            "strictReal": bool(args.strict_real),
            "rollbackTested": bool(args.rollback_tested),
            "reason": "strict real canary requires a live container, diagnostic directory, or diagnostic zip",
            "nextActions": [
                "Run the agent long enough to create a mapped RecallWeave container, or pass --canary-diagnostic-dir/--canary-diagnostic-zip.",
                "Collect a fresh runtime window after installing the patched adapter.",
                "Do not treat adapter standalone smoke as real rollout evidence.",
            ],
        }
    return output


def run_runtime_canary(host: str, home: Path, args: argparse.Namespace) -> dict[str, Any] | None:
    source_args = runtime_canary_source_args(host, home, args)
    if not source_args:
        return None
    output_path = Path(args.canary_output).expanduser().resolve() if args.canary_output else None
    temp_file = None
    temp_intake_file = None
    temp_diagnosis_file = None
    if output_path is None:
        temp_file = tempfile.NamedTemporaryFile(prefix="recallweave-canary-", suffix=".json", delete=False)
        temp_file.close()
        output_path = Path(temp_file.name)
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)

    intake_output_path = Path(args.canary_intake_output).expanduser().resolve() if args.canary_intake_output else None
    if intake_output_path is None:
        temp_intake_file = tempfile.NamedTemporaryFile(prefix="recallweave-canary-intake-", suffix=".json", delete=False)
        temp_intake_file.close()
        intake_output_path = Path(temp_intake_file.name)
    else:
        intake_output_path.parent.mkdir(parents=True, exist_ok=True)

    diagnosis_output_path = Path(args.canary_diagnosis_output).expanduser().resolve() if args.canary_diagnosis_output else None
    if diagnosis_output_path is not None:
        diagnosis_output_path.parent.mkdir(parents=True, exist_ok=True)
    packet_output_path = Path(args.canary_packet_output).expanduser().resolve() if args.canary_packet_output else None
    if packet_output_path is not None:
        packet_output_path.parent.mkdir(parents=True, exist_ok=True)

    report_command = [
        "node",
        str(REPO_ROOT / "packages" / "bench" / "canary-report-from-trace.mjs"),
        *source_args,
        "--output",
        str(output_path),
    ]
    if args.canary_since:
        report_command.extend(["--since", args.canary_since])
    if args.canary_last_minutes:
        report_command.extend(["--last-minutes", args.canary_last_minutes])
    if args.rollback_tested:
        report_command.append("--rollback-tested")
    report = subprocess.run(report_command, cwd=REPO_ROOT, capture_output=True, text=True, check=False, timeout=45)
    runtime: dict[str, Any] = {
        "ok": report.returncode == 0,
        "reportGenerated": report.returncode == 0,
        "reportPath": str(output_path) if args.canary_output else "",
        "source": runtime_canary_source_label(source_args),
        "strictReal": bool(args.strict_real),
        "rollbackTested": bool(args.rollback_tested),
        "stderr": report.stderr[-1000:],
    }
    if report.returncode != 0:
        cleanup_temp(temp_file)
        cleanup_temp(temp_intake_file)
        cleanup_temp(temp_diagnosis_file)
        return runtime

    runtime["report"] = summarize_canary_report(parse_json(report.stdout))
    intake_command = [
        "node",
        str(REPO_ROOT / "packages" / "bench" / "canary-evidence-intake.mjs"),
        "--report",
        str(output_path),
        "--output",
        str(intake_output_path),
    ]
    if args.strict_real:
        intake_command.append("--strict-real")
    intake = subprocess.run(intake_command, cwd=REPO_ROOT, capture_output=True, text=True, check=False, timeout=30)
    runtime["intake"] = summarize_canary_intake(parse_json(intake.stdout))
    runtime["intakePath"] = str(intake_output_path) if args.canary_intake_output else ""
    runtime["intakeOk"] = intake.returncode == 0
    runtime["intakeStderr"] = intake.stderr[-1000:]
    diagnosis_ran = False
    if intake.returncode != 0:
        if diagnosis_output_path is None:
            temp_diagnosis_file = tempfile.NamedTemporaryFile(prefix="recallweave-canary-diagnosis-", suffix=".json", delete=False)
            temp_diagnosis_file.close()
            diagnosis_output_path = Path(temp_diagnosis_file.name)
        diagnosis = subprocess.run([
            "node",
            str(REPO_ROOT / "packages" / "bench" / "canary-remediation.mjs"),
            "--report",
            str(output_path),
            "--output",
            str(diagnosis_output_path),
        ], cwd=REPO_ROOT, capture_output=True, text=True, check=False, timeout=30)
        runtime["diagnosis"] = summarize_canary_diagnosis(parse_json(diagnosis.stdout))
        runtime["diagnosisPath"] = str(diagnosis_output_path) if args.canary_diagnosis_output else ""
        diagnosis_ran = True
        runtime["ok"] = False

    if packet_output_path is not None:
        packet_command = [
            "node",
            str(REPO_ROOT / "packages" / "bench" / "canary-evidence-packet.mjs"),
            "--report",
            str(output_path),
            "--intake",
            str(intake_output_path),
            "--output",
            str(packet_output_path),
        ]
        if diagnosis_ran and diagnosis_output_path is not None:
            packet_command.extend(["--diagnosis", str(diagnosis_output_path)])
        if args.strict_real and intake.returncode == 0:
            packet_command.append("--strict-real")
        packet = subprocess.run(packet_command, cwd=REPO_ROOT, capture_output=True, text=True, check=False, timeout=30)
        runtime["packet"] = summarize_canary_packet(parse_json(packet.stdout))
        runtime["packetPath"] = str(packet_output_path)
        runtime["packetOk"] = packet.returncode == 0
        runtime["packetStderr"] = packet.stderr[-1000:]
        if packet.returncode != 0:
            runtime["ok"] = False

    cleanup_temp(temp_file)
    cleanup_temp(temp_intake_file)
    cleanup_temp(temp_diagnosis_file)
    return runtime


def runtime_canary_source_args(host: str, home: Path, args: argparse.Namespace) -> list[str]:
    if args.canary_diagnostic_dir:
        return ["--diagnostic-dir", str(Path(args.canary_diagnostic_dir).expanduser().resolve())]
    if args.canary_diagnostic_zip:
        return ["--diagnostic-zip", str(Path(args.canary_diagnostic_zip).expanduser().resolve())]
    container = newest_container_dir(host, home)
    if not container:
        return []
    return ["--host", host, "--container", str(container)]


def runtime_canary_source_label(source_args: list[str]) -> str:
    if "--diagnostic-dir" in source_args:
        return "diagnostic-dir"
    if "--diagnostic-zip" in source_args:
        return "diagnostic-zip"
    if "--container" in source_args:
        return "container"
    return "unknown"


def newest_container_dir(host: str, home: Path) -> Path | None:
    root = home / ("selfmem_canary" if host == "hermes" else "selfmem") / "containers"
    if not root.exists():
        return None
    containers = [path for path in root.iterdir() if path.is_dir()]
    if not containers:
        return None

    def sort_key(path: Path) -> float:
        candidates = [path / "trace.jsonl", path / "container-map.json", path]
        return max((candidate.stat().st_mtime for candidate in candidates if candidate.exists()), default=0.0)

    return sorted(containers, key=sort_key, reverse=True)[0]


def summarize_canary_report(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    return {
        "mode": value.get("mode"),
        "fixtureOnly": value.get("fixtureOnly"),
        "evidenceType": value.get("evidenceType"),
        "evidenceSource": value.get("evidenceSource"),
        "host": ((value.get("agent") or {}).get("host")),
        "window": value.get("window"),
        "counts": value.get("counts"),
        "latencyMs": value.get("latencyMs"),
        "instrumentation": value.get("instrumentation"),
        "quality": value.get("quality"),
        "privacy": value.get("privacy"),
    }


def summarize_canary_intake(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    return {
        "ok": value.get("ok"),
        "fixtureOnly": value.get("fixtureOnly"),
        "countsAsRealRolloutEvidence": value.get("countsAsRealRolloutEvidence"),
        "canaryPass": value.get("canaryPass"),
        "failedChecks": value.get("failedChecks"),
        "lifecycle": value.get("lifecycle"),
        "latencyMs": value.get("latencyMs"),
        "instrumentation": value.get("instrumentation"),
        "quality": value.get("quality"),
        "privacy": value.get("privacy"),
    }


def summarize_canary_diagnosis(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    return {
        "ok": value.get("ok"),
        "canaryPass": value.get("canaryPass"),
        "severity": value.get("severity"),
        "failedChecks": value.get("failedChecks"),
        "measurements": value.get("measurements"),
        "actions": value.get("actions"),
        "operatorSummary": value.get("operatorSummary"),
    }


def summarize_canary_packet(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    return {
        "ok": value.get("ok"),
        "mode": value.get("mode"),
        "strictReal": value.get("strictReal"),
        "fixtureOnly": value.get("fixtureOnly"),
        "canaryPass": value.get("canaryPass"),
        "countsAsRealRolloutEvidence": value.get("countsAsRealRolloutEvidence"),
        "packagePassesStrictReal": value.get("packagePassesStrictReal"),
        "publicLaunchAllowed": value.get("publicLaunchAllowed"),
        "fleetRolloutAllowed": value.get("fleetRolloutAllowed"),
        "packet": value.get("packet"),
    }


def cleanup_temp(temp_file: Any) -> None:
    if not temp_file:
        return
    try:
        Path(temp_file.name).unlink(missing_ok=True)
    except Exception:
        pass


def parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except Exception:
        return text[-2000:]


if __name__ == "__main__":
    main()
