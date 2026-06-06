#!/usr/bin/env bash
# Compatibility shim — archived multi-env web smoke; prefer scripts/smoke-web.sh per stage.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT}/scripts/archive/smoke-web-all-envs.sh" "$@"
