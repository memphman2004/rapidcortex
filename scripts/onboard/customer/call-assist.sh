#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
export ONBOARD_VERTICAL=call_assist
exec bash "${ROOT}/scripts/onboard/customer/run.sh" "${1:-}"
