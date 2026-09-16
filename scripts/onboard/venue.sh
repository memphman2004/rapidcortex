#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ONBOARD_VERTICAL=venue
exec bash "${ROOT}/scripts/onboard/run.sh" "${1:-}"
