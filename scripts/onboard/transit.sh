#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export ONBOARD_VERTICAL=transit
exec bash "${ROOT}/scripts/onboard/run.sh" "${1:-}"
