#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
HERMES_REPO="${HERMES_REPO:-$(pwd)}"
TARGET_DIR="$HERMES_REPO/plugins/memory/selfmem_canary"

if [[ ! -d "$HERMES_REPO" ]]; then
  echo "HERMES_REPO does not exist: $HERMES_REPO" >&2
  exit 2
fi

mkdir -p "$HERMES_REPO/plugins/memory"
rm -rf "$TARGET_DIR"
cp -R "$REPO_ROOT/packages/adapters/hermes/selfmem_canary" "$TARGET_DIR"

python3 "$SCRIPT_DIR/hermes-detect-container.py"

cat <<EOF

Installed selfmem_canary provider at:
  $TARGET_DIR

Next:
  1. Snapshot the active Hermes config.
  2. Run packages/adapters/hermes/selfmem_canary_smoke.py from the Hermes repo.
  3. Only after the smoke passes, set memory.provider: selfmem_canary for the canary agent.

This script does not edit config.yaml and does not restart Hermes.
EOF

