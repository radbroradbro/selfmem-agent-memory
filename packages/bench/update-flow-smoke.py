#!/usr/bin/env python3
"""Fixture-safe smoke test for the RecallWeave runtime updater."""

from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
UPDATER = REPO_ROOT / "bin" / "selfmem_update"
UPDATER_IMPL = REPO_ROOT / "plugins" / "selfmem-fallback" / "scripts" / "selfmem_update.py"


def main() -> None:
    results = []
    with tempfile.TemporaryDirectory(prefix="recallweave-update-smoke-") as tmp:
        root = Path(tmp)
        assert UPDATER.exists(), "selfmem_update command wrapper missing"
        assert os.access(UPDATER, os.X_OK), "selfmem_update command wrapper must be executable"
        compile_result = subprocess.run(
            [sys.executable, "-m", "py_compile", str(UPDATER_IMPL)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
        assert compile_result.returncode == 0, compile_result.stderr
        results.append(run_host_case(root, "hermes"))
        results.append(run_host_case(root, "openclaw"))

    print(
        json.dumps(
            {
                "ok": all(item["ok"] for item in results),
                "command": "selfmem_update",
                "wrapper": str(UPDATER.relative_to(REPO_ROOT)),
                "results": results,
            },
            indent=2,
            sort_keys=True,
        )
    )


def run_host_case(root: Path, host: str) -> dict[str, Any]:
    home = root / f"{host}-home"
    runtime = root / f"{host}-runtime"
    keys_file = root / f"{host}-keys.env"
    setup_fixture(host, home, runtime, keys_file)

    dry = run_update(host, home, runtime, keys_file, apply=False)
    assert dry["ok"] is True
    assert dry["dryRun"] is True
    assert dry["startedAt"].endswith("Z")
    assert dry["freshCanarySince"] == dry["startedAt"]
    assert dry["preservedMapping"]["found"] is True
    assert not installed_key_path(host, home).exists(), "dry-run must not copy keys"
    assert (adapter_target(host, runtime) / "OLD_ADAPTER.txt").exists(), "dry-run must not replace adapter"

    applied = run_update(host, home, runtime, keys_file, apply=True)
    assert applied["ok"] is True
    assert applied["dryRun"] is False
    assert applied["preservedMapping"]["found"] is True
    assert installed_key_path(host, home).read_text(encoding="utf-8").strip() == "RECALLWEAVE_FIXTURE_KEY=fixture"
    assert stat.S_IMODE(installed_key_path(host, home).stat().st_mode) == 0o600
    assert adapter_target(host, runtime).exists(), "apply must install adapter"
    assert not (adapter_target(host, runtime) / "OLD_ADAPTER.txt").exists(), "apply must replace old adapter"
    assert any(path.name.startswith(f"{adapter_target(host, runtime).name}.bak-selfmem-update-") for path in adapter_target(host, runtime).parent.iterdir())

    if host == "openclaw":
        assert (home / "selfmem" / "audit.py").exists(), "OpenClaw update should install audit helper by default"

    second_apply = run_update(host, home, runtime, keys_file, apply=True)
    assert second_apply["ok"] is True
    assert len(list(adapter_target(host, runtime).parent.glob(f"{adapter_target(host, runtime).name}.bak-selfmem-update-*"))) >= 2
    assert_strict_real_requires_runtime_source(root, host, runtime, keys_file)

    canary_output = root / f"{host}-canary-report.json"
    canary = run_update(
        host,
        home,
        runtime,
        keys_file,
        apply=False,
        extra=[
            "--run-canary",
            "--canary-diagnostic-dir",
            str(REPO_ROOT / "packages" / "bench" / "fixtures" / "canary-diagnostic-export.fixture"),
            "--canary-output",
            str(canary_output),
            "--canary-since",
            "2026-05-22T18:59:00.000Z",
            "--rollback-tested",
        ],
    )
    assert canary["ok"] is True
    assert canary["freshCanarySince"] == "2026-05-22T18:59:00.000Z"
    assert canary["canary"]["adapterSmoke"]["ok"] is True
    assert canary["canary"]["runtimeReport"]["reportGenerated"] is True
    assert canary["canary"]["runtimeReport"]["report"]["evidenceSource"]["windowFilter"]["since"] == "2026-05-22T18:59:00.000Z"
    assert canary["canary"]["runtimeReport"]["intakeOk"] is True
    assert canary["canary"]["runtimeReport"]["intake"]["canaryPass"] is True
    assert canary["canary"]["runtimeReport"]["intake"]["countsAsRealRolloutEvidence"] is False
    assert canary_output.exists(), "canary output should be written when requested"

    return {
        "ok": True,
        "host": host,
        "dryRunSteps": [step["step"] for step in dry["steps"]],
        "applySteps": [step["step"] for step in applied["steps"]],
        "secondApplySteps": [step["step"] for step in second_apply["steps"]],
        "canarySource": canary["canary"]["runtimeReport"]["source"],
        "canaryIntakePass": canary["canary"]["runtimeReport"]["intake"]["canaryPass"],
        "strictRealSourceRequired": True,
        "mappingFound": applied["preservedMapping"]["found"],
        "keyMode": oct(stat.S_IMODE(installed_key_path(host, home).stat().st_mode)),
    }


def assert_strict_real_requires_runtime_source(root: Path, host: str, runtime: Path, keys_file: Path) -> None:
    empty_home = root / f"{host}-empty-home"
    empty_home.mkdir(parents=True, exist_ok=True)
    result = run_update_raw(
        host,
        empty_home,
        runtime,
        keys_file,
        apply=False,
        extra=["--run-canary", "--strict-real"],
    )
    assert result.returncode != 0, "strict-real must fail when no live runtime source exists"
    payload = json.loads(result.stdout)
    assert payload["ok"] is False
    assert payload["canary"]["adapterSmoke"]["ok"] is True
    assert payload["canary"]["runtimeReport"]["ok"] is False
    assert payload["canary"]["runtimeReport"]["source"] == "missing"
    assert "requires a live container" in payload["canary"]["runtimeReport"]["reason"]


def setup_fixture(host: str, home: Path, runtime: Path, keys_file: Path) -> None:
    home.mkdir(parents=True, exist_ok=True)
    runtime.mkdir(parents=True, exist_ok=True)
    keys_file.write_text("RECALLWEAVE_FIXTURE_KEY=fixture\n", encoding="utf-8")

    map_root = home / ("selfmem_canary" if host == "hermes" else "selfmem") / "containers" / "selfmem_fixture"
    map_root.mkdir(parents=True, exist_ok=True)
    (map_root / "container-map.json").write_text(
        json.dumps(
            {
                "agent_identity": f"{host}-fixture-agent",
                "source_supermemory_container": f"{host}_fixture_source",
                "local_container": f"selfmem_{host}_fixture_source",
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    target = adapter_target(host, runtime)
    target.mkdir(parents=True, exist_ok=True)
    (target / "OLD_ADAPTER.txt").write_text("old adapter fixture\n", encoding="utf-8")


def run_update(host: str, home: Path, runtime: Path, keys_file: Path, *, apply: bool, extra: list[str] | None = None) -> dict[str, Any]:
    result = run_update_raw(host, home, runtime, keys_file, apply=apply, extra=extra)
    if result.returncode != 0:
        raise AssertionError(f"updater failed for {host}: {result.stderr}\n{result.stdout}")
    return json.loads(result.stdout)


def run_update_raw(host: str, home: Path, runtime: Path, keys_file: Path, *, apply: bool, extra: list[str] | None = None) -> subprocess.CompletedProcess[str]:
    command = [
        str(UPDATER),
        "--host",
        host,
        "--home",
        str(home),
        "--repo",
        str(runtime),
        "--keys-file",
        str(keys_file),
    ]
    if apply:
        command.append("--apply")
    if extra:
        command.extend(extra)

    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        env={**os.environ, "PYTHONWARNINGS": "error"},
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )


def adapter_target(host: str, runtime: Path) -> Path:
    if host == "hermes":
        return runtime / "plugins" / "memory" / "selfmem_canary"
    return runtime / "plugins" / "selfmem_canary"


def installed_key_path(host: str, home: Path) -> Path:
    return home / ("selfmem_canary" if host == "hermes" else "selfmem") / "keys.env"


if __name__ == "__main__":
    main()
