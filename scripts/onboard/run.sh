#!/usr/bin/env bash
# Day-0 Rapid Cortex tenant provision. Usage:
#   bash scripts/onboard/<vertical>.sh scripts/onboard/vars/<vertical>.env
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERTICAL="${ONBOARD_VERTICAL:?Set ONBOARD_VERTICAL (campus|venue|transit|hospital|psap)}"
ENV_FILE="${1:-}"
if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    echo "Copy scripts/onboard/vars/${VERTICAL}.env.example and fill agency fields." >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
export VERTICAL="${ONBOARD_VERTICAL:?Set ONBOARD_VERTICAL (campus|venue|transit|hospital|psap)}"
cd "$ROOT"
npx tsx "${ROOT}/scripts/onboard/onboard-agency.ts"
