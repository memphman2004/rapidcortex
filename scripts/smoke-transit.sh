#!/usr/bin/env bash
# Transit vertical smoke — unauthenticated path checks + optional authenticated dashboard.
# Usage:
#   bash scripts/smoke-transit.sh
#   bash scripts/smoke.sh --vertical transit
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${WEB_SMOKE_BASE_URL:-${SMOKE_WEB_BASE_URL:-https://app.rapidcortex.us}}"
BASE="${BASE%/}"

fail=0
check() {
  local path="$1"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" -L "${BASE}${path}" || true)"
  if [[ "$code" =~ ^(200|302|303|307|308|401|403)$ ]]; then
    echo "ok  ${path} (${code})"
  else
    echo "FAIL ${path} (${code})"
    fail=1
  fi
}

echo "Transit smoke against ${BASE}"
check "/app/transit/admin"
check "/app/transit/supervisor"
check "/app/transit/security"
check "/app/transit/operator"
check "/transit/HVT"
check "/transit/HVT/fleet"

if [[ -n "${TRANSIT_ID_TOKEN:-}" ]]; then
  api="${API_UPSTREAM_BASE_2:-${API_UPSTREAM_BASE:-}}"
  agency="${TRANSIT_TEST_AGENCY_ID:-test-transit-hvt}"
  if [[ -n "$api" ]]; then
    code="$(curl -sS -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer ${TRANSIT_ID_TOKEN}" \
      "${api%/}/api/transit/${agency}/dashboard" || true)"
    if [[ "$code" == "200" ]]; then
      echo "ok  API dashboard (200)"
    else
      echo "FAIL API dashboard (${code})"
      fail=1
    fi
  fi
fi

exit "$fail"
