#!/usr/bin/env bash
# Compatibility shim — archived load probe; see scripts/archive/pilot-load-smoke.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT}/scripts/archive/pilot-load-smoke.sh" "$@"
