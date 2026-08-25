#!/usr/bin/env bash
# Pilot concurrency probe against the live API (Lambda) and optionally the Next.js app.
#
# Lambda/SAM (execute-api HttpApiUrl):
#   CONCURRENCY=20 REQUESTS=100 API_BASE_URL=https://....execute-api.us-east-1.amazonaws.com \
#     ./scripts/pilot-load-smoke.sh
#
# Next.js / ECS (correct host for /api/auth/session):
#   NEXTJS_BASE_URL=https://app.rapidcortex.us ./scripts/pilot-load-smoke.sh
#
# Authenticated SAM list route (GET /api/agencies — not /api/rc-admin/agencies):
#   AUTH_TOKEN=eyJ... API_BASE_URL=... ./scripts/pilot-load-smoke.sh
#
# SKIP_CORS_CHECK=1 is accepted and ignored (no CORS probe in this script).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${SKIP_CORS_CHECK:=0}"

LAMBDA_BASE="${LAMBDA_BASE_URL:-${API_BASE_URL:-}}"
NEXTJS_BASE="${NEXTJS_BASE_URL:-}"

if [[ -z "$LAMBDA_BASE" && -z "$NEXTJS_BASE" ]]; then
  echo "Set API_BASE_URL (Lambda HttpApiUrl) and/or NEXTJS_BASE_URL (https://app.rapidcortex.us)." >&2
  exit 1
fi

export LAMBDA_BASE_URL="${LAMBDA_BASE}"
export NEXTJS_BASE_URL="${NEXTJS_BASE}"
export CONCURRENCY="${CONCURRENCY:-20}"
export REQUESTS="${REQUESTS:-100}"
exec bash "${ROOT}/scripts/stress-test-endpoints.sh"
